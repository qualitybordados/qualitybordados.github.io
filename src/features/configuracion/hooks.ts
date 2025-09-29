import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchConfiguracion, guardarConfiguracion } from './api'
import { ConfiguracionForm } from '@/lib/validators'

const CONFIG_KEY = ['configuracion']

type ConfigQueryOptions = {
  enabled?: boolean
}

export function useConfiguracion(options: ConfigQueryOptions = {}) {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: fetchConfiguracion,
    staleTime: 1000 * 60 * 5,
    enabled: options.enabled,
  })
}

export function useGuardarConfiguracion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { data: ConfiguracionForm; usuarioId: string }) =>
      guardarConfiguracion(payload.data, payload.usuarioId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONFIG_KEY }),
  })
}
