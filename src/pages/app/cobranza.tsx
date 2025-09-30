import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePedidosConSaldo, useRegistrarAbono } from '@/features/cobranza/hooks'
import { useClientes } from '@/features/clientes/hooks'
import { useEliminarPedido, useUpdatePedido } from '@/features/pedidos/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { getDocumentId } from '@/lib/firestore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import dayjs from 'dayjs'
import { Calendar, User, AlertTriangle, Pencil, Trash } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { AbonoForm as AbonoFormValues } from '@/lib/validators'
import { Pedido } from '@/lib/types'
import { PedidoQuickActionsDialog } from '@/features/pedidos/components/pedido-quick-actions-dialog'

const metodosPago = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] as const

export default function CobranzaPage() {
  const { user, role, loading } = useAuth()
  const authReady = !!user && !loading
  const { data: pedidos, isLoading, isFetching } = usePedidosConSaldo({ enabled: authReady })
  const pedidosLoading = loading || isLoading || (authReady && isFetching && !pedidos)
  const registrarAbono = useRegistrarAbono()
  const { data: clientes } = useClientes({}, { enabled: authReady })
  const clientesMap = useMemo(() => {
    if (!clientes) return new Map<string, string>()
    return new Map(clientes.map((cliente) => [cliente.id, cliente.alias]))
  }, [clientes])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null)
  const updatePedido = useUpdatePedido()
  const eliminarPedido = useEliminarPedido()
  const [pedidoEdicion, setPedidoEdicion] = useState<Pedido | null>(null)
  const [accionesOpen, setAccionesOpen] = useState(false)

  const puedeRegistrar = ['OWNER', 'ADMIN', 'COBRANZA'].includes(role ?? '')

  function abrirEdicionPedido(pedido: Pedido) {
    setPedidoEdicion(pedido)
    setAccionesOpen(true)
  }

  async function handleEliminarPedido(pedido: Pedido) {
    if (!user) return
    if (confirm(`¿Eliminar el pedido ${pedido.folio}?`)) {
      await eliminarPedido.mutateAsync({ id: pedido.id, usuarioId: user.uid })
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(null)
      }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <Card className="border-none bg-white/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Créditos y cobranza</CardTitle>
          <p className="text-xs text-slate-500">Monitorea los pedidos con saldo pendiente y registra abonos al instante.</p>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-xs text-slate-500">
          <span>{pedidos?.length ? `${pedidos.length} pedidos con saldo` : 'Sin cartera vencida'}</span>
          <Badge variant="warning" className="uppercase">Revisa diariamente</Badge>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {pedidosLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-none bg-white/60 p-4 shadow-sm">
              <div className="flex animate-pulse flex-col gap-3">
                <div className="h-4 w-28 rounded-full bg-slate-200" />
                <div className="h-4 w-40 rounded-full bg-slate-200" />
              </div>
            </Card>
          ))
        ) : pedidos && pedidos.length ? (
          pedidos.map((pedido) => (
            <CobranzaCard
              key={pedido.id}
              pedido={pedido}
              onRegistrar={() => setPedidoSeleccionado(pedido)}
              disabled={!puedeRegistrar}
              onEdit={() => abrirEdicionPedido(pedido)}
              onDelete={() => handleEliminarPedido(pedido)}
              allowActions={puedeRegistrar}
              clienteNombre={
                clientesMap.get(getDocumentId(pedido.cliente_id)) ?? getDocumentId(pedido.cliente_id)
              }
            />
          ))
        ) : (
          <EmptyState title="Sin cartera vencida" description="Todos los pedidos están al corriente." />
        )}
      </section>

      <Dialog open={!!pedidoSeleccionado} onOpenChange={(open) => !open && setPedidoSeleccionado(null)}>
        <DialogContent>
          {pedidoSeleccionado ? (
            <AbonoDialogForm
              pedido={pedidoSeleccionado}
              onClose={() => setPedidoSeleccionado(null)}
              onSubmit={async (values) => {
                if (!user) return
                await registrarAbono.mutateAsync({ data: values, usuarioId: user.uid })
                setPedidoSeleccionado(null)
              }}
              isSubmitting={registrarAbono.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <PedidoQuickActionsDialog
        open={accionesOpen && !!pedidoEdicion}
        pedido={pedidoEdicion}
        onOpenChange={(open) => {
          setAccionesOpen(open)
          if (!open) {
            setPedidoEdicion(null)
          }
        }}
        onSubmit={async (values) => {
          if (!user || !pedidoEdicion) return
          await updatePedido.mutateAsync({ id: pedidoEdicion.id, data: values, usuarioId: user.uid })
          setAccionesOpen(false)
          setPedidoEdicion(null)
        }}
        onDelete={
          puedeRegistrar
            ? async () => {
                if (!pedidoEdicion) return
                await handleEliminarPedido(pedidoEdicion)
                setAccionesOpen(false)
                setPedidoEdicion(null)
              }
            : undefined
        }
        isSubmitting={updatePedido.isPending}
        isDeleting={eliminarPedido.isPending}
        allowDelete={puedeRegistrar}
      />
    </div>
  )
}

function CobranzaCard({
  pedido,
  onRegistrar,
  disabled,
  onEdit,
  onDelete,
  allowActions,
  clienteNombre,
}: {
  pedido: Pedido
  onRegistrar: () => void
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
  allowActions: boolean
  clienteNombre: string
}) {
  const fecha = pedido.fecha_compromiso.toDate()
  const diasVencidos = dayjs().diff(fecha, 'day')
  const venceHoy = dayjs().diff(fecha, 'day') === 0

  return (
    <Card className="border-none bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Folio {pedido.folio}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <User className="h-4 w-4 text-slate-400" />
            {clienteNombre}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={pedido.status === 'CERRADO' ? 'success' : 'warning'} className="uppercase">
            {pedido.status.replace(/_/g, ' ')}
          </Badge>
          {allowActions ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 border border-slate-200"
                onClick={onEdit}
                aria-label="Editar pedido"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 border border-slate-200 text-destructive"
                onClick={onDelete}
                aria-label="Eliminar pedido"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="h-4 w-4 text-slate-400" />
            {formatDate(fecha)}
          </div>
          <Badge variant={diasVencidos > 0 ? 'destructive' : venceHoy ? 'warning' : 'success'}>
            {diasVencidos > 0 ? `${diasVencidos} días vencido` : venceHoy ? 'Vence hoy' : 'Al día'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {formatCurrency(pedido.saldo)} pendientes
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onRegistrar} disabled={disabled} className="w-full sm:w-auto">
          Registrar abono
        </Button>
      </div>
    </Card>
  )
}

function AbonoDialogForm({
  pedido,
  onSubmit,
  onClose,
  isSubmitting,
}: {
  pedido: Pedido
  onSubmit: (values: AbonoFormValues) => Promise<void>
  onClose: () => void
  isSubmitting: boolean
}) {
  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'))
  const [monto, setMonto] = useState(pedido.saldo)
  const [metodo, setMetodo] = useState<(typeof metodosPago)[number]>('EFECTIVO')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit({
      pedido_id: pedido.id,
      cliente_id: getDocumentId(pedido.cliente_id),
      fecha: dayjs(fecha).toDate(),
      monto,
      metodo,
      ref: referencia,
      notas,
    })
  }

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Registrar abono — {pedido.folio}</DialogTitle>
        <DialogDescription>Ingresa el pago recibido y actualiza el saldo pendiente del pedido.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-slate-600">Saldo actual</p>
          <p>{formatCurrency(pedido.saldo)}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <Input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} disabled={isSubmitting} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Monto
          <Input
            type="number"
            step="0.01"
            value={monto}
            onChange={(event) => setMonto(Number(event.target.value))}
            disabled={isSubmitting}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Método de pago
          <select
            className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={metodo}
            onChange={(event) => setMetodo(event.target.value as (typeof metodosPago)[number])}
            disabled={isSubmitting}
          >
            {metodosPago.map((metodoPago) => (
              <option key={metodoPago} value={metodoPago}>
                {metodoPago}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Referencia
          <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} disabled={isSubmitting} />
        </label>
        <Textarea
          placeholder="Notas"
          value={notas}
          onChange={(event) => setNotas(event.target.value)}
          disabled={isSubmitting}
        />
      </DialogBody>
      <DialogFooter className="gap-3 sm:justify-end">
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Registrar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
