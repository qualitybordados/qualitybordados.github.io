import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useMovimientosCaja, useCrearMovimientoCaja } from '@/features/caja/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Download, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { EmptyState } from '@/components/common/empty-state'
import { MovimientoCajaForm } from '@/lib/validators'

export default function CajaPage() {
  const { user, role } = useAuth()
  const [tipoFiltro, setTipoFiltro] = useState<'INGRESO' | 'EGRESO' | 'TODOS'>('TODOS')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [fechaInicio, setFechaInicio] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [fechaFin, setFechaFin] = useState(dayjs().format('YYYY-MM-DD'))

  const { data: movimientos, isLoading } = useMovimientosCaja({
    tipo: tipoFiltro,
    categoria: categoriaFiltro || undefined,
    desde: dayjs(fechaInicio).toDate(),
    hasta: dayjs(fechaFin).toDate(),
  })

  const crearMovimiento = useCrearMovimientoCaja()
  const [dialogOpen, setDialogOpen] = useState(false)

  const totales = useMemo(() => {
    if (!movimientos) return { ingreso: 0, egreso: 0, neto: 0 }
    const ingreso = movimientos.filter((m) => m.tipo === 'INGRESO').reduce((sum, mov) => sum + mov.monto, 0)
    const egreso = movimientos.filter((m) => m.tipo === 'EGRESO').reduce((sum, mov) => sum + mov.monto, 0)
    return { ingreso, egreso, neto: ingreso - egreso }
  }, [movimientos])

  function exportarCSV() {
    if (!movimientos || !movimientos.length) return
    const encabezados = 'Fecha,Tipo,Categoría,Monto,Referencia,Notas\n'
    const filas = movimientos
      .map((mov) => {
        const fecha = formatDate(mov.fecha.toDate())
        const tipo = mov.tipo
        const categoria = mov.categoria
        const monto = mov.monto.toFixed(2)
        const referencia = mov.referencia_pedido_id ? mov.referencia_pedido_id.id : ''
        const notas = mov.notas?.replace(/,/g, ';') ?? ''
        return `${fecha},${tipo},${categoria},${monto},${referencia},${notas}`
      })
      .join('\n')
    const blob = new Blob([encabezados + filas], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `movimientos-caja-${dayjs().format('YYYYMMDD-HHmm')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const puedeCrear = ['OWNER', 'ADMIN', 'COBRANZA'].includes(role ?? '')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Movimientos de caja</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Tipo
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3"
                value={tipoFiltro}
                onChange={(event) => setTipoFiltro(event.target.value as typeof tipoFiltro)}
              >
                <option value="TODOS">Todos</option>
                <option value="INGRESO">Ingresos</option>
                <option value="EGRESO">Egresos</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Categoría
              <Input value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Desde
              <Input type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Hasta
              <Input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportarCSV} disabled={!movimientos?.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
            {puedeCrear ? (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar movimiento</DialogTitle>
                  </DialogHeader>
                  <MovimientoForm
                    onSubmit={async (values) => {
                      if (!user) return
                      await crearMovimiento.mutateAsync({ data: values, usuarioId: user.uid })
                      setDialogOpen(false)
                    }}
                    onCancel={() => setDialogOpen(false)}
                    isSubmitting={crearMovimiento.isPending}
                  />
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(totales.ingreso)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Egresos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">{formatCurrency(totales.egreso)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Neto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-800">{formatCurrency(totales.neto)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Referencia pedido</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : movimientos && movimientos.length ? (
                movimientos.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell>{formatDate(movimiento.fecha.toDate())}</TableCell>
                    <TableCell>{movimiento.tipo}</TableCell>
                    <TableCell>{movimiento.categoria}</TableCell>
                    <TableCell>{formatCurrency(movimiento.monto)}</TableCell>
                    <TableCell>{movimiento.referencia_pedido_id?.id ?? '-'}</TableCell>
                    <TableCell>{movimiento.notas || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10">
                    <EmptyState title="Sin movimientos" description="Registra un ingreso o egreso para comenzar." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function MovimientoForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (values: MovimientoCajaForm) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}) {
  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'))
  const [tipo, setTipo] = useState<'INGRESO' | 'EGRESO'>('INGRESO')
  const [categoria, setCategoria] = useState('')
  const [monto, setMonto] = useState(0)
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1 text-sm">
        Fecha
        <Input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tipo
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3"
          value={tipo}
          onChange={(event) => setTipo(event.target.value as 'INGRESO' | 'EGRESO')}
        >
          <option value="INGRESO">Ingreso</option>
          <option value="EGRESO">Egreso</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Categoría
        <Input value={categoria} onChange={(event) => setCategoria(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Monto
        <Input type="number" step="0.01" value={monto} onChange={(event) => setMonto(Number(event.target.value))} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Referencia pedido (opcional)
        <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} />
      </label>
      <Textarea placeholder="Notas" value={notas} onChange={(event) => setNotas(event.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={() =>
            onSubmit({
              fecha: dayjs(fecha).toDate(),
              tipo,
              categoria,
              monto,
              referencia_pedido_id: referencia ? referencia : undefined,
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
