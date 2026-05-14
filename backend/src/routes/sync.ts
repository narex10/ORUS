import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { syncMetaIntegration, validateMetaToken, diagnoseMetaAccount } from '../services/metaService';
import { syncGA4Integration } from '../services/ga4Service';
import { decrypt } from '../lib/crypto';

const router = Router();

// ─── Rotas estáticas SEMPRE antes das dinâmicas ───────────────

// ─── POST /api/sync/validate/meta ─── Valida token + conta ───

router.post('/validate/meta', async (req: AuthRequest, res: Response) => {
  const { token, accountId } = req.body;

  if (!token || !accountId) {
    return res.status(400).json({ error: 'token e accountId são obrigatórios' });
  }

  try {
    const info = await validateMetaToken(token, accountId);
    return res.json(info);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/sync/diagnose/meta ─── Diagnóstico de acesso ──

router.post('/diagnose/meta', async (req: AuthRequest, res: Response) => {
  const { integrationId } = req.body;

  if (!integrationId) {
    return res.status(400).json({ error: 'integrationId é obrigatório' });
  }

  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, profile: { userId: req.userId! } },
  });

  if (!integration) return res.status(404).json({ error: 'Integração não encontrada' });
  if (!integration.encryptedToken) return res.status(400).json({ error: 'Token não configurado para esta integração.' });
  if (!integration.accountId) return res.status(400).json({ error: 'Ad Account ID não configurado.' });

  try {
    const token = decrypt(integration.encryptedToken);
    const result = await diagnoseMetaAccount(token, integration.accountId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/sync/status/:integrationId ─── Status + últimas execuções ──

router.get('/status/:integrationId', async (req: AuthRequest, res: Response) => {
  const integration = await prisma.integration.findFirst({
    where: {
      id: req.params.integrationId,
      profile: { userId: req.userId! },
    },
    select: {
      id: true, type: true, label: true, isActive: true,
      lastSyncAt: true, accountId: true,
    },
  });

  if (!integration) {
    return res.status(404).json({ error: 'Integração não encontrada' });
  }

  // Contagens atuais no banco
  const [campaigns, conversions] = await Promise.all([
    prisma.campaign.count({
      where: { integrationId: req.params.integrationId },
    }),
    prisma.siteConversion.count({
      where: { profile: { integrations: { some: { id: req.params.integrationId } } } },
    }),
  ]);

  return res.json({
    ...integration,
    stats: { campaigns, conversions },
  });
});

// ─── POST /api/sync/:integrationId ─── Dispara sync manual ───
// Deve ficar DEPOIS das rotas estáticas acima

router.post('/:integrationId', async (req: AuthRequest, res: Response) => {
  const integration = await prisma.integration.findFirst({
    where: {
      id: req.params.integrationId,
      profile: { userId: req.userId! },
    },
  });

  if (!integration) {
    return res.status(404).json({ error: 'Integração não encontrada' });
  }

  if (!integration.isActive) {
    return res.status(400).json({ error: 'Integração desativada. Configure o token antes de sincronizar.' });
  }

  try {
    let result: Record<string, unknown> = {};

    switch (integration.type) {
      case 'META_BMS':
        result = await syncMetaIntegration(integration.id);
        break;

      case 'GA4':
        result = await syncGA4Integration(integration.id);
        break;

      default:
        return res.status(400).json({
          error: `Sync não implementado para ${integration.type}`,
          hint: 'Disponível: META_BMS, GA4',
        });
    }

    return res.json({
      ok: true,
      integration: { id: integration.id, type: integration.type, label: integration.label },
      result,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[Sync] Error syncing ${integration.type}:`, err.message);
    return res.status(500).json({
      error: err.message ?? 'Erro ao sincronizar integração',
    });
  }
});

export default router;
