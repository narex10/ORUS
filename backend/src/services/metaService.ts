import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';

const META_API = 'https://graph.facebook.com/v21.0';

// ─── Tipos internos da Meta API ──────────────────────────────

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  objective?: string;
  start_time?: string;
  stop_time?: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  targeting?: Record<string, unknown>;
}

interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: {
    thumbnail_url?: string;
    body?: string;
    title?: string;
    effective_instagram_media_url?: string;
    effective_object_story_spec?: Record<string, unknown>;
  };
}

interface MetaInsight {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

// ─── Mapeamento de erros da Meta API ─────────────────────────

function translateMetaError(err: any): string {
  const code: number = err?.error?.code ?? 0;
  const subcode: number = err?.error?.error_subcode ?? 0;
  const raw: string = err?.error?.message ?? '';

  // #200 — System User não atribuído à conta de anúncios
  if (code === 200 || raw.includes('ads_management') || raw.includes('ads_read')) {
    return (
      'Permissão negada pela Meta (#200): o System User do token não tem acesso à conta de anúncios.\n' +
      'Corrija no Business Manager:\n' +
      '1. Acesse Configurações → Usuários do sistema\n' +
      '2. Clique no System User → "Atribuir ativos"\n' +
      '3. Selecione "Contas de anúncios" → marque a conta → permissão "Anunciante" ou "Administrador"\n' +
      '4. Salve e tente sincronizar novamente.'
    );
  }

  // #190 — token expirado ou inválido
  if (code === 190 || subcode === 463 || subcode === 467) {
    return 'Token expirado ou inválido. Gere um novo System User Token no Business Manager e atualize a integração.';
  }

  // #100 — parâmetro inválido (ex: accountId errado)
  if (code === 100) {
    return `Parâmetro inválido na requisição Meta: ${raw}. Verifique se o Ad Account ID está correto (formato act_XXXXXXXXX).`;
  }

  // #4 / #17 — rate limit
  if (code === 4 || code === 17) {
    return 'Limite de requisições da Meta atingido. Aguarde alguns minutos e tente novamente.';
  }

  return `Meta API error: ${raw || 'erro desconhecido'}`;
}

// ─── Helper de fetch paginado ─────────────────────────────────

async function fetchAll<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const errJson = await res.json() as any;
      throw new Error(translateMetaError(errJson));
    }
    const json = await res.json() as { data: T[]; paging?: { next?: string } };
    results.push(...json.data);
    nextUrl = json.paging?.next ?? null;

    // Evitar rate limit: aguarda 200ms entre páginas
    if (nextUrl) await sleep(200);
  }

  return results;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    DELETED: 'DELETED',
    ARCHIVED: 'ARCHIVED',
    WITH_ISSUES: 'PAUSED',
    IN_PROCESS: 'ACTIVE',
  };
  return map[status.toUpperCase()] ?? 'PAUSED';
}

function getActionValue(
  actions: MetaInsight['actions'],
  type: string
): number {
  return parseFloat(
    actions?.find(a => a.action_type === type)?.value ?? '0'
  );
}

// ─── Sync principal ───────────────────────────────────────────

