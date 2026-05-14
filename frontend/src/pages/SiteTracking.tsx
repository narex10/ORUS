import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Trash2, Plus, Check, Code2, UserCheck, Eye, MousePointerClick, X, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TrackingConfig {
  leads: boolean;
  pageviews: boolean;
  buttons: boolean;
  buttonSelector: string;
}

interface TrackingKey {
  id: string;
  key: string;
  label: string;
  config: string | null;
  isActive: boolean;
  createdAt: string;
}

interface OrusUrlParamRow {
  key: string;
  obrigatorio: boolean;
  descricao: string;
  exemplo: string;
  mapsTo: string;
}

interface OrusUrlStandardPayload {
  versao: number;
  parameters: OrusUrlParamRow[];
  trackedKeys: string[];
  exampleUrl: string;
  metaAds: string;
  resumo: string;
}

function parseConfig(raw: string | null): TrackingConfig {
  try {
    return { leads: true, pageviews: true, buttons: false, buttonSelector: '', ...JSON.parse(raw || '{}') };
  } catch {
    return { leads: true, pageviews: true, buttons: false, buttonSelector: '' };
  }
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors w-full',
        checked ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground')}
    >
      <div className={cn('h-4 w-4 rounded flex items-center justify-center flex-shrink-0',
        checked ? 'bg-primary' : 'border border-border')}>
        {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </div>
      {label}
    </button>
  );
}

