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
          select: { spend: true, revenue: true, clicks: true, impressions: true, purchases: true, leads: true },
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
        }),
        { spend: 0, revenue: 0, clicks: 0, impressions: 0, purchases: 0, leads: 0 }
      );

      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
      const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
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
      clicks: acc.clicks + m.clicks,
      pageViews: acc.pageViews + (m.pageViews ?? 0),
      leads: acc.leads + m.leads,
      purchases: acc.purchases + m.purchases,
    }),
    { clicks: 0, pageViews: 0, leads: 0, purchases: 0 }
  );

  // Cadastros reais do site vinculados ao utm_campaign da campanha
  const realConversions = await prisma.siteConversion.groupBy({
    by: ['type'],
    where: {
      profileId: campaign.profileId,
      utmCampaign: campaign.name,
      createdAt: { gte: fromDate, lte: toDate },
    },
    _count: { id: true },
  });

  const realLeads = realConversions.find(c => c.type === 'LEAD')?._count.id ?? 0;
  const realPurchases = realConversions.find(c => c.type === 'PURCHASE')?._count.id ?? 0;

  return res.json({
    clicks: totals.clicks,
    pageViews: totals.pageViews,
    leads: totals.leads,
    realLeads,
    purchases: totals.purchases,
    realPurchases,
  });
});

export default router;
