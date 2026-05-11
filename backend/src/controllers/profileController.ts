import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const createSchema = z.object({
  name: z.string().min(2),
  logoUrl: z.string().url().optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
});

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function listProfiles(req: AuthRequest, res: Response) {
  const profiles = await prisma.profile.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      timezone: true,
      currency: true,
      createdAt: true,
      _count: { select: { integrations: true, campaigns: true } },
    },
  });
  return res.json(profiles);
}

export async function createProfile(req: AuthRequest, res: Response) {
  const body = createSchema.parse(req.body);
  const slug = makeSlug(body.name);

  const existing = await prisma.profile.findUnique({
    where: { userId_slug: { userId: req.userId!, slug } },
  });
  if (existing) {
    return res.status(409).json({ error: 'Já existe um perfil com esse nome' });
  }

  const profile = await prisma.profile.create({
    data: {
      userId: req.userId!,
      name: body.name,
      slug,
      logoUrl: body.logoUrl,
      timezone: body.timezone ?? 'America/Sao_Paulo',
      currency: body.currency ?? 'BRL',
    },
  });

  return res.status(201).json(profile);
}

export async function getProfile(req: AuthRequest, res: Response) {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: {
      integrations: { where: { isActive: true } },
      _count: { select: { campaigns: true, audiences: true, conversions: true } },
    },
  });

  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });
  return res.json(profile);
}

export async function updateProfile(req: AuthRequest, res: Response) {
  const body = createSchema.partial().parse(req.body);

  const profile = await prisma.profile.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const updated = await prisma.profile.update({
    where: { id: req.params.id },
    data: body,
  });
  return res.json(updated);
}

export async function deleteProfile(req: AuthRequest, res: Response) {
  const profile = await prisma.profile.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  await prisma.profile.delete({ where: { id: req.params.id } });
  return res.json({ ok: true });
}
