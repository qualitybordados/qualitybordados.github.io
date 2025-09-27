import { Navigate } from 'react-router-dom'
import { LoginForm } from '@/features/auth/login-form'
import { useAuth } from '@/hooks/use-auth'

export default function LoginPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" aria-label="Cargando" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app/dashboard" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
      <LoginForm />
    </div>
  )
}
