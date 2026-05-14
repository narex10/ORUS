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

/** Início do dia UTC (yyyy-mm-dd) — evita Date('yyyy-mm-dd') ambíguo em alguns runtimes. */
function utcDayStart(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return new Date(isoDate);
  }
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Fim inclusivo do dia UTC; sem isso, `to=yyyy-mm-dd` virava 00:00 UTC e cortava o dia inteiro. */
function utcDayEnd(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return new Date(isoDate);
  }
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export async function getDashboard(req: AuthRequest, res: Response) {
  const { id: profileId } = req.params;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: req.userId! },
  });
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' });

  const { from: fromStr, to: toStr } = periodSchema.parse(req.query);
  const defaults = defaultDates();
  const from = fromStr ? utcDayStart(fromStr) : defaults.from;
  const to = toStr ? utcDayEnd(toStr) : defaults.to;

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
  const realRevenue = Number(conversions.find(c => c.type === 'PURCHASE')?._sum.value ?? 0) || 0;

  // Vendas: Meta (métricas sincronizadas) + ORUS (site, CRM Zap, pixel interno)
  const purchasesTotal = realPurchases + totalPurchases;
  const revenueTotal = realRevenue + totalRevenue;

  const roas = totalSpend > 0 ? revenueTotal / totalSpend : 0;
  const cpa = purchasesTotal > 0 ? totalSpend / purchasesTotal : 0;

  // Série temporal por dia (Meta) + vendas/faturamento ORUS por dia
  const dailyMetrics = await prisma.campaignMetric.groupBy({
    by: ['date'],
    where: {
      campaign: { profileId },
      date: { gte: from, lte: to },
    },
    _sum: { spend: true, revenue: true, leads: true, purchases: true, messages: true },
    orderBy: { date: 'asc' },
  });

  const sitePurchaseRows = await prisma.siteConversion.findMany({
    where: {
      profileId,
      type: 'PURCHASE',
      createdAt: { gte: from, lte: to },
    },
    select: { createdAt: true, value: true },
  });

  const dayKeyUTC = (d: Date) => d.toISOString().slice(0, 10);

  type DayAgg = {
    date: Date;
    spend: number;
    revenue: number;
    leads: number;
    purchases: number;
    messages: number;
  };

  const byDay = new Map<string, DayAgg>();

  for (const d of dailyMetrics) {
    const key = dayKeyUTC(new Date(d.date));
    byDay.set(key, {
      date: new Date(d.date),
      spend: d._sum.spend ?? 0,
      revenue: d._sum.revenue ?? 0,
      leads: d._sum.leads ?? 0,
      purchases: d._sum.purchases ?? 0,
      messages: d._sum.messages ?? 0,
    });
  }

  for (const row of sitePurchaseRows) {
    const key = dayKeyUTC(new Date(row.createdAt));
    const v = row.value != null ? Number(row.value) : 0;
    const cur = byDay.get(key);
    if (cur) {
      cur.purchases += 1;
      cur.revenue += v;
    } else {
      byDay.set(key, {
        date: new Date(key + 'T12:00:00.000Z'),
        spend: 0,
        revenue: v,
        leads: 0,
        purchases: 1,
        messages: 0,
      });
    }
  }

  const chart = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => ({
      date: row.date,
      spend: row.spend,
      revenue: row.revenue,
      leads: row.leads,
      purchases: row.purchases,
      messages: row.messages,
    }));

  return res.json({
    kpis: {
      spend: totalSpend,
      revenue: revenueTotal,
      purchases: purchasesTotal,
      leads: realLeads || totalLeads,
      messages: totalMessages,
      roas: Math.round(roas * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    },
    chart,
    period: { from, to },
  });
}
