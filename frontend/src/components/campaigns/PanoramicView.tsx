import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Campaign } from '../../types';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Pause, Play, Copy, ChevronDown, ChevronRight,
  DollarSign, Users, MousePointer, BarChart2, MessageCircle, Check, X, Loader2,
  AlertTriangle, Zap, Target, Edit2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface AdOverview {
  id: string; name: string; status: string;
  thumbnailUrl?: string; headline?: string;
  spend: number; clicks: number; impressions: number; leads: number; messages: number;
  ctr: number; cpl: number;
}

interface AdSetOverview {
  id: string; name: string; status: string; budget?: number;
  spend: number; clicks: number; impressions: number; leads: number; messages: number;
  ctr: number; roas: number; cpl: number;
  ads: AdOverview[];
}

// ─── Scale suggestion ─────────────────────────────────────────

type Verdict = 'scale' | 'watch' | 'pause' | null;

function getVerdict(campaign: Campaign): Verdict {
  if (campaign.spend < 10) return null;
  if (campaign.roas >= 2) return 'scale';
  if (campaign.roas >= 1 && campaign.ctr >= 1) return 'watch';
  if (campaign.roas < 0.5 && campaign.spend > 50) return 'pause';
  return null;
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (!verdict) return null;
  const cfg = {
    scale: { label: 'Escalar', icon: Zap, cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    watch: { label: 'Monitorar', icon: Target, cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    pause: { label: 'Pausar', icon: AlertTriangle, cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  }[verdict];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export type PanoramicMetric = 'leads' | 'spend' | 'roas' | 'roi' | 'pageViews' | 'messages';

const PANORAMIC_METRIC_OPTIONS: { id: PanoramicMetric; label: string }[] = [
  { id: 'leads', label: 'Leads' },
  { id: 'spend', label: 'Gasto' },
  { id: 'roas', label: 'ROAS' },
  { id: 'roi', label: 'ROI' },
  { id: 'pageViews', label: 'Visitas no site' },
  { id: 'messages', label: 'Conversas iniciadas' },
];

function getRoi(c: Campaign): number {
  if (typeof c.roi === 'number') return c.roi;
  return c.spend > 0 ? (c.revenue - c.spend) / c.spend : 0;
}

function getSortValue(c: Campaign, m: PanoramicMetric): number {
  switch (m) {
    case 'leads': return c.leads;
    case 'spend': return c.spend;
    case 'roas': return c.roas;
    case 'roi': return getRoi(c);
    case 'pageViews': return c.pageViews ?? 0;
    case 'messages': return c.messages ?? 0;
    default: return 0;
  }
}

function formatMetricChip(c: Campaign, m: PanoramicMetric): { label: string; value: string; valueCls: string } {
  switch (m) {
    case 'leads':
      return { label: 'Leads', value: String(c.leads), valueCls: 'text-zinc-200' };
    case 'spend':
      return { label: 'Gasto', value: `R$${c.spend.toFixed(2)}`, valueCls: 'text-zinc-200' };
    case 'roas':
      return {
        label: 'ROAS',
        value: `${c.roas.toFixed(2)}x`,
        valueCls: c.roas >= 2 ? 'text-emerald-400' : c.roas < 1 ? 'text-red-400' : 'text-zinc-200',
      };
    case 'roi': {
      const r = getRoi(c);
      return {
        label: 'ROI',
        value: `${(r * 100).toFixed(1)}%`,
        valueCls: r >= 0 ? 'text-emerald-400' : 'text-red-400',
      };
    }
    case 'pageViews':
      return { label: 'Visitas', value: String(c.pageViews ?? 0), valueCls: 'text-zinc-200' };
    case 'messages':
      return { label: 'Conversas', value: String(c.messages ?? 0), valueCls: 'text-zinc-200' };
  }
}

// ─── Budget inline editor ─────────────────────────────────────

function BudgetEditor({
  campaignId, current, onDone,
}: { campaignId: string; current?: number; onDone: () => void }) {
  const [value, setValue] = useState(String(current ?? ''));
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      api.post('/meta/budget', { campaignId, dailyBudget: parseFloat(value) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['panoramic'] });
      onDone();
    },
  });

  return (
    <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <span className="text-zinc-400 text-xs">R$</span>
      <input
        autoFocus
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-20 bg-zinc-700 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
        onKeyDown={e => { if (e.key === 'Enter') mut.mutate(); if (e.key === 'Escape') onDone(); }}
      />
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
      >
        {mut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button onClick={onDone} className="text-zinc-500 hover:text-zinc-300">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// ─── Criativo row ─────────────────────────────────────────────

function AdRow({ ad, avgCpl }: { ad: AdOverview; avgCpl: number }) {
  const isGood = avgCpl > 0 && ad.cpl > 0 && ad.cpl < avgCpl;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
      {ad.thumbnailUrl
        ? <img src={ad.thumbnailUrl} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />
        : <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-4 h-4 text-zinc-500" />
          </div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-200 truncate">{ad.name}</p>
        {ad.headline && <p className="text-[10px] text-zinc-500 truncate">{ad.headline}</p>}
      </div>
      <div className="flex items-center gap-4 text-xs flex-shrink-0">
        <span className="text-zinc-400">CTR <span className="text-zinc-200">{ad.ctr.toFixed(1)}%</span></span>
        <span className="text-zinc-400">Leads <span className="text-zinc-200">{ad.leads}</span></span>
        {ad.messages > 0 && (
          <span className="text-zinc-400">Msgs <span className="text-zinc-200">{ad.messages}</span></span>
        )}
        <span className="text-zinc-400">
          CPL{' '}
          <span className={isGood ? 'text-emerald-400' : ad.cpl > avgCpl * 1.5 ? 'text-red-400' : 'text-zinc-200'}>
            {ad.cpl > 0 ? `R$${ad.cpl.toFixed(2)}` : '—'}
          </span>
        </span>
        <span className="text-zinc-400">Gasto <span className="text-zinc-200">R${ad.spend.toFixed(2)}</span></span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          ad.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'
        }`}>
          {ad.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
        </span>
      </div>
    </div>
  );
}

// ─── AdSet card ───────────────────────────────────────────────

function AdSetCard({
  adSet, campaignId, from, to, profileId,
}: {
  adSet: AdSetOverview; campaignId: string; from: string; to: string; profileId: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const pauseMut = useMutation({
    mutationFn: (status: 'ACTIVE' | 'PAUSED') =>
      api.post('/meta/pause', { entityId: adSet.id, entityType: 'adset', status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adsets', campaignId, from, to, profileId] }),
  });

  const isActive = adSet.status === 'ACTIVE';
  const avgAdCpl = adSet.ads.filter(a => a.cpl > 0).reduce((s, a) => s + a.cpl, 0) /
    (adSet.ads.filter(a => a.cpl > 0).length || 1);

  return (
    <div className="ml-4 border-l border-zinc-700 pl-3">
      <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/50 overflow-hidden">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-700/30 transition-colors text-left"
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />}
          <span className="flex-1 text-xs text-zinc-200 truncate">{adSet.name}</span>
          <div className="flex items-center gap-4 text-xs text-zinc-400 flex-shrink-0">
            <span>CTR <span className="text-zinc-200">{adSet.ctr.toFixed(1)}%</span></span>
            <span>Leads <span className="text-zinc-200">{adSet.leads}</span></span>
            {adSet.messages > 0 && <span>Msgs <span className="text-zinc-200">{adSet.messages}</span></span>}
            <span>CPL <span className="text-zinc-200">{adSet.cpl > 0 ? `R$${adSet.cpl.toFixed(2)}` : '—'}</span></span>
            <span>Gasto <span className="text-zinc-200">R${adSet.spend.toFixed(2)}</span></span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); pauseMut.mutate(isActive ? 'PAUSED' : 'ACTIVE'); }}
            disabled={pauseMut.isPending}
            className={`ml-2 p-1.5 rounded transition-colors ${
              isActive ? 'text-amber-400 hover:bg-amber-500/20' : 'text-emerald-400 hover:bg-emerald-500/20'
            } disabled:opacity-40`}
            title={isActive ? 'Pausar conjunto' : 'Ativar conjunto'}
          >
            {pauseMut.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </button>

        {open && adSet.ads.length > 0 && (
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            {adSet.ads.map(ad => <AdRow key={ad.id} ad={ad} avgCpl={avgAdCpl} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Campaign card ────────────────────────────────────────────

function CampaignCard({
  campaign, profileId, from, to, sortMetric,
}: {
  campaign: Campaign; profileId: string; from: string; to: string;
  sortMetric: PanoramicMetric;
}) {
  const [open, setOpen] = useState(false);
  const [editBudget, setEditBudget] = useState(false);
  const [dupConfirm, setDupConfirm] = useState(false);
  const qc = useQueryClient();
  const verdict = getVerdict(campaign);

  const { data: adSets, isFetching: loadingAdSets } = useQuery<AdSetOverview[]>({
    queryKey: ['adsets', campaign.id, from, to, profileId],
    queryFn: () =>
      api.get(`/campaigns/${campaign.id}/adsets`, { params: { from, to } }).then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  });

  const pauseMut = useMutation({
    mutationFn: (status: 'ACTIVE' | 'PAUSED') =>
      api.post('/meta/pause', { entityId: campaign.id, entityType: 'campaign', status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['panoramic'] });
    },
  });

  const dupMut = useMutation({
    mutationFn: () => api.post('/meta/duplicate', { campaignId: campaign.id }),
    onSuccess: () => {
      setDupConfirm(false);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const isActive = campaign.status === 'ACTIVE';

  return (
    <div className={`rounded-xl border transition-colors ${
      verdict === 'scale' ? 'border-emerald-500/40 bg-emerald-500/5' :
      verdict === 'pause' ? 'border-red-500/30 bg-red-500/5' :
      'border-zinc-700/60 bg-zinc-900/60'
    }`}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left rounded-xl"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-100 truncate">{campaign.name}</span>
            <VerdictBadge verdict={verdict} />
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
            }`}>
              {isActive ? 'Ativo' : 'Pausado'}
            </span>
          </div>
        </div>

        {/* KPIs */}
        <div className="hidden md:flex items-center gap-5 text-xs text-zinc-400 flex-shrink-0 flex-wrap justify-end">
          {(() => {
            const chip = formatMetricChip(campaign, sortMetric);
            return (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-600">
                <span className="text-zinc-500">{chip.label}:</span>
                <span className={cn(chip.valueCls, 'font-semibold')}>{chip.value}</span>
              </span>
            );
          })()}
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            <span className="text-zinc-200">R${campaign.spend.toFixed(2)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span className="text-zinc-200">{campaign.leads}</span>
            <span>leads</span>
          </span>
          <span className="flex items-center gap-1">
            <MousePointer className="w-3 h-3" />
            <span className="text-zinc-200">{campaign.ctr.toFixed(1)}%</span>
            <span>CTR</span>
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3" />
            <span className={campaign.roas >= 2 ? 'text-emerald-400' : campaign.roas < 1 ? 'text-red-400' : 'text-zinc-200'}>
              {campaign.roas.toFixed(2)}x
            </span>
            <span>ROAS</span>
          </span>

          {/* Budget */}
          <span className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            {editBudget
              ? <BudgetEditor
                  campaignId={campaign.id}
                  current={campaign.dailyBudget}
                  onDone={() => setEditBudget(false)}
                />
              : <>
                  <span className="text-zinc-400">Orç.</span>
                  <span className="text-zinc-200">
                    {campaign.dailyBudget ? `R$${campaign.dailyBudget.toFixed(2)}` : '—'}
                  </span>
                  <button
                    onClick={() => setEditBudget(true)}
                    className="text-zinc-500 hover:text-blue-400 transition-colors"
                    title="Editar orçamento"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </>}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          {/* Pause/Play */}
          <button
            onClick={() => pauseMut.mutate(isActive ? 'PAUSED' : 'ACTIVE')}
            disabled={pauseMut.isPending}
            className={`p-2 rounded-lg transition-colors ${
              isActive
                ? 'text-amber-400 hover:bg-amber-500/20'
                : 'text-emerald-400 hover:bg-emerald-500/20'
            } disabled:opacity-40`}
            title={isActive ? 'Pausar campanha' : 'Ativar campanha'}
          >
            {pauseMut.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Duplicate */}
          {dupConfirm
            ? <span className="flex items-center gap-1">
                <span className="text-xs text-zinc-400">Duplicar?</span>
                <button
                  onClick={() => dupMut.mutate()}
                  disabled={dupMut.isPending}
                  className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  {dupMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setDupConfirm(false)}
                  className="p-1.5 rounded text-zinc-500 hover:bg-zinc-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            : <button
                onClick={() => setDupConfirm(true)}
                className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"
                title="Duplicar campanha (pausada)"
              >
                <Copy className="w-4 h-4" />
              </button>}
        </div>
      </button>

      {/* Ad sets */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {loadingAdSets && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Carregando conjuntos...
            </div>
          )}
          {adSets?.map(as => (
            <AdSetCard
              key={as.id}
              adSet={as}
              campaignId={campaign.id}
              from={from}
              to={to}
              profileId={profileId}
            />
          ))}
          {adSets?.length === 0 && (
            <p className="text-xs text-zinc-500 py-2 ml-4">Nenhum conjunto encontrado para este período.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

interface PanoramicViewProps {
  profileId: string;
  campaigns: Campaign[];
  from: string;
  to: string;
}

export function PanoramicView({ profileId, campaigns, from, to }: PanoramicViewProps) {
  const [sortBy, setSortBy] = useState<PanoramicMetric>('leads');
  const [showAll, setShowAll] = useState(false);

  const sorted = [...campaigns]
    .filter(c => c.status !== 'DELETED' && c.status !== 'ARCHIVED')
    .sort((a, b) => getSortValue(b, sortBy) - getSortValue(a, sortBy));

  const visible = showAll ? sorted : sorted.slice(0, 5);

  const scaleCount  = sorted.filter(c => getVerdict(c) === 'scale').length;
  const pauseCount  = sorted.filter(c => getVerdict(c) === 'pause').length;
  const totalSpend  = sorted.reduce((s, c) => s + c.spend, 0);
  const totalLeads  = sorted.reduce((s, c) => s + c.leads, 0);
  const totalRev    = sorted.reduce((s, c) => s + c.revenue, 0);
  const totalMsgs   = sorted.reduce((s, c) => s + (c.messages ?? 0), 0);
  const totalPv     = sorted.reduce((s, c) => s + (c.pageViews ?? 0), 0);

  const portfolioRoas = totalSpend > 0 ? totalRev / totalSpend : 0;
  const portfolioRoi  = totalSpend > 0 ? (totalRev - totalSpend) / totalSpend : 0;

  const metricSummary = (() => {
    switch (sortBy) {
      case 'leads':
        return `${totalLeads.toLocaleString('pt-BR')} leads`;
      case 'spend':
        return `R$${totalSpend.toFixed(2)} gastos`;
      case 'roas':
        return `ROAS consolidado ${portfolioRoas.toFixed(2)}x`;
      case 'roi':
        return `ROI consolidado ${(portfolioRoi * 100).toFixed(1)}%`;
      case 'pageViews':
        return `${totalPv.toLocaleString('pt-BR')} visitas no site (Meta)`;
      case 'messages':
        return `${totalMsgs.toLocaleString('pt-BR')} conversas iniciadas`;
      default:
        return '';
    }
  })();

  if (campaigns.length === 0) return null;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Visão Panorâmica</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {sorted.length} campanha{sorted.length !== 1 ? 's' : ''} · {metricSummary}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Alertas */}
          {scaleCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400">
              <Zap className="w-3 h-3" />
              {scaleCount} para escalar
            </span>
          )}
          {pauseCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {pauseCount} para pausar
            </span>
          )}
          </div>
          <div className="flex flex-wrap gap-1 justify-end rounded-lg border border-zinc-700 bg-zinc-900/40 p-1">
            {PANORAMIC_METRIC_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortBy(opt.id)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                  sortBy === opt.id
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {visible.map(c => (
          <CampaignCard
            key={c.id}
            campaign={c}
            profileId={profileId}
            from={from}
            to={to}
            sortMetric={sortBy}
          />
        ))}
      </div>

      {sorted.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full py-2 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
        >
          {showAll ? 'Mostrar menos' : `Ver todas as ${sorted.length} campanhas`}
        </button>
      )}
    </div>
  );
}
