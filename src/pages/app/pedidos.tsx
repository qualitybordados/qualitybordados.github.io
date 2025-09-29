import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { usePedidos, useCreatePedido, useActualizarEstadoPedido } from '@/features/pedidos/hooks'
import { useClientes } from '@/features/clientes/hooks'
import { useConfiguracion } from '@/features/configuracion/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { Cliente, PedidoEstado, Prioridad } from '@/lib/types'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { Loader2, Plus, ArrowRight } from 'lucide-react'
import dayjs from 'dayjs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PedidoForm, PedidoItemForm } from '@/lib/validators'

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
  const { data: clientesData } = useClientes({}, { enabled: authReady })
  const { data: config } = useConfiguracion({ enabled: authReady })

  const [wizardOpen, setWizardOpen] = useState(false)
  const [detallePedido, setDetallePedido] = useState<any | null>(null)

  const puedeCrear = ['OWNER', 'ADMIN', 'VENTAS'].includes(role ?? '')
  const puedeActualizarEstado = ['OWNER', 'ADMIN', 'PRODUCCION'].includes(role ?? '')

  async function handleCambioEstado(pedidoId: string, estado: PedidoEstado) {
    if (!user) return
    await actualizarEstado.mutateAsync({ id: pedidoId, estado, usuarioId: user.uid })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Pedidos</CardTitle>
            {puedeCrear ? (
              <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setDetallePedido(null)}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo pedido
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  {clientesData && config ? (
                    <PedidoWizard
                      clientes={clientesData}
                      anticipoMinimo={config.porcentaje_anticipo}
                      onSubmit={async (values) => {
                        if (!user) return
                        await createPedido.mutateAsync({ data: values, usuarioId: user.uid })
                        setWizardOpen(false)
                      }}
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Compromiso</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-500" />
                  </TableCell>
                </TableRow>
              ) : pedidos && pedidos.length ? (
                pedidos.map((pedido) => {
                  const estadoIndex = estadosPedido.indexOf(pedido.status)
                  const siguienteEstado = estadosPedido[estadoIndex + 1]
                  return (
                    <TableRow key={pedido.id} onClick={() => setDetallePedido(pedido)} className="cursor-pointer">
                      <TableCell className="font-medium">{pedido.folio}</TableCell>
                      <TableCell>{pedido.cliente_id.id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{pedido.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(pedido.fecha_compromiso.toDate())}</TableCell>
                      <TableCell>{formatCurrency(pedido.saldo)}</TableCell>
                      <TableCell>
                        <Badge variant={pedido.prioridad === 'ALTA' ? 'destructive' : pedido.prioridad === 'MEDIA' ? 'warning' : 'success'}>
                          {pedido.prioridad}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {siguienteEstado && puedeActualizarEstado ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleCambioEstado(pedido.id, siguienteEstado)
                            }}
                            disabled={actualizarEstado.isPending}
                          >
                            Avanzar <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-10">
                    <EmptyState title="Sin pedidos" description="Registra un nuevo pedido para comenzar el flujo de trabajo." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detallePedido} onOpenChange={(open) => !open && setDetallePedido(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detallePedido ? <DetallePedido pedido={detallePedido} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PedidoWizard({
  clientes,
  anticipoMinimo,
  onSubmit,
}: {
  clientes: Cliente[]
  anticipoMinimo: number
  onSubmit: (values: PedidoForm) => Promise<void>
}) {
  if (!clientes.length) {
    return (
      <Alert
        variant="warning"
        title="No hay clientes activos"
        description="Registra un cliente para asociarlo al pedido."
      />
    )
  }

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

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Nuevo pedido</DialogTitle>
      </DialogHeader>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span className={step === 1 ? 'font-semibold text-primary' : ''}>Cliente</span>
        <ArrowRight className="h-3 w-3" />
        <span className={step === 2 ? 'font-semibold text-primary' : ''}>Items</span>
        <ArrowRight className="h-3 w-3" />
        <span className={step === 3 ? 'font-semibold text-primary' : ''}>Importes</span>
        <ArrowRight className="h-3 w-3" />
        <span className={step === 4 ? 'font-semibold text-primary' : ''}>Confirmar</span>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            Cliente
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3"
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
              className="h-10 rounded-md border border-slate-200 bg-white px-3"
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
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs">
                  Descripción libre
                  <Input
                    value={item.descripcion_item}
                    onChange={(event) => updateItem(index, 'descripcion_item', event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Prenda
                  <Input value={item.prenda} onChange={(event) => updateItem(index, 'prenda', event.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Talla
                  <Input value={item.talla} onChange={(event) => updateItem(index, 'talla', event.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Color
                  <Input value={item.color_prenda} onChange={(event) => updateItem(index, 'color_prenda', event.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Ubicación
                  <Input value={item.ubicacion} onChange={(event) => updateItem(index, 'ubicacion', event.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Puntadas estimadas
                  <Input
                    type="number"
                    value={item.puntadas_estimadas}
                    onChange={(event) => updateItem(index, 'puntadas_estimadas', Number(event.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Cantidad
                  <Input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(event) => updateItem(index, 'cantidad', Number(event.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
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
          <Button type="button" variant="outline" onClick={addItem}>
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

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
          Regresar
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((prev) => prev + 1)} disabled={step === 2 && items.length === 0}>
            Continuar
          </Button>
        ) : (
          <Button onClick={handleSubmit}>Crear pedido</Button>
        )}
      </div>
    </div>
  )
}

function DetallePedido({ pedido }: { pedido: any }) {
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Detalle pedido {pedido.folio}</DialogTitle>
      </DialogHeader>
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
    </div>
  )
}
