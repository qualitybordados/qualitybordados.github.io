import { User } from 'firebase/auth'
import { create } from 'zustand'

export type AppRole = 'OWNER' | 'ADMIN' | 'VENTAS' | 'PRODUCCION' | 'COBRANZA'

interface AuthState {
  user: User | null
  role: AppRole | null
  loading: boolean
  setAuthState: (payload: { user: User | null; role: AppRole | null; loading?: boolean }) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,
  setAuthState: ({ user, role, loading = false }) => set({ user, role, loading }),
}))
