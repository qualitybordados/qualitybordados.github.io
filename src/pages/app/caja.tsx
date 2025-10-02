import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMovimientosCaja, useCrearMovimientoCaja, useActualizarMovimientoCaja, useEliminarMovimientoCaja } from '@/features/caja/hooks'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/format'
import type { MovimientoCajaConDetalles } from '@/features/caja/api'
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
import {
  Download,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash,
  Search,
  X,
  User,
  Package,
  FileText,
  Tag,
} from 'lucide-react'
import dayjs from 'dayjs'
import { EmptyState } from '@/components/common/empty-state'
import { MovimientoCajaForm } from '@/lib/validators'
import { clsx } from 'clsx'
import { Badge } from '@/components/ui/badge'

export default function CajaPage() {
  const { user, role, loading } = useAuth()
  const [tipoFiltro, setTipoFiltro] = useState<'INGRESO' | 'EGRESO' | 'TODOS'>('TODOS')
  const [fechaInicio, setFechaInicio] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [fechaFin, setFechaFin] = useState(dayjs().format('YYYY-MM-DD'))
  const [busquedaTerminos, setBusquedaTerminos] = useState<string[]>([])
  const [busquedaActual, setBusquedaActual] = useState('')

  const authReady = !!user && !loading

  const {
    data: movimientos,
    isLoading,
    isFetching,
  } = useMovimientosCaja(
    {
      tipo: tipoFiltro,
      desde: dayjs(fechaInicio).toDate(),
      hasta: dayjs(fechaFin).toDate(),
    },
    { enabled: authReady },
  )

  const loadingMovimientos = loading || isLoading || (authReady && isFetching && !movimientos)

  const crearMovimiento = useCrearMovimientoCaja()
  const actualizarMovimiento = useActualizarMovimientoCaja()
  const eliminarMovimiento = useEliminarMovimientoCaja()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'crear' | 'editar'>('crear')
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<MovimientoCajaConDetalles | null>(null)

  const movimientosConBusqueda = useMemo(() => movimientos ?? [], [movimientos])

  const movimientosFiltrados = useMemo(() => {
    if (!busquedaTerminos.length) {
      return movimientosConBusqueda
    }

    const terminosNormalizados = busquedaTerminos.map((termino) => termino.trim().toLowerCase()).filter(Boolean)
    if (!terminosNormalizados.length) {
      return movimientosConBusqueda
    }

    return movimientosConBusqueda.filter((movimiento) => {
      const posiblesValores = [
        movimiento.pedido?.folio ?? '',
        movimiento.referenciaPedidoId ?? '',
        movimiento.cliente?.alias ?? '',
        movimiento.cliente?.nombre_legal ?? '',
        movimiento.notas ?? '',
        movimiento.categoria ?? '',
      ].map((valor) => valor.toLowerCase())

      return terminosNormalizados.every((termino) =>
        posiblesValores.some((valor) => valor.includes(termino)),
      )
    })
  }, [busquedaTerminos, movimientosConBusqueda])

  const totales = useMemo(() => {
    const lista = busquedaTerminos.length ? movimientosFiltrados : movimientosConBusqueda
    if (!lista.length) return { ingreso: 0, egreso: 0, neto: 0 }
    const ingreso = lista.filter((m) => m.tipo === 'INGRESO').reduce((sum, mov) => sum + mov.monto, 0)
    const egreso = lista.filter((m) => m.tipo === 'EGRESO').reduce((sum, mov) => sum + mov.monto, 0)
    return { ingreso, egreso, neto: ingreso - egreso }
  }, [busquedaTerminos.length, movimientosFiltrados, movimientosConBusqueda])

  function agregarTerminosDesdeCadena(cadena: string) {
    const nuevosTerminos = cadena
      .split(/[,\n]/)
      .map((termino) => termino.trim())
      .filter((termino) => termino.length > 0)

    if (!nuevosTerminos.length) return

    setBusquedaTerminos((prev) => {
      const existente = new Set(prev.map((termino) => termino.toLowerCase()))
      const actualizados = [...prev]
      nuevosTerminos.forEach((termino) => {
        if (!existente.has(termino.toLowerCase())) {
          actualizados.push(termino)
        }
      })
      return actualizados
    })
  }

  function agregarBusquedaActual() {
    if (!busquedaActual.trim()) return
    agregarTerminosDesdeCadena(busquedaActual)
    setBusquedaActual('')
  }

  function eliminarBusqueda(termino: string) {
    setBusquedaTerminos((prev) => prev.filter((item) => item.toLowerCase() !== termino.toLowerCase()))
  }

  function exportarCSV() {
    if (!movimientosConBusqueda.length) return
    const encabezados = 'Fecha,Tipo,Categoría,Monto,Folio Pedido,Cliente,Notas\n'
    const filas = movimientosConBusqueda
      .map((mov) => {
        const fecha = formatDate(mov.fecha.toDate())
        const tipo = mov.tipo
        const categoria = mov.categoria
        const monto = mov.monto.toFixed(2)
        const folio = mov.pedido?.folio ?? mov.referenciaPedidoId ?? ''
        const cliente = mov.cliente?.alias ?? ''
        const notas = mov.notas?.replace(/,/g, ';') ?? ''
        return `${fecha},${tipo},${categoria},${monto},${folio},${cliente},${notas}`
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

  function abrirNuevoMovimiento() {
    setDialogMode('crear')
    setMovimientoSeleccionado(null)
    setDialogOpen(true)
  }

  function abrirEdicionMovimiento(movimiento: MovimientoCajaConDetalles) {
    setDialogMode('editar')
    setMovimientoSeleccionado(movimiento)
    setDialogOpen(true)
  }

  async function handleEliminarMovimiento(movimiento: MovimientoCajaConDetalles) {
    if (!user) return
    if (confirm(`¿Eliminar el ${movimiento.tipo.toLowerCase()} por ${formatCurrency(movimiento.monto)}?`)) {
      await eliminarMovimiento.mutateAsync({
        id: movimiento.id,
        usuarioId: user.uid,
        pedidoId: movimiento.referencia_pedido_id?.id,
      })
    }
  }

  return (
    <div className="relative space-y-6 pb-20">
      <Card className="border-none bg-white/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Movimientos de caja</CardTitle>
          <p className="text-xs text-slate-500">Filtra y registra ingresos o egresos con controles optimizados para móvil.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Tipo
              <select
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={tipoFiltro}
                onChange={(event) => setTipoFiltro(event.target.value as typeof tipoFiltro)}
              >
                <option value="TODOS">Todos</option>
                <option value="INGRESO">Ingresos</option>
                <option value="EGRESO">Egresos</option>
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs uppercase text-slate-500 sm:col-span-2">
              Buscar
              <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus-within:ring-2 focus-within:ring-accent">
                <Search className="h-4 w-4 text-slate-400" />
                {busquedaTerminos.map((termino) => (
                  <span
                    key={termino}
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {termino}
                    <button
                      type="button"
                      className="text-slate-400 transition-colors hover:text-slate-600"
                      onClick={() => eliminarBusqueda(termino)}
                      aria-label={`Quitar filtro ${termino}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  value={busquedaActual}
                  onChange={(event) => setBusquedaActual(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault()
                      agregarBusquedaActual()
                    } else if (event.key === 'Backspace' && !busquedaActual && busquedaTerminos.length) {
                      event.preventDefault()
                      eliminarBusqueda(busquedaTerminos[busquedaTerminos.length - 1])
                    }
                  }}
                  onBlur={() => agregarBusquedaActual()}
                  onPaste={(event) => {
                    event.preventDefault()
                    const text = event.clipboardData.getData('text')
                    agregarTerminosDesdeCadena(text)
                    setBusquedaActual('')
                  }}
                  placeholder="Cliente o folio"
                />
              </div>
              <span className="text-[10px] normal-case text-slate-400">
                Escribe un cliente o folio y presiona Enter para agregar múltiples filtros.
              </span>
            </div>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Desde
              <Input type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Hasta
              <Input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} />
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={exportarCSV} disabled={!movimientosConBusqueda.length} className="w-full sm:w-auto">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            {puedeCrear ? (
              <Button onClick={abrirNuevoMovimiento} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Nuevo movimiento
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-gradient-to-r from-emerald-50 via-white to-sky-50 shadow-sm">
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <ResumenItem titulo="Ingresos" valor={formatCurrency(totales.ingreso)} icon={ArrowUpCircle} tono="success" />
          <ResumenItem titulo="Egresos" valor={formatCurrency(totales.egreso)} icon={ArrowDownCircle} tono="warning" />
          <ResumenItem titulo="Balance neto" valor={formatCurrency(totales.neto)} icon={ArrowUpCircle} tono="neutral" />
        </CardContent>
      </Card>

      <section className="space-y-3">
        {loadingMovimientos ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-none bg-white/60 p-4 shadow-sm">
              <div className="flex animate-pulse flex-col gap-3">
                <div className="h-4 w-24 rounded-full bg-slate-200" />
                <div className="h-4 w-40 rounded-full bg-slate-200" />
              </div>
            </Card>
          ))
        ) : movimientosFiltrados.length ? (
          movimientosFiltrados.map((movimiento) => (
            <MovimientoCard
              key={movimiento.id}
              movimiento={movimiento}
              onEdit={() => abrirEdicionMovimiento(movimiento)}
              onDelete={() => handleEliminarMovimiento(movimiento)}
              allowActions={puedeCrear}
            />
          ))
        ) : busquedaTerminos.length ? (
          <EmptyState
            title="Sin resultados"
            description="No encontramos movimientos que coincidan con tu búsqueda. Ajusta los filtros para intentarlo nuevamente."
          />
        ) : (
          <EmptyState title="Sin movimientos" description="Registra un ingreso o egreso para comenzar." />
        )}
      </section>

      {puedeCrear ? (
        <Button
          size="fab"
          className="fixed bottom-24 right-6 z-40 sm:hidden"
          onClick={abrirNuevoMovimiento}
          aria-label="Nuevo movimiento"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setMovimientoSeleccionado(null)
            setDialogMode('crear')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'crear' ? 'Registrar movimiento' : 'Editar movimiento'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'crear'
                ? 'Captura un ingreso o egreso y guarda la referencia en la bitácora.'
                : 'Actualiza los datos del movimiento y mantiene la bitácora al día.'}
            </DialogDescription>
          </DialogHeader>
          <MovimientoForm
            mode={dialogMode}
            defaultValues=
              {movimientoSeleccionado
                ? {
                    fecha: movimientoSeleccionado.fecha.toDate(),
                    tipo: movimientoSeleccionado.tipo,
                    categoria: movimientoSeleccionado.categoria,
                    monto: movimientoSeleccionado.monto,
                    referencia: movimientoSeleccionado.referencia_pedido_id?.id ?? '',
                    notas: movimientoSeleccionado.notas ?? '',
                  }
                : undefined}
            onSubmit={async (values) => {
              if (!user) return
              if (dialogMode === 'crear') {
                await crearMovimiento.mutateAsync({ data: values, usuarioId: user.uid })
              } else if (movimientoSeleccionado) {
                await actualizarMovimiento.mutateAsync({ id: movimientoSeleccionado.id, data: values, usuarioId: user.uid })
              }
              setDialogOpen(false)
              setMovimientoSeleccionado(null)
              setDialogMode('crear')
            }}
            onCancel={() => {
              setDialogOpen(false)
              setMovimientoSeleccionado(null)
              setDialogMode('crear')
            }}
            onDelete={
              dialogMode === 'editar'
                ? async () => {
                    if (!movimientoSeleccionado) return
                    await handleEliminarMovimiento(movimientoSeleccionado)
                    setDialogOpen(false)
                    setMovimientoSeleccionado(null)
                    setDialogMode('crear')
                  }
                : undefined
            }
            isSubmitting={dialogMode === 'crear' ? crearMovimiento.isPending : actualizarMovimiento.isPending}
            isDeleting={eliminarMovimiento.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResumenItem({
  titulo,
  valor,
  icon: Icon,
  tono,
}: {
  titulo: string
  valor: string
  icon: typeof ArrowUpCircle
  tono: 'success' | 'warning' | 'neutral'
}) {
  const toneClasses =
    tono === 'success'
      ? 'bg-emerald-100 text-emerald-600'
      : tono === 'warning'
        ? 'bg-red-100 text-red-600'
        : 'bg-slate-100 text-slate-600'

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 shadow-sm">
      <span className={clsx('flex h-10 w-10 items-center justify-center rounded-full', toneClasses)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-500">{titulo}</span>
        <span className="text-lg font-semibold text-slate-900">{valor}</span>
      </div>
    </div>
  )
}

function MovimientoCard({
  movimiento,
  onEdit,
  onDelete,
  allowActions,
}: {
  movimiento: MovimientoCajaConDetalles
  onEdit: () => void
  onDelete: () => void
  allowActions: boolean
}) {
  const esIngreso = movimiento.tipo === 'INGRESO'
  const tipoBadge = esIngreso ? 'success' : 'warning'
  const categoriaLabel = movimiento.categoria || 'Sin categoría'
  const folioPedido = movimiento.pedido?.folio ?? movimiento.referenciaPedidoId ?? null
  const estadoPedido = movimiento.pedido?.status
  const clienteNombre = movimiento.cliente?.alias ?? movimiento.cliente?.nombre_legal ?? null
  const notasMovimiento = movimiento.notas?.trim() ?? ''

  return (
    <Card className="border-none bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tipoBadge} className="uppercase">
                {movimiento.tipo}
              </Badge>
              <Badge variant="outline" className="bg-slate-100 text-slate-600">
                {categoriaLabel}
              </Badge>
              {folioPedido ? (
                <Badge variant="outline" className="bg-sky-100 text-sky-700">
                  Pedido {folioPedido}
                </Badge>
              ) : null}
            </div>
            <span className="text-2xl font-semibold text-slate-900">{formatCurrency(movimiento.monto)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{formatDate(movimiento.fecha.toDate())}</span>
            {allowActions ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 border border-slate-200"
                  onClick={onEdit}
                  aria-label="Editar movimiento"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 border border-slate-200 text-destructive"
                  onClick={onDelete}
                  aria-label="Eliminar movimiento"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2 text-slate-500">
            <Tag className="h-4 w-4 text-slate-400" />
            <span>{categoriaLabel}</span>
          </div>
          {folioPedido ? (
            <div className="flex flex-wrap items-center gap-2 text-slate-500">
              <Package className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-700">Pedido {folioPedido}</span>
              {estadoPedido ? (
                <Badge variant="outline" className="bg-slate-100 text-xs uppercase text-slate-500">
                  {estadoPedido}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {clienteNombre ? (
            <div className="flex items-center gap-2 text-slate-500">
              <User className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-700">{clienteNombre}</span>
            </div>
          ) : null}
          <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
            <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
            <span>{notasMovimiento || 'Sin notas adicionales.'}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

function MovimientoForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting,
  isDeleting = false,
}: {
  mode: 'crear' | 'editar'
  defaultValues?: {
    fecha: Date
    tipo: 'INGRESO' | 'EGRESO'
    categoria: string
    monto: number
    referencia?: string
    notas?: string
  }
  onSubmit: (values: MovimientoCajaForm) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  isSubmitting: boolean
  isDeleting?: boolean
}) {
  const [fecha, setFecha] = useState(() => dayjs(defaultValues?.fecha ?? dayjs().toDate()).format('YYYY-MM-DD'))
  const [tipo, setTipo] = useState<'INGRESO' | 'EGRESO'>(defaultValues?.tipo ?? 'INGRESO')
  const [categoria, setCategoria] = useState(defaultValues?.categoria ?? '')
  const [monto, setMonto] = useState(defaultValues?.monto ?? 0)
  const [referencia, setReferencia] = useState(defaultValues?.referencia ?? '')
  const [notas, setNotas] = useState(defaultValues?.notas ?? '')

  useEffect(() => {
    if (defaultValues) {
      setFecha(dayjs(defaultValues.fecha).format('YYYY-MM-DD'))
      setTipo(defaultValues.tipo)
      setCategoria(defaultValues.categoria)
      setMonto(defaultValues.monto)
      setReferencia(defaultValues.referencia ?? '')
      setNotas(defaultValues.notas ?? '')
    } else if (mode === 'crear') {
      setFecha(dayjs().format('YYYY-MM-DD'))
      setTipo('INGRESO')
      setCategoria('')
      setMonto(0)
      setReferencia('')
      setNotas('')
    }
  }, [defaultValues, mode])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit({
      fecha: dayjs(fecha).toDate(),
      tipo,
      categoria,
      monto,
      referencia_pedido_id: referencia ? referencia : undefined,
      notas,
    })
  }

  const isBusy = isSubmitting || isDeleting
  const submitLabel = mode === 'crear' ? (isSubmitting ? 'Guardando...' : 'Registrar') : isSubmitting ? 'Actualizando...' : 'Actualizar'

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <DialogBody className="space-y-4">
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <Input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} disabled={isBusy} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select
            className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={tipo}
            onChange={(event) => setTipo(event.target.value as 'INGRESO' | 'EGRESO')}
            disabled={isBusy}
          >
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Categoría
          <Input value={categoria} onChange={(event) => setCategoria(event.target.value)} disabled={isBusy} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Monto
          <Input
            type="number"
            step="0.01"
            value={monto}
            onChange={(event) => setMonto(Number(event.target.value))}
            disabled={isBusy}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Referencia pedido (opcional)
          <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} disabled={isBusy} />
        </label>
        <Textarea placeholder="Notas" value={notas} onChange={(event) => setNotas(event.target.value)} disabled={isBusy} />
      </DialogBody>
      <DialogFooter className="gap-3 sm:justify-between">
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onCancel} disabled={isBusy}>
            Cancelar
          </Button>
        </DialogClose>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {mode === 'editar' && onDelete ? (
            <Button type="button" variant="destructive" className="w-full sm:w-auto" onClick={onDelete} disabled={isBusy}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          ) : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={isBusy}>
            {submitLabel}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
