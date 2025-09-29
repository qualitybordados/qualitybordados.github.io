import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ClienteFormFields } from '@/features/clientes/components/cliente-form'
import { useClientes, useCreateCliente, useDeleteCliente, useUpdateCliente } from '@/features/clientes/hooks'
import { usePedidos } from '@/features/pedidos/hooks'
import { Cliente } from '@/lib/types'
import { formatCurrency, formatPhone } from '@/lib/format'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/empty-state'
import { Loader2, Plus, Search, Trash } from 'lucide-react'

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de clientes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, alias, correo o ciudad"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={estatus}
                onChange={(event) => setEstatus(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
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
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
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
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setClienteSeleccionado(null)}>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
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
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Límite crédito</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : clientesFiltrados.length ? (
                clientesFiltrados.map((cliente) => (
                  <TableRow key={cliente.id} className="cursor-pointer" onClick={() => { setClienteSeleccionado(cliente); setDetalleOpen(true) }}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{cliente.alias}</span>
                        <span className="text-xs text-slate-500">{cliente.nombre_legal}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{cliente.email}</span>
                        <span className="text-xs text-slate-500">{formatPhone(cliente.telefono)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{cliente.ciudad}</TableCell>
                    <TableCell>{formatCurrency(cliente.limite_credito)}</TableCell>
                    <TableCell>
                      <Badge variant={cliente.estatus === 'ACTIVO' ? 'success' : 'warning'}>
                        {cliente.estatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation()
                          setClienteSeleccionado(cliente)
                          setModalOpen(true)
                        }}
                        disabled={!canEdit}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10">
                    <EmptyState
                      title="Sin clientes"
                      description="Agrega tu primer cliente para comenzar a registrar pedidos y cobranza."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          {clienteSeleccionado ? (
            <ClienteDetalle cliente={clienteSeleccionado} puedeEliminar={canEdit} onEliminar={handleEliminarCliente} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
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
            <Trash className="mr-2 h-4 w-4" /> Eliminar
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
        </TabsList>
        <TabsContent value="datos">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium text-slate-600">RFC</p>
              <p>{cliente.rfc}</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Correo</p>
              <p>{cliente.email}</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Teléfono</p>
              <p>{formatPhone(cliente.telefono)}</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Ciudad</p>
              <p>{cliente.ciudad}</p>
            </div>
            <div className="md:col-span-2">
              <p className="font-medium text-slate-600">Dirección</p>
              <p>{cliente.direccion}</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Límite de crédito</p>
              <p>{formatCurrency(cliente.limite_credito)}</p>
            </div>
            <div>
              <p className="font-medium text-slate-600">Días de crédito</p>
              <p>{cliente.dias_credito}</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="pedidos">
          {pedidos && pedidos.length ? (
            <div className="space-y-3">
              {pedidos.map((pedido) => (
                <div key={pedido.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Folio {pedido.folio}</p>
                      <p className="text-xs text-slate-500">Estado: {pedido.status}</p>
                    </div>
                    <Badge variant={pedido.saldo > 0 ? 'warning' : 'success'}>{formatCurrency(pedido.saldo)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Entrega: {pedido.fecha_compromiso.toDate().toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin pedidos" description="Aún no hay pedidos registrados para este cliente." />
          )}
        </TabsContent>
        <TabsContent value="saldos">
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
