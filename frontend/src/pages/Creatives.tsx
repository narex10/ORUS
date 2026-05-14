import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import {
  TrendingUp, TrendingDown, MousePointerClick, ClipboardList,
  Eye, DollarSign, RefreshCw, Image, MessageSquare, ShoppingCart,
  Instagram, Video, Zap, AlertTriangle, ChevronDown, ChevronUp, ThumbsUp,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// ─── Tipos ───────────────────────────────────────────────────

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
  pageViews: number;
  messages: number;
  instagramVisits: number;
  fanpageEngagement: number;
  videoViews: number;
  leads: number;
  purchases: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpm: number;
  roas: number;
  cprLeads: number;
  cprMessages: number;
  cprPageViews: number;
  cprPurchases: number;
}

type ConversionKey = 'leads' | 'messages' | 'pageViews' | 'purchases' | 'instagramVisits' | 'fanpageEngagement';

interface ConversionOption {
  id: ConversionKey;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  cprKey: keyof Creative;
  extraMetric?: { key: keyof Creative; label: string; icon: React.ElementType };
}

const CONVERSION_OPTIONS: ConversionOption[] = [
  {
    id: 'leads',
    label: 'Registros concluídos',
    icon: ClipboardList,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    cprKey: 'cprLeads',
  },
  {
    id: 'messages',
    label: 'Conversas WhatsApp',
    icon: MessageSquare,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    cprKey: 'cprMessages',
    extraMetric: { key: 'pageViews', label: 'Visitas ao site', icon: Eye },
  },
  {
    id: 'pageViews',
    label: 'Visitas ao site',
    icon: Eye,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    cprKey: 'cprPageViews',
  },
  {
    id: 'purchases',
    label: 'Compras',
    icon: ShoppingCart,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    cprKey: 'cprPurchases',
  },
  {
    id: 'instagramVisits',
    // Ativo apenas para campanhas com objetivo "Visitas ao perfil do Instagram"
    label: 'Visitas ao Instagram',
    icon: Instagram,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    cprKey: 'cprLeads',
  },
  {
    id: 'fanpageEngagement',
    // page_engagement: agrupado Meta — reações, comentários, compartilhamentos, visitas à Fanpage
    label: 'Engajamento na Fanpage',
    icon: ThumbsUp,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    cprKey: 'cprLeads',
  },
];

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

// ─── Helpers ─────────────────────────────────────────────────

function useStoredConversion(profileId: string | undefined): [ConversionKey, (k: ConversionKey) => void] {
  const key = `orus_conv_${profileId}`;
  const [val, setVal] = useState<ConversionKey>(() => {
    try { return (localStorage.getItem(key) as ConversionKey) || 'leads'; } catch { return 'leads'; }
  });
  function set(v: ConversionKey) {
    setVal(v);
    try { localStorage.setItem(key, v); } catch {}
  }
  return [val, set];
}

function getScaleSuggestion(c: Creative, opt: ConversionOption, avgCPR: number, avgCTR: number): {
  type: 'scale' | 'warning' | 'creative';
  text: string;
} | null {
  const conv = c[opt.id] as number;
  const cpr = c[opt.cprKey] as number;

  if (conv >= 2 && cpr > 0 && avgCPR > 0 && cpr < avgCPR * 0.75) {
    const pct = Math.round((1 - cpr / avgCPR) * 100);
    return { type: 'scale', text: `${pct}% abaixo do CPR médio — candidato a escala de orçamento` };
  }
  if (c.ctr > avgCTR * 1.5 && conv === 0 && c.impressions > 500) {
    return { type: 'warning', text: 'CTR alto mas sem conversão — revisar landing page ou oferta' };
  }
  if (c.ctr < avgCTR * 0.4 && c.impressions > 500) {
    return { type: 'creative', text: 'CTR baixo — testar novo criativo ou copy' };
  }
  if (conv >= 5 && c.roas > 1.5) {
    return { type: 'scale', text: `ROAS ${c.roas.toFixed(1)}x com ${conv} conversões — aumentar orçamento` };
  }
  return null;
}

