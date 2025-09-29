import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardData } from '@/features/dashboard/hooks'
import { formatCurrency, formatDate } from '@/lib/format'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts'
import { useAuth } from '@/hooks/use-auth'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const authReady = !!user && !loading
  const { data, isLoading, isFetching, isError } = useDashboardData({ enabled: authReady })
  const dashboardLoading = loading || isLoading || (authReady && isFetching && !data)

  if (dashboardLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-slate-200" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 rounded bg-slate-200" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if ((isError && authReady) || !data) {
    return <Alert variant="destructive" title="No fue posible cargar el tablero" description="Reintenta en unos segundos." />
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-primary">{data.pedidosActivos}</p>
            <p className="text-xs text-slate-500">Pedidos en producción o pendientes de cierre.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cartera vencida</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-red-600">{formatCurrency(data.carteraVencida)}</p>
            <p className="text-xs text-slate-500">Saldo de pedidos con fecha compromiso vencida.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Flujo caja últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-emerald-600">
              {formatCurrency(data.flujoCaja.reduce((acc, item) => acc + item.monto, 0))}
            </p>
            <p className="text-xs text-slate-500">Ingresos - egresos de la última semana.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Entregas próximos 3 días</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-amber-600">{data.entregasProximas}</p>
            <p className="text-xs text-slate-500">Pedidos con fecha compromiso cercana.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Pedidos por estado</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {data.pedidosPorEstado.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pedidosPorEstado}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="estado" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563EB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="Sin pedidos" description="Crea pedidos para visualizar su distribución por estado." />
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Flujo de caja 7 días</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {data.flujoCaja.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.flujoCaja.map((item) => ({ ...item, fechaLabel: formatDate(item.fecha) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fechaLabel" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="monto" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Sin movimientos registrados"
                description="Registra ingresos o egresos en Caja para visualizar el flujo."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
