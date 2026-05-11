import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, Code2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Integration, TrackingKey, IntegrationType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PLATFORM_LABELS: Record<IntegrationType, string> = {
  META_BMS: 'Meta Ads (BMS)',
  TIKTOK: 'TikTok Ads',
  KWAI: 'Kwai Ads',
  GOOGLE_ADS: 'Google Ads',
  GA4: 'Google Analytics 4',
  WHATSAPP: 'WhatsApp / CRM',
  CRM: 'CRM',
};

const PLATFORM_COLORS: Record<IntegrationType, string> = {
  META_BMS: 'bg-blue-500/20 text-blue-400',
  TIKTOK: 'bg-pink-500/20 text-pink-400',
  KWAI: 'bg-orange-500/20 text-orange-400',
  GOOGLE_ADS: 'bg-red-500/20 text-red-400',
  GA4: 'bg-yellow-500/20 text-yellow-400',
  WHATSAPP: 'bg-emerald-500/20 text-emerald-400',
  CRM: 'bg-violet-500/20 text-violet-400',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Integrations() {
  const { activeProfile } = useAuthStore();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ type: 'META_BMS' as IntegrationType, label: '', accountId: '', token: '' });

  const { data: integrations } = useQuery<Integration[]>({
    queryKey: ['integrations', activeProfile?.id],
    queryFn: () => api.get(`/integrations/profile/${activeProfile!.id}`).then(r => r.data),
    enabled: !!activeProfile,
  });

  const { data: trackingKeys } = useQuery<TrackingKey[]>({
    queryKey: ['tracking-keys', activeProfile?.id],
    queryFn: () => api.get(`/integrations/profile/${activeProfile!.id}/tracking-keys`).then(r => r.data),
    enabled: !!activeProfile,
  });

  const createIntegration = useMutation({
    mutationFn: (body: typeof form) =>
      api.post(`/integrations/profile/${activeProfile!.id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', activeProfile?.id] });
      setShowAddForm(false);
      setForm({ type: 'META_BMS', label: '', accountId: '', token: '' });
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', activeProfile?.id] }),
  });

  const createTrackingKey = useMutation({
    mutationFn: () =>
      api.post(`/integrations/profile/${activeProfile!.id}/tracking-keys`, { label: 'Tracking Key' }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking-keys', activeProfile?.id] }),
  });

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>
        <Button onClick={() => setShowAddForm(s => !s)}>
          <Plus className="h-4 w-4" />
          Nova Integração
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar Integração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Plataforma</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as IntegrationType }))}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                >
                  {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Label</label>
                <Input
                  placeholder="Ex: BMS Principal"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Account ID</label>
                <Input
                  placeholder="ID da conta / Measurement ID"
                  value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Token / API Secret</label>
                <Input
                  type="password"
                  placeholder="Access Token ou API Secret"
                  value={form.token}
                  onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
              <Button
                onClick={() => createIntegration.mutate(form)}
                disabled={!form.label || createIntegration.isPending}
              >
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integrations List */}
      <div className="grid gap-3">
        {integrations?.map(integration => (
          <div
            key={integration.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${PLATFORM_COLORS[integration.type]}`}>
                {PLATFORM_LABELS[integration.type]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{integration.label}</p>
                {integration.accountId && (
                  <p className="text-xs text-muted-foreground">ID: {integration.accountId}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={integration.isActive ? 'success' : 'secondary'}>
                {integration.isActive ? 'Ativo' : 'Inativo'}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteIntegration.mutate(integration.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {integrations?.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">Nenhuma integração configurada.</p>
          </div>
        )}
      </div>

      {/* Tracking Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            Tracking Keys (Rastreamento do Site)
          </h2>
          <Button variant="outline" size="sm" onClick={() => createTrackingKey.mutate()}>
            <Plus className="h-3.5 w-3.5" />
            Gerar Key
          </Button>
        </div>

        <div className="space-y-2">
          {trackingKeys?.map(tk => (
            <div key={tk.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">{tk.label ?? 'Tracking Key'}</span>
                <Badge variant={tk.isActive ? 'success' : 'secondary'}>
                  {tk.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {/* Script tag */}
              <div className="rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate">{`<script src="${apiUrl}/api/tracking/script/${tk.key}.js"></script>`}</code>
                  <CopyButton text={`<script src="${apiUrl}/api/tracking/script/${tk.key}.js"></script>`} />
                </div>
              </div>

              {/* Usage example */}
              <div className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">Uso:</p>
                <div className="space-y-0.5">
                  <p><span className="text-primary">orus</span>.lead({'{ email: "user@email.com" }'})</p>
                  <p><span className="text-primary">orus</span>.purchase({'{ value: 97.00 }'})</p>
                </div>
              </div>
            </div>
          ))}

          {(!trackingKeys || trackingKeys.length === 0) && (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Gere uma tracking key para rastrear seu site.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
