/**
 * Watch Price Bot v10 — Sistema Definitivo
 * 
 * MODULO 1: ARBITRAGGIO METALLI PRECISO
 * - Database pesi esatti da schede tecniche ufficiali
 * - Calcolo matematico certo: grammi × spot price = valore reale
 * - Alert quando prezzo < valore metallo (arbitraggio)
 * - Alert quando prezzo < valore metallo + 15% (trattabile)
 * - Da €500 in su, oro 18k e platino, qualsiasi marca
 * 
 * MODULO 2: DISCOVERY ENGINE AUTONOMO
 * - Analizza Reddit (velocità crescita menzioni)
 * - Analizza YouTube (video recenti + canali noti)
 * - Analizza Hodinkee (prima menzione = segnale max)
 * - Analizza Google News + WatchesBySJX
 * - Analizza Facebook Groups italiani
 * - Emerging Score algoritmo proprietario
 * - Trova brand emergenti SENZA che l'utente li suggerisca
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { findWatchModel } = require('./metalsDatabase');
const { SEED_BRANDS, analyzeBrand, scanAllBrands } = require('./discoveryEngine');

const app = express();
app.use(cors());
app.use(express.json());

// ── DATABASE IN MEMORIA ───────────────────────────────────────
let db = {
  arbitrage: [],        // sotto valore metallo
  nearArbitrage: [],    // entro 15% sopra valore metallo
  discoveries: [],      // analisi brand indipendenti
  discoveryAlerts: [],  // alert nuovi brand emergenti
  watchlist: [],
  portfolio: [],
  alerts: [],
  goldPrices: [],
  platinumPrices: [],
};
let _id = Date.now();
const nid = () => ++_id;

// ── PREZZI METALLI ────────────────────────────────────────────
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
  // Fallback: platino ≈ 0.9x oro (attualmente leggermente sotto)
  return cachedPlatinum || (cachedGold ? cachedGold * 0.88 : 69);
}

// ─────────────────────────────────────────────
// CALCOLO VALORE METALLO PRECISO
// ─────────────────────────────────────────────
async function getMetalValue(title) {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  const model = findWatchModel(title);
  if (!model) return null;
  const pricePerGram = model.metal === 'platinum' ? platinum : gold;
  const metalValue = Math.round(model.pureMetalGrams * pricePerGram);
  return {
    model: model.model,
    brand: model.brand,
    metal: model.metal,
    pureMetalGrams: model.pureMetalGrams,
    metalValue,
    pricePerGram: Math.round(pricePerGram * 100) / 100,
    confidence: model.confidence,
  };
}

// ── UTILS ─────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rUA = () => {
  const list = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  ];
  return list[Math.floor(Math.random() * list.length)];
};
const parsePrice = t => parseFloat((t || '').replace(/[^\d,.]/g, '').replace(',', '.')) || 0;

// Rilevamento oro 18k e platino
const GOLD_KEYWORDS = ['18k','18kt','18 karat','18 carati','18 carats','oro 18','or 18','gold 18','750','au750','18ct','yellow gold','rose gold','white gold','solid gold','oro giallo','oro rosa','oro bianco','or jaune','or rose','or blanc','everose','sedna','moonshine'];
const PLATINUM_KEYWORDS = ['platino','platinum','pt950','pt 950','pt900','platin','platine'];

function detectMetal(title) {
  const t = (title || '').toLowerCase();
  if (PLATINUM_KEYWORDS.some(k => t.includes(k))) return 'platinum';
  if (GOLD_KEYWORDS.some(k => t.includes(k))) return '18k';
  return null;
}

// Cambio valute
let fxRates = { USD: 0.92, GBP: 1.17, CHF: 1.05 }, fxF = 0;
async function toEur(price, currency) {
  if (!price || currency === 'EUR') return price;
  if (Date.now() - fxF > 3600000) {
    try {
      const r = await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF', { timeout: 5000 });
      fxRates = { USD: 1/r.data.rates.USD, GBP: 1/r.data.rates.GBP, CHF: 1/r.data.rates.CHF };
      fxF = Date.now();
    } catch {}
  }
  return price * (fxRates[currency] || 1);
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
const mailer = nodemailer.createTransport({ host:'smtp.gmail.com', port:587, secure:false, auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASS } });
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || !to) return;
  mailer.sendMail({ from:`PriceRadar <${process.env.SMTP_USER}>`, to, subject, html }).catch(() => {});
}

// ── EBAY ─────────────────────────────────────────────────────
let ebayToken = null, ebayExp = 0;
async function searchEbay(query) {
  if (!process.env.EBAY_CLIENT_ID) return [];
  try {
    if (!ebayToken || Date.now() >= ebayExp) {
      const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
      const r = await axios.post('https://api.ebay.com/identity/v1/oauth2/token',
        'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
        { headers: { Authorization:`Basic ${c}`, 'Content-Type':'application/x-www-form-urlencoded' } }
      );
      ebayToken = r.data.access_token;
      ebayExp = Date.now() + (r.data.expires_in - 60) * 1000;
    }
    const results = [];
    for (const market of ['EBAY_IT','EBAY_FR','EBAY_DE','EBAY_GB']) {
      try {
        const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: { q:query, category_ids:'31387', sort:'price', limit:20, filter:'price:[500..]' },
          headers: { Authorization:`Bearer ${ebayToken}`, 'X-EBAY-C-MARKETPLACE-ID':market }
        });
        results.push(...(r.data.itemSummaries||[]).map(i => ({
          platform:`eBay ${market.replace('EBAY_','')}`,
          title:i.title, price:parseFloat(i.price?.value||0),
          currency:i.price?.currency||'EUR', url:i.itemWebUrl,
          location:i.itemLocation?.country,
        })).filter(i => i.price >= 500));
        await sleep(200);
      } catch {}
    }
    return results;
  } catch(e) { console.error('[eBay]', e.message); return []; }
}

// ── CHRONO24 ─────────────────────────────────────────────────
async function searchChrono24(query, domain = 'it') {
  try {
    await sleep(1500 + Math.random() * 800);
    const url = `https://www.chrono24.${domain}/search/index.htm?query=${encodeURIComponent(query)}&dosearch=true&searchType=fulltext&resultview=list`;
    const r = await axios.get(url, {
      headers: { 'User-Agent':rUA(), 'Accept-Language':'it-IT,it;q=0.9', Referer:`https://www.chrono24.${domain}/` },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-article-id],.article-item-container').each((i, el) => {
      if (i >= 15) return;
      const $el = $(el);
      const title = $el.find('.article-title,h3').first().text().trim();
      const price = parsePrice($el.find('.price,.js-price').first().text());
      const link = $el.find('a[href*="/watches/"]').first().attr('href');
      if (title && price >= 500) results.push({
        platform:'Chrono24', title, price, currency:'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.chrono24.${domain}${link}`) : url,
      });
    });
    return results;
  } catch { return []; }
}

// ── CATAWIKI ─────────────────────────────────────────────────
async function searchCatawiki(query) {
  try {
    await sleep(1200 + Math.random() * 600);
    const r = await axios.get(`https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent':rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="lot-card"],article[data-lot-id]').each((i, el) => {
      if (i >= 12) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],h2,h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"],[class*="bid"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 500) results.push({
        platform:'Catawiki', title, price, currency:'EUR', isAuction:true,
        url: link ? (link.startsWith('http') ? link : `https://www.catawiki.com${link}`) : 'https://www.catawiki.com/en/c/80-watches',
      });
    });
    return results;
  } catch { return []; }
}

// ── SUBITO.IT ─────────────────────────────────────────────────
async function searchSubito(query) {
  try {
    await sleep(1000 + Math.random() * 600);
    const r = await axios.get(`https://www.subito.it/annunci-italia/vendita/orologi-e-gioielli/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent':rUA(), 'Accept-Language':'it-IT', Referer:'https://www.subito.it/' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="item-card"],[class*="SmallCard"],article').each((i, el) => {
      if (i >= 12) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      const location = $el.find('[class*="location"],[class*="town"]').first().text().trim();
      if (title && price >= 500) results.push({
        platform:'Subito.it', title, price, currency:'EUR', isLocal:true, location,
        url: link ? (link.startsWith('http') ? link : `https://www.subito.it${link}`) : 'https://www.subito.it',
      });
    });
    return results;
  } catch { return []; }
}

// ── LEBONCOIN ─────────────────────────────────────────────────
async function searchLeboncoin(query) {
  try {
    await sleep(1500 + Math.random() * 600);
    const r = await axios.get(`https://www.leboncoin.fr/recherche?category=62&text=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent':rUA(), 'Accept-Language':'fr-FR,fr;q=0.9', Referer:'https://www.leboncoin.fr/' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-qa-id="aditem_container"],[class*="AdCard"],[class*="styles_adCard"]').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('[data-qa-id="aditem_title"],[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[data-qa-id="aditem_price"],[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 500) results.push({
        platform:'Leboncoin 🇫🇷', title, price, currency:'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.leboncoin.fr${link}`) : 'https://www.leboncoin.fr',
      });
    });
    return results;
  } catch { return []; }
}

// ── VESTIAIRE ─────────────────────────────────────────────────
async function searchVestiaire(query) {
  try {
    await sleep(1000 + Math.random() * 500);
    const r = await axios.get(`https://www.vestiairecollective.com/search/?q=${encodeURIComponent(query)}&universe=men&category=watches`, {
      headers: { 'User-Agent':rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="product-card"],[class*="ProductCard"]').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],[class*="brand"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 500) results.push({
        platform:'Vestiaire', title, price, currency:'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.vestiairecollective.com${link}`) : 'https://www.vestiairecollective.com',
      });
    });
    return results;
  } catch { return []; }
}

// ── WATCHFINDER ───────────────────────────────────────────────
async function searchWatchfinder(query) {
  try {
    await sleep(1000 + Math.random() * 500);
    const r = await axios.get(`https://www.watchfinder.co.uk/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent':rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="watch-card"],[class*="WatchCard"],article').each((i, el) => {
      if (i >= 8) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 500) results.push({
        platform:'Watchfinder 🇬🇧', title, price, currency:'GBP',
        url: link ? (link.startsWith('http') ? link : `https://www.watchfinder.co.uk${link}`) : 'https://www.watchfinder.co.uk',
      });
    });
    return results;
  } catch { return []; }
}

// ─────────────────────────────────────────────
// SCANSIONE ARBITRAGGIO — MODULO 1
// ─────────────────────────────────────────────
const GOLD_QUERIES = [
  // Italiano
  'orologio oro 18k', 'orologio oro 18 carati', 'orologio oro giallo 18k',
  'orologio oro rosa 18k', 'orologio oro bianco 18k', 'orologio 750',
  'orologio vintage oro', 'orologio tasca oro 18k', 'orologio da tasca oro',
  // Inglese
  'watch 18k gold', 'watch yellow gold 18k', 'watch rose gold 18k',
  'watch white gold 18k', 'pocket watch gold 18k', 'watch solid gold',
  // Francese
  'montre or 18k', 'montre or jaune 18k', 'montre gousset or 18k',
  // Platino
  'orologio platino', 'watch platinum', 'montre platine',
  // Marche generiche
  'rolex gold', 'patek or', 'cartier gold 18k', 'omega gold',
  'vacheron or', 'jaeger gold', 'breguet or', 'lange gold',
  // Vintage
  'vintage watch gold 750', 'orologio antico oro', 'montre ancienne or',
];

async function runGoldScan() {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  console.log(`\n[GOLD SCAN v10] Oro: €${gold.toFixed(2)}/g | Platino: €${platinum.toFixed(2)}/g`);
  console.log(`[GOLD SCAN v10] ${GOLD_QUERIES.length} query × 8 piattaforme`);

  let foundArb = 0, foundNear = 0;

  for (const query of GOLD_QUERIES) {
    try {
      await sleep(2500 + Math.random() * 1500);

      const [c24it, c24de, ebay, catawiki, subito, leboncoin, vestiaire, watchfinder] = await Promise.allSettled([
        searchChrono24(query, 'it'),
        searchChrono24(query, 'de'),
        searchEbay(query),
        searchCatawiki(query),
        searchSubito(query),
        searchLeboncoin(query),
        searchVestiaire(query),
        searchWatchfinder(query),
      ]);

      const allItems = [
        ...(c24it.status==='fulfilled'?c24it.value:[]),
        ...(c24de.status==='fulfilled'?c24de.value:[]),
        ...(ebay.status==='fulfilled'?ebay.value:[]),
        ...(catawiki.status==='fulfilled'?catawiki.value:[]),
        ...(subito.status==='fulfilled'?subito.value:[]),
        ...(leboncoin.status==='fulfilled'?leboncoin.value:[]),
        ...(vestiaire.status==='fulfilled'?vestiaire.value:[]),
        ...(watchfinder.status==='fulfilled'?watchfinder.value:[]),
      ];

      for (const item of allItems) {
        const metal = detectMetal(item.title);
        if (!metal) continue;

        const priceEur = Math.round(await toEur(item.price, item.currency));
        if (priceEur < 500) continue;

        // Calcolo valore metallo preciso
        const metalData = await getMetalValue(item.title);
        if (!metalData) continue;

        const metalValue = metalData.metalValue;
        const diff = metalValue - priceEur;
        const diffPct = Math.round((diff / metalValue) * 1000) / 10;

        // Già trovato?
        const existing = [...db.arbitrage, ...db.nearArbitrage].find(a => a.url === item.url);
        if (existing) continue;

        const entry = {
          id: nid(),
          platform: item.platform,
          title: item.title,
          price: priceEur,
          metalValue,
          metalGrams: metalData.pureMetalGrams,
          metal: metalData.metal,
          metalType: metalData.metalType,
          diffPct,
          confidence: metalData.confidence,
          url: item.url,
          location: item.location || '',
          isAuction: item.isAuction || false,
          isLocal: item.isLocal || false,
          foundAt: new Date().toISOString(),
        };

        if (diffPct > 0) {
          // SOTTO valore metallo = arbitraggio vero
          db.arbitrage.push(entry);
          foundArb++;

          const metalEmoji = metalData.metal === 'platinum' ? '🔘' : '🥇';
          const metalName = metalData.metal === 'platinum' ? 'Platino' : 'Oro 18k';
          const confidenceNote = metalData.confidence === 'low' ? '\n⚠️ Stima approssimativa — verifica peso prima di acquistare' : '';

          await tg(
            `${metalEmoji} <b>ARBITRAGGIO ${metalName.toUpperCase()}!</b>\n\n` +
            `⌚ ${item.title?.slice(0,65)}\n` +
            `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
            `💎 Valore ${metalName}: <b>€${metalValue.toLocaleString('it-IT')}</b>\n` +
            `   (${metalData.pureMetalGrams}g × €${metalData.pricePerGram}/g)\n` +
            `📉 <b>−${diffPct}% sotto valore ${metalName}!</b>\n` +
            `💵 Guadagno immediato: <b>€${diff.toLocaleString('it-IT')}</b>\n` +
            `🏪 ${item.platform}${item.location ? ` · 📍 ${item.location}` : ''}` +
            `${item.isAuction ? ' · 🔨 Asta' : ''}${confidenceNote}\n\n` +
            `<a href="${item.url}">👉 VEDI ANNUNCIO</a>`
          );
          console.log(`[ARB ${metalEmoji}] ${item.title?.slice(0,40)} €${priceEur} vs €${metalValue} (−${diffPct}%) [${metalData.confidence}]`);

        } else if (diffPct > -15) {
          // ENTRO 15% sopra valore metallo = trattabile
          db.nearArbitrage.push(entry);
          foundNear++;

          const neededDiscount = Math.ceil(Math.abs(diffPct) + 2);
          await tg(
            `💛 <b>TRATTABILE — vicino al valore metallo</b>\n\n` +
            `⌚ ${item.title?.slice(0,65)}\n` +
            `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
            `💎 Valore metallo: <b>€${metalValue.toLocaleString('it-IT')}</b> (${metalData.pureMetalGrams}g)\n` +
            `📊 Solo ${Math.abs(diffPct)}% sopra il valore metallo puro\n` +
            `💡 Con −${neededDiscount}% diventa arbitraggio\n` +
            `🏪 ${item.platform}${item.location ? ` · 📍 ${item.location}` : ''}\n\n` +
            `<a href="${item.url}">👉 VEDI ANNUNCIO</a>`
          );
          console.log(`[NEAR 💛] ${item.title?.slice(0,40)} €${priceEur} vs €${metalValue} (+${Math.abs(diffPct)}%)`);
        }
      }
    } catch(e) { console.error(`[GOLD SCAN] ${query}:`, e.message); }
  }

  // Mantieni DB pulito
  if (db.arbitrage.length > 300) db.arbitrage = db.arbitrage.slice(-300);
  if (db.nearArbitrage.length > 300) db.nearArbitrage = db.nearArbitrage.slice(-300);

  console.log(`\n[GOLD SCAN] Fine: ${foundArb} arbitraggi, ${foundNear} trattabili`);

  // Riepilogo Telegram
  await tg(
    `📊 <b>Scansione completata</b>\n\n` +
    `🥇 Oro spot: €${gold.toFixed(2)}/g\n` +
    `🔘 Platino spot: €${platinum.toFixed(2)}/g\n\n` +
    `✅ Arbitraggi trovati: <b>${foundArb}</b>\n` +
    `💛 Trattabili trovati: <b>${foundNear}</b>\n` +
    `🔍 Query eseguite: ${GOLD_QUERIES.length}\n` +
    `🏪 Piattaforme: 8\n\n` +
    (foundArb === 0 && foundNear === 0 ? '⏰ Nessuna opportunità in questo ciclo. Prossima scansione tra 2 ore.' : '')
  );

  return { foundArb, foundNear, gold, platinum };
}

// ─────────────────────────────────────────────
// SCANSIONE DISCOVERY — MODULO 2
// ─────────────────────────────────────────────
async function runDiscoveryScan() {
  console.log('\n[DISCOVERY v10] Analisi brand indipendenti...');
  const results = await scanAllBrands();

  // Salva risultati
  db.discoveries = results;

  // Alert per brand con score alto o segnali nuovi importanti
  for (const analysis of results) {
    const { brand, emergingScore } = analysis;
    const prevAnalysis = db.discoveryAlerts.find(a => a.brandName === brand.name);
    const prevScore = prevAnalysis?.score || 0;
    const scoreJump = emergingScore.score - prevScore;

    // Alert se: score >= 65 E (nuovo o crescita significativa)
    if (emergingScore.score >= 65 && (scoreJump >= 10 || !prevAnalysis)) {
      // Aggiorna o crea record
      if (prevAnalysis) prevAnalysis.score = emergingScore.score;
      else db.discoveryAlerts.push({ brandName: brand.name, score: emergingScore.score, tier: brand.tier, at: new Date().toISOString() });

      const tierEmoji = { 1:'⚪', 2:'🟡', 3:'🟢', 4:'🔵' }[brand.tier] || '⚪';
      const msg =
        `🔭 <b>DISCOVERY ALERT</b>\n\n` +
        `${tierEmoji} <b>${brand.name}</b> — Tier ${brand.tier} (${brand.country})\n` +
        `📊 Emerging Score: <b>${emergingScore.score}/100</b>\n` +
        (scoreJump >= 10 ? `📈 Crescita: +${scoreJump} punti dall'ultima analisi\n` : '') +
        `⏳ ${emergingScore.windowLabel}\n\n` +
        `🔑 Segnale chiave:\n<i>${emergingScore.keySignal}</i>\n\n` +
        `💡 Investment thesis:\n<i>${emergingScore.thesis}</i>\n\n` +
        `Dettagli:\n` +
        `• Reddit: ${analysis.signals.reddit.monthPosts} post/mese (${analysis.signals.reddit.growthSignal})\n` +
        `• YouTube: ${analysis.signals.youtube.totalVideos} video${analysis.signals.youtube.knownChannelBonus ? ' ⭐ canale noto' : ''}\n` +
        `• Hodinkee: ${analysis.signals.hodinkee.hasArticle ? `✅ ${analysis.signals.hodinkee.articles.length} articoli` : '❌ non ancora'}\n` +
        `• Notizie recenti: ${analysis.signals.news.recentCount}`;

      await tg(msg);
      console.log(`[DISCOVERY ALERT] ${brand.name}: ${emergingScore.score}/100 | ${emergingScore.windowLabel}`);
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// RICERCA GENERICA (per app frontend)
// ─────────────────────────────────────────────
async function searchAll(query) {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();

  const [c24, ebay, catawiki, subito, vestiaire] = await Promise.allSettled([
    searchChrono24(query, 'it'),
    searchEbay(query),
    searchCatawiki(query),
    searchSubito(query),
    searchVestiaire(query),
  ]);

  const all = [
    ...(c24.status==='fulfilled'?c24.value:[]),
    ...(ebay.status==='fulfilled'?ebay.value:[]),
    ...(catawiki.status==='fulfilled'?catawiki.value:[]),
    ...(subito.status==='fulfilled'?subito.value:[]),
    ...(vestiaire.status==='fulfilled'?vestiaire.value:[]),
  ];

  const enriched = await Promise.all(all.map(async item => {
    const priceEur = Math.round(await toEur(item.price, item.currency));
    const metal = detectMetal(item.title);
    let metalData = null;
    if (metal) {
      const md = await getMetalValue(item.title);
      if (md) {
        const diffPct = Math.round(((md.metalValue - priceEur) / md.metalValue) * 1000) / 10;
        metalData = { ...md, diffPct, isArbitrage: priceEur < md.metalValue, isNearArbitrage: diffPct > -15 && diffPct <= 0 };
      }
    }
    return { ...item, priceEur, metal, metalData };
  }));

  enriched.sort((a, b) => a.priceEur - b.priceEur);
  const byP = {};
  for (const i of enriched) if (!byP[i.platform] || i.priceEur < byP[i.platform].priceEur) byP[i.platform] = i;

  return {
    query, results: Object.values(byP).sort((a,b)=>a.priceEur-b.priceEur),
    allListings: enriched, lowest: enriched[0]||null,
    arbitrage: enriched.filter(i => i.metalData?.isArbitrage),
    nearArbitrage: enriched.filter(i => i.metalData?.isNearArbitrage),
    goldPricePerGram: Math.round(gold*100)/100,
    platinumPricePerGram: Math.round(platinum*100)/100,
    platforms: Object.keys(byP),
    timestamp: new Date().toISOString(),
  };
}

// ── CACHE ─────────────────────────────────────────────────────
const cache = new Map();
const getCached = k => { const e=cache.get(k); return e&&Date.now()-e.ts<15*60*1000?e.d:null; };
const setCache = (k,d) => cache.set(k,{d,ts:Date.now()});

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.get('/api/search', async(req,res) => {
  const q = req.query.q?.trim();
  if(!q) return res.status(400).json({error:'?q= richiesto'});
  const cached=getCached(q); if(cached) return res.json({...cached,fromCache:true});
  try { const d=await searchAll(q); setCache(q,d); res.json(d); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/metals', async(req,res) => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  res.json({
    gold: gold?Math.round(gold*100)/100:null,
    platinum: platinum?Math.round(platinum*100)/100:null,
    goldPerOz: gold?Math.round(gold*31.1035):null,
    platinumPerOz: platinum?Math.round(platinum*31.1035):null,
    goldHistory: db.goldPrices.slice(-48).reverse(),
    platinumHistory: db.platinumPrices.slice(-48).reverse(),
  });
});

// Compatibilità con vecchio endpoint
app.get('/api/gold-price', async(req,res) => {
  const p=await getGoldPrice().catch(()=>null);
  res.json({pricePerGram:p?Math.round(p*100)/100:null, history:db.goldPrices.slice(-48).reverse()});
});

app.get('/api/gold-scan', (req,res) => {
  res.json({message:'Scansione avviata', queries:GOLD_QUERIES.length, platforms:8});
  runGoldScan().catch(e=>console.error('[GOLD SCAN]',e.message));
});

app.get('/api/arbitrage', (req,res) => {
  const all = [...db.arbitrage, ...db.nearArbitrage]
    .sort((a,b) => b.diffPct-a.diffPct);
  res.json(all.slice(0,100));
});
app.get('/api/arbitrage/real', (req,res) => res.json([...db.arbitrage].sort((a,b)=>b.diffPct-a.diffPct)));
app.get('/api/arbitrage/near', (req,res) => res.json([...db.nearArbitrage].sort((a,b)=>b.diffPct-a.diffPct)));

// Discovery
app.get('/api/discovery/scan', (req,res) => {
  res.json({message:'Scansione discovery avviata', brands:SEED_BRANDS.length});
  runDiscoveryScan().catch(()=>{});
});

app.get('/api/discovery', (req,res) => {
  const results = db.discoveries.length > 0 ? db.discoveries : SEED_BRANDS.map(b => ({
    brand: b,
    emergingScore: { score: 50, windowLabel: '— Non ancora analizzato', thesis: 'Avvia una scansione per vedere l\'analisi completa.', keySignal: '—', breakdown:{} },
    signals: {},
    analyzedAt: null,
  }));
  res.json(results);
});

app.get('/api/discovery/alerts', (req,res) => res.json(db.discoveryAlerts.slice(-50)));

// Watchlist
app.get('/api/watchlist', (req,res) => res.json(db.watchlist.filter(w=>w.active)));
app.post('/api/watchlist', (req,res) => {
  const {query,threshold,email,telegramChatId}=req.body;
  if(!query) return res.status(400).json({error:'query richiesta'});
  const r={id:nid(),query,threshold:threshold||null,email:email||null,telegram_chat_id:telegramChatId||process.env.TELEGRAM_CHAT_ID||null,active:true,created_at:new Date().toISOString()};
  db.watchlist.push(r); res.json(r);
});
app.delete('/api/watchlist/:id', (req,res) => {
  const item=db.watchlist.find(w=>w.id===parseInt(req.params.id));
  if(item) item.active=false;
  res.json({ok:true});
});

// Portfolio
app.get('/api/portfolio', (req,res) => res.json(db.portfolio.filter(p=>p.active)));
app.post('/api/portfolio', (req,res) => {
  const r={id:nid(),active:true,created_at:new Date().toISOString(),...req.body};
  db.portfolio.push(r); res.json(r);
});
app.delete('/api/portfolio/:id', (req,res) => {
  const item=db.portfolio.find(p=>p.id===parseInt(req.params.id));
  if(item) item.active=false;
  res.json({ok:true});
});
app.get('/api/portfolio/summary', (req,res) => {
  const items=db.portfolio.filter(p=>p.active);
  res.json({totalCost:items.reduce((s,i)=>s+(parseFloat(i.purchasePrice||i.purchase_price)||0),0),itemCount:items.length});
});

app.get('/api/alerts', (req,res) => res.json(db.alerts.slice(-50).reverse()));

app.post('/api/telegram/test', (req,res) => {
  tg(
    `⌚ <b>PriceRadar v10 — Test OK!</b> 🟢\n\n` +
    `Sistema attivo:\n` +
    `🥇 Arbitraggio oro 18k (pesi precisi)\n` +
    `🔘 Arbitraggio platino\n` +
    `💛 Alert orologi trattabili\n` +
    `🔭 Discovery engine autonomo\n` +
    `🏪 8 piattaforme monitorate`,
    req.body.chatId
  );
  res.json({ok:true});
});

app.get('/api/status', async(req,res) => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  res.json({
    status:'online', version:'10.0',
    goldPricePerGram:gold?Math.round(gold*100)/100:null,
    platinumPricePerGram:platinum?Math.round(platinum*100)/100:null,
    arbitrageFound:db.arbitrage.length,
    nearArbitrageFound:db.nearArbitrage.length,
    brandsAnalyzed:db.discoveries.length,
    discoveryAlerts:db.discoveryAlerts.length,
    watchlist:db.watchlist.filter(w=>w.active).length,
    portfolio:db.portfolio.filter(p=>p.active).length,
    goldQueries:GOLD_QUERIES.length,
    indieBrands:SEED_BRANDS.length,
    ebayConfigured:!!(process.env.EBAY_CLIENT_ID),
    telegramConfigured:!!(process.env.TELEGRAM_TOKEN),
    emailConfigured:!!(process.env.SMTP_USER),
    uptime:Math.floor(process.uptime()),
  });
});

// ── CRON ─────────────────────────────────────────────────────
// Oro ogni 2 ore
cron.schedule('0 */2 * * *', () => { runGoldScan().catch(()=>{}); });

