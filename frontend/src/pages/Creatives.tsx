import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import {
  TrendingUp, TrendingDown, MousePointerClick, ClipboardList,
  Eye, DollarSign, RefreshCw, Image,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Creative {
  id: string;
  name: string;
  status: string;
  thumbnailUrl: string | null;
  headline: string | null;
  body: string | null;
  campaignId: string;
  campaignName: string;
  adSetName: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  ctr: number;
  cpm: number;
  cpr: number;
  roas: number;
}

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

function Thumbnail({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="w-full h-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground">
      <Image className="h-6 w-6 opacity-20" />
      <span className="text-[10px] opacity-40">Preview</span>
    </div>
  );
}

function CreativeCard({
  creative,
  rank,
  currency,
  maxLeads,
  variant,
}: {
  creative: Creative;
  rank: number;
  currency: string;
  maxLeads: number;
  variant: 'top' | 'bottom';
}) {
  const conversionRate = creative.impressions > 0
    ? (creative.leads / creative.impressions) * 100
    : 0;
  const barWidth = maxLeads > 0 ? (creative.leads / maxLeads) * 100 : 0;

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md',
      variant === 'top' ? 'border-emerald-500/30 hover:border-emerald-500/60' : 'border-red-500/20 hover:border-red-500/40'
    )}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        <Thumbnail url={creative.thumbnailUrl} name={creative.name} />
        <div className="absolute top-2 left-2">
          <span className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            variant === 'top' ? 'bg-emerald-500 text-white' : 'bg-red-500/80 text-white'
          )}>
            {rank}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant={creative.status === 'ACTIVE' ? 'success' : 'secondary'}>
            {creative.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground truncate" title={creative.name}>
            {creative.headline || creative.name}
          </p>
          <p className="text-[11px] text-muted-foreground truncate" title={creative.campaignName}>
            {creative.campaignName}
          </p>
        </div>

        {/* Registros — métrica principal */}
        <div className={cn(
          'rounded-lg px-3 py-2',
          variant === 'top' ? 'bg-emerald-500/10' : 'bg-red-500/10'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ClipboardList className={cn('h-3.5 w-3.5', variant === 'top' ? 'text-emerald-400' : 'text-red-400')} />
              <span className="text-xs text-muted-foreground">Registros concluídos</span>
            </div>
            <span className={cn('text-base font-bold', variant === 'top' ? 'text-emerald-400' : 'text-red-400')}>
              {formatNumber(creative.leads)}
            </span>
          </div>
          {/* Barra de progresso relativa */}
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', variant === 'top' ? 'bg-emerald-500' : 'bg-red-500')}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Métricas secundárias */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <MousePointerClick className="h-3 w-3 text-blue-400" /> CTR
            </span>
            <span className="font-medium text-foreground">{formatPercent(creative.ctr)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Eye className="h-3 w-3 text-cyan-400" /> Impressões
            </span>
            <span className="font-medium text-foreground">{formatNumber(creative.impressions)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3 w-3 text-amber-400" /> CPR
            </span>
            <span className="font-medium text-foreground">
              {creative.cpr > 0 ? formatCurrency(creative.cpr, currency) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3 w-3 text-muted-foreground" /> Gasto
            </span>
            <span className="font-medium text-foreground">{formatCurrency(creative.spend, currency)}</span>
          </div>
        </div>

        {/* Taxa de conversão */}
        {creative.impressions > 0 && (
          <div className="pt-1 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Taxa de conversão</span>
            <span className="font-medium text-foreground">{conversionRate.toFixed(3)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Creatives() {
  const { activeProfile } = useAuthStore();
  const [days, setDays] = useState(30);

  const from = subDays(new Date(), days).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data: creatives = [], isLoading, refetch, isFetching } = useQuery<Creative[]>({
    queryKey: ['creatives', activeProfile?.id, from, to],
    queryFn: () =>
      api.get(`/creatives/profile/${activeProfile!.id}`, { params: { from, to } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  const { sorted, topCreatives, bottomCreatives, totalLeads, totalSpend } = useMemo(() => {
    const sorted = [...creatives].sort((a, b) => b.leads - a.leads);
    const withLeads = sorted.filter(c => c.leads > 0);
    const topCreatives = withLeads.slice(0, 6);
    // Bottom: com pelo menos 1 impressão mas menos registros (excluindo os do top)
    const bottomCreatives = [...sorted]
      .reverse()
      .filter(c => c.impressions > 0)
      .filter(c => !topCreatives.find(t => t.id === c.id))
      .slice(0, 6);
    const totalLeads = creatives.reduce((s, c) => s + c.leads, 0);
    const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
    return { sorted, topCreatives, bottomCreatives, totalLeads, totalSpend };
  }, [creatives]);

  const maxLeads = sorted[0]?.leads ?? 1;

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Criativos</h1>
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
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPIs resumo */}
      {!isLoading && creatives.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total de criativos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{creatives.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs text-muted-foreground">Total de registros</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatNumber(totalLeads)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-xs text-muted-foreground">Gasto total</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(totalSpend, activeProfile.currency)}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border gap-2">
          <p className="text-sm text-muted-foreground">Nenhum criativo encontrado para o período.</p>
          <p className="text-xs text-muted-foreground/60">Sincronize a integração Meta Ads para carregar os dados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Melhores criativos */}
          {topCreatives.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-foreground">Melhores criativos</h2>
                <span className="text-xs text-muted-foreground">— mais registros concluídos</span>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {topCreatives.map((c, i) => (
                  <CreativeCard
                    key={c.id}
                    creative={c}
                    rank={i + 1}
                    currency={activeProfile.currency}
                    maxLeads={maxLeads}
                    variant="top"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Piores criativos */}
          {bottomCreatives.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <h2 className="text-base font-semibold text-foreground">Criativos com menos conversão</h2>
                <span className="text-xs text-muted-foreground">— menor número de registros</span>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {bottomCreatives.map((c, i) => (
                  <CreativeCard
                    key={c.id}
                    creative={c}
                    rank={i + 1}
                    currency={activeProfile.currency}
                    maxLeads={maxLeads}
                    variant="bottom"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sem dados de conversão */}
          {topCreatives.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border gap-2">
              <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum registro concluído encontrado no período.</p>
              <p className="text-xs text-muted-foreground/60">Sincronize novamente após o próximo ciclo de dados da Meta.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
