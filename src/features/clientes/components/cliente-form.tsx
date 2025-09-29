import { Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ClienteForm, clienteSchema } from '@/lib/validators'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectItem } from '@/components/ui/select'
import { DialogBody, DialogClose, DialogFooter } from '@/components/ui/dialog'
import { useEffect } from 'react'

type ClienteFormProps = {
  defaultValues?: Partial<ClienteForm>
  onSubmit: (values: ClienteForm) => Promise<void>
  submitLabel?: string
  onCancel?: () => void
}

const estatusOptions = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PAUSADO', label: 'Pausado' },
]

export function ClienteFormFields({ defaultValues, onSubmit, submitLabel = 'Guardar cliente', onCancel }: ClienteFormProps) {
  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema) as unknown as Resolver<ClienteForm>,
    defaultValues: defaultValues ?? {
      nombre_legal: '',
      alias: '',
      rfc: '',
      email: '',
      telefono: '',
      direccion: '',
      ciudad: '',
      cp: '',
      limite_credito: 0,
      dias_credito: 0,
      estatus: 'ACTIVO',
    },
  })

  useEffect(() => {
    if (defaultValues) {
      form.reset(defaultValues as ClienteForm)
    }
  }, [defaultValues, form])

  const onSubmitHandler = form.handleSubmit(async (values: ClienteForm) => {
    await onSubmit(values)
  })

  return (
    <form className="flex h-full flex-col" onSubmit={onSubmitHandler}>
      <DialogBody className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre_legal">Nombre fiscal</Label>
            <Input id="nombre_legal" {...form.register('nombre_legal')} />
            {form.formState.errors.nombre_legal ? (
              <p className="text-xs text-red-600">{form.formState.errors.nombre_legal.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="alias">Alias comercial</Label>
            <Input id="alias" {...form.register('alias')} />
            {form.formState.errors.alias ? (
              <p className="text-xs text-red-600">{form.formState.errors.alias.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rfc">RFC</Label>
            <Input id="rfc" {...form.register('rfc')} className="uppercase" />
            {form.formState.errors.rfc ? <p className="text-xs text-red-600">{form.formState.errors.rfc.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email ? <p className="text-xs text-red-600">{form.formState.errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" {...form.register('telefono')} inputMode="numeric" />
            {form.formState.errors.telefono ? (
              <p className="text-xs text-red-600">{form.formState.errors.telefono.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" {...form.register('ciudad')} />
            {form.formState.errors.ciudad ? <p className="text-xs text-red-600">{form.formState.errors.ciudad.message}</p> : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" {...form.register('direccion')} />
            {form.formState.errors.direccion ? (
              <p className="text-xs text-red-600">{form.formState.errors.direccion.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp">Código Postal</Label>
            <Input id="cp" {...form.register('cp')} />
            {form.formState.errors.cp ? <p className="text-xs text-red-600">{form.formState.errors.cp.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="limite_credito">Límite de crédito</Label>
            <Input id="limite_credito" type="number" step="0.01" {...form.register('limite_credito', { valueAsNumber: true })} />
            {form.formState.errors.limite_credito ? (
              <p className="text-xs text-red-600">{form.formState.errors.limite_credito.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dias_credito">Días de crédito</Label>
            <Input id="dias_credito" type="number" {...form.register('dias_credito', { valueAsNumber: true })} />
            {form.formState.errors.dias_credito ? (
              <p className="text-xs text-red-600">{form.formState.errors.dias_credito.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Estatus</Label>
            <Select value={form.watch('estatus')} onValueChange={(value) => form.setValue('estatus', value as ClienteForm['estatus'])}>
              {estatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="gap-3 sm:justify-between">
        <DialogClose asChild>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onCancel}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Guardando...' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
