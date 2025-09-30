import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Abono, MovimientoCaja, Pedido, PedidoEstado, PedidoItem, ProduccionEvento } from '@/lib/types'
import { PedidoForm } from '@/lib/validators'
import {
  abonosCollection,
  movimientosCajaCollection,
  pedidoItemsCollection,
  produccionEventosCollection,
  registrarBitacora,
} from '@/lib/firestore'

const pedidosRef = collection(db, 'pedidos')

export async function fetchPedidos(params?: {
  status?: PedidoEstado | 'TODOS'
  prioridad?: string
  clienteId?: string
}) {
  const conditions = []
  if (params?.status && params.status !== 'TODOS') {
    conditions.push(where('status', '==', params.status))
  }
  if (params?.prioridad && params.prioridad !== 'TODAS') {
    conditions.push(where('prioridad', '==', params.prioridad))
  }
  if (params?.clienteId) {
    conditions.push(where('cliente_id', '==', doc(db, 'clientes', params.clienteId)))
  }

  const q = query(pedidosRef, ...conditions, orderBy('fecha_compromiso', 'desc'), limit(100))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<Pedido, 'id'>) }))
}

export async function fetchPedidoItems(pedidoId: string) {
  const snapshot = await getDocs(pedidoItemsCollection(pedidoId))
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    const cantidad = data.cantidad ?? (data.precio_unitario ? Number((data.importe / data.precio_unitario).toFixed(2)) : 1)
    return {
      id: docSnap.id,
      descripcion_item: data.descripcion_item,
      cantidad,
      precio_unitario: data.precio_unitario,
      importe: data.importe,
    } satisfies PedidoItem
  })
}

export async function fetchPedidoAbonos(pedidoId: string) {
  const pedidoRef = doc(db, 'pedidos', pedidoId)
  const q = query(abonosCollection, where('pedido_id', '==', pedidoRef), orderBy('fecha', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      pedido_id: data.pedido_id,
      cliente_id: data.cliente_id,
      fecha: data.fecha,
      monto: data.monto,
      metodo: data.metodo,
      ref: data.ref ?? '',
      notas: data.notas ?? '',
      registrado_por: data.registrado_por,
      creado_en: data.creado_en,
      ...(data.movimiento_caja_id ? { movimiento_caja_id: data.movimiento_caja_id } : {}),
    } satisfies Abono
  })
}

function buildPedidoPayload(values: PedidoForm, usuarioId: string) {
  return {
    folio: values.folio,
    cliente_id: doc(db, 'clientes', values.cliente_id),
    fecha_pedido: Timestamp.fromDate(values.fecha_pedido),
    fecha_compromiso: Timestamp.fromDate(values.fecha_compromiso),
    status: values.status,
    anticipo: values.anticipo,
    subtotal: values.subtotal,
    descuento: values.descuento,
    impuestos: values.impuestos,
    total: values.total,
    saldo: values.saldo,
    prioridad: values.prioridad,
    notas: values.notas ?? '',
    creado_por: usuarioId,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }
}

export async function createPedido(values: PedidoForm, usuarioId: string) {
  const payload = buildPedidoPayload(values, usuarioId)
  const pedidoDoc = await addDoc(pedidosRef, payload)

  const batch = writeBatch(db)
  values.items.forEach((item) => {
    const itemRef = doc(pedidoItemsCollection(pedidoDoc.id))
    batch.set(itemRef, {
      descripcion_item: item.descripcion_item,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      importe: item.importe,
    })
  })
  await batch.commit()

  if (values.anticipo > 0) {
    const movimientoPayload = {
      fecha: Timestamp.fromDate(values.fecha_pedido),
      tipo: 'INGRESO' as const,
      categoria: 'ANTICIPO',
      monto: values.anticipo,
      referencia_pedido_id: pedidoDoc,
      notas: 'Anticipo registrado al crear pedido',
      registrado_por: usuarioId,
      creado_en: serverTimestamp(),
    }

    const movimientoDoc = await addDoc(movimientosCajaCollection, movimientoPayload)

    await registrarBitacora({
      entidad: 'movimientos_caja',
      entidad_id: movimientoDoc.id,
      accion: 'CREAR',
      usuario: usuarioId,
      datos: movimientoPayload,
    })
  }

  await registrarBitacora({
    entidad: 'pedidos',
    entidad_id: pedidoDoc.id,
    accion: 'CREAR',
    usuario: usuarioId,
    datos: payload,
  })

  return pedidoDoc.id
}

