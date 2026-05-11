import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  user?: { id: string; email: string; name: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida' });
    }

    req.userId = payload.userId;
    req.user = session.user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
