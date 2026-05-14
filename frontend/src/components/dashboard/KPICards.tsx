import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Target, BarChart3, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardKPIs } from '@/types';
import { formatCurrency, formatNumber, formatROAS } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
}

function KPICard({ title, value, subtitle, icon: Icon, color, trend }: KPICardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={cn('mt-3 flex items-center gap-1 text-xs font-medium',
            trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {trend >= 0
              ? <TrendingUp className="h-3 w-3" />
              : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}% vs período anterior
          </div>
        )}
      </CardContent>
      {/* Gradient accent */}
      <div className={cn('absolute bottom-0 left-0 right-0 h-0.5', color.replace('/20', ''))} />
    </Card>
  );
}

interface Props {
  kpis: DashboardKPIs;
  currency?: string;
}

export function KPICards({ kpis, currency = 'BRL' }: Props) {
  const cards: KPICardProps[] = [
    {
      title: 'Faturamento',
      value: formatCurrency(kpis.revenue, currency),
      icon: DollarSign,
      color: 'bg-emerald-500/20 text-emerald-400',
    },
    {
      title: 'Gasto',
      value: formatCurrency(kpis.spend, currency),
      icon: BarChart3,
      color: 'bg-blue-500/20 text-blue-400',
    },
    {
      title: 'ROAS',
      value: formatROAS(kpis.roas),
      subtitle: kpis.roas >= 2 ? 'Lucrativo' : 'Atenção',
      icon: TrendingUp,
      color: kpis.roas >= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400',
    },
    {
      title: 'Vendas',
      value: formatNumber(kpis.purchases),
      subtitle: 'Meta + site/CRM',
      icon: ShoppingCart,
      color: 'bg-violet-500/20 text-violet-400',
    },
    {
      title: 'Leads',
      value: formatNumber(kpis.leads),
      subtitle: 'Cadastros reais',
      icon: Users,
      color: 'bg-cyan-500/20 text-cyan-400',
    },
    {
      title: 'Conversas iniciadas',
      value: formatNumber(kpis.messages),
      subtitle: 'Meta Ads (mensagens)',
      icon: MessageCircle,
      color: 'bg-teal-500/20 text-teal-400',
    },
    {
      title: 'CPA',
      value: formatCurrency(kpis.cpa, currency),
      subtitle: 'Custo por aquisição',
      icon: Target,
      color: 'bg-orange-500/20 text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map(card => (
        <KPICard key={card.title} {...card} />
      ))}
    </div>
  );
}
