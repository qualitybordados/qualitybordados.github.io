import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  usePedidos,
  useCreatePedido,
  useActualizarEstadoPedido,
  useUpdatePedido,
  useEliminarPedido,
  usePedidoItems,
  usePedidoAbonos,
} from '@/features/pedidos/hooks'
import { useRegistrarAbono } from '@/features/cobranza/hooks'
import { useClientes } from '@/features/clientes/hooks'
import { useConfiguracion } from '@/features/configuracion/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate, formatPhone } from '@/lib/format'
import { Cliente, Pedido, PedidoEstado, Prioridad } from '@/lib/types'
import { getDocumentId, registrarBitacora } from '@/lib/firestore'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import {
  Loader2,
  Plus,
  Calendar,
  User,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Pencil,
  Trash,
  FileDown,
  Share2,
  MessageCircle,
  Wallet,
} from 'lucide-react'
import dayjs from 'dayjs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PedidoForm, PedidoItemForm } from '@/lib/validators'
import { clsx } from 'clsx'
import { generatePedidoPdf } from '@/features/pedidos/pdf'
import { AbonoDialogForm } from '@/components/common/abono-dialog-form'

const estadosPedido: PedidoEstado[] = [
  'COTIZACIÓN',
  'APROBADO',
  'DIGITIZADO',
  'EN_PRODUCCIÓN',
  'CALIDAD',
  'LISTO_ENTREGA',
  'ENTREGADO',
  'CERRADO',
  'CANCELADO',
]

const prioridades: Prioridad[] = ['BAJA', 'MEDIA', 'ALTA']

const estadoVariantMap: Record<PedidoEstado, 'success' | 'warning' | 'destructive' | 'neutral'> = {
  COTIZACIÓN: 'neutral',
  APROBADO: 'warning',
  DIGITIZADO: 'warning',
  EN_PRODUCCIÓN: 'warning',
  CALIDAD: 'warning',
  LISTO_ENTREGA: 'success',
  ENTREGADO: 'success',
  CERRADO: 'success',
  CANCELADO: 'destructive',
}

