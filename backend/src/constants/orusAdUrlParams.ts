/**
 * Padrão ORUS para parâmetros de URL em anúncios (Meta, Google, etc.).
 * O script do site persiste estes query params; o CRM Zap lê os mesmos nomes na primeira URL da mensagem.
 */

/** Chaves lidas da URL da landing e persistidas pelo script (snake_case na query). */
export const ORUS_TRACKED_QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'creative_id',
  'adset_id',
  'site_campaign_id',
  'site_campaign_name',
  'bm',
  'fbclid',
  'gclid',
  'ttclid',
] as const;

export type OrusUrlParamDoc = {
  key: string;
  obrigatorio: boolean;
  descricao: string;
  exemplo: string;
  mapsTo: string;
};

export const ORUS_URL_PARAMETER_DOCS: OrusUrlParamDoc[] = [
  {
    key: 'utm_source',
    obrigatorio: true,
    descricao: 'Origem da mídia. Para Meta Ads use sempre o mesmo valor (ex.: meta).',
    exemplo: 'meta',
    mapsTo: 'utmSource',
  },
  {
    key: 'utm_medium',
    obrigatorio: true,
    descricao: 'Tipo de tráfego pago.',
    exemplo: 'cpc',
    mapsTo: 'utmMedium',
  },
  {
    key: 'utm_campaign',
    obrigatorio: true,
    descricao: 'Identificador da campanha no ORUS (slug ou código interno).',
    exemplo: 'promo_verao_2026',
    mapsTo: 'utmCampaign',
  },
  {
    key: 'utm_content',
    obrigatorio: true,
    descricao: 'Variação do criativo ou do anúncio (único por combinação criativo×ad).',
    exemplo: 'video_hook_a',
    mapsTo: 'utmContent',
  },
  {
    key: 'utm_term',
    obrigatorio: false,
    descricao: 'Palavra-chave ou rótulo extra (opcional).',
    exemplo: 'lookalike_compradores',
    mapsTo: 'utmTerm',
  },
  {
    key: 'creative_id',
    obrigatorio: false,
    descricao: 'ID do criativo na Meta. Use macro dinâmica no Gerenciador.',
    exemplo: '{{ad.id}}',
    mapsTo: 'creativeId',
  },
  {
    key: 'adset_id',
    obrigatorio: false,
    descricao: 'ID do conjunto de anúncios na Meta.',
    exemplo: '{{adset.id}}',
    mapsTo: 'adsetId',
  },
  {
    key: 'site_campaign_id',
    obrigatorio: false,
    descricao: 'Seu ID interno (ex.: planilha ou CRM).',
    exemplo: 'cmp_88421',
    mapsTo: 'siteCampaignId',
  },
  {
    key: 'site_campaign_name',
    obrigatorio: false,
    descricao: 'Nome legível da campanha para relatórios.',
    exemplo: 'Verão%20Remarketing',
    mapsTo: 'siteCampaignName',
  },
  {
    key: 'bm',
    obrigatorio: false,
    descricao: 'Identificador opcional (BM, conta ou marca).',
    exemplo: 'bm_loja01',
    mapsTo: 'bmId',
  },
  {
    key: 'fbclid',
    obrigatorio: false,
    descricao: 'Anexado automaticamente pelo Facebook/Instagram no clique. Não inclua manualmente.',
    exemplo: '(automático)',
    mapsTo: 'rawParams',
  },
  {
    key: 'gclid',
    obrigatorio: false,
    descricao: 'Google Ads anexa no clique, se aplicável.',
    exemplo: '(automático)',
    mapsTo: 'rawParams',
  },
  {
    key: 'ttclid',
    obrigatorio: false,
    descricao: 'TikTok anexa no clique, se aplicável.',
    exemplo: '(automático)',
    mapsTo: 'rawParams',
  },
];

const META_MACRO_NOTE =
  'No Meta Ads: nível de conjunto/anúncio → "Parâmetros da URL" (URL parameters). Macros comuns: {{campaign.id}}, {{adset.id}}, {{ad.id}}. Substitua creative_id e adset_id pelos campos suportados na sua conta.';

/** Monta URL de exemplo (landing já com path se existir no base). */
export function buildOrusStandardExampleUrl(baseInput: string): string {
  let base = baseInput.trim().replace(/\/+$/, '') || 'https://seusite.com.br/landing';
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  const sep = base.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    utm_source: 'meta',
    utm_medium: 'cpc',
    utm_campaign: 'ORUS_NOME_CAMPANHA',
    utm_content: 'ORUS_CRIATIVO',
    utm_term: 'opcional',
    creative_id: '{{ad.id}}',
    adset_id: '{{adset.id}}',
    site_campaign_id: 'ORUS_ID_INTERNO',
    site_campaign_name: 'Nome legivel campanha',
    bm: 'opcional',
  });
  return `${base}${sep}${params.toString()}`;
}

export function getOrusUrlStandardPayload(baseQuery?: string) {
  const base =
    typeof baseQuery === 'string' &&
    baseQuery.trim().length > 0 &&
    !baseQuery.includes('<') &&
    baseQuery.length < 500
      ? baseQuery.trim()
      : 'https://seusite.com.br/landing';
  return {
    versao: 1,
    parameters: ORUS_URL_PARAMETER_DOCS,
    trackedKeys: [...ORUS_TRACKED_QUERY_KEYS],
    exampleUrl: buildOrusStandardExampleUrl(base),
    metaAds: META_MACRO_NOTE,
    resumo:
      'Use sempre os nomes em minúsculas: utm_source, utm_medium, utm_campaign, utm_content. Os IDs Meta (creative_id, adset_id) alinham com o ORUS e o mini funil.',
  };
}
