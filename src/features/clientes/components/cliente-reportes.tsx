import { useCallback, useId, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Cliente } from '@/lib/types'
import { useAuth } from '@/hooks/use-auth'
import { downloadBlob } from '@/lib/download'
import {
  buildClienteReporteWhatsAppMensaje,
  fetchClienteReporteDatos,
  generateClienteReportePdf,
  type ClienteReporteDatos,
  type ClienteReporteRango,
} from '@/features/clientes/reportes'
import { registrarBitacora } from '@/lib/firestore'
import { FileText, Share2, MessageCircle, Loader2 } from 'lucide-react'

function sanitizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function buildRango(desde: string, hasta: string): ClienteReporteRango {
  return {
    desde: dayjs(desde).startOf('day').toDate(),
    hasta: dayjs(hasta).endOf('day').toDate(),
  }
}

function toPdfBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  return new Blob([copy.buffer], { type: 'application/pdf' })
}

export function ClienteReportesPanel({ cliente }: { cliente: Cliente }) {
  const { user } = useAuth()
  const hoy = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const noventaDias = useMemo(() => dayjs().subtract(90, 'day').format('YYYY-MM-DD'), [])
  const [desde, setDesde] = useState(noventaDias)
  const [hasta, setHasta] = useState(hoy)
  const [generating, setGenerating] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [whatsAppLoading, setWhatsAppLoading] = useState(false)
  const [ultimoReporte, setUltimoReporte] = useState<ClienteReporteDatos | null>(null)

  const desdeId = useId()
  const hastaId = useId()

  const rangoValido = useMemo(() => {
    const inicio = dayjs(desde).startOf('day').valueOf()
    const fin = dayjs(hasta).endOf('day').valueOf()
    return inicio <= fin
  }, [desde, hasta])
  const telefonoLimpio = sanitizePhone(cliente.telefono ?? '')
  const telefonoValido = telefonoLimpio.length === 10

  const rango = useMemo(() => buildRango(desde, hasta), [desde, hasta])

  const registrarGeneracion = useCallback(
    async (datos: ClienteReporteDatos) => {
      if (!user) return
      await registrarBitacora({
        entidad: 'clientes',
        entidad_id: cliente.id,
        accion: 'GENERAR_PDF_CLIENTE',
        usuario: user.uid,
        datos: {
          cliente_id: cliente.id,
          rango: {
            desde: datos.rango.desde.toISOString(),
            hasta: datos.rango.hasta.toISOString(),
          },
          totals: {
            ventas: datos.totales.ventas,
            abonos: datos.totales.abonos,
            saldo: datos.totales.saldoActual,
          },
        },
      })
    },
    [cliente.id, user],
  )

  const registrarCompartir = useCallback(
    async (via: 'web-share' | 'download' | 'na') => {
      if (!user) return
      await registrarBitacora({
        entidad: 'clientes',
        entidad_id: cliente.id,
        accion: 'COMPARTIR_PDF_CLIENTE',
        usuario: user.uid,
        datos: {
          cliente_id: cliente.id,
          via,
        },
      })
    },
    [cliente.id, user],
  )

  const handleGenerate = useCallback(
    async () => {
      if (!user || !rangoValido) return
      setGenerating(true)
      try {
        const { pdfBytes, filename, datos } = await generateClienteReportePdf({
          cliente,
          rango,
          usuarioEmail: user.email ?? 'usuario@qualitybordados.mx',
        })
        setUltimoReporte(datos)
        const blob = toPdfBlob(pdfBytes)
        downloadBlob(blob, filename)
        await registrarGeneracion(datos)
        window.alert('PDF listo')
      } catch (error) {
        console.error('Error al generar PDF de cliente', error)
        window.alert('No se pudo generar el PDF. Intenta nuevamente.')
      } finally {
        setGenerating(false)
      }
    },
    [cliente, rango, registrarGeneracion, rangoValido, user],
  )

  const handleShare = useCallback(
    async () => {
      if (!user || !rangoValido) return
      setSharing(true)
      let via: 'web-share' | 'download' | 'na' = 'na'
      try {
        const { pdfBytes, filename, datos } = await generateClienteReportePdf({
          cliente,
          rango,
          usuarioEmail: user.email ?? 'usuario@qualitybordados.mx',
        })
        setUltimoReporte(datos)
        await registrarGeneracion(datos)
        const blob = toPdfBlob(pdfBytes)
        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
        const shareData: ShareData = {
          files: [new File([blob], filename, { type: 'application/pdf' })],
          title: `Reporte financiero ${cliente.alias}`,
          text: `Reporte del ${datos.rango.label}`,
        }
        if (typeof nav.share === 'function' && nav.canShare && nav.canShare(shareData)) {
          try {
            await nav.share(shareData)
            via = 'web-share'
            window.alert('PDF compartido correctamente.')
          } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') {
              via = 'na'
              window.alert('El envío se canceló.')
            } else {
              downloadBlob(blob, filename)
              via = 'download'
              window.alert('No se pudo compartir. Descargamos el PDF para ti.')
            }
          }
        } else {
          downloadBlob(blob, filename)
          via = 'download'
          window.alert('Descarga lista, compártelo por tu WhatsApp o email.')
        }
      } catch (error) {
        console.error('Error al compartir PDF de cliente', error)
        window.alert('No se pudo preparar el PDF para compartir. Intenta nuevamente.')
      } finally {
        await registrarCompartir(via)
        setSharing(false)
      }
    },
    [cliente, rango, rangoValido, registrarCompartir, user],
  )

  const handleWhatsApp = useCallback(
    async () => {
      if (!telefonoValido) return
      setWhatsAppLoading(true)
      try {
        const datos =
          ultimoReporte?.rango.desde.toISOString() === rango.desde.toISOString() &&
          ultimoReporte?.rango.hasta.toISOString() === rango.hasta.toISOString()
            ? ultimoReporte
            : await fetchClienteReporteDatos({ cliente, rango })
        setUltimoReporte(datos)
        const origen = typeof window !== 'undefined' ? window.location.origin : 'https://qualitybordados.mx'
        const mensaje = buildClienteReporteWhatsAppMensaje({ cliente, datos, origen })
        const telefono = `52${telefonoLimpio}`
        const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('Error al preparar mensaje de WhatsApp', error)
        window.alert('No se pudo preparar el resumen para WhatsApp. Intenta nuevamente.')
      } finally {
        setWhatsAppLoading(false)
      }
    },
    [cliente, rango, telefonoLimpio, telefonoValido, ultimoReporte],
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Reportes</p>
        <p className="text-xs text-slate-500">
          Genera un PDF financiero del cliente con pedidos, abonos y cartera en el rango seleccionado. Por defecto se muestran los
          últimos 90 días.
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <label htmlFor={desdeId} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Desde
            </label>
            <Input
              id={desdeId}
              type="date"
              value={desde}
              max={hasta}
              onChange={(event) => setDesde(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={hastaId} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hasta
            </label>
            <Input
              id={hastaId}
              type="date"
              value={hasta}
              max={hoy}
              min={desde}
              onChange={(event) => setHasta(event.target.value)}
            />
          </div>
        </div>
        {!rangoValido ? (
          <p className="text-xs font-semibold text-red-500">El rango seleccionado no es válido.</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          className="h-12 w-full"
          onClick={handleGenerate}
          disabled={!user || !rangoValido || generating}
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {generating ? 'Generando…' : 'Generar PDF'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full"
          onClick={handleShare}
          disabled={!user || !rangoValido || sharing}
        >
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          {sharing ? 'Compartiendo…' : 'Compartir'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full"
          onClick={handleWhatsApp}
          disabled={!telefonoValido || whatsAppLoading}
          title={telefonoValido ? undefined : 'Agrega teléfono'}
        >
          {whatsAppLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          WhatsApp
        </Button>
      </div>
    </div>
  )
}
