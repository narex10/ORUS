import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { upsertCrmLeadFromSiteConversion } from '../services/crmLeadSync';
import { ORUS_TRACKED_QUERY_KEYS, getOrusUrlStandardPayload } from '../constants/orusAdUrlParams';
const conversionSchema = z.object({
  trackingKey: z.string(),
  type: z.enum(['LEAD', 'PURCHASE', 'PAGEVIEW', 'CUSTOM']),
  value: z.number().optional(),

  // Parâmetros de rastreamento
  bmId: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  creativeId: z.string().optional(),
  adsetId: z.string().optional(),
  siteCampaignId: z.string().optional(),
  siteCampaignName: z.string().optional(),

  // Dados do usuário
  sessionId: z.string().optional(),
  fingerprint: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  referrer: z.string().optional(),
  pageUrl: z.string().optional(),
  cloakerToken: z.string().optional(),
  rawParams: z.record(z.string()).optional(),
});

export async function receiveConversion(req: Request, res: Response) {
  // CORS permissivo para aceitar do script externo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.sendStatus(204);

  const body = conversionSchema.parse(req.body);

  const trackingKey = await prisma.trackingKey.findUnique({
    where: { key: body.trackingKey, isActive: true },
  });
  if (!trackingKey) {
    return res.status(404).json({ error: 'Tracking key inválida' });
  }

  // Tentar encontrar o Ad pelo creativeId externo
  let adId: string | undefined;
  if (body.creativeId) {
    const ad = await prisma.ad.findFirst({
      where: { externalId: body.creativeId },
    });
    adId = ad?.id;
  }

  // Deduplicação por fingerprint + tipo nas últimas 24h
  if (body.fingerprint) {
    const recent = await prisma.siteConversion.findFirst({
      where: {
        profileId: trackingKey.profileId,
        fingerprint: body.fingerprint,
        type: body.type as string,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent && body.type === 'LEAD') {
      return res.json({ ok: true, deduplicated: true });
    }
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip;

  const conversion = await prisma.siteConversion.create({
    data: {
      profileId: trackingKey.profileId,
      trackingKeyId: trackingKey.id,
      adId,
      type: body.type,
      value: body.value,
      bmId: body.bmId,
      utmCampaign: body.utmCampaign,
      utmContent: body.utmContent,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      creativeId: body.creativeId,
      adsetId: body.adsetId,
      siteCampaignId: body.siteCampaignId,
      siteCampaignName: body.siteCampaignName,
      sessionId: body.sessionId,
      fingerprint: body.fingerprint,
      email: body.email,
      phone: body.phone,
      ip,
      userAgent: req.headers['user-agent'],
      referrer: body.referrer,
      pageUrl: body.pageUrl,
      cloakerToken: body.cloakerToken,
      rawParams: body.rawParams ? JSON.stringify(body.rawParams) : null,
    },
  });

  if (body.type === 'LEAD') {
    try {
      await upsertCrmLeadFromSiteConversion({
        profileId: trackingKey.profileId,
        phone: body.phone,
        email: body.email,
        fingerprint: body.fingerprint,
        sessionId: body.sessionId,
        pageUrl: body.pageUrl,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        utmContent: body.utmContent,
        creativeId: body.creativeId,
        adsetId: body.adsetId,
        siteCampaignId: body.siteCampaignId,
        siteCampaignName: body.siteCampaignName,
        rawParams: body.rawParams ? JSON.stringify(body.rawParams) : null,
      });
    } catch (e) {
      console.error('[CRM Zap] sync lead site', e);
    }
  }

  return res.json({ ok: true, conversionId: conversion.id });
}

export async function getTrackingScript(req: Request, res: Response) {
  const { key } = req.params;
  const apiUrl = process.env.FRONTEND_URL?.replace('5173', '3001') ?? 'http://localhost:3001';

  // Busca config da chave para personalizar o script
  const trackingKey = await prisma.trackingKey.findUnique({ where: { key } });
  let config = { leads: true, pageviews: true, buttons: false, buttonSelector: '' };
  if (trackingKey?.config) {
    try { config = { ...config, ...JSON.parse(trackingKey.config) }; } catch {}
  }

  const script = generateTrackingScript(key, apiUrl, config);

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(script);
}

export function getAdUrlStandard(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  const base = typeof req.query.base === 'string' ? req.query.base : undefined;
  return res.json(getOrusUrlStandardPayload(base));
}

interface TrackingConfig {
  leads: boolean;
  pageviews: boolean;
  buttons: boolean;
  buttonSelector?: string;
}

function generateTrackingScript(trackingKey: string, apiUrl: string, cfg: TrackingConfig): string {
  const autoLeads     = cfg.leads;
  const autoPageviews = cfg.pageviews;
  const autoButtons   = cfg.buttons;
  const btnSelector   = cfg.buttonSelector || 'button[type="submit"], input[type="submit"], .orus-lead-btn';

  return `/* ORUS Tracking Script v2.0 | key:${trackingKey} */
(function(w, d, k, api) {
  'use strict';
  var STORAGE_KEY = 'orus_p_' + k;
  var SESSION_KEY = 'orus_s_' + k;

  function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  function fingerprint() {
    var s = [navigator.userAgent, screen.width + 'x' + screen.height,
             Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language].join('|');
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(36);
  }

  function getUrlParams() {
    var p = {}, s = w.location.search.slice(1);
    if (!s) return p;
    s.split('&').forEach(function(x) { var kv = x.split('='); if (kv[0]) p[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    return p;
  }

  function getCloakerToken() {
    try { return localStorage.getItem('_cloaker_token') || localStorage.getItem('ct') || sessionStorage.getItem('ct') || null; } catch(e) { return null; }
  }

  function saveParams(params) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, loadParams(), params))); } catch(e) {}
  }

  function loadParams() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
  }

  function getSession() {
    try { var s = sessionStorage.getItem(SESSION_KEY); if (!s) { s = genId(); sessionStorage.setItem(SESSION_KEY, s); } return s; } catch(e) { return genId(); }
  }

  var urlParams = getUrlParams();
  var TRACKED = ${JSON.stringify([...ORUS_TRACKED_QUERY_KEYS])};
  var captured = {};
  TRACKED.forEach(function(key) { if (urlParams[key]) captured[key] = urlParams[key]; });
  if (Object.keys(captured).length) saveParams(captured);

  var allParams = loadParams();

  function send(type, extra) {
    var payload = {
      trackingKey: k, type: type,
      bmId: allParams['bm'],
      utmCampaign: allParams['utm_campaign'], utmContent: allParams['utm_content'],
      utmSource: allParams['utm_source'], utmMedium: allParams['utm_medium'],
      creativeId: allParams['creative_id'], adsetId: allParams['adset_id'],
      siteCampaignId: allParams['site_campaign_id'], siteCampaignName: allParams['site_campaign_name'],
      sessionId: getSession(), fingerprint: fingerprint(),
      referrer: d.referrer, pageUrl: w.location.href,
      cloakerToken: getCloakerToken(), rawParams: Object.assign({}, allParams, urlParams)
    };
    if (extra) Object.assign(payload, extra);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', api + '/api/tracking/conversion', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(payload));
  }

  // ── API pública ──────────────────────────────────────────────
  w.orus = {
    lead:     function(data) { send('LEAD', data); },
    purchase: function(data) { send('PURCHASE', data); },
    pageview: function()     { send('PAGEVIEW', {}); },
    custom:   function(data) { send('CUSTOM', data); },
    button:   function(label, data) { send('CUSTOM', Object.assign({ buttonLabel: label }, data)); }
  };

  ${autoPageviews ? '// Auto pageview\n  send(\'PAGEVIEW\', {});' : '// Pageview automático desativado'}

  ${autoLeads ? `// Auto lead — detecta submit de formulários
  d.addEventListener('submit', function(e) {
    var form = e.target;
    var email = '', phone = '';
    try {
      var emailEl = form.querySelector('input[type="email"], input[name*="email"], input[name*="mail"]');
      var phoneEl = form.querySelector('input[type="tel"], input[name*="phone"], input[name*="fone"], input[name*="whatsapp"]');
      if (emailEl) email = emailEl.value;
      if (phoneEl) phone = phoneEl.value;
    } catch(ex) {}
    send('LEAD', { email: email || undefined, phone: phone || undefined });
  }, true);` : '// Captura de formulários desativada'}

  ${autoButtons ? `// Auto button tracking — seletor: ${btnSelector}
  d.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== d.body) {
      if (el.matches && el.matches(${JSON.stringify(btnSelector)})) {
        send('LEAD', { buttonLabel: el.innerText || el.value || el.getAttribute('aria-label') || '' });
        break;
      }
      el = el.parentElement;
    }
  }, true);` : '// Rastreamento de botões desativado'}

})(window, document, '${trackingKey}', '${apiUrl}');`.trim();
}
