import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useMovimientosCaja,
  useCrearMovimientoCaja,
  useActualizarMovimientoCaja,
  useEliminarMovimientoCaja,
} from '@/features/caja/hooks'
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
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  FileDown,
  Pencil,
  Trash,
  User,
  Package,
  FileText,
  Tag,
  RotateCcw,
  Plus,
  Loader2,
  LineChart,
  PieChart,
  Users,
  Wallet,
} from 'lucide-react'
import dayjs from 'dayjs'
import { EmptyState } from '@/components/common/empty-state'
import { MovimientoCajaForm } from '@/lib/validators'
import { clsx } from 'clsx'
import { Badge } from '@/components/ui/badge'
import { usePedidosConSaldo } from '@/features/cobranza/hooks'
import { registrarBitacora } from '@/lib/firestore'
import { generateFinanzasPdf, type FinanzasPdfPayload } from '@/features/finanzas/pdf'

const categoriaOptions = [
  'TODAS',
  'INSUMOS',
  'NÓMINA',
  'SERVICIOS',
  'MANTENIMIENTO',
  'OTROS',
  'ANTICIPO',
  'ABONO',
  'COBRANZA',
  'VENTA',
]

const defaultDesde = dayjs().startOf('month').format('YYYY-MM-DD')
const defaultHasta = dayjs().format('YYYY-MM-DD')

type FiltrosFinanzas = {
  tipo: 'TODOS' | 'INGRESO' | 'EGRESO'
  categoria: string
  desde: string
  hasta: string
}

type SerieTemporalDato = {
  label: string
  ingresos: number
  egresos: number
  neto: number
}

type SerieTemporal = {
  agrupacion: 'diaria' | 'semanal'
  datos: SerieTemporalDato[]
}

type CarteraSnapshot = {
  total: number
  buckets: Array<{ label: string; monto: number; pedidos: number }>
}

const defaultFiltros: FiltrosFinanzas = {
  tipo: 'TODOS',
  categoria: 'TODAS',
  desde: defaultDesde,
  hasta: defaultHasta,
}

