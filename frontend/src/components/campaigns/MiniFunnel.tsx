import {
  MousePointerClick, Eye, ClipboardList, UserCheck,
  MessageSquare, Globe, ShoppingCart, MessageCircle, Instagram,
} from 'lucide-react';
import { CampaignFunnel, FunnelMetricId } from '@/types';
import { formatNumber } from '@/lib/utils';

// ─── Definição central de métricas disponíveis ───────────────

export const FUNNEL_METRIC_DEFS: {
  id: FunnelMetricId;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  siteOnly?: boolean;
}[] = [
  {
    id: 'clicks',
    label: 'Cliques no anúncio',
    sublabel: 'Meta Ads',
    icon: MousePointerClick,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'pageViews',
    label: 'Visualização de página',
    sublabel: 'Meta Ads',
    icon: Eye,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    id: 'leads',
    label: 'Registros concluídos',
    sublabel: 'Gerenciador',
    icon: ClipboardList,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    id: 'messages',
    label: 'Conversas iniciadas',
    sublabel: 'Meta Ads',
    icon: MessageSquare,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    id: 'instagramVisits',
    label: 'Visitas ao Instagram',
    sublabel: 'Meta Ads',
    icon: Instagram,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
  {
    id: 'realPageViews',
    label: 'Visualizações de site',
    sublabel: 'Site',
    icon: Globe,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    siteOnly: true,
  },
  {
    id: 'realLeads',
    label: 'Cadastros reais',
    sublabel: 'Site',
    icon: UserCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    siteOnly: true,
  },
  {
    id: 'realMessages',
    label: 'Conversas reais',
    sublabel: 'Site',
    icon: MessageCircle,
    color: 'text-violet-300',
    bg: 'bg-violet-500/8',
    siteOnly: true,
  },
  {
    id: 'purchases',
    label: 'Compras',
    sublabel: 'Site',
    icon: ShoppingCart,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    siteOnly: true,
  },
];

export const DEFAULT_FUNNEL_METRICS: FunnelMetricId[] = [
  'clicks', 'pageViews', 'leads', 'realLeads',
];

interface Props {
  funnel: CampaignFunnel;
  selectedMetrics?: FunnelMetricId[];
}

export function MiniFunnel({ funnel, selectedMetrics = DEFAULT_FUNNEL_METRICS }: Props) {
  const hasSiteData = (funnel.realLeads + funnel.realPageViews + funnel.realMessages + funnel.realPurchases) > 0;

  const steps = selectedMetrics
    .map(id => FUNNEL_METRIC_DEFS.find(d => d.id === id))
    .filter(Boolean)
    .map(def => {
      const isSite = def!.siteOnly;
      const pending = isSite && !hasSiteData;
      const value = funnel[def!.id as keyof CampaignFunnel] as number;
      return { ...def!, value, pending };
    });

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${step.pending ? 'bg-muted/30' : step.bg}`}
            title={step.pending ? 'Disponível após vincular o site' : `${step.label} (${step.sublabel})`}
          >
            <step.icon className={`h-3 w-3 flex-shrink-0 ${step.pending ? 'text-muted-foreground' : step.color}`} />
            <div>
              {step.pending ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground">—</p>
                  <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{step.label}</p>
                </>
              ) : (
                <>
                  <p className={`text-xs font-semibold ${step.color}`}>{formatNumber(step.value)}</p>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {step.label}
                    <span className="text-muted-foreground/50 ml-0.5">({step.sublabel})</span>
                  </p>
                </>
              )}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="text-muted-foreground/40 text-xs">→</div>
          )}
        </div>
      ))}
    </div>
  );
}
