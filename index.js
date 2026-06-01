/**
 * Watch Price Bot v7 — DEFINITIVO
 * 
 * ✅ 11 piattaforme prezzi
 * ✅ Arbitraggio oro 18k (80+ modelli)
 * ✅ Segnali social (YouTube top 25, Reddit, Instagram, WatchUSeek)
 * ✅ Facebook Marketplace locale (15 città italiane)
 * ✅ Discovery indipendenti (60+ brand, 4 tier)
 * ✅ Telegram bot (notifiche push istantanee)
 * ✅ WatchCharts (prezzi storici)
 * ✅ Google News monitor (brand indie)
 * ✅ Instagram drop monitor
 * ✅ Portfolio + ROI tracker
 * ✅ Google Alerts RSS
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const sqlite3 = require('better-sqlite3');
const path = require('path');

const { WATCH_DATABASE, GOLD_KEYWORDS, AUTO_SCAN_QUERIES, TOP_APPRECIATION, TOP_DEPRECIATION } = require('./watchDatabase');
const { analyzeWatchSignals, scanUndervaluedVintage, searchFacebookMarketplace, TOP_WATCH_YOUTUBERS, UNDERVALUED_VINTAGE_QUERIES, ITALIAN_CITIES } = require('./signalEngine');
const { INDEPENDENT_WATCHMAKERS, INDIE_MEDIA_SOURCES, INDIE_INSTAGRAM_INFLUENCERS } = require('./independentDatabase');
const { analyzeIndependentBrand, scanAllIndependents, checkNewArticles } = require('./discoveryEngine');
const telegram = require('./telegramBot');
const external = require('./externalSources');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// DATABASE
// ─────────────────────────────────────────────
const db = new sqlite3(path.join(__dirname, 'watches.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT, telegram_chat_id TEXT,
    user_city TEXT, radius_km INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, query TEXT NOT NULL,
    threshold REAL, email TEXT, telegram_chat_id TEXT,
    gold_arbitrage INTEGER DEFAULT 0, track_signals INTEGER DEFAULT 1,
    user_city TEXT, radius_km INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    brand TEXT, model TEXT, reference TEXT,
    purchase_price REAL, purchase_date TEXT, purchase_platform TEXT,
    is_gold INTEGER DEFAULT 0, gold_grams REAL,
    notes TEXT, image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS portfolio_valuations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER,
    market_price REAL, gold_value REAL, effective_value REAL,
    roi_pct REAL, roi_eur REAL,
    source TEXT, watchcharts_data TEXT,
    valuated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER, platform TEXT, price REAL, currency TEXT,
    url TEXT, title TEXT, gold_weight_grams REAL, gold_value_eur REAL,
    is_arbitrage INTEGER DEFAULT 0, trend_pct REAL,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS signal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_model TEXT, hype_score INTEGER, hype_label TEXT,
    yt_score INTEGER, reddit_score INTEGER, ig_score INTEGER,
    forum_score INTEGER, chrono24_score INTEGER, fb_score INTEGER,
    yt_videos INTEGER, reddit_posts INTEGER, fb_listings INTEGER,
    raw_data TEXT, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS independent_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_key TEXT, brand_name TEXT, tier INTEGER,
    discovery_score INTEGER, discovery_urgency TEXT, discovery_thesis TEXT,
    hodinkee_articles INTEGER DEFAULT 0, auction_results INTEGER DEFAULT 0,
    reddit_posts INTEGER DEFAULT 0, ig_followers INTEGER DEFAULT 0,
    gphg_nominated INTEGER DEFAULT 0,
    alert_first_hodinkee INTEGER DEFAULT 0, alert_first_auction INTEGER DEFAULT 0,
    alert_gphg INTEGER DEFAULT 0, alert_reddit_exploding INTEGER DEFAULT 0,
    raw_data TEXT, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS discovery_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_key TEXT, brand_name TEXT, alert_type TEXT,
    message TEXT, url TEXT, importance INTEGER DEFAULT 50,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP, notified INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS media_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT, title TEXT, description TEXT, url TEXT,
    brand_key TEXT, brand_name TEXT,
    importance INTEGER DEFAULT 50, is_first_mention INTEGER DEFAULT 0,
    published_at TEXT, saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS instagram_drops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT, brand_name TEXT, brand_key TEXT,
    drop_signals TEXT, captions TEXT, followers INTEGER,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP, notified INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS watchcharts_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_model TEXT, current_price REAL,
    price_change_1m REAL, price_change_3m REAL,
    price_change_1y REAL, market_trend TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS facebook_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_model TEXT, title TEXT, price REAL, currency TEXT,
    location TEXT, url TEXT, group_name TEXT,
    is_local INTEGER DEFAULT 0, distance_km INTEGER,
    found_at DATETIME DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS alerts_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watchlist_id INTEGER, platform TEXT, price REAL,
    gold_value REAL, discount_pct REAL, hype_score INTEGER,
    message TEXT, channel TEXT DEFAULT 'email',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS gold_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_eur_per_gram REAL, fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT, title TEXT, price REAL, currency TEXT,
    gold_weight_grams REAL, gold_value_eur REAL, discount_pct REAL,
    trend_pct REAL, trend_label TEXT, url TEXT,
    found_at DATETIME DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS vintage_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT, hype_score INTEGER, hype_label TEXT,
    yt_videos INTEGER, reddit_posts INTEGER, fb_listings INTEGER,
    chrono24_listings INTEGER, chrono24_avg_price REAL,
    signal_breakdown TEXT, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─────────────────────────────────────────────
// NOTIFICHE — invia su tutti i canali configurati
// ─────────────────────────────────────────────
const mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });

async function notify(channels, subject, html, telegramText) {
  const { email, telegramChatId } = channels;
  const promises = [];
  if (email && process.env.SMTP_USER) {
    promises.push(mailer.sendMail({ from: `PriceRadar <${process.env.SMTP_USER}>`, to: email, subject, html }).catch(e => console.error('[Email]', e.message)));
  }
  if (telegramChatId || process.env.TELEGRAM_CHAT_ID) {
    promises.push(telegram.sendTelegramMessage(telegramChatId, telegramText).catch(e => console.error('[TG]', e.message)));
  }
  await Promise.allSettled(promises);
}

// ─────────────────────────────────────────────
// GOLD UTILS
// ─────────────────────────────────────────────
function isGoldWatch(t) { return GOLD_KEYWORDS.some(k => (t || '').toLowerCase().includes(k.toLowerCase())); }
function matchWatchModel(title) {
  const t = (title || '').toLowerCase(); let best = null, bs = 0;
  for (const [key, data] of Object.entries(WATCH_DATABASE)) {
    const w = key.split(' '); const s = w.filter(x => t.includes(x)).length / w.length;
    if (s > bs && s > 0.5) { bs = s; best = { key, ...data }; }
    if (data.searchTerms) for (const term of data.searchTerms) { const tw = term.toLowerCase().split(' '); const ts = tw.filter(x => t.includes(x)).length / tw.length; if (ts > bs && ts > 0.6) { bs = ts; best = { key, ...data }; } }
  }
  if (!best && isGoldWatch(title)) { if (t.match(/\b(32|34|36)\b/)) best = { key: 's', ...WATCH_DATABASE['generic 18k gold watch small'] }; else if (t.match(/\b(44|45|46|47)\b/)) best = { key: 'l', ...WATCH_DATABASE['generic 18k gold watch large'] }; else best = { key: 'm', ...WATCH_DATABASE['generic 18k gold watch medium'] }; }
  return best;
}
let cg = null, gf = 0;
async function getGoldPrice() {
  if (cg && Date.now() - gf < 30 * 60 * 1000) return cg;
  try { const r = await axios.get('https://data-asg.goldprice.org/dbXRates/USD', { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://goldprice.org' }, timeout: 8000 }); const u = r.data?.items?.[0]?.xauPrice; if (u) { const fx = await axios.get('https://api.frankfurter.app/latest?from=USD&to=EUR', { timeout: 5000 }); const g = u * (fx.data?.rates?.EUR || 0.92) / 31.1035; cg = g; gf = Date.now(); db.prepare('INSERT INTO gold_prices(price_eur_per_gram)VALUES(?)').run(g); return g; } } catch {}
  return cg || 78.5;
}
async function enrichWithGold(item) {
  const model = matchWatchModel(item.title); if (!model) return { ...item, goldData: null };
  const gp = await getGoldPrice(); const gv = model.goldGrams * gp; const p = item.priceEur || item.price;
  return { ...item, goldData: { modelKey: model.key, goldGrams: model.goldGrams, goldValueEur: Math.round(gv), discountPct: Math.round(((gv - p) / gv) * 1000) / 10, isArbitrage: p < gv, trend: model.trend, trendLabel: model.trendLabel, rarity: model.rarity, goldPricePerGram: Math.round(gp * 100) / 100 } };
}

// ─────────────────────────────────────────────
// SCRAPERS
// ─────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rUA = () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const parsePrice = t => parseFloat((t || '').replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
let fx = { USD: 0.92, GBP: 1.17 }, fxF = 0;
async function toEur(p, c) { if (!p || c === 'EUR') return p; if (Date.now() - fxF > 3600000) { try { const r = await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP', { timeout: 5000 }); fx = { USD: 1 / r.data.rates.USD, GBP: 1 / r.data.rates.GBP }; fxF = Date.now(); } catch {} } return p * (fx[c] || 1); }
let ebayToken = null, ebayExp = 0;
async function getEbayToken() { if (ebayToken && Date.now() < ebayExp) return ebayToken; const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64'); const r = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope', { headers: { Authorization: `Basic ${c}`, 'Content-Type': 'application/x-www-form-urlencoded' } }); ebayToken = r.data.access_token; ebayExp = Date.now() + (r.data.expires_in - 60) * 1000; return ebayToken; }
async function searchEbay(q) { if (!process.env.EBAY_CLIENT_ID) return []; try { const t = await getEbayToken(); const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', { params: { q, category_ids: '31387', sort: 'price', limit: 15 }, headers: { Authorization: `Bearer ${t}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_IT' } }); return (r.data.itemSummaries || []).map(i => ({ platform: 'eBay', title: i.title, price: parseFloat(i.price?.value || 0), currency: i.price?.currency || 'EUR', url: i.itemWebUrl })).filter(i => i.price > 0); } catch { return []; } }
async function searchChrono24(q) { try { await sleep(800 + Math.random() * 700); const url = `https://www.chrono24.it/search/index.htm?query=${encodeURIComponent(q)}&dosearch=true&searchType=fulltext&resultview=list`; const r = await axios.get(url, { headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT', Referer: 'https://www.chrono24.it/' }, timeout: 12000 }); const $ = cheerio.load(r.data); const res = []; $('[data-article-id],.article-item-container').each((i, el) => { if (i >= 10) return; const $el = $(el); const title = $el.find('.article-title,h3').first().text().trim(); const price = parsePrice($el.find('.price,.js-price').first().text()); const link = $el.find('a[href*="/watches/"]').first().attr('href'); if (title && price > 100) res.push({ platform: 'Chrono24', title, price, currency: 'EUR', url: link ? (link.startsWith('http') ? link : `https://www.chrono24.it${link}`) : url }); }); return res.sort((a, b) => a.price - b.price); } catch { return []; } }
async function scrapeG(platform, url, sel) { try { await sleep(900 + Math.random() * 700); const r = await axios.get(url, { headers: { 'User-Agent': rUA(), Referer: new URL(url).origin }, timeout: 12000 }); const $ = cheerio.load(r.data); const res = []; $(sel.item).each((i, el) => { if (i >= 8) return; const $el = $(el); const title = $el.find(sel.title).first().text().trim(); const price = parsePrice($el.find(sel.price).first().text()); const link = $el.find('a').first().attr('href'); if (title && price > 100) res.push({ platform, title, price, currency: sel.currency || 'USD', url: link ? (link.startsWith('http') ? link : new URL(url).origin + link) : url }); }); return res; } catch { return []; } }
const searchWatchfinder = q => scrapeG('Watchfinder', `https://api.watchfinder.co.uk/catalog/search?query=${encodeURIComponent(q)}&pageSize=8`, { item: 'div', title: 'title', price: 'price', currency: 'GBP' });
const searchBobs = q => scrapeG("Bob's Watches", `https://www.bobswatches.com/search?q=${encodeURIComponent(q)}`, { item: '.product-item,[class*="product-card"]', title: 'h2,h3', price: '.price', currency: 'USD' });
const searchWatchBox = q => scrapeG('WatchBox', `https://www.thewatchbox.com/search?q=${encodeURIComponent(q)}`, { item: '[class*="ProductCard"]', title: '[class*="title"]', price: '[class*="price"]', currency: 'USD' });
const searchCatawiki = q => scrapeG('Catawiki', `https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(q)}`, { item: '[class*="lot-card"],article[data-lot-id]', title: '[class*="title"],h2', price: '[class*="price"]', currency: 'EUR' });
const searchVestiaire = q => scrapeG('Vestiaire', `https://www.vestiairecollective.com/search/?q=${encodeURIComponent(q)}&universe=men&category=watches`, { item: '[class*="product-card"]', title: '[class*="brand"]', price: '[class*="price"]', currency: 'EUR' });
const searchFarfetch = q => scrapeG('Farfetch', `https://www.farfetch.com/it/shopping/men/watches-2/items.aspx?q=${encodeURIComponent(q)}`, { item: '[data-component="ProductCard"]', title: '[class*="designer"]', price: '[class*="price"]', currency: 'EUR' });
const searchSubdial = q => scrapeG('Subdial', `https://subdial.com/watches?search=${encodeURIComponent(q)}`, { item: '[class*="watch-card"],article', title: 'h2,h3', price: '[class*="price"]', currency: 'GBP' });

async function searchAllPlatforms(query, userCity = null) {
  const settled = await Promise.allSettled([
    searchEbay(query), searchChrono24(query), searchWatchfinder(query),
    searchBobs(query), searchWatchBox(query),
    searchCatawiki(query), searchVestiaire(query), searchFarfetch(query), searchSubdial(query),
    userCity ? searchFacebookMarketplace(query, userCity) : Promise.resolve([]),
  ]);
  const raw = settled.flatMap(s => s.status === 'fulfilled' ? s.value : []);
  const enriched = await Promise.all(raw.map(async i => enrichWithGold({ ...i, priceEur: Math.round(await toEur(i.price, i.currency)) })));
  enriched.sort((a, b) => a.priceEur - b.priceEur);
  const byP = {}; for (const i of enriched) if (!byP[i.platform] || i.priceEur < byP[i.platform].priceEur) byP[i.platform] = i;
  return { query, timestamp: new Date().toISOString(), results: Object.values(byP).sort((a, b) => a.priceEur - b.priceEur), allListings: enriched, lowest: enriched[0] || null, arbitrageOpportunities: enriched.filter(i => i.goldData?.isArbitrage), facebookListings: enriched.filter(i => i.platform.includes('Facebook')), goldPricePerGram: cg ? Math.round(cg * 100) / 100 : null, platformsScanned: Object.keys(byP) };
}

// ─────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────
const cache = new Map();
const getCached = k => { const e = cache.get(k); return e && Date.now() - e.ts < 15 * 60 * 1000 ? e.d : null; };
const setCache = (k, d) => cache.set(k, { d, ts: Date.now() });

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────

// ── Prezzi ──
app.get('/api/search', async (req, res) => {
  const q = req.query.q?.trim(), city = req.query.city || null;
  if (!q) return res.status(400).json({ error: '?q= richiesto' });
  const ck = `${q}:${city || ''}`; const cached = getCached(ck); if (cached) return res.json({ ...cached, fromCache: true });
  try { const d = await searchAllPlatforms(q, city); setCache(ck, d); res.json(d); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Segnali social ──
app.get('/api/signals', async (req, res) => {
  const q = req.query.q?.trim(), city = req.query.city || null;
  if (!q) return res.status(400).json({ error: '?q= richiesto' });
  const ck = `sig:${q}:${city || ''}`; const cached = getCached(ck); if (cached) return res.json({ ...cached, fromCache: true });
  try {
    const wd = matchWatchModel(q);
    const a = await analyzeWatchSignals(q, { isVintage: q.toLowerCase().includes('vintage'), hasGold: isGoldWatch(q), trend: wd?.trend || 0 }, city);
    db.prepare('INSERT INTO signal_history(watch_model,hype_score,hype_label,yt_score,reddit_score,ig_score,forum_score,chrono24_score,fb_score,yt_videos,reddit_posts,fb_listings,raw_data)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(q, a.hypeScore.score, a.hypeScore.label, a.hypeScore.breakdown.youtube, a.hypeScore.breakdown.reddit, a.hypeScore.breakdown.instagram, a.hypeScore.breakdown.watchuseek, a.hypeScore.breakdown.chrono24, a.hypeScore.breakdown.facebook, a.hypeScore.signals.ytVideosFound, a.hypeScore.signals.redditPosts, a.hypeScore.signals.fbListings, JSON.stringify(a));
    setCache(ck, a); res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── WatchCharts ──
app.get('/api/watchcharts', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: '?q= richiesto' });
  try {
    const data = await external.getWatchChartsData(q);
    if (data) db.prepare('INSERT INTO watchcharts_history(watch_model,current_price,price_change_1m,price_change_3m,price_change_1y,market_trend)VALUES(?,?,?,?,?,?)').run(q, data.currentPrice, data.priceChange1m, data.priceChange3m, data.priceChange1y, data.marketTrend);
    res.json(data || { error: 'Modello non trovato su WatchCharts' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/watchcharts/history', (req, res) => {
  const q = req.query.q;
  const history = q
    ? db.prepare('SELECT * FROM watchcharts_history WHERE watch_model LIKE ? ORDER BY fetched_at DESC LIMIT 48').all(`%${q}%`)
    : db.prepare('SELECT * FROM watchcharts_history ORDER BY fetched_at DESC LIMIT 100').all();
  res.json(history);
});

// ── Portfolio ──
app.get('/api/portfolio', (req, res) => {
  const items = db.prepare('SELECT p.*, pv.market_price, pv.gold_value, pv.effective_value, pv.roi_pct, pv.roi_eur, pv.market_trend, pv.valuated_at FROM portfolio p LEFT JOIN portfolio_valuations pv ON pv.portfolio_id=p.id AND pv.valuated_at=(SELECT MAX(valuated_at) FROM portfolio_valuations WHERE portfolio_id=p.id) WHERE p.active=1 ORDER BY p.created_at DESC').all();
  res.json(items);
});

app.post('/api/portfolio', (req, res) => {
  const { name, brand, model, reference, purchasePrice, purchaseDate, purchasePlatform, isGold, goldGrams, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name richiesto' });
  const r = db.prepare('INSERT INTO portfolio(name,brand,model,reference,purchase_price,purchase_date,purchase_platform,is_gold,gold_grams,notes)VALUES(?,?,?,?,?,?,?,?,?,?)').run(name, brand || null, model || null, reference || null, purchasePrice || null, purchaseDate || null, purchasePlatform || null, isGold ? 1 : 0, goldGrams || null, notes || null);
  res.json({ id: r.lastInsertRowid, name });
});

app.put('/api/portfolio/:id', (req, res) => {
  const { name, purchasePrice, notes } = req.body;
  db.prepare('UPDATE portfolio SET name=COALESCE(?,name), purchase_price=COALESCE(?,purchase_price), notes=COALESCE(?,notes) WHERE id=?').run(name || null, purchasePrice || null, notes || null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/portfolio/:id', (req, res) => {
  db.prepare('UPDATE portfolio SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Valuta portfolio (calcola ROI)
app.post('/api/portfolio/valuate', async (req, res) => {
  const items = db.prepare('SELECT * FROM portfolio WHERE active=1').all();
  if (!items.length) return res.json({ summary: { totalCost: 0, totalValue: 0, totalROI: 0 }, items: [] });
  res.json({ message: 'Valutazione avviata', count: items.length });
  (async () => {
    const portfolio = items.map(i => ({ ...i, purchasePrice: i.purchase_price, isGold: !!i.is_gold, goldGrams: i.gold_grams }));
    const result = await external.calculatePortfolioROI(portfolio, searchAllPlatforms, getGoldPrice);
    for (const item of result.items) {
      if (item.effectiveValue) {
        db.prepare('INSERT INTO portfolio_valuations(portfolio_id,market_price,gold_value,effective_value,roi_pct,roi_eur,source,watchcharts_data)VALUES(?,?,?,?,?,?,?,?)').run(item.id, item.currentMarketPrice || null, item.goldValue || null, item.effectiveValue, item.roi || null, item.roiEur || null, item.lowestPlatform || 'market', item.watchCharts ? JSON.stringify(item.watchCharts) : null);
      }
    }
    // Notifica via Telegram
    if (result.summary && (process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_TOKEN)) {
      await telegram.sendTelegramMessage(null, telegram.msgPortfolioUpdate({
        totalValue: result.summary.totalValue, totalCost: result.summary.totalCost,
        totalROI: result.summary.totalROI, roiPct: result.summary.totalROI,
        topGainer: result.summary.topGainer ? { name: result.summary.topGainer.name, roiPct: result.summary.topGainer.roi } : null,
        topLoser: result.summary.topLoser ? { name: result.summary.topLoser.name, roiPct: result.summary.topLoser.roi } : null,
      })).catch(() => {});
    }
    console.log(`[PORTFOLIO] Valutazione completata: ROI ${result.summary.totalROI?.toFixed(1)}%`);
  })();
});

app.get('/api/portfolio/summary', (req, res) => {
  const items = db.prepare('SELECT p.*, pv.effective_value, pv.roi_pct, pv.roi_eur FROM portfolio p LEFT JOIN portfolio_valuations pv ON pv.portfolio_id=p.id AND pv.valuated_at=(SELECT MAX(valuated_at) FROM portfolio_valuations WHERE portfolio_id=p.id) WHERE p.active=1').all();
  const totalCost = items.reduce((s, i) => s + (i.purchase_price || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.effective_value || i.purchase_price || 0), 0);
  const totalROI = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const sorted = [...items].filter(i => i.roi_pct !== null).sort((a, b) => (b.roi_pct || 0) - (a.roi_pct || 0));
  res.json({ totalCost, totalValue, totalROI: Math.round(totalROI * 10) / 10, totalROIEur: Math.round(totalValue - totalCost), itemCount: items.length, topGainer: sorted[0] || null, topLoser: sorted.at(-1) || null });
});

// ── Telegram webhook ──
app.post('/telegram/webhook', async (req, res) => {
  res.sendStatus(200);
  await telegram.handleTelegramCommand(req.body, db, searchAllPlatforms);
});

// Registra chat ID Telegram
app.post('/api/telegram/register', (req, res) => {
  const { chatId, email } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId richiesto' });
  const existing = db.prepare('SELECT id FROM users WHERE telegram_chat_id=?').get(chatId);
  if (!existing) db.prepare('INSERT INTO users(email,telegram_chat_id)VALUES(?,?)').run(email || null, chatId);
  telegram.sendTelegramMessage(chatId, `✅ <b>PriceRadar v7</b> configurato!\n\nRiceverai notifiche push per:\n🔔 Alert prezzi\n🥇 Arbitraggio oro\n🔥 FOMO/Hype\n🔭 Discovery indipendenti\n📍 Facebook locale`);
  res.json({ ok: true, chatId });
});

// Test notifica Telegram
app.post('/api/telegram/test', async (req, res) => {
  const chatId = req.body.chatId || process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return res.status(400).json({ error: 'chatId richiesto' });
  await telegram.sendTelegramMessage(chatId, '⌚ <b>PriceRadar v7</b> — Test notifica!\n\nTutto funziona correttamente 🟢');
  res.json({ ok: true });
});

// ── Google News monitor ──
app.get('/api/google-news', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: '?q= richiesto' });
  try { const data = await external.checkGoogleAlerts(q); res.json(data); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/google-alerts-setup', (req, res) => {
  const brands = Object.values(INDEPENDENT_WATCHMAKERS).filter(b => b.tier >= 2).map(b => b.name);
  res.json(external.getGoogleAlertsSetupInstructions(brands));
});

// ── Instagram drops ──
app.get('/api/indie/drops', (req, res) => {
  res.json(db.prepare('SELECT * FROM instagram_drops ORDER BY detected_at DESC LIMIT 20').all());
});

app.get('/api/indie/scan-drops', (req, res) => {
  res.json({ message: 'Scan drop Instagram avviato' });
  (async () => {
    const drops = await external.monitorIndieDrops(INDEPENDENT_WATCHMAKERS);
    for (const drop of drops) {
      db.prepare('INSERT INTO instagram_drops(handle,brand_name,brand_key,drop_signals,captions,followers)VALUES(?,?,?,?,?,?)').run(drop.handle, drop.brand?.name, drop.brand?.key, JSON.stringify(drop.dropKeywordsFound), JSON.stringify(drop.captions), drop.followers || 0);
      // Notifica
      const msg = `🚨 <b>DROP IMMINENTE!</b>\n\n@${drop.handle} (${drop.brand?.name})\nSegnali: ${drop.dropKeywordsFound?.join(', ')}\n\n💡 ${drop.brand?.buySignal || 'Acquista prima che esaurisca'}\n<a href="${drop.url}">→ IG</a>`;
      await telegram.sendTelegramMessage(null, msg).catch(() => {});
    }
    console.log(`[DROPS] ${drops.length} drop rilevati`);
  })();
});

// ── Indie routes (da v6) ──
app.get('/api/indie/brands', (req, res) => {
  const tier = req.query.tier ? parseInt(req.query.tier) : null;
  const brands = Object.entries(INDEPENDENT_WATCHMAKERS).filter(([, b]) => !tier || b.tier === tier).map(([key, b]) => ({ key, ...b })).sort((a, b) => b.tier - a.tier || b.discoveryScore - a.discoveryScore);
  res.json({ count: brands.length, brands });
});

app.get('/api/indie/analyze/:brandKey', async (req, res) => {
  const { brandKey } = req.params;
  if (!INDEPENDENT_WATCHMAKERS[brandKey]) return res.status(404).json({ error: 'Brand non trovato' });
  const ck = `indie:${brandKey}`; const cached = getCached(ck); if (cached) return res.json({ ...cached, fromCache: true });
  try {
    const analysis = await analyzeIndependentBrand(brandKey);
    db.prepare('INSERT INTO independent_analyses(brand_key,brand_name,tier,discovery_score,discovery_urgency,discovery_thesis,hodinkee_articles,auction_results,reddit_posts,ig_followers,gphg_nominated,alert_first_hodinkee,alert_first_auction,alert_gphg,alert_reddit_exploding,raw_data)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(brandKey, analysis.brand.name, analysis.brand.tier, analysis.discovery.score, analysis.discovery.urgency, analysis.discovery.thesis, analysis.signals.hodinkee?.articles?.length || 0, (analysis.signals.auctions?.phillips?.count || 0) + (analysis.signals.auctions?.sothebys?.count || 0), analysis.signals.reddit?.totalPosts || 0, analysis.signals.instagram?.reduce((s, i) => s + (i.followersCount || 0), 0) || 0, analysis.signals.gphg?.nominated ? 1 : 0, analysis.alerts.firstHodinkeeArticle ? 1 : 0, analysis.alerts.firstAuctionAppearance ? 1 : 0, analysis.alerts.gphgNomination ? 1 : 0, analysis.alerts.redditExploding ? 1 : 0, JSON.stringify(analysis));
    // Alert critici → Telegram
    for (const [alertType, isAlert] of Object.entries(analysis.alerts)) {
      if (isAlert) {
        const msg = { firstHodinkeeArticle: 'Prima menzione su Hodinkee', firstAuctionAppearance: 'Prima apparizione in asta', gphgNomination: 'Nominato GPHG!', redditExploding: 'Reddit in esplosione' }[alertType];
        if (msg) {
          db.prepare('INSERT INTO discovery_alerts(brand_key,brand_name,alert_type,message,importance)VALUES(?,?,?,?,?)').run(brandKey, analysis.brand.name, alertType, msg, analysis.brand.tier * 20 + 20);
          await telegram.sendTelegramMessage(null, telegram.msgDiscoveryAlert({ brandName: analysis.brand.name, tier: analysis.brand.tier, alertType: msg, message: msg, discoveryScore: analysis.discovery.score, urgency: analysis.discovery.urgency, thesis: analysis.discovery.thesis, buySignal: analysis.brand.buySignal })).catch(() => {});
        }
      }
    }
    setCache(ck, analysis); res.json(analysis);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/indie/scan', (req, res) => {
  res.json({ message: 'Scansione indie avviata' });
  (async () => { await scanAllIndependents().catch(e => console.error('[INDIE SCAN]', e.message)); })();
});

app.get('/api/indie/opportunities', (req, res) => {
  const analyses = db.prepare('SELECT DISTINCT brand_key,brand_name,tier,discovery_score,discovery_urgency,discovery_thesis,hodinkee_articles,auction_results,reddit_posts,gphg_nominated,MAX(scanned_at) as last_scan FROM independent_analyses GROUP BY brand_key ORDER BY (tier*10+discovery_score) DESC LIMIT 30').all();
  res.json(analyses.map(a => ({ ...a, brandData: INDEPENDENT_WATCHMAKERS[a.brand_key] || null })));
});

app.get('/api/indie/alerts', (req, res) => res.json(db.prepare('SELECT * FROM discovery_alerts ORDER BY sent_at DESC LIMIT 50').all()));
app.get('/api/indie/articles', (req, res) => {
  const bk = req.query.brand;
  res.json(bk ? db.prepare('SELECT * FROM media_articles WHERE brand_key=? ORDER BY saved_at DESC LIMIT 20').all(bk) : db.prepare('SELECT * FROM media_articles ORDER BY importance DESC, saved_at DESC LIMIT 50').all());
});

// ── Route standard ──
app.get('/api/gold-scan', (req, res) => { res.json({ message: 'OK' }); (async () => { for (const q of AUTO_SCAN_QUERIES.sort(() => Math.random() - 0.5).slice(0, 10)) { try { await sleep(3000); const d = await searchAllPlatforms(q); for (const o of d.arbitrageOpportunities || []) { db.prepare('INSERT INTO arbitrage_opportunities(platform,title,price,currency,gold_weight_grams,gold_value_eur,discount_pct,trend_pct,trend_label,url)VALUES(?,?,?,?,?,?,?,?,?,?)').run(o.platform, o.title, o.priceEur, 'EUR', o.goldData?.goldGrams, o.goldData?.goldValueEur, o.goldData?.discountPct, o.goldData?.trend || null, o.goldData?.trendLabel || null, o.url); await telegram.sendTelegramMessage(null, telegram.msgGoldArbitrage({ title: o.title, platform: o.platform, priceEur: o.priceEur, goldValueEur: o.goldData?.goldValueEur, goldGrams: o.goldData?.goldGrams, discountPct: o.goldData?.discountPct, trendLabel: o.goldData?.trendLabel, url: o.url })).catch(() => {}); } } catch {} } })(); });
app.get('/api/vintage-scan', (req, res) => { const city = req.query.city || null; res.json({ message: 'OK' }); (async () => { const results = await scanUndervaluedVintage(city); for (const r of results) db.prepare('INSERT INTO vintage_opportunities(model,hype_score,hype_label,yt_videos,reddit_posts,fb_listings,chrono24_listings,chrono24_avg_price,signal_breakdown)VALUES(?,?,?,?,?,?,?,?,?)').run(r.query, r.hypeScore.score, r.hypeScore.label, r.hypeScore.signals.ytVideosFound, r.hypeScore.signals.redditPosts, r.hypeScore.signals.fbListings, r.hypeScore.signals.chrono24Listings, r.signals.chrono24?.avgPrice || 0, JSON.stringify(r.hypeScore.breakdown)); })(); });
app.get('/api/vintage', (req, res) => res.json(db.prepare('SELECT * FROM vintage_opportunities ORDER BY hype_score DESC, scanned_at DESC LIMIT 50').all()));
app.get('/api/arbitrage', (req, res) => res.json(db.prepare('SELECT * FROM arbitrage_opportunities WHERE active=1 ORDER BY discount_pct DESC LIMIT 100').all()));
app.get('/api/gold-price', async (req, res) => { const p = await getGoldPrice().catch(() => null); res.json({ pricePerGram: p ? Math.round(p * 100) / 100 : null, history: db.prepare('SELECT * FROM gold_prices ORDER BY fetched_at DESC LIMIT 48').all() }); });
app.get('/api/trends', (req, res) => res.json({ topAppreciation: TOP_APPRECIATION, topDepreciation: TOP_DEPRECIATION }));
app.get('/api/top-hype', (req, res) => res.json(db.prepare("SELECT watch_model,MAX(hype_score) as max_score,hype_label,MAX(scanned_at) as last_scan FROM signal_history WHERE scanned_at>datetime('now','-7 days') GROUP BY watch_model ORDER BY max_score DESC LIMIT 20").all()));
app.get('/api/facebook', (req, res) => { const q = req.query.q, city = req.query.city; let sql = 'SELECT * FROM facebook_listings WHERE active=1'; const p = []; if (q) { sql += ' AND watch_model LIKE ?'; p.push(`%${q}%`); } if (city) { sql += ' AND (location LIKE ? OR is_local=1)'; p.push(`%${city}%`); } sql += ' ORDER BY found_at DESC LIMIT 100'; res.json(db.prepare(sql).all(...p)); });
app.get('/api/cities', (req, res) => res.json(Object.keys(ITALIAN_CITIES)));
app.post('/api/watchlist', (req, res) => { const { query, threshold, email, telegramChatId, goldArbitrage, trackSignals, userCity, radiusKm } = req.body; if (!query) return res.status(400).json({ error: 'query richiesta' }); const r = db.prepare('INSERT INTO watchlist(query,threshold,email,telegram_chat_id,gold_arbitrage,track_signals,user_city,radius_km)VALUES(?,?,?,?,?,?,?,?)').run(query, threshold || null, email || null, telegramChatId || process.env.TELEGRAM_CHAT_ID || null, goldArbitrage ? 1 : 0, trackSignals !== false ? 1 : 0, userCity || null, radiusKm || 100); res.json({ id: r.lastInsertRowid, query }); });
app.get('/api/watchlist', (req, res) => res.json(db.prepare('SELECT * FROM watchlist WHERE active=1 ORDER BY created_at DESC').all()));
app.delete('/api/watchlist/:id', (req, res) => { db.prepare('UPDATE watchlist SET active=0 WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.get('/api/history/:id', (req, res) => res.json(db.prepare('SELECT * FROM price_history WHERE watchlist_id=? ORDER BY scanned_at DESC LIMIT 100').all(req.params.id)));
app.get('/api/alerts', (req, res) => res.json(db.prepare('SELECT al.*,w.query FROM alerts_log al JOIN watchlist w ON al.watchlist_id=w.id ORDER BY sent_at DESC LIMIT 50').all()));

app.get('/api/status', async (req, res) => {
  const gp = await getGoldPrice().catch(() => null);
  res.json({
    status: 'online', version: '7.0', platforms: 11,
    watchlist: db.prepare('SELECT COUNT(*) as n FROM watchlist WHERE active=1').get().n,
    totalScans: db.prepare('SELECT COUNT(*) as n FROM price_history').get().n,
    arbitrageFound: db.prepare('SELECT COUNT(*) as n FROM arbitrage_opportunities WHERE active=1').get().n,
    vintageOpps: db.prepare('SELECT COUNT(*) as n FROM vintage_opportunities').get().n,
    signalsAnalyzed: db.prepare('SELECT COUNT(*) as n FROM signal_history').get().n,
    independentBrands: Object.keys(INDEPENDENT_WATCHMAKERS).length,
    independentAnalyses: db.prepare('SELECT COUNT(DISTINCT brand_key) as n FROM independent_analyses').get().n,
    discoveryAlerts: db.prepare('SELECT COUNT(*) as n FROM discovery_alerts').get().n,
    mediaArticles: db.prepare('SELECT COUNT(*) as n FROM media_articles').get().n,
    portfolioItems: db.prepare('SELECT COUNT(*) as n FROM portfolio WHERE active=1').get().n,
    instagramDrops: db.prepare('SELECT COUNT(*) as n FROM instagram_drops').get().n,
    facebookListings: db.prepare('SELECT COUNT(*) as n FROM facebook_listings WHERE active=1').get()?.n || 0,
    goldPricePerGram: gp ? Math.round(gp * 100) / 100 : null,
    modelsInDatabase: Object.keys(WATCH_DATABASE).length,
    youtubers: Object.keys(TOP_WATCH_YOUTUBERS).length,
    ebayConfigured: !!(process.env.EBAY_CLIENT_ID),
    youtubeConfigured: !!(process.env.YOUTUBE_API_KEY),
    telegramConfigured: !!(process.env.TELEGRAM_TOKEN),
    emailConfigured: !!(process.env.SMTP_USER),
    uptime: Math.floor(process.uptime()),
  });
});

// ─────────────────────────────────────────────
// CRON JOBS
// ─────────────────────────────────────────────
// Prezzi ogni 30 min
cron.schedule('*/30 * * * *', async () => {
  const items = db.prepare('SELECT * FROM watchlist WHERE active=1').all();
  for (const item of items) {
    try {
      await sleep(2000);
      const data = await searchAllPlatforms(item.query, item.user_city);
      for (const r of data.allListings.slice(0, 20)) {
        db.prepare('INSERT INTO price_history(watchlist_id,platform,price,currency,url,title,gold_weight_grams,gold_value_eur,is_arbitrage,trend_pct)VALUES(?,?,?,?,?,?,?,?,?,?)').run(item.id, r.platform, r.priceEur, 'EUR', r.url, r.title, r.goldData?.goldGrams || null, r.goldData?.goldValueEur || null, r.goldData?.isArbitrage ? 1 : 0, r.goldData?.trend || null);
        if (item.threshold && r.priceEur <= item.threshold) {
          const rec = db.prepare("SELECT id FROM alerts_log WHERE watchlist_id=? AND platform=? AND sent_at>datetime('now','-2 hours')").get(item.id, r.platform);
          if (!rec) {
            await notify({ email: item.email, telegramChatId: item.telegram_chat_id }, `🔔 ${item.query} → €${r.priceEur} su ${r.platform}`, `<div style="font-family:Georgia;background:#050510;padding:24px;color:#E0D8C8"><h3>${item.query}</h3><div style="font-size:24px;color:#C9A84C">€${r.priceEur?.toLocaleString('it-IT')}</div><p>${r.platform}</p><a href="${r.url}">→</a></div>`, telegram.msgPriceAlert({ query: item.query, platform: r.platform, priceEur: r.priceEur, url: r.url, goldData: r.goldData }));
            db.prepare('INSERT INTO alerts_log(watchlist_id,platform,price,message)VALUES(?,?,?,?)').run(item.id, r.platform, r.priceEur, `€${r.priceEur}`);
          }
        }
        if (r.goldData?.isArbitrage && item.gold_arbitrage) {
          const rec = db.prepare("SELECT id FROM alerts_log WHERE watchlist_id=? AND message LIKE 'ARB%' AND sent_at>datetime('now','-4 hours')").get(item.id);
          if (!rec) {
            await telegram.sendTelegramMessage(item.telegram_chat_id, telegram.msgGoldArbitrage({ title: r.title, platform: r.platform, priceEur: r.priceEur, goldValueEur: r.goldData.goldValueEur, goldGrams: r.goldData.goldGrams, discountPct: r.goldData.discountPct, trendLabel: r.goldData.trendLabel, url: r.url })).catch(() => {});
            db.prepare('INSERT INTO alerts_log(watchlist_id,platform,price,gold_value,discount_pct,message)VALUES(?,?,?,?,?,?)').run(item.id, r.platform, r.priceEur, r.goldData.goldValueEur, r.goldData.discountPct, `ARB ${r.goldData.discountPct}%`);
          }
        }
        if (r.platform.includes('Facebook') && r.isLocal) {
          await telegram.sendTelegramMessage(item.telegram_chat_id, telegram.msgFacebookLocal({ title: r.title, price: r.priceEur, location: r.location, distanceKm: r.distanceKm, url: r.url })).catch(() => {});
        }
      }
      cache.delete(`${item.query}:${item.user_city || ''}`);
    } catch (e) { console.error(`[CRON prices] ${item.query}:`, e.message); }
  }
});

