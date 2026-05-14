import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Lista campanhas de um perfil com métricas do período
router.get('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  const { from, to, level = 'CAMPAIGN' } = req.query as Record<string, string>;

  const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400000);
  const toDate = to ? new Date(to) : new Date();

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  if (level === 'CAMPAIGN') {
    const campaigns = await prisma.campaign.findMany({
      where: { profileId },
      include: {
        metrics: {
          where: { date: { gte: fromDate, lte: toDate } },
          select: { spend: true, revenue: true, clicks: true, impressions: true, purchases: true, leads: true, pageViews: true, messages: true },
        },
        _count: { select: { adSets: true } },
      },
    });

    const result = campaigns.map(c => {
      const totals = c.metrics.reduce(
        (acc, m) => ({
          spend: acc.spend + m.spend,
          revenue: acc.revenue + m.revenue,
          clicks: acc.clicks + m.clicks,
          impressions: acc.impressions + m.impressions,
          purchases: acc.purchases + m.purchases,
          leads: acc.leads + m.leads,
          pageViews: acc.pageViews + m.pageViews,
          messages: acc.messages + m.messages,
        }),
        { spend: 0, revenue: 0, clicks: 0, impressions: 0, purchases: 0, leads: 0, pageViews: 0, messages: 0 }
      );

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
      const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
      const roi = totals.spend > 0 ? (totals.revenue - totals.spend) / totals.spend : 0;
      const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        platform: c.platform,
        dailyBudget: c.dailyBudget,
        adSetsCount: c._count.adSets,
        ...totals,
        ctr: Math.round(ctr * 100) / 100,
        cpm: Math.round(cpm * 100) / 100,
        roas: Math.round(roas * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        cpa: Math.round(cpa * 100) / 100,
      };
    });

    return res.json(result);
  }

  return res.json([]);
});

// Mini funil por campanha
router.get('/:campaignId/funnel', async (req: AuthRequest, res: Response) => {
  const { campaignId } = req.params;
  const { from, to } = req.query as Record<string, string>;

  const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400000);
  const toDate = to ? new Date(to) : new Date();

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, profile: { userId: req.userId! } },
    include: {
      metrics: { where: { date: { gte: fromDate, lte: toDate } } },
    },
  });

  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const totals = campaign.metrics.reduce(
    (acc, m) => ({
      clicks:          acc.clicks + m.clicks,
      pageViews:       acc.pageViews + ((m as any).pageViews ?? 0),
      messages:        acc.messages + ((m as any).messages ?? 0),
      instagramVisits: acc.instagramVisits + ((m as any).instagramVisits ?? 0),
      leads:           acc.leads + m.leads,
      purchases:       acc.purchases + m.purchases,
    }),
    { clicks: 0, pageViews: 0, messages: 0, instagramVisits: 0, leads: 0, purchases: 0 }
  );

  // Conversões reais do site vinculadas ao utm_campaign da campanha
  const realConversions = await prisma.siteConversion.groupBy({
    by: ['type'],
    where: {
      profileId: campaign.profileId,
      utmCampaign: campaign.name,
      createdAt: { gte: fromDate, lte: toDate },
    },
    _count: { id: true },
  });

  const realPageViews  = realConversions.find(c => c.type === 'PAGEVIEW')?._count.id ?? 0;
  const realLeads      = realConversions.find(c => c.type === 'LEAD')?._count.id ?? 0;
  const realMessages   = realConversions.find(c => c.type === 'CONVERSATION')?._count.id ?? 0;
  const realPurchases  = realConversions.find(c => c.type === 'PURCHASE')?._count.id ?? 0;

  return res.json({
    // Meta Ads
    clicks:          totals.clicks,
    pageViews:       totals.pageViews,
    leads:           totals.leads,
    messages:        totals.messages,
    instagramVisits: totals.instagramVisits,
    purchases:       totals.purchases,
    // Site
    realPageViews,
    realLeads,
    realMessages,
    realPurchases,
  });
});

// Ad Sets de uma campanha com métricas e top anúncios
router.get('/:campaignId/adsets', async (req: AuthRequest, res: Response) => {
  const { campaignId } = req.params;
  const { from, to } = req.query as Record<string, string>;

  const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400000);
  const toDate   = to   ? new Date(to)   : new Date();

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, profile: { userId: req.userId! } },
  });
  if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const adSets = await prisma.adSet.findMany({
    where: { campaignId },
    include: {
      metrics: {
        where: { date: { gte: fromDate, lte: toDate } },
        select: { spend: true, clicks: true, impressions: true, leads: true, purchases: true, revenue: true },
      },
      ads: {
        include: {
          metrics: {
            where: { date: { gte: fromDate, lte: toDate } },
            select: { spend: true, clicks: true, impressions: true, leads: true, purchases: true, messages: true, ctr: true },
          },
        },
        take: 5,
      },
    },
  });

  const result = adSets.map(as => {
    const t = as.metrics.reduce(
      (acc, m) => ({
        spend: acc.spend + m.spend, clicks: acc.clicks + m.clicks,
        impressions: acc.impressions + m.impressions, leads: acc.leads + m.leads,
        purchases: acc.purchases + m.purchases, revenue: acc.revenue + m.revenue,
      }),
      { spend: 0, clicks: 0, impressions: 0, leads: 0, purchases: 0, revenue: 0 }
    );
    const ctr  = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    const roas = t.spend > 0 ? t.revenue / t.spend : 0;
    const cpl  = t.leads > 0 ? t.spend / t.leads : 0;

    const ads = as.ads.map(ad => {
      const at = ad.metrics.reduce(
        (acc, m) => ({ spend: acc.spend + m.spend, clicks: acc.clicks + m.clicks,
          impressions: acc.impressions + m.impressions, leads: acc.leads + m.leads,
          messages: acc.messages + (m.messages ?? 0) }),
        { spend: 0, clicks: 0, impressions: 0, leads: 0, messages: 0 }
      );
      return {
        id: ad.id, name: ad.name, status: ad.status,
        thumbnailUrl: ad.thumbnailUrl, headline: ad.headline,
        ...at,
        ctr: at.impressions > 0 ? Math.round((at.clicks / at.impressions) * 10000) / 100 : 0,
        cpl: at.leads > 0 ? Math.round((at.spend / at.leads) * 100) / 100 : 0,
      };
    }).sort((a, b) => b.leads - a.leads);

    const messages = ads.reduce((s, a) => s + a.messages, 0);

    return {
      id: as.id, name: as.name, status: as.status, budget: as.budget,
      ...t,
      messages,
      ctr: Math.round(ctr * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      cpl: Math.round(cpl * 100) / 100,
      ads,
    };
  });

  return res.json(result);
});

export default router;
