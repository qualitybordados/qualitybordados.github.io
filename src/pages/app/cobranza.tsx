import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePedidosConSaldo, useRegistrarAbono } from '@/features/cobranza/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import dayjs from 'dayjs'
import { Calendar, User, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { AbonoForm as AbonoFormValues } from '@/lib/validators'

const metodosPago = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] as const

export default function CobranzaPage() {
  const { user, role, loading } = useAuth()
  const authReady = !!user && !loading
  const { data: pedidos, isLoading, isFetching } = usePedidosConSaldo({ enabled: authReady })
  const pedidosLoading = loading || isLoading || (authReady && isFetching && !pedidos)
  const registrarAbono = useRegistrarAbono()
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any | null>(null)

  const puedeRegistrar = ['OWNER', 'ADMIN', 'COBRANZA'].includes(role ?? '')

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
            />
          ))
        ) : (
          <EmptyState title="Sin cartera vencida" description="Todos los pedidos están al corriente." />
        )}
      </section>

      <Dialog open={!!pedidoSeleccionado} onOpenChange={(open) => !open && setPedidoSeleccionado(null)}>
        <DialogContent className="max-w-lg rounded-3xl">
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
    </div>
  )
}

function CobranzaCard({
  pedido,
  onRegistrar,
  disabled,
}: {
  pedido: any
  onRegistrar: () => void
  disabled: boolean
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
            {pedido.cliente_id.id}
          </div>
        </div>
        <Badge variant={pedido.status === 'CERRADO' ? 'success' : 'warning'} className="uppercase">
          {pedido.status.replace(/_/g, ' ')}
        </Badge>
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
  pedido: any
  onSubmit: (values: AbonoFormValues) => Promise<void>
  onClose: () => void
  isSubmitting: boolean
}) {
  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'))
  const [monto, setMonto] = useState(pedido.saldo)
  const [metodo, setMetodo] = useState<(typeof metodosPago)[number]>('EFECTIVO')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Registrar abono — {pedido.folio}</DialogTitle>
        <DialogDescription>Ingresa el pago recibido y actualiza el saldo pendiente del pedido.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-slate-600">Saldo actual</p>
          <p>{formatCurrency(pedido.saldo)}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <Input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Monto
          <Input type="number" step="0.01" value={monto} onChange={(event) => setMonto(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Método de pago
          <select
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={metodo}
            onChange={(event) => setMetodo(event.target.value as (typeof metodosPago)[number])}
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
          <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} />
        </label>
        <Textarea placeholder="Notas" value={notas} onChange={(event) => setNotas(event.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() =>
            onSubmit({
              pedido_id: pedido.id,
              cliente_id: pedido.cliente_id.id,
              fecha: dayjs(fecha).toDate(),
              monto,
              metodo,
              ref: referencia,
              notas,
            })
          }
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Registrar'}
        </Button>
      </div>
    </div>
  )
}