export async function syncMetaIntegration(integrationId: string): Promise<{
  campaigns: number;
  adSets: number;
  ads: number;
  metrics: number;
}> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration?.encryptedToken) {
    throw new Error('Token de acesso não configurado para esta integração');
  }
  if (!integration.accountId) {
    throw new Error('ID da conta de anúncios não configurado');
  }

  const token = decrypt(integration.encryptedToken);
  // Garante o formato act_XXXXXX
  const accountId = integration.accountId.startsWith('act_')
    ? integration.accountId
    : `act_${integration.accountId}`;

  const baseParams = `access_token=${encodeURIComponent(token)}`;

  // ── 1. Campanhas ──────────────────────────────────────────
  const rawCampaigns = await fetchAll<MetaCampaign>(
    `${META_API}/${accountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,objective,start_time,stop_time&limit=100&${baseParams}`
  );

  let campaignCount = 0;
  let adSetCount = 0;
  let adCount = 0;
  let metricCount = 0;

  for (const mc of rawCampaigns) {
    const campaign = await prisma.campaign.upsert({
      where: { integrationId_externalId: { integrationId, externalId: mc.id } },
      update: {
        name: mc.name,
        status: normalizeStatus(mc.status),
        dailyBudget: mc.daily_budget ? parseFloat(mc.daily_budget) / 100 : null,
        lifetimeBudget: mc.lifetime_budget ? parseFloat(mc.lifetime_budget) / 100 : null,
        objective: mc.objective,
        startDate: mc.start_time ? new Date(mc.start_time) : null,
        endDate: mc.stop_time ? new Date(mc.stop_time) : null,
        updatedAt: new Date(),
      },
      create: {
        profileId: integration.profileId,
        integrationId,
        externalId: mc.id,
        name: mc.name,
        platform: 'META',
        status: normalizeStatus(mc.status),
        dailyBudget: mc.daily_budget ? parseFloat(mc.daily_budget) / 100 : null,
        lifetimeBudget: mc.lifetime_budget ? parseFloat(mc.lifetime_budget) / 100 : null,
        objective: mc.objective,
        startDate: mc.start_time ? new Date(mc.start_time) : null,
        endDate: mc.stop_time ? new Date(mc.stop_time) : null,
      },
    });
    campaignCount++;

    // ── 2. Ad Sets da campanha ────────────────────────────
    const rawAdSets = await fetchAll<MetaAdSet>(
      `${META_API}/${mc.id}/adsets?fields=id,name,status,daily_budget,targeting&limit=100&${baseParams}`
    );

    for (const mas of rawAdSets) {
      const adSet = await prisma.adSet.upsert({
        where: { campaignId_externalId: { campaignId: campaign.id, externalId: mas.id } },
        update: {
          name: mas.name,
          status: normalizeStatus(mas.status),
          budget: mas.daily_budget ? parseFloat(mas.daily_budget) / 100 : null,
          targeting: mas.targeting ? JSON.stringify(mas.targeting) : null,
          updatedAt: new Date(),
        },
        create: {
          campaignId: campaign.id,
          externalId: mas.id,
          name: mas.name,
          status: normalizeStatus(mas.status),
          budget: mas.daily_budget ? parseFloat(mas.daily_budget) / 100 : null,
          targeting: mas.targeting ? JSON.stringify(mas.targeting) : null,
        },
      });
      adSetCount++;

      // ── 3. Anúncios do conjunto ───────────────────────
      const rawAds = await fetchAll<MetaAd>(
        `${META_API}/${mas.id}/ads?fields=id,name,status,creative{thumbnail_url,body,title}&limit=100&${baseParams}`
      );

      for (const ma of rawAds) {
        await prisma.ad.upsert({
          where: { adSetId_externalId: { adSetId: adSet.id, externalId: ma.id } },
          update: {
            name: ma.name,
            status: normalizeStatus(ma.status),
            thumbnailUrl: ma.creative?.thumbnail_url ?? null,
            headline: ma.creative?.title ?? null,
            body: ma.creative?.body ?? null,
            updatedAt: new Date(),
          },
          create: {
            adSetId: adSet.id,
            externalId: ma.id,
            name: ma.name,
            status: normalizeStatus(ma.status),
            thumbnailUrl: ma.creative?.thumbnail_url ?? null,
            headline: ma.creative?.title ?? null,
            body: ma.creative?.body ?? null,
          },
        });
        adCount++;
      }

      await sleep(100);
    }
  }

  // ── 4. Insights de campanha (últimos 30 dias, por dia) ─
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 180);
  const since = sinceDate.toISOString().split('T')[0];
  const until = new Date().toISOString().split('T')[0];

  const insights = await fetchAll<MetaInsight>(
    `${META_API}/${accountId}/insights?` +
    `level=campaign` +
    `&fields=campaign_id,date_start,impressions,clicks,spend,reach,cpm,ctr,actions,action_values` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&time_increment=1` +
    `&limit=500` +
    `&${baseParams}`
  );

  for (const ins of insights) {
    const campaign = await prisma.campaign.findFirst({
      where: { integrationId, externalId: ins.campaign_id! },
    });
    if (!campaign) continue;

    const date = new Date(ins.date_start);
    const spend = parseFloat(ins.spend ?? '0');
    const purchases = getActionValue(ins.actions, 'purchase') +
      getActionValue(ins.actions, 'offsite_conversion.fb_pixel_purchase');
    const leads = getActionValue(ins.actions, 'complete_registration');
    const pageViews = getActionValue(ins.actions, 'landing_page_view');
    const revenue = getActionValue(ins.action_values, 'purchase') +
      getActionValue(ins.action_values, 'offsite_conversion.fb_pixel_purchase');

    await prisma.campaignMetric.upsert({
      where: { campaignId_date: { campaignId: campaign.id, date } },
      update: {
        impressions: parseInt(ins.impressions ?? '0'),
        clicks: parseInt(ins.clicks ?? '0'),
        pageViews,
        spend,
        reach: parseInt(ins.reach ?? '0'),
        cpm: parseFloat(ins.cpm ?? '0'),
        ctr: parseFloat(ins.ctr ?? '0'),
        purchases,
        leads,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        cpa: purchases > 0 ? spend / purchases : 0,
      },
      create: {
        campaignId: campaign.id,
        date,
        impressions: parseInt(ins.impressions ?? '0'),
        clicks: parseInt(ins.clicks ?? '0'),
        pageViews,
        spend,
        reach: parseInt(ins.reach ?? '0'),
        cpm: parseFloat(ins.cpm ?? '0'),
        ctr: parseFloat(ins.ctr ?? '0'),
        purchases,
        leads,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        cpa: purchases > 0 ? spend / purchases : 0,
      },
    });
    metricCount++;
  }

  // ── 5. Insights a nível de anúncio (AdMetric) ────────────────
  const adInsights = await fetchAll<MetaInsight>(
    `${META_API}/${accountId}/insights?` +
    `level=ad` +
    `&fields=ad_id,date_start,impressions,clicks,spend,cpm,ctr,actions,action_values` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&time_increment=1` +
    `&limit=500` +
    `&${baseParams}`
  );

  for (const ins of adInsights) {
    const ad = await prisma.ad.findFirst({ where: { externalId: ins.ad_id! } });
    if (!ad) continue;

    const date = new Date(ins.date_start);
    const spend = parseFloat(ins.spend ?? '0');
    const leads = getActionValue(ins.actions, 'complete_registration');
    const purchases = getActionValue(ins.actions, 'purchase') +
      getActionValue(ins.actions, 'offsite_conversion.fb_pixel_purchase');
    const revenue = getActionValue(ins.action_values, 'purchase') +
      getActionValue(ins.action_values, 'offsite_conversion.fb_pixel_purchase');

    const adMetricData = {
      impressions: parseInt(ins.impressions ?? '0'),
      clicks: parseInt(ins.clicks ?? '0'),
      spend,
      cpm: parseFloat(ins.cpm ?? '0'),
      ctr: parseFloat(ins.ctr ?? '0'),
      leads,
      purchases,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      cpa: leads > 0 ? spend / leads : 0,
    };

    await prisma.adMetric.upsert({
      where: { adId_date: { adId: ad.id, date } },
      update: adMetricData,
      create: { adId: ad.id, date, ...adMetricData },
    });
  }

  // Atualiza timestamp do último sync
  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  return { campaigns: campaignCount, adSets: adSetCount, ads: adCount, metrics: metricCount };
}

