import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actualizarEstadoPedido,
  createPedido,
  eliminarPedido,
  fetchPedidoAbonos,
  fetchPedidoItems,
  fetchPedidos,
  updatePedido,
} from './api'
import { PedidoEstado } from '@/lib/types'
import { PedidoForm } from '@/lib/validators'

const PEDIDOS_KEY = ['pedidos']

type PedidosFilters = {
  status?: PedidoEstado | 'TODOS'
  prioridad?: string
  clienteId?: string
}

type PedidosQueryOptions = {
  enabled?: boolean
}

export function usePedidos(filters: PedidosFilters = {}, options: PedidosQueryOptions = {}) {
  return useQuery({
    queryKey: [...PEDIDOS_KEY, filters],
    queryFn: () => fetchPedidos(filters),
    staleTime: 1000 * 30,
    enabled: options.enabled,
  })
}

export function usePedidoItems(pedidoId?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...PEDIDOS_KEY, 'items', pedidoId],
    queryFn: () => fetchPedidoItems(pedidoId as string),
    enabled: !!pedidoId && options.enabled,
    staleTime: 1000 * 30,
  })
}

export function usePedidoAbonos(pedidoId?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...PEDIDOS_KEY, 'abonos', pedidoId],
    queryFn: () => fetchPedidoAbonos(pedidoId as string),
    enabled: !!pedidoId && options.enabled,
    staleTime: 1000 * 30,
  })
}

export function useCreatePedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: PedidoForm; usuarioId: string }) => createPedido(payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY }),
  })
}

export function useUpdatePedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; data: Partial<PedidoForm>; usuarioId: string }) =>
      updatePedido(payload.id, payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY }),
  })
}

export function useActualizarEstadoPedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; estado: PedidoEstado; usuarioId: string; data?: Parameters<typeof actualizarEstadoPedido>[3] }) =>
      actualizarEstadoPedido(payload.id, payload.estado, payload.usuarioId, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY }),
  })
}

export function useEliminarPedido() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; usuarioId: string }) => eliminarPedido(payload.id, payload.usuarioId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY })
      queryClient.invalidateQueries({ queryKey: ['caja'] })
      queryClient.invalidateQueries({ queryKey: ['cobranza'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos', 'abonos', variables.id] })
    },
  })
}
