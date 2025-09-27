import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPedidosConSaldo, registrarAbonoPedido } from './api'
import { AbonoForm } from '@/lib/validators'

const COBRANZA_KEY = ['cobranza']

export function usePedidosConSaldo() {
  return useQuery({
    queryKey: COBRANZA_KEY,
    queryFn: fetchPedidosConSaldo,
    staleTime: 1000 * 30,
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
