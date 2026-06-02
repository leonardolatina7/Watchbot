/**
 * Watch Price Bot v9
 * 
 * Strategia 1: ARBITRAGGIO ORO — qualsiasi marca, qualsiasi prezzo
 *   Cerca "orologio oro 18k", "montre or 18k", "watch gold 18k" ecc.
 *   Su: Chrono24, eBay, Catawiki, Subito, Leboncoin, Ricardo, Vestiaire, Facebook
 * 
 * Strategia 2: INDIE FOMO — orologi indipendenti con sentiment crescente
 *   Czapek, Akrivia/Rexhep, Simon Brette, MING, Massena LAB ecc.
 *   Monitor: Reddit, YouTube, Instagram, Hodinkee RSS
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
  watchlist: [],
  arbitrage: [],
  indie_alerts: [],
  gold_prices: [],
  alerts: [],
  portfolio: [],
  price_history: [],
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

// Calcola valore oro in base al peso
// Per orologi generici usiamo stime conservative per cassa 18k
function estimateGoldValue(title, priceEur, goldPricePerGram) {
  const t = (title || '').toLowerCase();
  
  // Grammi stimati di oro puro (75% di 18k) in base alle dimensioni
  let goldGrams = 25; // default conservativo
  
  // Orologi grandi (>40mm) hanno più oro
  if (t.match(/\b(42|43|44|45|46|47|48)\b/)) goldGrams = 40;
  else if (t.match(/\b(38|39|40|41)\b/)) goldGrams = 30;
  else if (t.match(/\b(32|33|34|35|36)\b/)) goldGrams = 20;
  
  // Modelli noti con pesi precisi
  const knownModels = {
    'day-date 40': 36.45, 'day-date 36': 33.15, 'daytona': 37.58,
    'submariner': 41.78, 'gmt-master': 39.23, 'sky-dweller': 44.10,
    'nautilus': 64.50, 'aquanaut': 43.50, 'royal oak': 60,
    'santos': 31.50, 'tank': 22.50, 'ballon bleu': 28.50,
    'seamaster': 31.50, 'constellation': 27, 'speedmaster': 33,
    'reverso': 22.50, 'altiplano': 19.50,
  };
  
  for (const [model, grams] of Object.entries(knownModels)) {
    if (t.includes(model)) { goldGrams = grams; break; }
  }
  
  const goldValue = goldGrams * goldPricePerGram;
  const isArbitrage = priceEur < goldValue;
  const discountPct = Math.round(((goldValue - priceEur) / goldValue) * 1000) / 10;
  
  return { goldGrams, goldValue: Math.round(goldValue), isArbitrage, discountPct };
}

// Parole chiave oro 18k in tutte le lingue
const GOLD_KEYWORDS = [
  // Italiano
  'oro 18', '18 carati', 'oro giallo', 'oro rosa', 'oro bianco', 'oro massiccio',
  // Inglese
  '18k', '18kt', '18 karat', 'yellow gold', 'rose gold', 'white gold', 'solid gold',
  // Francese (Leboncoin)
  'or jaune', 'or rose', 'or blanc', 'or 18', '18 carats',
  // Tedesco (Ricardo)
  'gelbgold', 'rotgold', 'weissgold', '18 karat gold',
  // Codice orafo
  '750', 'au750',
  // Marche specifiche con oro
  'everose', 'sedna', 'moonshine', 'goldtech',
];

function isGoldWatch(title) {
  const t = (title || '').toLowerCase();
  return GOLD_KEYWORDS.some(k => t.includes(k.toLowerCase()));
}

// ── QUERY DI RICERCA ORO ──────────────────────────────────────
// Generico — trova QUALSIASI orologio in oro a qualsiasi prezzo
const GOLD_SEARCH_QUERIES = [
  // Italiano
  'orologio oro 18k', 'orologio oro 18 carati', 'orologio oro giallo',
  'orologio oro rosa', 'orologio oro bianco', 'orologio 750',
  // Inglese
  'watch gold 18k', 'watch yellow gold', 'watch rose gold', 'watch white gold',
  // Francese
  'montre or 18k', 'montre or jaune', 'montre or rose',
  // Modelli specifici oro (tutte le marche)
  'rolex gold', 'patek gold', 'cartier gold', 'omega gold', 'breguet gold',
  'vacheron gold', 'jaeger gold', 'audemars gold', 'iwc gold', 'breitling gold',
  // Vintage oro
  'vintage watch gold 18k', 'orologio vintage oro', 'montre vintage or',
  // Pocket watch oro
  'orologio tasca oro', 'pocket watch gold', 'montre gousset or',
];

// ── INDIE FOMO BRANDS ─────────────────────────────────────────
const INDIE_BRANDS = [
  { name: 'Czapek', queries: ['Czapek', 'Czapek Place Vendome', 'Czapek Antarctique', 'Czapek Faubourg'], tier: 2, trend: 24 },
  { name: 'Akrivia', queries: ['Akrivia', 'Rexhep Rexhepi', 'AK-06', 'AK-08'], tier: 2, trend: 19 },
  { name: 'Simon Brette', queries: ['Simon Brette', 'Trilobe', 'Une Seconde Paris'], tier: 2, trend: 28 },
  { name: 'MING', queries: ['MING watch', 'Ming Thein watch', 'MING 17', 'MING 19', 'MING 37'], tier: 3, trend: 22 },
  { name: 'Massena LAB', queries: ['Massena LAB', 'William Massena', 'Uni-Racer'], tier: 3, trend: 18 },
  { name: 'Kurono Tokyo', queries: ['Kurono Tokyo', 'Tetsuya Kurono'], tier: 3, trend: 19 },
  { name: 'Habring2', queries: ['Habring', 'Habring2', 'Doppel 3'], tier: 4, trend: 14 },
  { name: 'F.P. Journe', queries: ['FP Journe', 'F.P. Journe', 'Chronometre Souverain', 'Resonance Journe'], tier: 1, trend: 35 },
  { name: 'Voutilainen', queries: ['Voutilainen', 'Kari Voutilainen', 'Vingt-8'], tier: 2, trend: 20 },
  { name: 'De Bethune', queries: ['De Bethune', 'DB25', 'DB28'], tier: 1, trend: 18 },
  { name: 'MB&F', queries: ['MB&F', 'HM3', 'HM6', 'Legacy Machine', 'LM1', 'LM2'], tier: 1, trend: 22 },
  { name: 'H. Moser', queries: ['H Moser', 'H. Moser', 'Streamliner', 'Endeavour Moser'], tier: 2, trend: 12 },
  { name: 'Raul Pages', queries: ['Raul Pages', 'Raul Pagès', 'Pegase Pages'], tier: 3, trend: 32 },
  { name: 'Baltic', queries: ['Baltic watch', 'Baltic HMS', 'Baltic Aquascaphe', 'Baltic Bicompax'], tier: 3, trend: 15 },
  { name: 'Sartory Billard', queries: ['Sartory Billard', 'SB01', 'SB02'], tier: 4, trend: 20 },
];

// ── UTILITÀ ───────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rUA = () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const parsePrice = t => parseFloat((t || '').replace(/[^\d,.]/g, '').replace(',', '.')) || 0;

let fxRates = { USD: 0.92, GBP: 1.17, CHF: 1.05, SEK: 0.087 }, fxFetched = 0;
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
const mailer = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || !to) return;
  mailer.sendMail({ from: `PriceRadar <${process.env.SMTP_USER}>`, to, subject, html }).catch(() => {});
}

// ── EBAY API ─────────────────────────────────────────────────
let ebayToken = null, ebayExp = 0;
async function searchEbay(query, minPrice = 200) {
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
    // Cerca in Italia e Europa
    const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params: { q: query, category_ids: '31387', sort: 'price', limit: 20, filter: `price:[${minPrice}..],priceCurrency:EUR` },
      headers: { Authorization: `Bearer ${ebayToken}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_IT' }
    });
    return (r.data.itemSummaries || []).map(i => ({
      platform: 'eBay', title: i.title,
      price: parseFloat(i.price?.value || 0), currency: i.price?.currency || 'EUR',
      url: i.itemWebUrl, location: i.itemLocation?.country,
    })).filter(i => i.price >= minPrice);
  } catch(e) { console.error('[eBay]', e.message); return []; }
}

// ── CHRONO24 ─────────────────────────────────────────────────
async function searchChrono24(query, minPrice = 200, maxPrice = 999999) {
  try {
    await sleep(800 + Math.random() * 700);
    const url = `https://www.chrono24.it/search/index.htm?query=${encodeURIComponent(query)}&dosearch=true&searchType=fulltext&resultview=list&priceFrom=${minPrice}&priceTo=${maxPrice}`;
    const r = await axios.get(url, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9', Referer: 'https://www.chrono24.it/' },
      timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-article-id], .article-item-container').each((i, el) => {
      if (i >= 12) return;
      const $el = $(el);
      const title = $el.find('.article-title, h3').first().text().trim();
      const price = parsePrice($el.find('.price, .js-price').first().text());
      const link = $el.find('a[href*="/watches/"]').first().attr('href');
      if (title && price >= minPrice) results.push({
        platform: 'Chrono24', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.chrono24.it${link}`) : url,
      });
    });
    return results.sort((a, b) => a.price - b.price);
  } catch(e) { console.error('[Chrono24]', e.message); return []; }
}

// ── CATAWIKI (aste europee) ───────────────────────────────────
async function searchCatawiki(query) {
  try {
    await sleep(1000 + Math.random() * 500);
    const r = await axios.get(`https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'en-GB,en;q=0.9' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="lot-card"], article[data-lot-id]').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('[class*="title"], h2, h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"], [class*="bid"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price > 100) results.push({
        platform: 'Catawiki', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.catawiki.com${link}`) : `https://www.catawiki.com/en/c/80-watches`,
        isAuction: true,
      });
    });
    return results;
  } catch(e) { console.error('[Catawiki]', e.message); return []; }
}

// ── SUBITO.IT ─────────────────────────────────────────────────
async function searchSubito(query) {
  try {
    await sleep(1000 + Math.random() * 500);
    const r = await axios.get(`https://www.subito.it/annunci-italia/vendita/orologi-e-gioielli/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="item-card"], [class*="listing"], article').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const priceText = $el.find('[class*="price"]').first().text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('a').first().attr('href');
      const location = $el.find('[class*="location"], [class*="town"]').first().text().trim();
      if (title && price > 100) results.push({
        platform: 'Subito.it', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.subito.it${link}`) : `https://www.subito.it`,
        location, isLocal: true,
      });
    });
    return results;
  } catch(e) { console.error('[Subito]', e.message); return []; }
}

// ── LEBONCOIN (Francia) ───────────────────────────────────────
async function searchLeboncoin(query) {
  try {
    await sleep(1200 + Math.random() * 500);
    const r = await axios.get(`https://www.leboncoin.fr/recherche?category=62&text=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'fr-FR,fr;q=0.9' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-qa-id="aditem_container"], [class*="styles_adCard"]').each((i, el) => {
      if (i >= 8) return;
      const $el = $(el);
      const title = $el.find('[data-qa-id="aditem_title"], [class*="title"]').first().text().trim();
      const priceText = $el.find('[data-qa-id="aditem_price"], [class*="price"]').first().text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('a').first().attr('href');
      if (title && price > 100) results.push({
        platform: 'Leboncoin', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.leboncoin.fr${link}`) : `https://www.leboncoin.fr`,
      });
    });
    return results;
  } catch(e) { console.error('[Leboncoin]', e.message); return []; }
}

// ── VESTIAIRE COLLECTIVE ──────────────────────────────────────
async function searchVestiaire(query) {
  try {
    await sleep(900 + Math.random() * 500);
    const r = await axios.get(`https://www.vestiairecollective.com/search/?q=${encodeURIComponent(query)}&universe=men&category=watches`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="product-card"], [class*="ProductCard"]').each((i, el) => {
      if (i >= 8) return;
      const $el = $(el);
      const title = $el.find('[class*="title"], [class*="brand"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title && price > 100) results.push({
        platform: 'Vestiaire', title, price, currency: 'EUR',
        url: link ? (link.startsWith('http') ? link : `https://www.vestiairecollective.com${link}`) : `https://www.vestiairecollective.com`,
      });
    });
    return results;
  } catch(e) { console.error('[Vestiaire]', e.message); return []; }
}

// ── REDDIT SENTIMENT ─────────────────────────────────────────
async function checkRedditSentiment(brandName) {
  try {
    await sleep(500);
    const r = await axios.get(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(brandName)}&sort=top&t=month&limit=15&type=link`,
      { headers: { 'User-Agent': 'WatchPriceBot/9.0' }, timeout: 10000 }
    );
    const posts = (r.data?.data?.children || []).filter(p =>
      ['Watches','WatchExchange','rolex','VintageWatches','WatchHorology','independentwatches'].includes(p.data.subreddit)
    );
    const totalUps = posts.reduce((s, p) => s + p.data.ups, 0);
    const recentPosts = posts.filter(p => (Date.now() - p.data.created_utc * 1000) < 30 * 86400000);
    return {
      totalPosts: posts.length, recentPosts: recentPosts.length,
      totalUpvotes: totalUps,
      buzzScore: Math.min((posts.length * 10) + (totalUps / 100) + (recentPosts.length * 15), 100),
      topPost: posts[0] ? { title: posts[0].data.title, upvotes: posts[0].data.ups, url: `https://reddit.com${posts[0].data.permalink}` } : null,
    };
  } catch { return { totalPosts: 0, buzzScore: 0 }; }
}

// ── RICERCA COMPLETA ARBITRAGGIO ORO ──────────────────────────
async function scanGoldArbitrage() {
  const goldPrice = await getGoldPrice();
  console.log(`[GOLD SCAN] Prezzo oro: €${goldPrice.toFixed(2)}/g`);
  const found = [];

  for (const query of GOLD_SEARCH_QUERIES) {
    try {
      await sleep(2000);
      const [ebay, chrono, catawiki, subito, leboncoin, vestiaire] = await Promise.allSettled([
        searchEbay(query, 200),
        searchChrono24(query, 200, 999999),
        searchCatawiki(query),
        searchSubito(query),
        searchLeboncoin(query),
        searchVestiaire(query),
      ]);

      const allItems = [
        ...(ebay.status === 'fulfilled' ? ebay.value : []),
        ...(chrono.status === 'fulfilled' ? chrono.value : []),
        ...(catawiki.status === 'fulfilled' ? catawiki.value : []),
        ...(subito.status === 'fulfilled' ? subito.value : []),
        ...(leboncoin.status === 'fulfilled' ? leboncoin.value : []),
        ...(vestiaire.status === 'fulfilled' ? vestiaire.value : []),
      ];

      for (const item of allItems) {
        if (!isGoldWatch(item.title)) continue;
        const priceEur = Math.round(await toEur(item.price, item.currency));
        const { goldGrams, goldValue, isArbitrage, discountPct } = estimateGoldValue(item.title, priceEur, goldPrice);

        if (isArbitrage && discountPct > 2) { // almeno 2% sotto il valore oro
          const existing = db.arbitrage.find(a => a.url === item.url);
          if (!existing) {
            const arb = {
              id: nid(), platform: item.platform, title: item.title,
              price: priceEur, gold_value: goldValue, gold_grams: goldGrams,
              discount_pct: discountPct, url: item.url,
              location: item.location || '', found_at: new Date().toISOString(),
            };
            db.arbitrage.push(arb);
            found.push(arb);

            const msg = `🥇 <b>ARBITRAGGIO ORO</b>\n\n` +
              `⌚ ${item.title?.slice(0, 60)}\n` +
              `💰 Prezzo: <b>€${priceEur.toLocaleString('it-IT')}</b>\n` +
              `💛 Valore oro: <b>€${goldValue.toLocaleString('it-IT')}</b> (${goldGrams}g)\n` +
              `📉 Sconto: <b>−${discountPct}%</b> sotto valore oro\n` +
              `🏪 ${item.platform}${item.location ? ` · ${item.location}` : ''}\n\n` +
              `<a href="${item.url}">👉 VEDI ANNUNCIO</a>`;

            await sendTelegram(msg);
            console.log(`[ARB] ${item.title?.slice(0, 40)} €${priceEur} vs €${goldValue} (−${discountPct}%)`);
          }
        }
      }
    } catch(e) { console.error(`[GOLD SCAN] ${query}:`, e.message); }
  }

  // Mantieni solo ultimi 200 arbitraggi
  if (db.arbitrage.length > 200) db.arbitrage = db.arbitrage.slice(-200);
  return found;
}

// ── INDIE FOMO SCAN ──────────────────────────────────────────
async function scanIndieOpportunities() {
  const results = [];

  for (const brand of INDIE_BRANDS) {
    try {
      await sleep(3000);

      // Check Reddit sentiment
      const reddit = await checkRedditSentiment(brand.name);

      // Cerca prezzi su Chrono24
      let lowestPrice = null;
      for (const q of brand.queries.slice(0, 2)) {
        const items = await searchChrono24(q, 500, 999999);
        if (items.length > 0 && (!lowestPrice || items[0].price < lowestPrice.price)) {
          lowestPrice = items[0];
        }
        await sleep(500);
      }

      // Hype score semplificato
      const hypeScore = Math.min(
        (reddit.buzzScore * 0.5) +
        (brand.trend * 1.5) +
        (reddit.recentPosts >= 3 ? 20 : 0),
        100
      );

      const result = {
        brand: brand.name, tier: brand.tier, trend: brand.trend,
        hypeScore: Math.round(hypeScore),
        reddit: { posts: reddit.totalPosts, upvotes: reddit.totalUpvotes, topPost: reddit.topPost },
        lowestPrice, scanned_at: new Date().toISOString(),
      };
      results.push(result);

      // Alert se hype alto
      if (hypeScore >= 60 && reddit.recentPosts >= 2) {
        const existing = db.indie_alerts.find(a => a.brand === brand.name &&
          Date.now() - new Date(a.at).getTime() < 24 * 3600000);
        if (!existing) {
          db.indie_alerts.push({ brand: brand.name, score: hypeScore, at: new Date().toISOString() });
          const msg = `📈 <b>INDIE FOMO ALERT</b>\n\n` +
            `⌚ <b>${brand.name}</b> — Tier ${brand.tier}\n` +
            `🔥 Hype Score: ${Math.round(hypeScore)}/100\n` +
            `📊 Reddit: ${reddit.totalPosts} post, ${reddit.totalUpvotes} upvotes\n` +
            `📈 Trend storico: +${brand.trend}%/anno\n` +
            (lowestPrice ? `💰 Prezzo minimo trovato: €${lowestPrice.price.toLocaleString('it-IT')}\n` : '') +
            (reddit.topPost ? `\n📝 "${reddit.topPost.title?.slice(0, 60)}"\n↑${reddit.topPost.upvotes} <a href="${reddit.topPost.url}">→</a>` : '');
          await sendTelegram(msg);
        }
      }

      console.log(`[INDIE] ${brand.name}: Hype ${Math.round(hypeScore)}/100, Reddit ${reddit.totalPosts} posts`);
    } catch(e) { console.error(`[INDIE] ${brand.name}:`, e.message); }
  }

  return results.sort((a, b) => b.hypeScore - a.hypeScore);
}

// ── RICERCA GENERICA ─────────────────────────────────────────
async function searchAll(query) {
  const [ebay, chrono, catawiki, subito, vestiaire] = await Promise.allSettled([
    searchEbay(query, 200),
    searchChrono24(query, 200, 999999),
    searchCatawiki(query),
    searchSubito(query),
    searchVestiaire(query),
  ]);
  const all = [
    ...(ebay.status === 'fulfilled' ? ebay.value : []),
    ...(chrono.status === 'fulfilled' ? chrono.value : []),
    ...(catawiki.status === 'fulfilled' ? catawiki.value : []),
    ...(subito.status === 'fulfilled' ? subito.value : []),
    ...(vestiaire.status === 'fulfilled' ? vestiaire.value : []),
  ];
  const goldPrice = await getGoldPrice();
  const enriched = await Promise.all(all.map(async item => {
    const priceEur = Math.round(await toEur(item.price, item.currency));
    const isGold = isGoldWatch(item.title);
    const goldData = isGold ? estimateGoldValue(item.title, priceEur, goldPrice) : null;
    return { ...item, priceEur, isGold, goldData };
  }));
  enriched.sort((a, b) => a.priceEur - b.priceEur);
  const byPlatform = {};
  for (const i of enriched) if (!byPlatform[i.platform] || i.priceEur < byPlatform[i.platform].priceEur) byPlatform[i.platform] = i;
  return {
    query, results: Object.values(byPlatform).sort((a, b) => a.priceEur - b.priceEur),
    allListings: enriched, lowest: enriched[0] || null,
    arbitrage: enriched.filter(i => i.goldData?.isArbitrage),
    goldPricePerGram: Math.round(goldPrice * 100) / 100,
    platforms: Object.keys(byPlatform),
    timestamp: new Date().toISOString(),
  };
}

// ── CACHE ─────────────────────────────────────────────────────
const cache = new Map();
const getCached = k => { const e = cache.get(k); return e && Date.now() - e.ts < 15 * 60 * 1000 ? e.d : null; };
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
  res.json({ pricePerGram: p ? Math.round(p * 100) / 100 : null, pricePerOz: p ? Math.round(p * 31.1035) : null, history: db.gold_prices.slice(-48).reverse() });
});

app.get('/api/gold-scan', (req, res) => {
  res.json({ message: 'Scansione oro avviata', queries: GOLD_SEARCH_QUERIES.length, platforms: 6 });
  scanGoldArbitrage().catch(e => console.error('[GOLD SCAN]', e.message));
});

app.get('/api/arbitrage', (req, res) => {
  const sorted = [...db.arbitrage].sort((a, b) => b.discount_pct - a.discount_pct);
  res.json(sorted.slice(0, 100));
});

app.get('/api/indie-scan', (req, res) => {
  res.json({ message: 'Scansione indie avviata', brands: INDIE_BRANDS.length });
  scanIndieOpportunities().catch(e => console.error('[INDIE SCAN]', e.message));
});

app.get('/api/indie', (req, res) => {
  res.json(INDIE_BRANDS.map(b => ({
    ...b,
    recentAlert: db.indie_alerts.find(a => a.brand === b.name),
  })));
});

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
  const totalCost = items.reduce((s, i) => s + (parseFloat(i.purchasePrice) || 0), 0);
  res.json({ totalCost, totalValue: totalCost, totalROI: 0, itemCount: items.length });
});

app.get('/api/alerts', (req, res) => res.json(db.alerts.slice(-50).reverse()));

app.post('/api/telegram/register', (req, res) => {
  const { chatId } = req.body;
  sendTelegram('✅ <b>PriceRadar v9</b> configurato!\n\n🥇 Arbitraggio oro su 6 piattaforme\n📈 Indie FOMO monitor\n🔔 Alert in tempo reale', chatId);
  res.json({ ok: true });
});
app.post('/api/telegram/test', (req, res) => {
  sendTelegram('⌚ PriceRadar v9 — Test OK! 🟢', req.body.chatId);
  res.json({ ok: true });
});

app.get('/api/status', async (req, res) => {
  const gp = await getGoldPrice().catch(() => null);
  res.json({
    status: 'online', version: '9.0',
    platforms: ['Chrono24', 'eBay', 'Catawiki', 'Subito.it', 'Leboncoin', 'Vestiaire'],
    goldPricePerGram: gp ? Math.round(gp * 100) / 100 : null,
    arbitrageFound: db.arbitrage.length,
    watchlist: db.watchlist.filter(w => w.active).length,
    portfolio: db.portfolio.filter(p => p.active).length,
    indieAlerts: db.indie_alerts.length,
    goldQueries: GOLD_SEARCH_QUERIES.length,
    indieBrands: INDIE_BRANDS.length,
    ebayConfigured: !!(process.env.EBAY_CLIENT_ID),
    telegramConfigured: !!(process.env.TELEGRAM_TOKEN),
    emailConfigured: !!(process.env.SMTP_USER),
    uptime: Math.floor(process.uptime()),
  });
});

// ── CRON ─────────────────────────────────────────────────────

// Arbitraggio oro ogni 2 ore
cron.schedule('0 */2 * * *', async () => {
  console.log('[CRON] Scansione arbitraggio oro...');
  await scanGoldArbitrage().catch(e => console.error('[CRON GOLD]', e.message));
});

