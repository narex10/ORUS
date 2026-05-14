import { Router, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { parseAdParamsFromMessage, normalizePhone } from '../lib/crmZapUtm';
import { ensureCrmFunnelStages } from '../services/crmLeadSync';

const router = Router();

async function assertProfile(req: AuthRequest, profileId: string) {
  return prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
  });
}

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'aba';
}

const MANUAL_LEAD_CHANNEL = z.enum([
  'organico',
  'indicacao',
  'site',
  'trafego',
  'instagram',
  'captacao',
]);

const MANUAL_CHANNEL_LABEL: Record<z.infer<typeof MANUAL_LEAD_CHANNEL>, string> = {
  organico: 'Orgânico',
  indicacao: 'Indicação',
  site: 'Site',
  trafego: 'Tráfego',
  instagram: 'Instagram',
  captacao: 'Captação',
};

function mergeLeadRawParams(existing: string | null, patch: Record<string, unknown>): string {
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch { /* ignore */ }
  }
  return JSON.stringify({ ...base, ...patch });
}

async function ensureInboundToken(profileId: string) {
  const p = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!p) return null;
  if (p.crmZapInboundToken) return p.crmZapInboundToken;
  const token = randomBytes(24).toString('hex');
  await prisma.profile.update({
    where: { id: profileId },
    data: { crmZapInboundToken: token },
  });
  return token;
}

async function ensureDefaultStages(profileId: string) {
  await ensureCrmFunnelStages(profileId);
}

router.get('/profile/:profileId/settings', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const token = await ensureInboundToken(profileId);
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  const base = process.env.API_PUBLIC_URL?.replace(/\/$/, '') ?? `http://localhost:${process.env.PORT ?? 3001}`;
  return res.json({
    pixelId: profile?.crmZapPixelId ?? '',
    inboundToken: token,
    webhookUrl: `${base}/api/wa-inbound`,
  });
});

router.patch('/profile/:profileId/settings', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const { pixelId } = z.object({ pixelId: z.string().optional() }).parse(req.body);
  await prisma.profile.update({
    where: { id: profileId },
    data: { crmZapPixelId: pixelId?.trim() || null },
  });
  return res.json({ ok: true });
});

router.post('/profile/:profileId/settings/rotate-token', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const token = randomBytes(24).toString('hex');
  await prisma.profile.update({
    where: { id: profileId },
    data: { crmZapInboundToken: token },
  });
  return res.json({ ok: true, inboundToken: token });
});

router.get('/profile/:profileId/board', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  await ensureDefaultStages(profileId);
  await ensureInboundToken(profileId);

  const stages = await prisma.crmStage.findMany({
    where: { profileId },
    orderBy: { sortOrder: 'asc' },
    include: {
      leads: { orderBy: { updatedAt: 'desc' } },
    },
  });
  return res.json(stages);
});

const stageCreateSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

router.post('/profile/:profileId/stages', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const { name, color } = stageCreateSchema.parse(req.body);
  const maxOrder = await prisma.crmStage.aggregate({
    where: { profileId },
    _max: { sortOrder: true },
  });
  let slug = slugify(name);
  let n = 0;
  while (await prisma.crmStage.findFirst({ where: { profileId, slug } })) {
    n++;
    slug = `${slugify(name)}-${n}`;
  }
  const stage = await prisma.crmStage.create({
    data: {
      profileId,
      name: name.trim(),
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      color: color ?? null,
    },
  });
  return res.json(stage);
});

