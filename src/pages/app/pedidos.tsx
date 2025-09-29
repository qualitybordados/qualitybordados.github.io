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
import { usePedidos, useCreatePedido, useActualizarEstadoPedido, useUpdatePedido, useEliminarPedido } from '@/features/pedidos/hooks'
import { useClientes } from '@/features/clientes/hooks'
import { useConfiguracion } from '@/features/configuracion/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { Cliente, Pedido, PedidoEstado, Prioridad } from '@/lib/types'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { Loader2, Plus, Calendar, User, DollarSign, ChevronRight, Pencil, Trash } from 'lucide-react'
import dayjs from 'dayjs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PedidoForm, PedidoItemForm } from '@/lib/validators'
import { clsx } from 'clsx'
import { PedidoQuickActionsDialog } from '@/features/pedidos/components/pedido-quick-actions-dialog'

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

  const [wizardOpen, setWizardOpen] = useState(false)
  const [detallePedido, setDetallePedido] = useState<Pedido | null>(null)
  const [pedidoEdicion, setPedidoEdicion] = useState<Pedido | null>(null)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)

  const puedeCrear = ['OWNER', 'ADMIN', 'VENTAS'].includes(role ?? '')
  const puedeActualizarEstado = ['OWNER', 'ADMIN', 'PRODUCCION'].includes(role ?? '')
  const puedeEditar = puedeCrear

  async function handleCambioEstado(pedidoId: string, estado: PedidoEstado) {
    if (!user) return
    await actualizarEstado.mutateAsync({ id: pedidoId, estado, usuarioId: user.uid })
  }

  function abrirEdicion(pedido: Pedido) {
    setPedidoEdicion(pedido)
    setQuickActionsOpen(true)
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
            <Button onClick={() => { setDetallePedido(null); setWizardOpen(true) }} className="hidden sm:inline-flex">
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
            return (
              <PedidoCard
                key={pedido.id}
                pedido={pedido}
                onClick={() => setDetallePedido(pedido)}
                onAvanzar={siguienteEstado ? () => handleCambioEstado(pedido.id, siguienteEstado) : undefined}
                puedeAvanzar={!!siguienteEstado && puedeActualizarEstado}
                avanzando={actualizarEstado.isPending}
                onEdit={() => abrirEdicion(pedido)}
                onDelete={() => handleEliminarPedido(pedido)}
                allowActions={puedeEditar}
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
          onClick={() => { setDetallePedido(null); setWizardOpen(true) }}
          aria-label="Nuevo pedido"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent>
          {clientesData && config ? (
            <PedidoWizard
              clientes={clientesData}
              anticipoMinimo={config.porcentaje_anticipo}
              onSubmit={async (values) => {
                if (!user) return
                await createPedido.mutateAsync({ data: values, usuarioId: user.uid })
                setWizardOpen(false)
              }}
              onClose={() => setWizardOpen(false)}
            />
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

      <PedidoQuickActionsDialog
        open={quickActionsOpen && !!pedidoEdicion}
        pedido={pedidoEdicion}
        onOpenChange={(open) => {
          setQuickActionsOpen(open)
          if (!open) {
            setPedidoEdicion(null)
          }
        }}
        onSubmit={async (values) => {
          if (!user || !pedidoEdicion) return
          await updatePedido.mutateAsync({ id: pedidoEdicion.id, data: values, usuarioId: user.uid })
          setQuickActionsOpen(false)
          setPedidoEdicion(null)
        }}
        onDelete={
          puedeEditar
            ? async () => {
                if (!pedidoEdicion) return
                await handleEliminarPedido(pedidoEdicion)
                setQuickActionsOpen(false)
                setPedidoEdicion(null)
              }
            : undefined
        }
        isSubmitting={updatePedido.isPending}
        isDeleting={eliminarPedido.isPending}
        allowDelete={puedeEditar}
      />
    </div>
  )
}

function PedidoCard({
  pedido,
  onClick,
  onAvanzar,
  puedeAvanzar,
  avanzando,
  onEdit,
  onDelete,
  allowActions,
}: {
  pedido: Pedido
  onClick: () => void
  onAvanzar?: () => void
  puedeAvanzar: boolean
  avanzando: boolean
  onEdit: () => void
  onDelete: () => void
  allowActions: boolean
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
          {pedido.cliente_id.id}
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
    </Card>
  )
}

function PedidoWizard({
  clientes,
  anticipoMinimo,
  onSubmit,
  onClose,
}: {
  clientes: Cliente[]
  anticipoMinimo: number
  onSubmit: (values: PedidoForm) => Promise<void>
  onClose: () => void
}) {
  const [step, setStep] = useState(1)
  const today = dayjs().startOf('day')
  const [items, setItems] = useState<PedidoItemForm[]>([])
  const [formState, setFormState] = useState<Omit<PedidoForm, 'items'>>({
    folio: `QB-${dayjs().format('YYYYMMDD-HHmm')}`,
    cliente_id: clientes[0]?.id ?? '',
    fecha_pedido: today.toDate(),
    fecha_compromiso: today.add(7, 'day').toDate(),
    status: 'COTIZACIÓN',
    prioridad: 'MEDIA',
    notas: '',
    anticipo: 0,
    subtotal: 0,
    descuento: 0,
    impuestos: 0,
    total: 0,
    saldo: 0,
  })

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0), [items])
  const total = useMemo(() => subtotal - formState.descuento + formState.impuestos, [subtotal, formState.descuento, formState.impuestos])
  const saldo = useMemo(() => Math.max(total - formState.anticipo, 0), [total, formState.anticipo])
  const anticipoSugerido = useMemo(() => Number(((total * anticipoMinimo) / 100).toFixed(2)), [total, anticipoMinimo])
  const hasClientes = clientes.length > 0

  function updateItem(index: number, field: keyof PedidoItemForm, value: string | number) {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: field === 'descripcion_item' || typeof value === 'string' ? value : Number(value) } : item)),
    )
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        descripcion_item: '',
        prenda: '',
        talla: '',
        color_prenda: '',
        ubicacion: '',
        puntadas_estimadas: 0,
        cantidad: 1,
        precio_unitario: 0,
        observaciones: '',
      },
    ])
  }

  async function handleSubmit() {
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
    const payload: PedidoForm = {
      ...formState,
      subtotal,
      total,
      saldo,
      items: items.map((item) => ({ ...item, importe: item.cantidad * item.precio_unitario })),
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
          <DialogTitle>Nuevo pedido</DialogTitle>
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
        <DialogTitle>Nuevo pedido</DialogTitle>
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
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    Descripción libre
                    <Input
                      value={item.descripcion_item}
                      onChange={(event) => updateItem(index, 'descripcion_item', event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Prenda
                    <Input value={item.prenda} onChange={(event) => updateItem(index, 'prenda', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Talla
                    <Input value={item.talla} onChange={(event) => updateItem(index, 'talla', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Color
                    <Input value={item.color_prenda} onChange={(event) => updateItem(index, 'color_prenda', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Ubicación
                    <Input value={item.ubicacion} onChange={(event) => updateItem(index, 'ubicacion', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Puntadas estimadas
                    <Input
                      type="number"
                      value={item.puntadas_estimadas}
                      onChange={(event) => updateItem(index, 'puntadas_estimadas', Number(event.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Cantidad
                    <Input
                      type="number"
                      min={1}
                      value={item.cantidad}
                      onChange={(event) => updateItem(index, 'cantidad', Number(event.target.value))}
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
                </div>
                <p className="mt-2 text-xs text-slate-500">Importe: {formatCurrency(item.cantidad * item.precio_unitario)}</p>
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
                Descuento
                <Input
                  type="number"
                  step="0.01"
                  value={formState.descuento}
                  onChange={(event) => setFormState((prev) => ({ ...prev, descuento: Number(event.target.value) }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Impuestos
                <Input
                  type="number"
                  step="0.01"
                  value={formState.impuestos}
                  onChange={(event) => setFormState((prev) => ({ ...prev, impuestos: Number(event.target.value) }))}
                />
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
              description={`Folio: ${formState.folio} — Cliente ${formState.cliente_id}`}
            />
            <div>
              <p className="font-medium text-slate-600">Items</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-600">
                {items.map((item, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span>
                      {item.descripcion_item} · {item.cantidad} x {formatCurrency(item.precio_unitario)}
                    </span>
                    <span>{formatCurrency(item.cantidad * item.precio_unitario)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-xs text-slate-500">
              <p>Subtotal: {formatCurrency(subtotal)}</p>
              <p>Descuento: {formatCurrency(formState.descuento)}</p>
              <p>Impuestos: {formatCurrency(formState.impuestos)}</p>
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
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1}
          >
            Regresar
          </Button>
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={isLastStep ? handleSubmit : () => setStep((prev) => prev + 1)}
          disabled={!isLastStep && step === 2 && items.length === 0}
        >
          {isLastStep ? 'Crear pedido' : 'Continuar'}
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