// RSS media ogni ora
cron.schedule('0 * * * *', async () => {
  const matches = await checkNewArticles().catch(() => []);
  for (const match of matches) {
    const exists = db.prepare('SELECT id FROM media_articles WHERE url=?').get(match.article.url);
    if (!exists) {
      db.prepare('INSERT INTO media_articles(source,title,description,url,brand_key,brand_name,importance,is_first_mention,published_at)VALUES(?,?,?,?,?,?,?,?,?)').run(match.article.source, match.article.title, match.article.description, match.article.url, match.brand.key, match.brand.name, match.importance, match.isFirstTimeSeen ? 1 : 0, match.article.publishedAt);
      if (match.isFirstTimeSeen && match.importance >= 70) {
        db.prepare('INSERT INTO discovery_alerts(brand_key,brand_name,alert_type,message,url,importance)VALUES(?,?,?,?,?,?)').run(match.brand.key, match.brand.name, 'RSS', match.article.title, match.article.url, match.importance);
        await telegram.sendTelegramMessage(null, telegram.msgDiscoveryAlert({ brandName: match.brand.name, tier: match.brand.tier, alertType: `Nuovo articolo su ${match.article.source}`, message: match.article.title, discoveryScore: match.brand.discoveryScore, urgency: '🟡 Agisci ora', thesis: match.brand.buySignal || '', articleUrl: match.article.url })).catch(() => {});
      }
    }
  }
});

