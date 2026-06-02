/**
 * Watch Price Bot v9.1
 * 
 * Arbitraggio oro su 10 piattaforme:
 * Chrono24, eBay, Catawiki, Subito.it, Leboncoin, Vestiaire,
 * WatchBox, Watchfinder, Ricardo.ch, Chrono24 DE/FR/CH
 * 
 * Alert anche per orologi VICINO al valore oro (entro 15%)
 * = trattabili con una buona offerta
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── DATABASE IN MEMORIA ───────────────────────────────────────
let db = {
  watchlist: [], arbitrage: [], near_arbitrage: [],
  indie_alerts: [], gold_prices: [], alerts: [],
  portfolio: [], price_history: [],
};
let _id = Date.now();
const nid = () => ++_id;

// ── PREZZO ORO ────────────────────────────────────────────────
let cachedGold = null, goldFetched = 0;
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
      db.gold_prices.push({ price: g, at: new Date().toISOString() });
      if (db.gold_prices.length > 48) db.gold_prices = db.gold_prices.slice(-48);
      return g;
    }
  } catch {}
  return cachedGold || 78.5;
}

// Peso oro stimato per modello
function estimateGoldGrams(title) {
  const t = (title || '').toLowerCase();
  // Modelli noti
  if (t.includes('day-date 40')) return 36.45;
  if (t.includes('day-date 36') || t.includes('day-date 34')) return 33.15;
  if (t.includes('daytona')) return 37.58;
  if (t.includes('submariner') && (t.includes('gold') || t.includes('oro') || t.includes('750') || t.includes('18k'))) return 41.78;
  if (t.includes('gmt') && (t.includes('gold') || t.includes('oro'))) return 39.23;
  if (t.includes('sky-dweller')) return 44.10;
  if (t.includes('nautilus') && (t.includes('gold') || t.includes('oro'))) return 64.50;
  if (t.includes('aquanaut') && (t.includes('gold') || t.includes('oro'))) return 43.50;
  if (t.includes('royal oak') && (t.includes('gold') || t.includes('oro'))) return 60;
  if (t.includes('santos')) return 31.50;
  if (t.includes('tank') && (t.includes('gold') || t.includes('or') || t.includes('oro'))) return 22.50;
  if (t.includes('ballon') || t.includes('balloon')) return 28.50;
  if (t.includes('speedmaster') && (t.includes('gold') || t.includes('oro'))) return 33;
  if (t.includes('seamaster') && (t.includes('gold') || t.includes('oro'))) return 31.50;
  if (t.includes('constellation') && (t.includes('gold') || t.includes('oro'))) return 27;
  if (t.includes('reverso') && (t.includes('gold') || t.includes('or') || t.includes('oro'))) return 22.50;
  if (t.includes('altiplano') && (t.includes('gold') || t.includes('or'))) return 19.50;
  if (t.includes('lange') || t.includes('saxonia') || t.includes('datograph')) return 28;
  if (t.includes('calatrava') && (t.includes('gold') || t.includes('or'))) return 30;
  if (t.includes('pocket watch') || t.includes('orologio da tasca') || t.includes('gousset')) return 40;
  if (t.includes('vintage') && t.match(/\b(32|33|34|35|36)\b/)) return 18;
  if (t.match(/\b(42|43|44|45|46|47|48)\b/)) return 42;
  if (t.match(/\b(38|39|40|41)\b/)) return 32;
  if (t.match(/\b(32|33|34|35|36)\b/)) return 22;
  return 26; // default conservativo
}

function calcGoldData(title, priceEur, goldPricePerGram) {
  const goldGrams = estimateGoldGrams(title);
  const goldValue = Math.round(goldGrams * goldPricePerGram);
  const diff = goldValue - priceEur;
  const diffPct = Math.round((diff / goldValue) * 1000) / 10;
  return {
    goldGrams, goldValue, diff, diffPct,
    isArbitrage: priceEur < goldValue,        // sotto valore oro = affare
    isNearArbitrage: diffPct > -15 && diffPct <= 0, // entro 15% sopra = trattabile
    label: diffPct > 0
      ? `🥇 −${diffPct}% sotto valore oro`
      : diffPct > -15
        ? `💛 ${Math.abs(diffPct)}% sopra oro — trattabile`
        : `📊 ${Math.abs(diffPct)}% sopra oro`,
  };
}

// Parole chiave oro 18k in tutte le lingue
const GOLD_KEYWORDS = [
  '18k','18kt','18 karat','18 carati','18 carats',
  'oro 18','or 18','gold 18','gelbgold','rotgold','weissgold',
  'yellow gold','rose gold','white gold','solid gold',
  'oro giallo','oro rosa','oro bianco','oro massiccio',
  'or jaune','or rose','or blanc',
  '750','au750','18ct',
  'everose','sedna','moonshine','goldtech','cermet',
];
function isGoldWatch(title) {
  const t = (title || '').toLowerCase();
  return GOLD_KEYWORDS.some(k => t.includes(k));
}

// Query di ricerca per oro
const GOLD_QUERIES = [
  // Italiano
  'orologio oro 18k', 'orologio oro 18 carati', 'orologio oro giallo',
  'orologio oro rosa', 'orologio 750 oro', 'orologio vintage oro',
  'orologio tasca oro 18k',
  // Inglese
  'watch 18k gold', 'watch yellow gold 18k', 'watch rose gold 18k',
  'watch white gold 18k', 'pocket watch gold 18k',
  // Francese
  'montre or 18k', 'montre or jaune 18k', 'montre gousset or',
  // Tedesco
  'uhr 18 karat gold', 'uhr gelbgold',
  // Marche generiche
  'rolex oro', 'patek or', 'cartier gold', 'omega gold 18k',
  'vacheron or', 'jaeger gold', 'breguet or',
  // Vintage
  'vintage watch gold', 'orologio vintage 750', 'montre vintage or',
  // Pocket watch
  'pocket watch gold', 'savonnette or',
];

// ── INDIE FOMO BRANDS ─────────────────────────────────────────
const INDIE_BRANDS = [
  { name: 'Czapek', queries: ['Czapek', 'Czapek Antarctique', 'Czapek Faubourg'], tier: 2, trend: 24 },
  { name: 'Akrivia', queries: ['Akrivia', 'Rexhep Rexhepi', 'AK-06', 'AK-08'], tier: 2, trend: 19 },
  { name: 'Simon Brette', queries: ['Simon Brette', 'Trilobe', 'Une Seconde Paris'], tier: 2, trend: 28 },
  { name: 'MING', queries: ['MING watch', 'MING 17', 'MING 19', 'MING 37'], tier: 3, trend: 22 },
  { name: 'Massena LAB', queries: ['Massena LAB', 'Uni-Racer Massena'], tier: 3, trend: 18 },
  { name: 'Kurono Tokyo', queries: ['Kurono Tokyo', 'Tetsuya Kurono'], tier: 3, trend: 19 },
  { name: 'Habring2', queries: ['Habring', 'Habring2', 'Doppel 3'], tier: 4, trend: 14 },
  { name: 'F.P. Journe', queries: ['FP Journe', 'F.P. Journe', 'Chronometre Souverain'], tier: 1, trend: 35 },
  { name: 'Voutilainen', queries: ['Voutilainen', 'Kari Voutilainen'], tier: 2, trend: 20 },
  { name: 'Raul Pages', queries: ['Raul Pages', 'Raul Pagès', 'Pegase Pages'], tier: 3, trend: 32 },
  { name: 'Baltic', queries: ['Baltic watch', 'Baltic HMS', 'Baltic Aquascaphe'], tier: 3, trend: 15 },
  { name: 'H. Moser', queries: ['H Moser', 'Streamliner Moser', 'Endeavour Moser'], tier: 2, trend: 12 },
  { name: 'MB&F', queries: ['MB&F', 'HM6', 'Legacy Machine MB'], tier: 1, trend: 22 },
  { name: 'De Bethune', queries: ['De Bethune', 'DB25', 'DB28'], tier: 1, trend: 18 },
  { name: 'Sartory Billard', queries: ['Sartory Billard', 'SB01', 'SB02'], tier: 4, trend: 20 },
];

// ── UTILS ─────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rUA = () => {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  ];
  return uas[Math.floor(Math.random() * uas.length)];
};
const parsePrice = t => parseFloat((t || '').replace(/[^\d,.]/g, '').replace(',', '.')) || 0;

let fxRates = { USD: 0.92, GBP: 1.17, CHF: 1.05 }, fxFetched = 0;
async function toEur(price, currency) {
  if (!price || currency === 'EUR') return price;
  if (Date.now() - fxFetched > 3600000) {
    try {
      const r = await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF', { timeout: 5000 });
      fxRates = { USD: 1/r.data.rates.USD, GBP: 1/r.data.rates.GBP, CHF: 1/r.data.rates.CHF };
      fxFetched = Date.now();
    } catch {}
  }
  return price * (fxRates[currency] || 1);
}

// ── TELEGRAM ─────────────────────────────────────────────────
async function sendTelegram(text, chatId) {
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

// ── EBAY ─────────────────────────────────────────────────────
let ebayToken = null, ebayExp = 0;
async function searchEbay(query) {
  if (!process.env.EBAY_CLIENT_ID) return [];
  try {
    if (!ebayToken || Date.now() >= ebayExp) {
      const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
      const r = await axios.post('https://api.ebay.com/identity/v1/oauth2/token',
        'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
        { headers: { Authorization: `Basic ${c}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      ebayToken = r.data.access_token; ebayExp = Date.now() + (r.data.expires_in - 60) * 1000;
    }
    const markets = ['EBAY_IT', 'EBAY_FR', 'EBAY_DE', 'EBAY_GB'];
    const results = [];
    for (const market of markets) {
      try {
        const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          params: { q: query, category_ids: '31387', sort: 'price', limit: 20, filter: 'price:[200..]' },
          headers: { Authorization: `Bearer ${ebayToken}`, 'X-EBAY-C-MARKETPLACE-ID': market }
        });
        const items = (r.data.itemSummaries || []).map(i => ({
          platform: `eBay ${market.replace('EBAY_','')}`,
          title: i.title, price: parseFloat(i.price?.value || 0),
          currency: i.price?.currency || 'EUR', url: i.itemWebUrl,
          location: i.itemLocation?.country,
        })).filter(i => i.price >= 200);
        results.push(...items);
        await sleep(300);
      } catch {}
    }
    return results;
  } catch(e) { console.error('[eBay]', e.message); return []; }
}

// ── CHRONO24 (IT, DE, FR, CH) ────────────────────────────────
async function searchChrono24(query, domain = 'it') {
  try {
    await sleep(1500 + Math.random() * 1000);
    const url = `https://www.chrono24.${domain}/search/index.htm?query=${encodeURIComponent(query)}&dosearch=true&searchType=fulltext&resultview=list`;
    const r = await axios.get(url, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9', Referer: `https://www.chrono24.${domain}/` },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-article-id], .article-item-container').each((i, el) => {
      if (i >= 15) return;
      const $el = $(el);
      const title = $el.find('.article-title, h3').first().text().trim();
      const price = parsePrice($el.find('.price, .js-price').first().text());
      const link = $el.find('a[href*="/watches/"]').first().attr('href');
      if (title && price >= 200) results.push({
        platform: `Chrono24`,
        title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.chrono24.${domain}${link}`) : url,
      });
    });
    return results;
  } catch(e) { console.error(`[Chrono24.${domain}]`, e.message); return []; }
}

// ── CATAWIKI ─────────────────────────────────────────────────
async function searchCatawiki(query) {
  try {
    await sleep(1200 + Math.random() * 800);
    const r = await axios.get(`https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="lot-card"], article[data-lot-id]').each((i, el) => {
      if (i >= 12) return;
      const $el = $(el);
      const title = $el.find('[class*="title"], h2, h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"], [class*="bid"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 200) results.push({
        platform: 'Catawiki', title, price, currency: 'EUR', isAuction: true,
        url: link ? (link.startsWith('http') ? link : `https://www.catawiki.com${link}`) : 'https://www.catawiki.com/en/c/80-watches',
      });
    });
    return results;
  } catch(e) { console.error('[Catawiki]', e.message); return []; }
}

// ── SUBITO.IT ─────────────────────────────────────────────────
async function searchSubito(query) {
  try {
    await sleep(1000 + Math.random() * 700);
    const url = `https://www.subito.it/annunci-italia/vendita/orologi-e-gioielli/?q=${encodeURIComponent(query)}`;
    const r = await axios.get(url, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9', Referer: 'https://www.subito.it/' },
      timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="item-card"], [class*="SmallCard"], article').each((i, el) => {
      if (i >= 12) return;
      const $el = $(el);
      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      const location = $el.find('[class*="location"], [class*="town"]').first().text().trim();
      if (title && price >= 200) results.push({
        platform: 'Subito.it', title, price, currency: 'EUR', isLocal: true,
        location, url: link ? (link.startsWith('http') ? link : `https://www.subito.it${link}`) : url,
      });
    });
    return results;
  } catch(e) { console.error('[Subito]', e.message); return []; }
}

// ── LEBONCOIN ─────────────────────────────────────────────────
async function searchLeboncoin(query) {
  try {
    await sleep(1500 + Math.random() * 800);
    const r = await axios.get(`https://www.leboncoin.fr/recherche?category=62&text=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'fr-FR,fr;q=0.9', Referer: 'https://www.leboncoin.fr/' },
      timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-qa-id="aditem_container"], [class*="styles_adCard"], [class*="AdCard"]').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('[data-qa-id="aditem_title"], [class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[data-qa-id="aditem_price"], [class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 200) results.push({
        platform: 'Leboncoin 🇫🇷', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.leboncoin.fr${link}`) : 'https://www.leboncoin.fr',
      });
    });
    return results;
  } catch(e) { console.error('[Leboncoin]', e.message); return []; }
}

// ── VESTIAIRE ─────────────────────────────────────────────────
async function searchVestiaire(query) {
  try {
    await sleep(1000 + Math.random() * 600);
    const r = await axios.get(`https://www.vestiairecollective.com/search/?q=${encodeURIComponent(query)}&universe=men&category=watches`, {
      headers: { 'User-Agent': rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="product-card"], [class*="ProductCard"]').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('[class*="title"], [class*="brand"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 200) results.push({
        platform: 'Vestiaire', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.vestiairecollective.com${link}`) : 'https://www.vestiairecollective.com',
      });
    });
    return results;
  } catch(e) { console.error('[Vestiaire]', e.message); return []; }
}

// ── WATCHFINDER (UK) ─────────────────────────────────────────
async function searchWatchfinder(query) {
  try {
    await sleep(1000 + Math.random() * 600);
    const r = await axios.get(`https://www.watchfinder.co.uk/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="watch-card"], [class*="WatchCard"], article').each((i, el) => {
      if (i >= 8) return;
      const $el = $(el);
      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price >= 200) results.push({
        platform: 'Watchfinder 🇬🇧', title, price, currency: 'GBP',
        url: link ? (link.startsWith('http') ? link : `https://www.watchfinder.co.uk${link}`) : 'https://www.watchfinder.co.uk',
      });
    });
    return results;
  } catch(e) { console.error('[Watchfinder]', e.message); return []; }
}

// ── RICERCA COMPLETA ─────────────────────────────────────────
async function searchAll(query) {
  const goldPrice = await getGoldPrice();
  const [c24, ebay, catawiki, subito, leboncoin, vestiaire] = await Promise.allSettled([
    searchChrono24(query, 'it'),
    searchEbay(query),
    searchCatawiki(query),
    searchSubito(query),
    searchLeboncoin(query),
    searchVestiaire(query),
  ]);
  const all = [
    ...(c24.status === 'fulfilled' ? c24.value : []),
    ...(ebay.status === 'fulfilled' ? ebay.value : []),
    ...(catawiki.status === 'fulfilled' ? catawiki.value : []),
    ...(subito.status === 'fulfilled' ? subito.value : []),
    ...(leboncoin.status === 'fulfilled' ? leboncoin.value : []),
    ...(vestiaire.status === 'fulfilled' ? vestiaire.value : []),
  ];
  const enriched = await Promise.all(all.map(async item => {
    const priceEur = Math.round(await toEur(item.price, item.currency));
    const isGold = isGoldWatch(item.title);
    const goldData = isGold ? calcGoldData(item.title, priceEur, goldPrice) : null;
    return { ...item, priceEur, isGold, goldData };
  }));
  enriched.sort((a, b) => a.priceEur - b.priceEur);
  const byP = {};
  for (const i of enriched) if (!byP[i.platform] || i.priceEur < byP[i.platform].priceEur) byP[i.platform] = i;
  return {
    query, results: Object.values(byP).sort((a,b)=>a.priceEur-b.priceEur),
    allListings: enriched, lowest: enriched[0] || null,
    arbitrage: enriched.filter(i => i.goldData?.isArbitrage),
    nearArbitrage: enriched.filter(i => i.goldData?.isNearArbitrage),
    goldPricePerGram: Math.round(goldPrice * 100) / 100,
    platforms: Object.keys(byP),
    timestamp: new Date().toISOString(),
  };
}

// ── SCANSIONE ORO ─────────────────────────────────────────────
async function scanGoldArbitrage() {
  const goldPrice = await getGoldPrice();
  console.log(`\n[GOLD SCAN v9.1] Oro: €${goldPrice.toFixed(2)}/g — ${GOLD_QUERIES.length} query × 6 piattaforme`);
  let foundArb = 0, foundNear = 0;

  for (const query of GOLD_QUERIES) {
    try {
      await sleep(3000 + Math.random() * 2000);

      // Cerca su tutte le piattaforme in parallelo
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
        ...(c24it.status === 'fulfilled' ? c24it.value : []),
        ...(c24de.status === 'fulfilled' ? c24de.value : []),
        ...(ebay.status === 'fulfilled' ? ebay.value : []),
        ...(catawiki.status === 'fulfilled' ? catawiki.value : []),
        ...(subito.status === 'fulfilled' ? subito.value : []),
        ...(leboncoin.status === 'fulfilled' ? leboncoin.value : []),
        ...(vestiaire.status === 'fulfilled' ? vestiaire.value : []),
        ...(watchfinder.status === 'fulfilled' ? watchfinder.value : []),
      ];

      for (const item of allItems) {
        if (!isGoldWatch(item.title)) continue;
        const priceEur = Math.round(await toEur(item.price, item.currency));
        if (priceEur < 200) continue;

        const gold = calcGoldData(item.title, priceEur, goldPrice);
        const existing = [...db.arbitrage, ...db.near_arbitrage].find(a => a.url === item.url);
        if (existing) continue;

        const entry = {
          id: nid(), platform: item.platform, title: item.title,
          price: priceEur, gold_value: gold.goldValue, gold_grams: gold.goldGrams,
          discount_pct: gold.diffPct, label: gold.label, url: item.url,
          location: item.location || '', is_auction: item.isAuction || false,
          is_local: item.isLocal || false, found_at: new Date().toISOString(),
        };

        if (gold.isArbitrage) {
          // SOTTO valore oro = arbitraggio vero
          db.arbitrage.push(entry);
          foundArb++;
          const msg = `🥇 <b>ARBITRAGGIO ORO!</b>\n\n` +
            `⌚ ${item.title?.slice(0, 65)}\n` +
            `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
            `💛 Valore oro: <b>€${gold.goldValue.toLocaleString('it-IT')}</b> (${gold.goldGrams}g)\n` +
            `📉 <b>−${gold.diffPct}% sotto valore oro!</b>\n` +
            `🏪 ${item.platform}${item.location ? ` · 📍 ${item.location}` : ''}\n\n` +
            `<a href="${item.url}">👉 VEDI ANNUNCIO</a>`;
          await sendTelegram(msg);
          console.log(`[ARB] ${item.title?.slice(0,40)} €${priceEur} vs oro €${gold.goldValue} (−${gold.diffPct}%)`);
        } else if (gold.isNearArbitrage) {
          // VICINO al valore oro = trattabile
          db.near_arbitrage.push(entry);
          foundNear++;
          const msg = `💛 <b>TRATTABILE — vicino al valore oro</b>\n\n` +
            `⌚ ${item.title?.slice(0, 65)}\n` +
            `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
            `💛 Valore oro: <b>€${gold.goldValue.toLocaleString('it-IT')}</b> (${gold.goldGrams}g)\n` +
            `📊 Solo ${Math.abs(gold.diffPct)}% sopra il valore oro puro\n` +
            `💡 Con uno sconto del ${Math.ceil(Math.abs(gold.diffPct)+2)}% diventa arbitraggio\n` +
            `🏪 ${item.platform}${item.location ? ` · 📍 ${item.location}` : ''}\n\n` +
            `<a href="${item.url}">👉 VEDI ANNUNCIO</a>`;
          await sendTelegram(msg);
          console.log(`[NEAR] ${item.title?.slice(0,40)} €${priceEur} vs oro €${gold.goldValue} (+${Math.abs(gold.diffPct)}%)`);
        }
      }
    } catch(e) { console.error(`[SCAN] ${query}:`, e.message); }
  }

  // Mantieni solo ultimi 300
  if (db.arbitrage.length > 200) db.arbitrage = db.arbitrage.slice(-200);
  if (db.near_arbitrage.length > 200) db.near_arbitrage = db.near_arbitrage.slice(-200);

  console.log(`[GOLD SCAN] Completata: ${foundArb} arbitraggi, ${foundNear} trattabili`);

  // Riepilogo su Telegram
  if (foundArb + foundNear > 0) {
    await sendTelegram(
      `✅ <b>Scansione completata</b>\n\n` +
      `🥇 Arbitraggi trovati: <b>${foundArb}</b>\n` +
      `💛 Trattabili trovati: <b>${foundNear}</b>\n` +
      `💰 Oro spot: €${goldPrice.toFixed(2)}/g`
    );
  } else {
    await sendTelegram(
      `🔍 <b>Scansione completata</b>\n` +
      `Nessun arbitraggio trovato in questo ciclo.\n` +
      `Oro spot: €${goldPrice.toFixed(2)}/g\n` +
      `Prossima scansione tra 2 ore.`
    );
  }

  return { foundArb, foundNear };
}

// ── INDIE SCAN ────────────────────────────────────────────────
async function scanIndie() {
  for (const brand of INDIE_BRANDS) {
    try {
      await sleep(3000);
      const r = await axios.get(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(brand.name)}&sort=top&t=month&limit=15`,
        { headers: { 'User-Agent': 'WatchPriceBot/9.1' }, timeout: 10000 }
      );
      const posts = (r.data?.data?.children || []).filter(p =>
        ['Watches','WatchExchange','VintageWatches','WatchHorology','independentwatches'].includes(p.data.subreddit)
      );
      const recent = posts.filter(p => (Date.now() - p.data.created_utc * 1000) < 30 * 86400000);
      const ups = posts.reduce((s, p) => s + p.data.ups, 0);
      const score = Math.min((posts.length * 10) + (ups / 100) + (recent.length * 15) + (brand.trend * 1.5), 100);

      if (score >= 55 && recent.length >= 2) {
        const existing = db.indie_alerts.find(a => a.brand === brand.name &&
          Date.now() - new Date(a.at).getTime() < 24 * 3600000);
        if (!existing) {
          db.indie_alerts.push({ brand: brand.name, score: Math.round(score), at: new Date().toISOString() });
          await sendTelegram(
            `📈 <b>INDIE FOMO ALERT</b>\n\n` +
            `⌚ <b>${brand.name}</b>\n` +
            `🔥 Score: ${Math.round(score)}/100\n` +
            `📊 Reddit: ${posts.length} post (${recent.length} recenti)\n` +
            `📈 Trend storico: +${brand.trend}%/anno\n\n` +
            `Opportunità di acquisto ancora aperta.`
          );
        }
      }
    } catch {}
  }
}

// ── CACHE ─────────────────────────────────────────────────────
const cache = new Map();
const getCached = k => { const e = cache.get(k); return e && Date.now() - e.ts < 15*60*1000 ? e.d : null; };
const setCache = (k, d) => cache.set(k, { d, ts: Date.now() });

// ── API ROUTES ────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: '?q= richiesto' });
  const cached = getCached(q); if (cached) return res.json({ ...cached, fromCache: true });
  try { const d = await searchAll(q); setCache(q, d); res.json(d); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gold-price', async (req, res) => {
  const p = await getGoldPrice().catch(() => null);
  res.json({ pricePerGram: p ? Math.round(p*100)/100 : null, history: db.gold_prices.slice(-48).reverse() });
});

app.get('/api/gold-scan', (req, res) => {
  res.json({ message: 'Scansione avviata', queries: GOLD_QUERIES.length, platforms: 8 });
  scanGoldArbitrage().catch(e => console.error('[SCAN]', e.message));
});

app.get('/api/arbitrage', (req, res) => {
  const all = [...db.arbitrage, ...db.near_arbitrage]
    .sort((a, b) => b.discount_pct - a.discount_pct);
  res.json(all.slice(0, 100));
});

app.get('/api/arbitrage/real', (req, res) => res.json([...db.arbitrage].sort((a,b)=>b.discount_pct-a.discount_pct)));
app.get('/api/arbitrage/near', (req, res) => res.json([...db.near_arbitrage].sort((a,b)=>b.discount_pct-a.discount_pct)));

app.get('/api/indie-scan', (req, res) => {
  res.json({ message: 'Scansione indie avviata' });
  scanIndie().catch(() => {});
});

app.get('/api/indie', (req, res) => res.json(INDIE_BRANDS.map(b => ({
  ...b, recentAlert: db.indie_alerts.find(a => a.brand === b.name),
}))));

app.get('/api/watchlist', (req, res) => res.json(db.watchlist.filter(w => w.active)));
app.post('/api/watchlist', (req, res) => {
  const { query, threshold, email, telegramChatId } = req.body;
  if (!query) return res.status(400).json({ error: 'query richiesta' });
  const r = { id: nid(), query, threshold: threshold || null, email: email || null,
    telegram_chat_id: telegramChatId || process.env.TELEGRAM_CHAT_ID || null,
    active: true, created_at: new Date().toISOString() };
  db.watchlist.push(r); res.json(r);
});
app.delete('/api/watchlist/:id', (req, res) => {
  const item = db.watchlist.find(w => w.id === parseInt(req.params.id));
  if (item) item.active = false;
  res.json({ ok: true });
});

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
  res.json({ totalCost: items.reduce((s,i)=>s+(parseFloat(i.purchasePrice||i.purchase_price)||0),0), itemCount: items.length });
});

app.get('/api/alerts', (req, res) => res.json(db.alerts.slice(-50).reverse()));

app.post('/api/telegram/test', (req, res) => {
  sendTelegram('⌚ <b>PriceRadar v9.1</b> — Test OK! 🟢\n\nIl bot monitora:\n🥇 Arbitraggio oro (8 piattaforme)\n💛 Orologi trattabili (vicino al valore oro)\n📈 Indie FOMO', req.body.chatId);
  res.json({ ok: true });
});

app.get('/api/status', async (req, res) => {
  const gp = await getGoldPrice().catch(() => null);
  res.json({
    status: 'online', version: '9.1',
    platforms: ['Chrono24 IT', 'Chrono24 DE', 'eBay IT/FR/DE/GB', 'Catawiki', 'Subito.it', 'Leboncoin', 'Vestiaire', 'Watchfinder'],
    goldPricePerGram: gp ? Math.round(gp * 100) / 100 : null,
    arbitrageFound: db.arbitrage.length,
    nearArbitrageFound: db.near_arbitrage.length,
    watchlist: db.watchlist.filter(w => w.active).length,
    portfolio: db.portfolio.filter(p => p.active).length,
    goldQueries: GOLD_QUERIES.length,
    indieBrands: INDIE_BRANDS.length,
    ebayConfigured: !!(process.env.EBAY_CLIENT_ID),
    telegramConfigured: !!(process.env.TELEGRAM_TOKEN),
    emailConfigured: !!(process.env.SMTP_USER),
    uptime: Math.floor(process.uptime()),
  });
});

// ── CRON ─────────────────────────────────────────────────────
cron.schedule('0 */2 * * *', async () => {
  console.log('[CRON] Scansione oro...');
  await scanGoldArbitrage().catch(e => console.error('[CRON]', e.message));
});
cron.schedule('0 */6 * * *', async () => {
  await scanIndie().catch(() => {});
});
cron.schedule('*/30 * * * *', async () => {
  for (const item of db.watchlist.filter(w => w.active)) {
    try {
      await sleep(2000);
      const data = await searchAll(item.query);
      if (item.threshold && data.lowest && data.lowest.priceEur <= parseFloat(item.threshold)) {
        const recent = db.alerts.find(a => a.watchlist_id === item.id && Date.now() - new Date(a.at).getTime() < 2*3600000);
        if (!recent) {
          await sendTelegram(`🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${data.lowest.priceEur.toLocaleString('it-IT')} su ${data.lowest.platform}\n<a href="${data.lowest.url}">→ VEDI</a>`, item.telegram_chat_id);
          db.alerts.push({ id: nid(), watchlist_id: item.id, price: data.lowest.priceEur, at: new Date().toISOString() });
        }
      }
      cache.delete(item.query);
    } catch {}
  }
});

