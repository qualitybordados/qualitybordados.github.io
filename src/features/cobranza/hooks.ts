import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPedidosConSaldo, registrarAbonoPedido } from './api'
import { AbonoForm } from '@/lib/validators'

const COBRANZA_KEY = ['cobranza']

type CobranzaQueryOptions = {
  enabled?: boolean
}

export function usePedidosConSaldo(options: CobranzaQueryOptions = {}) {
  return useQuery({
    queryKey: COBRANZA_KEY,
    queryFn: fetchPedidosConSaldo,
    staleTime: 1000 * 30,
    enabled: options.enabled,
  })
}

export function useRegistrarAbono() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: AbonoForm; usuarioId: string }) => registrarAbonoPedido(payload.data, payload.usuarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COBRANZA_KEY })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    },
  })
}
