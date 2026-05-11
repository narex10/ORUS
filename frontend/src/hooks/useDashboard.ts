import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardData } from '@/types';
import { format, subDays } from 'date-fns';

export function useDashboard(profileId: string | undefined, from?: Date, to?: Date) {
  const fromDate = from ?? subDays(new Date(), 29);
  const toDate = to ?? new Date();

  return useQuery<DashboardData>({
    queryKey: ['dashboard', profileId, format(fromDate, 'yyyy-MM-dd'), format(toDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await api.get(`/dashboard/${profileId}`, {
        params: {
          from: format(fromDate, 'yyyy-MM-dd'),
          to: format(toDate, 'yyyy-MM-dd'),
        },
      });
      return data;
    },
    enabled: !!profileId,
  });
}
