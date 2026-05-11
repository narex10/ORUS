import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/crypto';

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta';

interface GA4ReportRow {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

interface GA4ReportResponse {
  rows?: GA4ReportRow[];
  rowCount?: number;
}

// ─── Puxa dados do GA4 via Data API ──────────────────────────

export async function syncGA4Integration(integrationId: string): Promise<{
  sessions: number;
  events: number;
}> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration?.accountId) {
    throw new Error('Measurement ID não configurado (ex: G-XXXXXXXXXX)');
  }

  const config = integration.extraConfig ? JSON.parse(integration.extraConfig) : {};
  const apiSecret = config.apiSecret;

  if (!apiSecret) {
    throw new Error('API Secret do GA4 não configurado');
  }

  const measurementId = integration.accountId;
  const propertyId = config.propertyId;

  if (!propertyId) {
    throw new Error('Property ID do GA4 não configurado (ex: 123456789)');
  }

  const token = integration.encryptedToken ? decrypt(integration.encryptedToken) : null;
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // Relatório de eventos de conversão dos últimos 30 dias
  const body = {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionCampaignName' },
      { name: 'sessionSource' },
      { name: 'eventName' },
    ],
    metrics: [
      { name: 'eventCount' },
      { name: 'sessions' },
      { name: 'conversions' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['purchase', 'generate_lead', 'sign_up', 'begin_checkout'],
        },
      },
    },
    limit: 10000,
  };

  const res = await fetch(
    `${GA4_API}/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 API error: ${err}`);
  }

  const data = await res.json() as GA4ReportResponse;
  const rows = data.rows ?? [];

  let totalEvents = 0;
  let totalSessions = 0;

  // Mapeia eventos GA4 → SiteConversion
  for (const row of rows) {
    const [date, campaign, source, eventName] = row.dimensionValues.map(d => d.value);
    const [eventCount, sessions, conversions] = row.metricValues.map(m => parseFloat(m.value));

    totalEvents += eventCount;
    totalSessions += sessions;

    const conversionType =
      eventName === 'purchase' ? 'PURCHASE' :
      (eventName === 'generate_lead' || eventName === 'sign_up') ? 'LEAD' :
      'CUSTOM';

    // Registra como conversões do site (agregadas por dia)
    const dateObj = new Date(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    );

    // Cria N conversões (uma por event_count) agrupadas por dia
    for (let i = 0; i < Math.min(eventCount, 1000); i++) {
      await prisma.siteConversion.create({
        data: {
          profileId: integration.profileId,
          type: conversionType,
          utmCampaign: campaign !== '(not set)' ? campaign : null,
          utmSource: source !== '(not set)' ? source : null,
          createdAt: dateObj,
        },
      });
    }
  }

  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  return { sessions: totalSessions, events: totalEvents };
}

// ─── Envia evento via Measurement Protocol (server-side) ──────

export async function sendGA4Event(params: {
  measurementId: string;
  apiSecret: string;
  clientId: string;
  eventName: string;
  eventParams?: Record<string, unknown>;
}) {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${params.measurementId}&api_secret=${params.apiSecret}`;

  const payload = {
    client_id: params.clientId,
    events: [{
      name: params.eventName,
      params: params.eventParams ?? {},
    }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.ok;
}
