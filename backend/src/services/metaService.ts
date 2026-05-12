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

// ─── Helper de fetch paginado ─────────────────────────────────

async function fetchAll<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const err = await res.json() as any;
      throw new Error(`Meta API error: ${err?.error?.message ?? res.statusText}`);
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
        `${META_API}/${mas.id}/ads?fields=id,name,status,creative{thumbnail_url,body,title,effective_instagram_media_url}&limit=100&${baseParams}`
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
  const insights = await fetchAll<MetaInsight>(
    `${META_API}/${accountId}/insights?` +
    `level=campaign` +
    `&fields=campaign_id,date_start,impressions,clicks,spend,reach,cpm,ctr,actions,action_values` +
    `&date_preset=last_30d` +
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
    const leads = getActionValue(ins.actions, 'lead') +
      getActionValue(ins.actions, 'offsite_conversion.fb_pixel_lead');
    const revenue = getActionValue(ins.action_values, 'purchase') +
      getActionValue(ins.action_values, 'offsite_conversion.fb_pixel_purchase');

    await prisma.campaignMetric.upsert({
      where: { campaignId_date: { campaignId: campaign.id, date } },
      update: {
        impressions: parseInt(ins.impressions ?? '0'),
        clicks: parseInt(ins.clicks ?? '0'),
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

  // Atualiza timestamp do último sync
  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  return { campaigns: campaignCount, adSets: adSetCount, ads: adCount, metrics: metricCount };
}

// ─── Valida token e retorna info da conta ─────────────────────

export async function validateMetaToken(token: string, accountId: string): Promise<{
  accountName: string;
  currency: string;
  userName: string;
  valid: boolean;
  permissions: string[];
}> {
  // 1. Valida o token em si (sempre funciona se o token for válido)
  const meRes = await fetch(
    `${META_API}/me?fields=id,name&access_token=${encodeURIComponent(token)}`
  );
  const meData = await meRes.json() as any;
  if (meData.error) {
    throw new Error(`Token inválido: ${meData.error.message}`);
  }

  // 2. Verifica quais permissões o token tem
  const permRes = await fetch(
    `${META_API}/me/permissions?access_token=${encodeURIComponent(token)}`
  );
  const permData = await permRes.json() as any;
  const grantedPerms: string[] = (permData.data ?? [])
    .filter((p: any) => p.status === 'granted')
    .map((p: any) => p.permission as string);

  const hasAdsRead = grantedPerms.includes('ads_read') || grantedPerms.includes('ads_management');

  if (!hasAdsRead) {
    throw new Error(
      `O token não tem permissão "ads_read". ` +
      `Permissões atuais: ${grantedPerms.join(', ') || 'nenhuma'}. ` +
      `Gere um novo token com a permissão ads_read no Graph API Explorer.`
    );
  }

  // 3. Acessa os dados da conta de anúncios
  const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const acctRes = await fetch(
    `${META_API}/${id}?fields=name,currency,account_status&access_token=${encodeURIComponent(token)}`
  );
  const acctData = await acctRes.json() as any;
  if (acctData.error) {
    throw new Error(
      `Não foi possível acessar a conta ${id}: ${acctData.error.message}. ` +
      `Verifique se o usuário tem acesso a esta conta no Business Manager.`
    );
  }

  return {
    accountName: acctData.name,
    currency: acctData.currency,
    userName: meData.name,
    valid: acctData.account_status === 1,
    permissions: grantedPerms,
  };
}
