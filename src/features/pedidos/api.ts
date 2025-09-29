import { Timestamp, addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc, where, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Pedido, PedidoEstado, ProduccionEvento } from '@/lib/types'
import { PedidoForm } from '@/lib/validators'
import { movimientosCajaCollection, pedidoItemsCollection, registrarBitacora } from '@/lib/firestore'

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
    const importe = item.cantidad * item.precio_unitario
    const itemRef = doc(pedidoItemsCollection(pedidoDoc.id))
    batch.set(itemRef, {
      descripcion_item: item.descripcion_item,
      prenda: item.prenda,
      talla: item.talla,
      color_prenda: item.color_prenda,
      ubicacion: item.ubicacion,
      puntadas_estimadas: item.puntadas_estimadas,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      importe,
      observaciones: item.observaciones ?? '',
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
  const payload = {
    ...values,
    fecha_pedido: values.fecha_pedido ? Timestamp.fromDate(values.fecha_pedido) : undefined,
    fecha_compromiso: values.fecha_compromiso ? Timestamp.fromDate(values.fecha_compromiso) : undefined,
    actualizado_en: serverTimestamp(),
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
  await deleteDoc(doc(pedidosRef, id))
  await registrarBitacora({
    entidad: 'pedidos',
    entidad_id: id,
    accion: 'ELIMINAR',
    usuario: usuarioId,
    datos: {},
  })
}