export default function PedidosPage() {
  const { user, role, loading } = useAuth()
  const authReady = !!user && !loading
  const [estatusFiltro, setEstatusFiltro] = useState<PedidoEstado | 'TODOS'>('TODOS')
  const [folioFiltro, setFolioFiltro] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const filtrosPedidos = useMemo(() => {
    const filtros: {
      status: PedidoEstado | 'TODOS'
      folio?: string
      desde?: Date
      hasta?: Date
    } = {
      status: estatusFiltro,
    }

    const folioLimpio = folioFiltro.trim()
    if (folioLimpio) {
      filtros.folio = folioLimpio
    }

    if (fechaDesde) {
      filtros.desde = dayjs(fechaDesde).startOf('day').toDate()
    }

    if (fechaHasta) {
      filtros.hasta = dayjs(fechaHasta).endOf('day').toDate()
    }

    return filtros
  }, [estatusFiltro, folioFiltro, fechaDesde, fechaHasta])
  const {
    data: pedidos,
    isLoading,
    isFetching,
  } = usePedidos(filtrosPedidos, { enabled: authReady })
  const pedidosLoading = loading || isLoading || (authReady && isFetching && !pedidos)
  const createPedido = useCreatePedido()
  const actualizarEstado = useActualizarEstadoPedido()
  const updatePedido = useUpdatePedido()
  const eliminarPedido = useEliminarPedido()
  const registrarAbono = useRegistrarAbono()
  const { data: clientesData } = useClientes({}, { enabled: authReady })
  const { data: config } = useConfiguracion({ enabled: authReady })
  const clientesMap = useMemo(() => {
    if (!clientesData) return new Map<string, Cliente>()
    return new Map(clientesData.map((cliente) => [cliente.id, cliente]))
  }, [clientesData])

  const [wizardOpen, setWizardOpen] = useState(false)
  const [detallePedido, setDetallePedido] = useState<Pedido | null>(null)
  const [pedidoEdicion, setPedidoEdicion] = useState<Pedido | null>(null)
  const [pedidoAbono, setPedidoAbono] = useState<Pedido | null>(null)
  const [wizardKey, setWizardKey] = useState(0)
  const {
    data: pedidoItemsEdicion,
    isLoading: pedidoItemsLoading,
  } = usePedidoItems(pedidoEdicion?.id, { enabled: wizardOpen && !!pedidoEdicion })

  const pedidoInicial = useMemo(() => {
    if (!pedidoEdicion || !pedidoItemsEdicion) return null
    return {
      folio: pedidoEdicion.folio,
      cliente_id: getDocumentId(pedidoEdicion.cliente_id),
      fecha_pedido: pedidoEdicion.fecha_pedido.toDate(),
      fecha_compromiso: pedidoEdicion.fecha_compromiso.toDate(),
      status: pedidoEdicion.status,
      prioridad: pedidoEdicion.prioridad,
      notas: pedidoEdicion.notas ?? '',
      anticipo: pedidoEdicion.anticipo,
      subtotal: pedidoEdicion.subtotal,
      descuento: pedidoEdicion.descuento,
      impuestos: pedidoEdicion.impuestos,
      total: pedidoEdicion.total,
      saldo: pedidoEdicion.saldo,
      items: pedidoItemsEdicion.map((item) => ({
        descripcion_item: item.descripcion_item,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        importe: item.importe,
      })),
    } satisfies PedidoForm
  }, [pedidoEdicion, pedidoItemsEdicion])

  const puedeCrear = ['OWNER', 'ADMIN', 'VENTAS'].includes(role ?? '')
  const puedeActualizarEstado = ['OWNER', 'ADMIN', 'PRODUCCION'].includes(role ?? '')
  const puedeEditar = puedeCrear
  const puedeRegistrarAbonos = ['OWNER', 'ADMIN', 'COBRANZA', 'VENTAS'].includes(role ?? '')

  async function handleCambioEstado(pedidoId: string, estado: PedidoEstado) {
    if (!user) return
    await actualizarEstado.mutateAsync({ id: pedidoId, estado, usuarioId: user.uid })
  }

  function abrirEdicion(pedido: Pedido) {
    setDetallePedido(null)
    setPedidoEdicion(pedido)
    setWizardOpen(true)
  }

  async function handleEliminarPedido(pedido: Pedido) {
    if (!user) return
    if (confirm(`¿Eliminar el pedido ${pedido.folio}?`)) {
      await eliminarPedido.mutateAsync({ id: pedido.id, usuarioId: user.uid })
      if (detallePedido?.id === pedido.id) {
        setDetallePedido(null)
      }
    }
  }

  return (
    <div className="relative space-y-6 pb-20">
      <Card className="border-none bg-white/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Pedidos</CardTitle>
          <p className="text-xs text-slate-500">Supervisa el flujo de pedidos con una vista adaptable al tacto.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {pedidos?.length ? `${pedidos.length} pedidos en seguimiento` : 'Sin pedidos registrados aún'}
            </div>
            {puedeCrear ? (
              <Button
                onClick={() => {
                  setDetallePedido(null)
                  setPedidoEdicion(null)
                  setWizardKey((prev) => prev + 1)
                  setWizardOpen(true)
                }}
                className="hidden sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo pedido</span>
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Estatus
              <select
                value={estatusFiltro}
                onChange={(event) => setEstatusFiltro(event.target.value as PedidoEstado | 'TODOS')}
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="TODOS">Todos</option>
                {estadosPedido.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Folio
              <Input
                value={folioFiltro}
                onChange={(event) => setFolioFiltro(event.target.value)}
                placeholder="Buscar folio"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Desde
              <Input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Hasta
              <Input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} />
            </label>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {pedidosLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-none bg-white/60 p-4 shadow-sm">
              <div className="flex animate-pulse flex-col gap-3">
                <div className="h-4 w-24 rounded-full bg-slate-200" />
                <div className="h-4 w-48 rounded-full bg-slate-200" />
                <div className="h-4 w-32 rounded-full bg-slate-200" />
              </div>
            </Card>
          ))
        ) : pedidos && pedidos.length ? (
          pedidos.map((pedido) => {
            const estadoIndex = estadosPedido.indexOf(pedido.status)
            const siguienteEstado = estadosPedido[estadoIndex + 1]
            const anteriorEstado = estadosPedido[estadoIndex - 1]
            const clienteId = getDocumentId(pedido.cliente_id)
            const clienteNombre = clientesMap.get(clienteId)?.alias ?? clienteId
            return (
              <PedidoCard
                key={pedido.id}
                pedido={pedido}
                onClick={() => setDetallePedido(pedido)}
                onAvanzar={siguienteEstado ? () => handleCambioEstado(pedido.id, siguienteEstado) : undefined}
                puedeAvanzar={!!siguienteEstado && puedeActualizarEstado}
                onRetroceder={anteriorEstado ? () => handleCambioEstado(pedido.id, anteriorEstado) : undefined}
                puedeRetroceder={!!anteriorEstado && puedeActualizarEstado}
                avanzando={actualizarEstado.isPending}
                onEdit={() => abrirEdicion(pedido)}
                onDelete={() => handleEliminarPedido(pedido)}
                allowActions={puedeEditar}
                allowRegistrarAbono={puedeRegistrarAbonos}
                onRegistrarAbono={() => setPedidoAbono(pedido)}
                clienteNombre={clienteNombre}
              />
            )
          })
        ) : (
          <EmptyState
            title="Sin pedidos"
            description="Registra un nuevo pedido para comenzar el flujo de trabajo."
          />
        )}
      </section>

      {puedeCrear ? (
        <Button
          size="fab"
          className="fixed bottom-24 right-6 z-40 sm:hidden"
          onClick={() => {
            setDetallePedido(null)
            setPedidoEdicion(null)
            setWizardKey((prev) => prev + 1)
            setWizardOpen(true)
          }}
          aria-label="Nuevo pedido"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open)
          if (!open) {
            setPedidoEdicion(null)
          }
        }}
      >
        <DialogContent>
          {clientesData && config ? (
            pedidoEdicion ? (
              pedidoItemsLoading || !pedidoInicial ? (
                <DialogBody className="flex h-48 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                </DialogBody>
              ) : (
                <PedidoWizard
                  key={pedidoEdicion.id}
                  mode="edit"
                  clientes={clientesData}
                  anticipoMinimo={config.porcentaje_anticipo}
                  initialData={pedidoInicial}
                  onSubmit={async (values) => {
                    if (!user || !pedidoEdicion) return
                    await updatePedido.mutateAsync({ id: pedidoEdicion.id, data: values, usuarioId: user.uid })
                    setWizardOpen(false)
                    setPedidoEdicion(null)
                  }}
                  onClose={() => setWizardOpen(false)}
                  isSubmitting={updatePedido.isPending}
                />
              )
            ) : (
              <PedidoWizard
                key={wizardKey}
                mode="create"
                clientes={clientesData}
                anticipoMinimo={config.porcentaje_anticipo}
                onSubmit={async (values) => {
                  if (!user) return
                  await createPedido.mutateAsync({ data: values, usuarioId: user.uid })
                  setWizardOpen(false)
                }}
                onClose={() => setWizardOpen(false)}
                isSubmitting={createPedido.isPending}
              />
            )
          ) : (
            <DialogBody className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pedidoAbono} onOpenChange={(open) => !open && setPedidoAbono(null)}>
        <DialogContent>
          {pedidoAbono ? (
            <AbonoDialogForm
              pedido={pedidoAbono}
              onClose={() => setPedidoAbono(null)}
              onSubmit={async (values) => {
                if (!user) return
                await registrarAbono.mutateAsync({ data: values, usuarioId: user.uid })
                setPedidoAbono(null)
              }}
              isSubmitting={registrarAbono.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detallePedido} onOpenChange={(open) => !open && setDetallePedido(null)}>
        <DialogContent>
          {detallePedido ? (
            <DetallePedido
              pedido={detallePedido}
              cliente={(() => {
                try {
                  const clienteId = getDocumentId(detallePedido.cliente_id)
                  return clientesMap.get(clienteId) ?? null
                } catch (error) {
                  console.error(error)
                  return null
                }
              })()}
              usuarioId={user?.uid ?? null}
              onClose={() => setDetallePedido(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PedidoCard({
  pedido,
  onClick,
  onAvanzar,
  onRetroceder,
  puedeAvanzar,
  puedeRetroceder,
  avanzando,
  onEdit,
  onDelete,
  allowActions,
  allowRegistrarAbono,
  onRegistrarAbono,
  clienteNombre,
}: {
  pedido: Pedido
  onClick: () => void
  onAvanzar?: () => void
  onRetroceder?: () => void
  puedeAvanzar: boolean
  puedeRetroceder: boolean
  avanzando: boolean
  onEdit: () => void
  onDelete: () => void
  allowActions: boolean
  allowRegistrarAbono: boolean
  onRegistrarAbono: () => void
  clienteNombre: string
}) {
  const fechaCompromiso = pedido.fecha_compromiso.toDate()
  const diasRestantes = dayjs(fechaCompromiso).diff(dayjs(), 'day')
  const estadoVariant = estadoVariantMap[pedido.status] ?? 'neutral'
  const prioridadVariant = pedido.prioridad === 'ALTA' ? 'destructive' : pedido.prioridad === 'MEDIA' ? 'warning' : 'success'

  return (
    <Card
      className="relative cursor-pointer border-none bg-white/90 p-4 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="text-sm font-semibold text-slate-900">Folio {pedido.folio}</span>
          <Badge variant={estadoVariant} className="uppercase">
            {pedido.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={prioridadVariant} className="text-xs uppercase">
            {pedido.prioridad}
          </Badge>
          {allowRegistrarAbono ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 border border-slate-200 text-emerald-600"
              onClick={(event) => {
                event.stopPropagation()
                onRegistrarAbono()
              }}
              disabled={pedido.saldo <= 0}
              aria-label="Registrar abono"
              title={pedido.saldo > 0 ? 'Registrar abono' : 'Pedido sin saldo pendiente'}
            >
              <Wallet className="h-4 w-4" />
            </Button>
          ) : null}
          {allowActions ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 border border-slate-200"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit()
                }}
                aria-label="Editar pedido"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 border border-slate-200 text-destructive"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
                aria-label="Eliminar pedido"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2 text-slate-500">
          <User className="h-4 w-4 text-slate-400" />
          {clienteNombre}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="h-4 w-4 text-slate-400" />
            {formatDate(fechaCompromiso)}
          </div>
          <Badge variant={diasRestantes < 0 ? 'destructive' : diasRestantes <= 2 ? 'warning' : 'success'}>
            {diasRestantes < 0 ? `${Math.abs(diasRestantes)} días vencido` : `${diasRestantes} días`}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
          <DollarSign className="h-4 w-4 text-slate-400" />
          {formatCurrency(pedido.saldo)}
        </div>
        {((puedeRetroceder && onRetroceder) || (puedeAvanzar && onAvanzar)) ? (
          <div className="flex items-center gap-2">
            {puedeRetroceder && onRetroceder ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 border border-slate-200"
                onClick={(event) => {
                  event.stopPropagation()
                  onRetroceder()
                }}
                disabled={avanzando}
                aria-label="Retroceder estado"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
            {puedeAvanzar && onAvanzar ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 border border-slate-200"
                onClick={(event) => {
                  event.stopPropagation()
                  onAvanzar()
                }}
                disabled={avanzando}
                aria-label="Avanzar estado"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function PedidoWizard({
  clientes,
  anticipoMinimo,
  onSubmit,
  onClose,
  initialData,
  mode = 'create',
  isSubmitting = false,
}: {
  clientes: Cliente[]
  anticipoMinimo: number
  onSubmit: (values: PedidoForm) => Promise<void>
  onClose: () => void
  initialData?: PedidoForm
  mode?: 'create' | 'edit'
  isSubmitting?: boolean
}) {
  const [step, setStep] = useState(1)
  const today = dayjs().startOf('day')
  const [formState, setFormState] = useState<Omit<PedidoForm, 'items'>>(() => ({
    folio: initialData?.folio ?? `QB-${dayjs().format('YYYYMMDD-HHmm')}`,
    cliente_id: initialData?.cliente_id ?? clientes[0]?.id ?? '',
    fecha_pedido: initialData?.fecha_pedido ?? today.toDate(),
    fecha_compromiso: initialData?.fecha_compromiso ?? today.add(7, 'day').toDate(),
    status: initialData?.status ?? 'COTIZACIÓN',
    prioridad: initialData?.prioridad ?? 'MEDIA',
    notas: initialData?.notas ?? '',
    anticipo: initialData?.anticipo ?? 0,
    subtotal: initialData?.subtotal ?? 0,
    descuento: initialData?.descuento ?? 0,
    impuestos: initialData?.impuestos ?? 0,
    total: initialData?.total ?? 0,
    saldo: initialData?.saldo ?? 0,
  }))
  const [items, setItems] = useState<PedidoItemForm[]>(() =>
    (initialData?.items ?? []).map((item) => ({
      descripcion_item: item.descripcion_item,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      importe: Number((item.cantidad * item.precio_unitario).toFixed(2)),
    })),
  )
  const [descuentoActivo, setDescuentoActivo] = useState(() => (initialData ? initialData.descuento > 0 : false))
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(() => {
    if (!initialData || initialData.subtotal === 0) return 0
    return Number(((initialData.descuento / initialData.subtotal) * 100).toFixed(2))
  })
  const [impuestosActivos, setImpuestosActivos] = useState(() => (initialData ? initialData.impuestos > 0 : true))

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.importe, 0), [items])
  const descuento = useMemo(() => {
    if (!descuentoActivo) return 0
    return Number(((subtotal * descuentoPorcentaje) / 100).toFixed(2))
  }, [descuentoActivo, descuentoPorcentaje, subtotal])
  const subtotalConDescuento = useMemo(() => Math.max(Number((subtotal - descuento).toFixed(2)), 0), [subtotal, descuento])
  const impuestos = useMemo(() => {
    if (!impuestosActivos) return 0
    return Number((subtotalConDescuento * 0.16).toFixed(2))
  }, [impuestosActivos, subtotalConDescuento])
  const total = useMemo(() => Number((subtotalConDescuento + impuestos).toFixed(2)), [subtotalConDescuento, impuestos])
  const saldo = useMemo(() => Math.max(Number((total - formState.anticipo).toFixed(2)), 0), [total, formState.anticipo])
  const anticipoSugerido = useMemo(() => Number(((total * anticipoMinimo) / 100).toFixed(2)), [total, anticipoMinimo])
  const hasClientes = clientes.length > 0
  const clienteSeleccionado = useMemo(
    () => clientes.find((cliente) => cliente.id === formState.cliente_id) ?? null,
    [clientes, formState.cliente_id],
  )

  function updateItem(index: number, field: keyof PedidoItemForm, value: string | number) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item
        if (field === 'descripcion_item') {
          return { ...item, descripcion_item: String(value).slice(0, 200) }
        }
        if (field === 'precio_unitario') {
          const raw = typeof value === 'number' ? value : Number(value)
          const precio = Number.isFinite(raw) ? Number(raw.toFixed(2)) : 0
          return {
            ...item,
            precio_unitario: precio,
            importe: Number((item.cantidad * precio).toFixed(2)),
          }
        }
        if (field === 'cantidad') {
          const raw = typeof value === 'number' ? value : Number(value)
          const cantidad = Math.max(1, Math.floor(Number.isFinite(raw) ? raw : 0))
          return {
            ...item,
            cantidad,
            importe: Number((cantidad * item.precio_unitario).toFixed(2)),
          }
        }
        if (field === 'importe') {
          const raw = typeof value === 'number' ? value : Number(value)
          const importeActual = Number.isFinite(raw) ? raw : 0
          return { ...item, importe: Number(importeActual.toFixed(2)) }
        }
        return item
      }),
    )
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        descripcion_item: '',
        cantidad: 1,
        precio_unitario: 0,
        importe: 0,
      },
    ])
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return
    }
    if (!items.length) {
      alert('Agrega al menos un item al pedido.')
      return
    }
    if (dayjs(formState.fecha_compromiso).isBefore(today)) {
      if (!confirm('La fecha compromiso es anterior a hoy. ¿Deseas continuar?')) {
        return
      }
    }
    if (formState.anticipo < anticipoSugerido) {
      if (!confirm(`El anticipo es menor al ${anticipoMinimo}% sugerido. ¿Deseas continuar?`)) {
        return
      }
    }
    const normalizados = items.map((item) => ({
      descripcion_item: item.descripcion_item,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      importe: Number((item.cantidad * item.precio_unitario).toFixed(2)),
    }))
    const payload: PedidoForm = {
      ...formState,
      subtotal,
      descuento,
      impuestos,
      total,
      saldo,
      items: normalizados,
    }
    await onSubmit(payload)
  }

  const wizardSteps = [
    { id: 1, label: 'Cliente' },
    { id: 2, label: 'Items' },
    { id: 3, label: 'Importes' },
    { id: 4, label: 'Confirmar' },
  ] as const

  const isLastStep = step === 4

  if (!hasClientes) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? `Editar pedido${initialData ? ` ${initialData.folio}` : ''}` : 'Nuevo pedido'}
          </DialogTitle>
          <DialogDescription>Completa los pasos para generar el pedido y calcular los importes finales.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Alert
            variant="warning"
            title="No hay clientes activos"
            description="Registra un cliente para asociarlo al pedido."
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onClose}>
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === 'edit' ? `Editar pedido${initialData ? ` ${initialData.folio}` : ''}` : 'Nuevo pedido'}
        </DialogTitle>
        <DialogDescription>Completa los pasos para generar el pedido y calcular los importes finales.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-6">
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 sm:text-xs">
          {wizardSteps.map((wizardStep, index) => {
            const isActive = step === wizardStep.id
            return (
              <div
                key={wizardStep.id}
                className={clsx(
                  'flex w-full flex-col items-center gap-1 rounded-full border px-3 py-2 text-center uppercase',
                  isActive ? 'border-primary bg-primary text-white' : 'border-transparent bg-slate-100 text-slate-500',
                )}
              >
                <span>{wizardStep.label}</span>
                {index < wizardSteps.length - 1 ? <span className="text-[10px] text-slate-400">Paso {wizardStep.id}</span> : null}
              </div>
            )
          })}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              Cliente
              <select
                className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={formState.cliente_id}
                onChange={(event) => setFormState((prev) => ({ ...prev, cliente_id: event.target.value }))}
              >
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.alias} - {cliente.ciudad}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Fecha de compromiso
              <Input
                type="date"
                value={dayjs(formState.fecha_compromiso).format('YYYY-MM-DD')}
                min={today.format('YYYY-MM-DD')}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, fecha_compromiso: dayjs(event.target.value).toDate() }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Prioridad
              <select
                className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={formState.prioridad}
                onChange={(event) => setFormState((prev) => ({ ...prev, prioridad: event.target.value as Prioridad }))}
              >
                {prioridades.map((prioridad) => (
                  <option key={prioridad} value={prioridad}>
                    {prioridad}
                  </option>
                ))}
              </select>
            </label>
            <Textarea
              placeholder="Notas generales"
              value={formState.notas ?? ''}
              onChange={(event) => setFormState((prev) => ({ ...prev, notas: event.target.value }))}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1 text-sm md:col-span-2 lg:col-span-2">
                    Descripción
                    <Input
                      value={item.descripcion_item}
                      maxLength={200}
                      autoComplete="off"
                      onChange={(event) => updateItem(index, 'descripcion_item', event.target.value)}
                      placeholder="Describe el servicio o producto"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Cantidad
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.cantidad}
                      onChange={(event) => updateItem(index, 'cantidad', Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Precio unitario
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={item.precio_unitario}
                      onChange={(event) => updateItem(index, 'precio_unitario', Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm lg:col-span-1">
                    Subtotal
                    <Input type="text" inputMode="decimal" readOnly value={item.importe.toFixed(2)} />
                    <span className="text-xs text-slate-500">Se calcula automáticamente.</span>
                  </label>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addItem} className="w-full sm:w-auto">
              Agregar item
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Subtotal
                <Input type="number" readOnly value={subtotal.toFixed(2)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Anticipo
                <Input
                  type="number"
                  step="0.01"
                  value={formState.anticipo}
                  onChange={(event) => setFormState((prev) => ({ ...prev, anticipo: Number(event.target.value) }))}
                />
                <span className="text-xs text-slate-500">Sugerido: {formatCurrency(anticipoSugerido)}</span>
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-slate-300"
                    checked={descuentoActivo}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setDescuentoActivo(checked)
                      if (!checked) {
                        setDescuentoPorcentaje(0)
                      }
                    }}
                  />
                  Descuento (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={descuentoPorcentaje}
                  onChange={(event) => {
                    const raw = Number(event.target.value)
                    if (Number.isNaN(raw)) {
                      setDescuentoPorcentaje(0)
                      return
                    }
                    setDescuentoPorcentaje(Math.min(Math.max(raw, 0), 100))
                  }}
                  disabled={!descuentoActivo}
                  placeholder="0"
                />
                <span className="text-xs text-slate-500">
                  Aplicado: {formatCurrency(descuento)}
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-slate-300"
                    checked={impuestosActivos}
                    onChange={(event) => setImpuestosActivos(event.target.checked)}
                  />
                  Impuestos (IVA 16%)
                </label>
                <Input type="number" readOnly value={impuestos.toFixed(2)} disabled={!impuestosActivos} />
                <span className="text-xs text-slate-500">
                  Calculado sobre el subtotal con descuento.
                </span>
              </div>
            </div>
            <Alert
              variant={formState.anticipo >= anticipoSugerido ? 'success' : 'warning'}
              title={`Total: ${formatCurrency(total)} / Saldo: ${formatCurrency(saldo)}`}
              description={`Anticipo mínimo recomendado (${anticipoMinimo}%): ${formatCurrency(anticipoSugerido)}`}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4 text-sm">
            <Alert
              variant="default"
              title="Resumen del pedido"
              description={`Folio: ${formState.folio} — Cliente ${clienteSeleccionado?.alias ?? formState.cliente_id}`}
            />
            <div>
              <p className="font-medium text-slate-600">Items</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-600">
                {items.map((item, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span>
                      {item.cantidad} × {item.descripcion_item}
                    </span>
                    <span>{formatCurrency(item.importe)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-xs text-slate-500">
              <p>Subtotal: {formatCurrency(subtotal)}</p>
              <p>Descuento: {formatCurrency(descuento)}</p>
              <p>Impuestos: {formatCurrency(impuestos)}</p>
              <p className="font-semibold text-slate-700">Total: {formatCurrency(total)}</p>
              <p>Anticipo: {formatCurrency(formState.anticipo)}</p>
              <p>Saldo: {formatCurrency(saldo)}</p>
            </div>
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter className="gap-3 sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1 || isSubmitting}
          >
            Regresar
          </Button>
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={isLastStep ? handleSubmit : () => setStep((prev) => prev + 1)}
          disabled={(step === 2 && items.length === 0) || isSubmitting}
        >
          {isLastStep
            ? isSubmitting
              ? 'Guardando...'
              : mode === 'edit'
                ? 'Guardar cambios'
                : 'Crear pedido'
            : 'Continuar'}
        </Button>
      </DialogFooter>
    </>
  )
}

function DetallePedido({
  pedido,
  cliente,
  usuarioId,
  onClose,
}: {
  pedido: Pedido
  cliente: Cliente | null
  usuarioId: string | null
  onClose: () => void
}) {
  const { data: items, isLoading: itemsLoading } = usePedidoItems(pedido.id, { enabled: true })
  const { data: abonos, isLoading: abonosLoading } = usePedidoAbonos(pedido.id, { enabled: true })
  const [busyAction, setBusyAction] = useState<'pdf' | 'share' | 'whatsapp' | null>(null)

  const itemsList = items ?? []
  const abonosList = abonos ?? []
  const compromiso = pedido.fecha_compromiso.toDate()
  const compromisoLabel = dayjs(compromiso).format('DD/MM/YYYY')
  const fechaPedidoLabel = dayjs(pedido.fecha_pedido.toDate()).format('DD/MM/YYYY')
  const telefonoCliente = cliente?.telefono ?? ''
  const telefonoDigits = telefonoCliente.replace(/\D/g, '')
  const totalAbonos = useMemo(() => (abonos ?? []).reduce((sum, abono) => sum + abono.monto, 0), [abonos])
  const saldoCalculado = useMemo(() => {
    const pendiente = pedido.total - pedido.anticipo - totalAbonos
    if (!Number.isFinite(pendiente)) return 0
    return Math.max(Math.round(pendiente * 100) / 100, 0)
  }, [pedido.total, pedido.anticipo, totalAbonos])
  const currencyTextFormatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  )

  function formatCurrencyLabel(value: number) {
    return `$ ${currencyTextFormatter.format(value || 0)} MXN`
  }

  function formatMetodoPagoLabel(value: string) {
    if (!value) return ''
    return value.charAt(0) + value.slice(1).toLowerCase()
  }

  function buildWhatsappMessage() {
    const lines: string[] = []
    lines.push(`Pedido ${pedido.folio}`)
    if (cliente) {
      lines.push(`Cliente: ${cliente.alias}`)
    }
    lines.push(`Fecha compromiso: ${compromisoLabel}`)
    lines.push(`Total: ${formatCurrencyLabel(pedido.total)}`)
    lines.push(`Saldo: ${formatCurrencyLabel(saldoCalculado)}`)
    lines.push('')
    lines.push('Detalle:')
    if (itemsList.length) {
      itemsList.forEach((item) => {
        const descripcion = item.descripcion_item.replace(/\s+/g, ' ').trim()
        lines.push(`• ${descripcion || 'Sin descripción'} x${item.cantidad} — ${formatCurrencyLabel(item.importe)}`)
      })
    } else {
      lines.push('• Sin conceptos registrados')
    }
    if (pedido.notas) {
      lines.push('')
      lines.push(`Notas: ${pedido.notas}`)
    }
    lines.push('')
    lines.push('Gracias por tu preferencia.')
    return lines.join('\n')
  }

  async function logEvento(accion: string, datos: Record<string, unknown>) {
    if (!usuarioId) return
    try {
      await registrarBitacora({
        entidad: 'pedidos',
        entidad_id: pedido.id,
        accion,
        usuario: usuarioId,
        datos,
      })
    } catch (error) {
      console.error('No se pudo registrar la bitácora', error)
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function buildPdfAssets() {
    return generatePedidoPdf({ pedido, cliente, items: itemsList, abonos: abonosList })
  }

  async function handleGeneratePdf() {
    if (itemsLoading || abonosLoading) {
      alert('Los datos del pedido se están cargando. Intenta nuevamente en unos segundos.')
      return
    }
    setBusyAction('pdf')
    try {
      const { blob, fileName } = await buildPdfAssets()
      downloadBlob(blob, fileName)
      await logEvento('GENERAR_PDF_PEDIDO', { folio: pedido.folio })
    } catch (error) {
      console.error(error)
      alert('No se pudo generar el PDF. Intenta nuevamente más tarde.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSharePdf() {
    if (itemsLoading || abonosLoading) {
      alert('Los datos del pedido se están cargando. Intenta nuevamente en unos segundos.')
      return
    }
    setBusyAction('share')
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
    try {
      const { blob, fileName } = await buildPdfAssets()
      const canUseFile = typeof File !== 'undefined'
      let via: 'web-share' | 'download' = 'download'
      const file = canUseFile ? new File([blob], fileName, { type: 'application/pdf' }) : null
      if (file && nav.share) {
        const shareData: ShareData = {
          files: [file],
          title: `Pedido ${pedido.folio}`,
          text: `Pedido ${pedido.folio} — Total ${formatCurrencyLabel(pedido.total)}`,
        }
        const canShareFiles = typeof nav.canShare === 'function' ? nav.canShare(shareData) : true
        if (canShareFiles) {
          try {
            await nav.share(shareData)
            via = 'web-share'
          } catch (error) {
            console.error('No se pudo compartir vía Web Share', error)
          }
        }
      }
      if (via === 'download') {
        downloadBlob(blob, fileName)
        alert('Descargamos el PDF porque tu navegador no permite compartirlo directamente.')
      }
      await logEvento('COMPARTIR_PDF_PEDIDO', { folio: pedido.folio, via })
    } catch (error) {
      console.error(error)
      alert('No se pudo compartir el PDF. Intenta nuevamente más tarde.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleWhatsapp() {
    if (itemsLoading || abonosLoading) {
      alert('Los datos del pedido se están cargando. Intenta nuevamente en unos segundos.')
      return
    }
    if (telefonoDigits.length !== 10) {
      alert('El número de teléfono del cliente debe tener 10 dígitos para enviar por WhatsApp.')
      return
    }
    setBusyAction('whatsapp')
    try {
      const { blob, fileName } = await buildPdfAssets()
      const message = buildWhatsappMessage()
      downloadBlob(blob, fileName)
      const waUrl = `https://wa.me/52${telefonoDigits}?text=${encodeURIComponent(message)}`
      window.open(waUrl, '_blank', 'noopener,noreferrer')

      await logEvento('WHATSAPP_RESUMEN_PEDIDO', {
        folio: pedido.folio,
        via: 'link',
        telefono: telefonoDigits,
      })
    } catch (error) {
      console.error(error)
      alert('No se pudo preparar el mensaje de WhatsApp. Intenta nuevamente más tarde.')
    } finally {
      setBusyAction(null)
    }
  }

  const isBusy = busyAction !== null

  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalle pedido {pedido.folio}</DialogTitle>
        <DialogDescription>
          Revisa la información general del pedido, sus conceptos y comparte el resumen con tus clientes.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-6">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium text-slate-600">Estado</p>
            <p>{pedido.status.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Fecha del pedido</p>
            <p>{fechaPedidoLabel}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Compromiso</p>
            <p>{compromisoLabel}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Cliente</p>
            <p>{cliente ? `${cliente.alias} · ${formatPhone(cliente.telefono)}` : 'Sin información del cliente'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Anticipo</p>
            <p>{formatCurrency(pedido.anticipo)}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Saldo</p>
            <p>{formatCurrency(saldoCalculado)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-600">Items del pedido</p>
            {itemsLoading ? (
              <span className="text-xs text-slate-500">Cargando...</span>
            ) : (
              <span className="text-xs text-slate-500">{itemsList.length} conceptos</span>
            )}
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {itemsLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando conceptos del pedido
              </div>
            ) : itemsList.length ? (
              itemsList.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-700 line-clamp-2">{item.descripcion_item}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Cantidad: {item.cantidad}</span>
                    <span>Precio unitario: {formatCurrency(item.precio_unitario)}</span>
                    <span>SubTotal: {formatCurrency(item.importe)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                No hay items registrados en este pedido.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1 rounded-2xl border border-slate-200 p-4">
            <p className="font-medium text-slate-600">Resumen</p>
            <div className="text-xs text-slate-500">
              <p>Subtotal: {formatCurrency(pedido.subtotal)}</p>
              <p>Descuento: {formatCurrency(pedido.descuento)}</p>
              <p>Impuestos: {formatCurrency(pedido.impuestos)}</p>
              <p className="font-semibold text-slate-700">Total: {formatCurrency(pedido.total)}</p>
              <p>Anticipo: {formatCurrency(pedido.anticipo)}</p>
              <p>Abonos: {formatCurrency(totalAbonos)}</p>
              <p>Saldo: {formatCurrency(saldoCalculado)}</p>
            </div>
          </div>
          <div className="space-y-1 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-600">Abonos</p>
              {!abonosLoading ? (
                <span className="text-xs font-semibold text-slate-700">{formatCurrency(totalAbonos)}</span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500">
              {abonosLoading ? (
                <p>Cargando abonos...</p>
              ) : abonosList.length ? (
                <ul className="space-y-2">
                  {abonosList.map((abono) => {
                    const fechaLabel = dayjs(abono.fecha.toDate()).format('DD/MM/YYYY')
                    const metodoLabel = formatMetodoPagoLabel(abono.metodo)
                    const referencia = (abono.ref ?? '').trim()
                    const notas = (abono.notas ?? '').trim()
                    return (
                      <li key={abono.id} className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-600">{fechaLabel}</p>
                          <p className="text-[11px] text-slate-500">
                            {metodoLabel}
                            {referencia ? ` · Ref: ${referencia}` : ''}
                          </p>
                          {notas ? <p className="text-[11px] text-slate-400">Notas: {notas}</p> : null}
                        </div>
                        <span className="whitespace-nowrap font-semibold text-slate-700">{formatCurrency(abono.monto)}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p>Sin abonos registrados.</p>
              )}
            </div>
          </div>
          <div className="space-y-1 rounded-2xl border border-slate-200 p-4">
            <p className="font-medium text-slate-600">Notas</p>
            <p className="text-xs text-slate-500">{pedido.notas?.trim() ? pedido.notas : 'Sin notas adicionales.'}</p>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="flex flex-col gap-3">
        <div className="grid w-full gap-2 sm:grid-cols-3">
          <Button
            type="button"
            onClick={handleGeneratePdf}
            className="h-12"
            disabled={isBusy}
          >
            {busyAction === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {busyAction === 'pdf' ? 'Generando...' : 'Generar PDF'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSharePdf}
            className="h-12"
            disabled={isBusy}
          >
            {busyAction === 'share' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            {busyAction === 'share' ? 'Compartiendo...' : 'Compartir'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleWhatsapp}
            className="h-12"
            disabled={isBusy}
          >
            {busyAction === 'whatsapp' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="mr-2 h-4 w-4" />
            )}
            {busyAction === 'whatsapp' ? 'Abriendo WhatsApp...' : 'WhatsApp'}
          </Button>
        </div>
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="h-12" onClick={onClose} disabled={isBusy}>
            Cerrar
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  )
}
