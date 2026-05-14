import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';

const router = Router();
const META_API = 'https://graph.facebook.com/v21.0';

// ─── Helpers ──────────────────────────────────────────────────

function getAction(actions: any[], type: string): number {
  const a = actions?.find((x: any) => x.action_type === type);
  return a ? parseFloat(a.value) : 0;
}

function classifyTemp(targeting: any): 'hot' | 'warm' | 'cold' {
  if (!targeting) return 'cold';
  if (targeting.custom_audiences?.length > 0) return 'hot';
  if (targeting.lookalike_specs?.length > 0) return 'warm';
  return 'cold';
}

function parseSegmentation(targeting: any) {
  if (!targeting) return null;
  return {
    ageMin: targeting.age_min ?? null,
    ageMax: targeting.age_max ?? null,
    genders: (targeting.genders ?? []).map((g: number) => (g === 1 ? 'Masculino' : 'Feminino')),
    countries: targeting.geo_locations?.countries ?? [],
    regions: (targeting.geo_locations?.regions ?? []).map((r: any) => r.name),
    cities: (targeting.geo_locations?.cities ?? []).map((c: any) => c.name),
    interests: (targeting.flexible_spec ?? [])
      .flatMap((s: any) => s.interests ?? [])
      .map((i: any) => i.name),
    behaviors: (targeting.flexible_spec ?? [])
      .flatMap((s: any) => s.behaviors ?? [])
      .map((b: any) => b.name),
    customAudiences: (targeting.custom_audiences ?? []).map((a: any) => a.name),
    lookalikes: (targeting.lookalike_specs ?? []).map(
      (l: any) => `Lookalike ${l.country} (${((l.ratio ?? 0) * 100).toFixed(0)}%)`
    ),
    exclusions: (targeting.exclusions?.custom_audiences ?? []).map((a: any) => a.name),
  };
}

type SiteTempKey = 'hot' | 'warm' | 'cold' | 'unknown';

