import { useState } from 'react';
import { ChevronDown, ChevronRight, Pause, Play } from 'lucide-react';
import { Campaign } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber, formatPercent, formatROAS } from '@/lib/utils';
import { MiniFunnel } from './MiniFunnel';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  campaigns: Campaign[];
  currency?: string;
  from: string;
  to: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    ACTIVE: { label: 'Ativo', variant: 'success' },
    PAUSED: { label: 'Pausado', variant: 'warning' },
    DELETED: { label: 'Deletado', variant: 'destructive' },
    ARCHIVED: { label: 'Arquivado', variant: 'secondary' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={variant}>{label}</Badge>;
}

function CampaignRow({ campaign, currency, from, to }: { campaign: Campaign; currency: string; from: string; to: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data: funnel } = useQuery({
    queryKey: ['funnel', campaign.id, from, to],
    queryFn: () => api.get(`/campaigns/${campaign.id}/funnel`, { params: { from, to } }).then(r => r.data),
    enabled: expanded,
  });

  return (
    <>
      <tr className="border-b border-border hover:bg-accent/30 transition-colors">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 text-left"
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground max-w-[200px] truncate" title={campaign.name}>
              {campaign.name}
            </span>
          </button>
        </td>
        <td className="px-4 py-3"><StatusBadge status={campaign.status} /></td>
        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
          {campaign.dailyBudget ? formatCurrency(campaign.dailyBudget, currency) : '—'}
        </td>
        <td className="px-4 py-3 text-right text-sm">{formatCurrency(campaign.spend, currency)}</td>
        <td className="px-4 py-3 text-right text-sm">{formatPercent(campaign.ctr)}</td>
        <td className="px-4 py-3 text-right text-sm">{formatCurrency(campaign.cpm, currency)}</td>
        <td className="px-4 py-3 text-right text-sm">{formatNumber(campaign.purchases)}</td>
        <td className="px-4 py-3 text-right text-sm">{formatCurrency(campaign.cpa, currency)}</td>
        <td className="px-4 py-3 text-right">
          <span className={cn('text-sm font-semibold',
            campaign.roas >= 2 ? 'text-emerald-400' : campaign.roas >= 1 ? 'text-amber-400' : 'text-red-400')}>
            {formatROAS(campaign.roas)}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-accent/10">
          <td colSpan={9} className="px-8 py-3">
            {funnel ? (
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground font-medium">Mini Funil:</span>
                <MiniFunnel funnel={funnel} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Carregando funil...</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function CampaignTable({ campaigns, currency = 'BRL', from, to }: Props) {
  const headers = [
    { label: 'Campanha', align: 'left' },
    { label: 'Status', align: 'left' },
    { label: 'Orçamento/dia', align: 'right' },
    { label: 'Gasto', align: 'right' },
    { label: 'CTR', align: 'right' },
    { label: 'CPM', align: 'right' },
    { label: 'Vendas', align: 'right' },
    { label: 'CPA', align: 'right' },
    { label: 'ROAS', align: 'right' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {headers.map(h => (
              <th
                key={h.label}
                className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                  h.align === 'right' ? 'text-right' : 'text-left')}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                Nenhuma campanha encontrada para o período selecionado.
              </td>
            </tr>
          ) : (
            campaigns.map(c => (
              <CampaignRow key={c.id} campaign={c} currency={currency} from={from} to={to} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