// ─── Diagnóstico de acesso à conta de anúncios ───────────────

export async function diagnoseMetaAccount(token: string, accountId: string): Promise<{
  canReadAccount: boolean;
  canListCampaigns: boolean;
  accountName: string | null;
  error: string | null;
}> {
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const at = encodeURIComponent(token);

  // Testa leitura da conta
  const acctRes = await fetch(`${META_API}/${id}?fields=name,account_status&access_token=${at}`);
  const acctData = await acctRes.json() as any;

  if (acctData.error) {
    return {
      canReadAccount: false,
      canListCampaigns: false,
      accountName: null,
      error: translateMetaError(acctData),
    };
  }

  // Testa listagem de campanhas (1 resultado apenas, para validar acesso)
  const campRes = await fetch(`${META_API}/${id}/campaigns?fields=id&limit=1&access_token=${at}`);
  const campData = await campRes.json() as any;

  if (campData.error) {
    return {
      canReadAccount: true,
      canListCampaigns: false,
      accountName: acctData.name ?? null,
      error: translateMetaError(campData),
    };
  }

  return {
    canReadAccount: true,
    canListCampaigns: true,
    accountName: acctData.name ?? null,
    error: null,
  };
}

// ─── Valida token e retorna info da conta ─────────────────────
// Fase 1: valida token + permissões (não testa conta — isso é feito no sync)
// Fase 2 (opcional): tenta ler a conta, mas retorna aviso se falhar

