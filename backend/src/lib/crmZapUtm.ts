/** Extrai URLs de um texto (ex.: primeira mensagem do WhatsApp com link do anúncio). */
export function extractUrlsFromText(text: string): string[] {
  if (!text?.trim()) return [];
  const re = /https?:\/\/[^\s<>"'{}|\\^`[\]()]+/gi;
  const raw = text.match(re) ?? [];
  const cleaned = raw.map(u => u.replace(/[),.]+$/g, ''));
  return [...new Set(cleaned)];
}

function pickParam(sp: URLSearchParams, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = sp.get(k) ?? sp.get(k.toUpperCase()) ?? sp.get(k.toLowerCase());
    if (v) return decodeURIComponent(v);
  }
  return undefined;
}

/** Normaliza parâmetros de anúncio a partir de uma URL completa. */
export function parseAdParamsFromUrl(urlStr: string): {
  sourceUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  siteCampaignId?: string;
  siteCampaignName?: string;
  raw: Record<string, string>;
} {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    try {
      u = new URL(urlStr, 'https://trk.local/');
    } catch {
      return { sourceUrl: urlStr, raw: {} };
    }
  }
  const sp = u.searchParams;
  const raw: Record<string, string> = {};
  sp.forEach((v, k) => {
    raw[k] = v;
  });

  const utmSource   = pickParam(sp, 'utm_source', 'utmSource');
  const utmMedium   = pickParam(sp, 'utm_medium', 'utmMedium');
  const utmCampaign = pickParam(sp, 'utm_campaign', 'utmCampaign');
  const utmContent  = pickParam(sp, 'utm_content', 'utmContent');
  const utmTerm     = pickParam(sp, 'utm_term', 'utmTerm');
  const fbclid      = pickParam(sp, 'fbclid');
  const gclid       = pickParam(sp, 'gclid');
  const siteCampaignId = pickParam(sp, 'site_campaign_id', 'siteCampaignId', 'campaign_id', 'utm_id');
  const siteCampaignName = pickParam(sp, 'site_campaign_name', 'siteCampaignName');

  return {
    sourceUrl: urlStr,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    fbclid,
    gclid,
    siteCampaignId,
    siteCampaignName,
    raw,
  };
}

/** Usa a primeira URL encontrada no texto; senão tenta o texto inteiro como URL. */
export function parseAdParamsFromMessage(message?: string | null) {
  if (!message?.trim()) {
    return {
      sourceUrl: undefined as string | undefined,
      utmSource: undefined as string | undefined,
      utmMedium: undefined as string | undefined,
      utmCampaign: undefined as string | undefined,
      utmContent: undefined as string | undefined,
      utmTerm: undefined as string | undefined,
      fbclid: undefined as string | undefined,
      gclid: undefined as string | undefined,
      siteCampaignId: undefined as string | undefined,
      siteCampaignName: undefined as string | undefined,
      rawParams: undefined as string | undefined,
    };
  }
  const urls = extractUrlsFromText(message);
  const target = urls[0];
  if (!target) {
    return {
      sourceUrl: undefined,
      utmSource: undefined,
      utmMedium: undefined,
      utmCampaign: undefined,
      utmContent: undefined,
      utmTerm: undefined,
      fbclid: undefined,
      gclid: undefined,
      siteCampaignId: undefined,
      siteCampaignName: undefined,
      rawParams: undefined,
    };
  }
  const p = parseAdParamsFromUrl(target);
  return {
    sourceUrl: p.sourceUrl,
    utmSource: p.utmSource,
    utmMedium: p.utmMedium,
    utmCampaign: p.utmCampaign,
    utmContent: p.utmContent,
    utmTerm: p.utmTerm,
    fbclid: p.fbclid,
    gclid: p.gclid,
    siteCampaignId: p.siteCampaignId,
    siteCampaignName: p.siteCampaignName,
    rawParams: Object.keys(p.raw).length ? JSON.stringify(p.raw) : undefined,
  };
}

export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (!d.length) return phone.trim();
  return d;
}
