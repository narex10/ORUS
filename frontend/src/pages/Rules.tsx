import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { AutomationRule } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CONDITION_LABELS: Record<string, string> = {
  ROAS_BELOW: 'ROAS abaixo de',
  ROAS_ABOVE: 'ROAS acima de',
  CPA_ABOVE: 'CPA acima de R$',
  CPA_BELOW: 'CPA abaixo de R$',
  SPEND_ABOVE: 'Gasto acima de R$',
  LEADS_BELOW: 'Leads abaixo de',
  LEADS_ABOVE: 'Leads acima de',
  CTR_BELOW: 'CTR abaixo de %',
  CTR_ABOVE: 'CTR acima de %',
};

const ACTION_LABELS: Record<string, string> = {
  PAUSE_CAMPAIGN: 'Pausar campanha',
  PAUSE_ADSET: 'Pausar conjunto',
  INCREASE_BUDGET: 'Aumentar orçamento',
  DECREASE_BUDGET: 'Reduzir orçamento',
  SEND_ALERT: 'Enviar alerta',
};

export function Rules() {
  const { activeProfile } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    targetLevel: 'CAMPAIGN' as 'CAMPAIGN' | 'ADSET' | 'AD',
    platform: 'META' as any,
    conditions: [{ type: 'ROAS_BELOW', operator: 'AND', value: 1, window: 3 }],
    actions: [{ type: 'PAUSE_CAMPAIGN', payload: {} }],
  });

  const { data: rules, isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['rules', activeProfile?.id],
    queryFn: () => api.get(`/rules/profile/${activeProfile!.id}`).then(r => r.data),
    enabled: !!activeProfile,
  });

  const create = useMutation({
    mutationFn: (body: typeof form) =>
      api.post(`/rules/profile/${activeProfile!.id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules', activeProfile?.id] });
      setShowForm(false);
    },
  });

  const toggle = useMutation({
    mutationFn: (id: string) => api.patch(`/rules/${id}/toggle`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', activeProfile?.id] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/rules/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', activeProfile?.id] }),
  });

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-sm text-muted-foreground mt-1">Regras de escala automática</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)}>
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Criar Regra Automática</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da Regra</label>
                <Input
                  placeholder="Ex: Pausar ROAS baixo"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nível</label>
                <select
                  value={form.targetLevel}
                  onChange={e => setForm(f => ({ ...f, targetLevel: e.target.value as any }))}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="CAMPAIGN">Campanha</option>
                  <option value="ADSET">Conjunto</option>
                  <option value="AD">Anúncio</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Plataforma</label>
                <select
                  value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="META">Meta Ads</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="GOOGLE_ADS">Google Ads</option>
                </select>
              </div>
            </div>

            {/* Condition */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Condição</p>
              <div className="flex gap-2 items-center">
                <select
                  value={form.conditions[0].type}
                  onChange={e => setForm(f => ({ ...f, conditions: [{ ...f.conditions[0], type: e.target.value }] }))}
                  className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm flex-1"
                >
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Valor"
                  className="w-28"
                  value={form.conditions[0].value}
                  onChange={e => setForm(f => ({ ...f, conditions: [{ ...f.conditions[0], value: parseFloat(e.target.value) }] }))}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">nos últimos</span>
                <Input
                  type="number"
                  className="w-16"
                  value={form.conditions[0].window}
                  onChange={e => setForm(f => ({ ...f, conditions: [{ ...f.conditions[0], window: parseInt(e.target.value) }] }))}
                />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>
            </div>

            {/* Action */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ação</p>
              <select
                value={form.actions[0].type}
                onChange={e => setForm(f => ({ ...f, actions: [{ ...f.actions[0], type: e.target.value }] }))}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate(form)} disabled={!form.name || create.isPending}>
                Criar Regra
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card animate-pulse border border-border" />
          ))
        ) : rules?.map(rule => (
          <div
            key={rule.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center ${rule.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Zap className={`h-4 w-4 ${rule.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rule.targetLevel} · {rule.platform}
                    {rule.lastCheckedAt && ` · Última verificação: ${new Date(rule.lastCheckedAt).toLocaleString('pt-BR')}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rule.conditions.map(c => (
                      <span key={c.id} className="text-xs bg-muted rounded px-2 py-0.5 text-muted-foreground">
                        {CONDITION_LABELS[c.type]} {c.value} ({c.window}d)
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground">→</span>
                    {rule.actions.map(a => (
                      <span key={a.id} className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                        {ACTION_LABELS[a.type]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                  {rule.isActive ? 'Ativa' : 'Pausada'}
                </Badge>
                <button onClick={() => toggle.mutate(rule.id)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
                  {rule.isActive
                    ? <ToggleRight className="h-5 w-5 text-primary" />
                    : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button onClick={() => remove.mutate(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!isLoading && !rules?.length && (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">Nenhuma regra criada. Automatize sua escala.</p>
          </div>
        )}
      </div>
    </div>
  );
}
