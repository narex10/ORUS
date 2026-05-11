import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const ruleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  targetLevel: z.enum(['CAMPAIGN', 'ADSET', 'AD']),
  platform: z.string(),
  checkInterval: z.number().default(60),
  conditions: z.array(z.object({
    type: z.string(),
    operator: z.enum(['AND', 'OR']).default('AND'),
    value: z.number(),
    window: z.number().default(1),
  })),
  actions: z.array(z.object({
    type: z.string(),
    payload: z.record(z.unknown()).optional(),
  })),
});

router.get('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const rules = await prisma.automationRule.findMany({
    where: { profileId: req.params.profileId },
    include: {
      conditions: true,
      actions: true,
      _count: { select: { executions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(rules);
});

router.post('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const body = ruleSchema.parse(req.body);

  const rule = await prisma.automationRule.create({
    data: {
      profileId: req.params.profileId,
      name: body.name,
      description: body.description,
      targetLevel: body.targetLevel,
      platform: body.platform,
      checkInterval: body.checkInterval,
      conditions: { create: body.conditions },
      actions: { create: body.actions.map(a => ({ type: a.type, payload: a.payload ? JSON.stringify(a.payload) : null })) },
    },
    include: { conditions: true, actions: true },
  });

  return res.status(201).json(rule);
});

router.patch('/:id/toggle', async (req: AuthRequest, res: Response) => {
  const rule = await prisma.automationRule.findFirst({
    where: { id: req.params.id, profile: { userId: req.userId! } },
  });
  if (!rule) return res.status(404).json({ error: 'Regra não encontrada' });

  const updated = await prisma.automationRule.update({
    where: { id: req.params.id },
    data: { isActive: !rule.isActive },
  });
  return res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const rule = await prisma.automationRule.findFirst({
    where: { id: req.params.id, profile: { userId: req.userId! } },
  });
  if (!rule) return res.status(404).json({ error: 'Regra não encontrada' });

  await prisma.automationRule.delete({ where: { id: req.params.id } });
  return res.json({ ok: true });
});

export default router;
