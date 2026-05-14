import { MousePointerClick, Eye, ClipboardList, UserCheck } from 'lucide-react';
import { CampaignFunnel } from '@/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  funnel: CampaignFunnel;
}

interface Step {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  value: number | null;
  color: string;
  bg: string;
  pending?: boolean;
}

export function MiniFunnel({ funnel }: Props) {
  const siteConnected = funnel.realLeads > 0;

  const steps: Step[] = [
    {
      icon: MousePointerClick,
      label: 'Cliques no anúncio',
      sublabel: 'Meta Ads',
      value: funnel.clicks,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      icon: Eye,
      label: 'Visualização de página',
      sublabel: 'Meta Ads',
      value: funnel.pageViews,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      icon: ClipboardList,
      label: 'Registros concluídos',
      sublabel: 'Gerenciador',
      value: funnel.leads,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      icon: UserCheck,
      label: 'Cadastros reais',
      sublabel: 'Site',
      value: siteConnected ? funnel.realLeads : null,
      color: siteConnected ? 'text-emerald-400' : 'text-muted-foreground',
      bg: siteConnected ? 'bg-emerald-500/10' : 'bg-muted/30',
      pending: !siteConnected,
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${step.bg}`} title={step.pending ? 'Disponível após vincular o site' : undefined}>
            <step.icon className={`h-3 w-3 flex-shrink-0 ${step.color}`} />
            <div>
              {step.pending ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground">—</p>
                  <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{step.label}</p>
                </>
              ) : (
                <>
                  <p className={`text-xs font-semibold ${step.color}`}>{formatNumber(step.value ?? 0)}</p>
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
