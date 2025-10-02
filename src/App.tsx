import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/pages/login'
import LogoutPage from '@/pages/logout'
import DashboardPage from '@/pages/app/dashboard'
import ClientesPage from '@/pages/app/clientes'
import PedidosPage from '@/pages/app/pedidos'
import CobranzaPage from '@/pages/app/cobranza'
import FinanzasPage from '@/pages/app/finanzas'
import ConfiguracionPage from '@/pages/app/config'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { AppShell } from '@/components/layout/app-shell'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="cobranza" element={<CobranzaPage />} />
          <Route path="caja" element={<FinanzasPage />} />
          <Route path="config" element={<ConfiguracionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
