import { Timestamp, collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Pedido } from '@/lib/types'
import dayjs from 'dayjs'

const pedidosRef = collection(db, 'pedidos')
const movimientosRef = collection(db, 'movimientos_caja')

function normalizeToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate()
  }

  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = dayjs(value)
    if (parsed.isValid()) {
      return parsed.toDate()
    }
  }

  return null
}

function extractClienteId(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id: unknown }).id === 'string') {
    return (value as { id: string }).id
  }

  return ''
}

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
  const proximasEntregas = proximasEntregasSnap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Omit<Pedido, 'id'>
      const fechaCompromiso = normalizeToDate(data.fecha_compromiso as unknown)

      if (!fechaCompromiso) {
        return null
      }

      return {
        id: docSnap.id,
        folio: data.folio,
        cliente: extractClienteId(data.cliente_id as unknown),
        fecha_compromiso: fechaCompromiso,
        status: data.status,
      }
    })
    .filter((pedido): pedido is {
      id: string
      folio: string
      cliente: string
      fecha_compromiso: Date
      status: Pedido['status']
    } => pedido !== null)

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
