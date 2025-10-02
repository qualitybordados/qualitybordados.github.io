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
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Abono, Cliente, Pedido, MovimientoCaja } from '@/lib/types'
import { MovimientoCajaForm } from '@/lib/validators'
import { abonosCollection, getDocumentId, registrarBitacora } from '@/lib/firestore'
import { eliminarAbonoPedido } from '@/features/cobranza/api'

const movimientosRef = collection(db, 'movimientos_caja')

export type MovimientoCajaConDetalles = MovimientoCaja & {
  referenciaPedidoId?: string | null
  pedido?: {
    id: string
    folio: string
    status: Pedido['status']
    fecha_compromiso: Pedido['fecha_compromiso']
  }
  cliente?: {
    id: string
    alias: string
    nombre_legal?: string
    telefono?: string
  }
}

export async function fetchMovimientosCaja(params?: {
  tipo?: 'INGRESO' | 'EGRESO' | 'TODOS'
  desde?: Date
  hasta?: Date
}) {
  const conditions = []
  if (params?.tipo && params.tipo !== 'TODOS') {
    conditions.push(where('tipo', '==', params.tipo))
  }
  if (params?.desde) {
    conditions.push(where('fecha', '>=', Timestamp.fromDate(params.desde)))
  }
  if (params?.hasta) {
    conditions.push(where('fecha', '<=', Timestamp.fromDate(params.hasta)))
  }
  const q = query(movimientosRef, ...conditions, orderBy('fecha', 'desc'), limit(200))
  const snapshot = await getDocs(q)
  const movimientos = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<MovimientoCaja, 'id'>),
  }))

  const pedidoIds = new Set<string>()
  movimientos.forEach((movimiento) => {
    if (!movimiento.referencia_pedido_id) {
      return
    }

    try {
      const pedidoId = getDocumentId(movimiento.referencia_pedido_id)
      pedidoIds.add(pedidoId)
    } catch (error) {
      console.error('No se pudo obtener el id del pedido relacionado al movimiento', error)
    }
  })

  const pedidosMap = new Map<string, Pedido>()
  await Promise.all(
    Array.from(pedidoIds).map(async (pedidoId) => {
      const pedidoRef = doc(db, 'pedidos', pedidoId)
      const pedidoSnap = await getDoc(pedidoRef)
      if (pedidoSnap.exists()) {
        const pedidoData = pedidoSnap.data() as Omit<Pedido, 'id'>
        pedidosMap.set(pedidoId, { id: pedidoSnap.id, ...pedidoData })
      }
    }),
  )

  const clienteIds = new Set<string>()
  pedidosMap.forEach((pedido) => {
    try {
      const clienteId = getDocumentId(pedido.cliente_id)
      clienteIds.add(clienteId)
    } catch (error) {
      console.error('No se pudo obtener el id del cliente relacionado al pedido', error)
    }
  })

  const clientesMap = new Map<string, Cliente>()
  await Promise.all(
    Array.from(clienteIds).map(async (clienteId) => {
      const clienteRef = doc(db, 'clientes', clienteId)
      const clienteSnap = await getDoc(clienteRef)
      if (clienteSnap.exists()) {
        const clienteData = clienteSnap.data() as Omit<Cliente, 'id'>
        clientesMap.set(clienteId, { id: clienteSnap.id, ...clienteData })
      }
    }),
  )

  return movimientos.map<MovimientoCajaConDetalles>((movimiento) => {
    let referenciaPedidoId: string | null = null
    let pedidoDetalle: MovimientoCajaConDetalles['pedido']
    let clienteDetalle: MovimientoCajaConDetalles['cliente']

    if (movimiento.referencia_pedido_id) {
      try {
        referenciaPedidoId = getDocumentId(movimiento.referencia_pedido_id)
        const pedido = referenciaPedidoId ? pedidosMap.get(referenciaPedidoId) : undefined
        if (pedido) {
          pedidoDetalle = {
            id: pedido.id,
            folio: pedido.folio,
            status: pedido.status,
            fecha_compromiso: pedido.fecha_compromiso,
          }

          try {
            const clienteId = getDocumentId(pedido.cliente_id)
            const cliente = clientesMap.get(clienteId)
            if (cliente) {
              clienteDetalle = {
                id: cliente.id,
                alias: cliente.alias,
                nombre_legal: cliente.nombre_legal,
                telefono: cliente.telefono,
              }
            }
          } catch (error) {
            console.error('No se pudo obtener el cliente relacionado al pedido en movimiento de caja', error)
          }
        }
      } catch (error) {
        console.error('No se pudo interpretar la referencia del pedido en movimiento de caja', error)
      }
    }

    return {
      ...movimiento,
      referenciaPedidoId,
      ...(pedidoDetalle ? { pedido: pedidoDetalle } : {}),
      ...(clienteDetalle ? { cliente: clienteDetalle } : {}),
    }
  })
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
  const movimientoRef = doc(movimientosRef, id)
  const fechaTimestamp = Timestamp.fromDate(values.fecha)
  let referenciaPedidoRef = values.referencia_pedido_id ? doc(db, 'pedidos', values.referencia_pedido_id) : null

  await runTransaction(db, async (transaction) => {
    const movimientoSnap = await transaction.get(movimientoRef)
    if (!movimientoSnap.exists()) {
      throw new Error('Movimiento no encontrado')
    }

    const movimientoData = movimientoSnap.data() as Omit<MovimientoCaja, 'id'>
    let referenciaPedidoParaActualizar = referenciaPedidoRef

    if (movimientoData.referencia_abono_id) {
      const abonoRef = movimientoData.referencia_abono_id
      const abonoSnap = await transaction.get(abonoRef)
      if (abonoSnap.exists()) {
        const abonoData = abonoSnap.data() as Omit<Abono, 'id'>
        const pedidoRef = abonoData.pedido_id
        const pedidoSnap = await transaction.get(pedidoRef)

        if (pedidoSnap.exists()) {
          const pedidoData = pedidoSnap.data() as Omit<Pedido, 'id'>
          const saldoMaximo = Math.max(pedidoData.total - pedidoData.anticipo, 0)
          const nuevoSaldo = Math.min(
            saldoMaximo,
            Math.max(pedidoData.saldo + abonoData.monto - values.monto, 0),
          )

          transaction.update(pedidoRef, {
            saldo: nuevoSaldo,
            actualizado_en: serverTimestamp(),
          })
        }

        transaction.update(abonoRef, {
          fecha: fechaTimestamp,
          monto: values.monto,
        })

        referenciaPedidoParaActualizar = pedidoRef
      }
    }

    transaction.update(movimientoRef, {
      fecha: fechaTimestamp,
      tipo: values.tipo,
      categoria: values.categoria,
      monto: values.monto,
      referencia_pedido_id: referenciaPedidoParaActualizar,
      notas: values.notas ?? '',
      actualizado_en: serverTimestamp(),
    })

    referenciaPedidoRef = referenciaPedidoParaActualizar
  })

  await registrarBitacora({
    entidad: 'movimientos_caja',
    entidad_id: id,
    accion: 'ACTUALIZAR',
    usuario: usuarioId,
    datos: {
      fecha: fechaTimestamp,
      tipo: values.tipo,
      categoria: values.categoria,
      monto: values.monto,
      referencia_pedido_id: referenciaPedidoRef,
      notas: values.notas ?? '',
      actualizado_en: serverTimestamp(),
    },
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
