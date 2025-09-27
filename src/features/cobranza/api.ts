import { Timestamp, collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Pedido } from '@/lib/types'
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
    })

    transaction.set(movimientoDoc, {
      fecha: Timestamp.fromDate(values.fecha),
      tipo: 'INGRESO',
      categoria: 'COBRANZA',
      monto: values.monto,
      referencia_pedido_id: pedidoRef,
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
