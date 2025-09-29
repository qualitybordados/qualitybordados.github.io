import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePedidosConSaldo, useRegistrarAbono } from '@/features/cobranza/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import dayjs from 'dayjs'
import { Loader2 } from 'lucide-react'
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pedidos con saldo pendiente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Compromiso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : pedidos && pedidos.length ? (
                pedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell>{pedido.folio}</TableCell>
                    <TableCell>{pedido.cliente_id.id}</TableCell>
                    <TableCell>{formatCurrency(pedido.saldo)}</TableCell>
                    <TableCell>{formatDate(pedido.fecha_compromiso.toDate())}</TableCell>
                    <TableCell>
                      <Badge variant={pedido.status === 'CERRADO' ? 'success' : 'warning'}>{pedido.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setPedidoSeleccionado(pedido)}
                        disabled={!puedeRegistrar}
                      >
                        Registrar abono
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10">
                    <EmptyState title="Sin cartera vencida" description="Todos los pedidos están al corriente." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!pedidoSeleccionado} onOpenChange={(open) => !open && setPedidoSeleccionado(null)}>
        <DialogContent className="max-w-lg">
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
            className="h-10 rounded-md border border-slate-200 bg-white px-3"
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
