import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { loadMetaPixel, trackPurchase } from '@/lib/metaPixel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MessageCircle, Copy, RefreshCw, Plus, ShoppingCart,
  QrCode, Camera, Loader2, ExternalLink, UserPlus,
} from 'lucide-react';

interface CrmLead {
  id: string;
  profileId: string;
  stageId: string;
  phone: string;
  name: string | null;
  firstMessage: string | null;
  sourceUrl: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  purchaseValue: number | null;
  purchaseAt: string | null;
  createdAt: string;
  source?: string;
}

interface CrmStageBoard {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  color: string | null;
  leads: CrmLead[];
}

interface CrmSettings {
  pixelId: string;
  inboundToken: string;
  webhookUrl: string;
}

async function readQrFromFile(file: File): Promise<string | null> {
  try {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (img: ImageBitmap) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
    if (!BD) return null;
    const bmp = await createImageBitmap(file);
    const detector = new BD({ formats: ['qr_code'] });
    const codes = await detector.detect(bmp);
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

function sourceLabel(src?: string) {
  if (src === 'SITE') return 'Site';
  if (src === 'MANUAL') return 'Manual';
  return 'WhatsApp';
}

function sourceBadgeClass(src?: string) {
  if (src === 'SITE') return 'bg-sky-500/20 text-sky-800 dark:text-sky-200';
  if (src === 'MANUAL') return 'bg-violet-500/20 text-violet-800 dark:text-violet-200';
  return 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200';
}

export function CrmZap() {
  const { activeProfile } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState('crm');
  const [newStageName, setNewStageName] = useState('');
  const [pixelInput, setPixelInput] = useState('');
  const [manName, setManName] = useState('');
  const [manPhone, setManPhone] = useState('');
  const [manValue, setManValue] = useState('');
  const [previewMsg, setPreviewMsg] = useState('');
  const [purchaseLead, setPurchaseLead] = useState<CrmLead | null>(null);
  const [purchaseValue, setPurchaseValue] = useState('');
  const [qrHint, setQrHint] = useState<string | null>(null);

  const profileId = activeProfile?.id;

  const { data: settings } = useQuery<CrmSettings>({
    queryKey: ['crm-zap-settings', profileId],
    queryFn: () => api.get(`/crm-zap/profile/${profileId}/settings`).then(r => r.data),
    enabled: !!profileId,
  });

  const { data: board, isLoading: boardLoading } = useQuery<CrmStageBoard[]>({
    queryKey: ['crm-zap-board', profileId],
    queryFn: () => api.get(`/crm-zap/profile/${profileId}/board`).then(r => r.data),
    enabled: !!profileId,
  });

  useEffect(() => {
    if (settings?.pixelId) {
      setPixelInput(settings.pixelId);
      loadMetaPixel(settings.pixelId);
    }
  }, [settings?.pixelId]);

  const savePixel = useMutation({
    mutationFn: (pixelId: string) =>
      api.patch(`/crm-zap/profile/${profileId}/settings`, { pixelId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-zap-settings', profileId] });
      if (pixelInput) loadMetaPixel(pixelInput);
    },
  });

  const rotateToken = useMutation({
    mutationFn: () => api.post(`/crm-zap/profile/${profileId}/settings/rotate-token`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-zap-settings', profileId] }),
  });

  const addStage = useMutation({
    mutationFn: (name: string) => api.post(`/crm-zap/profile/${profileId}/stages`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-zap-board', profileId] }),
  });

  const moveLead = useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      api.patch(`/crm-zap/profile/${profileId}/leads/${leadId}`, { stageId }),
  });

  const handleMoveLead = (lead: CrmLead, newStageId: string) => {
    const target = board?.find(s => s.id === newStageId);
    moveLead.mutate(
      { leadId: lead.id, stageId: newStageId },
      {
        onSettled: () => qc.invalidateQueries({ queryKey: ['crm-zap-board', profileId] }),
        onSuccess: () => {
          if (target?.slug === 'venda' && lead.purchaseValue == null) {
            setPurchaseLead(lead);
            setPurchaseValue('');
          }
        },
      }
    );
  };

  const previewUtm = useMutation({
    mutationFn: (message: string) =>
      api.post(`/crm-zap/profile/${profileId}/preview-utm`, { message }).then(r => r.data),
  });

  const registerPurchase = useMutation({
    mutationFn: ({ leadId, value }: { leadId: string; value: number }) =>
      api.post(`/crm-zap/profile/${profileId}/leads/${leadId}/purchase`, {
        value,
        currency: activeProfile?.currency ?? 'BRL',
      }),
    onSuccess: (axiosRes) => {
      qc.invalidateQueries({ queryKey: ['crm-zap-board', profileId] });
      setPurchaseLead(null);
      setPurchaseValue('');
      const data = axiosRes.data;
      if (data?.firePixelPurchase && settings?.pixelId) {
        trackPurchase(data.value, data.currency ?? 'BRL');
      }
    },
  });

  const manualPurchase = useMutation({
    mutationFn: (body: { name: string; phone: string; value: number }) =>
      api.post(`/crm-zap/profile/${profileId}/leads/manual-purchase`, {
        ...body,
        currency: activeProfile?.currency ?? 'BRL',
      }),
    onSuccess: (axiosRes) => {
      qc.invalidateQueries({ queryKey: ['crm-zap-board', profileId] });
      setManName('');
      setManPhone('');
      setManValue('');
      const data = axiosRes.data;
      if (data?.firePixelPurchase && settings?.pixelId) {
        trackPurchase(data.value, data.currency ?? 'BRL');
      }
    },
  });

  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const onQrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await readQrFromFile(file);
    if (!text) {
      setQrHint('Não foi possível ler o QR neste navegador. Cole o link manualmente ou use Chrome com suporte a BarcodeDetector.');
      return;
    }
    setQrHint(`QR lido: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`);
    setPreviewMsg(prev => (prev ? `${prev}\n${text}` : text));
    if (profileId) previewUtm.mutate(text);
  };

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Selecione um perfil para usar o CRM Zap.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-emerald-500" />
          CRM Zap
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Leads do <strong>rastreamento do site</strong> entram em <strong>Lead Site</strong>. Avance no funil até <strong>Venda</strong> para informar o valor e disparar <strong>Purchase</strong> no pixel.
        </p>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          <Tabs.Trigger
            value="crm"
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === 'crm' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            CRM Funil
          </Tabs.Trigger>
          <Tabs.Trigger
            value="conexao"
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === 'conexao' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Conexão & QR
          </Tabs.Trigger>
          <Tabs.Trigger
            value="manual"
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5',
              tab === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserPlus className="h-4 w-4" />
            Lead manual
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="conexao" className="mt-4 space-y-6 outline-none">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Meta Pixel (Purchase no navegador)</h2>
            <p className="text-xs text-muted-foreground">
              Ao registrar uma venda no CRM, o evento <strong>Purchase</strong> é enviado neste navegador com o valor informado (além da conversão salva no ORUS).
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="ID do Pixel (ex: 123456789012345)"
                value={pixelInput}
                onChange={e => setPixelInput(e.target.value)}
              />
              <Button
                size="sm"
                disabled={savePixel.isPending}
                onClick={() => savePixel.mutate(pixelInput.trim())}
              >
                Salvar pixel
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Webhook (Evolution API, n8n, etc.)</h2>
            <p className="text-xs text-muted-foreground">
              Quando o lead envia a primeira mensagem (com link do anúncio), seu bridge deve chamar este endpoint. O ORUS extrai UTMs da primeira URL encontrada no texto.
            </p>
            <div className="space-y-2 text-xs font-mono bg-muted/50 rounded-lg p-3 break-all">
              <div className="flex justify-between gap-2 items-start">
                <span className="text-muted-foreground">POST</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copy(settings?.webhookUrl ?? '')}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p>{settings?.webhookUrl ?? '…'}</p>
              <p className="text-muted-foreground mt-2">Headers: X-ORUS-Token: &lt;segredo&gt;</p>
              <div className="flex justify-between gap-2 items-center mt-1">
                <span className="truncate">{settings?.inboundToken ?? '…'}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => copy(settings?.inboundToken ?? '')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={rotateToken.isPending} onClick={() => rotateToken.mutate()}>
                    <RefreshCw className={cn('h-3.5 w-3.5', rotateToken.isPending && 'animate-spin')} />
                  </Button>
                </div>
              </div>
            </div>
            <pre className="text-[11px] bg-muted/80 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "${settings?.webhookUrl ?? 'URL'}" \\
  -H "Content-Type: application/json" \\
  -H "X-ORUS-TOKEN: ${settings?.inboundToken ?? 'SEU_TOKEN'}" \\
  -d '{"phone":"5511999999999","name":"Lead","message":"Oi https://site.com/?utm_source=fb&utm_campaign=teste"}'`}
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Leitor de QR (URL)
            </h2>
            <p className="text-xs text-muted-foreground">
              Se o anúncio manda um QR com link rastreável, tire foto ou exporte o QR e carregue aqui (Chrome/Edge com BarcodeDetector). O conteúdo do QR preenche o campo de mensagem abaixo para teste ou novo lead.
            </p>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                <Camera className="h-4 w-4" />
                Carregar imagem do QR
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={onQrFile} />
            </label>
            {qrHint && <p className="text-xs text-amber-600 dark:text-amber-400">{qrHint}</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Extrair UTMs de um texto (simulador)</h2>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Cole a mensagem do WhatsApp ou uma URL com UTMs…"
              value={previewMsg}
              onChange={e => setPreviewMsg(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!previewMsg.trim() || previewUtm.isPending}
              onClick={() => previewUtm.mutate(previewMsg)}
            >
              {previewUtm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pré-visualizar'}
            </Button>
            {previewUtm.data && (
              <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(previewUtm.data, null, 2)}
              </pre>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="crm" className="mt-4 outline-none space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Funil:</strong> Lead Site → Frio → Morno → Cliente → <strong>Venda</strong>.
            Ao mover para <strong>Venda</strong> (sem compra registrada), abrimos o valor para <strong>Purchase</strong> no pixel.
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="rounded-md border border-input bg-background px-3 py-2 text-sm w-40"
              placeholder="Nova coluna"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!newStageName.trim() || addStage.isPending}
              onClick={() => {
                addStage.mutate(newStageName.trim());
                setNewStageName('');
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova aba no funil
            </Button>
          </div>

          {boardLoading ? (
            <div className="h-64 rounded-xl bg-muted animate-pulse" />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4 items-start">
              {board?.map(col => (
                <div
                  key={col.id}
                  className="min-w-[280px] max-w-[320px] flex-shrink-0 rounded-xl border border-border bg-card flex flex-col max-h-[70vh]"
                >
                  <div
                    className="px-3 py-2 border-b border-border flex flex-col gap-0.5"
                    style={{ borderLeftWidth: 4, borderLeftColor: col.color ?? '#64748b' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{col.name}</span>
                      <span className="text-xs text-muted-foreground">{col.leads.length}</span>
                    </div>
                    {col.slug === 'lead-site' && (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400">Leads do formulário / tracking</span>
                    )}
                    {col.slug === 'venda' && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Informe valor · Purchase</span>
                    )}
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {col.leads.map(lead => (
                      <div key={lead.id} className="rounded-lg border border-border bg-background p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{lead.name || 'Sem nome'}</span>
                          <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium', sourceBadgeClass(lead.source))}>
                            {sourceLabel(lead.source)}
                          </span>
                        </div>
                        <div className="text-muted-foreground">{lead.phone}</div>
                        {(lead.utmSource || lead.utmCampaign) && (
                          <div className="flex flex-wrap gap-1">
                            {lead.utmSource && <span className="px-1.5 py-0.5 rounded bg-primary/15 text-[10px]">src: {lead.utmSource}</span>}
                            {lead.utmMedium && <span className="px-1.5 py-0.5 rounded bg-primary/15 text-[10px]">med: {lead.utmMedium}</span>}
                            {lead.utmCampaign && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[10px]">camp: {lead.utmCampaign}</span>}
                            {lead.fbclid && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-[10px]">fbclid</span>}
                          </div>
                        )}
                        {lead.sourceUrl && (
                          <a href={lead.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-full">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            Link
                          </a>
                        )}
                        {lead.purchaseValue != null && (
                          <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Compra: {activeProfile.currency} {lead.purchaseValue.toFixed(2)}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          <select
                            className="text-[11px] rounded border border-input bg-background px-1 py-0.5 max-w-[160px]"
                            value={lead.stageId}
                            onChange={e => handleMoveLead(lead, e.target.value)}
                          >
                            {board?.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          {lead.purchaseValue == null && (
                            <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => setPurchaseLead(lead)}>
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Compra + Pixel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="manual" className="mt-4 outline-none">
          <div className="max-w-md rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              CRM — lead manual
            </h2>
            <p className="text-xs text-muted-foreground">
              Cria ou atualiza o lead na coluna <strong>Venda</strong>, grava conversão PURCHASE no ORUS e dispara <strong>Purchase</strong> no pixel (se configurado em Conexão).
            </p>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Nome"
              value={manName}
              onChange={e => setManName(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Telefone (com DDD)"
              value={manPhone}
              onChange={e => setManPhone(e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={`Valor da compra (${activeProfile.currency})`}
              value={manValue}
              onChange={e => setManValue(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!manName.trim() || !manPhone.trim() || !manValue || manualPurchase.isPending}
              onClick={() => {
                const v = parseFloat(manValue.replace(',', '.'));
                if (!Number.isFinite(v) || v <= 0) return;
                manualPurchase.mutate({ name: manName.trim(), phone: manPhone.trim(), value: v });
              }}
            >
              {manualPurchase.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar venda + Pixel'}
            </Button>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {purchaseLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full space-y-3 shadow-xl">
            <h3 className="font-semibold">Registrar compra</h3>
            <p className="text-xs text-muted-foreground">
              Lead {purchaseLead.phone}. Valor informado dispara Purchase no pixel (se configurado) e grava conversão PURCHASE no ORUS.
            </p>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              placeholder="Valor"
              value={purchaseValue}
              onChange={e => setPurchaseValue(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPurchaseLead(null)}>Cancelar</Button>
              <Button
                size="sm"
                disabled={registerPurchase.isPending || !purchaseValue}
                onClick={() => {
                  const v = parseFloat(purchaseValue.replace(',', '.'));
                  if (!Number.isFinite(v) || v <= 0) return;
                  registerPurchase.mutate({ leadId: purchaseLead.id, value: v });
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
