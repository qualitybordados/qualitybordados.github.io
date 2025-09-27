import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crearMovimientoCaja, fetchMovimientosCaja } from './api'
import { MovimientoCajaForm } from '@/lib/validators'

const CAJA_KEY = ['caja']

type CajaFilters = {
  tipo?: 'INGRESO' | 'EGRESO' | 'TODOS'
  categoria?: string
  desde?: Date
  hasta?: Date
}

export function useMovimientosCaja(filters: CajaFilters = {}) {
  return useQuery({
    queryKey: [...CAJA_KEY, filters],
    queryFn: () => fetchMovimientosCaja(filters),
    staleTime: 1000 * 30,
  })
}

export function useCrearMovimientoCaja() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: MovimientoCajaForm; usuarioId: string }) => crearMovimientoCaja(payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAJA_KEY }),
  })
}
