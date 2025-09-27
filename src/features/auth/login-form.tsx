import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/config/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'

const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setError(null)
    setIsSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password)
    } catch (err) {
      setError('Credenciales inválidas, verifica tu correo y contraseña.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Ingresar a Quality Bordados</h1>
        <p className="text-sm text-slate-500">Usa tu correo corporativo y contraseña asignada.</p>
      </div>
      {error ? <Alert variant="destructive" description={error} /> : null}
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          {form.formState.errors.email ? (
            <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password ? (
            <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Ingresar'}
        </Button>
      </form>
      <p className="text-center text-xs text-slate-400">
        Acceso restringido al personal autorizado. Contacta al administrador para recuperar acceso.
      </p>
    </div>
  )
}
