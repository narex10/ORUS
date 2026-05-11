import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Area
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardChart } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  data: DashboardChart[];
  currency?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {typeof p.value === 'number' && p.name !== 'Leads'
              ? `R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function PerformanceChart({ data, currency = 'BRL' }: Props) {
  const formatted = data.map(d => ({
    ...d,
    dateLabel: format(typeof d.date === 'string' ? parseISO(d.date) : d.date, 'dd/MM', { locale: ptBR }),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performance por Dia</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="money"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>}
            />
            <Area
              yAxisId="money" type="monotone" dataKey="revenue"
              name="Faturamento" stroke="#10b981" strokeWidth={2}
              fill="url(#gradRevenue)"
            />
            <Area
              yAxisId="money" type="monotone" dataKey="spend"
              name="Gasto" stroke="#3b82f6" strokeWidth={2}
              fill="url(#gradSpend)"
            />
            <Bar
              yAxisId="count" dataKey="leads" name="Leads"
              fill="#06b6d4" fillOpacity={0.7} radius={[3, 3, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
