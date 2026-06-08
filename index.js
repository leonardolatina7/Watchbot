/**
 * Watch Price Bot v11.1
 * 
 * Funziona SENZA API esterne a pagamento.
 * Usa solo:
 * - eBay RSS Feed (pubblico, non richiede API key)
 * - Chrono24 RSS Feed (pubblico)
 * - Google Shopping RSS via Google News
 * - Catawiki RSS Feed
 * - DuckDuckGo Shopping (non blocca bot)
 * - WatchBox RSS
 * - Watchfinder RSS
 * 
 * Quando eBay API viene sbloccata o SerpAPI configurata,
 * il sistema le usa automaticamente come fonti aggiuntive.
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
const { scanHypeModels, analyzeModel, HYPE_WATCHLIST } = require('./socialEngine');
const { VINTAGE_DB, findVintageModel, evaluateVintageDeal } = require('./vintageDatabase');
const claudeAnalyst = require('./claudeAnalyst');

const app = express();
app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════════════════════════
// LIMITE GLOBALE DIMENSIONE PAGINE (anti heap-out-of-memory)
// Ogni richiesta axios — ovunque nel codice — rifiuta risposte
// più grandi di 2MB. È questo che impediva al server di saturare
// la RAM caricando pagine enormi nel parser HTML.
// ══════════════════════════════════════════════════════════════
const MAX_PAGE_BYTES = 2 * 1024 * 1024; // 2 MB
axios.defaults.maxContentLength = MAX_PAGE_BYTES;
axios.defaults.maxBodyLength = MAX_PAGE_BYTES;
axios.defaults.maxRedirects = 3;

// Estrae i dati da HTML e libera subito il DOM dalla memoria.
function parseAndFree(html, extractor) {
  let $ = cheerio.load(html);
  let out = [];
  try { out = extractor($) || []; } catch (e) { out = []; }
  $ = null; html = null;
  return out;
}


// Database in memoria
let db = {
  arbitrage: [], nearArbitrage: [],
  vintageDeals: [],
  discoveries: [], discoveryAlerts: [],
  hypeAnalyses: [], hypeAlerts: [],
  watchlist: [], portfolio: [], alerts: [],
  goldPrices: [], platinumPrices: [],
  blacklistBrands: [],   // marchi che Leonardo ha detto "no" → mai più
  dismissedUrls: [],     // singoli annunci scartati a mano
  liked: [],             // annunci che gli sono piaciuti (per capire i gusti)
};
let _id = Date.now();
const nid = () => ++_id;

// ── PERSISTENZA FEEDBACK (blacklist) ──────────────────────────
// Salviamo blacklist e annunci scartati su file, così sopravvivono ai
// riavvii. Per renderli PERMANENTI anche dopo un nuovo deploy, si può
// mettere i marchi nella variabile Render BLACKLIST_BRANDS (separati da
// virgola): vengono caricati all'avvio e uniti a quelli salvati.
const fs = require('fs');
const STATE_FILE = '/tmp/watchbot-state.json';
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      blacklistBrands: db.blacklistBrands,
      dismissedUrls: db.dismissedUrls.slice(-2000),
      liked: db.liked.slice(-500),
    }));
  } catch (e) { console.error('[STATE] save:', e.message); }
}
function loadState() {
  // 1) da variabile d'ambiente (permanente)
  if (process.env.BLACKLIST_BRANDS) {
    for (const b of process.env.BLACKLIST_BRANDS.split(',').map(s=>s.trim()).filter(Boolean)) {
      if (!db.blacklistBrands.includes(b)) db.blacklistBrands.push(b);
    }
  }
  // 2) da file (feedback dato dai pulsanti)
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      for (const b of (s.blacklistBrands||[])) if (!db.blacklistBrands.includes(b)) db.blacklistBrands.push(b);
      db.dismissedUrls = Array.from(new Set([...(db.dismissedUrls||[]), ...(s.dismissedUrls||[])]));
      db.liked = s.liked || [];
      console.log(`[STATE] Caricati: ${db.blacklistBrands.length} marchi bloccati, ${db.dismissedUrls.length} annunci scartati, ${db.liked.length} piaciuti`);
    }
  } catch (e) { console.error('[STATE] load:', e.message); }
}
// Confronto marchi tollerante (maiuscole, trattini, spazi)
function normBrand(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function isBrandBlacklisted(brand) {
  if (!brand) return false;
  const n = normBrand(brand);
  return db.blacklistBrands.some(b => { const nb = normBrand(b); return nb && (n === nb || n.includes(nb) || nb.includes(n)); });
}
// URL pubblico del server (per i link di feedback negli alert). Render lo
// imposta da solo in RENDER_EXTERNAL_URL; altrimenti usa SELF_URL o il default.
const SELF_URL = (process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'https://watchbot-5y0r.onrender.com').replace(/\/$/, '');
// Tetto di prezzo: niente budget limit → tetto alto (modificabile da Render
// con MAX_PRICE). Cattura anche gli affari grossi (Heuer, UG, militari).
const MAX_PRICE = parseInt(process.env.MAX_PRICE || '10000');

// ── FILTRO PEZZI DI RICAMBIO ──────────────────────────────────
// eBay è pieno di "solo quadrante", movimenti sciolti, casse vuote,
// cinturini, ghiere ecc. Non sono orologi: li scartiamo SUBITO, prima
// di chiamare Claude (risparmio credito) e prima di valutarli.
// Conservativo: scatta solo su frasi che indicano chiaramente IL PEZZO,
// non su orologi che descrivono il loro quadrante ("quadrante blu").
const PARTS_PATTERNS = [
  /\bsolo\s+(quadrante|movimento|cassa|lancette|ghiera|corona|fondello|vetro)\b/i,
  /\b(quadrante|movimento|cassa|lancette|ghiera|corona|fondello|vetro|cinturino|bracciale)\s+(solo|only|per)\b/i,
  /\b(dial|movement|case|hands|bezel|crown|caseback|crystal|strap|band|bracelet)\s+only\b/i,
  /\bonly\s+(dial|movement|case|hands|bezel|crown|caseback|crystal|strap|band)\b/i,
  /\b(dial|movement|bezel|crown|caseback|crystal)\s+for\b/i,
  /\bfor\s+parts?\b/i,
  /\bspare\s+parts?\b/i,
  /\b(ricambi|ricambio|per\s+ricambi|da\s+ricambi)\b/i,
  /\bquadrante\s+e\s+lancette\b/i,
  /\bdial\s+(and|&|\+)\s+hands\b/i,
  /\bcassa\s+vuota\b/i,
  /\bempty\s+case\b/i,
  /\bsenza\s+movimento\b/i,
  /\bnur\s+(zifferblatt|gehäuse|uhrwerk|zeiger)\b/i,   // tedesco: solo quadrante/cassa/movimento/lancette
  /\bcadran\s+seul\b/i,                                  // francese: solo quadrante
  /\bzifferblatt\s+(für|nur)\b/i,
  /\b(set|kit)\s+(lancette|hands|quadrante)\b/i,
];
function looksLikeParts(title) {
  const t = String(title||'');
  return PARTS_PATTERNS.some(re => re.test(t));
}

function feedbackLinks(brand, url, title) {
  const b = encodeURIComponent(brand || '');
  const u = encodeURIComponent(url || '');
  const ti = encodeURIComponent((title || '').slice(0, 80));
  const piace  = `<a href="${SELF_URL}/api/fb?a=lk&b=${b}&u=${u}&t=${ti}">\u{1F44D} Mi piace</a>`;
  const blocca = brand ? `<a href="${SELF_URL}/api/fb?a=bl&b=${b}">\u{1F6AB} Niente ${brand}</a>` : '';
  const scarta = `<a href="${SELF_URL}/api/fb?a=dz&u=${u}">\u{1F44E} Scarta questo</a>`;
  return `${piace}\n${blocca ? blocca + '   ' : ''}${scarta}`;
}

// ── PREZZI METALLI ────────────────────────────────────────────
let cachedGold = null, goldFetched = 0;
let cachedPlatinum = null, platinumFetched = 0;

async function getGoldPrice() {
  if (cachedGold && Date.now() - goldFetched < 30*60*1000) return cachedGold;
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
  if (cachedPlatinum && Date.now() - platinumFetched < 30*60*1000) return cachedPlatinum;
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

// ── METALLI ───────────────────────────────────────────────────
const GOLD_KW = ['18k','18kt','750','au750','18ct','18 karat','18 carati','18 carats','or 18','oro 18','gold 18','yellow gold','rose gold','white gold','solid gold','oro giallo','oro rosa','oro bianco','or jaune','or rose','or blanc','everose','sedna','moonshine','gelbgold','rotgold','weissgold'];
const PLAT_KW = ['platino','platinum','pt950','pt 950','pt900','platin','platine'];
function detectMetal(t) {
  const s = (t||'').toLowerCase();
  if (PLAT_KW.some(k=>s.includes(k))) return 'platinum';
  if (GOLD_KW.some(k=>s.includes(k))) return '18k';
  return null;
}
async function calcMetal(title, priceEur) {
  const metal = detectMetal(title);
  if (!metal) return null;
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  const model = findWatchModel(title);
  if (!model) return null;
  const spot = metal === 'platinum' ? platinum : gold;
  const metalValue = Math.round(model.pureMetalGrams * spot);
  const diff = metalValue - priceEur;
  const diffPct = Math.round((diff/metalValue)*1000)/10;
  return { metal, pureMetalGrams: model.pureMetalGrams, metalValue, spotPrice: Math.round(spot*100)/100, diffPct, diff, isArbitrage: diffPct>0, isNear: diffPct>-15&&diffPct<=0, confidence: model.confidence };
}

// ── FX ────────────────────────────────────────────────────────
let fx = { USD:0.92, GBP:1.17, CHF:1.05 }, fxF = 0;
async function toEur(price, currency) {
  if (!price||currency==='EUR') return price;
  if (Date.now()-fxF>3600000) {
    try { const r=await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF',{timeout:5000}); fx={USD:1/r.data.rates.USD,GBP:1/r.data.rates.GBP,CHF:1/r.data.rates.CHF}; fxF=Date.now(); } catch {}
  }
  return price*(fx[currency]||1);
}
const parsePrice = t => parseFloat((t||'').replace(/[€$£\s]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.')) || 0;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const rUA = () => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'][Math.floor(Math.random()*2)];

// ── TELEGRAM ─────────────────────────────────────────────────
async function tg(text, chatId) {
  if (!process.env.TELEGRAM_TOKEN) return;
  try { await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,{chat_id:chatId||process.env.TELEGRAM_CHAT_ID,text,parse_mode:'HTML'},{timeout:10000}); }
  catch(e) { console.error('[TG]',e.message); }
}

// ── EMAIL ─────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({host:'smtp.gmail.com',port:587,secure:false,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});

// ══════════════════════════════════════════════════════════════
// EBAY API UFFICIALE (quando disponibile)
// ══════════════════════════════════════════════════════════════
let ebayToken = null, ebayExp = 0;
async function getEbayToken() {
  if (ebayToken && Date.now()<ebayExp) return ebayToken;
  if (!process.env.EBAY_CLIENT_ID) return null;
  try {
    const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    const r = await axios.post('https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      {headers:{Authorization:`Basic ${c}`,'Content-Type':'application/x-www-form-urlencoded'}}
    );
    ebayToken = r.data.access_token;
    ebayExp = Date.now()+(r.data.expires_in-60)*1000;
    return ebayToken;
  } catch { return null; }
}
async function searchEbayAPI(query) {
  const token = await getEbayToken();
  if (!token) return [];
  const results = [];
  for (const market of ['EBAY_IT','EBAY_FR','EBAY_DE','EBAY_GB','EBAY_ES']) {
    try {
      const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search',{
        params:{q:query,category_ids:'31387',sort:'price',limit:30,filter:'price:[200..]'},
        headers:{Authorization:`Bearer ${token}`,'X-EBAY-C-MARKETPLACE-ID':market},
        timeout:12000
      });
      results.push(...(r.data.itemSummaries||[]).map(i=>({
        platform:`eBay ${market.replace('EBAY_','')}`,
        title:i.title, price:parseFloat(i.price?.value||0),
        currency:i.price?.currency||'EUR', url:i.itemWebUrl,
        location:i.itemLocation?.country||'',
      })).filter(i=>i.price>=200));
      await sleep(200);
    } catch {}
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// EBAY RSS FEED — pubblico, non richiede credenziali
// Funziona sempre, anche senza API key
// ══════════════════════════════════════════════════════════════
async function searchEbayRSS(query) {
  try {
    await sleep(500+Math.random()*500);
    // eBay RSS feed per ricerca pubblica
    const q = encodeURIComponent(query);
    const url = `https://www.ebay.it/sch/i.html?_nkw=${q}&_sop=15&_sacat=31387&LH_ItemCondition=3&rt=nc&_mPrRngCbx=1&_udlo=200&_rss=1`;
    const r = await axios.get(url, {
      headers:{'User-Agent':rUA(),'Accept':'application/rss+xml,application/xml,text/xml'}, timeout:12000
    });
    const $ = cheerio.load(r.data, {xmlMode:true});
    const results = [];
    $('item').each((i,el) => {
      if (i>=15) return;
      const $el = $(el);
      const title = $el.find('title').first().text().trim();
      const link = $el.find('link').first().text().trim();
      const desc = $el.find('description').first().text();
      // Estrai prezzo dalla descrizione
      const priceMatch = desc.match(/[\€$£]?\s*(\d[\d.,]*)/);
      const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
      if (title && price>=200) results.push({
        platform:'eBay IT', title, price, currency:'EUR', url:link
      });
    });
    return results;
  } catch(e) { console.error('[eBay RSS]',e.message); return []; }
}

// Cerca su eBay in tutti i paesi via RSS
async function searchEbayAllCountries(query) {
  const domains = [
    {dom:'it', curr:'EUR', lang:'it-IT'},
    {dom:'fr', curr:'EUR', lang:'fr-FR'},
    {dom:'de', curr:'EUR', lang:'de-DE'},
    {dom:'co.uk', curr:'GBP', lang:'en-GB'},
    {dom:'es', curr:'EUR', lang:'es-ES'},
    {dom:'ch', curr:'CHF', lang:'de-CH'},
  ];
  const results = [];
  // Prima prova API ufficiale
  const apiResults = await searchEbayAPI(query);
  if (apiResults.length > 0) return apiResults;
  // Fallback: RSS feeds
  for (const {dom, curr, lang} of domains) {
    try {
      await sleep(600+Math.random()*400);
      const q = encodeURIComponent(query);
      const url = `https://www.ebay.${dom}/sch/i.html?_nkw=${q}&_sop=15&_sacat=31387&_udlo=200&_rss=1`;
      const r = await axios.get(url, {
        headers:{'User-Agent':rUA(),'Accept-Language':lang}, timeout:12000
      });
      const $ = cheerio.load(r.data, {xmlMode:true});
      $('item').each((i,el) => {
        if (i>=12) return;
        const $el = $(el);
        const title = $el.find('title').first().text().replace(/&amp;/g,'&').trim();
        const link = $el.find('link').first().text().trim();
        const desc = $el.find('description').first().text();
        const priceMatch = desc.match(/(\d[\d.,]*)\s*(?:EUR|GBP|CHF|€|£)/i) || desc.match(/>\s*(\d[\d.,]*)\s*</);
        const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
        if (title && price>=200 && link) results.push({
          platform:`eBay ${dom.toUpperCase().replace('.CO.UK','UK')}`,
          title, price, currency:curr, url:link
        });
      });
    } catch {}
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// CHRONO24 RSS — feed pubblico
// ══════════════════════════════════════════════════════════════
async function searchChrono24RSS(query) {
  try {
    await sleep(800+Math.random()*600);
    const q = encodeURIComponent(query);
    const url = `https://www.chrono24.it/search/index.htm?query=${q}&dosearch=true&searchType=fulltext&resultview=list&priceFrom=200`;
    const r = await axios.get(url, {
      headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.chrono24.it/'}, timeout:15000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-article-id],.article-item-container,.wt-search-results article').each((i,el) => {
      if (i>=15) return;
      const $el = $(el);
      const title = $el.find('.article-title,h3,[class*="title"]').first().text().trim();
      const priceText = $el.find('.price,.js-price,[class*="price"]').first().text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('a').first().attr('href');
      if (title && price>=200) results.push({
        platform:'Chrono24', title, price, currency:'EUR',
        url: link?(link.startsWith('http')?link:`https://www.chrono24.it${link}`):`https://www.chrono24.it`
      });
    });
    return results;
  } catch(e) { console.error('[Chrono24]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// CATAWIKI — aste europee
// ══════════════════════════════════════════════════════════════
async function searchCatawiki(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(query)}`, {
      headers:{'User-Agent':rUA()}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="lot-card"],article[data-lot-id],[class*="LotCard"]').each((i,el) => {
      if (i>=12) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],h2,h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"],[class*="bid"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=200) results.push({
        platform:'Catawiki 🔨', title, price, currency:'EUR', isAuction:true,
        url:link?(link.startsWith('http')?link:`https://www.catawiki.com${link}`):'https://www.catawiki.com/en/c/80-watches'
      });
    });
    return results;
  } catch(e) { console.error('[Catawiki]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// SUBITO.IT
// ══════════════════════════════════════════════════════════════
async function searchSubito(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.subito.it/annunci-italia/vendita/orologi-e-gioielli/?q=${encodeURIComponent(query)}`, {
      headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.subito.it/'}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="item-card"],[class*="SmallCard"],article[data-type="regular"]').each((i,el) => {
      if (i>=12) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      const location = $el.find('[class*="location"],[class*="town"],[class*="city"]').first().text().trim();
      if (title&&price>=200) results.push({
        platform:'Subito.it 🇮🇹', title, price, currency:'EUR', isLocal:true, location,
        url:link?(link.startsWith('http')?link:`https://www.subito.it${link}`):'https://www.subito.it'
      });
    });
    return results;
  } catch(e) { console.error('[Subito]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// LEBONCOIN 🇫🇷
// ══════════════════════════════════════════════════════════════
async function searchLeboncoin(query) {
  try {
    await sleep(1200+Math.random()*500);
    const r = await axios.get(`https://www.leboncoin.fr/recherche?category=62&text=${encodeURIComponent(query)}&price=200-max`, {
      headers:{'User-Agent':rUA(),'Accept-Language':'fr-FR,fr;q=0.9',Referer:'https://www.leboncoin.fr/'}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-qa-id="aditem_container"],[class*="AdCard"],[class*="adCard"]').each((i,el) => {
      if (i>=10) return;
      const $el = $(el);
      const title = $el.find('[data-qa-id="aditem_title"],[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[data-qa-id="aditem_price"],[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=200) results.push({
        platform:'Leboncoin 🇫🇷', title, price, currency:'EUR',
        url:link?(link.startsWith('http')?link:`https://www.leboncoin.fr${link}`):'https://www.leboncoin.fr'
      });
    });
    return results;
  } catch(e) { console.error('[Leboncoin]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// VESTIAIRE COLLECTIVE
// ══════════════════════════════════════════════════════════════
async function searchVestiaire(query) {
  try {
    await sleep(900+Math.random()*400);
    const r = await axios.get(`https://www.vestiairecollective.com/search/?q=${encodeURIComponent(query)}&universe=men&category=watches`, {
      headers:{'User-Agent':rUA()}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="product-card"],[class*="ProductCard"]').each((i,el) => {
      if (i>=10) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],[class*="brand"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=200) results.push({
        platform:'Vestiaire', title, price, currency:'EUR',
        url:link?(link.startsWith('http')?link:`https://www.vestiairecollective.com${link}`):'https://www.vestiairecollective.com'
      });
    });
    return results;
  } catch(e) { console.error('[Vestiaire]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// WATCHFINDER 🇬🇧
// ══════════════════════════════════════════════════════════════
async function searchWatchfinder(query) {
  try {
    await sleep(900+Math.random()*400);
    const r = await axios.get(`https://www.watchfinder.co.uk/search?q=${encodeURIComponent(query)}`, {
      headers:{'User-Agent':rUA()}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="watch-card"],[class*="WatchCard"],[class*="product-card"]').each((i,el) => {
      if (i>=8) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=300) results.push({
        platform:'Watchfinder 🇬🇧', title, price, currency:'GBP',
        url:link?(link.startsWith('http')?link:`https://www.watchfinder.co.uk${link}`):'https://www.watchfinder.co.uk'
      });
    });
    return results;
  } catch(e) { console.error('[Watchfinder]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// SERPAPI — Google Shopping (quando configurato)
// Contatore mensile per non superare il limite del piano (1.000/mese)
// ══════════════════════════════════════════════════════════════
const SERPAPI_MONTHLY_LIMIT = parseInt(process.env.SERPAPI_LIMIT||'1000');
let serpUsage = { month: new Date().getMonth(), count: 0 };
function serpQuotaOk() {
  const m = new Date().getMonth();
  if (m !== serpUsage.month) { serpUsage = { month: m, count: 0 }; } // reset mensile
  // Lascia un margine di sicurezza del 5%
  return serpUsage.count < SERPAPI_MONTHLY_LIMIT * 0.95;
}
function serpTick() { serpUsage.count++; }

async function searchSerpAPI(query, country='it') {
  if (!process.env.SERPAPI_KEY) return [];
  if (!serpQuotaOk()) { console.warn('[SerpAPI] Quota mensile quasi esaurita, salto'); return []; }
  try {
    serpTick();
    const r = await axios.get('https://serpapi.com/search',{
      params:{engine:'google_shopping',q:query,gl:country,hl:country,api_key:process.env.SERPAPI_KEY,num:20},
      timeout:15000
    });
    return (r.data.shopping_results||[]).map(i=>({
      platform:`Google Shopping ${country.toUpperCase()}`,
      title:i.title, price:parseFloat(String(i.price||'0').replace(/[^\d,.]/g,'').replace(',','.'))||0,
      currency:'EUR', url:i.link||i.product_link||'', image:i.thumbnail||i.serpapi_thumbnail||'', source:i.source||''
    })).filter(i=>i.price>=200&&i.url);
  } catch(e) { console.error(`[SerpAPI ${country}]`,e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// FACEBOOK MARKETPLACE (quando configurato)
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// VINTED — pieno di oro vintage a prezzi bassi
// ══════════════════════════════════════════════════════════════
async function searchVinted(query) {
  try {
    await sleep(900+Math.random()*500);
    const r = await axios.get(`https://www.vinted.it/catalog?search_text=${encodeURIComponent(query)}&catalog[]=2165&price_from=200`, {
      headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.vinted.it/'}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-testid="grid-item"],[class*="ItemBox"],[class*="item-box"]').each((i,el) => {
      if (i>=12) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],[class*="name"],h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=200) results.push({
        platform:'Vinted 🇮🇹', title, price, currency:'EUR',
        url:link?(link.startsWith('http')?link:`https://www.vinted.it${link}`):'https://www.vinted.it'
      });
    });
    return results;
  } catch(e) { console.error('[Vinted]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// WALLAPOP 🇪🇸 — Spagna, oro vintage sottovalutato
// ══════════════════════════════════════════════════════════════
async function searchWallapop(query) {
  try {
    await sleep(900+Math.random()*500);
    const r = await axios.get(`https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(query)}&category_ids=14000&min_sale_price=200&order_by=price_low_to_high`, {
      headers:{'User-Agent':rUA(),'Accept':'application/json'}, timeout:12000
    });
    const items = r.data?.search_objects || r.data?.items || [];
    return items.slice(0,12).map(i=>({
      platform:'Wallapop 🇪🇸',
      title:i.title||i.content?.title||'',
      price:parseFloat(i.price||i.sale_price||i.content?.price||0),
      currency:'EUR',
      url:i.web_slug?`https://it.wallapop.com/item/${i.web_slug}`:`https://it.wallapop.com`,
      location:i.location?.city||i.content?.location?.city||'',
    })).filter(i=>i.price>=200&&i.title);
  } catch(e) { console.error('[Wallapop]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// RICARDO.CH 🇨🇭 — Svizzera, orologi oro a prezzi locali
// ══════════════════════════════════════════════════════════════
async function searchRicardo(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.ricardo.ch/it/s/${encodeURIComponent(query)}/?sort=price&order=asc&categoryId=11010`, {
      headers:{'User-Agent':rUA(),'Accept-Language':'it-CH'}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="ArticleCard"],[class*="article-card"],[data-testid*="article"]').each((i,el) => {
      if (i>=10) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=300) results.push({
        platform:'Ricardo.ch 🇨🇭', title, price, currency:'CHF',
        url:link?(link.startsWith('http')?link:`https://www.ricardo.ch${link}`):'https://www.ricardo.ch'
      });
    });
    return results;
  } catch(e) { console.error('[Ricardo]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// MARKTPLAATS 🇳🇱 — Olanda, mercato enorme
// ══════════════════════════════════════════════════════════════
async function searchMarktplaats(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.marktplaats.nl/lrp/api/search?query=${encodeURIComponent(query)}&categoryId=363&priceFrom=200&sortBy=PRICE_ASC&limit=12`, {
      headers:{'User-Agent':rUA(),'Accept':'application/json'}, timeout:12000
    });
    const listings = r.data?.listings || [];
    return listings.slice(0,12).map(i=>({
      platform:'Marktplaats 🇳🇱',
      title:i.title||'',
      price:parseFloat(i.priceInfo?.priceCents||0)/100,
      currency:'EUR',
      url:i.vipUrl?`https://www.marktplaats.nl${i.vipUrl}`:'https://www.marktplaats.nl',
      location:i.location?.cityName||'',
    })).filter(i=>i.price>=200&&i.title);
  } catch(e) { console.error('[Marktplaats]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// GOOGLE SHOPPING via SerpAPI — cerca vicino a Belluno
// ══════════════════════════════════════════════════════════════
async function searchSerpAPILocal(query) {
  if (!process.env.SERPAPI_KEY) return [];
  if (!serpQuotaOk()) { console.warn('[SerpAPI local] Quota mensile quasi esaurita, salto'); return []; }
  try {
    serpTick();
    // Cerca in italiano con localizzazione Veneto
    const r = await axios.get('https://serpapi.com/search',{
      params:{
        engine:'google_shopping', q:query,
        gl:'it', hl:'it', location:'Belluno,Veneto,Italy',
        api_key:process.env.SERPAPI_KEY, num:20
      },
      timeout:15000
    });
    return (r.data.shopping_results||[]).map(i=>({
      platform:'Google Shopping 🇮🇹',
      title:i.title,
      price:parseFloat(String(i.price||'0').replace(/[^\d,.]/g,'').replace(',','.'))||0,
      currency:'EUR', url:i.link||i.product_link||'',
      image:i.thumbnail||i.serpapi_thumbnail||'',
      source:i.source||''
    })).filter(i=>i.price>=200&&i.url);
  } catch(e) { console.error('[SerpAPI local]',e.message); return []; }
}

async function searchFacebook(query, lat=46.1407, lng=12.2176) {
  if (!process.env.FACEBOOK_ACCESS_TOKEN) return [];
  try {
    const r = await axios.get('https://graph.facebook.com/v19.0/marketplace_search',{
      params:{q:query,access_token:process.env.FACEBOOK_ACCESS_TOKEN,latitude:lat,longitude:lng,radius:100000,limit:20,fields:'id,name,price,location,listing_url'},
      timeout:15000
    });
    return (r.data.data||[]).map(i=>({
      platform:'Facebook Marketplace 📍',
      title:i.name||'', price:parseFloat(String(i.price?.amount||'0').replace(/[^\d.]/g,''))||0,
      currency:i.price?.currency||'EUR', url:i.listing_url||`https://www.facebook.com/marketplace/item/${i.id}`,
      location:i.location?.city||'', isLocal:true
    })).filter(i=>i.price>=200);
  } catch(e) { console.error('[Facebook]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// RICERCA COMPLETA — combina tutte le fonti
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// HYPE SCAN — analisi social + sentiment
// ══════════════════════════════════════════════════════════════
async function runHypeScan() {
  console.log('\n[HYPE SCAN v11] Analisi social sentiment...');
  try {
    const results = await scanHypeModels();
    db.hypeAnalyses = results;
    for (const analysis of results) {
      const prev = db.hypeAlerts.find(a=>a.query===analysis.query);
      const prevScore = prev?.score||0;
      const jump = analysis.hypeScore.score-prevScore;
      if (analysis.hypeScore.score>=70&&(jump>=10||!prev)) {
        if(prev) prev.score=analysis.hypeScore.score;
        else db.hypeAlerts.push({query:analysis.query,score:analysis.hypeScore.score,category:analysis.category,at:new Date().toISOString()});
        const ce={vintage_gold:'🏺',indie:'⌚',sport_gold:'🏆',platinum:'🔘'}[analysis.category]||'⌚';
        await tg(
          `${ce} <b>HYPE ALERT</b>\n\n`+
          `🔥 <b>${analysis.query}</b>\n`+
          `📊 Score: <b>${analysis.hypeScore.score}/100</b> — ${analysis.hypeScore.label}\n`+
          (jump>=10?`📈 Crescita: +${jump} punti\n`:'')+
          `\n🔑 ${analysis.hypeScore.keySignal}\n\n`+
          `Reddit: ${analysis.signals.reddit.monthPosts} post · ${analysis.signals.reddit.growthSignal}\n`+
          `YouTube: ${analysis.signals.youtube.totalVideos} video${analysis.signals.youtube.knownChannelBonus?' ⭐':''}\n`+
          `Hodinkee: ${analysis.signals.hodinkee.hasArticle?'✅':'❌'} · WatchUSeek: ${analysis.signals.watchuseek.totalThreads} thread\n`+
          `Facebook gruppi: ${analysis.signals.facebook.groupActivity}\n\n`+
          `💡 Cercalo su Subito.it e Vinted prima che salgano i prezzi`
        );
      }
    }
    return results;
  } catch(e) { console.error('[HYPE SCAN]',e.message); return []; }
}

const cache = new Map();
const getCached = k => { const e=cache.get(k); return e&&Date.now()-e.ts<15*60*1000?e.d:null; };
const setCache = (k,d) => cache.set(k,{d,ts:Date.now()});

async function searchAll(query) {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();

  // Ricerca parallela su tutte le fonti disponibili
  const [ebay, chrono, catawiki, subito, leboncoin, vestiaire, watchfinder, vinted, wallapop, ricardo, marktplaats, serp, serpLocal, fb] = await Promise.allSettled([
    searchEbayAllCountries(query),
    searchChrono24RSS(query),
    searchCatawiki(query),
    searchSubito(query),
    searchLeboncoin(query),
    searchVestiaire(query),
    searchWatchfinder(query),
    searchVinted(query),
    searchWallapop(query),
    searchRicardo(query),
    searchMarktplaats(query),
    searchSerpAPI(query, 'it'),
    searchSerpAPILocal(query),
    searchFacebook(query),
  ]);

  const all = [
    ...(ebay.status==='fulfilled'?ebay.value:[]),
    ...(chrono.status==='fulfilled'?chrono.value:[]),
    ...(catawiki.status==='fulfilled'?catawiki.value:[]),
    ...(subito.status==='fulfilled'?subito.value:[]),
    ...(leboncoin.status==='fulfilled'?leboncoin.value:[]),
    ...(vestiaire.status==='fulfilled'?vestiaire.value:[]),
    ...(watchfinder.status==='fulfilled'?watchfinder.value:[]),
    ...(vinted.status==='fulfilled'?vinted.value:[]),
    ...(wallapop.status==='fulfilled'?wallapop.value:[]),
    ...(ricardo.status==='fulfilled'?ricardo.value:[]),
    ...(marktplaats.status==='fulfilled'?marktplaats.value:[]),
    ...(serp.status==='fulfilled'?serp.value:[]),
    ...(serpLocal.status==='fulfilled'?serpLocal.value:[]),
    ...(fb.status==='fulfilled'?fb.value:[]),
  ];

  // Deduplicazione + arricchimento
  const seenUrls = new Set();
  const enriched = [];
  for (const item of all) {
    if (!item.url||seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    const priceEur = Math.round(await toEur(item.price, item.currency));
    if (priceEur<300) continue;
    const metalData = await calcMetal(item.title, priceEur);
    enriched.push({...item, priceEur, metalData});
  }

  enriched.sort((a,b)=>a.priceEur-b.priceEur);

  // Miglior prezzo per piattaforma
  const byP = {};
  for (const i of enriched) if (!byP[i.platform]||i.priceEur<byP[i.platform].priceEur) byP[i.platform]=i;

  return {
    query, results: Object.values(byP).sort((a,b)=>a.priceEur-b.priceEur),
    allListings: enriched, lowest: enriched[0]||null,
    arbitrage: enriched.filter(i=>i.metalData?.isArbitrage),
    nearArbitrage: enriched.filter(i=>i.metalData?.isNear),
    goldPricePerGram: Math.round(gold*100)/100,
    platinumPricePerGram: Math.round(platinum*100)/100,
    platforms: Object.keys(byP),
    totalFound: enriched.length,
    timestamp: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
// SCANSIONE ARBITRAGGIO ORO
// ══════════════════════════════════════════════════════════════
// QUERY — focus sui GIOIELLI DIMENTICATI e TESORI NASCOSTI.
// Tre blocchi che ruotano per coprire più marchi oscuri nel tempo.
// ═══════════════════════════════════════════════════════════════
// CACCIA AI TESORI — query mirate sui marchi sottovalutati di qualita.
// IDEA GENIO #1: oltre ai marchi, cerco anche annunci GENERICI italiani
// ("orologio carica manuale vintage", "cronografo svizzero anni 60").
// Perche? Gli affari veri li mette chi NON sa cosa ha: scrive un titolo
// vago, nessuno lo trova cercando il marchio. Li intercettiamo noi.
// ═══════════════════════════════════════════════════════════════
const QUERIES_BLOCK_A = [
  'Nivada Grenchen vintage',
  'Gallet chronograph vintage',
  'Universal Geneve Polerouter',
  'Eterna KonTiki vintage',
  'Enicar Sherpa vintage',
  'Lemania chronograph vintage',
  'Wakmann chronograph vintage',
  'orologio cronografo svizzero vintage',   // generico: chi non sa cosa ha
  'orologio carica manuale vintage anni 60', // generico
  'vecchio orologio svizzero da uomo',       // generico: svendite
];
const QUERIES_BLOCK_B = [
  'Excelsior Park chronograph',
  'Vulcain Cricket vintage',
  'Favre-Leuba vintage',
  'Zenith chronograph vintage',
  'Doxa Sub vintage',
  'Girard Perregaux gyromatic vintage',
  'Longines cronografo vintage',
  'orologio automatico svizzero vintage',    // generico
  'cronografo Valjoux vintage',              // generico tecnico
  'orologio sub vintage anni 70',            // generico diver
];
const QUERIES_BLOCK_C = [
  'Ollech Wajs vintage',
  'Airain Type 20 vintage',
  'Yema Yachtingraf vintage',
  'Croton Chronomaster vintage',
  'Edox compressor diver vintage',
  'Eberhard cronografo vintage',
  'orologio svizzero vintage non funzionante',  // rotti = occasioni
  'orologio carica manuale da revisionare',     // da riparare
  'orologio eredita nonno vintage',             // svendite eredità
  'orologio svizzero collezione vintage',       // generico collezione
];
// BLOCCO D — DOPPIA FIRMA (rivenditori, spesso italiani: premio enorme)
const QUERIES_BLOCK_D = [
  'orologio Hausmann Roma vintage',
  'orologio Pisa orologeria vintage',
  'orologio Cusi Milano vintage',
  'orologio doppia firma vintage',
  'orologio quadrante Tiffany vintage',
  'Serpico Laino vintage',
  'orologio Beyer vintage',
  'orologio Gubelin vintage',
  'orologio retailer signed vintage',
  'orologio Cartier dial vintage',
];
// BLOCCO E — QUADRANTI SPECIALI (tratti che valgono tra i collezionisti)
const QUERIES_BLOCK_E = [
  'orologio quadrante tropicale vintage',
  'orologio gilt dial vintage',
  'orologio sector dial vintage',
  'orologio quadrante smalto vintage',
  'orologio quadrante salmone vintage',
  'cronografo quadrante esotico vintage',
  'orologio pie pan dial vintage',
  'orologio militare vintage anni 40',
  'orologio quadrante due toni vintage',
  'orologio cronografo oro 18k vintage',
];
// BLOCCO F — ALTRI MODELLI/MARCHI ricercati
const QUERIES_BLOCK_F = [
  'Angelus Chronodato vintage',
  'Minerva cronografo vintage',
  'Hanhart flyback vintage',
  'Zodiac Sea Wolf vintage',
  'Aquastar Deepstar vintage',
  'Squale diver vintage',
  'Certina DS vintage',
  'Cortebert vintage',
  'orologio subacqueo compressore vintage',
  'orologio cronografo Landeron Venus vintage',
];
let scanCounter = 0;
function getGoldQueries() {
  scanCounter++;
  const blocks = [QUERIES_BLOCK_A, QUERIES_BLOCK_B, QUERIES_BLOCK_C, QUERIES_BLOCK_D, QUERIES_BLOCK_E, QUERIES_BLOCK_F];
  return blocks[scanCounter % blocks.length];
}
const GOLD_QUERIES = QUERIES_BLOCK_A;

async function runGoldScan(mode = 'all') {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  console.log(`\n[SCAN v11.1 ${mode==='subito'?'SUBITO-VELOCE':'COMPLETA'}] Oro: €${gold.toFixed(2)}/g | Platino: €${platinum.toFixed(2)}/g`);
  console.log(`[SCAN v11.1] eBay API: ${process.env.EBAY_CLIENT_ID?'✓':'RSS fallback'} | SerpAPI: ${process.env.SERPAPI_KEY?'✓':'✗'}`);

  let foundArb=0, foundNear=0, foundVintage=0;
  const seenUrls = new Set([...db.arbitrage,...db.nearArbitrage,...db.vintageDeals].map(a=>a.url));

  const activeQueries = getGoldQueries();
  console.log(`[SCAN v11.1] Blocco query: ${['A','B','C'][scanCounter % 3]} (${activeQueries.length} query)`);
  for (const query of activeQueries) {
    try {
      // ── RICERCA SEQUENZIALE: una fonte alla volta ──
      // Invece di lanciare tutte le fonti insieme (che satura la RAM),
      // le eseguiamo una dopo l'altra e accumuliamo solo i risultati piccoli.
      // Tra una fonte e l'altra la memoria del DOM viene liberata.
      // FONTI: in modalità "subito" usiamo SOLO Subito (scan veloce ogni
      // ora, risparmia query SerpAPI). In modalità "all" tutte le fonti
      // di privati (scan completa ogni 4-5 ore).
      const sources = mode === 'subito'
        ? [ searchSubito ]
        : [
            searchSubito,            // 🇮🇹 privati italiani — il terreno migliore
            searchEbayAllCountries,  // eBay annunci (anche privati)
            searchSerpAPILocal,      // Google Shopping → pesca Subito/Kijiji/eBay locali
            searchVinted,            // privati, spesso ignari del valore
          ];
      let all = [];
      for (const src of sources) {
        try {
          await sleep(400 + Math.random()*400);
          const r = await src(query);
          if (Array.isArray(r) && r.length) {
            // Tieni solo i campi che servono, scarta il resto (meno memoria)
            for (const it of r) {
              all.push({ platform: it.platform, title: it.title, price: it.price, currency: it.currency, url: it.url, location: it.location || '', image: it.image || '' });
            }
          }
        } catch (e) { /* fonte fallita, continua */ }
      }

      for (const item of all) {
        if (!item.url||seenUrls.has(item.url)) continue;
        const priceEur = Math.round(await toEur(item.price, item.currency));
        if (priceEur<200) continue;          // sotto 200 = troppo rischio/robaccia
        if (priceEur>MAX_PRICE) continue;    // tetto alto: prende anche gli affari grossi
        if (db.dismissedUrls.includes(item.url)) continue; // annuncio scartato a mano
        if (looksLikeParts(item.title)) { console.log(`[PARTI] salto ricambio: ${item.title?.slice(0,45)}`); continue; }

        // \u2500\u2500 METALLO PRIMA DI TUTTO (oro/platino sicuro) \u2500\u2500
        // Se e oro/platino con peso certificato e prezzo vicino al valore
        // del metallo, e un'occasione SICURA: la gestiamo subito e saltiamo
        // Claude. Gli altri casi metallo li salviamo solo per il sito.
        if (detectMetal(item.title)) {
          const metal = await calcMetal(item.title, priceEur);
          if (metal && (metal.isArbitrage || metal.isNear)) {
            const entry = {
              id:nid(), platform:item.platform, title:item.title,
              price:priceEur, metalValue:metal.metalValue,
              metalGrams:metal.pureMetalGrams, metal:metal.metal,
              diffPct:metal.diffPct, confidence:metal.confidence,
              url:item.url, location:item.location||'',
              foundAt:new Date().toISOString(),
            };
            (metal.isArbitrage ? db.arbitrage : db.nearArbitrage).push(entry);
            if (metal.isArbitrage) foundArb++; else foundNear++;
            const metalloSicuro = metal.confidence === 'high' && metal.diffPct >= -10;
            if (metalloSicuro) {
              seenUrls.add(item.url);
              const emoji = metal.metal==='platinum'?'\u{1F518}':'\u{1F947}';
              const name = metal.metal==='platinum'?'PLATINO':'ORO 18K';
              const offerta = Math.round(Math.min(metal.metalValue * 0.85, priceEur * 0.75) / 10) * 10;
              const guadagnoSeOfferta = metal.metalValue - offerta;
              // Se gia' al prezzo del metallo o sotto = COMPRA SUBITO (doppia
              // sicurezza: pavimento + oro che storicamente sale nel lungo periodo).
              const compraSubito = metal.diffPct >= 0;
              const titolo = compraSubito
                ? `${emoji} <b>${name} \u2014 COMPRA SUBITO \u{1F525}</b>`
                : `${emoji} <b>${name} \u2014 OCCASIONE METALLO</b>`;
              await tg(
                `${titolo}\n\n`+
                `\u231A ${item.title?.slice(0,65)}\n`+
                `\u{1F4B0} Chiede: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
                `\u{1F48E} Sotto c'\u00E8 ${name==='PLATINO'?'platino':'oro'} per: <b>\u20AC${metal.metalValue.toLocaleString('it-IT')}</b> (${metal.pureMetalGrams}g)\n`+
                `   \u2192 questo \u00E8 il PAVIMENTO: sotto non scende\n`+
                (metal.diffPct>0
                  ? `\u{1F4C9} Gi\u00E0 <b>\u2212${metal.diffPct}% sotto il metallo</b>: ci guadagni gia\u0300 cos\u00EC\n`
                  : metal.diffPct===0
                  ? `\u2696\uFE0F <b>Esattamente al valore del metallo</b>\n`
                  : `\u{1F4CA} Solo ${Math.abs(metal.diffPct)}% sopra il metallo\n`)+
                (compraSubito
                  ? `\n\u{1F512} <b>Acquisto sicuro:</b> paghi quanto vale il metallo. E l'oro storicamente SALE nel lungo periodo (5-10 anni), quindi questo pavimento tende a crescere. Rischio al ribasso minimo.\n`
                  : `\n\u{1F3AF} <b>Tratta col venditore.</b> Offri ~\u20AC${offerta.toLocaleString('it-IT')}: se accetta, ci guadagni \u20AC${guadagnoSeOfferta.toLocaleString('it-IT')} garantiti dal metallo. E l'oro nel lungo periodo tende a salire.\n`)+
                `   \u{1F9E0} l'oro puo\u0300 anche oscillare: tendenza storica, non garanzia\n`+
                `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
                `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n`+
                `\u2796\u2796\u2796\n`+
                feedbackLinks(null, item.url, item.title)
              );
              console.log(`[ARB-SICURO] ${item.title?.slice(0,40)} \u20AC${priceEur} vs metallo \u20AC${metal.metalValue} (${metal.diffPct}%)`);
              continue; // gestito come metallo, non passare a Claude
            }
            // metallo ma non "sicuro": salvato per il sito, prosegui con Claude
          }
        }

        const vintage = evaluateVintageDeal(item.title, priceEur);

        // CLAUDE E IL MOTORE PRINCIPALE: se configurato, decide lui e avvisa.
        // Il DB locale serve solo a non sprecare Claude. Claude gestisce
        // anche i vintage sconosciuti e guarda le foto.
        if (claudeAnalyst.isConfigured()) {
          const ai = await claudeAnalyst.analyzeListing(item.title, priceEur, item.image);
          if (ai && ai.isInteresting) {
            // Marchio che Leonardo ha bloccato → salta (e ricorda che è visto)
            if (isBrandBlacklisted(ai.brand)) { seenUrls.add(item.url); console.log(`[BLACKLIST] salto ${ai.brand}`); continue; }
            seenUrls.add(item.url);
            foundVintage++;
            db.vintageDeals.push({
              id:nid(), platform:item.platform, title:item.title, price:priceEur,
              brand:ai.brand||'?', model:ai.model||'?', caliber:ai.caliber||'?',
              valueLow:ai.valueLow||0, valueHigh:ai.valueHigh||0,
              discountVsLow:ai.discountVsLow||0, desirability:ai.desirability||0,
              grail:ai.isGrail||false, sleeper:ai.isSleeper||false,
              url:item.url, location:item.location||'', source:'claude',
              foundAt:new Date().toISOString(),
            });
            const grailTag = ai.isGrail ? '\u{1F451} GRAIL ' : '';
            const sleeperTag = (ai.isSleeper && !ai.isGrail) ? '\u{1F48E} SOTTOVALUTATO ' : '';
            const stars = '\u2B50'.repeat(Math.min(Math.round((ai.desirability||0)/2),5));
            const confLabel = ai.confidence==='high'?'\u2705 identificazione sicura':ai.confidence==='medium'?'\u{1F7E1} identificazione probabile':'\u26A0\uFE0F identificazione incerta';
            const photoLabel = ai.sawImage ? '\u{1F4F8} Claude ha visto la foto' : '\u{1F4DD} Solo descrizione (foto non disponibile)';
            const strengthEmoji = ai.dealStrength==='FORTE'?'\u{1F525}\u{1F525}\u{1F525}':ai.dealStrength==='BUONO'?'\u{1F525}\u{1F525}':'\u{1F525}';
            await tg(
              `\u{1F916} ${grailTag}${sleeperTag}<b>AFFARE ${ai.dealStrength||''}${ai.discountVsLow>0?' \u2212'+ai.discountVsLow+'%':''} ${strengthEmoji}</b>\n\n`+
              `\u231A ${item.title?.slice(0,65)}\n`+
              (ai.brand?`\u{1F527} <b>${ai.brand}${ai.model&&ai.model!=='null'?' '+ai.model:''}</b>\n`:'')+
              (ai.caliber&&ai.caliber!=='null'?`\u2699\uFE0F ${ai.caliber}${ai.qualityMovement?' \u2728':''}\n`:'')+
              (ai.doubleSigned?`\u270D\uFE0F <b>DOPPIA FIRMA: ${ai.doubleSigned}</b> (vale molto di piu!)\n`:'')+
              (ai.specialDial?`\u{1F3A8} <b>Quadrante speciale:</b> ${ai.specialDial}\n`:'')+
              (ai.material&&ai.material!=='sconosciuto'?`\u{1FA99} ${ai.material}\n`:'')+
              (ai.condition&&ai.condition!=='null'?`\u{1F50D} Condizioni: ${ai.condition}\n`:'')+
              (ai.working===false?`\u{1F527} <b>NON funzionante / da revisionare</b> (occasione per pezzi o restauro)\n`:'')+
              (ai.sellerClueless?`\u{1F3AF} <b>Il venditore sembra non sapere cosa ha!</b>\n`:'')+
              ((ai.sleeperTier||0)>=3?`\u{1F48E} Tesoro raro per intenditori (tier ${ai.sleeperTier})\n`:'')+
              `\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
              (ai.valueLow?`\u{1F4CA} Valore stimato: <b>\u20AC${ai.valueLow.toLocaleString('it-IT')}\u2013\u20AC${(ai.valueHigh||ai.valueLow).toLocaleString('it-IT')}</b>\n`:'')+
              (ai.discountVsLow>0?`\u{1F4C9} <b>\u2212${ai.discountVsLow}% sotto la stima</b>\n`:'')+
              (ai.marginEur>0?`\u{1F4B5} Margine potenziale: <b>~\u20AC${ai.marginEur.toLocaleString('it-IT')}</b>\n`:'')+
              (ai.evRating?(()=>{
                const ico = ai.futureOutlook==='rising'?'\u{1F4C8}':ai.futureOutlook==='declining'?'\u{1F4C9}':'\u27A1\uFE0F';
                const ev = ai.evRating==='high'?'ALTO \u{1F525}':ai.evRating==='medium'?'medio':'basso';
                let s = `\n\u{1F4CA} <b>POTENZIALE 3-5 ANNI: ${ev}</b> ${ico}\n`;
                if(ai.futureValueLow) s += `   Stima futura: <b>\u20AC${ai.futureValueLow.toLocaleString('it-IT')}\u2013\u20AC${(ai.futureValueHigh||ai.futureValueLow).toLocaleString('it-IT')}</b>\n`;
                if(ai.investmentReasons) s += `   ${ai.investmentReasons}\n`;
                s += `   \u{1F9E0} stima ragionata, non una garanzia\n`;
                return s;
              })():'')+
              (stars?`${stars} Desiderabilita ${ai.desirability}/10\n`:'')+
              `${confLabel}\n${photoLabel}\n`+
              (ai.redFlags&&ai.redFlags!=='null'?`\u{1F6A9} <b>Attenzione:</b> ${ai.redFlags}\n`:'')+
              `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
              `\u{1F4A1} ${ai.reasoning||''}\n\n`+
              (ai.sawImage?`\u{1F449} Controlla comunque TUTTE le foto prima di comprare.\n\n`:`\u26A0\uFE0F Stima dal titolo. Guarda bene le foto prima di comprare.\n\n`)+
              `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n`+
              `\u2796\u2796\u2796\n`+
              feedbackLinks(ai.brand, item.url, item.title)
            );
            console.log(`[CLAUDE] ${ai.dealStrength} ${ai.brand} ${ai.model} EUR${priceEur} (foto:${ai.sawImage?'si':'no'}, margine ${ai.marginEur})`);
            continue;
          }
          seenUrls.add(item.url);
          continue;
        }

        // ── FALLBACK: DB locale, solo se Claude NON configurato ──
        if (vintage && vintage.isDeal && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          foundVintage++;
          db.vintageDeals.push({
            id:nid(), platform:item.platform, title:item.title, price:priceEur,
            brand:vintage.brand, model:vintage.model, caliber:vintage.caliber,
            valueLow:vintage.valueLow, valueHigh:vintage.valueHigh,
            discountVsLow:vintage.discountVsLow, desirability:vintage.desirability,
            grail:vintage.grail, url:item.url, location:item.location||'',
            foundAt:new Date().toISOString(),
          });
          const grailTag = vintage.grail ? '\u{1F451} GRAIL ' : '';
          const stars = '\u2B50'.repeat(Math.min(Math.round(vintage.desirability/2),5));
          await tg(
            `\u{1F3FA} <b>${grailTag}OCCASIONE VINTAGE</b>\n\n`+
            `\u231A ${item.title?.slice(0,65)}\n`+
            `\u{1F527} <b>${vintage.brand} ${vintage.model}</b>\n`+
            `\u2699\uFE0F ${vintage.caliber} \u00B7 ${vintage.years}\n`+
            `\u{1FA99} ${vintage.material}\n`+
            `\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
            `\u{1F4CA} Valore mercato: <b>\u20AC${vintage.valueLow.toLocaleString('it-IT')}\u2013\u20AC${vintage.valueHigh.toLocaleString('it-IT')}</b>\n`+
            (vintage.discountVsLow>0?`\u{1F4C9} <b>\u2212${vintage.discountVsLow}% sotto il minimo di mercato</b>\n`:'')+
            `${stars} Desiderabilita ${vintage.desirability}/10\n`+
            `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
            `\u{1F4A1} ${vintage.note}\n\n`+
            `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>`
          );
          console.log(`[VINTAGE] ${vintage.brand} ${vintage.model} EUR${priceEur}`);
          continue;
        }

      }
      all = null; // libera i risultati di questa query
      if (global.gc) { try { global.gc(); } catch {} } // forza pulizia memoria
    } catch(e) { console.error(`[SCAN] ${query}:`,e.message); }
  }

  if (db.arbitrage.length>500) db.arbitrage=db.arbitrage.slice(-500);
  if (db.nearArbitrage.length>500) db.nearArbitrage=db.nearArbitrage.slice(-500);
  if (db.vintageDeals.length>500) db.vintageDeals=db.vintageDeals.slice(-500);

  console.log(`[SCAN] Fine: ${foundArb} arbitraggi, ${foundNear} trattabili, ${foundVintage} vintage`);
  await tg(
    `📊 <b>Scansione completata</b>\n\n`+
    `🥇 Oro: €${gold.toFixed(2)}/g | 🔘 Platino: €${platinum.toFixed(2)}/g\n\n`+
    `🥇 Arbitraggi metallo: <b>${foundArb}</b>\n`+
    `💛 Trattabili: <b>${foundNear}</b>\n`+
    `🏺 Occasioni vintage: <b>${foundVintage}</b>\n`+
    `🔍 ${GOLD_QUERIES.length} query mirate\n`+
    (process.env.SERPAPI_KEY?'Google Shopping: ✅\n':'SerpAPI: ➕\n')+
    (foundArb===0&&foundNear===0&&foundVintage===0?'\nNessuna opportunità in questo ciclo. Riprovo tra 6 ore.':'')
  );
  return {foundArb, foundNear, foundVintage};
}

// ══════════════════════════════════════════════════════════════
// DISCOVERY ENGINE
// ══════════════════════════════════════════════════════════════
async function runDiscoveryScan() {
  console.log('\n[DISCOVERY v11.1] Analisi brand...');
  try {
    const results = await scanAllBrands();
    db.discoveries = results;
    for (const analysis of results) {
      const {brand, emergingScore} = analysis;
      const prev = db.discoveryAlerts.find(a=>a.brandName===brand.name);
      const prevScore = prev?.score||0;
      if (emergingScore.score>=65&&(emergingScore.score-prevScore>=10||!prev)) {
        if (prev) prev.score=emergingScore.score;
        else db.discoveryAlerts.push({brandName:brand.name,score:emergingScore.score,tier:brand.tier,at:new Date().toISOString()});
        const te = {1:'⚪',2:'🟡',3:'🟢',4:'🔵'}[brand.tier]||'⚪';
        await tg(
          `🔭 <b>DISCOVERY ALERT</b>\n\n`+
          `${te} <b>${brand.name}</b> — Tier ${brand.tier} (${brand.country})\n`+
          `📊 Emerging Score: <b>${emergingScore.score}/100</b>\n`+
          `⏳ ${emergingScore.windowLabel}\n\n`+
          `🔑 ${emergingScore.keySignal}\n\n`+
          `💡 ${emergingScore.thesis}\n\n`+
          `Reddit: ${analysis.signals?.reddit?.monthPosts||0} post/mese · `+
          `YouTube: ${analysis.signals?.youtube?.totalVideos||0} video · `+
          `Hodinkee: ${analysis.signals?.hodinkee?.hasArticle?'✅':'❌'}`
        );
      }
    }
    return results;
  } catch(e) { console.error('[DISCOVERY]',e.message); return []; }
}

// ══════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════
app.get('/api/search', async(req,res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({error:'?q= richiesto'});
  const cached=getCached(q); if(cached) return res.json({...cached,fromCache:true});
  try { const d=await searchAll(q); setCache(q,d); res.json(d); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/metals', async(req,res) => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  res.json({gold:gold?Math.round(gold*100)/100:null,platinum:platinum?Math.round(platinum*100)/100:null,goldPerOz:gold?Math.round(gold*31.1035):null,platinumPerOz:platinum?Math.round(platinum*31.1035):null,goldHistory:db.goldPrices.slice(-48).reverse(),platinumHistory:db.platinumPrices.slice(-48).reverse()});
});
app.get('/api/gold-price', async(req,res) => {
  const p=await getGoldPrice().catch(()=>null);
  res.json({pricePerGram:p?Math.round(p*100)/100:null,history:db.goldPrices.slice(-48).reverse()});
});

app.get('/api/gold-scan',(req,res) => {
  res.json({message:'Scansione avviata',queries:GOLD_QUERIES.length,sources:6});
  runGoldScan().catch(e=>console.error('[SCAN]',e.message));
});

app.get('/api/arbitrage',(req,res) => {
  const all=[...db.arbitrage,...db.nearArbitrage].sort((a,b)=>b.diffPct-a.diffPct);
  res.json(all.slice(0,200));
});
app.get('/api/arbitrage/real',(req,res) => res.json([...db.arbitrage].sort((a,b)=>b.diffPct-a.diffPct)));
app.get('/api/arbitrage/near',(req,res) => res.json([...db.nearArbitrage].sort((a,b)=>b.diffPct-a.diffPct)));

app.get('/api/discovery/scan',(req,res) => {
  res.json({message:'Analisi avviata',brands:SEED_BRANDS.length});
  runDiscoveryScan().catch(()=>{});
});
app.get('/api/discovery',(req,res) => {
  if (db.discoveries.length>0) return res.json(db.discoveries);
  res.json(SEED_BRANDS.map(b=>({brand:b,emergingScore:{score:0,windowLabel:'— Avvia analisi',thesis:'Clicca Avvia Analisi.',keySignal:'—',breakdown:{}},signals:{},analyzedAt:null})));
});
app.get('/api/discovery/alerts',(req,res) => res.json(db.discoveryAlerts.slice(-50)));

// Hype Social
app.get('/api/hype/scan',(req,res)=>{
  res.json({message:'Analisi hype avviata',models:HYPE_WATCHLIST.length});
  runHypeScan().catch(()=>{});
});
app.get('/api/hype',(req,res)=>{
  if(db.hypeAnalyses.length>0) return res.json(db.hypeAnalyses);
  res.json(HYPE_WATCHLIST.map(w=>({query:w.query,category:w.category,baseHype:w.baseHype,hypeScore:{score:w.baseHype,label:'— Avvia analisi',keySignal:'—'},signals:{},analyzedAt:null})));
});
app.get('/api/hype/alerts',(req,res)=>res.json(db.hypeAlerts.slice(-30)));

// Vintage
app.get('/api/vintage',(req,res)=>res.json(db.vintageDeals.slice(-100).reverse()));
app.get('/api/vintage/db',(req,res)=>res.json(Object.entries(VINTAGE_DB).map(([k,v])=>({key:k,...v}))));
app.get('/api/vintage/check',(req,res)=>{
  const {title,price}=req.query;
  if(!title) return res.status(400).json({error:'?title= richiesto'});
  const result=evaluateVintageDeal(title,price?parseFloat(price):999999);
  res.json(result||{match:false,message:'Modello non riconosciuto nel database vintage'});
});

// Test analisi Claude su un annuncio (per provare la chiave API)
app.get('/api/claude/check',async(req,res)=>{
  const {title,price,image}=req.query;
  if(!title) return res.status(400).json({error:'?title= richiesto (es. ?title=Omega Speedmaster 321&price=6000)'});
  if(!claudeAnalyst.isConfigured()) return res.json({configured:false,message:'ANTHROPIC_API_KEY non configurata su Render'});
  const result=await claudeAnalyst.analyzeListing(title, price?parseFloat(price):5000, image||'');
  res.json(result||{error:'Analisi fallita — controlla la chiave API e il credito'});
});

// ── FEEDBACK: i link toccabili dentro gli alert finiscono qui ──
// Esempio: /api/fb?a=bl&b=Favre-Leuba  → blocca il marchio
//          /api/fb?a=dz&u=<url annuncio> → scarta quell'annuncio
function fbPage(titolo, sottotitolo) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Watch Price Bot</title>
  <style>body{font-family:-apple-system,system-ui,sans-serif;background:#0f1115;color:#eee;
  display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
  .card{padding:28px}h1{font-size:42px;margin:0 0 12px}p{color:#aaa;font-size:17px;margin:6px 0}
  .big{font-size:22px;color:#fff;margin:14px 0}</style></head>
  <body><div class="card"><h1>${titolo}</h1><div class="big">${sottotitolo}</div>
  <p>Puoi tornare su Telegram.</p></div></body></html>`;
}
app.get('/api/fb', (req, res) => {
  const { a, b, u } = req.query;
  if (a === 'bl' && b) {
    const brand = String(b).slice(0, 60);
    if (!db.blacklistBrands.includes(brand)) db.blacklistBrands.push(brand);
    saveState();
    console.log(`[FEEDBACK] Marchio bloccato: ${brand}`);
    return res.send(fbPage('🚫 Bloccato', `Non riceverai più <b>${brand}</b>.`));
  }
  if (a === 'dz' && u) {
    const url = String(u);
    if (!db.dismissedUrls.includes(url)) db.dismissedUrls.push(url);
    saveState();
    console.log(`[FEEDBACK] Annuncio scartato`);
    return res.send(fbPage('👎 Scartato', `Questo annuncio non tornerà più.`));
  }
  if (a === 'lk') {
    db.liked.push({ brand: (b||'').slice(0,60), title: (req.query.t||'').slice(0,80), url: u||'', at: new Date().toISOString() });
    saveState();
    console.log(`[FEEDBACK] Mi piace: ${b||req.query.t||''}`);
    return res.send(fbPage('👍 Piace', `Bene, terrò conto dei tuoi gusti.`));
  }
  res.status(400).send(fbPage('⚠️ Errore', 'Richiesta non valida.'));
});

// Vedere e gestire la blacklist
app.get('/api/blacklist', (req, res) => {
  res.json({ marchiBloccati: db.blacklistBrands, annunciScartati: db.dismissedUrls.length });
});
app.get('/api/liked', (req, res) => {
  res.json({ totale: db.liked.length, piaciuti: db.liked.slice(-50).reverse() });
});
app.post('/api/blacklist/remove', (req, res) => {
  const { brand } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'brand richiesto' });
  db.blacklistBrands = db.blacklistBrands.filter(b => b.toLowerCase() !== String(brand).toLowerCase());
  saveState();
  res.json({ ok: true, marchiBloccati: db.blacklistBrands });
});
app.get('/api/blacklist/clear', (req, res) => {
  db.blacklistBrands = []; db.dismissedUrls = []; saveState();
  res.send(fbPage('🧹 Pulito', 'Blacklist svuotata.'));
});


app.get('/api/watchlist',(req,res) => res.json(db.watchlist.filter(w=>w.active)));
app.post('/api/watchlist',(req,res) => {
  const {query,threshold,email,telegramChatId}=req.body;
  if (!query) return res.status(400).json({error:'query richiesta'});
  const r={id:nid(),query,threshold:threshold||null,email:email||null,telegram_chat_id:telegramChatId||process.env.TELEGRAM_CHAT_ID||null,active:true,created_at:new Date().toISOString()};
  db.watchlist.push(r); res.json(r);
});
app.delete('/api/watchlist/:id',(req,res) => {
  const item=db.watchlist.find(w=>w.id===parseInt(req.params.id));
  if (item) item.active=false; res.json({ok:true});
});

app.get('/api/portfolio',(req,res) => res.json(db.portfolio.filter(p=>p.active)));
app.post('/api/portfolio',(req,res) => {
  const r={id:nid(),active:true,created_at:new Date().toISOString(),...req.body};
  db.portfolio.push(r); res.json(r);
});
app.delete('/api/portfolio/:id',(req,res) => {
  const item=db.portfolio.find(p=>p.id===parseInt(req.params.id));
  if (item) item.active=false; res.json({ok:true});
});
app.get('/api/portfolio/summary',(req,res) => {
  const items=db.portfolio.filter(p=>p.active);
  res.json({totalCost:items.reduce((s,i)=>s+(parseFloat(i.purchasePrice||i.purchase_price)||0),0),itemCount:items.length});
});

app.get('/api/alerts',(req,res) => res.json(db.alerts.slice(-50).reverse()));

app.post('/api/telegram/test',(req,res) => {
  tg(`⌚ <b>PriceRadar v11.1</b> — Test OK! 🟢\n\nFonti attive:\n✅ eBay ${process.env.EBAY_CLIENT_ID?'API':'RSS (6 paesi)'}\n✅ Chrono24\n✅ Catawiki\n✅ Subito.it\n✅ Leboncoin\n✅ Vestiaire\n✅ Watchfinder\n${process.env.SERPAPI_KEY?'✅':'➕'} Google Shopping (SerpAPI)\n${process.env.FACEBOOK_ACCESS_TOKEN?'✅':'➕'} Facebook Marketplace`,req.body.chatId);
  res.json({ok:true});
});

app.get('/api/status',async(req,res) => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  res.json({
    status:'online',version:'11.1',
    goldPricePerGram:gold?Math.round(gold*100)/100:null,
    platinumPricePerGram:platinum?Math.round(platinum*100)/100:null,
    arbitrageFound:db.arbitrage.length,nearArbitrageFound:db.nearArbitrage.length,
    vintageDealsFound:db.vintageDeals.length,
    vintageDatabaseSize:Object.keys(VINTAGE_DB).length,
    serpApiUsedThisMonth:serpUsage.count,
    serpApiMonthlyLimit:SERPAPI_MONTHLY_LIMIT,
    claudeConfigured:claudeAnalyst.isConfigured(),
    claudeUsage:claudeAnalyst.getUsage(),
    brandsAnalyzed:db.discoveries.length,discoveryAlerts:db.discoveryAlerts.length,
    watchlist:db.watchlist.filter(w=>w.active).length,
    portfolio:db.portfolio.filter(p=>p.active).length,
    goldQueries:GOLD_QUERIES.length,indieBrands:SEED_BRANDS.length,
    ebayConfigured:!!(process.env.EBAY_CLIENT_ID),
    serpApiConfigured:!!(process.env.SERPAPI_KEY),
    facebookConfigured:!!(process.env.FACEBOOK_ACCESS_TOKEN),
    telegramConfigured:!!(process.env.TELEGRAM_TOKEN),
    emailConfigured:!!(process.env.SMTP_USER),
    uptime:Math.floor(process.uptime()),
  });
});

// ── CRON ─────────────────────────────────────────────────────
// CACCIA TESORI:
//  • Subito VELOCE ogni ora (1 query/scan): per arrivare primi sugli
//    annunci dei privati italiani, che durano poco. ~24 scan/giorno.
//  • Scan COMPLETA (Subito+eBay+Shopping+Vinted) ogni 5 ore: copertura
//    larga sulle altre fonti. ~5 scan/giorno × 4 fonti.
//  Budget SerpAPI: Subito non usa SerpAPI (scraping diretto); la completa
//  usa ~2 query SerpAPI × 5/giorno × 30 = ~300/mese. Dentro le 1.000.
// Hype indie: 03,11,19 · Discovery: 06 — distribuite per non accavallarsi.
cron.schedule('30 * * * *',()=>runGoldScan('subito').catch(()=>{}));   // ogni ora, al minuto 30 (Subito gratis, copertura ampia)
cron.schedule('0 2,10,18 * * *',()=>runGoldScan('all').catch(()=>{})); // completa ogni 8h (usa SerpAPI, dentro budget)
cron.schedule('0 3,11,19 * * *',()=>runHypeScan().catch(()=>{}));
cron.schedule('0 6 * * *',()=>runDiscoveryScan().catch(()=>{}));
// Watchlist: ogni 2 ore (non 30 min) per non bruciare le ricerche SerpAPI.
// Usa searchAllFree (solo fonti gratuite RSS) per i controlli watchlist.
cron.schedule('0 */2 * * *',async()=>{
  for (const item of db.watchlist.filter(w=>w.active)){
    try{
      await sleep(2000);
      const data=await searchAll(item.query);
      if(item.threshold&&data.lowest&&data.lowest.priceEur<=parseFloat(item.threshold)){
        const recent=db.alerts.find(a=>a.wid===item.id&&Date.now()-new Date(a.at).getTime()<4*3600000);
        if(!recent){
          await tg(`🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${data.lowest.priceEur.toLocaleString('it-IT')} su ${data.lowest.platform}\n<a href="${data.lowest.url}">→ VEDI</a>`,item.telegram_chat_id);
          db.alerts.push({id:nid(),wid:item.id,price:data.lowest.priceEur,at:new Date().toISOString()});
        }
      }
      cache.delete(item.query);
    }catch{}
  }
});

// ── AVVIO ─────────────────────────────────────────────────────
const PORT=process.env.PORT||3001;
app.listen(PORT,'0.0.0.0',async()=>{
  loadState(); // carica blacklist marchi + annunci scartati
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  console.log(`\n⌚ Watch Price Bot v11.1 — porta ${PORT}`);
  console.log(`   Oro: €${gold?.toFixed(2)||'N/A'}/g | Platino: €${platinum?.toFixed(2)||'N/A'}/g`);
  console.log(`   eBay: ${process.env.EBAY_CLIENT_ID?'API ✓':'RSS ✓'} | SerpAPI: ${process.env.SERPAPI_KEY?'✓':'✗'} | FB: ${process.env.FACEBOOK_ACCESS_TOKEN?'✓':'✗'}\n`);

  if(process.env.TELEGRAM_TOKEN&&process.env.TELEGRAM_CHAT_ID){
    await tg(
      `✅ <b>PriceRadar v11.1 Online!</b>\n\n`+
      `🥇 Oro: €${gold?.toFixed(2)||'N/A'}/g\n`+
      `🔘 Platino: €${platinum?.toFixed(2)||'N/A'}/g\n\n`+
      `<b>Fonti attive ora:</b>\n`+
      `✅ eBay ${process.env.EBAY_CLIENT_ID?'API (6 mercati)':'RSS (6 paesi)'}\n`+
      `✅ Chrono24\n`+
      `✅ Catawiki\n`+
      `✅ Subito.it 🇮🇹\n`+
      `✅ Leboncoin 🇫🇷\n`+
      `✅ Vestiaire\n`+
      `✅ Watchfinder 🇬🇧\n`+
      `✅ Vinted 🇮🇹\n`+
      `✅ Wallapop 🇪🇸\n`+
      `✅ Ricardo.ch 🇨🇭\n`+
      `✅ Marktplaats 🇳🇱\n`+
      (process.env.SERPAPI_KEY?`✅ Google Shopping (Belluno 200km)\n`:`➕ Google Shopping (aggiungi SERPAPI_KEY)\n`)+
      (process.env.FACEBOOK_ACCESS_TOKEN?`✅ Facebook Marketplace 📍\n`:`➕ Facebook Marketplace (aggiungi token)\n`)+
      `\n🏺 Database vintage: <b>${Object.keys(VINTAGE_DB).length} modelli</b> (calibri + valori)\n`+
      `🔭 Indie monitorati: <b>${SEED_BRANDS.length}</b>\n`+
      `🔥 Hype watchlist: <b>${HYPE_WATCHLIST.length}</b>\n`+
      (claudeAnalyst.isConfigured()?`🤖 Analisi Claude: <b>ATTIVA</b> (ragiona su ogni annuncio)\n`:`➕ Analisi Claude (aggiungi ANTHROPIC_API_KEY)\n`)+
      `\nPrima scansione tra 60 secondi...`
    );
  }

  // All'avvio parte SOLO la scansione oro (dopo 90s).
  // Hype e Discovery li gestisce il cron alle loro ore, per non
  // avere mai due scansioni insieme in memoria.
  setTimeout(()=>runGoldScan().catch(e=>console.error('[GOLD]',e.message)), 90000);
});
// placeholder
