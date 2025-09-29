import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { MovimientoCaja } from '@/lib/types'
import { MovimientoCajaForm } from '@/lib/validators'
import { registrarBitacora } from '@/lib/firestore'

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
  await deleteDoc(doc(movimientosRef, id))
  await registrarBitacora({
    entidad: 'movimientos_caja',
    entidad_id: id,
    accion: 'ELIMINAR',
    usuario: usuarioId,
    datos: {},
  })
}
