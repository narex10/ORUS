import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  filters: z.record(z.unknown()),
});

router.get('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const audiences = await prisma.audience.findMany({
    where: { profileId: req.params.profileId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(audiences);
});

router.post('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const body = createSchema.parse(req.body);

  const audience = await prisma.audience.create({
    data: {
      profileId: req.params.profileId,
      name: body.name,
      description: body.description,
      filters: body.filters,
    },
  });

  return res.status(201).json(audience);
});

// Exporta membros como CSV
router.get('/:id/export', async (req: AuthRequest, res: Response) => {
  const audience = await prisma.audience.findFirst({
    where: { id: req.params.id, profile: { userId: req.userId! } },
    include: { members: true },
  });
  if (!audience) return res.status(404).json({ error: 'Audiência não encontrada' });

  const rows = ['email,phone,fingerprint,addedAt'];
  audience.members.forEach(m => {
    rows.push(`${m.email ?? ''},${m.phone ?? ''},${m.fingerprint ?? ''},${m.addedAt.toISOString()}`);
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${audience.name}.csv"`);
  return res.send(rows.join('\n'));
});

export default router;
