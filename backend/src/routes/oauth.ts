import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, authenticate } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/crypto';
import { env } from '../config/env';

const router = Router();
const META_API = 'https://graph.facebook.com/v21.0';
const META_SCOPES = 'ads_read,ads_management,business_management,pages_show_list';

// ─── Helpers ─────────────────────────────────────────────────

function getRedirectUri() {
  return `${env.FRONTEND_URL.replace('5173', '3001')}/api/oauth/meta/callback`;
}

async function exchangeCodeForToken(code: string, appId: string, appSecret: string): Promise<string> {
  const url = new URL(`${META_API}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('code', code);

  const res = await fetch(url.toString());
  const data = await res.json() as any;

  if (data.error) throw new Error(data.error.message);
  return data.access_token as string;
}

async function getLongLivedToken(shortToken: string, appId: string, appSecret: string): Promise<{
  token: string;
  expiresIn: number;
}> {
  const url = new URL(`${META_API}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);

  const res = await fetch(url.toString());
  const data = await res.json() as any;

  if (data.error) throw new Error(data.error.message);
  return { token: data.access_token, expiresIn: data.expires_in ?? 5183944 };
}

async function getTokenInfo(token: string): Promise<{ userId: string; name: string }> {
  const res = await fetch(`${META_API}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return { userId: data.id, name: data.name };
}

async function getAdAccounts(token: string): Promise<Array<{ id: string; name: string; currency: string; status: number }>> {
  const res = await fetch(
    `${META_API}/me/adaccounts?fields=id,name,currency,account_status&limit=50&access_token=${encodeURIComponent(token)}`
  );
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return (data.data ?? []) as any[];
}

// ─── POST /api/oauth/meta/url ─── Gera URL de autorização ────
// (autenticado — precisa saber qual integração vincular)

router.post('/meta/url', authenticate, async (req: AuthRequest, res: Response) => {
  const { integrationId } = req.body;

  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, profile: { userId: req.userId! } },
  });

  if (!integration) return res.status(404).json({ error: 'Integração não encontrada' });

  const config = integration.extraConfig ? JSON.parse(integration.extraConfig) : {};
  if (!config.appId) return res.status(400).json({ error: 'App ID não configurado nesta integração' });

  // state = integrationId (verificado no callback)
  const state = Buffer.from(JSON.stringify({ integrationId, userId: req.userId })).toString('base64');

  const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  oauthUrl.searchParams.set('client_id', config.appId);
  oauthUrl.searchParams.set('redirect_uri', getRedirectUri());
  oauthUrl.searchParams.set('scope', META_SCOPES);
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('response_type', 'code');

  return res.json({ url: oauthUrl.toString() });
});

// ─── GET /api/oauth/meta/callback ─── Recebe o code do Facebook

router.get('/meta/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  // Redireciona para o frontend com mensagem de erro se usuário cancelou
  if (error) {
    return res.redirect(
      `${env.FRONTEND_URL}/integrations?oauth_error=${encodeURIComponent(error_description ?? error)}`
    );
  }

  if (!code || !state) {
    return res.redirect(`${env.FRONTEND_URL}/integrations?oauth_error=missing_code`);
  }

  let integrationId: string;
  let userId: string;

  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    integrationId = decoded.integrationId;
    userId = decoded.userId;
  } catch {
    return res.redirect(`${env.FRONTEND_URL}/integrations?oauth_error=invalid_state`);
  }

  try {
    const integration = await prisma.integration.findFirst({
      where: { id: integrationId, profile: { userId } },
    });

    if (!integration) {
      return res.redirect(`${env.FRONTEND_URL}/integrations?oauth_error=integration_not_found`);
    }

    const config = integration.extraConfig ? JSON.parse(integration.extraConfig) : {};
    const { appId, appSecret } = config;

    if (!appId || !appSecret) {
      return res.redirect(`${env.FRONTEND_URL}/integrations?oauth_error=missing_app_credentials`);
    }

    const decryptedAppSecret = decrypt(appSecret);

    // 1. Troca code por short-lived token
    const shortToken = await exchangeCodeForToken(code, appId, decryptedAppSecret);

    // 2. Converte para long-lived token (~60 dias)
    const { token: longToken, expiresIn } = await getLongLivedToken(shortToken, appId, decryptedAppSecret);

    // 3. Busca info do usuário e contas de anúncios
    const [userInfo, adAccounts] = await Promise.all([
      getTokenInfo(longToken),
      getAdAccounts(longToken),
    ]);

    // 4. Salva token + info no banco
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const updatedConfig = {
      ...config,
      appSecret,             // mantém criptografado
      connectedUserId: userInfo.userId,
      connectedUserName: userInfo.name,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
      adAccounts: adAccounts.map(a => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        status: a.status,
      })),
    };

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        encryptedToken: encrypt(longToken),
        isActive: true,
        lastSyncAt: null,
        extraConfig: JSON.stringify(updatedConfig),
      },
    });

    // Redireciona para o frontend com sucesso
    const successParams = new URLSearchParams({
      oauth_success: '1',
      integration_id: integrationId,
      user_name: userInfo.name,
      accounts: String(adAccounts.length),
    });

    return res.redirect(`${env.FRONTEND_URL}/integrations?${successParams.toString()}`);
  } catch (err: any) {
    console.error('[OAuth Meta Callback]', err);
    return res.redirect(
      `${env.FRONTEND_URL}/integrations?oauth_error=${encodeURIComponent(err.message ?? 'Erro desconhecido')}`
    );
  }
});

// ─── GET /api/oauth/meta/accounts/:integrationId ─── Lista contas vinculadas

router.get('/meta/accounts/:integrationId', authenticate, async (req: AuthRequest, res: Response) => {
  const integration = await prisma.integration.findFirst({
    where: { id: req.params.integrationId, profile: { userId: req.userId! } },
  });
  if (!integration) return res.status(404).json({ error: 'Integração não encontrada' });

  const config = integration.extraConfig ? JSON.parse(integration.extraConfig) : {};
  const adAccounts = config.adAccounts ?? [];

  // Se já tiver token, busca contas atualizadas
  if (integration.encryptedToken && adAccounts.length === 0) {
    try {
      const token = decrypt(integration.encryptedToken);
      const accounts = await getAdAccounts(token);
      return res.json({ accounts, connected: true });
    } catch {
      return res.json({ accounts: adAccounts, connected: false });
    }
  }

  return res.json({
    accounts: adAccounts,
    connected: !!integration.encryptedToken,
    connectedUser: config.connectedUserName,
    tokenExpiresAt: config.tokenExpiresAt,
  });
});

// ─── DELETE /api/oauth/meta/disconnect/:integrationId ─── Desconecta

router.delete('/meta/disconnect/:integrationId', authenticate, async (req: AuthRequest, res: Response) => {
  const integration = await prisma.integration.findFirst({
    where: { id: req.params.integrationId, profile: { userId: req.userId! } },
  });
  if (!integration) return res.status(404).json({ error: 'Integração não encontrada' });

  const config = integration.extraConfig ? JSON.parse(integration.extraConfig) : {};
  const { connectedUserId, connectedUserName, tokenExpiresAt, adAccounts, ...cleanConfig } = config;

  await prisma.integration.update({
    where: { id: req.params.integrationId },
    data: {
      encryptedToken: null,
      isActive: false,
      extraConfig: JSON.stringify(cleanConfig),
    },
  });

  return res.json({ ok: true });
});

export default router;
