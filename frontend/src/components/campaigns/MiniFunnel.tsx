import { MousePointerClick, Users, UserCheck, ShoppingBag } from 'lucide-react';
import { CampaignFunnel } from '@/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  funnel: CampaignFunnel;
}

export function MiniFunnel({ funnel }: Props) {
  const steps = [
    { icon: MousePointerClick, label: 'Cliques', value: funnel.clicks, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Users, label: 'Leads (plat.)', value: funnel.leads, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: UserCheck, label: 'Cadastros Reais', value: funnel.realLeads, color: 'text-emerald-400', bg: 'bg-emerald-500/10', highlight: true },
    { icon: ShoppingBag, label: 'Compras Reais', value: funnel.realPurchases, color: 'text-violet-400', bg: 'bg-violet-500/10', highlight: true },
  ];

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${step.bg}`}>
            <step.icon className={`h-3 w-3 ${step.color}`} />
            <div>
              <p className={`text-xs font-semibold ${step.color}`}>{formatNumber(step.value)}</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">{step.label}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="text-muted-foreground text-xs">→</div>
          )}
        </div>
      ))}
    </div>
  );
}
