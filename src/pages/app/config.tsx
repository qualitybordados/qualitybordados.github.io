import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfiguracion, useGuardarConfiguracion } from '@/features/configuracion/hooks'
import { useAuth } from '@/hooks/use-auth'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ConfiguracionForm, configSchema } from '@/lib/validators'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

const roles = ['OWNER', 'ADMIN', 'VENTAS', 'PRODUCCION', 'COBRANZA'] as const

export default function ConfiguracionPage() {
  const { role, user, loading } = useAuth()
  const authReady = !!user && !loading
  const { data, isLoading, isFetching } = useConfiguracion({ enabled: authReady })
  const configuracionLoading = loading || isLoading || (authReady && isFetching && !data)
  const guardarConfiguracion = useGuardarConfiguracion()

  const form = useForm<ConfiguracionForm>({
    resolver: zodResolver(configSchema) as unknown as Resolver<ConfiguracionForm>,
    defaultValues: {
      porcentaje_anticipo: 50,
      dias_credito: 30,
      politicas_credito: '',
      roles_visibles: ['OWNER', 'ADMIN', 'VENTAS', 'PRODUCCION', 'COBRANZA'],
    },
  })

  useEffect(() => {
    if (data) {
      form.reset(data)
    }
  }, [data, form])

  const puedeEditar = ['OWNER', 'ADMIN'].includes(role ?? '')

  async function onSubmit(values: ConfiguracionForm) {
    if (!user) return
    await guardarConfiguracion.mutateAsync({ data: values, usuarioId: user.uid })
  }

  if (configuracionLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuraciones generales</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                % Anticipo mínimo
                <Input
                  type="number"
                  step="0.01"
                  disabled={!puedeEditar}
                  {...form.register('porcentaje_anticipo', { valueAsNumber: true })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Días de crédito estándar
                <Input
                  type="number"
                  disabled={!puedeEditar}
                  {...form.register('dias_credito', { valueAsNumber: true })}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Políticas de crédito y cobranza
              <Textarea rows={4} disabled={!puedeEditar} {...form.register('politicas_credito')} />
            </label>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">Roles con acceso visible en la app</p>
              <div className="flex flex-wrap gap-2">
                {roles.map((rol) => {
                  const activo = form.watch('roles_visibles').includes(rol)
                  return (
                    <Badge
                      key={rol}
                      variant={activo ? 'success' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (!puedeEditar) return
                        const actuales = form.getValues('roles_visibles')
                        if (actuales.includes(rol)) {
                          form.setValue(
                            'roles_visibles',
                            actuales.filter((item) => item !== rol),
                          )
                        } else {
                          form.setValue('roles_visibles', [...actuales, rol])
                        }
                      }}
                    >
                      {rol}
                    </Badge>
                  )
                })}
              </div>
            </div>
            {puedeEditar ? (
              <Button type="submit" disabled={guardarConfiguracion.isPending}>
                {guardarConfiguracion.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            ) : (
              <Alert variant="warning" description="Solo OWNER y ADMIN pueden actualizar la configuración." />
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
