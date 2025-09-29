import { useQuery } from '@tanstack/react-query'
import { fetchDashboardData } from './api'

type DashboardQueryOptions = {
  enabled?: boolean
}

export function useDashboardData(options: DashboardQueryOptions = {}) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 1000 * 60,
    enabled: options.enabled,
  })
}
