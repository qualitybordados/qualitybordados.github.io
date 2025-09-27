import { useQuery } from '@tanstack/react-query'
import { fetchDashboardData } from './api'

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 1000 * 60,
  })
}
