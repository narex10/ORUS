import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  profileId: z.string(),
  label: z.string().min(1),
  config: z.object({
    leads:          z.boolean().default(true),
    pageviews:      z.boolean().default(true),
    buttons:        z.boolean().default(false),
    buttonSelector: z.string().optional(),
  }),
});

// Lista chaves de um perfil
router.get('/', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.query as { profileId: string };
  if (!profileId) return res.status(400).json({ error: 'profileId obrigatório' });

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const keys = await prisma.trackingKey.findMany({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(keys);
});

// Cria uma nova chave com configuração
router.post('/', async (req: AuthRequest, res: Response) => {
  const body = createSchema.parse(req.body);

  const profile = await prisma.profile.findFirst({
    where: { id: body.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const key = await prisma.trackingKey.create({
    data: {
      profileId: body.profileId,
      label: body.label,
      config: JSON.stringify(body.config),
    },
  });

  return res.status(201).json(key);
});

// Deleta (desativa) uma chave
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const key = await prisma.trackingKey.findFirst({
    where: { id, profile: { userId: req.userId! } },
  });
  if (!key) return res.status(404).json({ error: 'Chave não encontrada' });

  await prisma.trackingKey.delete({ where: { id } });

  return res.json({ ok: true });
});

export default router;
