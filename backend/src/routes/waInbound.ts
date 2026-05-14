import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { parseAdParamsFromMessage, normalizePhone } from '../lib/crmZapUtm';
import { ensureCrmFunnelStages } from '../services/crmLeadSync';

const router = Router();

const bodySchema = z.object({
  phone: z.string().min(3),
  name: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Webhook público para bridges (Evolution API, n8n, etc.).
 * Header: X-ORUS-Token — mesmo valor que aparece em CRM Zap → Conexão.
 */
router.post('/wa-inbound', async (req: Request, res: Response) => {
  const token = (req.headers['x-orus-token'] ?? req.headers['x-wa-token']) as string | undefined;
  if (!token?.trim()) {
    return res.status(401).json({ error: 'Cabeçalho X-ORUS-Token obrigatório' });
  }

  const profile = await prisma.profile.findFirst({
    where: { crmZapInboundToken: token.trim() },
  });
  if (!profile) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const body = bodySchema.parse(req.body);
  const phone = normalizePhone(body.phone);
  const parsed = parseAdParamsFromMessage(body.message);

  await ensureCrmFunnelStages(profile.id);

  const frio = await prisma.crmStage.findFirst({
    where: { profileId: profile.id, slug: 'frio' },
  });
  const defaultStage =
    frio ??
    (await prisma.crmStage.findFirst({
      where: { profileId: profile.id },
      orderBy: { sortOrder: 'asc' },
    }));
  if (!defaultStage) {
    return res.status(503).json({ error: 'CRM sem colunas. Abra CRM Zap no painel.' });
  }
  const defaultStageId = defaultStage.id;

  const existing = await prisma.crmLead.findFirst({
    where: { profileId: profile.id, phone },
  });

  const baseData = {
    name: body.name?.trim() || existing?.name,
    firstMessage: body.message?.trim() || existing?.firstMessage,
    sourceUrl: parsed.sourceUrl ?? existing?.sourceUrl,
    utmSource: parsed.utmSource ?? existing?.utmSource,
    utmMedium: parsed.utmMedium ?? existing?.utmMedium,
    utmCampaign: parsed.utmCampaign ?? existing?.utmCampaign,
    utmContent: parsed.utmContent ?? existing?.utmContent,
    utmTerm: parsed.utmTerm ?? existing?.utmTerm,
    fbclid: parsed.fbclid ?? existing?.fbclid,
    gclid: parsed.gclid ?? existing?.gclid,
    siteCampaignId: parsed.siteCampaignId ?? existing?.siteCampaignId,
    siteCampaignName: parsed.siteCampaignName ?? existing?.siteCampaignName,
    rawParams: parsed.rawParams ?? existing?.rawParams,
  };

  if (existing) {
    const lead = await prisma.crmLead.update({
      where: { id: existing.id },
      data: { ...baseData, source: 'WHATSAPP' },
    });
    return res.json({ ok: true, leadId: lead.id, updated: true });
  }

  const lead = await prisma.crmLead.create({
    data: {
      profileId: profile.id,
      stageId: defaultStageId,
      phone,
      source: 'WHATSAPP',
      name: baseData.name,
      firstMessage: baseData.firstMessage,
      sourceUrl: baseData.sourceUrl,
      utmSource: baseData.utmSource,
      utmMedium: baseData.utmMedium,
      utmCampaign: baseData.utmCampaign,
      utmContent: baseData.utmContent,
      utmTerm: baseData.utmTerm,
      fbclid: baseData.fbclid,
      gclid: baseData.gclid,
      siteCampaignId: baseData.siteCampaignId,
      siteCampaignName: baseData.siteCampaignName,
      rawParams: baseData.rawParams,
    },
  });

  return res.json({ ok: true, leadId: lead.id, updated: false });
});

export default router;
