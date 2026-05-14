import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Lista criativos (anúncios) com métricas agregadas do período
router.get('/profile/:profileId', async (req: AuthRequest, res: Response) => {
  const { profileId } = req.params;
  const { from, to } = req.query as Record<string, string>;

  const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400000);
  const toDate = to ? new Date(to) : new Date();

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const ads = await prisma.ad.findMany({
    where: {
      adSet: { campaign: { profileId } },
    },
    include: {
      metrics: {
        where: { date: { gte: fromDate, lte: toDate } },
        select: {
          spend: true, revenue: true,
          impressions: true, clicks: true,
          pageViews: true, messages: true,
          instagramVisits: true, fanpageEngagement: true, videoViews: true,
          leads: true, purchases: true,
          cpm: true, ctr: true,
        },
      },
      adSet: {
        select: {
          name: true,
          campaign: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  const result = ads
    .map(ad => {
      const totals = ad.metrics.reduce(
        (acc, m) => ({
          spend:          acc.spend + m.spend,
          revenue:        acc.revenue + m.revenue,
          impressions:    acc.impressions + m.impressions,
          clicks:         acc.clicks + m.clicks,
          pageViews:         acc.pageViews + ((m as any).pageViews ?? 0),
          messages:          acc.messages + ((m as any).messages ?? 0),
          instagramVisits:   acc.instagramVisits + ((m as any).instagramVisits ?? 0),
          fanpageEngagement: acc.fanpageEngagement + ((m as any).fanpageEngagement ?? 0),
          videoViews:        acc.videoViews + ((m as any).videoViews ?? 0),
          leads:          acc.leads + m.leads,
          purchases:      acc.purchases + m.purchases,
        }),
        { spend: 0, revenue: 0, impressions: 0, clicks: 0, pageViews: 0,
          messages: 0, instagramVisits: 0, fanpageEngagement: 0, videoViews: 0, leads: 0, purchases: 0 }
      );

      const ctr  = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpm  = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
      const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
      // CPR por tipo de conversão
      const cprLeads    = totals.leads > 0 ? totals.spend / totals.leads : 0;
      const cprMessages = totals.messages > 0 ? totals.spend / totals.messages : 0;
      const cprPageViews = totals.pageViews > 0 ? totals.spend / totals.pageViews : 0;
      const cprPurchases = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        thumbnailUrl: ad.thumbnailUrl,
        headline: ad.headline,
        body: ad.body,
        campaignId: ad.adSet.campaign.id,
        campaignName: ad.adSet.campaign.name,
        campaignStatus: ad.adSet.campaign.status,
        adSetName: ad.adSet.name,
        ...totals,
        ctr:         Math.round(ctr * 100) / 100,
        cpm:         Math.round(cpm * 100) / 100,
        roas:        Math.round(roas * 100) / 100,
        cprLeads:    Math.round(cprLeads * 100) / 100,
        cprMessages: Math.round(cprMessages * 100) / 100,
        cprPageViews:Math.round(cprPageViews * 100) / 100,
        cprPurchases:Math.round(cprPurchases * 100) / 100,
      };
    })
    .filter(ad => ad.impressions > 0);

  return res.json(result);
});

export default router;
