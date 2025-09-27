import { Link, NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu, Settings, Users, ClipboardList, DollarSign, Home, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { signOut } from 'firebase/auth'
import { auth } from '@/config/firebase'
import { useState } from 'react'
import { clsx } from 'clsx'

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

  async function handleSignOut() {
    await signOut(auth)
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          {
            '-translate-x-full lg:-translate-x-0': !isMenuOpen,
            'translate-x-0': isMenuOpen,
          },
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <Link to="/app/dashboard" className="text-lg font-bold tracking-tight text-primary">
            Quality Bordados
          </Link>
          <button className="lg:hidden" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú">
            <LogOut className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100',
                    isActive ? 'bg-slate-900 text-white hover:bg-slate-900/90' : 'text-slate-600',
                  )
                }
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700">{user?.email}</p>
          <p className="capitalize">Rol: {role?.toLowerCase() ?? 'sin rol'}</p>
          <Button variant="outline" className="mt-3 w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:ml-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setIsMenuOpen((prev) => !prev)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-slate-800">Panel de control</h1>
          </div>
          <div className="flex items-center gap-3 text-right text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-800">{user?.displayName ?? 'Equipo Quality'}</p>
              <p className="capitalize">{role?.toLowerCase() ?? 'sin rol'}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
