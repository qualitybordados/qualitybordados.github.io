import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { actualizarMovimientoCaja, crearMovimientoCaja, eliminarMovimientoCaja, fetchMovimientosCaja } from './api'
import { MovimientoCajaForm } from '@/lib/validators'

const CAJA_KEY = ['caja']

type CajaFilters = {
  tipo?: 'INGRESO' | 'EGRESO' | 'TODOS'
  categoria?: string
  desde?: Date
  hasta?: Date
}

type CajaQueryOptions = {
  enabled?: boolean
}

export function useMovimientosCaja(filters: CajaFilters = {}, options: CajaQueryOptions = {}) {
  return useQuery({
    queryKey: [...CAJA_KEY, filters],
    queryFn: () => fetchMovimientosCaja(filters),
    staleTime: 1000 * 30,
    enabled: options.enabled,
  })
}

export function useCrearMovimientoCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: MovimientoCajaForm; usuarioId: string }) => crearMovimientoCaja(payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAJA_KEY }),
  })
}

export function useActualizarMovimientoCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; data: MovimientoCajaForm; usuarioId: string }) =>
      actualizarMovimientoCaja(payload.id, payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAJA_KEY }),
  })
}

export function useEliminarMovimientoCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { id: string; usuarioId: string }) => eliminarMovimientoCaja(payload.id, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAJA_KEY }),
  })
}
