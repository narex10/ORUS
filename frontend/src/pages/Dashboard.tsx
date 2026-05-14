import { useState } from 'react';
import { subDays } from 'date-fns';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDashboard } from '@/hooks/useDashboard';
import { KPICards } from '@/components/dashboard/KPICards';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { Button } from '@/components/ui/button';
import { getGreeting } from '@/lib/utils';
import { cn } from '@/lib/utils';

type PeriodOption = { label: string; days: number };

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'Hoje', days: 0 },
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 29 },
];

export function Dashboard() {
  const { user, activeProfile } = useAuthStore();
  const [selectedDays, setSelectedDays] = useState(29);

  const fromDate = subDays(new Date(), selectedDays);
  const { data, isLoading, refetch, isFetching } = useDashboard(
    activeProfile?.id,
    fromDate,
    new Date()
  );

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">📊</div>
          <h2 className="text-lg font-semibold text-foreground">Selecione um perfil</h2>
          <p className="text-sm text-muted-foreground">
            Escolha ou crie um perfil na barra lateral para começar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user ? getGreeting(user.name) : 'Dashboard'} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Perfil: <span className="font-medium text-foreground">{activeProfile.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex rounded-lg border border-border bg-card p-1 gap-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setSelectedDays(opt.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedDays === opt.days
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-card animate-pulse border border-border" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-card animate-pulse border border-border" />
        </div>
      ) : data ? (
        <>
          <KPICards kpis={data.kpis} currency={activeProfile.currency} />
          <PerformanceChart data={data.chart} currency={activeProfile.currency} />
        </>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Nenhum dado disponível para o período.</p>
        </div>
      )}
    </div>
  );
}
