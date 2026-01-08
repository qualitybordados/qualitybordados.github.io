import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardData } from '@/features/dashboard/hooks'
import { formatCurrency, formatDate } from '@/lib/format'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, AlertTriangle, TrendingUp, Package } from 'lucide-react'
import dayjs from 'dayjs'
import { clsx } from 'clsx'
import type { ComponentType } from 'react'
import { Input } from '@/components/ui/input'
import { normalizeSearchTerm } from '@/lib/search'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const authReady = !!user && !loading
  const { data, isLoading, isFetching, isError } = useDashboardData({ enabled: authReady })
  const dashboardLoading = loading || isLoading || (authReady && isFetching && !data)
  const [clienteFiltro, setClienteFiltro] = useState('')
  const clienteFiltroNormalizado = useMemo(() => normalizeSearchTerm(clienteFiltro), [clienteFiltro])
  const proximasEntregasFiltradas = useMemo(() => {
    if (!data?.proximasEntregas) return []
    if (!clienteFiltroNormalizado) return data.proximasEntregas
    return data.proximasEntregas.filter((pedido) =>
      normalizeSearchTerm(pedido.cliente).includes(clienteFiltroNormalizado),
    )
  }, [clienteFiltroNormalizado, data?.proximasEntregas])

  if (dashboardLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse border-transparent bg-white/60 shadow-none">
              <CardContent className="space-y-3 p-5">
                <div className="h-4 w-24 rounded-full bg-slate-200" />
                <div className="h-8 w-32 rounded-full bg-slate-300" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="h-56 animate-pulse border-transparent bg-white/60 shadow-none" />
      </div>
    )
  }

  if ((isError && authReady) || !data) {
    return <Alert variant="destructive" title="No fue posible cargar el tablero" description="Reintenta en unos segundos." />
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <KpiCard
          icon={Package}
          title="Pedidos activos"
          highlight={data.pedidosActivos.toString()}
          helper="Pedidos en curso o listos para entrega."
        />
        <KpiCard
          icon={AlertTriangle}
          title="Cartera vencida"
          highlight={formatCurrency(data.carteraVencida)}
          helper="Saldo pendiente con fecha vencida."
          tone="error"
        />
        <KpiCard
          icon={TrendingUp}
          title="Flujo financiero 7 días"
          highlight={formatCurrency(data.flujoCaja.reduce((acc, item) => acc + item.monto, 0))}
          helper="Ingresos menos egresos de la semana."
          tone="success"
        />
        <KpiCard
          icon={CalendarDays}
          title="Entregas 3 días"
          highlight={data.entregasProximas.toString()}
          helper="Pedidos con fecha compromiso próxima."
          tone="warning"
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Visión general</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="w-full">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Pedidos por estado</CardTitle>
            </CardHeader>
            <CardContent className="h-72 pb-6">
              {data.pedidosPorEstado.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pedidosPorEstado}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="estado" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#2563EB" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Sin pedidos" description="Registra pedidos para visualizar su distribución." />
              )}
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Flujo financiero 7 días</CardTitle>
            </CardHeader>
            <CardContent className="h-72 pb-6">
              {data.flujoCaja.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.flujoCaja.map((item) => ({ ...item, fechaLabel: formatDate(item.fecha) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fechaLabel" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="monto" stroke="#0EA5E9" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="Sin movimientos" description="Registra ingresos o egresos en Finanzas." />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between sm:gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Próximas entregas</h2>
            <Badge variant="neutral">{proximasEntregasFiltradas.length} pendientes</Badge>
          </div>
          <div className="w-full sm:max-w-xs">
            <Input
              value={clienteFiltro}
              onChange={(event) => setClienteFiltro(event.target.value)}
              placeholder="Buscar por cliente"
            />
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            {proximasEntregasFiltradas.length ? (
              proximasEntregasFiltradas.map((pedido) => {
                const dias = Math.max(dayjs(pedido.fecha_compromiso).diff(dayjs(), 'day'), 0)
                return (
                  <div
                    key={pedido.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">{pedido.cliente}</span>
                      <span className="text-xs text-slate-500">Folio {pedido.folio}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <Badge variant={dias <= 1 ? 'warning' : 'success'}>
                        {formatDate(pedido.fecha_compromiso)}
                      </Badge>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">{dias} días</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyState
                title="Sin entregas programadas"
                description="No hay pedidos próximos a entregar en los próximos 3 días."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  title,
  highlight,
  helper,
  tone,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  highlight: string
  helper: string
  tone?: 'error' | 'success' | 'warning'
}) {
  const toneStyles =
    tone === 'error'
      ? 'bg-red-50 text-red-600'
      : tone === 'success'
        ? 'bg-emerald-50 text-emerald-600'
        : tone === 'warning'
          ? 'bg-amber-50 text-amber-600'
          : 'bg-slate-100 text-slate-600'

  return (
    <Card className="border-none bg-white/90 shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <span className={clsx('flex h-11 w-11 items-center justify-center rounded-full', toneStyles)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-500">{title}</span>
          <span className="text-2xl font-semibold text-slate-900">{highlight}</span>
          <span className="text-xs text-slate-500">{helper}</span>
        </div>
      </CardContent>
    </Card>
  )
}