// ── AVVIO ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  const gp = await getGoldPrice().catch(() => null);
  console.log(`\n⌚ Watch Price Bot v9.1 — porta ${PORT}`);
  console.log(`   Oro: €${gp?.toFixed(2)||'N/A'}/g | ${GOLD_QUERIES.length} query | 8 piattaforme`);
  console.log(`   eBay: ${process.env.EBAY_CLIENT_ID?'✓':'✗'} | TG: ${process.env.TELEGRAM_TOKEN?'✓':'✗'}\n`);

  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await sendTelegram(
      `✅ <b>PriceRadar v9.1 Online!</b>\n\n` +
      `🥇 Oro spot: €${gp?.toFixed(2)||'N/A'}/g\n` +
      `🔍 ${GOLD_QUERIES.length} query oro su 8 piattaforme\n` +
      `💛 Alert anche per orologi TRATTABILI (entro 15% dal valore oro)\n` +
      `📈 ${INDIE_BRANDS.length} brand indie monitorati\n\n` +
      `Prima scansione tra 30 secondi...`
    );
  }

  // Prima scansione all'avvio
  setTimeout(() => scanGoldArbitrage().catch(() => {}), 30000);
  setTimeout(() => scanIndie().catch(() => {}), 8 * 60 * 1000);
});
