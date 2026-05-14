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
  if (!integration?.encryptedToken || !integration.accountId) {
    return res.json({ error: 'Sem integração Meta ativa' });
  }

  const token     = decrypt(integration.encryptedToken);
  const accountId = integration.accountId.startsWith('act_')
    ? integration.accountId
    : `act_${integration.accountId}`;
  const timeRange = JSON.stringify({ since: fromDate, until: toDate });

  // ── Buscar breakdowns em paralelo ────────────────────────
  const [ageGenderRaw, regionRaw, adSets] = await Promise.all([
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
  });
});

export default router;