function CopyableBlock({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className={cn('relative rounded-lg bg-muted/50 border border-border overflow-hidden', className)}>
      <pre className="text-[11px] text-muted-foreground p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all font-mono">
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground"
        title="Copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function ScriptSnippet({ trackingKey, apiUrl }: { trackingKey: string; apiUrl: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${apiUrl}/api/tracking/script/${trackingKey}.js"></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative rounded-lg bg-muted/50 border border-border overflow-hidden">
      <pre className="text-[11px] text-muted-foreground p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-all font-mono">
        {snippet}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground"
        title="Copiar"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function KeyCard({ tk, apiUrl, onDelete }: { tk: TrackingKey; apiUrl: string; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = parseConfig(tk.config);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Code2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{tk.label}</p>
            <p className="text-[11px] text-muted-foreground font-mono truncate">{tk.key}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Feature badges */}
          <div className="hidden sm:flex items-center gap-1">
            {cfg.pageviews && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Eye className="h-2.5 w-2.5" /> Visitas
              </Badge>
            )}
            {cfg.leads && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <UserCheck className="h-2.5 w-2.5" /> Cadastros
              </Badge>
            )}
            {cfg.buttons && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <MousePointerClick className="h-2.5 w-2.5" /> Botões
              </Badge>
            )}
          </div>

          <button
            onClick={() => setExpanded(e => !e)}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => { if (window.confirm(`Remover a chave "${tk.label}"?`)) onDelete(); }}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Script para colar no &lt;head&gt; do site:</p>
            <ScriptSnippet trackingKey={tk.key} apiUrl={apiUrl} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className={cn('rounded-lg border p-2 text-center', cfg.pageviews ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border text-muted-foreground opacity-50')}>
              <Eye className="h-3.5 w-3.5 mx-auto mb-0.5" />
              Visitas reais
            </div>
            <div className={cn('rounded-lg border p-2 text-center', cfg.leads ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-border text-muted-foreground opacity-50')}>
              <UserCheck className="h-3.5 w-3.5 mx-auto mb-0.5" />
              Cadastros
            </div>
            <div className={cn('rounded-lg border p-2 text-center', cfg.buttons ? 'border-amber-500/30 bg-amber-500/5 text-amber-400' : 'border-border text-muted-foreground opacity-50')}>
              <MousePointerClick className="h-3.5 w-3.5 mx-auto mb-0.5" />
              Botões
            </div>
          </div>

          {cfg.buttons && cfg.buttonSelector && (
            <p className="text-[11px] text-muted-foreground">
              Seletor de botão: <code className="text-foreground bg-muted px-1 py-0.5 rounded">{cfg.buttonSelector}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_CONFIG: TrackingConfig = { leads: true, pageviews: true, buttons: false, buttonSelector: '' };

export function SiteTracking() {
  const { activeProfile } = useAuthStore();
  const qc = useQueryClient();
  const apiUrl = window.location.origin.includes('5173')
    ? 'http://localhost:3001'
    : window.location.origin;

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<TrackingConfig>(DEFAULT_CONFIG);
  const [landingBase, setLandingBase] = useState('');

  const { data: keys = [], isLoading } = useQuery<TrackingKey[]>({
    queryKey: ['tracking-keys', activeProfile?.id],
    queryFn: () => api.get('/tracking-keys', { params: { profileId: activeProfile!.id } }).then(r => r.data),
    enabled: !!activeProfile,
  });

  const { data: urlStandard } = useQuery<OrusUrlStandardPayload>({
    queryKey: ['orus-url-standard', landingBase],
    queryFn: () =>
      api
        .get('/tracking/url-standard', { params: landingBase.trim() ? { base: landingBase.trim() } : {} })
        .then(r => r.data),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { profileId: string; label: string; config: TrackingConfig }) =>
      api.post('/tracking-keys', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracking-keys', activeProfile?.id] });
      setShowForm(false);
      setLabel('');
      setConfig(DEFAULT_CONFIG);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tracking-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking-keys', activeProfile?.id] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProfile || !label.trim()) return;
    createMutation.mutate({ profileId: activeProfile.id, label: label.trim(), config });
  }

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rastreamento do Site</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancelar' : 'Nova chave'}
        </Button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Nova chave de rastreamento</p>

          {/* Label */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da chave</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Página de Cadastro"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Opções */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">O que capturar</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Toggle
                checked={config.pageviews}
                onChange={v => setConfig(c => ({ ...c, pageviews: v }))}
                label="Visitas reais"
              />
              <Toggle
                checked={config.leads}
                onChange={v => setConfig(c => ({ ...c, leads: v }))}
                label="Cadastros reais"
              />
              <Toggle
                checked={config.buttons}
                onChange={v => setConfig(c => ({ ...c, buttons: v }))}
                label="Rastreamento de botões"
              />
            </div>
          </div>

          {/* Seletor de botão */}
          {config.buttons && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Seletor CSS do botão <span className="text-muted-foreground/60">(opcional)</span>
              </label>
              <input
                value={config.buttonSelector}
                onChange={e => setConfig(c => ({ ...c, buttonSelector: e.target.value }))}
                placeholder='button[type="submit"], .btn-cadastro, #form-submit'
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Deixe em branco para usar o padrão: <code className="bg-muted px-1 rounded">button[type="submit"]</code>
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar chave'}
            </Button>
          </div>
        </form>
      )}

      {/* Como usar */}
      {!showForm && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold text-foreground mb-1">Como instalar</p>
          <p className="text-xs text-muted-foreground">
            Copie o script gerado e cole antes do <code className="bg-muted px-1 py-0.5 rounded">&lt;/head&gt;</code> de cada página que deseja rastrear. O script captura os eventos selecionados automaticamente.
          </p>
        </div>
      )}

      {/* Padrão ORUS — parâmetros de URL em anúncios */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-3 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Link2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">URL padrão para anúncios (ORUS)</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {urlStandard?.resumo ?? 'Use estes nomes de query na landing para o script e o CRM Zap reconhecerem o tráfego da mesma forma.'}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sua landing (opcional)</label>
            <input
              value={landingBase}
              onChange={e => setLandingBase(e.target.value)}
              placeholder="https://seusite.com.br/landing ou apenas o domínio"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Deixe em branco para usar o exemplo padrão. Ao alterar, a URL modelo abaixo é atualizada.
            </p>
          </div>

          {urlStandard && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">URL modelo (copie para o campo de destino nos anúncios)</p>
                <CopyableBlock text={urlStandard.exampleUrl} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{urlStandard.metaAds}</p>

              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-2 font-medium text-foreground">Parâmetro</th>
                      <th className="px-3 py-2 font-medium text-foreground whitespace-nowrap">Obrig.</th>
                      <th className="px-3 py-2 font-medium text-foreground min-w-[140px]">Descrição</th>
                      <th className="px-3 py-2 font-medium text-foreground">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urlStandard.parameters.map(row => (
                      <tr key={row.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-foreground align-top">{row.key}</td>
                        <td className="px-3 py-2 text-muted-foreground align-top whitespace-nowrap">
                          {row.obrigatorio ? 'Sim' : 'Não'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground align-top">{row.descricao}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground align-top break-all max-w-[180px]">{row.exemplo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista de chaves */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-border" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border gap-2">
          <Code2 className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma chave criada ainda.</p>
          <p className="text-xs text-muted-foreground/60">Clique em "Nova chave" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(tk => (
            <KeyCard
              key={tk.id}
              tk={tk}
              apiUrl={apiUrl}
              onDelete={() => deleteMutation.mutate(tk.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
