import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, Settings, Users, ClipboardList, DollarSign, Home, PiggyBank, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { signOut } from 'firebase/auth'
import { auth } from '@/config/firebase'
import { useState } from 'react'
import { clsx } from 'clsx'
import { Badge } from '@/components/ui/badge'

const navigation = [
  { to: '/app/dashboard', label: 'Dashboard', icon: Home },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/app/cobranza', label: 'Cobranza', icon: DollarSign },
  { to: '/app/caja', label: 'Caja', icon: PiggyBank },
  { to: '/app/config', label: 'Configuración', icon: Settings },
]

export function AppShell() {
  const { user, role } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const activeNavigation = navigation.find((item) => location.pathname.startsWith(item.to))

  async function handleSignOut() {
    await signOut(auth)
  }

  return (
    <div className="relative flex min-h-screen w-full max-w-[100vw] bg-slate-100">
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden',
          isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setIsMenuOpen(false)}
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-6 overflow-y-auto border-r border-slate-200 bg-white px-6 py-6 shadow-xl transition-transform duration-300 ease-out lg:static lg:translate-x-0 lg:shadow-none',
          {
            '-translate-x-full lg:-translate-x-0': !isMenuOpen,
            'translate-x-0': isMenuOpen,
          },
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Link to="/app/dashboard" className="text-base font-semibold tracking-tight text-primary">
            Quality Bordados
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full border border-slate-200 lg:hidden"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
          <div>
            <p className="font-semibold text-slate-800">{user?.displayName ?? 'Equipo Quality'}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-primary px-4 text-primary-foreground shadow-sm sm:px-6 lg:px-10">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 bg-primary-foreground text-primary lg:hidden"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">{activeNavigation?.label ?? 'Quality Bordados'}</h1>
            <Badge variant="neutral" className="text-xs uppercase tracking-wide">
              {role ?? 'Sin rol'}
            </Badge>
          </div>
        </header>

        <main className="relative flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