// Indie FOMO ogni 6 ore
cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Scansione indie...');
  await scanIndieOpportunities().catch(e => console.error('[CRON INDIE]', e.message));
});

// Watchlist prezzi ogni 30 min
cron.schedule('*/30 * * * *', async () => {
  const items = db.watchlist.filter(w => w.active);
  for (const item of items) {
    try {
      await sleep(2000);
      const data = await searchAll(item.query);
      if (data.lowest) {
        db.price_history.push({ watchlist_id: item.id, price: data.lowest.priceEur, platform: data.lowest.platform, at: new Date().toISOString() });
      }
      if (item.threshold && data.lowest && data.lowest.priceEur <= parseFloat(item.threshold)) {
        const recent = db.alerts.find(a => a.watchlist_id === item.id && Date.now() - new Date(a.at).getTime() < 2 * 3600000);
        if (!recent) {
          await sendTelegram(
            `🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${data.lowest.priceEur.toLocaleString('it-IT')} su ${data.lowest.platform}\n<a href="${data.lowest.url}">→ VEDI</a>`,
            item.telegram_chat_id
          );
          db.alerts.push({ id: nid(), watchlist_id: item.id, platform: data.lowest.platform, price: data.lowest.priceEur, at: new Date().toISOString() });
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
  console.log(`\n⌚ Watch Price Bot v9`);
  console.log(`   Oro: €${gp?.toFixed(2) || 'N/A'}/g | ${GOLD_SEARCH_QUERIES.length} query oro | ${INDIE_BRANDS.length} brand indie`);
  console.log(`   Piattaforme: Chrono24, eBay, Catawiki, Subito.it, Leboncoin, Vestiaire`);
  console.log(`   eBay: ${process.env.EBAY_CLIENT_ID ? '✓' : '✗'} | TG: ${process.env.TELEGRAM_TOKEN ? '✓' : '✗'} | Email: ${process.env.SMTP_USER ? '✓' : '✗'}\n`);

  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await sendTelegram(
      `✅ <b>PriceRadar v9 Online!</b>\n\n` +
      `🥇 Oro spot: €${gp?.toFixed(2) || 'N/A'}/g\n` +
      `🔍 ${GOLD_SEARCH_QUERIES.length} query arbitraggio oro\n` +
      `📈 ${INDIE_BRANDS.length} brand indie monitorati\n` +
      `🏪 6 piattaforme: C24, eBay, Catawiki, Subito, Leboncoin, Vestiaire\n\n` +
      `Prima scansione oro tra pochi secondi...`
    );
  }

  // Prima scansione automatica all'avvio
  setTimeout(() => {
    scanGoldArbitrage().catch(() => {});
    setTimeout(() => scanIndieOpportunities().catch(() => {}), 5 * 60 * 1000); // indie dopo 5 min
  }, 10000);
});