router.patch('/profile/:profileId/stages/:stageId', async (req: AuthRequest, res: Response) => {
  const { profileId, stageId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const body = z
    .object({
      name: z.string().min(1).optional(),
      color: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    })
    .parse(req.body);

  const stage = await prisma.crmStage.findFirst({ where: { id: stageId, profileId } });
  if (!stage) return res.status(404).json({ error: 'Coluna não encontrada' });

  const updated = await prisma.crmStage.update({
    where: { id: stageId },
    data: {
      ...(body.name && { name: body.name.trim() }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });
  return res.json(updated);
});

router.delete('/profile/:profileId/stages/:stageId', async (req: AuthRequest, res: Response) => {
  const { profileId, stageId } = req.params;
  const { moveToStageId } = req.query as { moveToStageId?: string };
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }

  const stages = await prisma.crmStage.findMany({
    where: { profileId },
    orderBy: { sortOrder: 'asc' },
  });
  if (stages.length <= 1) {
    return res.status(400).json({ error: 'É necessário manter ao menos uma coluna' });
  }

  const target = stages.find(s => s.id === stageId);
  if (!target) return res.status(404).json({ error: 'Coluna não encontrada' });

  const fallback =
    moveToStageId && stages.some(s => s.id === moveToStageId && s.id !== stageId)
      ? moveToStageId
      : stages.find(s => s.id !== stageId)!.id;

  await prisma.$transaction([
    prisma.crmLead.updateMany({
      where: { stageId, profileId },
      data: { stageId: fallback },
    }),
    prisma.crmStage.delete({ where: { id: stageId } }),
  ]);
  return res.json({ ok: true });
});

router.post('/profile/:profileId/leads', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  await ensureDefaultStages(profileId);

  const body = z
    .object({
      phone: z.string().min(3),
      name: z.string().optional(),
      stageId: z.string().optional(),
      message: z.string().optional(),
    })
    .parse(req.body);

  const phone = normalizePhone(body.phone);
  let stageId = body.stageId;
  if (!stageId) {
    const frio = await prisma.crmStage.findFirst({ where: { profileId, slug: 'frio' } });
    const fallback = await prisma.crmStage.findFirst({
      where: { profileId },
      orderBy: { sortOrder: 'asc' },
    });
    stageId = frio?.id ?? fallback!.id;
  } else {
    const ok = await prisma.crmStage.findFirst({ where: { id: stageId, profileId } });
    if (!ok) return res.status(400).json({ error: 'Coluna inválida' });
  }

  const parsed = parseAdParamsFromMessage(body.message);
  const lead = await prisma.crmLead.create({
    data: {
      profileId,
      stageId,
      phone,
      name: body.name?.trim(),
      firstMessage: body.message?.trim(),
      sourceUrl: parsed.sourceUrl,
      utmSource: parsed.utmSource,
      utmMedium: parsed.utmMedium,
      utmCampaign: parsed.utmCampaign,
      utmContent: parsed.utmContent,
      utmTerm: parsed.utmTerm,
      fbclid: parsed.fbclid,
      gclid: parsed.gclid,
      siteCampaignId: parsed.siteCampaignId,
      siteCampaignName: parsed.siteCampaignName,
      rawParams: parsed.rawParams,
      source: 'WHATSAPP',
    },
  });
  return res.json(lead);
});

router.patch('/profile/:profileId/leads/:leadId', async (req: AuthRequest, res: Response) => {
  const { profileId, leadId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const body = z
    .object({
      stageId: z.string().optional(),
      name: z.string().optional(),
    })
    .parse(req.body);

  const lead = await prisma.crmLead.findFirst({ where: { id: leadId, profileId } });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  if (body.stageId) {
    const st = await prisma.crmStage.findFirst({ where: { id: body.stageId, profileId } });
    if (!st) return res.status(400).json({ error: 'Coluna inválida' });
  }

  const updated = await prisma.crmLead.update({
    where: { id: leadId },
    data: {
      ...(body.stageId && { stageId: body.stageId }),
      ...(body.name !== undefined && { name: body.name.trim() || null }),
    },
  });
  return res.json(updated);
});

router.post('/profile/:profileId/leads/:leadId/purchase', async (req: AuthRequest, res: Response) => {
  const { profileId, leadId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const { value, currency } = z
    .object({
      value: z.number().positive(),
      currency: z.string().default('BRL'),
    })
    .parse(req.body);

  const lead = await prisma.crmLead.findFirst({ where: { id: leadId, profileId } });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await prisma.$transaction([
    prisma.crmLead.update({
      where: { id: leadId },
      data: {
        purchaseValue: value,
        purchaseAt: new Date(),
        pixelPurchaseFiredAt: new Date(),
      },
    }),
    prisma.siteConversion.create({
      data: {
        profileId,
        type: 'PURCHASE',
        value,
        phone: lead.phone,
        utmCampaign: lead.utmCampaign,
        utmContent: lead.utmContent,
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        siteCampaignId: lead.siteCampaignId,
        siteCampaignName: lead.siteCampaignName,
        pageUrl: lead.sourceUrl,
        rawParams: lead.rawParams,
        referrer: 'CRM_ZAP',
      },
    }),
  ]);

  return res.json({
    ok: true,
    value,
    currency,
    firePixelPurchase: true,
  });
});

router.post('/profile/:profileId/leads/manual-purchase', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  await ensureDefaultStages(profileId);

  const body = z
    .object({
      name: z.string().min(1),
      phone: z.string().min(3),
      value: z.number().positive(),
      currency: z.string().default('BRL'),
      channel: MANUAL_LEAD_CHANNEL,
    })
    .parse(req.body);

  const venda = await prisma.crmStage.findFirst({ where: { profileId, slug: 'venda' } });
  if (!venda) return res.status(500).json({ error: 'Coluna Venda não encontrada' });

  const phone = normalizePhone(body.phone);
  const now = new Date();
  const mergedRaw = (prev: string | null) =>
    mergeLeadRawParams(prev, { manualChannel: body.channel });

  let lead = await prisma.crmLead.findFirst({ where: { profileId, phone } });

  if (lead) {
    await prisma.$transaction([
      prisma.crmLead.update({
        where: { id: lead.id },
        data: {
          name: body.name.trim(),
          stageId: venda.id,
          source: 'MANUAL',
          rawParams: mergedRaw(lead.rawParams),
          purchaseValue: body.value,
          purchaseAt: now,
          pixelPurchaseFiredAt: now,
        },
      }),
      prisma.siteConversion.create({
        data: {
          profileId,
          type: 'PURCHASE',
          value: body.value,
          phone,
          utmCampaign: lead.utmCampaign,
          utmContent: lead.utmContent,
          utmSource: lead.utmSource,
          utmMedium: lead.utmMedium,
          siteCampaignId: lead.siteCampaignId,
          siteCampaignName: lead.siteCampaignName,
          pageUrl: lead.sourceUrl,
          rawParams: mergedRaw(lead.rawParams),
          referrer: 'CRM_ZAP_MANUAL',
        },
      }),
    ]);
    lead = await prisma.crmLead.findUnique({ where: { id: lead.id } });
  } else {
    lead = await prisma.$transaction(async (tx) => {
      const created = await tx.crmLead.create({
        data: {
          profileId,
          stageId: venda.id,
          phone,
          name: body.name.trim(),
          source: 'MANUAL',
          firstMessage: `Cadastro manual CRM · ${MANUAL_CHANNEL_LABEL[body.channel]}`,
          rawParams: mergedRaw(null),
          purchaseValue: body.value,
          purchaseAt: now,
          pixelPurchaseFiredAt: now,
        },
      });
      await tx.siteConversion.create({
        data: {
          profileId,
          type: 'PURCHASE',
          value: body.value,
          phone,
          rawParams: mergedRaw(null),
          referrer: 'CRM_ZAP_MANUAL',
        },
      });
      return created;
    });
  }

  return res.json({
    ok: true,
    leadId: lead!.id,
    value: body.value,
    currency: body.currency,
    firePixelPurchase: true,
  });
});

router.post('/profile/:profileId/preview-utm', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  if (!(await assertProfile(req, profileId))) {
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }
  const { message } = z.object({ message: z.string() }).parse(req.body);
  const parsed = parseAdParamsFromMessage(message);
  return res.json(parsed);
});

export default router;