// Segnali social ogni 4 ore
cron.schedule('0 */4 * * *', async () => {
  const items = db.prepare('SELECT * FROM watchlist WHERE active=1 AND track_signals=1').all();
  for (const item of items) {
    try {
      await sleep(5000);
      const wd = matchWatchModel(item.query);
      const a = await analyzeWatchSignals(item.query, { isVintage: item.query.toLowerCase().includes('vintage'), hasGold: isGoldWatch(item.query), trend: wd?.trend || 0 }, item.user_city);
      db.prepare('INSERT INTO signal_history(watch_model,hype_score,hype_label,yt_score,reddit_score,ig_score,forum_score,chrono24_score,fb_score,yt_videos,reddit_posts,fb_listings,raw_data)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(item.query, a.hypeScore.score, a.hypeScore.label, a.hypeScore.breakdown.youtube, a.hypeScore.breakdown.reddit, a.hypeScore.breakdown.instagram, a.hypeScore.breakdown.watchuseek, a.hypeScore.breakdown.chrono24, a.hypeScore.breakdown.facebook, a.hypeScore.signals.ytVideosFound, a.hypeScore.signals.redditPosts, a.hypeScore.signals.fbListings, JSON.stringify(a));
      if (a.hypeScore.score >= 70) {
        const rec = db.prepare("SELECT id FROM alerts_log WHERE watchlist_id=? AND message LIKE 'HYPE%' AND sent_at>datetime('now','-12 hours')").get(item.id);
        if (!rec) {
          await telegram.sendTelegramMessage(item.telegram_chat_id, telegram.msgHypeAlert({ watchModel: item.query, score: a.hypeScore.score, label: a.hypeScore.label, ytVideos: a.hypeScore.signals.ytVideosFound, redditPosts: a.hypeScore.signals.redditPosts, ytKnownChannel: a.hypeScore.signals.ytKnownChannel, ytTopChannel: a.hypeScore.signals.ytTopChannel, fbLocal: a.hypeScore.signals.fbLocalListings })).catch(() => {});
          db.prepare('INSERT INTO alerts_log(watchlist_id,platform,price,hype_score,message)VALUES(?,?,?,?,?)').run(item.id, 'SOCIAL', a.hypeScore.score, a.hypeScore.score, `HYPE ${a.hypeScore.score}`);
        }
      }
    } catch (e) { console.error(`[CRON signals] ${item.query}:`, e.message); }
  }
});

// Indie scan ogni 12 ore
cron.schedule('0 */12 * * *', async () => { await scanAllIndependents().catch(() => {}); });

// Instagram drop monitor ogni 6 ore
cron.schedule('0 */6 * * *', async () => {
  const drops = await external.monitorIndieDrops(INDEPENDENT_WATCHMAKERS).catch(() => []);
  for (const drop of drops) {
    const exists = db.prepare('SELECT id FROM instagram_drops WHERE handle=? AND detected_at>datetime("now","-6 hours")').get(drop.handle);
    if (!exists) {
      db.prepare('INSERT INTO instagram_drops(handle,brand_name,brand_key,drop_signals,captions,followers)VALUES(?,?,?,?,?,?)').run(drop.handle, drop.brand?.name, drop.brand?.key, JSON.stringify(drop.dropKeywordsFound), JSON.stringify(drop.captions), drop.followers || 0);
      await telegram.sendTelegramMessage(null, `🚨 <b>DROP IMMINENTE!</b>\n@${drop.handle} (${drop.brand?.name})\nKeyword: ${drop.dropKeywordsFound?.join(', ')}\n💡 ${drop.brand?.buySignal || ''}`).catch(() => {});
    }
  }
});

// Portfolio valutazione settimanale
cron.schedule('0 9 * * 1', async () => {
  const items = db.prepare('SELECT * FROM portfolio WHERE active=1').all();
  if (!items.length) return;
  const portfolio = items.map(i => ({ ...i, purchasePrice: i.purchase_price, isGold: !!i.is_gold, goldGrams: i.gold_grams }));
  const result = await external.calculatePortfolioROI(portfolio, searchAllPlatforms, getGoldPrice).catch(() => null);
  if (result?.summary) {
    await telegram.sendTelegramMessage(null, telegram.msgPortfolioUpdate({ totalValue: result.summary.totalValue, totalCost: result.summary.totalCost, totalROI: result.summary.totalROI, roiPct: result.summary.totalROI, topGainer: result.summary.topGainer ? { name: result.summary.topGainer.name, roiPct: result.summary.topGainer.roi } : null, topLoser: result.summary.topLoser ? { name: result.summary.topLoser.name, roiPct: result.summary.topLoser.roi } : null })).catch(() => {});
  }
});

// Oro ogni 2 ore
cron.schedule('0 */2 * * *', async () => { for (const q of AUTO_SCAN_QUERIES.sort(() => Math.random() - 0.5).slice(0, 6)) { try { await sleep(4000); const d = await searchAllPlatforms(q); for (const o of d.arbitrageOpportunities || []) db.prepare('INSERT INTO arbitrage_opportunities(platform,title,price,currency,gold_weight_grams,gold_value_eur,discount_pct,trend_pct,trend_label,url)VALUES(?,?,?,?,?,?,?,?,?,?)').run(o.platform, o.title, o.priceEur, 'EUR', o.goldData?.goldGrams, o.goldData?.goldValueEur, o.goldData?.discountPct, o.goldData?.trend || null, o.goldData?.trendLabel || null, o.url); } catch {} } });

// Vintage ogni 24 ore
cron.schedule('0 3 * * *', async () => { const results = await scanUndervaluedVintage(null).catch(() => []); for (const r of results) db.prepare('INSERT INTO vintage_opportunities(model,hype_score,hype_label,yt_videos,reddit_posts,fb_listings,chrono24_listings,chrono24_avg_price,signal_breakdown)VALUES(?,?,?,?,?,?,?,?,?)').run(r.query, r.hypeScore.score, r.hypeScore.label, r.hypeScore.signals.ytVideosFound, r.hypeScore.signals.redditPosts, r.hypeScore.signals.fbListings, r.hypeScore.signals.chrono24Listings, r.signals.chrono24?.avgPrice || 0, JSON.stringify(r.hypeScore.breakdown)); });

// ─────────────────────────────────────────────
// AVVIO
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async () => {
  const gp = await getGoldPrice().catch(() => null);
  // Setup Telegram webhook se configurato
  if (process.env.RENDER_EXTERNAL_URL) {
    await telegram.setupWebhook(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          ⌚ Watch Price Bot v7 — DEFINITIVO            ║
╠═══════════════════════════════════════════════════════╣
║  Porta:      ${PORT}                                    ║
║  Oro spot:   €${gp?.toFixed(2) || 'N/A'}/g                           ║
╠═══════════════════════════════════════════════════════╣
║  ✅ 11 piattaforme prezzi                             ║
║  ✅ Arbitraggio oro (${Object.keys(WATCH_DATABASE).length} modelli)                   ║
║  ✅ Segnali social (${Object.keys(TOP_WATCH_YOUTUBERS).length} YouTuber)               ║
║  ✅ Facebook Marketplace locale                       ║
║  ✅ ${Object.keys(INDEPENDENT_WATCHMAKERS).length} brand indipendenti (discovery)            ║
║  ✅ Portfolio + ROI tracker                           ║
║  ✅ WatchCharts prezzi storici                        ║
║  ✅ Google News monitor                               ║
║  ✅ Instagram drop monitor                            ║
╠═══════════════════════════════════════════════════════╣
║  Telegram:  ${process.env.TELEGRAM_TOKEN ? '✓ ATTIVO' : '✗ configura TELEGRAM_TOKEN'}               ║
║  eBay API:  ${process.env.EBAY_CLIENT_ID ? '✓ ATTIVO' : '✗ configura EBAY_CLIENT_ID'}               ║
║  YouTube:   ${process.env.YOUTUBE_API_KEY ? '✓ ATTIVO' : '✓ scraping auto'}              ║
║  Email:     ${process.env.SMTP_USER ? '✓ ' + process.env.SMTP_USER : '✗ configura SMTP_USER'}
╚═══════════════════════════════════════════════════════╝
  `);
});