export default function FinanzasPage() {
  const { user, role, loading } = useAuth()
  const authReady = !!user && !loading

  const [filtrosForm, setFiltrosForm] = useState<FiltrosFinanzas>(() => ({ ...defaultFiltros }))
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosFinanzas>(() => ({ ...defaultFiltros }))

  const {
    data: movimientos,
    isLoading,
    isFetching,
  } = useMovimientosCaja(
    {
      tipo: filtrosAplicados.tipo,
      categoria: filtrosAplicados.categoria,
      desde: dayjs(filtrosAplicados.desde).startOf('day').toDate(),
      hasta: dayjs(filtrosAplicados.hasta).endOf('day').toDate(),
    },
    { enabled: authReady },
  )

  const { data: pedidosConSaldo } = usePedidosConSaldo({ enabled: authReady })

  const loadingMovimientos = loading || isLoading || (authReady && isFetching && !movimientos)

  const crearMovimiento = useCrearMovimientoCaja()
  const actualizarMovimiento = useActualizarMovimientoCaja()
  const eliminarMovimiento = useEliminarMovimientoCaja()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'crear' | 'editar'>('crear')
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<MovimientoCajaConDetalles | null>(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  const movimientosOrdenados = useMemo(
    () => (movimientos ?? []).slice().sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis()),
    [movimientos],
  )

  const movimientosFiltrados = useMemo(() => {
    if (filtrosAplicados.categoria === 'TODAS') {
      return movimientosOrdenados
    }
    const categoriaFiltro = filtrosAplicados.categoria.trim().toLowerCase()
    return movimientosOrdenados.filter(
      (movimiento) => (movimiento.categoria ?? '').trim().toLowerCase() === categoriaFiltro,
    )
  }, [movimientosOrdenados, filtrosAplicados.categoria])

  const totales = useMemo(() => {
    if (!movimientosFiltrados.length) {
      return { ingresos: 0, egresos: 0, neto: 0 }
    }

    const ingresos = movimientosFiltrados
      .filter((mov) => mov.tipo === 'INGRESO')
      .reduce((sum, mov) => sum + mov.monto, 0)
    const egresos = movimientosFiltrados
      .filter((mov) => mov.tipo === 'EGRESO')
      .reduce((sum, mov) => sum + mov.monto, 0)

    return {
      ingresos,
      egresos,
      neto: ingresos - egresos,
    }
  }, [movimientosFiltrados])

  const resumenCategorias = useMemo(() => {
    const acumulado = new Map<string, { ingresos: number; egresos: number }>()

    movimientosFiltrados.forEach((movimiento) => {
      const categoria = (movimiento.categoria ?? 'Sin categoría').trim() || 'Sin categoría'
      if (!acumulado.has(categoria)) {
        acumulado.set(categoria, { ingresos: 0, egresos: 0 })
      }
      const registro = acumulado.get(categoria)!
      if (movimiento.tipo === 'INGRESO') {
        registro.ingresos += movimiento.monto
      } else {
        registro.egresos += movimiento.monto
      }
    })

    const categoriasOrdenadas = Array.from(acumulado.entries())
      .map(([categoria, valores]) => ({
        categoria,
        ingresos: valores.ingresos,
        egresos: valores.egresos,
        neto: valores.ingresos - valores.egresos,
        totalAbsoluto: valores.ingresos + valores.egresos,
      }))
      .sort((a, b) => b.totalAbsoluto - a.totalAbsoluto)

    if (categoriasOrdenadas.length <= 5) {
      return categoriasOrdenadas
    }

    const principales = categoriasOrdenadas.slice(0, 5)
    const restantes = categoriasOrdenadas.slice(5)
    const otros = restantes.reduce(
      (acc, item) => {
        acc.ingresos += item.ingresos
        acc.egresos += item.egresos
        return acc
      },
      { ingresos: 0, egresos: 0 },
    )

    return [
      ...principales,
      {
        categoria: 'Otros',
        ingresos: otros.ingresos,
        egresos: otros.egresos,
        neto: otros.ingresos - otros.egresos,
        totalAbsoluto: otros.ingresos + otros.egresos,
      },
    ]
  }, [movimientosFiltrados])

  const serieTemporal = useMemo<SerieTemporal>(() => {
    const desde = dayjs(filtrosAplicados.desde).startOf('day')
    const hasta = dayjs(filtrosAplicados.hasta).endOf('day')
    const diffDias = Math.max(hasta.diff(desde, 'day'), 0)

    if (!movimientosFiltrados.length) {
      return { agrupacion: diffDias > 31 ? 'semanal' : 'diaria', datos: [] }
    }

    if (diffDias > 31) {
      const totalSemanas = Math.ceil((diffDias + 1) / 7)
      const datos: SerieTemporalDato[] = []

      for (let indice = 0; indice < totalSemanas; indice += 1) {
        const semanaInicio = desde.add(indice * 7, 'day').startOf('day')
        const semanaFin = semanaInicio.add(6, 'day').endOf('day')
        const limiteSuperior = semanaFin.isAfter(hasta) ? hasta : semanaFin

        const ingresos = movimientosFiltrados.reduce((suma, movimiento) => {
          const fechaMovimiento = movimiento.fecha.toDate()
          return fechaMovimiento >= semanaInicio.toDate() && fechaMovimiento <= limiteSuperior.toDate()
            ? suma + (movimiento.tipo === 'INGRESO' ? movimiento.monto : 0)
            : suma
        }, 0)

        const egresos = movimientosFiltrados.reduce((suma, movimiento) => {
          const fechaMovimiento = movimiento.fecha.toDate()
          return fechaMovimiento >= semanaInicio.toDate() && fechaMovimiento <= limiteSuperior.toDate()
            ? suma + (movimiento.tipo === 'EGRESO' ? movimiento.monto : 0)
            : suma
        }, 0)

        datos.push({
          label: `${semanaInicio.format('DD/MM')} - ${limiteSuperior.format('DD/MM')}`,
          ingresos,
          egresos,
          neto: ingresos - egresos,
        })
      }

      return { agrupacion: 'semanal', datos }
    }

    const datos: SerieTemporalDato[] = []
    for (let indice = 0; indice <= diffDias; indice += 1) {
      const dia = desde.add(indice, 'day')
      const ingresos = movimientosFiltrados.reduce((suma, movimiento) => {
        return dayjs(movimiento.fecha.toDate()).isSame(dia, 'day') && movimiento.tipo === 'INGRESO'
          ? suma + movimiento.monto
          : suma
      }, 0)
      const egresos = movimientosFiltrados.reduce((suma, movimiento) => {
        return dayjs(movimiento.fecha.toDate()).isSame(dia, 'day') && movimiento.tipo === 'EGRESO'
          ? suma + movimiento.monto
          : suma
      }, 0)

      datos.push({
        label: dia.format('DD/MM'),
        ingresos,
        egresos,
        neto: ingresos - egresos,
      })
    }

    return { agrupacion: 'diaria', datos }
  }, [movimientosFiltrados, filtrosAplicados.desde, filtrosAplicados.hasta])

  const topClientes = useMemo(() => {
    const acumulado = new Map<string, { nombre: string; monto: number }>()
    let totalIngresos = 0

    movimientosFiltrados.forEach((movimiento) => {
      const categoria = (movimiento.categoria ?? '').trim().toUpperCase()
      if (movimiento.tipo !== 'INGRESO') return
      if (!movimiento.referenciaPedidoId) return
      if (!['VENTA', 'ABONO', 'COBRANZA'].includes(categoria)) return
      const clienteNombre =
        movimiento.cliente?.alias ?? movimiento.cliente?.nombre_legal ?? 'Cliente sin nombre'
      const clienteId = movimiento.cliente?.id ?? clienteNombre
      if (!acumulado.has(clienteId)) {
        acumulado.set(clienteId, { nombre: clienteNombre, monto: 0 })
      }
      const registro = acumulado.get(clienteId)!
      registro.monto += movimiento.monto
      totalIngresos += movimiento.monto
    })

    const lista = Array.from(acumulado.values()).sort((a, b) => b.monto - a.monto)

    return lista.map((item) => ({
      nombre: item.nombre,
      monto: item.monto,
      porcentaje: totalIngresos ? (item.monto / totalIngresos) * 100 : 0,
    }))
  }, [movimientosFiltrados])

  const cartera = useMemo<CarteraSnapshot>(() => {
    const buckets = [
      { label: '0-30 días', monto: 0, pedidos: 0 },
      { label: '31-60 días', monto: 0, pedidos: 0 },
      { label: '61-90 días', monto: 0, pedidos: 0 },
      { label: '90+ días', monto: 0, pedidos: 0 },
    ]

    if (!pedidosConSaldo?.length) {
      return { total: 0, buckets }
    }

    const fechaCorte = dayjs(filtrosAplicados.hasta).endOf('day')

    pedidosConSaldo.forEach((pedido) => {
      const saldo = pedido.saldo ?? 0
      if (!saldo) return
      const dias = Math.max(
        0,
        fechaCorte.diff(dayjs(pedido.fecha_compromiso.toDate()).startOf('day'), 'day'),
      )

      if (dias <= 30) {
        buckets[0].monto += saldo
        buckets[0].pedidos += 1
      } else if (dias <= 60) {
        buckets[1].monto += saldo
        buckets[1].pedidos += 1
      } else if (dias <= 90) {
        buckets[2].monto += saldo
        buckets[2].pedidos += 1
      } else {
        buckets[3].monto += saldo
        buckets[3].pedidos += 1
      }
    })

    const total = buckets.reduce((sum, bucket) => sum + bucket.monto, 0)
    return { total, buckets }
  }, [pedidosConSaldo, filtrosAplicados.hasta])

  const reportePayload = useMemo<FinanzasPdfPayload>(() => {
    const rangoLabel = `${dayjs(filtrosAplicados.desde).format('DD/MM/YYYY')} – ${dayjs(filtrosAplicados.hasta).format('DD/MM/YYYY')}`

    return {
      rangoLabel,
      generadoEl: new Date(),
      usuario: user?.email ?? 'Usuario',
      filtros: {
        tipo: filtrosAplicados.tipo,
        categoria: filtrosAplicados.categoria,
      },
      totales: {
        ingresos: totales.ingresos,
        egresos: totales.egresos,
        neto: totales.neto,
      },
      resumenCategorias: resumenCategorias.map((item) => ({
        categoria: item.categoria,
        ingresos: item.ingresos,
        egresos: item.egresos,
        neto: item.neto,
      })),
      serieTemporal,
      topClientes: topClientes.slice(0, 5).map((cliente) => ({
        cliente: cliente.nombre,
        monto: cliente.monto,
        porcentaje: cliente.porcentaje,
      })),
      cartera: {
        total: cartera.total,
        buckets: cartera.buckets.map((bucket) => ({
          label: bucket.label,
          monto: bucket.monto,
          pedidos: bucket.pedidos,
        })),
      },
      movimientos: movimientosFiltrados.map((movimiento) => ({
        fecha: dayjs(movimiento.fecha.toDate()).format('DD/MM/YYYY'),
        tipo: movimiento.tipo,
        categoria: movimiento.categoria ?? 'Sin categoría',
        monto: movimiento.monto,
        referencia:
          movimiento.pedido?.folio ??
          movimiento.referenciaPedidoId ??
          movimiento.referencia_pedido_id?.id ??
          null,
        notas: movimiento.notas ?? '',
      })),
    }
  }, [
    filtrosAplicados.categoria,
    filtrosAplicados.desde,
    filtrosAplicados.hasta,
    filtrosAplicados.tipo,
    movimientosFiltrados,
    resumenCategorias,
    serieTemporal,
    topClientes,
    totales.egresos,
    totales.ingresos,
    totales.neto,
    user?.email,
    cartera,
  ])

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

  function handleAplicarFiltros() {
    if (dayjs(filtrosForm.desde).isAfter(dayjs(filtrosForm.hasta))) {
      alert('La fecha inicial no puede ser mayor que la final.')
      return
    }
    setFiltrosAplicados({ ...filtrosForm })
  }

  function handleLimpiarFiltros() {
    setFiltrosForm({ ...defaultFiltros })
    setFiltrosAplicados({ ...defaultFiltros })
  }

  async function handleGenerarPdf() {
    if (!user) return
    setGenerandoPdf(true)
    const timestamp = new Date()

    try {
      const { blob, fileName } = await generateFinanzasPdf({
        ...reportePayload,
        generadoEl: timestamp,
      })

      try {
        await registrarBitacora({
          entidad: 'reportes',
          entidad_id: 'finanzas',
          accion: 'GENERAR_PDF_FINANZAS',
          usuario: user.uid,
          datos: {
            rango: {
              desde: filtrosAplicados.desde,
              hasta: filtrosAplicados.hasta,
            },
            filtros: {
              tipo: filtrosAplicados.tipo,
              categoria: filtrosAplicados.categoria,
            },
            generado_en: timestamp.toISOString(),
          },
        })
      } catch (error) {
        console.error('No se pudo registrar la bitácora de generación de PDF', error)
      }

      let via: 'web-share' | 'download' | 'na' = 'na'
      let compartido = false
      let archivoCompartible: File | null = null

      if (typeof File !== 'undefined') {
        archivoCompartible = new File([blob], fileName, { type: 'application/pdf' })
      }

      const soportaShare = typeof navigator !== 'undefined' && 'share' in navigator
      const puedeCompartirArchivos =
        soportaShare &&
        archivoCompartible &&
        typeof navigator.canShare === 'function'
          ? navigator.canShare({ files: [archivoCompartible] })
          : soportaShare && !!archivoCompartible

      if (soportaShare && puedeCompartirArchivos && archivoCompartible) {
        try {
          await navigator.share({
            title: 'Reporte financiero',
            text: `Reporte financiero ${reportePayload.rangoLabel}`,
            files: [archivoCompartible],
          })
          compartido = true
          via = 'web-share'
        } catch (error) {
          via = 'na'
        }
      }

      if (!compartido) {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        URL.revokeObjectURL(url)
        via = 'download'
      }

      try {
        await registrarBitacora({
          entidad: 'reportes',
          entidad_id: 'finanzas',
          accion: 'COMPARTIR_PDF_FINANZAS',
          usuario: user.uid,
          datos: {
            via,
            generado_en: timestamp.toISOString(),
          },
        })
      } catch (error) {
        console.error('No se pudo registrar la bitácora de compartir PDF', error)
      }
    } catch (error) {
      console.error('No se pudo generar el PDF de finanzas', error)
      alert('No se pudo generar el PDF. Intenta de nuevo en unos segundos.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  return (
    <div className="relative space-y-6 pb-24">
      <Card className="border-none bg-white/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Finanzas</CardTitle>
          <p className="text-xs text-slate-500">
            Controla ingresos, egresos y métricas clave con filtros diseñados para dispositivos móviles.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Rango: desde
              <Input
                type="date"
                value={filtrosForm.desde}
                onChange={(event) =>
                  setFiltrosForm((prev) => ({ ...prev, desde: event.target.value || prev.desde }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Rango: hasta
              <Input
                type="date"
                value={filtrosForm.hasta}
                onChange={(event) =>
                  setFiltrosForm((prev) => ({ ...prev, hasta: event.target.value || prev.hasta }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Categoría
              <select
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={filtrosForm.categoria}
                onChange={(event) =>
                  setFiltrosForm((prev) => ({ ...prev, categoria: event.target.value || 'TODAS' }))
                }
              >
                {categoriaOptions.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria === 'TODAS' ? 'Todas las categorías' : categoria}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Tipo de movimiento
              <select
                className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={filtrosForm.tipo}
                onChange={(event) =>
                  setFiltrosForm((prev) => ({ ...prev, tipo: event.target.value as FiltrosFinanzas['tipo'] }))
                }
              >
                <option value="TODOS">Todos</option>
                <option value="INGRESO">Ingresos</option>
                <option value="EGRESO">Egresos</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={handleAplicarFiltros} className="w-full sm:w-auto" disabled={generandoPdf}>
              <Check className="h-4 w-4" />
              Aplicar filtros
            </Button>
            <Button
              variant="outline"
              onClick={handleLimpiarFiltros}
              className="w-full sm:w-auto"
              disabled={generandoPdf}
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar
            </Button>
            <Button
              variant="secondary"
              onClick={handleGenerarPdf}
              className="w-full sm:w-auto"
              disabled={generandoPdf}
            >
              {generandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {generandoPdf ? 'Generando…' : 'Generar PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-gradient-to-r from-emerald-50 via-white to-sky-50 shadow-sm">
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <ResumenItem titulo="Ingresos" valor={formatCurrency(totales.ingresos)} icon={ArrowUpCircle} tono="success" />
          <ResumenItem titulo="Egresos" valor={formatCurrency(totales.egresos)} icon={ArrowDownCircle} tono="warning" />
          <ResumenItem titulo="Flujo neto" valor={formatCurrency(totales.neto)} icon={Wallet} tono="neutral" />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-none bg-white/90 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <PieChart className="h-4 w-4" />
              Resumen por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resumenCategorias.length ? (
              <ul className="space-y-2">
                {resumenCategorias.map((item) => (
                  <li
                    key={item.categoria}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{item.categoria}</span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        {formatCurrency(item.ingresos)} ingresos • {formatCurrency(item.egresos)} egresos
                      </span>
                    </div>
                    <span className="text-base font-semibold text-slate-900">{formatCurrency(item.neto)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin datos" description="No hay movimientos en las categorías seleccionadas." />
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <LineChart className="h-4 w-4" />
              Flujo en el tiempo
            </CardTitle>
            <p className="text-[11px] uppercase text-slate-400">
              Serie {serieTemporal.agrupacion === 'diaria' ? 'diaria' : 'semanal'} dentro del rango seleccionado.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {serieTemporal.datos.length ? (
              <ul className="space-y-2">
                {serieTemporal.datos.map((dato) => (
                  <li
                    key={dato.label}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{dato.label}</span>
                      <span className="text-[11px] uppercase text-slate-400">
                        {formatCurrency(dato.ingresos)} ingresos • {formatCurrency(dato.egresos)} egresos
                      </span>
                    </div>
                    <span className="text-base font-semibold text-slate-900">{formatCurrency(dato.neto)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin datos" description="Ajusta los filtros de fecha para ver el flujo." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-none bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <Users className="h-4 w-4" />
              Top clientes del período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topClientes.length ? (
              <ul className="space-y-2">
                {topClientes.slice(0, 5).map((cliente) => (
                  <li
                    key={cliente.nombre}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{cliente.nombre}</span>
                      <span className="text-[11px] uppercase text-slate-400">
                        {cliente.porcentaje.toFixed(1)}% del período
                      </span>
                    </div>
                    <span className="text-base font-semibold text-slate-900">{formatCurrency(cliente.monto)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin ingresos asociados" description="Los movimientos filtrados no tienen clientes vinculados." />
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white/90 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <Wallet className="h-4 w-4" />
              Cartera al cierre del período
            </CardTitle>
            <p className="text-[11px] uppercase text-slate-400">
              Datos calculados con pedidos con saldo al {dayjs(filtrosAplicados.hasta).format('DD/MM/YYYY')}.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
              <span className="text-xs uppercase text-slate-200">Saldo total</span>
              <p className="text-lg font-semibold">{formatCurrency(cartera.total)}</p>
            </div>
            <ul className="space-y-2">
              {cartera.buckets.map((bucket) => (
                <li
                  key={bucket.label}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">{bucket.label}</span>
                    <span className="text-[11px] uppercase text-slate-400">{bucket.pedidos} pedidos</span>
                  </div>
                  <span className="text-base font-semibold text-slate-900">{formatCurrency(bucket.monto)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

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
        ) : (
          <EmptyState title="Sin movimientos" description="No hay registros para los filtros seleccionados." />
        )}
      </section>

      {puedeCrear ? (
        <Button
          size="fab"
          className="fixed bottom-24 right-6 z-40 sm:hidden"
          onClick={abrirNuevoMovimiento}
          aria-label="Registrar movimiento"
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
                    if (!movimientoSeleccionado || !user) return
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

type ResumenItemProps = {
  titulo: string
  valor: string
  icon: typeof ArrowUpCircle
  tono: 'success' | 'warning' | 'neutral'
}

function ResumenItem({ titulo, valor, icon: Icon, tono }: ResumenItemProps) {
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

type MovimientoCardProps = {
  movimiento: MovimientoCajaConDetalles
  onEdit: () => void
  onDelete: () => void
  allowActions: boolean
}

function MovimientoCard({ movimiento, onEdit, onDelete, allowActions }: MovimientoCardProps) {
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

type MovimientoFormProps = {
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
}

function MovimientoForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting,
  isDeleting = false,
}: MovimientoFormProps) {
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
  const submitLabel =
    mode === 'crear'
      ? isSubmitting
        ? 'Guardando...'
        : 'Registrar'
      : isSubmitting
        ? 'Actualizando...'
        : 'Actualizar'

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
