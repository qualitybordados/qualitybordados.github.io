import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClienteFormFields } from '@/features/clientes/components/cliente-form'
import { useClientes, useCreateCliente, useDeleteCliente, useUpdateCliente } from '@/features/clientes/hooks'
import { usePedidos } from '@/features/pedidos/hooks'
import { Cliente } from '@/lib/types'
import { formatCurrency, formatPhone } from '@/lib/format'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { Mail, Phone, MapPin, CreditCard, Pencil, Search, Filter, Plus, Trash } from 'lucide-react'
import dayjs from 'dayjs'

const estatusFilters = ['TODOS', 'ACTIVO', 'PAUSADO']

export default function ClientesPage() {
  const { role, user, loading } = useAuth()
  const [search, setSearch] = useState('')
  const [estatus, setEstatus] = useState<string>('TODOS')
  const authReady = !!user && !loading
  const {
    data: clientes,
    isLoading,
    isFetching,
  } = useClientes({ search, estatus }, { enabled: authReady })
  const clientesLoading = loading || isLoading || (authReady && isFetching && !clientes)
  const createMutation = useCreateCliente()
  const updateMutation = useUpdateCliente()
  const deleteMutation = useDeleteCliente()
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [detalleOpen, setDetalleOpen] = useState(false)

  const canEdit = ['OWNER', 'ADMIN', 'VENTAS'].includes(role ?? '')

  const ciudades = useMemo(() => {
    if (!clientes) return []
    return Array.from(new Set(clientes.map((cliente) => cliente.ciudad))).sort()
  }, [clientes])
  const [ciudadFiltro, setCiudadFiltro] = useState<string>('')

  const clientesFiltrados = useMemo(() => {
    if (!clientes) return []
    return clientes.filter((cliente) => (ciudadFiltro ? cliente.ciudad === ciudadFiltro : true))
  }, [clientes, ciudadFiltro])

  async function handleCrearCliente(values: any) {
    if (!user) return
    await createMutation.mutateAsync({ data: values, usuarioId: user.uid })
    setModalOpen(false)
  }

  async function handleActualizarCliente(values: any) {
    if (!user || !clienteSeleccionado) return
    await updateMutation.mutateAsync({ id: clienteSeleccionado.id, data: values, usuarioId: user.uid })
    setModalOpen(false)
  }

  async function handleEliminarCliente(cliente: Cliente) {
    if (!user) return
    if (confirm(`¿Eliminar al cliente ${cliente.alias}?`)) {
      await deleteMutation.mutateAsync({ id: cliente.id, usuarioId: user.uid })
      setDetalleOpen(false)
    }
  }

  function openNuevoCliente() {
    setClienteSeleccionado(null)
    setModalOpen(true)
  }

  function openEditarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente)
    setModalOpen(true)
  }

  function openDetalle(cliente: Cliente) {
    setClienteSeleccionado(cliente)
    setDetalleOpen(true)
  }

  return (
    <div className="relative space-y-6 pb-20">
      <Card className="border-none bg-white/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Clientes</CardTitle>
          <p className="text-xs text-slate-500">Gestiona tus clientes desde una vista táctil y rápida.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, alias, correo o ciudad"
                className="pl-11"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <Filter className="hidden h-4 w-4 text-slate-400 sm:block" />
              <select
                value={estatus}
                onChange={(event) => setEstatus(event.target.value)}
                className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-auto"
              >
                {estatusFilters.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={ciudadFiltro}
                onChange={(event) => setCiudadFiltro(event.target.value)}
                className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-auto"
              >
                <option value="">Todas las ciudades</option>
                {ciudades.map((ciudad) => (
                  <option key={ciudad} value={ciudad}>
                    {ciudad}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {canEdit ? (
            <Button onClick={openNuevoCliente} className="hidden w-full sm:w-auto lg:flex lg:self-end">
              <Plus className="h-4 w-4" />
              <span>Nuevo cliente</span>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        {clientesLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-none bg-white/60 p-4 shadow-sm">
              <div className="flex animate-pulse flex-col gap-3">
                <div className="h-4 w-32 rounded-full bg-slate-200" />
                <div className="h-4 w-48 rounded-full bg-slate-200" />
                <div className="h-10 w-full rounded-full bg-slate-200" />
              </div>
            </Card>
          ))
        ) : clientesFiltrados.length ? (
          clientesFiltrados.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onOpenDetalle={() => openDetalle(cliente)}
              onOpenEditar={() => openEditarCliente(cliente)}
              canEdit={canEdit}
            />
          ))
        ) : (
          <EmptyState
            title="Sin clientes"
            description="Agrega tu primer cliente para comenzar a registrar pedidos y cobranza."
          />
        )}
      </section>

      {canEdit ? (
        <Button
          size="fab"
          className="fixed bottom-24 right-6 z-40 lg:hidden"
          onClick={openNuevoCliente}
          aria-label="Nuevo cliente"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{clienteSeleccionado ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
            <DialogDescription>
              {clienteSeleccionado
                ? 'Actualiza los datos del cliente y guarda los cambios registrados.'
                : 'Completa la información para registrar un nuevo cliente en el sistema.'}
            </DialogDescription>
          </DialogHeader>
          <ClienteFormFields
            defaultValues={clienteSeleccionado ?? undefined}
            onSubmit={clienteSeleccionado ? handleActualizarCliente : handleCrearCliente}
            submitLabel={clienteSeleccionado ? 'Actualizar cliente' : 'Crear cliente'}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          {clienteSeleccionado ? (
            <ClienteDetalle cliente={clienteSeleccionado} puedeEliminar={canEdit} onEliminar={handleEliminarCliente} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClienteCard({
  cliente,
  onOpenDetalle,
  onOpenEditar,
  canEdit,
}: {
  cliente: Cliente
  onOpenDetalle: () => void
  onOpenEditar: () => void
  canEdit: boolean
}) {
  const estatusColor = cliente.estatus === 'ACTIVO' ? 'success' : 'warning'

  return (
    <Card
      className="relative cursor-pointer border-none bg-white/90 p-4 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
      onClick={onOpenDetalle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-900">{cliente.alias}</span>
            <Badge variant={estatusColor}>{cliente.estatus}</Badge>
          </div>
          <p className="text-sm text-slate-500">{cliente.nombre_legal}</p>
        </div>
        {canEdit ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 border border-slate-200"
            onClick={(event) => {
              event.stopPropagation()
              onOpenEditar()
            }}
            aria-label="Editar cliente"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <div className="flex flex-col gap-2 text-slate-600 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="flex items-center gap-2 text-slate-600">
            <Mail className="h-4 w-4 text-slate-400" />
            {cliente.email}
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <Phone className="h-4 w-4 text-slate-400" />
            {formatPhone(cliente.telefono)}
          </span>
        </div>
        <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="flex items-center gap-2 text-slate-500">
            <MapPin className="h-4 w-4 text-slate-400" />
            {cliente.ciudad}
          </span>
          <span className="flex items-center gap-2 text-slate-500">
            <CreditCard className="h-4 w-4 text-slate-400" />
            {formatCurrency(cliente.limite_credito)} límite
          </span>
        </div>
      </div>
    </Card>
  )
}

function ClienteDetalle({ cliente, puedeEliminar, onEliminar }: { cliente: Cliente; puedeEliminar: boolean; onEliminar: (cliente: Cliente) => void }) {
  const { user, loading } = useAuth()
  const authReady = !!user && !loading
  const { data: pedidos } = usePedidos({ clienteId: cliente.id }, { enabled: authReady })
  const saldoTotal = useMemo(() => {
    if (!pedidos) return 0
    return pedidos.reduce((sum, pedido) => sum + pedido.saldo, 0)
  }, [pedidos])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <DialogHeader className="items-start text-left">
          <DialogTitle className="text-xl font-semibold text-slate-900">{cliente.alias}</DialogTitle>
          <DialogDescription>{cliente.nombre_legal}</DialogDescription>
        </DialogHeader>
        {puedeEliminar ? (
          <Button variant="destructive" size="sm" onClick={() => onEliminar(cliente)}>
            <Trash className="h-4 w-4" />
            <span>Eliminar</span>
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="datos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-full bg-slate-100 p-1 text-xs">
          <TabsTrigger value="datos" className="rounded-full">Datos</TabsTrigger>
          <TabsTrigger value="pedidos" className="rounded-full">Pedidos</TabsTrigger>
          <TabsTrigger value="saldos" className="rounded-full">Saldos</TabsTrigger>
        </TabsList>
        <TabsContent value="datos" className="mt-4 space-y-3 text-sm">
          <InfoRow label="RFC" value={cliente.rfc} />
          <InfoRow label="Correo" value={cliente.email} />
          <InfoRow label="Teléfono" value={formatPhone(cliente.telefono)} />
          <InfoRow label="Ciudad" value={`${cliente.ciudad} · CP ${cliente.cp}`} />
          <InfoRow label="Dirección" value={cliente.direccion} />
          <InfoRow label="Límite de crédito" value={formatCurrency(cliente.limite_credito)} />
          <InfoRow label="Días de crédito" value={`${cliente.dias_credito} días`} />
        </TabsContent>
        <TabsContent value="pedidos" className="mt-4 space-y-3">
          {pedidos && pedidos.length ? (
            pedidos.map((pedido) => (
              <div key={pedido.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Folio {pedido.folio}</p>
                    <p className="text-xs text-slate-500">Estado: {pedido.status}</p>
                  </div>
                  <Badge variant={pedido.saldo > 0 ? 'warning' : 'success'}>{formatCurrency(pedido.saldo)}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">Entrega: {dayjs(pedido.fecha_compromiso.toDate()).format('DD MMM YYYY')}</p>
              </div>
            ))
          ) : (
            <EmptyState title="Sin pedidos" description="Aún no hay pedidos registrados para este cliente." />
          )}
        </TabsContent>
        <TabsContent value="saldos" className="mt-4">
          <Alert
            variant={saldoTotal > 0 ? 'warning' : 'success'}
            title={saldoTotal > 0 ? 'Saldo pendiente' : 'Cliente al corriente'}
            description={`Saldo total: ${formatCurrency(saldoTotal)}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-3 text-slate-600">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}
