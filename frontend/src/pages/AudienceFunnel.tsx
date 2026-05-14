import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Flame, Wind, Snowflake, MapPin, Users, Calendar,
  ChevronDown, ChevronRight, Tag, Target, TrendingUp,
  DollarSign, MousePointer, RefreshCw,
  HelpCircle, Code2, Smartphone, Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

interface TempBucket {
  spend: number; clicks: number; impressions: number;
  leads: number; purchases: number; revenue: number;
  ctr: number; cpl: number; roas: number; count: number;
}

interface DemoBucket {
  impressions: number; clicks: number; spend: number; leads: number; reach: number;
}

interface Segmentation {
  ageMin: number | null; ageMax: number | null;
  genders: string[]; countries: string[]; regions: string[]; cities: string[];
  interests: string[]; behaviors: string[]; customAudiences: string[];
  lookalikes: string[]; exclusions: string[];
}

interface AdSetDetail {
  id: string; name: string; status: string; campaignName: string;
  temp: 'hot' | 'warm' | 'cold';
  segmentation: Segmentation | null;
  spend: number; clicks: number; impressions: number; leads: number;
  ctr: number; cpl: number; roas: number;
}

interface SiteTrackingBucket {
  pageviews: number;
  leads: number;
  purchases: number;
  custom: number;
  revenue: number;
  visitsApprox: number;
  devices: { mobile: number; desktop: number; unknown: number };
  topUtmSources: { key: string; count: number }[];
  topUtmMediums: { key: string; count: number }[];
  topUtmCampaigns: { key: string; count: number }[];
}

interface SiteTrackingByTemp {
  hot: SiteTrackingBucket;
  warm: SiteTrackingBucket;
  cold: SiteTrackingBucket;
  unknown: SiteTrackingBucket;
}

interface FunnelData {
  byTemp: { hot: TempBucket; warm: TempBucket; cold: TempBucket };
  byAge: ({ age: string } & DemoBucket)[];
  byGender: ({ gender: string } & DemoBucket)[];
  byRegion: { name: string; impressions: number; clicks: number; spend: number; leads: number }[];
  adSets: AdSetDetail[];
  error?: string;
  siteTrackingByTemp?: SiteTrackingByTemp;
}

// ─── Helpers ──────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-zinc-800">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

// ─── Temperatura card ─────────────────────────────────────────

const TEMP_CFG = {
  hot: {
    label: 'Quente',
    sublabel: 'Retargeting — públicos personalizados',
    Icon: Flame,
    iconCls: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    bar: 'bg-red-500',
    badge: 'bg-red-500/20 text-red-400',
  },
  warm: {
    label: 'Morno',
    sublabel: 'Lookalike — públicos semelhantes',
    Icon: Wind,
    iconCls: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    bar: 'bg-amber-500',
    badge: 'bg-amber-500/20 text-amber-400',
  },
  cold: {
    label: 'Frio',
    sublabel: 'Prospecção — interesses / amplo',
    Icon: Snowflake,
    iconCls: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    bar: 'bg-blue-500',
    badge: 'bg-blue-500/20 text-blue-400',
  },
};

