import { useState, useEffect, useRef } from 'react';
import { subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Settings2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Campaign, FunnelMetricId } from '@/types';
import { CampaignTable } from '@/components/campaigns/CampaignTable';
import { PanoramicView } from '@/components/campaigns/PanoramicView';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FUNNEL_METRIC_DEFS, DEFAULT_FUNNEL_METRICS } from '@/components/campaigns/MiniFunnel';

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
  { label: '6 meses', days: 180 },
];

function useFunnelMetrics(profileId: string | undefined) {
  const key = profileId ? `orus_funnel_metrics_${profileId}` : null;

  const [selected, setSelected] = useState<FunnelMetricId[]>(() => {
    if (!key) return DEFAULT_FUNNEL_METRICS;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : DEFAULT_FUNNEL_METRICS;
    } catch {
      return DEFAULT_FUNNEL_METRICS;
    }
  });

  useEffect(() => {
    if (key) localStorage.setItem(key, JSON.stringify(selected));
  }, [key, selected]);

  const toggle = (id: FunnelMetricId) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return { selected, toggle };
}

export function Campaigns() {
  const { activeProfile } = useAuthStore();
  const [days, setDays] = useState(7);
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const from = subDays(new Date(), days).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data: campaigns, isLoading, refetch, isFetching } = useQuery<Campaign[]>({
    queryKey: ['campaigns', activeProfile?.id, from, to],
    queryFn: () =>
      api.get(`/campaigns/profile/${activeProfile!.id}`, { params: { from, to } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  const { selected: funnelMetrics, toggle: toggleMetric } = useFunnelMetrics(activeProfile?.id);

  // Fecha o picker ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowMetricPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
          {/* Período */}
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

          {/* Configurar métricas do funil */}
          <div className="relative" ref={pickerRef}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowMetricPicker(v => !v)}
              title="Configurar métricas do mini funil"
              className={cn(showMetricPicker && 'border-primary text-primary')}
            >
              <Settings2 className="h-4 w-4" />
            </Button>

            {showMetricPicker && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-border bg-card shadow-xl p-3">
                <p className="text-xs font-semibold text-foreground mb-2 px-1">Métricas do Mini Funil</p>
                <p className="text-[11px] text-muted-foreground mb-3 px-1">
                  Selecione as métricas que aparecerão no funil de cada campanha.
                </p>
                <div className="flex flex-col gap-1">
                  {FUNNEL_METRIC_DEFS.map(def => {
                    const isSelected = funnelMetrics.includes(def.id);
                    return (
                      <button
                        key={def.id}
                        onClick={() => toggleMetric(def.id)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/50 text-muted-foreground'
                        )}
                      >
                        <div className={cn(
                          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                          isSelected ? 'border-primary bg-primary' : 'border-border'
                        )}>
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <def.icon className={cn('h-3.5 w-3.5 flex-shrink-0', isSelected ? def.color : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{def.label}</p>
                          <p className="text-[10px] text-muted-foreground">{def.sublabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-card animate-pulse border border-border" />
      ) : (
        <>
          <CampaignTable
            campaigns={campaigns ?? []}
            currency={activeProfile.currency}
            from={from}
            to={to}
            funnelMetrics={funnelMetrics}
          />
          <PanoramicView
            profileId={activeProfile.id}
            campaigns={campaigns ?? []}
            from={from}
            to={to}
          />
        </>
      )}
    </div>
  );
}
