import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Pedido, MovimientoCaja } from '@/lib/types'
import { MovimientoCajaForm } from '@/lib/validators'
import { abonosCollection, registrarBitacora } from '@/lib/firestore'
import { eliminarAbonoPedido } from '@/features/cobranza/api'

const movimientosRef = collection(db, 'movimientos_caja')

export async function fetchMovimientosCaja(params?: {
  tipo?: 'INGRESO' | 'EGRESO' | 'TODOS'
  categoria?: string
  desde?: Date
  hasta?: Date
}) {
  const conditions = []
  if (params?.tipo && params.tipo !== 'TODOS') {
    conditions.push(where('tipo', '==', params.tipo))
  }
  if (params?.categoria) {
    conditions.push(where('categoria', '==', params.categoria))
  }
  if (params?.desde) {
    conditions.push(where('fecha', '>=', Timestamp.fromDate(params.desde)))
  }
  if (params?.hasta) {
    conditions.push(where('fecha', '<=', Timestamp.fromDate(params.hasta)))
  }
  const q = query(movimientosRef, ...conditions, orderBy('fecha', 'desc'), limit(200))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<MovimientoCaja, 'id'>) }))
}

export async function crearMovimientoCaja(values: MovimientoCajaForm, usuarioId: string) {
  const payload = {
    fecha: Timestamp.fromDate(values.fecha),
    tipo: values.tipo,
    categoria: values.categoria,
    monto: values.monto,
    referencia_pedido_id: values.referencia_pedido_id ? doc(db, 'pedidos', values.referencia_pedido_id) : null,
    notas: values.notas ?? '',
    registrado_por: usuarioId,
    creado_en: serverTimestamp(),
  }
  const docRef = await addDoc(movimientosRef, payload)
  await registrarBitacora({
    entidad: 'movimientos_caja',
    entidad_id: docRef.id,
    accion: 'CREAR',
    usuario: usuarioId,
    datos: payload,
  })
}

export async function actualizarMovimientoCaja(id: string, values: MovimientoCajaForm, usuarioId: string) {
  const docRef = doc(movimientosRef, id)
  const payload = {
    fecha: Timestamp.fromDate(values.fecha),
    tipo: values.tipo,
    categoria: values.categoria,
    monto: values.monto,
    referencia_pedido_id: values.referencia_pedido_id ? doc(db, 'pedidos', values.referencia_pedido_id) : null,
    notas: values.notas ?? '',
    actualizado_en: serverTimestamp(),
  }
  await updateDoc(docRef, payload)
  await registrarBitacora({
    entidad: 'movimientos_caja',
    entidad_id: id,
    accion: 'ACTUALIZAR',
    usuario: usuarioId,
    datos: payload,
  })
}

export async function eliminarMovimientoCaja(id: string, usuarioId: string) {
  const movimientoRef = doc(movimientosRef, id)
  const movimientoSnap = await getDoc(movimientoRef)
  if (!movimientoSnap.exists()) {
    throw new Error('Movimiento no encontrado')
  }

  const movimientoData = movimientoSnap.data() as Omit<MovimientoCaja, 'id'>

  let abonoEliminado = false

  if (movimientoData.referencia_abono_id) {
    await eliminarAbonoPedido(movimientoData.referencia_abono_id.id, usuarioId, { eliminarMovimiento: false })
    abonoEliminado = true
  } else if (movimientoData.categoria === 'COBRANZA' && movimientoData.referencia_pedido_id) {
    const abonoRelacionado = await buscarAbonoRelacionado(movimientoData)
    if (abonoRelacionado) {
      await eliminarAbonoPedido(abonoRelacionado.id, usuarioId, { eliminarMovimiento: false })
      abonoEliminado = true
    }
  }

  if (!abonoEliminado && movimientoData.referencia_pedido_id && movimientoData.tipo === 'INGRESO') {
    if (movimientoData.categoria === 'ANTICIPO') {
      await ajustarAnticipoTrasEliminarMovimiento(movimientoData.referencia_pedido_id.id, movimientoData.monto)
    } else {
      await ajustarSaldoTrasEliminarIngreso(movimientoData.referencia_pedido_id.id, movimientoData.monto)
    }
  }

  await deleteDoc(movimientoRef)

  await registrarBitacora({
    entidad: 'movimientos_caja',
    entidad_id: id,
    accion: 'ELIMINAR',
    usuario: usuarioId,
    datos: {
      categoria: movimientoData.categoria,
      tipo: movimientoData.tipo,
      referencia_pedido_id: movimientoData.referencia_pedido_id?.id ?? null,
    },
  })
}

async function ajustarAnticipoTrasEliminarMovimiento(pedidoId: string, monto: number) {
  const pedidoRef = doc(db, 'pedidos', pedidoId)
  await runTransaction(db, async (transaction) => {
    const pedidoSnap = await transaction.get(pedidoRef)
    if (!pedidoSnap.exists()) {
      return
    }

    const pedidoData = pedidoSnap.data() as Omit<Pedido, 'id'>
    const totalAbonos = Math.max(pedidoData.total - pedidoData.anticipo - pedidoData.saldo, 0)
    const nuevoAnticipo = Math.max(pedidoData.anticipo - monto, 0)
    const saldoMaximo = Math.max(pedidoData.total - nuevoAnticipo, 0)
    const nuevoSaldo = Math.max(saldoMaximo - totalAbonos, 0)

    transaction.update(pedidoRef, {
      anticipo: nuevoAnticipo,
      saldo: nuevoSaldo,
      actualizado_en: serverTimestamp(),
    })
  })
}

async function ajustarSaldoTrasEliminarIngreso(pedidoId: string, monto: number) {
  const pedidoRef = doc(db, 'pedidos', pedidoId)
  await runTransaction(db, async (transaction) => {
    const pedidoSnap = await transaction.get(pedidoRef)
    if (!pedidoSnap.exists()) {
      return
    }

    const pedidoData = pedidoSnap.data() as Omit<Pedido, 'id'>
    const saldoMaximo = Math.max(pedidoData.total - pedidoData.anticipo, 0)
    const nuevoSaldo = Math.min(saldoMaximo, Math.max(pedidoData.saldo + monto, 0))

    transaction.update(pedidoRef, {
      saldo: nuevoSaldo,
      actualizado_en: serverTimestamp(),
    })
  })
}

async function buscarAbonoRelacionado(movimiento: Omit<MovimientoCaja, 'id'>) {
  if (!movimiento.referencia_pedido_id) {
    return null
  }

  const q = query(
    abonosCollection,
    where('pedido_id', '==', movimiento.referencia_pedido_id),
    where('monto', '==', movimiento.monto),
    where('fecha', '==', movimiento.fecha),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs[0] ?? null
}