// Discovery ogni 12 ore
cron.schedule('0 */12 * * *', () => { runDiscoveryScan().catch(()=>{}); });

// Watchlist ogni 30 min
cron.schedule('*/30 * * * *', async() => {
  for (const item of db.watchlist.filter(w=>w.active)) {
    try {
      await sleep(2000);
      const data=await searchAll(item.query);
      if(item.threshold&&data.lowest&&data.lowest.priceEur<=parseFloat(item.threshold)){
        const recent=db.alerts.find(a=>a.wid===item.id&&Date.now()-new Date(a.at).getTime()<2*3600000);
        if(!recent){
          await tg(`🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${data.lowest.priceEur.toLocaleString('it-IT')} su ${data.lowest.platform}\n<a href="${data.lowest.url}">→ VEDI</a>`,item.telegram_chat_id);
          db.alerts.push({id:nid(),wid:item.id,price:data.lowest.priceEur,at:new Date().toISOString()});
        }
      }
      cache.delete(item.query);
    } catch {}
  }
});

// ── AVVIO ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async() => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║     ⌚ Watch Price Bot v10 — Online       ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  Oro:     €${(gold||0).toFixed(2)}/g                      ║`);
  console.log(`║  Platino: €${(platinum||0).toFixed(2)}/g                      ║`);
  console.log(`║  Query oro: ${GOLD_QUERIES.length} | Piattaforme: 8        ║`);
  console.log(`║  Brand indie: ${SEED_BRANDS.length}                         ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  if(process.env.TELEGRAM_TOKEN&&process.env.TELEGRAM_CHAT_ID){
    await tg(
      `✅ <b>PriceRadar v10 Online!</b>\n\n` +
      `🥇 Oro: €${gold?.toFixed(2)||'N/A'}/g\n` +
      `🔘 Platino: €${platinum?.toFixed(2)||'N/A'}/g\n\n` +
      `<b>Novità v10:</b>\n` +
      `• Pesi precisi da schede tecniche ufficiali\n` +
      `• Discovery autonoma (nessun brand da suggerire)\n` +
      `• Emerging Score algoritmo proprietario\n` +
      `• Alert orologi trattabili (entro 15% dal valore)\n` +
      `• Da €500 in su — oro 18k e platino\n\n` +
      `Prima scansione in 60 secondi...`
    );
  }

  setTimeout(()=>runGoldScan().catch(()=>{}), 60000);
  setTimeout(()=>runDiscoveryScan().catch(()=>{}), 10*60*1000);
});
