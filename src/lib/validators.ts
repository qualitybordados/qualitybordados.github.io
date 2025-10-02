import { z } from 'zod'

const telefonoRegex = /^\d{10}$/
const rfcRegex = /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{3}$/

const optionalString = z.string().trim().optional().default('')

export const clienteSchema = z.object({
  nombre_legal: optionalString,
  alias: z.string().trim().min(2, 'Ingresa un alias'),
  rfc: optionalString
    .transform((value) => value.toUpperCase())
    .refine((value) => !value || rfcRegex.test(value), 'RFC inválido'),
  email: optionalString.refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Correo inválido',
  ),
  telefono: z.string().trim().regex(telefonoRegex, 'Teléfono a 10 dígitos'),
  direccion: optionalString,
  ciudad: optionalString,
  cp: optionalString.refine((value) => !value || value.length >= 5, 'Código postal a 5 dígitos'),
  limite_credito: z.coerce.number().min(0).multipleOf(0.01).optional().default(0),
  dias_credito: z.coerce.number().int().min(0).optional().default(0),
  estatus: z.enum(['ACTIVO', 'PAUSADO']).optional().default('ACTIVO'),
})

export const pedidoItemSchema = z.object({
  descripcion_item: z.string().min(3),
  cantidad: z.coerce.number().int().min(1),
  precio_unitario: z.coerce.number().min(0).multipleOf(0.01),
  importe: z.coerce.number().min(0).multipleOf(0.01),
})

export const pedidoFinanzasSchema = z.object({
  anticipo: z.coerce.number().min(0).multipleOf(0.01),
  subtotal: z.coerce.number().min(0).multipleOf(0.01),
  descuento: z.coerce.number().min(0).multipleOf(0.01),
  impuestos: z.coerce.number().min(0).multipleOf(0.01),
  total: z.coerce.number().min(0).multipleOf(0.01),
  saldo: z.coerce.number().min(0).multipleOf(0.01),
})

export const pedidoSchema = z.object({
  folio: z.string().min(3),
  cliente_id: z.string(),
  fecha_pedido: z.date(),
  fecha_compromiso: z.date(),
  status: z.enum([
    'COTIZACIÓN',
    'APROBADO',
    'DIGITIZADO',
    'EN_PRODUCCIÓN',
    'CALIDAD',
    'LISTO_ENTREGA',
    'ENTREGADO',
    'CERRADO',
    'CANCELADO',
  ]),
  prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA']),
  notas: z.string().optional().default(''),
  anticipo: z.coerce.number().min(0).multipleOf(0.01),
  subtotal: z.coerce.number().min(0).multipleOf(0.01),
  descuento: z.coerce.number().min(0).multipleOf(0.01),
  impuestos: z.coerce.number().min(0).multipleOf(0.01),
  total: z.coerce.number().min(0).multipleOf(0.01),
  saldo: z.coerce.number().min(0).multipleOf(0.01),
  items: z.array(pedidoItemSchema).min(1),
})

export const abonoSchema = z.object({
  pedido_id: z.string(),
  cliente_id: z.string(),
  fecha: z.date(),
  monto: z.coerce.number().min(0).multipleOf(0.01),
  metodo: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']),
  ref: z.string().optional().default(''),
  notas: z.string().optional().default(''),
})

export const movimientoCajaSchema = z.object({
  fecha: z.date(),
  tipo: z.enum(['INGRESO', 'EGRESO']),
  categoria: z.string().min(2),
  monto: z.coerce.number().min(0).multipleOf(0.01),
  referencia_pedido_id: z.string().optional(),
  notas: z.string().optional().default(''),
})

export const configSchema = z.object({
  porcentaje_anticipo: z.coerce.number().min(0).max(100),
  dias_credito: z.coerce.number().min(0),
  politicas_credito: z.string().optional().default(''),
  roles_visibles: z.array(z.enum(['OWNER', 'ADMIN', 'VENTAS', 'PRODUCCION', 'COBRANZA'])).min(1),
})

export type ClienteForm = z.infer<typeof clienteSchema>
export type PedidoForm = z.infer<typeof pedidoSchema>
export type PedidoItemForm = z.infer<typeof pedidoItemSchema>
export type AbonoForm = z.infer<typeof abonoSchema>
export type MovimientoCajaForm = z.infer<typeof movimientoCajaSchema>
export type ConfiguracionForm = z.infer<typeof configSchema>