export async function validateMetaToken(token: string, accountId: string): Promise<{
  accountName: string | null;
  currency: string | null;
  userName: string;
  valid: boolean;
  permissions: string[];
  accountWarning?: string;
}> {
  // ── Passo 1: Verifica se o token é válido (/me) ──────────────
  const meRes = await fetch(
    `${META_API}/me?fields=id,name&access_token=${encodeURIComponent(token)}`
  );
  const meData = await meRes.json() as any;
  if (meData.error) {
    const msg = meData.error.message ?? '';
    if (msg.includes('expired') || msg.includes('session')) {
      throw new Error('Token expirado. Gere um novo token no Graph API Explorer.');
    }
    throw new Error(`Token inválido: ${msg}`);
  }

  // ── Passo 2: Tenta verificar permissões (só funciona para user tokens) ────
  const permRes = await fetch(
    `${META_API}/me/permissions?access_token=${encodeURIComponent(token)}`
  );
  const permData = await permRes.json() as any;
  const grantedPerms: string[] = (permData.data ?? [])
    .filter((p: any) => p.status === 'granted')
    .map((p: any) => p.permission as string);

  // System User Tokens não têm /me/permissions — validar pelo acesso direto à conta
  const isSystemUser = grantedPerms.length === 0;

  if (!isSystemUser) {
    const hasAdsAccess =
      grantedPerms.includes('ads_read') ||
      grantedPerms.includes('ads_management');

    if (!hasAdsAccess) {
      const current = grantedPerms.join(', ');
      throw new Error(
        `Permissão "ads_read" não encontrada neste token.\n` +
        `Permissões atuais: ${current}.\n` +
        `No Graph API Explorer, marque ads_read e ads_management ao gerar o token.`
      );
    }
  }

  // ── Passo 3: Tenta ler a conta (não bloqueia se falhar) ──────
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  let accountName: string | null = null;
  let currency: string | null = null;
  let accountWarning: string | undefined;

  try {
    const acctRes = await fetch(
      `${META_API}/${id}?fields=name,currency,account_status&access_token=${encodeURIComponent(token)}`
    );
    const acctData = await acctRes.json() as any;

    if (acctData.error) {
      // Não bloqueia — token válido, conta será testada no sync
      accountWarning = `Conta ${id} não acessível agora: ${acctData.error.message}. ` +
        `O token está OK. Salve e use o botão Sync para puxar os dados.`;
    } else {
      accountName = acctData.name;
      currency = acctData.currency;
    }
  } catch {
    accountWarning = 'Não foi possível verificar a conta agora. Salve e sincronize depois.';
  }

  return {
    accountName,
    currency,
    userName: meData.name,
    valid: true,
    permissions: isSystemUser ? ['system_user', 'ads_read', 'ads_management'] : grantedPerms,
    accountWarning,
  };
}
