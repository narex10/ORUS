import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { encrypt } from '../lib/crypto';

const router = Router();

const createSchema = z.object({
  type: z.string(),
  label: z.string().min(1),
  accountId: z.string().optional(),
  token: z.string().optional(),
  extraConfig: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  accountId: z.string().optional(),
  token: z.string().optional(),
  extraConfig: z.record(z.unknown()).optional(),
});

router.get('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const integrations = await prisma.integration.findMany({
    where: { profileId: req.params.profileId },
    select: {
      id: true, type: true, label: true, accountId: true,
      isActive: true, lastSyncAt: true, createdAt: true, extraConfig: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.json(integrations);
});

router.post('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findFirst({
      where: { id: req.params.profileId, userId: req.userId! },
    });
    if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

    const body = createSchema.parse(req.body);
    const extraConfig: Record<string, unknown> = { ...(body.extraConfig ?? {}) };

    const integration = await prisma.integration.create({
      data: {
        profileId: req.params.profileId,
        type: body.type,
        label: body.label,
        accountId: body.accountId,
        encryptedToken: body.token ? encrypt(body.token) : undefined,
        extraConfig: Object.keys(extraConfig).length > 0
          ? JSON.stringify(extraConfig)
          : undefined,
        isActive: !!body.token,
      },
      select: {
        id: true, type: true, label: true, accountId: true,
        isActive: true, createdAt: true, extraConfig: true,
      },
    });

    return res.status(201).json(integration);
  } catch (err: any) {
    console.error('[Integration create error]', err);
    return res.status(500).json({ error: err?.message ?? 'Erro ao criar integração' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const integration = await prisma.integration.findFirst({
      where: { id: req.params.id, profile: { userId: req.userId! } },
    });
    if (!integration) return res.status(404).json({ error: 'Integração não encontrada' });

    const body = updateSchema.parse(req.body);
    const data: Record<string, unknown> = {};

    if (body.label !== undefined) data.label = body.label;
    if (body.accountId !== undefined) data.accountId = body.accountId || null;
    if (body.token !== undefined) {
      data.encryptedToken = body.token ? encrypt(body.token) : null;
      data.isActive = !!body.token;
    }
    if (body.extraConfig !== undefined) {
      data.extraConfig = Object.keys(body.extraConfig).length > 0
        ? JSON.stringify(body.extraConfig)
        : null;
    }

    const updated = await prisma.integration.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, type: true, label: true, accountId: true,
        isActive: true, lastSyncAt: true, createdAt: true, extraConfig: true,
      },
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('[Integration update error]', err);
    return res.status(500).json({ error: err?.message ?? 'Erro ao atualizar integração' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const integration = await prisma.integration.findFirst({
      where: { id: req.params.id, profile: { userId: req.userId! } },
    });
    if (!integration) return res.status(404).json({ error: 'Integração não encontrada' });

    await prisma.campaign.deleteMany({ where: { integrationId: req.params.id } });
    await prisma.integration.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[Integration delete error]', err);
    return res.status(500).json({ error: err?.message ?? 'Erro ao deletar integração' });
  }
});

// Gera/lista tracking keys do perfil
router.get('/profile/:profileId/tracking-keys', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const keys = await prisma.trackingKey.findMany({
    where: { profileId: req.params.profileId },
    select: { id: true, key: true, label: true, isActive: true, createdAt: true },
  });
  return res.json(keys);
});

router.post('/profile/:profileId/tracking-keys', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const { label } = req.body;
  const trackingKey = await prisma.trackingKey.create({
    data: { profileId: req.params.profileId, label },
    select: { id: true, key: true, label: true, isActive: true, createdAt: true },
  });

  return res.status(201).json(trackingKey);
});

export default router;
