import { onAuthStateChanged } from 'firebase/auth'
import { PropsWithChildren, createContext, useContext, useEffect, useMemo } from 'react'
import { auth } from '@/config/firebase'
import { useAuthStore, AppRole } from '@/stores/auth-store'

type AuthContextValue = {
  loading: boolean
  role: AppRole | null
  user: ReturnType<typeof useAuthStore.getState>['user']
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const setAuthState = useAuthStore((state) => state.setAuthState)
  const user = useAuthStore((state) => state.user)
  const role = useAuthStore((state) => state.role)
  const loading = useAuthStore((state) => state.loading)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setAuthState({ user: null, role: null, loading: false })
        return
      }

      const token = await firebaseUser.getIdTokenResult(true)
      const roleClaim = (token.claims.role as AppRole | undefined) ?? null
      setAuthState({ user: firebaseUser, role: roleClaim, loading: false })
    })

    return () => unsubscribe()
  }, [setAuthState])

  const value = useMemo(() => ({ loading, role, user }), [loading, role, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}
