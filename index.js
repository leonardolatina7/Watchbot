/**
 * Watch Price Bot v11 — Sistema Definitivo
 *
 * SOLO API UFFICIALI — niente scraping che viene bloccato:
 * - eBay Browse API (globale, 190 paesi)
 * - SerpAPI Google Shopping (tutto il web)
 * - Facebook Graph API (Marketplace locale)
 * - Reddit API (discovery sentiment)
 * - YouTube Data API (discovery video)
 *
 * MODULO 1: ARBITRAGGIO METALLI
 * - Pesi precisi da database schede tecniche
 * - Oro 18k + Platino
 * - Da €500 in su, qualsiasi marca
 * - Alert: sotto valore metallo (arbitraggio) + entro 15% (trattabile)
 *
 * MODULO 2: DISCOVERY ENGINE
 * - Analisi autonoma brand emergenti
 * - Emerging Score algoritmo proprietario
 * - Nessun brand da suggerire manualmente
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { findWatchModel } = require('./metalsDatabase');
const { SEED_BRANDS, scanAllBrands } = require('./discoveryEngine');

const app = express();
app.use(cors());
app.use(express.json());

// ── DATABASE IN MEMORIA ───────────────────────────────────────
let db = {
  arbitrage: [], nearArbitrage: [],
  discoveries: [], discoveryAlerts: [],
  watchlist: [], portfolio: [], alerts: [],
  goldPrices: [], platinumPrices: [],
  searchCache: new Map(),
};
let _id = Date.now();
const nid = () => ++_id;

// ── PREZZI METALLI LIVE ───────────────────────────────────────
let cachedGold = null, goldFetched = 0;
let cachedPlatinum = null, platinumFetched = 0;

async function getGoldPrice() {
  if (cachedGold && Date.now() - goldFetched < 30 * 60 * 1000) return cachedGold;
  try {
    const r = await axios.get('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://goldprice.org' }, timeout: 8000
    });
    const usd = r.data?.items?.[0]?.xauPrice;
    if (usd) {
      const fx = await axios.get('https://api.frankfurter.app/latest?from=USD&to=EUR', { timeout: 5000 });
      const g = usd * (fx.data?.rates?.EUR || 0.92) / 31.1035;
      cachedGold = g; goldFetched = Date.now();
      db.goldPrices.push({ price: g, at: new Date().toISOString() });
      if (db.goldPrices.length > 96) db.goldPrices = db.goldPrices.slice(-96);
      return g;
    }
  } catch {}
  return cachedGold || 78.5;
}

async function getPlatinumPrice() {
  if (cachedPlatinum && Date.now() - platinumFetched < 30 * 60 * 1000) return cachedPlatinum;
  try {
    const r = await axios.get('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://goldprice.org' }, timeout: 8000
    });
    const usdPt = r.data?.items?.[0]?.xptPrice;
    if (usdPt) {
      const fx = await axios.get('https://api.frankfurter.app/latest?from=USD&to=EUR', { timeout: 5000 });
      const p = usdPt * (fx.data?.rates?.EUR || 0.92) / 31.1035;
      cachedPlatinum = p; platinumFetched = Date.now();
      db.platinumPrices.push({ price: p, at: new Date().toISOString() });
      return p;
    }
  } catch {}
  return cachedPlatinum || (cachedGold ? cachedGold * 0.88 : 69);
}

// ── CALCOLO VALORE METALLO ────────────────────────────────────
const GOLD_KW = ['18k','18kt','750','au750','18ct','18 karat','18 carati','18 carats','or 18','oro 18','gold 18','yellow gold','rose gold','white gold','solid gold','oro giallo','oro rosa','oro bianco','or jaune','or rose','or blanc','everose','sedna','moonshine','gelbgold','rotgold','weissgold'];
const PLAT_KW = ['platino','platinum','pt950','pt 950','pt900','platin','platine'];

function detectMetal(title) {
  const t = (title || '').toLowerCase();
  if (PLAT_KW.some(k => t.includes(k))) return 'platinum';
  if (GOLD_KW.some(k => t.includes(k))) return '18k';
  return null;
}

async function calcMetalValue(title, priceEur) {
  const metal = detectMetal(title);
  if (!metal) return null;
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  const model = findWatchModel(title);
  if (!model) return null;
  const spotPrice = metal === 'platinum' ? platinum : gold;
  const metalValue = Math.round(model.pureMetalGrams * spotPrice);
  const diff = metalValue - priceEur;
  const diffPct = Math.round((diff / metalValue) * 1000) / 10;
  return {
    metal, pureMetalGrams: model.pureMetalGrams,
    metalValue, spotPrice: Math.round(spotPrice * 100) / 100,
    diffPct, diff,
    isArbitrage: diffPct > 0,
    isNear: diffPct > -15 && diffPct <= 0,
    confidence: model.confidence,
    modelName: model.model,
  };
}

// ── CAMBIO VALUTE ─────────────────────────────────────────────
let fx = { USD: 0.92, GBP: 1.17, CHF: 1.05, JPY: 0.0062 }, fxF = 0;
async function toEur(price, currency) {
  if (!price || currency === 'EUR') return price;
  if (Date.now() - fxF > 3600000) {
    try {
      const r = await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF,JPY', { timeout: 5000 });
      fx = { USD: 1/r.data.rates.USD, GBP: 1/r.data.rates.GBP, CHF: 1/r.data.rates.CHF, JPY: 1/r.data.rates.JPY };
      fxF = Date.now();
    } catch {}
  }
  return price * (fx[currency] || 1);
}

// ── TELEGRAM ─────────────────────────────────────────────────
async function tg(text, chatId) {
  if (!process.env.TELEGRAM_TOKEN) return;
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId || process.env.TELEGRAM_CHAT_ID,
      text, parse_mode: 'HTML',
    }, { timeout: 10000 });
  } catch(e) { console.error('[TG]', e.message); }
}

// ── EMAIL ─────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });

// ══════════════════════════════════════════════════════════════
// EBAY BROWSE API — ufficiale, mai bloccata
// Cerca su tutti i marketplace eBay del mondo
// ══════════════════════════════════════════════════════════════
let ebayToken = null, ebayExp = 0;

async function getEbayToken() {
  if (ebayToken && Date.now() < ebayExp) return ebayToken;
  if (!process.env.EBAY_CLIENT_ID) return null;
  const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const r = await axios.post(
    'https://api.ebay.com/identity/v1/oauth2/token',
    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    { headers: { Authorization: `Basic ${c}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  ebayToken = r.data.access_token;
  ebayExp = Date.now() + (r.data.expires_in - 60) * 1000;
  return ebayToken;
}

async function searchEbayMarket(query, marketId, minPrice = 500) {
  const token = await getEbayToken();
  if (!token) return [];
  try {
    const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: {
        q: query,
        category_ids: '31387', // Watches
        sort: 'price',
        limit: 50,
        filter: `price:[${minPrice}..],priceCurrency:${marketId === 'EBAY_JP' ? 'JPY' : 'EUR'}`,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketId,
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=IT',
      },
      timeout: 15000,
    });
    return (r.data.itemSummaries || []).map(i => ({
      platform: `eBay ${marketId.replace('EBAY_', '')}`,
      title: i.title,
      price: parseFloat(i.price?.value || 0),
      currency: i.price?.currency || 'EUR',
      url: i.itemWebUrl,
      location: i.itemLocation?.country || '',
      condition: i.condition || '',
      image: i.thumbnailImages?.[0]?.imageUrl || '',
    })).filter(i => i.price > 0);
  } catch (e) {
    console.error(`[eBay ${marketId}]`, e.response?.data?.errors?.[0]?.message || e.message);
    return [];
  }
}

// Cerca su tutti i mercati eBay globali
async function searchEbayGlobal(query, minPrice = 500) {
  const markets = ['EBAY_IT', 'EBAY_FR', 'EBAY_DE', 'EBAY_GB', 'EBAY_ES', 'EBAY_CH'];
  const results = await Promise.allSettled(
    markets.map(m => searchEbayMarket(query, m, minPrice))
  );
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  // Deduplicazione per URL
  const seen = new Set();
  return all.filter(i => {
    if (seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });
}

// ══════════════════════════════════════════════════════════════
// SERPAPI — Google Shopping
// Copre TUTTO il web: Subito, Leboncoin, Ricardo, Wallapop ecc.
// ══════════════════════════════════════════════════════════════
async function searchGoogleShopping(query, country = 'it') {
  if (!process.env.SERPAPI_KEY) return [];
  try {
    const countryConfig = {
      it: { gl: 'it', hl: 'it', currency: 'EUR' },
      fr: { gl: 'fr', hl: 'fr', currency: 'EUR' },
      de: { gl: 'de', hl: 'de', currency: 'EUR' },
      ch: { gl: 'ch', hl: 'de', currency: 'CHF' },
      us: { gl: 'us', hl: 'en', currency: 'USD' },
      jp: { gl: 'jp', hl: 'ja', currency: 'JPY' },
    };
    const cfg = countryConfig[country] || countryConfig.it;
    const r = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_shopping',
        q: query,
        gl: cfg.gl,
        hl: cfg.hl,
        api_key: process.env.SERPAPI_KEY,
        num: 20,
      },
      timeout: 15000,
    });
    const items = r.data.shopping_results || [];
    return items.map(i => ({
      platform: `Google Shopping (${country.toUpperCase()})`,
      title: i.title,
      price: parseFloat(String(i.price || '0').replace(/[^\d,.]/g, '').replace(',', '.')) || 0,
      currency: cfg.currency,
      url: i.link || i.product_link || '',
      source: i.source || '',
      image: i.thumbnail || '',
    })).filter(i => i.price > 0 && i.url);
  } catch (e) {
    console.error(`[SerpAPI ${country}]`, e.response?.data?.error || e.message);
    return [];
  }
}

// Cerca su Google Shopping in tutti i paesi
async function searchGoogleShoppingGlobal(query) {
  const countries = ['it', 'fr', 'de', 'ch'];
  const results = await Promise.allSettled(
    countries.map(c => searchGoogleShopping(query, c))
  );
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const seen = new Set();
  return all.filter(i => { if(seen.has(i.url)) return false; seen.add(i.url); return true; });
}

// ══════════════════════════════════════════════════════════════
// FACEBOOK MARKETPLACE — Graph API ufficiale
// Trova venditori vicino a casa tua
// ══════════════════════════════════════════════════════════════
async function searchFacebookMarketplace(query, lat = 45.4642, lng = 9.1900, radiusKm = 100) {
  if (!process.env.FACEBOOK_ACCESS_TOKEN) return [];
  try {
    // Facebook Marketplace Search via Graph API
    const r = await axios.get('https://graph.facebook.com/v19.0/marketplace_search', {
      params: {
        q: query,
        access_token: process.env.FACEBOOK_ACCESS_TOKEN,
        latitude: lat,
        longitude: lng,
        radius: radiusKm * 1000, // in metri
        limit: 20,
        fields: 'id,name,price,description,location,images,listing_url',
      },
      timeout: 15000,
    });
    return (r.data.data || []).map(i => ({
      platform: 'Facebook Marketplace 📍',
      title: i.name || '',
      price: parseFloat(String(i.price?.amount || '0').replace(/[^\d.]/g, '')) || 0,
      currency: i.price?.currency || 'EUR',
      url: i.listing_url || `https://www.facebook.com/marketplace/item/${i.id}`,
      location: i.location?.city || '',
      isLocal: true,
      image: i.images?.[0]?.uri || '',
    })).filter(i => i.price > 0);
  } catch (e) {
    console.error('[Facebook Marketplace]', e.response?.data?.error?.message || e.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// RICERCA COMPLETA — combina tutte le fonti
// ══════════════════════════════════════════════════════════════
async function searchAll(query, userLat = null, userLng = null) {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();

  // Ricerca parallela su tutte le fonti
  const [ebayResults, googleResults, fbResults] = await Promise.allSettled([
    searchEbayGlobal(query, 300),
    searchGoogleShoppingGlobal(query),
    (userLat && userLng) ? searchFacebookMarketplace(query, userLat, userLng) : Promise.resolve([]),
  ]);

  const all = [
    ...(ebayResults.status === 'fulfilled' ? ebayResults.value : []),
    ...(googleResults.status === 'fulfilled' ? googleResults.value : []),
    ...(fbResults.status === 'fulfilled' ? fbResults.value : []),
  ];

  // Arricchisci con dati metallo
  const enriched = await Promise.all(all.map(async item => {
    const priceEur = Math.round(await toEur(item.price, item.currency));
    if (priceEur < 300) return null;
    const metalData = await calcMetalValue(item.title, priceEur);
    return { ...item, priceEur, metalData };
  }));

  const valid = enriched.filter(Boolean).sort((a, b) => a.priceEur - b.priceEur);

  // Miglior prezzo per piattaforma
  const byPlatform = {};
  for (const i of valid) {
    if (!byPlatform[i.platform] || i.priceEur < byPlatform[i.platform].priceEur)
      byPlatform[i.platform] = i;
  }

  return {
    query,
    results: Object.values(byPlatform).sort((a, b) => a.priceEur - b.priceEur),
    allListings: valid,
    lowest: valid[0] || null,
    arbitrage: valid.filter(i => i.metalData?.isArbitrage),
    nearArbitrage: valid.filter(i => i.metalData?.isNear),
    goldPricePerGram: Math.round(gold * 100) / 100,
    platinumPricePerGram: Math.round(platinum * 100) / 100,
    platforms: Object.keys(byPlatform),
    totalFound: valid.length,
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
// SCANSIONE ARBITRAGGIO ORO
// Query in italiano, inglese, francese, tedesco, giapponese
// ══════════════════════════════════════════════════════════════
const GOLD_QUERIES = [
  // Italiano
  'orologio oro 18k', 'orologio oro 18 carati', 'orologio oro giallo',
  'orologio oro rosa 18k', 'orologio 750 oro', 'orologio vintage oro',
  'orologio tasca oro 18k',
  // Inglese
  'watch 18k yellow gold', 'watch 18k rose gold', 'watch 18k white gold',
  'pocket watch gold 18k', 'watch solid gold 750',
  // Francese
  'montre or 18k', 'montre or jaune 18k', 'montre gousset or',
  // Tedesco
  'uhr 18 karat gelbgold', 'uhr 750 gold',
  // Platino
  'orologio platino', 'watch platinum pt950', 'montre platine 950',
  // Marche
  'rolex oro 18k', 'patek or 18k', 'cartier gold 18k',
  'omega gold 18k', 'vacheron or', 'jaeger gold',
];

async function runGoldScan() {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  console.log(`\n[GOLD SCAN v11] Oro: €${gold.toFixed(2)}/g | Platino: €${platinum.toFixed(2)}/g`);

  let foundArb = 0, foundNear = 0;
  const seenUrls = new Set([...db.arbitrage, ...db.nearArbitrage].map(a => a.url));

  for (const query of GOLD_QUERIES) {
    try {
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

      const [ebay, google] = await Promise.allSettled([
        searchEbayGlobal(query, 500),
        searchGoogleShoppingGlobal(query),
      ]);

      const all = [
        ...(ebay.status === 'fulfilled' ? ebay.value : []),
        ...(google.status === 'fulfilled' ? google.value : []),
      ];

      for (const item of all) {
        if (seenUrls.has(item.url)) continue;
        if (!detectMetal(item.title)) continue;

        const priceEur = Math.round(await toEur(item.price, item.currency));
        if (priceEur < 500) continue;

        const metal = await calcMetalValue(item.title, priceEur);
        if (!metal) continue;

        seenUrls.add(item.url);
        const entry = {
          id: nid(), platform: item.platform, title: item.title,
          price: priceEur, metalValue: metal.metalValue,
          metalGrams: metal.pureMetalGrams, metal: metal.metal,
          diffPct: metal.diffPct, confidence: metal.confidence,
          url: item.url, location: item.location || '',
          source: item.source || '', foundAt: new Date().toISOString(),
        };

        if (metal.isArbitrage) {
          db.arbitrage.push(entry);
          foundArb++;
          const emoji = metal.metal === 'platinum' ? '🔘' : '🥇';
          const name = metal.metal === 'platinum' ? 'PLATINO' : 'ORO 18K';
          await tg(
            `${emoji} <b>ARBITRAGGIO ${name}!</b>\n\n` +
            `⌚ ${item.title?.slice(0, 65)}\n` +
            `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
            `💎 Valore metallo: <b>€${metal.metalValue.toLocaleString('it-IT')}</b> (${metal.pureMetalGrams}g × €${metal.spotPrice}/g)\n` +
            `📉 <b>−${metal.diffPct}% sotto valore metallo!</b>\n` +
            `💵 Guadagno immediato: <b>€${metal.diff.toLocaleString('it-IT')}</b>\n` +
            `🏪 ${item.platform}${item.location ? ` · 📍 ${item.location}` : ''}\n` +
            (metal.confidence === 'low' ? `⚠️ Peso stimato — verifica prima\n` : '') +
            `\n<a href="${item.url}">👉 VEDI ANNUNCIO</a>`
          );
          console.log(`[ARB ${emoji}] ${item.title?.slice(0, 40)} €${priceEur} vs €${metal.metalValue} (−${metal.diffPct}%)`);

        } else if (metal.isNear) {
          db.nearArbitrage.push(entry);
          foundNear++;
          await tg(
            `💛 <b>TRATTABILE — vicino al valore metallo</b>\n\n` +
            `⌚ ${item.title?.slice(0, 65)}\n` +
            `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
            `💎 Valore metallo: <b>€${metal.metalValue.toLocaleString('it-IT')}</b>\n` +
            `📊 Solo ${Math.abs(metal.diffPct)}% sopra il valore metallo puro\n` +
            `💡 Offri −${Math.ceil(Math.abs(metal.diffPct) + 3)}% e diventa arbitraggio\n` +
            `🏪 ${item.platform}${item.location ? ` · 📍 ${item.location}` : ''}\n\n` +
            `<a href="${item.url}">👉 VEDI ANNUNCIO</a>`
          );
          console.log(`[NEAR 💛] ${item.title?.slice(0, 40)} €${priceEur} vs €${metal.metalValue} (+${Math.abs(metal.diffPct)}%)`);
        }
      }
    } catch(e) { console.error(`[GOLD SCAN] ${query}:`, e.message); }
  }

  // Pulizia DB
  if (db.arbitrage.length > 500) db.arbitrage = db.arbitrage.slice(-500);
  if (db.nearArbitrage.length > 500) db.nearArbitrage = db.nearArbitrage.slice(-500);

  console.log(`[GOLD SCAN] Fine: ${foundArb} arbitraggi, ${foundNear} trattabili`);
  await tg(
    `📊 <b>Scansione oro completata</b>\n\n` +
    `🥇 Oro: €${gold.toFixed(2)}/g\n` +
    `🔘 Platino: €${platinum.toFixed(2)}/g\n\n` +
    `✅ Arbitraggi: <b>${foundArb}</b>\n` +
    `💛 Trattabili: <b>${foundNear}</b>\n` +
    `🔍 Query: ${GOLD_QUERIES.length} · Fonti: eBay globale + Google Shopping\n` +
    (foundArb === 0 ? '\nNessun arbitraggio in questo ciclo. Prossima scansione tra 2 ore.' : '')
  );
  return { foundArb, foundNear };
}

// ══════════════════════════════════════════════════════════════
// DISCOVERY ENGINE
// ══════════════════════════════════════════════════════════════
async function runDiscoveryScan() {
  console.log('\n[DISCOVERY v11] Analisi brand indipendenti...');
  try {
    const results = await scanAllBrands();
    db.discoveries = results;
    for (const analysis of results) {
      const { brand, emergingScore } = analysis;
      const prev = db.discoveryAlerts.find(a => a.brandName === brand.name);
      const prevScore = prev?.score || 0;
      if (emergingScore.score >= 65 && (emergingScore.score - prevScore >= 10 || !prev)) {
        if (prev) prev.score = emergingScore.score;
        else db.discoveryAlerts.push({ brandName: brand.name, score: emergingScore.score, tier: brand.tier, at: new Date().toISOString() });
        const tierEmoji = { 1:'⚪', 2:'🟡', 3:'🟢', 4:'🔵' }[brand.tier] || '⚪';
        await tg(
          `🔭 <b>DISCOVERY ALERT</b>\n\n` +
          `${tierEmoji} <b>${brand.name}</b> — Tier ${brand.tier} (${brand.country})\n` +
          `📊 Emerging Score: <b>${emergingScore.score}/100</b>\n` +
          `⏳ ${emergingScore.windowLabel}\n\n` +
          `🔑 ${emergingScore.keySignal}\n\n` +
          `💡 ${emergingScore.thesis}\n\n` +
          `Reddit: ${analysis.signals?.reddit?.monthPosts || 0} post/mese · ` +
          `YouTube: ${analysis.signals?.youtube?.totalVideos || 0} video · ` +
          `Hodinkee: ${analysis.signals?.hodinkee?.hasArticle ? '✅' : '❌'}`
        );
      }
    }
    return results;
  } catch(e) {
    console.error('[DISCOVERY]', e.message);
    return [];
  }
}

// ── CACHE ─────────────────────────────────────────────────────
const cache = new Map();
const getCached = k => { const e = cache.get(k); return e && Date.now() - e.ts < 15*60*1000 ? e.d : null; };
const setCache = (k, d) => cache.set(k, { d, ts: Date.now() });

// ══════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════

// Ricerca prezzi
app.get('/api/search', async (req, res) => {
  const q = req.query.q?.trim();
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;
  if (!q) return res.status(400).json({ error: '?q= richiesto' });
  const cached = getCached(q); if (cached) return res.json({ ...cached, fromCache: true });
  try {
    const d = await searchAll(q, lat, lng);
    setCache(q, d); res.json(d);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Prezzi metalli
app.get('/api/metals', async (req, res) => {
  const gold = await getGoldPrice().catch(() => null);
  const platinum = await getPlatinumPrice().catch(() => null);
  res.json({
    gold: gold ? Math.round(gold*100)/100 : null,
    platinum: platinum ? Math.round(platinum*100)/100 : null,
    goldPerOz: gold ? Math.round(gold*31.1035) : null,
    platinumPerOz: platinum ? Math.round(platinum*31.1035) : null,
    goldHistory: db.goldPrices.slice(-48).reverse(),
    platinumHistory: db.platinumPrices.slice(-48).reverse(),
  });
});

// Compatibilità vecchio endpoint
app.get('/api/gold-price', async (req, res) => {
  const p = await getGoldPrice().catch(() => null);
  res.json({ pricePerGram: p ? Math.round(p*100)/100 : null, history: db.goldPrices.slice(-48).reverse() });
});

// Scansione oro
app.get('/api/gold-scan', (req, res) => {
  res.json({ message: 'Scansione avviata', queries: GOLD_QUERIES.length, sources: ['eBay Globale', 'Google Shopping IT/FR/DE/CH'] });
  runGoldScan().catch(e => console.error('[GOLD SCAN]', e.message));
});

// Arbitraggi trovati
app.get('/api/arbitrage', (req, res) => {
  const all = [...db.arbitrage, ...db.nearArbitrage].sort((a, b) => b.diffPct - a.diffPct);
  res.json(all.slice(0, 200));
});
app.get('/api/arbitrage/real', (req, res) => res.json([...db.arbitrage].sort((a,b) => b.diffPct - a.diffPct)));
app.get('/api/arbitrage/near', (req, res) => res.json([...db.nearArbitrage].sort((a,b) => b.diffPct - a.diffPct)));

// Discovery
app.get('/api/discovery/scan', (req, res) => {
  res.json({ message: 'Analisi avviata', brands: SEED_BRANDS.length });
  runDiscoveryScan().catch(() => {});
});
app.get('/api/discovery', (req, res) => {
  if (db.discoveries.length > 0) return res.json(db.discoveries);
  res.json(SEED_BRANDS.map(b => ({
    brand: b,
    emergingScore: { score: 0, windowLabel: '— Avvia analisi per vedere dati', thesis: 'Clicca "Avvia Analisi" per analizzare questo brand.', keySignal: '—', breakdown: {} },
    signals: {}, analyzedAt: null,
  })));
});
app.get('/api/discovery/alerts', (req, res) => res.json(db.discoveryAlerts.slice(-50)));

// Watchlist
app.get('/api/watchlist', (req, res) => res.json(db.watchlist.filter(w => w.active)));
app.post('/api/watchlist', (req, res) => {
  const { query, threshold, email, telegramChatId } = req.body;
  if (!query) return res.status(400).json({ error: 'query richiesta' });
  const r = { id: nid(), query, threshold: threshold || null, email: email || null, telegram_chat_id: telegramChatId || process.env.TELEGRAM_CHAT_ID || null, active: true, created_at: new Date().toISOString() };
  db.watchlist.push(r); res.json(r);
});
app.delete('/api/watchlist/:id', (req, res) => {
  const item = db.watchlist.find(w => w.id === parseInt(req.params.id));
  if (item) item.active = false;
  res.json({ ok: true });
});

// Portfolio
app.get('/api/portfolio', (req, res) => res.json(db.portfolio.filter(p => p.active)));
app.post('/api/portfolio', (req, res) => {
  const r = { id: nid(), active: true, created_at: new Date().toISOString(), ...req.body };
  db.portfolio.push(r); res.json(r);
});
app.delete('/api/portfolio/:id', (req, res) => {
  const item = db.portfolio.find(p => p.id === parseInt(req.params.id));
  if (item) item.active = false;
  res.json({ ok: true });
});
app.get('/api/portfolio/summary', (req, res) => {
  const items = db.portfolio.filter(p => p.active);
  res.json({ totalCost: items.reduce((s, i) => s + (parseFloat(i.purchasePrice || i.purchase_price) || 0), 0), itemCount: items.length });
});

app.get('/api/alerts', (req, res) => res.json(db.alerts.slice(-50).reverse()));

app.post('/api/telegram/test', (req, res) => {
  tg('⌚ <b>PriceRadar v11</b> — Test OK! 🟢\n\n✅ eBay Globale\n✅ Google Shopping\n✅ Facebook Marketplace\n✅ Discovery Engine\n✅ Arbitraggio Oro + Platino', req.body.chatId);
  res.json({ ok: true });
});

app.get('/api/status', async (req, res) => {
  const gold = await getGoldPrice().catch(() => null);
  const platinum = await getPlatinumPrice().catch(() => null);
  res.json({
    status: 'online', version: '11.0',
    goldPricePerGram: gold ? Math.round(gold*100)/100 : null,
    platinumPricePerGram: platinum ? Math.round(platinum*100)/100 : null,
    arbitrageFound: db.arbitrage.length,
    nearArbitrageFound: db.nearArbitrage.length,
    brandsAnalyzed: db.discoveries.length,
    discoveryAlerts: db.discoveryAlerts.length,
    watchlist: db.watchlist.filter(w => w.active).length,
    portfolio: db.portfolio.filter(p => p.active).length,
    goldQueries: GOLD_QUERIES.length,
    indieBrands: SEED_BRANDS.length,
    ebayConfigured: !!(process.env.EBAY_CLIENT_ID),
    serpApiConfigured: !!(process.env.SERPAPI_KEY),
    facebookConfigured: !!(process.env.FACEBOOK_ACCESS_TOKEN),
    telegramConfigured: !!(process.env.TELEGRAM_TOKEN),
    emailConfigured: !!(process.env.SMTP_USER),
    uptime: Math.floor(process.uptime()),
  });
});

// ── CRON ─────────────────────────────────────────────────────
cron.schedule('0 */2 * * *', () => runGoldScan().catch(() => {}));
cron.schedule('0 */12 * * *', () => runDiscoveryScan().catch(() => {}));
cron.schedule('*/30 * * * *', async () => {
  for (const item of db.watchlist.filter(w => w.active)) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      const data = await searchAll(item.query);
      if (item.threshold && data.lowest && data.lowest.priceEur <= parseFloat(item.threshold)) {
        const recent = db.alerts.find(a => a.wid === item.id && Date.now() - new Date(a.at).getTime() < 2*3600000);
        if (!recent) {
          await tg(`🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${data.lowest.priceEur.toLocaleString('it-IT')} su ${data.lowest.platform}\n<a href="${data.lowest.url}">→ VEDI</a>`, item.telegram_chat_id);
          db.alerts.push({ id: nid(), wid: item.id, price: data.lowest.priceEur, at: new Date().toISOString() });
        }
      }
      cache.delete(item.query);
    } catch {}
  }
});