function TempCard({ bucket, type, totalSpend }: {
  bucket: TempBucket; type: 'hot' | 'warm' | 'cold'; totalSpend: number;
}) {
  const cfg = TEMP_CFG[type];
  const Icon = cfg.Icon;
  const spendPct = totalSpend > 0 ? (bucket.spend / totalSpend) * 100 : 0;
  const hasData = bucket.impressions > 0 || bucket.spend > 0;

  return (
    <div className={`rounded-xl border p-5 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${cfg.iconCls}`} />
        <div>
          <p className="text-sm font-semibold text-zinc-100">{cfg.label}</p>
          <p className="text-xs text-zinc-500">{cfg.sublabel}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
          {bucket.count} conjunto{bucket.count !== 1 ? 's' : ''}
        </span>
      </div>

      {!hasData ? (
        <p className="text-xs text-zinc-600 py-2">Sem dados para este período</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Kpi label="Gasto" value={`R$${bucket.spend.toFixed(2)}`} />
            <Kpi label="Leads" value={String(bucket.leads)} sub={bucket.cpl > 0 ? `CPL R$${bucket.cpl.toFixed(2)}` : undefined} />
            <Kpi label="CTR" value={`${bucket.ctr.toFixed(2)}%`} sub={`${bucket.impressions.toLocaleString()} imp.`} />
          </div>
          {bucket.roas > 0 && (
            <p className="text-xs text-zinc-500 mb-2">
              ROAS <span className={bucket.roas >= 2 ? 'text-emerald-400' : 'text-zinc-300'}>{bucket.roas.toFixed(2)}x</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <Bar pct={spendPct} color={cfg.bar} />
            <span className="text-xs text-zinc-500 w-10 text-right">{spendPct.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-zinc-600 mt-1">participação no gasto</p>
        </>
      )}
    </div>
  );
}

// ─── AdSet segmentation card ──────────────────────────────────

function AdSetCard({ as }: { as: AdSetDetail }) {
  const [open, setOpen] = useState(false);
  const cfg = TEMP_CFG[as.temp];
  const Icon = cfg.Icon;
  const s = as.segmentation;

  return (
    <div className={`rounded-lg border ${cfg.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
               : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />}
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.iconCls}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-200 truncate">{as.name}</p>
          <p className="text-[10px] text-zinc-500 truncate">{as.campaignName}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400 flex-shrink-0">
          <span>Leads <span className="text-zinc-200">{as.leads}</span></span>
          <span>CPL <span className="text-zinc-200">{as.cpl > 0 ? `R$${as.cpl.toFixed(2)}` : '—'}</span></span>
          <span>CTR <span className="text-zinc-200">{as.ctr.toFixed(1)}%</span></span>
          <span>Gasto <span className="text-zinc-200">R${as.spend.toFixed(2)}</span></span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          {!s ? (
            <p className="text-xs text-zinc-600">Segmentação não disponível — sincronize novamente.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Público-alvo */}
              <div className="space-y-3">
                {(s.ageMin || s.ageMax) && (
                  <SegRow icon={<Calendar className="w-3.5 h-3.5" />} label="Idade">
                    {s.ageMin && s.ageMax ? `${s.ageMin}–${s.ageMax} anos` : s.ageMin ? `${s.ageMin}+ anos` : `Até ${s.ageMax} anos`}
                  </SegRow>
                )}
                {s.genders.length > 0 && (
                  <SegRow icon={<Users className="w-3.5 h-3.5" />} label="Gênero">
                    {s.genders.join(' · ')}
                  </SegRow>
                )}
                {(s.regions.length > 0 || s.cities.length > 0 || s.countries.length > 0) && (
                  <SegRow icon={<MapPin className="w-3.5 h-3.5" />} label="Localização">
                    {[...s.countries, ...s.regions, ...s.cities].join(', ')}
                  </SegRow>
                )}
              </div>

              {/* Interesses e públicos */}
              <div className="space-y-3">
                {s.customAudiences.length > 0 && (
                  <SegRow icon={<Flame className="w-3.5 h-3.5 text-red-400" />} label="Públicos personalizados">
                    <TagList items={s.customAudiences} color="bg-red-500/10 text-red-300" />
                  </SegRow>
                )}
                {s.lookalikes.length > 0 && (
                  <SegRow icon={<Target className="w-3.5 h-3.5 text-amber-400" />} label="Lookalike">
                    <TagList items={s.lookalikes} color="bg-amber-500/10 text-amber-300" />
                  </SegRow>
                )}
                {s.interests.length > 0 && (
                  <SegRow icon={<Tag className="w-3.5 h-3.5 text-blue-400" />} label="Interesses">
                    <TagList items={s.interests} color="bg-blue-500/10 text-blue-300" />
                  </SegRow>
                )}
                {s.behaviors.length > 0 && (
                  <SegRow icon={<TrendingUp className="w-3.5 h-3.5 text-purple-400" />} label="Comportamentos">
                    <TagList items={s.behaviors} color="bg-purple-500/10 text-purple-300" />
                  </SegRow>
                )}
                {s.exclusions.length > 0 && (
                  <SegRow icon={<Users className="w-3.5 h-3.5 text-zinc-400" />} label="Exclusões">
                    <TagList items={s.exclusions} color="bg-zinc-700 text-zinc-400" />
                  </SegRow>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SegRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-zinc-500 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
        <div className="text-xs text-zinc-300">{children}</div>
      </div>
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {items.slice(0, 8).map((item, i) => (
        <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>{item}</span>
      ))}
      {items.length > 8 && (
        <span className="px-1.5 py-0.5 rounded text-[10px] text-zinc-500">+{items.length - 8}</span>
      )}
    </div>
  );
}

// ─── Rastreamento do site × temperatura ───────────────────────

const SITE_TRACKING_TEMP_KEYS = ['hot', 'warm', 'cold', 'unknown'] as const;

const SITE_TRACKING_TEMP_UI: Record<
  typeof SITE_TRACKING_TEMP_KEYS[number],
  { label: string; sublabel: string; Icon: typeof Flame; iconCls: string; border: string; bg: string }
> = {
  hot: {
    label: TEMP_CFG.hot.label,
    sublabel: 'Eventos atribuídos a conjuntos quentes',
    Icon: Flame,
    iconCls: TEMP_CFG.hot.iconCls,
    border: 'border-red-500/25',
    bg: 'bg-red-500/[0.03]',
  },
  warm: {
    label: TEMP_CFG.warm.label,
    sublabel: 'Eventos atribuídos a conjuntos mornos',
    Icon: Wind,
    iconCls: TEMP_CFG.warm.iconCls,
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/[0.03]',
  },
  cold: {
    label: TEMP_CFG.cold.label,
    sublabel: 'Eventos atribuídos a conjuntos frios',
    Icon: Snowflake,
    iconCls: TEMP_CFG.cold.iconCls,
    border: 'border-blue-500/25',
    bg: 'bg-blue-500/[0.03]',
  },
  unknown: {
    label: 'Não atribuído',
    sublabel: 'Sem vínculo creative_id/adset_id com conjuntos ORUS (ex.: orgânico)',
    Icon: HelpCircle,
    iconCls: 'text-zinc-400',
    border: 'border-zinc-600/50',
    bg: 'bg-zinc-800/30',
  },
};

function TopPairs({ label, items }: { label: string; items: { key: string; count: number }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <ul className="space-y-0.5">
        {items.map((row, i) => (
          <li key={i} className="flex justify-between gap-2 text-[11px] text-zinc-400">
            <span className="truncate text-zinc-300" title={row.key}>{row.key}</span>
            <span className="flex-shrink-0 tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteTrackingBucketPanel({
  temp,
  bucket,
}: {
  temp: typeof SITE_TRACKING_TEMP_KEYS[number];
  bucket: SiteTrackingBucket;
}) {
  const cfg = SITE_TRACKING_TEMP_UI[temp];
  const Icon = cfg.Icon;
  const has = bucket.pageviews + bucket.leads + bucket.purchases + bucket.custom > 0;

  return (
    <div className={`rounded-xl border p-4 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start gap-2 mb-3">
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.iconCls}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-200">{cfg.label}</p>
          <p className="text-[10px] text-zinc-500 leading-snug">{cfg.sublabel}</p>
        </div>
      </div>

      {!has ? (
        <p className="text-[11px] text-zinc-600 py-1">Sem eventos do script neste período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] mb-3">
            <div>
              <p className="text-zinc-500">Visitantes (~)</p>
              <p className="text-sm font-semibold text-zinc-100">{bucket.visitsApprox}</p>
            </div>
            <div>
              <p className="text-zinc-500">Visitas</p>
              <p className="text-sm font-semibold text-zinc-100">{bucket.pageviews}</p>
            </div>
            <div>
              <p className="text-zinc-500">Cadastros</p>
              <p className="text-sm font-semibold text-cyan-400">{bucket.leads}</p>
            </div>
            <div>
              <p className="text-zinc-500">Vendas</p>
              <p className="text-sm font-semibold text-violet-400">{bucket.purchases}</p>
            </div>
            {bucket.custom > 0 && (
              <div className="col-span-2">
                <p className="text-zinc-500">Personalizados</p>
                <p className="text-sm font-semibold text-amber-400/90">{bucket.custom}</p>
              </div>
            )}
            {bucket.revenue > 0 && (
              <div className="col-span-2 flex items-center gap-1.5 text-emerald-400">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">R${bucket.revenue.toFixed(2)}</span>
                <span className="text-[10px] text-zinc-500">faturamento rastreado</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 mb-3 pb-3 border-b border-zinc-800/80">
            <span className="inline-flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> {bucket.devices.mobile} mob
            </span>
            <span className="inline-flex items-center gap-1">
              <Monitor className="w-3 h-3" /> {bucket.devices.desktop} desk
            </span>
            {bucket.devices.unknown > 0 && (
              <span className="text-zinc-600">· {bucket.devices.unknown} s/ UA</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <TopPairs label="utm_source" items={bucket.topUtmSources} />
            <TopPairs label="utm_medium" items={bucket.topUtmMediums} />
            <TopPairs label="utm_campaign" items={bucket.topUtmCampaigns} />
          </div>
        </>
      )}
    </div>
  );
}

function SiteTrackingByAudienceSection({ st }: { st: SiteTrackingByTemp | undefined }) {
  if (!st) return null;

  return (
    <section className="rounded-xl border border-emerald-500/20 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Code2 className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-zinc-200 tracking-wide">
          Rastreamento do site (script ORUS)
        </h2>
      </div>
      <p className="text-[11px] text-zinc-500 mb-4 max-w-3xl">
        Eventos capturados pelo script na landing, distribuídos pela{' '}
        <strong className="text-zinc-400">mesma lógica de temperatura</strong> dos conjuntos Meta sincronizados
        (parâmetros <code className="text-zinc-400">creative_id</code> / <code className="text-zinc-400">adset_id</code>
        {' '}→ criativo ou conjunto ORUS → segmentação).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {SITE_TRACKING_TEMP_KEYS.map(k => (
          <SiteTrackingBucketPanel key={k} temp={k} bucket={st[k]} />
        ))}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────

export function AudienceFunnel() {
  const { activeProfile } = useAuthStore();
  const [days, setDays] = useState(30);

  const from = subDays(new Date(), days).toISOString().split('T')[0];
  const to   = new Date().toISOString().split('T')[0];

  const { data, isLoading, refetch, isFetching } = useQuery<FunnelData>({
    queryKey: ['audience-funnel', activeProfile?.id, from, to],
    queryFn: () =>
      api.get(`/audience-funnel/profile/${activeProfile!.id}`, { params: { from, to } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil para ver o funil de público.</p>
      </div>
    );
  }

  const totalSpend = data
    ? data.byTemp.hot.spend + data.byTemp.warm.spend + data.byTemp.cold.spend
    : 0;

  const maxAge    = Math.max(...(data?.byAge.map(a => a.leads) ?? [1]), 1);
  const maxRegion = Math.max(...(data?.byRegion.map(r => r.leads) ?? [1]), 1);
  const totalGenderLeads = data?.byGender.reduce((s, g) => s + g.leads, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Funil de Público</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Análise de audiência por temperatura, demografia e segmentação</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={cn('px-3 py-1.5 text-xs transition-colors', days === opt.days
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200')}
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

      {data?.error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {data.error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-40 rounded-xl bg-zinc-800/50 animate-pulse" />
          <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
        </div>
      ) : (
        <>
          {/* ── Temperatura ─────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Temperatura do Público
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['hot', 'warm', 'cold'] as const).map(t => (
                <TempCard
                  key={t}
                  type={t}
                  bucket={data?.byTemp[t] ?? { spend: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, revenue: 0, ctr: 0, cpl: 0, roas: 0, count: 0 }}
                  totalSpend={totalSpend}
                />
              ))}
            </div>
          </section>

          {/* ── Idade + Gênero ───────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Idade */}
            <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Faixa Etária</h2>
              </div>
              {!data?.byAge.length ? (
                <p className="text-xs text-zinc-600">Dados não disponíveis</p>
              ) : (
                <div className="space-y-3">
                  {data.byAge.map(row => (
                    <div key={row.age}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-300 font-medium">{row.age}</span>
                        <div className="flex gap-4 text-zinc-500">
                          <span>{row.leads} leads</span>
                          <span>R${row.spend.toFixed(0)}</span>
                          <span className="text-zinc-300 w-20 text-right">
                            {row.impressions.toLocaleString()} imp.
                          </span>
                        </div>
                      </div>
                      <Bar pct={(row.leads / maxAge) * 100} color="bg-indigo-500" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Gênero */}
            <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Gênero</h2>
              </div>
              {!data?.byGender.length ? (
                <p className="text-xs text-zinc-600">Dados não disponíveis</p>
              ) : (
                <div className="space-y-4">
                  {data.byGender.map((row, i) => {
                    const pct = totalGenderLeads > 0 ? (row.leads / totalGenderLeads) * 100 : 0;
                    const colors = ['bg-pink-500', 'bg-blue-500', 'bg-zinc-500'];
                    return (
                      <div key={row.gender}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-200 font-medium">{row.gender}</span>
                          <span className="text-zinc-400">{pct.toFixed(1)}% · {row.leads} leads · R${row.spend.toFixed(0)}</span>
                        </div>
                        <Bar pct={pct} color={colors[i] ?? 'bg-zinc-500'} />
                        <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                          <span>{row.impressions.toLocaleString()} impressões</span>
                          <span>CTR {row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(2) : 0}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ── Região ──────────────────────────────────── */}
          <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-200">Top Regiões</h2>
            </div>
            {!data?.byRegion.length ? (
              <p className="text-xs text-zinc-600">Dados não disponíveis</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {data.byRegion.map((row, i) => (
                  <div key={row.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-600 w-5 text-right">{i + 1}</span>
                        <span className="text-zinc-200 font-medium">{row.name}</span>
                      </div>
                      <div className="flex gap-3 text-zinc-500">
                        <span><span className="text-zinc-300">{row.leads}</span> leads</span>
                        <span>R$<span className="text-zinc-300">{row.spend.toFixed(0)}</span></span>
                      </div>
                    </div>
                    <Bar pct={(row.leads / maxRegion) * 100} color="bg-emerald-500" />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Segmentações detalhadas ──────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Segmentações Detalhadas
              </h2>
              <span className="text-xs text-zinc-600">{data?.adSets.length ?? 0} conjuntos</span>
            </div>
            {!data?.adSets.length ? (
              <p className="text-xs text-zinc-600">Nenhum conjunto com dados no período.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.adSets.map(as => <AdSetCard key={as.id} as={as} />)}
              </div>
            )}
          </section>

          <SiteTrackingByAudienceSection st={data?.siteTrackingByTemp} />
        </>
      )}
    </div>
  );
}