// ─── Sub-componentes ─────────────────────────────────────────

function Thumbnail({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt={name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
  return <div className="flex flex-col items-center justify-center w-full h-full gap-1 text-muted-foreground"><Image className="h-6 w-6 opacity-20" /><span className="text-[10px] opacity-40">Preview</span></div>;
}

function ScaleBadge({ suggestion }: { suggestion: { type: string; text: string } }) {
  const styles = {
    scale:    'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    warning:  'border-amber-500/40 bg-amber-500/10 text-amber-400',
    creative: 'border-red-500/40 bg-red-500/10 text-red-400',
  }[suggestion.type] ?? '';
  const icons = { scale: TrendingUp, warning: AlertTriangle, creative: Zap };
  const Icon = icons[suggestion.type as keyof typeof icons] ?? Zap;
  return (
    <div className={cn('flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[10px]', styles)}>
      <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" />
      <span>{suggestion.text}</span>
    </div>
  );
}

function CreativeCard({
  creative, rank, currency, opt, maxConv, avgCPR, avgCTR, variant,
}: {
  creative: Creative; rank: number; currency: string;
  opt: ConversionOption; maxConv: number;
  avgCPR: number; avgCTR: number;
  variant: 'top' | 'bottom';
}) {
  const [expanded, setExpanded] = useState(false);
  const conv = creative[opt.id] as number;
  const cpr  = creative[opt.cprKey] as number;
  const barWidth = maxConv > 0 ? (conv / maxConv) * 100 : 0;
  const convRate = creative.clicks > 0 ? (conv / creative.clicks) * 100 : 0;
  const suggestion = getScaleSuggestion(creative, opt, avgCPR, avgCTR);

  const borderClass = variant === 'top'
    ? 'border-emerald-500/30 hover:border-emerald-500/60'
    : 'border-red-500/20 hover:border-red-500/40';

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md', borderClass)}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        <Thumbnail url={creative.thumbnailUrl} name={creative.name} />
        <div className="absolute top-2 left-2">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            variant === 'top' ? 'bg-emerald-500 text-white' : 'bg-red-500/80 text-white')}>
            {rank}
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant={creative.status === 'ACTIVE' ? 'success' : 'secondary'}>
            {creative.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
          </Badge>
        </div>
        {creative.videoViews > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5">
            <Video className="h-2.5 w-2.5 text-white" />
            <span className="text-[10px] text-white">{formatNumber(creative.videoViews)}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        <div>
          <p className="text-sm font-semibold text-foreground truncate" title={creative.name}>
            {creative.headline || creative.name}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{creative.campaignName}</p>
        </div>

        {/* Conversão principal */}
        <div className={cn('rounded-lg px-3 py-2', variant === 'top' ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <opt.icon className={cn('h-3.5 w-3.5', variant === 'top' ? opt.color : 'text-red-400')} />
              <span className="text-xs text-muted-foreground">{opt.label}</span>
            </div>
            <span className={cn('text-base font-bold', variant === 'top' ? opt.color : 'text-red-400')}>
              {formatNumber(conv)}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', variant === 'top' ? 'bg-emerald-500' : 'bg-red-500')}
              style={{ width: `${barWidth}%` }} />
          </div>
        </div>

        {/* Métricas WhatsApp extra */}
        {opt.extraMetric && (
          <div className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <opt.extraMetric.icon className="h-3 w-3" />
              {opt.extraMetric.label}
            </div>
            <span className="text-xs font-medium text-foreground">
              {formatNumber(creative[opt.extraMetric.key] as number)}
            </span>
          </div>
        )}

        {/* Métricas secundárias */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <MousePointerClick className="h-3 w-3 text-blue-400" /> CTR
            </span>
            <span className="font-medium">{formatPercent(creative.ctr)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Eye className="h-3 w-3 text-muted-foreground" /> Impressões
            </span>
            <span className="font-medium">{formatNumber(creative.impressions)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3 w-3 text-amber-400" /> CPR
            </span>
            <span className="font-medium">{cpr > 0 ? formatCurrency(cpr, currency) : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="h-3 w-3 text-muted-foreground" /> Gasto
            </span>
            <span className="font-medium">{formatCurrency(creative.spend, currency)}</span>
          </div>
        </div>

        {/* Taxa de conversão */}
        <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs">
          <span className="text-muted-foreground">Taxa de conversão</span>
          <span className="font-semibold text-foreground">{convRate.toFixed(3)}%</span>
        </div>

        {/* Sugestão de escala */}
        {suggestion && <ScaleBadge suggestion={suggestion} />}

        {/* Expandir métricas completas */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-0.5"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Menos métricas' : 'Todas as métricas'}
        </button>

        {expanded && (
          <div className="border-t border-border pt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {[
              { label: 'Cliques', value: formatNumber(creative.clicks) },
              { label: 'Visitas ao site', value: formatNumber(creative.pageViews) },
              { label: 'Conversas WhatsApp', value: formatNumber(creative.messages) },
              { label: 'Visitas Instagram', value: formatNumber(creative.instagramVisits) },
              { label: 'Engaj. Fanpage', value: formatNumber(creative.fanpageEngagement) },
              { label: 'Visualiz. vídeo', value: formatNumber(creative.videoViews) },
              { label: 'Compras', value: formatNumber(creative.purchases) },
              { label: 'CPM', value: formatCurrency(creative.cpm, currency) },
              { label: 'ROAS', value: creative.roas > 0 ? `${creative.roas.toFixed(1)}x` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alerta de melhores criativos ─────────────────────────────

function ScaleAlert({ creatives, opt, currency }: { creatives: Creative[]; opt: ConversionOption; currency: string }) {
  const top = creatives
    .filter(c => (c[opt.id] as number) >= 2)
    .sort((a, b) => (a[opt.cprKey] as number) - (b[opt.cprKey] as number))
    .slice(0, 3);

  if (top.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-400">Candidatos a escala</p>
        <span className="text-xs text-muted-foreground">— melhores CPR com conversões confirmadas</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {top.map((c, i) => {
          const conv = c[opt.id] as number;
          const cpr = c[opt.cprKey] as number;
          return (
            <div key={c.id} className="rounded-lg border border-emerald-500/20 bg-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-xs font-medium truncate text-foreground" title={c.headline || c.name}>
                  {c.headline || c.name}
                </p>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{opt.label}</span>
                <span className="font-semibold text-emerald-400">{conv}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">CPR</span>
                <span className="font-semibold text-foreground">{cpr > 0 ? formatCurrency(cpr, currency) : '—'}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Gasto</span>
                <span className="font-medium text-foreground">{formatCurrency(c.spend, currency)}</span>
              </div>
              <p className="mt-1.5 text-[10px] text-emerald-400 font-medium">
                → Aumentar orçamento deste conjunto
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────

export function Creatives() {
  const { activeProfile } = useAuthStore();
  const [days, setDays] = useState(30);
  const [conversionKey, setConversionKey] = useStoredConversion(activeProfile?.id);

  const from = subDays(new Date(), days).toISOString().split('T')[0];
  const to   = new Date().toISOString().split('T')[0];

  const { data: creatives = [], isLoading, refetch, isFetching } = useQuery<Creative[]>({
    queryKey: ['creatives', activeProfile?.id, from, to],
    queryFn: () =>
      api.get(`/creatives/profile/${activeProfile!.id}`, { params: { from, to } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  const opt = CONVERSION_OPTIONS.find(o => o.id === conversionKey)!;

  const { sorted, topCreatives, bottomCreatives, totalConv, totalSpend, avgCPR, avgCTR } = useMemo(() => {
    const sorted = [...creatives].sort((a, b) => (b[opt.id] as number) - (a[opt.id] as number));
    const withConv = sorted.filter(c => (c[opt.id] as number) > 0);
    const topCreatives    = withConv.slice(0, 6);
    const bottomCreatives = [...sorted].reverse()
      .filter(c => c.impressions > 0)
      .filter(c => !topCreatives.find(t => t.id === c.id))
      .slice(0, 6);

    const totalConv  = creatives.reduce((s, c) => s + (c[opt.id] as number), 0);
    const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
    const cprs = creatives.map(c => c[opt.cprKey] as number).filter(v => v > 0);
    const avgCPR = cprs.length > 0 ? cprs.reduce((a, b) => a + b, 0) / cprs.length : 0;
    const avgCTR = creatives.length > 0 ? creatives.reduce((s, c) => s + c.ctr, 0) / creatives.length : 0;

    return { sorted, topCreatives, bottomCreatives, totalConv, totalSpend, avgCPR, avgCTR };
  }, [creatives, opt]);

  const maxConv = sorted[0] ? (sorted[0][opt.id] as number) : 1;
  const currency = activeProfile?.currency ?? 'BRL';

  if (!activeProfile) return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Criativos</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Período */}
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.days} onClick={() => setDays(opt.days)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  days === opt.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} disabled={isFetching}
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Seletor de conversão */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Métrica de conversão</p>
        <div className="flex flex-wrap gap-2">
          {CONVERSION_OPTIONS.map(o => (
            <button key={o.id} onClick={() => setConversionKey(o.id)}
              className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                conversionKey === o.id
                  ? `border-current ${o.color} bg-current/10`
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80')}>
              <o.icon className={cn('h-3.5 w-3.5', conversionKey === o.id ? o.color : '')} />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      {!isLoading && creatives.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Criativos</p>
            <p className="text-2xl font-bold mt-1">{creatives.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <opt.icon className={cn('h-3.5 w-3.5', opt.color)} />
              <p className="text-xs text-muted-foreground">Total conversões</p>
            </div>
            <p className={cn('text-2xl font-bold mt-1', opt.color)}>{formatNumber(totalConv)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">CPR médio</p>
            <p className="text-2xl font-bold mt-1">{avgCPR > 0 ? formatCurrency(avgCPR, currency) : '—'}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Gasto total</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalSpend, currency)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : creatives.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border gap-2">
          <p className="text-sm text-muted-foreground">Nenhum criativo encontrado.</p>
          <p className="text-xs text-muted-foreground/60">Sincronize a integração Meta Ads.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Alerta de escala */}
          <ScaleAlert creatives={creatives} opt={opt} currency={currency} />

          {/* Melhores criativos */}
          {topCreatives.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold">Melhores criativos</h2>
                <span className="text-xs text-muted-foreground">— mais {opt.label.toLowerCase()}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {topCreatives.map((c, i) => (
                  <CreativeCard key={c.id} creative={c} rank={i + 1} currency={currency}
                    opt={opt} maxConv={maxConv} avgCPR={avgCPR} avgCTR={avgCTR} variant="top" />
                ))}
              </div>
            </section>
          )}

          {/* Piores criativos */}
          {bottomCreatives.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <h2 className="text-base font-semibold">Criativos com menos conversão</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {bottomCreatives.map((c, i) => (
                  <CreativeCard key={c.id} creative={c} rank={i + 1} currency={currency}
                    opt={opt} maxConv={maxConv} avgCPR={avgCPR} avgCTR={avgCTR} variant="bottom" />
                ))}
              </div>
            </section>
          )}

          {topCreatives.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border gap-2">
              <opt.icon className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma conversão do tipo "{opt.label}" encontrada.</p>
              <p className="text-xs text-muted-foreground/60">Selecione outro tipo ou sincronize novamente.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
