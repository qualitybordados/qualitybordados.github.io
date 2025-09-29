import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Pedido, PedidoEstado, Prioridad } from '@/lib/types'
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

const ESTADOS_PEDIDO: PedidoEstado[] = [
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

const PRIORIDADES: Prioridad[] = ['BAJA', 'MEDIA', 'ALTA']

type PedidoQuickActionsDialogProps = {
  open: boolean
  pedido: Pedido | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: {
    status: PedidoEstado
    prioridad: Prioridad
    fecha_compromiso: Date
    notas: string
  }) => Promise<void>
  onDelete?: () => Promise<void>
  isSubmitting?: boolean
  isDeleting?: boolean
  allowDelete?: boolean
}

export function PedidoQuickActionsDialog({
  open,
  pedido,
  onOpenChange,
  onSubmit,
  onDelete,
  isSubmitting = false,
  isDeleting = false,
  allowDelete = true,
}: PedidoQuickActionsDialogProps) {
  const [status, setStatus] = useState<PedidoEstado>('COTIZACIÓN')
  const [prioridad, setPrioridad] = useState<Prioridad>('MEDIA')
  const [fecha, setFecha] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [notas, setNotas] = useState('')

  useEffect(() => {
    if (pedido) {
      setStatus(pedido.status)
      setPrioridad(pedido.prioridad)
      setFecha(dayjs(pedido.fecha_compromiso.toDate()).format('YYYY-MM-DD'))
      setNotas(pedido.notas ?? '')
    }
  }, [pedido])

  const isBusy = useMemo(() => isSubmitting || isDeleting, [isSubmitting, isDeleting])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pedido || isSubmitting) return
    await onSubmit({
      status,
      prioridad,
      fecha_compromiso: dayjs(fecha).toDate(),
      notas,
    })
  }

  async function handleDelete() {
    if (!pedido || !onDelete || isDeleting) return
    await onDelete()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {pedido ? (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <DialogHeader>
              <DialogTitle>Editar pedido {pedido.folio}</DialogTitle>
              <DialogDescription>
                Actualiza el estado, prioridad o fecha compromiso del pedido seleccionado.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4 text-sm">
              <label className="flex flex-col gap-1">
                Estado
                <select
                  className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PedidoEstado)}
                  disabled={isBusy}
                >
                  {ESTADOS_PEDIDO.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Prioridad
                <select
                  className="h-12 rounded-full border border-slate-200 bg-white px-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  value={prioridad}
                  onChange={(event) => setPrioridad(event.target.value as Prioridad)}
                  disabled={isBusy}
                >
                  {PRIORIDADES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Fecha compromiso
                <Input
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  disabled={isBusy}
                />
              </label>
              <label className="flex flex-col gap-1">
                Notas internas
                <Textarea
                  rows={4}
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  disabled={isBusy}
                  placeholder="Actualiza las notas visibles para el equipo."
                />
              </label>
            </DialogBody>
            <DialogFooter className="gap-3 sm:justify-between">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="w-full sm:w-auto" disabled={isBusy}>
                  Cancelar
                </Button>
              </DialogClose>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {allowDelete && onDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={handleDelete}
                    disabled={isBusy}
                  >
                    {isDeleting ? 'Eliminando...' : 'Eliminar'}
                  </Button>
                ) : null}
                <Button type="submit" className="w-full sm:w-auto" disabled={isBusy}>
                  {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