function parseTargetingJson(raw: string | null | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deviceCoarse(userAgent: string | null | undefined): 'mobile' | 'desktop' | 'unknown' {
  if (!userAgent) return 'unknown';
  return /Mobile|Android|iPhone|iPad|webOS/i.test(userAgent) ? 'mobile' : 'desktop';
}

async function buildSiteTrackingByTemp(profileId: string, fromDate: string, toDate: string) {
  const fromD = new Date(`${fromDate}T00:00:00.000Z`);
  const toD = new Date(`${toDate}T23:59:59.999Z`);

  const [rows, ads, adSets] = await Promise.all([
    prisma.siteConversion.findMany({
      where: { profileId, createdAt: { gte: fromD, lte: toD } },
      select: {
        id: true,
        type: true,
        value: true,
        adId: true,
        creativeId: true,
        adsetId: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        sessionId: true,
        fingerprint: true,
        userAgent: true,
        pageUrl: true,
        referrer: true,
      },
    }),
    prisma.ad.findMany({
      where: { adSet: { campaign: { profileId } } },
      select: { id: true, externalId: true, adSet: { select: { targeting: true } } },
    }),
    prisma.adSet.findMany({
      where: { campaign: { profileId } },
      select: { externalId: true, targeting: true },
    }),
  ]);

  const adById = new Map(ads.map(a => [a.id, a]));
  const adByCreative = new Map(ads.map(a => [a.externalId, a]));
  const adSetByExt = new Map(adSets.map(a => [a.externalId, a]));

  function tempForConversion(conv: (typeof rows)[number]): SiteTempKey {
    let targeting: any = null;
    if (conv.adId) {
      const ad = adById.get(conv.adId);
      targeting = ad ? parseTargetingJson(ad.adSet.targeting) : null;
    }
    if (!targeting && conv.creativeId) {
      const ad = adByCreative.get(conv.creativeId);
      targeting = ad ? parseTargetingJson(ad.adSet.targeting) : null;
    }
    if (!targeting && conv.adsetId) {
      const aset = adSetByExt.get(conv.adsetId);
      targeting = aset ? parseTargetingJson(aset.targeting) : null;
    }
    if (!targeting) return 'unknown';
    return classifyTemp(targeting);
  }

  type Agg = {
    pageviews: number;
    leads: number;
    purchases: number;
    custom: number;
    revenue: number;
    mobile: number;
    desktop: number;
    deviceUnknown: number;
    srcMap: Map<string, number>;
    campMap: Map<string, number>;
    mediumMap: Map<string, number>;
    visitors: Set<string>;
  };

  function mkAgg(): Agg {
    return {
      pageviews: 0,
      leads: 0,
      purchases: 0,
      custom: 0,
      revenue: 0,
      mobile: 0,
      desktop: 0,
      deviceUnknown: 0,
      srcMap: new Map(),
      campMap: new Map(),
      mediumMap: new Map(),
      visitors: new Set(),
    };
  }

  const buckets: Record<SiteTempKey, Agg> = {
    hot: mkAgg(),
    warm: mkAgg(),
    cold: mkAgg(),
    unknown: mkAgg(),
  };

  for (const conv of rows) {
    const temp = tempForConversion(conv);
    const b = buckets[temp];
    const vKey = conv.sessionId || conv.fingerprint || conv.id;
    b.visitors.add(vKey);

    const dev = deviceCoarse(conv.userAgent);
    if (dev === 'mobile') b.mobile++;
    else if (dev === 'desktop') b.desktop++;
    else b.deviceUnknown++;

    const src = (conv.utmSource || '').trim() || '(não informado)';
    const camp = (conv.utmCampaign || '').trim() || '(não informado)';
    const med = (conv.utmMedium || '').trim() || '(não informado)';
    b.srcMap.set(src, (b.srcMap.get(src) ?? 0) + 1);
    b.campMap.set(camp, (b.campMap.get(camp) ?? 0) + 1);
    b.mediumMap.set(med, (b.mediumMap.get(med) ?? 0) + 1);

    switch (conv.type) {
      case 'PAGEVIEW':
        b.pageviews++;
        break;
      case 'LEAD':
        b.leads++;
        break;
      case 'PURCHASE':
        b.purchases++;
        b.revenue += Number(conv.value ?? 0) || 0;
        break;
      default:
        b.custom++;
        break;
    }
  }

  function topEntries(m: Map<string, number>, n: number): { key: string; count: number }[] {
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  }

  function finalize(a: Agg) {
    return {
      pageviews: a.pageviews,
      leads: a.leads,
      purchases: a.purchases,
      custom: a.custom,
      revenue: Math.round(a.revenue * 100) / 100,
      visitsApprox: a.visitors.size,
      devices: {
        mobile: a.mobile,
        desktop: a.desktop,
        unknown: a.deviceUnknown,
      },
      topUtmSources: topEntries(a.srcMap, 5),
      topUtmMediums: topEntries(a.mediumMap, 5),
      topUtmCampaigns: topEntries(a.campMap, 5),
    };
  }

  return {
    hot: finalize(buckets.hot),
    warm: finalize(buckets.warm),
    cold: finalize(buckets.cold),
    unknown: finalize(buckets.unknown),
  };
}

function emptyMetaByTemp() {
  const emptyBucket = {
    spend: 0,
    clicks: 0,
    impressions: 0,
    leads: 0,
    purchases: 0,
    revenue: 0,
    count: 0,
    ctr: 0,
    cpl: 0,
    roas: 0,
  };
  return { hot: { ...emptyBucket }, warm: { ...emptyBucket }, cold: { ...emptyBucket } };
}

async function fetchMetaInsights(
  accountId: string,
  token: string,
  timeRange: string,
  breakdowns: string
): Promise<any[]> {
  const fields = 'impressions,clicks,spend,reach,actions';
  const url =
    `${META_API}/${accountId}/insights` +
    `?fields=${fields}` +
    `&breakdowns=${encodeURIComponent(breakdowns)}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&access_token=${token}` +
    `&limit=500`;

  const res = await fetch(url);
  const json = await res.json() as any;
  if (json.error) return [];

  // Handle pagination
  let data = json.data ?? [];
  let next = json.paging?.cursors?.after;
  while (next && data.length < 500) {
    const r = await fetch(`${url}&after=${next}`);
    const j = await r.json() as any;
    data = data.concat(j.data ?? []);
    next = j.paging?.cursors?.after;
  }
  return data;
}

// ─── Main endpoint ────────────────────────────────────────────

router.get('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  const { from, to } = req.query as Record<string, string>;

  const fromDate = from ?? new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const toDate   = to   ?? new Date().toISOString().split('T')[0];

  // Verifica posse do perfil
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
    include: {
      integrations: {
        where: { type: 'META_BMS', isActive: true },
        take: 1,
      },
    },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const integration = profile.integrations[0];
  const siteTrackingPromise = buildSiteTrackingByTemp(profileId, fromDate, toDate);

  if (!integration?.encryptedToken || !integration.accountId) {
    const siteTrackingByTemp = await siteTrackingPromise;
    return res.json({
      error: 'Sem integração Meta ativa',
      byTemp: emptyMetaByTemp(),
      byAge: [],
      byGender: [],
      byRegion: [],
      adSets: [],
      siteTrackingByTemp,
    });
  }

  const token     = decrypt(integration.encryptedToken);
  const accountId = integration.accountId.startsWith('act_')
    ? integration.accountId
    : `act_${integration.accountId}`;
  const timeRange = JSON.stringify({ since: fromDate, until: toDate });

  // ── Buscar breakdowns em paralelo (+ rastreamento do site) ──
  const [ageGenderRaw, regionRaw, adSets, siteTrackingByTemp] = await Promise.all([
    fetchMetaInsights(accountId, token, timeRange, 'age,gender'),
    fetchMetaInsights(accountId, token, timeRange, 'region'),
    prisma.adSet.findMany({
      where: {
        campaign: { profileId, status: { not: 'DELETED' } },
      },
      include: {
        metrics: {
          where: {
            date: { gte: new Date(fromDate + 'T00:00:00Z'), lte: new Date(toDate + 'T23:59:59Z') },
          },
          select: { spend: true, clicks: true, impressions: true, leads: true, purchases: true, revenue: true },
        },
        campaign: { select: { id: true, name: true, status: true } },
      },
    }),
    siteTrackingPromise,
  ]);

  // ── Por Temperatura ──────────────────────────────────────
  type TempBucket = { spend: number; clicks: number; impressions: number; leads: number; purchases: number; revenue: number; count: number };
  const tempBuckets: Record<string, TempBucket> = {
    hot:  { spend: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, revenue: 0, count: 0 },
    warm: { spend: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, revenue: 0, count: 0 },
    cold: { spend: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, revenue: 0, count: 0 },
  };

  const adSetDetails: any[] = [];

  for (const as of adSets) {
    let targeting: any = null;
    try { targeting = as.targeting ? JSON.parse(as.targeting) : null; } catch {}

    const temp = classifyTemp(targeting);
    const seg  = parseSegmentation(targeting);

    const totals = as.metrics.reduce(
      (acc, m) => ({
        spend: acc.spend + m.spend, clicks: acc.clicks + m.clicks,
        impressions: acc.impressions + m.impressions, leads: acc.leads + m.leads,
        purchases: acc.purchases + m.purchases, revenue: acc.revenue + m.revenue,
      }),
      { spend: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, revenue: 0 }
    );

    const b = tempBuckets[temp];
    b.spend       += totals.spend;
    b.clicks      += totals.clicks;
    b.impressions += totals.impressions;
    b.leads       += totals.leads;
    b.purchases   += totals.purchases;
    b.revenue     += totals.revenue;
    b.count++;

    if (totals.impressions > 0) {
      adSetDetails.push({
        id: as.id,
        name: as.name,
        status: as.status,
        campaignName: as.campaign.name,
        temp,
        segmentation: seg,
        ...totals,
        ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0,
        cpl: totals.leads > 0 ? Math.round((totals.spend / totals.leads) * 100) / 100 : 0,
        roas: totals.spend > 0 ? Math.round((totals.revenue / totals.spend) * 100) / 100 : 0,
      });
    }
  }

  // Adiciona métricas derivadas às temperaturas
  const byTemp: Record<string, any> = {};
  for (const [key, b] of Object.entries(tempBuckets)) {
    byTemp[key] = {
      ...b,
      ctr:  b.impressions > 0 ? Math.round((b.clicks / b.impressions) * 10000) / 100 : 0,
      cpl:  b.leads > 0 ? Math.round((b.spend / b.leads) * 100) / 100 : 0,
      roas: b.spend > 0 ? Math.round((b.revenue / b.spend) * 100) / 100 : 0,
    };
  }

  // ── Por Idade + Gênero ───────────────────────────────────
  type DemoBucket = { impressions: number; clicks: number; spend: number; leads: number; reach: number };
  const byAge:    Record<string, DemoBucket> = {};
  const byGender: Record<string, DemoBucket> = {};

  for (const row of ageGenderRaw) {
    const age    = row.age    as string;
    const gender = row.gender as string;
    const imp  = parseInt(row.impressions ?? '0');
    const clk  = parseInt(row.clicks      ?? '0');
    const spd  = parseFloat(row.spend     ?? '0');
    const rea  = parseInt(row.reach       ?? '0');
    const leads = getAction(row.actions, 'complete_registration') +
                  getAction(row.actions, 'lead');

    if (!byAge[age]) byAge[age] = { impressions: 0, clicks: 0, spend: 0, leads: 0, reach: 0 };
    byAge[age].impressions += imp;
    byAge[age].clicks      += clk;
    byAge[age].spend       += spd;
    byAge[age].leads       += leads;
    byAge[age].reach       += rea;

    const gLabel = gender === 'male' ? 'Masculino' : gender === 'female' ? 'Feminino' : 'Outro';
    if (!byGender[gLabel]) byGender[gLabel] = { impressions: 0, clicks: 0, spend: 0, leads: 0, reach: 0 };
    byGender[gLabel].impressions += imp;
    byGender[gLabel].clicks      += clk;
    byGender[gLabel].spend       += spd;
    byGender[gLabel].leads       += leads;
    byGender[gLabel].reach       += rea;
  }

  // ── Por Região ───────────────────────────────────────────
  type RegionBucket = { impressions: number; clicks: number; spend: number; leads: number };
  const byRegion: Record<string, RegionBucket> = {};
  for (const row of regionRaw) {
    const region = (row.region as string) || 'Desconhecido';
    const imp   = parseInt(row.impressions ?? '0');
    const clk   = parseInt(row.clicks      ?? '0');
    const spd   = parseFloat(row.spend     ?? '0');
    const leads = getAction(row.actions, 'complete_registration') +
                  getAction(row.actions, 'lead');

    if (!byRegion[region]) byRegion[region] = { impressions: 0, clicks: 0, spend: 0, leads: 0 };
    byRegion[region].impressions += imp;
    byRegion[region].clicks      += clk;
    byRegion[region].spend       += spd;
    byRegion[region].leads       += leads;
  }

  // ── Ordenar regiões por leads → spend ────────────────────
  const regionsSorted = Object.entries(byRegion)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend)
    .slice(0, 20);

  return res.json({
    byTemp,
    byAge: Object.entries(byAge).map(([age, v]) => ({ age, ...v }))
      .sort((a, b) => parseInt(a.age) - parseInt(b.age)),
    byGender: Object.entries(byGender).map(([gender, v]) => ({ gender, ...v })),
    byRegion: regionsSorted,
    adSets: adSetDetails.sort((a, b) => b.spend - a.spend),
    siteTrackingByTemp,
  });
});

export default router;
