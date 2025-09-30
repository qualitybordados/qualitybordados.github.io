import { useState } from 'react'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import {
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/format'
import { getDocumentId } from '@/lib/firestore'
import { Pedido } from '@/lib/types'
import { AbonoForm as AbonoFormValues } from '@/lib/validators'

type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'

const metodosPago: MetodoPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']

type AbonoDialogFormProps = {
  pedido: Pedido
  onSubmit: (values: AbonoFormValues) => Promise<void>
  onClose: () => void
  isSubmitting: boolean
}

export function AbonoDialogForm({ pedido, onSubmit, onClose, isSubmitting }: AbonoDialogFormProps) {
  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'))
  const [monto, setMonto] = useState(pedido.saldo)
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO')
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
            onChange={(event) => setMetodo(event.target.value as MetodoPago)}
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
