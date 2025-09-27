import { useAuthContext } from '@/providers/auth-provider'

export function useAuth() {
  const context = useAuthContext()
  return context
}
