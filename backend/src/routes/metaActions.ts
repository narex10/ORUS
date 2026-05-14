import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { pauseMetaObject, updateMetaBudget, duplicateMetaCampaign } from '../services/metaService';
import { prisma } from '../lib/prisma';

const router = Router();

// Verificação de propriedade antes de qualquer ação
async function verifyCampaignOwner(campaignId: string, userId: string): Promise<boolean> {
  const c = await prisma.campaign.findFirst({ where: { id: campaignId, profile: { userId } } });
  return !!c;
}

async function verifyAdSetOwner(adSetId: string, userId: string): Promise<boolean> {
  const a = await prisma.adSet.findFirst({
    where: { id: adSetId, campaign: { profile: { userId } } },
  });
  return !!a;
}

// Pause / Resume — campanha ou conjunto
router.post('/pause', async (req: AuthRequest, res: Response) => {
  const { entityId, entityType, status } = z.object({
    entityId:   z.string(),
    entityType: z.enum(['campaign', 'adset']),
    status:     z.enum(['ACTIVE', 'PAUSED']),
  }).parse(req.body);

  const allowed = entityType === 'campaign'
    ? await verifyCampaignOwner(entityId, req.userId!)
    : await verifyAdSetOwner(entityId, req.userId!);
  if (!allowed) return res.status(403).json({ error: 'Acesso negado' });

  await pauseMetaObject(entityId, entityType, status);
  return res.json({ ok: true, status });
});

// Atualizar orçamento diário
router.post('/budget', async (req: AuthRequest, res: Response) => {
  const { campaignId, dailyBudget } = z.object({
    campaignId:  z.string(),
    dailyBudget: z.number().positive(),
  }).parse(req.body);

  if (!(await verifyCampaignOwner(campaignId, req.userId!)))
    return res.status(403).json({ error: 'Acesso negado' });

  await updateMetaBudget(campaignId, dailyBudget);
  return res.json({ ok: true, dailyBudget });
});

// Duplicar campanha
router.post('/duplicate', async (req: AuthRequest, res: Response) => {
  const { campaignId } = z.object({ campaignId: z.string() }).parse(req.body);

  if (!(await verifyCampaignOwner(campaignId, req.userId!)))
    return res.status(403).json({ error: 'Acesso negado' });

  const newId = await duplicateMetaCampaign(campaignId);
  return res.json({ ok: true, metaCampaignId: newId });
});

export default router;
