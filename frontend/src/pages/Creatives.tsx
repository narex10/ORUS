import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { TrendingUp, Target, MousePointerClick, Eye } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatROAS, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

type SortBy = 'roas' | 'ctr' | 'cpa' | 'purchases';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'roas', label: 'Melhor ROAS' },
  { value: 'ctr', label: 'Melhor CTR' },
  { value: 'cpa', label: 'Menor CPA' },
  { value: 'purchases', label: 'Mais Vendas' },
];

export function Creatives() {
  const { activeProfile } = useAuthStore();
  const [sortBy, setSortBy] = useState<SortBy>('roas');
  const [days, setDays] = useState(7);

  const from = subDays(new Date(), days).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  // Reutiliza endpoint de campaigns mas no nível AD
  const { data: ads, isLoading } = useQuery({
    queryKey: ['creatives', activeProfile?.id, from, to],
    queryFn: () =>
      api.get(`/campaigns/profile/${activeProfile!.id}`, { params: { from, to, level: 'AD' } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  const sorted = [...(ads ?? [])].sort((a: any, b: any) => {
    if (sortBy === 'cpa') return (a.cpa || Infinity) - (b.cpa || Infinity);
    return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
  });

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise de Criativos</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  sortBy === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Nenhum criativo encontrado para o período.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((ad: any) => (
            <div
              key={ad.id}
              className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all"
            >
              {/* Preview */}
              <div className="relative aspect-video bg-muted flex items-center justify-center">
                {ad.thumbnailUrl ? (
                  <img src={ad.thumbnailUrl} alt={ad.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Eye className="h-8 w-8 opacity-20" />
                    <span className="text-xs opacity-40">Preview</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant={ad.roas >= 2 ? 'success' : ad.roas >= 1 ? 'warning' : 'destructive'}>
                    {formatROAS(ad.roas)}
                  </Badge>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium text-foreground truncate" title={ad.name}>
                  {ad.name}
                </p>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs text-muted-foreground">ROAS</span>
                    <span className={cn('text-xs font-semibold ml-auto',
                      ad.roas >= 2 ? 'text-emerald-400' : ad.roas >= 1 ? 'text-amber-400' : 'text-red-400')}>
                      {formatROAS(ad.roas)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3 text-blue-400" />
                    <span className="text-xs text-muted-foreground">CTR</span>
                    <span className="text-xs font-semibold ml-auto text-foreground">{formatPercent(ad.ctr)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-orange-400" />
                    <span className="text-xs text-muted-foreground">CPA</span>
                    <span className="text-xs font-semibold ml-auto text-foreground">
                      {ad.cpa > 0 ? formatCurrency(ad.cpa, activeProfile.currency) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Vendas</span>
                    <span className="text-xs font-semibold ml-auto text-foreground">{ad.purchases}</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Gasto: <span className="text-foreground font-medium">
                      {formatCurrency(ad.spend, activeProfile.currency)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
