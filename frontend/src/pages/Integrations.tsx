import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Copy, Check, Code2, RefreshCw,
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Integration, TrackingKey } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Configuração por tipo de plataforma ──────────────────────

type PlatformType = 'META_BMS' | 'TIKTOK' | 'KWAI' | 'GOOGLE_ADS' | 'GA4' | 'WHATSAPP' | 'CRM';

const PLATFORM_CONFIG: Record<PlatformType, {
  label: string;
  color: string;
  icon: string;
  fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean; hint?: string }>;
  syncSupported: boolean;
  docsUrl?: string;
}> = {
  META_BMS: {
    label: 'Meta Ads (BMS)',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: '📘',
    syncSupported: true,
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/get-started',
    fields: [
      { key: 'accountId', label: 'Ad Account ID', placeholder: 'act_123456789 ou 123456789', hint: 'ID da conta de anúncios (act_XXXXXX)' },
      { key: 'token', label: 'Access Token', placeholder: 'EAAxxxxxxxx...', secret: true, hint: 'Token de longa duração do usuário ou System User' },
    ],
  },
  TIKTOK: {
    label: 'TikTok Ads',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    icon: '🎵',
    syncSupported: false,
    fields: [
      { key: 'accountId', label: 'Advertiser ID', placeholder: '123456789' },
      { key: 'token', label: 'Access Token', placeholder: 'Token de acesso', secret: true },
    ],
  },
  KWAI: {
    label: 'Kwai Ads',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: '🎬',
    syncSupported: false,
    fields: [
      { key: 'accountId', label: 'Account ID', placeholder: '123456789' },
      { key: 'token', label: 'Access Token', placeholder: 'Token de acesso', secret: true },
    ],
  },
  GOOGLE_ADS: {
    label: 'Google Ads',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: '🔍',
    syncSupported: false,
    fields: [
      { key: 'accountId', label: 'Customer ID', placeholder: '123-456-7890' },
      { key: 'token', label: 'Developer Token', placeholder: 'Token de acesso', secret: true },
    ],
  },
  GA4: {
    label: 'Google Analytics 4',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: '📊',
    syncSupported: true,
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
    fields: [
      { key: 'accountId', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', hint: 'Encontrado em GA4 → Admin → Fluxos de dados' },
      { key: 'extraConfig.propertyId', label: 'Property ID', placeholder: '123456789', hint: 'Admin → Detalhes da propriedade' },
      { key: 'extraConfig.apiSecret', label: 'API Secret', placeholder: 'xxxxxxxxxxxxxxxx', secret: true, hint: 'Admin → Fluxos de dados → Secrets para API de medição' },
    ],
  },
  WHATSAPP: {
    label: 'WhatsApp / CRM',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: '💬',
    syncSupported: false,
    fields: [
      { key: 'accountId', label: 'Phone Number ID', placeholder: '123456789' },
      { key: 'token', label: 'API Token', placeholder: 'Token de acesso', secret: true },
    ],
  },
  CRM: {
    label: 'CRM',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    icon: '🗂️',
    syncSupported: false,
    fields: [
      { key: 'accountId', label: 'Workspace ID', placeholder: 'workspace-id' },
      { key: 'token', label: 'API Key', placeholder: 'api-key', secret: true },
    ],
  },
};

// ─── Guia de token Meta ───────────────────────────────────────

function MetaTokenGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-blue-400"
      >
        <span className="flex items-center gap-2">
          📘 Como gerar o Access Token correto para o Meta Ads?
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="border-t border-blue-500/20 px-3 pb-3 pt-2 space-y-3 text-xs text-muted-foreground">
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">Opção 1 — Graph API Explorer (rápido, para testes)</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Acesse <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">developers.facebook.com/tools/explorer</a></li>
              <li>Selecione seu App no topo direito</li>
              <li>Clique em <strong className="text-foreground">Generate Access Token</strong></li>
              <li>Marque as permissões: <code className="bg-muted px-1 rounded text-emerald-400">ads_read</code>, <code className="bg-muted px-1 rounded text-emerald-400">ads_management</code>, <code className="bg-muted px-1 rounded text-emerald-400">business_management</code></li>
              <li>Copie o token gerado e cole no campo acima</li>
            </ol>
            <p className="text-amber-400/80">⚠ Token do Explorer expira em ~1h. Use System User para produção.</p>
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">Opção 2 — System User Token (recomendado para produção)</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Acesse o <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Business Manager → System Users</a></li>
              <li>Crie um System User do tipo <strong className="text-foreground">Admin</strong></li>
              <li>Adicione as contas de anúncios que deseja acessar</li>
              <li>Clique em <strong className="text-foreground">Generate Token</strong> e marque <code className="bg-muted px-1 rounded text-emerald-400">ads_read</code> e <code className="bg-muted px-1 rounded text-emerald-400">ads_management</code></li>
              <li>Token não expira automaticamente</li>
            </ol>
          </div>

          <div className="rounded bg-muted/50 p-2">
            <p className="font-medium text-foreground mb-1">Ad Account ID</p>
            <p>Encontre em: <a href="https://www.facebook.com/adsmanager" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Gerenciador de Anúncios</a> → URL contém <code className="bg-muted px-1 rounded">act_XXXXXXXXX</code></p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaTokenError({ error }: { error: string }) {
  const isPermission = error.includes('ads_read') || error.includes('permission') || error.includes('permissão');
  const isAccount = error.includes('conta') || error.includes('acesso') || error.includes('account');

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
      {isPermission && (
        <div className="text-xs text-muted-foreground space-y-1 border-t border-red-500/10 pt-2">
          <p className="font-medium text-foreground">Como corrigir:</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Vá em <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Graph API Explorer</a></li>
            <li>Gere um novo token marcando <code className="bg-muted px-1 rounded text-emerald-400">ads_read</code> e <code className="bg-muted px-1 rounded text-emerald-400">ads_management</code></li>
            <li>Cole o novo token no campo acima e valide novamente</li>
          </ol>
        </div>
      )}
      {isAccount && !isPermission && (
        <p className="text-xs text-muted-foreground border-t border-red-500/10 pt-2">
          Certifique-se que o usuário do token tem acesso à conta de anúncios no Business Manager.
        </p>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SyncResult({ result }: { result: any }) {
  if (!result) return null;
  const entries = Object.entries(result);
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {entries.map(([k, v]) => (
        <span key={k} className="text-xs bg-emerald-500/10 text-emerald-400 rounded px-2 py-0.5">
          {k}: <strong>{String(v)}</strong>
        </span>
      ))}
    </div>
  );
}

interface IntegrationCardProps {
  integration: Integration;
  onDelete: (id: string) => void;
  onSync: (id: string) => Promise<any>;
  isSyncing: boolean;
}

function IntegrationCard({ integration, onDelete, onSync, isSyncing }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const config = PLATFORM_CONFIG[integration.type as PlatformType];

  async function handleSync() {
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await onSync(integration.id);
      setSyncResult(res.result);
    } catch (err: any) {
      setSyncError(err.response?.data?.error ?? err.message ?? 'Erro ao sincronizar');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold', config?.color ?? 'bg-muted text-muted-foreground border-border')}>
            <span>{config?.icon}</span>
            {config?.label ?? integration.type}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{integration.label}</p>
            <p className="text-xs text-muted-foreground">
              {integration.accountId && `ID: ${integration.accountId}`}
              {integration.lastSyncAt && (
                <span className="ml-2 text-emerald-400/80">
                  · Sync {formatDistanceToNow(new Date(integration.lastSyncAt), { locale: ptBR, addSuffix: true })}
                </span>
              )}
              {!integration.lastSyncAt && (
                <span className="ml-2 text-amber-400/80">· Nunca sincronizado</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant={integration.isActive ? 'success' : 'secondary'}>
            {integration.isActive ? 'Ativo' : 'Inativo'}
          </Badge>

          {config?.syncSupported && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          )}

          {config?.docsUrl && (
            <a href={config.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground p-1.5 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <button
            onClick={() => setExpanded(e => !e)}
            className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <button
            onClick={() => onDelete(integration.id)}
            className="text-muted-foreground hover:text-destructive p-1.5 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feedback de sync */}
      {syncResult && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Sincronizado com sucesso!</span>
          </div>
          <SyncResult result={syncResult} />
        </div>
      )}
      {syncError && (
        <div className="px-4 pb-3 flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Expanded info */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
          {!config?.syncSupported && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Sync automático em breve para {config?.label}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Tipo: <span className="text-foreground">{integration.type}</span></span>
            <span>Criado: <span className="text-foreground">
              {new Date(integration.createdAt).toLocaleDateString('pt-BR')}
            </span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────

export function Integrations() {
  const { activeProfile } = useAuthStore();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<PlatformType>('META_BMS');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{
    accountName: string | null;
    currency: string | null;
    userName: string;
    permissions: string[];
    accountWarning?: string;
  } | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);

  const [form, setForm] = useState<Record<string, string>>({
    label: '',
    accountId: '',
    token: '',
    'extraConfig.propertyId': '',
    'extraConfig.apiSecret': '',
  });

  const { data: integrations, isLoading } = useQuery<Integration[]>({
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
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/integrations/profile/${activeProfile!.id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', activeProfile?.id] });
      setShowAddForm(false);
      setForm({ label: '', accountId: '', token: '', 'extraConfig.propertyId': '', 'extraConfig.apiSecret': '' });
      setValidateResult(null);
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', activeProfile?.id] });
      qc.invalidateQueries({ queryKey: ['campaigns', activeProfile?.id] });
    },
  });

  const createTrackingKey = useMutation({
    mutationFn: () =>
      api.post(`/integrations/profile/${activeProfile!.id}/tracking-keys`, { label: 'Site Principal' }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking-keys', activeProfile?.id] }),
  });

  async function handleSync(integrationId: string) {
    setSyncingId(integrationId);
    try {
      const { data } = await api.post(`/sync/${integrationId}`);
      qc.invalidateQueries({ queryKey: ['campaigns', activeProfile?.id] });
      qc.invalidateQueries({ queryKey: ['dashboard', activeProfile?.id] });
      return data;
    } finally {
      setSyncingId(null);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setValidateError(null);
    setValidateResult(null);
    try {
      const { data } = await api.post('/sync/validate/meta', {
        token: form.token,
        accountId: form.accountId,
      });
      setValidateResult(data);
    } catch (err: any) {
      setValidateError(err.response?.data?.error ?? 'Token ou conta inválidos');
    } finally {
      setValidating(false);
    }
  }

  function handleSubmit() {
    const config = PLATFORM_CONFIG[selectedType];
    const extraConfig: Record<string, string> = {};
    config.fields
      .filter(f => f.key.startsWith('extraConfig.'))
      .forEach(f => {
        const k = f.key.replace('extraConfig.', '');
        if (form[f.key]) extraConfig[k] = form[f.key];
      });

    createIntegration.mutate({
      type: selectedType,
      label: form.label || config.label,
      accountId: form.accountId || undefined,
      token: form.token || undefined,
      extraConfig: Object.keys(extraConfig).length > 0 ? extraConfig : undefined,
    });
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const config = PLATFORM_CONFIG[selectedType];

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>
        <Button onClick={() => { setShowAddForm(s => !s); setValidateResult(null); setValidateError(null); }}>
          <Plus className="h-4 w-4" />
          Nova Integração
        </Button>
      </div>

      {/* Formulário de nova integração */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar Integração</CardTitle>
            <CardDescription>Configure as credenciais da plataforma de anúncios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seletor de plataforma */}
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-7">
              {(Object.keys(PLATFORM_CONFIG) as PlatformType[]).map(type => {
                const c = PLATFORM_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setValidateResult(null); setValidateError(null); }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all',
                      selectedType === type
                        ? cn('border-primary bg-primary/10 text-primary', c.color)
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-accent'
                    )}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span className="text-center leading-tight">{c.label}</span>
                    {c.syncSupported && (
                      <span className="text-[10px] text-emerald-400">● Sync</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Campos dinâmicos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Label da Integração</label>
                <Input
                  placeholder={`Ex: ${config.label} — Conta Principal`}
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>

              {config.fields.map(field => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {field.label}
                    {field.hint && (
                      <span className="ml-1 font-normal opacity-60">— {field.hint}</span>
                    )}
                  </label>
                  <Input
                    type={field.secret ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={form[field.key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* Guia de token Meta */}
            {selectedType === 'META_BMS' && (
              <MetaTokenGuide />
            )}

            {/* Validação Meta */}
            {selectedType === 'META_BMS' && form.token && form.accountId && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidate}
                  disabled={validating}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', validating && 'animate-spin')} />
                  {validating ? 'Validando...' : 'Validar Token e Conta'}
                </Button>

                {validateResult && (
                  <div className="space-y-2">
                    {/* Token OK */}
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Token válido! Permissões confirmadas.
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Usuário: <strong className="text-foreground">{validateResult.userName}</strong>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {validateResult.permissions.map(p => (
                          <span key={p} className={`text-[10px] rounded px-1.5 py-0.5 font-mono ${
                            ['ads_read','ads_management'].includes(p)
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>{p}</span>
                        ))}
                      </div>
                      {validateResult.accountName && (
                        <p className="text-xs text-emerald-400/80 pt-0.5">
                          Conta verificada: <strong>{validateResult.accountName}</strong>
                          {validateResult.currency && ` · ${validateResult.currency}`}
                        </p>
                      )}
                    </div>

                    {/* Aviso de conta (não bloqueia salvar) */}
                    {validateResult.accountWarning && (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-300 space-y-1">
                          <p className="font-medium">Aviso sobre acesso à conta</p>
                          <p>{validateResult.accountWarning}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {validateError && (
                  <MetaTokenError error={validateError} />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAddForm(false); setValidateResult(null); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createIntegration.isPending}
              >
                {createIntegration.isPending ? 'Salvando...' : 'Salvar Integração'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de integrações */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Plataformas de Anúncios
        </h2>

        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-border" />
          ))
        ) : integrations?.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">Nenhuma integração configurada.</p>
          </div>
        ) : (
          integrations?.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onDelete={id => deleteIntegration.mutate(id)}
              onSync={handleSync}
              isSyncing={syncingId === integration.id}
            />
          ))
        )}
      </div>

      {/* Tracking Keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Rastreamento do Site
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

              <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs text-muted-foreground mb-2">
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-emerald-400/90">
                    {`<script src="${apiUrl}/api/tracking/script/${tk.key}.js"></script>`}
                  </code>
                  <CopyButton text={`<script src="${apiUrl}/api/tracking/script/${tk.key}.js"></script>`} />
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5">Como usar:</p>
                <p><span className="text-violet-400">orus</span><span className="text-muted-foreground">.lead({'{'} email: <span className="text-emerald-400">"user@email.com"</span> {'}'})</span></p>
                <p><span className="text-violet-400">orus</span><span className="text-muted-foreground">.purchase({'{'} value: <span className="text-blue-400">97.00</span> {'}'})</span></p>
                <p className="text-muted-foreground/50 text-[10px] pt-1">Parâmetros UTM, BM e cloaker são capturados automaticamente.</p>
              </div>
            </div>
          ))}

          {(!trackingKeys || trackingKeys.length === 0) && (
            <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Gere uma key para rastrear cadastros e compras do seu site.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
