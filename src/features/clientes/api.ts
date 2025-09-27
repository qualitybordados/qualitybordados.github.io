import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Cliente } from '@/lib/types'
import { ClienteForm } from '@/lib/validators'
import { registrarBitacora } from '@/lib/firestore'

const clientesRef = collection(db, 'clientes')

export async function fetchClientes(params?: { search?: string; ciudad?: string; estatus?: string }) {
  const conditions = []
  if (params?.estatus && params.estatus !== 'TODOS') {
    conditions.push(where('estatus', '==', params.estatus))
  }
  if (params?.ciudad) {
    conditions.push(where('ciudad', '==', params.ciudad))
  }

  const q = query(clientesRef, ...conditions, orderBy('nombre_legal'))
  const snapshot = await getDocs(q)
  const clientes = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<Cliente, 'id'>) }))

  if (params?.search) {
    const term = params.search.toLowerCase()
    return clientes.filter((cliente) =>
      [cliente.nombre_legal, cliente.alias, cliente.email, cliente.ciudad].some((field) =>
        field.toLowerCase().includes(term),
      ),
    )
  }

  return clientes
}

export async function createCliente(data: ClienteForm, usuarioId: string) {
  const payload = {
    ...data,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }
  const docRef = await addDoc(clientesRef, payload)
  await registrarBitacora({
    entidad: 'clientes',
    entidad_id: docRef.id,
    accion: 'CREAR',
    usuario: usuarioId,
    datos: payload,
  })
  return docRef.id
}

export async function updateCliente(id: string, data: Partial<ClienteForm>, usuarioId: string) {
  const docRef = doc(clientesRef, id)
  const payload = {
    ...data,
    actualizado_en: serverTimestamp(),
  }
  await updateDoc(docRef, payload)
  await registrarBitacora({
    entidad: 'clientes',
    entidad_id: id,
    accion: 'ACTUALIZAR',
    usuario: usuarioId,
    datos: payload,
  })
}

export async function deleteCliente(id: string, usuarioId: string) {
  await deleteDoc(doc(clientesRef, id))
  await registrarBitacora({
    entidad: 'clientes',
    entidad_id: id,
    accion: 'ELIMINAR',
    usuario: usuarioId,
    datos: {},
  })
}
