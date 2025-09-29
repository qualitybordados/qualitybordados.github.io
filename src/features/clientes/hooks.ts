import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createCliente, deleteCliente, fetchClientes, updateCliente } from './api'
import { ClienteForm } from '@/lib/validators'

const CLIENTES_KEY = ['clientes']

type ClientesFilters = {
  search?: string
  ciudad?: string
  estatus?: string
}

type ClientesQueryOptions = {
  enabled?: boolean
}

export function useClientes(filters: ClientesFilters = {}, options: ClientesQueryOptions = {}) {
  return useQuery({
    queryKey: [...CLIENTES_KEY, filters],
    queryFn: () => fetchClientes(filters),
    staleTime: 1000 * 60,
    enabled: options.enabled,
  })
}

export function useCreateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: ClienteForm; usuarioId: string }) => createCliente(payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTES_KEY }),
  })
}

export function useUpdateCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; data: Partial<ClienteForm>; usuarioId: string }) =>
      updateCliente(payload.id, payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTES_KEY }),
  })
}

export function useDeleteCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; usuarioId: string }) => deleteCliente(payload.id, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTES_KEY }),
  })
}
