import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
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

  return res.json({ ok: true, conversionId: conversion.id });
}

export async function getTrackingScript(req: Request, res: Response) {
  const { key } = req.params;
  const apiUrl = process.env.FRONTEND_URL?.replace('5173', '3001') ?? 'http://localhost:3001';

  const script = generateTrackingScript(key, apiUrl);

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(script);
}

function generateTrackingScript(trackingKey: string, apiUrl: string): string {
  return `
/* ORUS Tracking Script v1.0 */
(function(w, d, k, api) {
  'use strict';

  var STORAGE_KEY = 'orus_params_' + k;
  var SESSION_KEY = 'orus_session_' + k;

  // Gera ID de sessão único
  function genId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Fingerprint leve do dispositivo
  function getFingerprint() {
    var parts = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language
    ];
    var hash = 0, s = parts.join('|');
    for (var i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  // Extrai parâmetros da URL
  function getUrlParams() {
    var params = {};
    var search = w.location.search.slice(1);
    if (!search) return params;
    search.split('&').forEach(function(p) {
      var kv = p.split('=');
      if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return params;
  }

  // Suporte a cloaker: lê token do localStorage se presente
  function getCloakerToken() {
    try {
      return localStorage.getItem('_cloaker_token') ||
             localStorage.getItem('cloaker_token') ||
             localStorage.getItem('ct') ||
             sessionStorage.getItem('ct') || null;
    } catch(e) { return null; }
  }

  // Persiste params no localStorage (sobrevive a redirects do cloaker)
  function saveParams(params) {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      var merged = Object.assign({}, stored, params);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch(e) {}
  }

  function loadParams() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) { return {}; }
  }

  function getSession() {
    try {
      var s = sessionStorage.getItem(SESSION_KEY);
      if (!s) { s = genId(); sessionStorage.setItem(SESSION_KEY, s); }
      return s;
    } catch(e) { return genId(); }
  }

  // Captura e persiste parâmetros ao carregar
  var urlParams = getUrlParams();
  var tracked = {};
  var TRACKED_KEYS = ['bm', 'utm_campaign', 'utm_content', 'utm_source', 'utm_medium',
                      'creative_id', 'adset_id', 'site_campaign_id', 'site_campaign_name',
                      'fbclid', 'ttclid', 'gclid'];

  TRACKED_KEYS.forEach(function(k) {
    if (urlParams[k]) tracked[k] = urlParams[k];
  });

  if (Object.keys(tracked).length > 0) saveParams(tracked);

  var allParams = loadParams();

  // Função principal de envio
  function sendConversion(type, data) {
    var payload = {
      trackingKey: k,
      type: type,
      bmId: allParams['bm'],
      utmCampaign: allParams['utm_campaign'],
      utmContent: allParams['utm_content'],
      utmSource: allParams['utm_source'],
      utmMedium: allParams['utm_medium'],
      creativeId: allParams['creative_id'],
      adsetId: allParams['adset_id'],
      siteCampaignId: allParams['site_campaign_id'],
      siteCampaignName: allParams['site_campaign_name'],
      sessionId: getSession(),
      fingerprint: getFingerprint(),
      referrer: d.referrer,
      pageUrl: w.location.href,
      cloakerToken: getCloakerToken(),
      rawParams: Object.assign({}, allParams, urlParams)
    };

    if (data) Object.assign(payload, data);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', api + '/api/tracking/conversion', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(payload));
  }

  // API pública
  w.orus = {
    lead: function(data) { sendConversion('LEAD', data); },
    purchase: function(data) { sendConversion('PURCHASE', data); },
    pageview: function() { sendConversion('PAGEVIEW', {}); },
    custom: function(data) { sendConversion('CUSTOM', data); }
  };

  // Auto pageview
  sendConversion('PAGEVIEW', {});

})(window, document, '${trackingKey}', '${apiUrl}');
`.trim();
}
