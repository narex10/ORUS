import { useState } from 'react';
import { subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Campaign } from '@/types';
import { CampaignTable } from '@/components/campaigns/CampaignTable';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 29 },
];

export function Campaigns() {
  const { activeProfile } = useAuthStore();
  const [days, setDays] = useState(7);

  const from = subDays(new Date(), days).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data: campaigns, isLoading, refetch, isFetching } = useQuery<Campaign[]>({
    queryKey: ['campaigns', activeProfile?.id, from, to],
    queryFn: () =>
      api.get(`/campaigns/profile/${activeProfile!.id}`, { params: { from, to } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil para ver os anúncios.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciador de Anúncios</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  days === opt.days
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-card animate-pulse border border-border" />
      ) : (
        <CampaignTable campaigns={campaigns ?? []} currency={activeProfile.currency} />
      )}
    </div>
  );
}
