import { Timestamp, collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Pedido } from '@/lib/types'
import dayjs from 'dayjs'

const pedidosRef = collection(db, 'pedidos')
const movimientosRef = collection(db, 'movimientos_caja')

export async function fetchDashboardData() {
  const now = dayjs()
  const tresDias = now.add(3, 'day').toDate()
  const sieteDiasAtras = now.subtract(7, 'day').toDate()

  const estadosActivos = ['COTIZACIÓN', 'APROBADO', 'DIGITIZADO', 'EN_PRODUCCIÓN', 'CALIDAD', 'LISTO_ENTREGA']

  const activosSnap = await getDocs(query(pedidosRef, where('status', 'in', estadosActivos)))
  const pedidosActivos = activosSnap.size

  const proximasEntregasSnap = await getDocs(
    query(pedidosRef, where('status', 'in', estadosActivos), where('fecha_compromiso', '<=', Timestamp.fromDate(tresDias))),
  )
  const entregasProximas = proximasEntregasSnap.size
  const proximasEntregas = proximasEntregasSnap.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Pedido, 'id'>
    return {
      id: docSnap.id,
      folio: data.folio,
      cliente: data.cliente_id.id,
      fecha_compromiso: data.fecha_compromiso.toDate(),
      status: data.status,
    }
  })

  const carteraVencidaSnap = await getDocs(
    query(pedidosRef, where('saldo', '>', 0), where('fecha_compromiso', '<', Timestamp.fromDate(now.toDate()))),
  )
  const carteraVencida = carteraVencidaSnap.docs.reduce((sum, docSnap) => {
    const data = docSnap.data() as Omit<Pedido, 'id'>
    return sum + data.saldo
  }, 0)

  const movimientosSnap = await getDocs(
    query(movimientosRef, where('fecha', '>=', Timestamp.fromDate(sieteDiasAtras)), orderBy('fecha', 'asc')),
  )
  const flujoCaja = movimientosSnap.docs.map((docSnap) => {
    const data = docSnap.data() as { fecha: Timestamp; monto: number; tipo: string }
    return {
      fecha: data.fecha.toDate(),
      monto: data.tipo === 'EGRESO' ? data.monto * -1 : data.monto,
    }
  })

  const pedidosPorEstadoMap = new Map<string, number>()
  activosSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Omit<Pedido, 'id'>
    pedidosPorEstadoMap.set(data.status, (pedidosPorEstadoMap.get(data.status) ?? 0) + 1)
  })

  return {
    pedidosActivos,
    carteraVencida,
    entregasProximas,
    flujoCaja,
    pedidosPorEstado: Array.from(pedidosPorEstadoMap.entries()).map(([estado, total]) => ({ estado, total })),
    proximasEntregas,
  }
}
