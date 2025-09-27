import { addDoc, collection, CollectionReference, doc, DocumentReference, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Abono, Cliente, MovimientoCaja, Pedido, PedidoItem, ProduccionEvento, BitacoraEntrada } from '@/lib/types'

type CollectionName = 'clientes' | 'pedidos' | 'abonos' | 'movimientos_caja' | 'bitacora'

export const clientesCollection = collection(db, 'clientes') as CollectionReference<Omit<Cliente, 'id'>>
export const pedidosCollection = collection(db, 'pedidos') as CollectionReference<Omit<Pedido, 'id'>>
export const abonosCollection = collection(db, 'abonos') as CollectionReference<Omit<Abono, 'id'>>
export const movimientosCajaCollection = collection(db, 'movimientos_caja') as CollectionReference<Omit<MovimientoCaja, 'id'>>
export const bitacoraCollection = collection(db, 'bitacora') as CollectionReference<Omit<BitacoraEntrada, 'id'>>

export function pedidoItemsCollection(pedidoId: string) {
  return collection(db, 'pedidos', pedidoId, 'pedido_items') as CollectionReference<Omit<PedidoItem, 'id'>>
}

export function produccionEventosCollection(pedidoId: string) {
  return collection(db, 'pedidos', pedidoId, 'produccion_eventos') as CollectionReference<Omit<ProduccionEvento, 'id'>>
}

export function ref<T = unknown>(path: CollectionName, id: string) {
  return doc(db, path, id) as DocumentReference<T>
}

export function timestampNow() {
  return serverTimestamp() as Timestamp
}

export async function registrarBitacora(entrada: Omit<BitacoraEntrada, 'id' | 'timestamp'>) {
  await addDoc(bitacoraCollection, {
    ...entrada,
    timestamp: serverTimestamp() as Timestamp,
  })
}
