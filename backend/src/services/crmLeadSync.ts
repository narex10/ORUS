import { prisma } from '../lib/prisma';
import { normalizePhone } from '../lib/crmZapUtm';

/** Colunas padrão do funil (IDs estáveis por slug). Só cria as que faltam. */
const FUNNEL_STAGES = [
  { slug: 'lead-site', name: 'Lead Site', sortOrder: -10, color: '#38bdf8' },
  { slug: 'frio', name: 'Frio', sortOrder: 1, color: '#60a5fa' },
  { slug: 'morno', name: 'Morno', sortOrder: 2, color: '#fbbf24' },
  { slug: 'cliente', name: 'Cliente', sortOrder: 3, color: '#34d399' },
  { slug: 'venda', name: 'Venda', sortOrder: 90, color: '#22c55e' },
] as const;

export async function ensureCrmFunnelStages(profileId: string): Promise<void> {
  for (const row of FUNNEL_STAGES) {
    const exists = await prisma.crmStage.findFirst({
      where: { profileId, slug: row.slug },
    });
    if (!exists) {
      await prisma.crmStage.create({
        data: {
          profileId,
          name: row.name,
          slug: row.slug,
          sortOrder: row.sortOrder,
          color: row.color,
        },
      });
    }
  }
}

/** Lead vindo do script de rastreamento (formulário no site). Vai para coluna Lead Site. */
export async function upsertCrmLeadFromSiteConversion(input: {
  profileId: string;
  phone?: string | null;
  email?: string | null;
  fingerprint?: string | null;
  sessionId?: string | null;
  pageUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  creativeId?: string | null;
  adsetId?: string | null;
  siteCampaignId?: string | null;
  siteCampaignName?: string | null;
  rawParams?: string | null;
}): Promise<void> {
  await ensureCrmFunnelStages(input.profileId);
  const stage = await prisma.crmStage.findFirst({
    where: { profileId: input.profileId, slug: 'lead-site' },
  });
  if (!stage) return;

  const phoneRaw = input.phone?.trim();
  let phone = phoneRaw ? normalizePhone(phoneRaw) : '';
  if (!phone) {
    const key = input.fingerprint || input.sessionId || `t${Date.now()}`;
    phone = `site:${String(key).replace(/\D/g, '').slice(0, 24) || key.slice(0, 24)}`;
  }

  const displayName = input.email?.trim()
    ? input.email.trim().split('@')[0]
    : null;

  const existing = await prisma.crmLead.findFirst({
    where: { profileId: input.profileId, phone },
  });

  const firstLine = input.pageUrl
    ? `Lead site · ${input.pageUrl}`
    : 'Lead capturado no site';

  if (existing) {
    await prisma.crmLead.update({
      where: { id: existing.id },
      data: {
        source: 'SITE',
        name: existing.name || displayName,
        firstMessage: existing.firstMessage || firstLine,
        sourceUrl: input.pageUrl ?? existing.sourceUrl,
        utmSource: input.utmSource ?? existing.utmSource,
        utmMedium: input.utmMedium ?? existing.utmMedium,
        utmCampaign: input.utmCampaign ?? existing.utmCampaign,
        utmContent: input.utmContent ?? existing.utmContent,
        siteCampaignId: input.siteCampaignId ?? existing.siteCampaignId,
        siteCampaignName: input.siteCampaignName ?? existing.siteCampaignName,
        rawParams: input.rawParams ?? existing.rawParams,
      },
    });
    return;
  }

  await prisma.crmLead.create({
    data: {
      profileId: input.profileId,
      stageId: stage.id,
      phone,
      name: displayName,
      source: 'SITE',
      firstMessage: firstLine,
      sourceUrl: input.pageUrl,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      siteCampaignId: input.siteCampaignId,
      siteCampaignName: input.siteCampaignName,
      rawParams: input.rawParams,
    },
  });
}
