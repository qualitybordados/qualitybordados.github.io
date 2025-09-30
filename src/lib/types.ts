import { Timestamp, DocumentReference } from 'firebase/firestore'
import { AppRole } from '@/stores/auth-store'

export type ClienteEstatus = 'ACTIVO' | 'PAUSADO'

export interface Cliente {
  id: string
  nombre_legal: string
  alias: string
  rfc: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  cp: string
  limite_credito: number
  dias_credito: number
  estatus: ClienteEstatus
  creado_en: Timestamp
  actualizado_en: Timestamp
}

export type PedidoEstado =
  | 'COTIZACIÓN'
  | 'APROBADO'
  | 'DIGITIZADO'
  | 'EN_PRODUCCIÓN'
  | 'CALIDAD'
  | 'LISTO_ENTREGA'
  | 'ENTREGADO'
  | 'CERRADO'
  | 'CANCELADO'

export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA'

export interface Pedido {
  id: string
  folio: string
  cliente_id: DocumentReference
  fecha_pedido: Timestamp
  fecha_compromiso: Timestamp
  status: PedidoEstado
  anticipo: number
  subtotal: number
  descuento: number
  impuestos: number
  total: number
  saldo: number
  prioridad: Prioridad
  notas: string
  creado_por: string
  creado_en: Timestamp
  actualizado_en: Timestamp
}

export interface PedidoItem {
  id: string
  descripcion_item: string
  cantidad: number
  precio_unitario: number
  importe: number
}

export interface ProduccionEvento {
  id: string
  estado: string
  responsable: string
  fecha_inicio: Timestamp
  fecha_fin?: Timestamp
  evidencia_url?: string
  notas?: string
}

export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'

export interface Abono {
  id: string
  pedido_id: DocumentReference
  cliente_id: DocumentReference
  fecha: Timestamp
  monto: number
  metodo: MetodoPago
  ref: string
  notas: string
  registrado_por: string
  creado_en: Timestamp
  movimiento_caja_id?: DocumentReference
}

export type MovimientoTipo = 'INGRESO' | 'EGRESO'

export interface MovimientoCaja {
  id: string
  fecha: Timestamp
  tipo: MovimientoTipo
  categoria: string
  monto: number
  referencia_pedido_id?: DocumentReference
  referencia_abono_id?: DocumentReference
  notas: string
  registrado_por: string
  creado_en: Timestamp
}

export interface BitacoraEntrada {
  id: string
  entidad: string
  entidad_id: string
  accion: string
  usuario: string
  timestamp: Timestamp
  datos: Record<string, unknown>
}

export type UsuarioRol = AppRole