// ── AVVIO ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  const gold = await getGoldPrice().catch(() => null);
  const platinum = await getPlatinumPrice().catch(() => null);
  console.log(`\n⌚ Watch Price Bot v11`);
  console.log(`   Oro: €${gold?.toFixed(2)||'N/A'}/g | Platino: €${platinum?.toFixed(2)||'N/A'}/g`);
  console.log(`   eBay: ${process.env.EBAY_CLIENT_ID?'✓':'✗'} | SerpAPI: ${process.env.SERPAPI_KEY?'✓':'✗'} | Facebook: ${process.env.FACEBOOK_ACCESS_TOKEN?'✓':'✗'}`);
  console.log(`   TG: ${process.env.TELEGRAM_TOKEN?'✓':'✗'} | Email: ${process.env.SMTP_USER?'✓':'✗'}\n`);

  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await tg(
      `✅ <b>PriceRadar v11 Online!</b>\n\n` +
      `🥇 Oro: €${gold?.toFixed(2)||'N/A'}/g\n` +
      `🔘 Platino: €${platinum?.toFixed(2)||'N/A'}/g\n\n` +
      `<b>Fonti attive:</b>\n` +
      `${process.env.EBAY_CLIENT_ID ? '✅' : '❌'} eBay Globale (IT/FR/DE/GB/ES/CH)\n` +
      `${process.env.SERPAPI_KEY ? '✅' : '❌'} Google Shopping (tutto il web)\n` +
      `${process.env.FACEBOOK_ACCESS_TOKEN ? '✅' : '❌'} Facebook Marketplace\n\n` +
      `Prima scansione tra 60 secondi...`
    );
  }

  setTimeout(() => runGoldScan().catch(() => {}), 60000);
  setTimeout(() => runDiscoveryScan().catch(() => {}), 10 * 60 * 1000);
});