export async function updatePedido(id: string, values: Partial<PedidoForm>, usuarioId: string) {
  const pedidoDoc = doc(pedidosRef, id)
  const payload: Record<string, unknown> = {
    ...values,
    actualizado_en: serverTimestamp(),
  }

  if (values.fecha_pedido) {
    payload.fecha_pedido = Timestamp.fromDate(values.fecha_pedido)
  } else {
    delete payload.fecha_pedido
  }

  if (values.fecha_compromiso) {
    payload.fecha_compromiso = Timestamp.fromDate(values.fecha_compromiso)
  } else {
    delete payload.fecha_compromiso
  }

  if (values.items) {
    const batch = writeBatch(db)
    const itemsRef = pedidoItemsCollection(id)
    const existingItems = await getDocs(itemsRef)
    existingItems.forEach((itemDoc) => {
      batch.delete(itemDoc.ref)
    })
    values.items.forEach((item) => {
      const itemRef = doc(itemsRef)
      batch.set(itemRef, {
        descripcion_item: item.descripcion_item,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        importe: item.importe,
      })
    })
    delete payload.items
    await batch.commit()
  }

  await updateDoc(pedidoDoc, payload)

  await registrarBitacora({
    entidad: 'pedidos',
    entidad_id: id,
    accion: 'ACTUALIZAR',
    usuario: usuarioId,
    datos: payload,
  })
}

export async function actualizarEstadoPedido(id: string, estado: PedidoEstado, usuarioId: string, data: Partial<ProduccionEvento> = {}) {
  const pedidoDoc = doc(pedidosRef, id)
  const payload = {
    status: estado,
    actualizado_en: serverTimestamp(),
  }
  await updateDoc(pedidoDoc, payload)

  if (data.estado) {
    const eventosRef = collection(db, 'pedidos', id, 'produccion_eventos')
    await addDoc(eventosRef, {
      estado: data.estado,
      responsable: data.responsable ?? usuarioId,
      fecha_inicio: data.fecha_inicio ?? serverTimestamp(),
      fecha_fin: data.fecha_fin ?? null,
      evidencia_url: data.evidencia_url ?? '',
      notas: data.notas ?? '',
    })
  }

  await registrarBitacora({
    entidad: 'pedidos',
    entidad_id: id,
    accion: `CAMBIO_ESTADO_${estado}`,
    usuario: usuarioId,
    datos: payload,
  })
}

export async function eliminarPedido(id: string, usuarioId: string) {
  const pedidoRef = doc(pedidosRef, id)
  const itemsSnapshot = await getDocs(pedidoItemsCollection(id))
  const eventosSnapshot = await getDocs(produccionEventosCollection(id))
  const abonosSnapshot = await getDocs(query(abonosCollection, where('pedido_id', '==', pedidoRef)))
  const movimientosSnapshot = await getDocs(query(movimientosCajaCollection, where('referencia_pedido_id', '==', pedidoRef)))

  const batch = writeBatch(db)
  const abonosBitacora: { id: string; monto: number }[] = []
  const movimientosBitacora: { id: string; categoria: string; tipo: string }[] = []

  itemsSnapshot.forEach((itemDoc) => {
    batch.delete(itemDoc.ref)
  })

  eventosSnapshot.forEach((eventoDoc) => {
    batch.delete(eventoDoc.ref)
  })

  abonosSnapshot.forEach((abonoDoc) => {
    const data = abonoDoc.data() as Omit<Abono, 'id'>
    abonosBitacora.push({ id: abonoDoc.id, monto: data.monto })
    batch.delete(abonoDoc.ref)
  })

  movimientosSnapshot.forEach((movimientoDoc) => {
    const data = movimientoDoc.data() as Omit<MovimientoCaja, 'id'>
    movimientosBitacora.push({ id: movimientoDoc.id, categoria: data.categoria ?? '', tipo: data.tipo ?? '' })
    batch.delete(movimientoDoc.ref)
  })

  batch.delete(pedidoRef)

  await batch.commit()

  await Promise.all([
    ...abonosBitacora.map((abono) =>
      registrarBitacora({
        entidad: 'abonos',
        entidad_id: abono.id,
        accion: 'ELIMINAR',
        usuario: usuarioId,
        datos: { motivo: 'PEDIDO_ELIMINADO', monto: abono.monto },
      }),
    ),
    ...movimientosBitacora.map((movimiento) =>
      registrarBitacora({
        entidad: 'movimientos_caja',
        entidad_id: movimiento.id,
        accion: 'ELIMINAR',
        usuario: usuarioId,
        datos: { motivo: 'PEDIDO_ELIMINADO', categoria: movimiento.categoria, tipo: movimiento.tipo },
      }),
    ),
    registrarBitacora({
      entidad: 'pedidos',
      entidad_id: id,
      accion: 'ELIMINAR',
      usuario: usuarioId,
      datos: {},
    }),
  ])
}
