import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

function getExpiresAt() {
  const ms = 7 * 24 * 60 * 60 * 1000; // 7 days
  return new Date(Date.now() + ms);
}

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) {
    return res.status(409).json({ error: 'E-mail já cadastrado' });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = generateToken(user.id);
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt: getExpiresAt() },
  });

  return res.status(201).json({ token, user });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = generateToken(user.id);
  await prisma.session.create({
    data: { userId: user.id, token, expiresAt: getExpiresAt() },
  });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
}

export async function logout(req: AuthRequest, res: Response) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.slice(7);
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  return res.json({ ok: true });
}

export async function me(req: AuthRequest, res: Response) {
  return res.json({ user: req.user });
}
