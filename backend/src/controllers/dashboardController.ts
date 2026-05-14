import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const periodSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function defaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from, to };
}

export async function getDashboard(req: AuthRequest, res: Response) {
  const { id: profileId } = req.params;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const { from: fromStr, to: toStr } = periodSchema.parse(req.query);
  const defaults = defaultDates();
  const from = fromStr ? new Date(fromStr) : defaults.from;
  const to = toStr ? new Date(toStr) : defaults.to;

  // KPIs agregados do período
  const [metrics, conversions] = await Promise.all([
    prisma.campaignMetric.aggregate({
      where: {
        campaign: { profileId },
        date: { gte: from, lte: to },
      },
      _sum: {
        spend: true,
        revenue: true,
        purchases: true,
        leads: true,
        clicks: true,
        impressions: true,
        messages: true,
      },
    }),

    prisma.siteConversion.groupBy({
      by: ['type'],
      where: {
        profileId,
        createdAt: { gte: from, lte: to },
      },
      _count: { id: true },
      _sum: { value: true },
    }),
  ]);

  const totalSpend = metrics._sum.spend ?? 0;
  const totalRevenue = metrics._sum.revenue ?? 0;
  const totalPurchases = metrics._sum.purchases ?? 0;
  const totalLeads = metrics._sum.leads ?? 0;
  const totalMessages = metrics._sum.messages ?? 0;

  const realLeads = conversions.find(c => c.type === 'LEAD')?._count.id ?? 0;
  const realPurchases = conversions.find(c => c.type === 'PURCHASE')?._count.id ?? 0;
  const realRevenue = conversions.find(c => c.type === 'PURCHASE')?._sum.value ?? 0;

  const roas = totalSpend > 0 ? (realRevenue || totalRevenue) / totalSpend : 0;
  const cpa = (realPurchases || totalPurchases) > 0
    ? totalSpend / (realPurchases || totalPurchases)
    : 0;

  // Série temporal por dia
  const dailyMetrics = await prisma.campaignMetric.groupBy({
    by: ['date'],
    where: {
      campaign: { profileId },
      date: { gte: from, lte: to },
    },
    _sum: { spend: true, revenue: true, leads: true, purchases: true, messages: true },
    orderBy: { date: 'asc' },
  });

  const dailyConversions = await prisma.siteConversion.groupBy({
    by: ['createdAt'],
    where: {
      profileId,
      createdAt: { gte: from, lte: to },
    },
    _count: { id: true },
  });

  return res.json({
    kpis: {
      spend: totalSpend,
      revenue: realRevenue || totalRevenue,
      purchases: realPurchases || totalPurchases,
      leads: realLeads || totalLeads,
      messages: totalMessages,
      roas: Math.round(roas * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    },
    chart: dailyMetrics.map(d => ({
      date: d.date,
      spend: d._sum.spend ?? 0,
      revenue: d._sum.revenue ?? 0,
      leads: d._sum.leads ?? 0,
      purchases: d._sum.purchases ?? 0,
      messages: d._sum.messages ?? 0,
    })),
    period: { from, to },
  });
}
