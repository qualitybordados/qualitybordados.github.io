import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Abono, Pedido } from '@/lib/types'
import { AbonoForm } from '@/lib/validators'
import { registrarBitacora } from '@/lib/firestore'

const pedidosRef = collection(db, 'pedidos')
const abonosRef = collection(db, 'abonos')
const movimientosRef = collection(db, 'movimientos_caja')

export async function fetchPedidosConSaldo() {
  const q = query(pedidosRef, where('saldo', '>', 0), orderBy('saldo', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<Pedido, 'id'>) }))
}

export async function registrarAbonoPedido(values: AbonoForm, usuarioId: string) {
  const pedidoRef = doc(db, 'pedidos', values.pedido_id)
  const clienteRef = doc(db, 'clientes', values.cliente_id)
  const abonoDoc = doc(abonosRef)
  const movimientoDoc = doc(movimientosRef)
  let nuevoSaldo = 0

  await runTransaction(db, async (transaction) => {
    const pedidoSnap = await transaction.get(pedidoRef)
    if (!pedidoSnap.exists()) {
      throw new Error('Pedido no encontrado')
    }
    const pedidoData = pedidoSnap.data() as Omit<Pedido, 'id'>
    nuevoSaldo = Math.max(pedidoData.saldo - values.monto, 0)

    transaction.update(pedidoRef, {
      saldo: nuevoSaldo,
      actualizado_en: serverTimestamp(),
    })

    transaction.set(abonoDoc, {
      pedido_id: pedidoRef,
      cliente_id: clienteRef,
      fecha: Timestamp.fromDate(values.fecha),
      monto: values.monto,
      metodo: values.metodo,
      ref: values.ref ?? '',
      notas: values.notas ?? '',
      registrado_por: usuarioId,
      creado_en: serverTimestamp(),
      movimiento_caja_id: movimientoDoc,
    })

    transaction.set(movimientoDoc, {
      fecha: Timestamp.fromDate(values.fecha),
      tipo: 'INGRESO',
      categoria: 'COBRANZA',
      monto: values.monto,
      referencia_pedido_id: pedidoRef,
      referencia_abono_id: abonoDoc,
      notas: `Abono ${values.metodo}`,
      registrado_por: usuarioId,
      creado_en: serverTimestamp(),
    })
  })

  await registrarBitacora({
    entidad: 'abonos',
    entidad_id: abonoDoc.id,
    accion: 'REGISTRAR_ABONO',
    usuario: usuarioId,
    datos: { pedidoId: pedidoRef.id, monto: values.monto },
  })

  await registrarBitacora({
    entidad: 'pedidos',
    entidad_id: pedidoRef.id,
    accion: 'ACTUALIZAR_SALDO',
    usuario: usuarioId,
    datos: { saldo: nuevoSaldo },
  })
}

type EliminarAbonoOptions = {
  eliminarMovimiento?: boolean
}

export async function eliminarAbonoPedido(abonoId: string, usuarioId: string, options: EliminarAbonoOptions = {}) {
  const { eliminarMovimiento = true } = options
  const abonoRef = doc(abonosRef, abonoId)
  let abonoData: (Omit<Abono, 'id'> & { id: string }) | undefined
  let movimientoId: string | null = null
  let pedidoId: string | null = null
  let nuevoSaldo = 0

  await runTransaction(db, async (transaction) => {
    const abonoSnap = await transaction.get(abonoRef)
    if (!abonoSnap.exists()) {
      throw new Error('Abono no encontrado')
    }

    const data = abonoSnap.data() as Omit<Abono, 'id'>
    abonoData = { ...data, id: abonoId }
    const pedidoRef = data.pedido_id
    pedidoId = pedidoRef.id
    movimientoId = data.movimiento_caja_id?.id ?? null

    const pedidoSnap = await transaction.get(pedidoRef)
    if (!pedidoSnap.exists()) {
      throw new Error('Pedido asociado no encontrado')
    }

    const pedidoData = pedidoSnap.data() as Omit<Pedido, 'id'>
    const saldoMaximo = Math.max(pedidoData.total - pedidoData.anticipo, 0)
    nuevoSaldo = Math.min(saldoMaximo, Math.max(pedidoData.saldo + data.monto, 0))

    transaction.delete(abonoRef)
    transaction.update(pedidoRef, {
      saldo: nuevoSaldo,
      actualizado_en: serverTimestamp(),
    })

    if (eliminarMovimiento && data.movimiento_caja_id) {
      transaction.delete(data.movimiento_caja_id)
    }
  })

  if (!abonoData || !pedidoId) {
    return
  }

  const abonoInfo = abonoData

  await registrarBitacora({
    entidad: 'abonos',
    entidad_id: abonoInfo.id,
    accion: 'ELIMINAR',
    usuario: usuarioId,
    datos: { monto: abonoInfo.monto, pedido_id: pedidoId },
  })

  await registrarBitacora({
    entidad: 'pedidos',
    entidad_id: pedidoId,
    accion: 'ACTUALIZAR_SALDO',
    usuario: usuarioId,
    datos: { saldo: nuevoSaldo },
  })

  if (eliminarMovimiento && movimientoId) {
    await registrarBitacora({
      entidad: 'movimientos_caja',
      entidad_id: movimientoId,
      accion: 'ELIMINAR',
      usuario: usuarioId,
      datos: { motivo: 'ABONO_ELIMINADO' },
    })
  }
}
