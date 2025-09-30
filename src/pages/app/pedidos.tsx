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
} from '@/features/pedidos/hooks'
import { useClientes } from '@/features/clientes/hooks'
import { useConfiguracion } from '@/features/configuracion/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { Cliente, Pedido, PedidoEstado, Prioridad } from '@/lib/types'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { Loader2, Plus, Calendar, User, DollarSign, ChevronRight, ChevronLeft, Pencil, Trash } from 'lucide-react'
import dayjs from 'dayjs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PedidoForm, PedidoItemForm } from '@/lib/validators'
import { clsx } from 'clsx'

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
  const {
    data: pedidos,
    isLoading,
    isFetching,
  } = usePedidos({}, { enabled: authReady })
  const pedidosLoading = loading || isLoading || (authReady && isFetching && !pedidos)
  const createPedido = useCreatePedido()
  const actualizarEstado = useActualizarEstadoPedido()
  const updatePedido = useUpdatePedido()
  const eliminarPedido = useEliminarPedido()
  const { data: clientesData } = useClientes({}, { enabled: authReady })
  const { data: config } = useConfiguracion({ enabled: authReady })
  const clientesMap = useMemo(() => {
    if (!clientesData) return new Map<string, string>()
    return new Map(clientesData.map((cliente) => [cliente.id, cliente.alias]))
  }, [clientesData])

  const [wizardOpen, setWizardOpen] = useState(false)
  const [detallePedido, setDetallePedido] = useState<Pedido | null>(null)
  const [pedidoEdicion, setPedidoEdicion] = useState<Pedido | null>(null)
  const [wizardKey, setWizardKey] = useState(0)
  const {
    data: pedidoItemsEdicion,
    isLoading: pedidoItemsLoading,
  } = usePedidoItems(pedidoEdicion?.id, { enabled: wizardOpen && !!pedidoEdicion })

  const pedidoInicial = useMemo(() => {
    if (!pedidoEdicion || !pedidoItemsEdicion) return null
    return {
      folio: pedidoEdicion.folio,
      cliente_id: pedidoEdicion.cliente_id.id,
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
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            const clienteNombre = clientesMap.get(pedido.cliente_id.id) ?? pedido.cliente_id.id
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

      <Dialog open={!!detallePedido} onOpenChange={(open) => !open && setDetallePedido(null)}>
        <DialogContent>
          {detallePedido ? <DetallePedido pedido={detallePedido} onClose={() => setDetallePedido(null)} /> : null}
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
          return { ...item, descripcion_item: String(value) }
        }
        if (field === 'precio_unitario') {
          const precio = Number(value) || 0
          return {
            ...item,
            precio_unitario: precio,
            importe: Number((item.cantidad * precio).toFixed(2)),
          }
        }
        if (field === 'cantidad') {
          const cantidad = Math.max(1, Math.floor(Number(value) || 0))
          return {
            ...item,
            cantidad,
            importe: Number((cantidad * item.precio_unitario).toFixed(2)),
          }
        }
        if (field === 'importe') {
          const importeActual = Number(value) || 0
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
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="flex flex-col gap-1 text-sm">
                    Cantidad
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.cantidad}
                      onChange={(event) => updateItem(index, 'cantidad', Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm md:col-span-2">
                    Descripción
                    <Input
                      value={item.descripcion_item}
                      onChange={(event) => updateItem(index, 'descripcion_item', event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Precio unitario
                    <Input
                      type="number"
                      step="0.01"
                      value={item.precio_unitario}
                      onChange={(event) => updateItem(index, 'precio_unitario', Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm md:col-span-1">
                    Subtotal
                    <Input type="number" readOnly value={item.importe.toFixed(2)} />
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

function DetallePedido({ pedido, onClose }: { pedido: Pedido; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalle pedido {pedido.folio}</DialogTitle>
        <DialogDescription>Revisa la información general del pedido y su estado actual.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium text-slate-600">Estado</p>
            <p>{pedido.status}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Saldo</p>
            <p>{formatCurrency(pedido.saldo)}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Compromiso</p>
            <p>{formatDate(pedido.fecha_compromiso.toDate())}</p>
          </div>
          <div>
            <p className="font-medium text-slate-600">Anticipo</p>
            <p>{formatCurrency(pedido.anticipo)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="font-medium text-slate-600">Notas</p>
            <p>{pedido.notas || 'Sin notas'}</p>
          </div>
        </div>
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
