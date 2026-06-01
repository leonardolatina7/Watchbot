/**
 * External Data Sources v7
 * - WatchCharts (prezzi storici aggregati)
 * - Google Alerts monitor
 * - Instagram Stories monitor per drop indie
 */

const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rUA = () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

// ─────────────────────────────────────────────
// WATCHCHARTS — prezzi storici mercato secondario
// Il "Bloomberg" degli orologi
// ─────────────────────────────────────────────

// Mappa modelli → slug WatchCharts
const WATCHCHARTS_MODELS = {
  'rolex submariner 126610ln': 'rolex-submariner-126610ln',
  'rolex submariner 116610ln': 'rolex-submariner-116610ln',
  'rolex daytona 116500ln': 'rolex-daytona-116500ln',
  'rolex daytona 126500ln': 'rolex-daytona-126500ln',
  'rolex gmt-master ii 126710blnr': 'rolex-gmt-master-ii-126710blnr',
  'rolex day-date 40 228238': 'rolex-day-date-40-228238',
  'patek philippe nautilus 5711': 'patek-philippe-nautilus-5711-1a',
  'patek philippe aquanaut 5167a': 'patek-philippe-aquanaut-5167a',
  'audemars piguet royal oak 15500st': 'audemars-piguet-royal-oak-15500st',
  'audemars piguet royal oak 15202st': 'audemars-piguet-royal-oak-15202st',
  'omega seamaster 300m': 'omega-seamaster-300m-21030422001001',
  'cartier santos large': 'cartier-santos-wssa0018',
};

async function getWatchChartsData(watchModel) {
  try {
    await sleep(1000 + Math.random() * 500);

    // Trova slug corrispondente
    const modelLower = watchModel.toLowerCase();
    let slug = null;
    for (const [key, val] of Object.entries(WATCHCHARTS_MODELS)) {
      if (modelLower.includes(key.split(' ')[0]) && modelLower.includes(key.split(' ')[1] || '')) {
        slug = val;
        break;
      }
    }

    // Se nessuno slug trovato, cerca tramite API di ricerca
    if (!slug) {
      const searchR = await axios.get(`https://watchcharts.com/api/search?q=${encodeURIComponent(watchModel)}`, {
        headers: { 'User-Agent': rUA(), Referer: 'https://watchcharts.com' },
        timeout: 8000,
      });
      const results = searchR.data?.results || searchR.data?.watches || [];
      if (results.length > 0) slug = results[0].slug || results[0].id;
    }

    if (!slug) return null;

    // Fetch dati modello
    const r = await axios.get(`https://watchcharts.com/watches/${slug}`, {
      headers: { 'User-Agent': rUA(), Referer: 'https://watchcharts.com/', Accept: 'text/html' },
      timeout: 12000,
    });

    const $ = cheerio.load(r.data);

    // Estrai dati dal JSON embedded (Next.js __NEXT_DATA__)
    const nextDataMatch = r.data.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const watchData = nextData?.props?.pageProps?.watch || nextData?.props?.pageProps?.data;
        if (watchData) {
          return {
            model: watchData.name || watchModel,
            slug,
            currentPrice: watchData.market_price || watchData.price?.market,
            retailPrice: watchData.retail_price || watchData.price?.retail,
            priceChange1m: watchData.price_change_1m || watchData.changes?.['1m'],
            priceChange3m: watchData.price_change_3m || watchData.changes?.['3m'],
            priceChange6m: watchData.price_change_6m || watchData.changes?.['6m'],
            priceChange1y: watchData.price_change_1y || watchData.changes?.['1y'],
            priceHigh52w: watchData.high_52w,
            priceLow52w: watchData.low_52w,
            marketTrend: deriveMarketTrend(watchData),
            popularity: watchData.popularity_rank,
            url: `https://watchcharts.com/watches/${slug}`,
            source: 'WatchCharts',
          };
        }
      } catch {}
    }

    // Fallback: scraping HTML
    const priceText = $('[class*="market-price"], [class*="MarketPrice"], [data-testid="market-price"]').first().text();
    const price = parseFloat(priceText.replace(/[^\d]/g, '')) || null;
    return price ? { model: watchModel, slug, currentPrice: price, url: `https://watchcharts.com/watches/${slug}`, source: 'WatchCharts' } : null;

  } catch (e) {
    console.error('[WatchCharts]', e.message);
    return null;
  }
}

function deriveMarketTrend(data) {
  const change = data.price_change_3m || data.changes?.['3m'] || 0;
  if (change > 10) return '🚀 Forte rialzo';
  if (change > 3) return '📈 Rialzo';
  if (change > -3) return '➡️ Stabile';
  if (change > -10) return '📉 Ribasso';
  return '🔴 Forte ribasso';
}

// ─────────────────────────────────────────────
// GOOGLE ALERTS — monitor web per brand indie
// Configuriamo alert tramite RSS di Google Alerts
// (Google Alerts genera un feed RSS pubblico)
// ─────────────────────────────────────────────

// Genera URL RSS per Google Alerts
function googleAlertsRSSUrl(query) {
  const encoded = encodeURIComponent(`"${query}" watch`);
  return `https://www.google.com/alerts/feeds/00000000000000000000/${encoded}`;
}

// Google Alerts non ha API pubblica ma genera RSS
// Alternativa: monitoriamo Google News RSS
function googleNewsRSSUrl(query) {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}+watch+orologio&hl=it&gl=IT&ceid=IT:it`;
}

async function checkGoogleAlerts(brandName) {
  try {
    await sleep(500 + Math.random() * 500);
    const rssUrl = googleNewsRSSUrl(brandName);
    const r = await axios.get(rssUrl, {
      headers: { 'User-Agent': rUA(), Accept: 'application/rss+xml,application/xml' },
      timeout: 10000,
    });
    const $ = cheerio.load(r.data, { xmlMode: true });
    const articles = [];
    $('item').each((i, el) => {
      if (i >= 10) return;
      const $el = $(el);
      const title = $el.find('title').first().text().trim();
      const link = $el.find('link').first().text().trim();
      const pubDate = $el.find('pubDate').first().text().trim();
      const source = $el.find('source').first().text().trim();
      if (title && title.toLowerCase().includes(brandName.toLowerCase().split(' ')[0])) {
        articles.push({ title, url: link, publishedAt: pubDate, source: source || 'Google News' });
      }
    });
    return { brandName, articles, newArticles: articles.length };
  } catch (e) {
    console.error('[Google Alerts]', e.message);
    return { brandName, articles: [], newArticles: 0 };
  }
}

// Monitor Google News per tutti i brand indie
async function monitorAllBrandsGoogleNews(brandNames) {
  const results = [];
  for (const name of brandNames.slice(0, 10)) {
    try {
      await sleep(800);
      const data = await checkGoogleAlerts(name);
      if (data.articles.length > 0) results.push(data);
    } catch {}
  }
  return results;
}

// ─────────────────────────────────────────────
// INSTAGRAM STORIES / POST MONITOR
// Monitora account indie per drop announcement
// ─────────────────────────────────────────────

// Parole chiave che indicano un drop imminente
const DROP_KEYWORDS = [
  'available now', 'just dropped', 'new release', 'limited edition',
  'sold out', 'waitlist', 'pre-order', 'launching', 'introducing',
  'disponibile', 'nuovo', 'lancio', 'edizione limitata', 'lista attesa',
  'drop', 'release', 'debut', 'unveil', 'reveal', 'announce',
];

async function checkInstagramForDrop(handle) {
  try {
    await sleep(1500 + Math.random() * 1000);
    const r = await axios.get(`https://www.instagram.com/${handle}/`, {
      headers: {
        'User-Agent': rUA(),
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      timeout: 12000,
    });

    // Estrai ultimi post dal JSON embedded
    const match = r.data.match(/"edge_owner_to_timeline_media":\{(.{0,2000}?)\}/s);
    if (!match) return null;

    // Cerca segnali di drop nel testo della pagina
    const pageText = r.data.toLowerCase();
    const dropSignals = DROP_KEYWORDS.filter(kw => pageText.includes(kw.toLowerCase()));

    // Estrai caption degli ultimi post
    const captionMatches = r.data.match(/"accessibility_caption":"([^"]{10,200})"/g) || [];
    const captions = captionMatches.slice(0, 5).map(m => m.replace(/"accessibility_caption":"/, '').replace(/"$/, ''));

    const hasDropSignal = dropSignals.length > 0;
    const followerMatch = r.data.match(/"edge_followed_by":\{"count":(\d+)/);
    const followers = followerMatch ? parseInt(followerMatch[1]) : 0;

    return {
      handle,
      url: `https://instagram.com/${handle}/`,
      followers,
      hasDropSignal,
      dropKeywordsFound: dropSignals,
      captions: captions.slice(0, 3),
      lastChecked: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[IG drop @${handle}]`, e.message);
    return null;
  }
}

// Monitora tutti gli account indie per drop
async function monitorIndieDrops(independentDatabase) {
  const { INDEPENDENT_WATCHMAKERS } = require('./independentDatabase');
  const drops = [];

  // Raccogli tutti gli handle Instagram dei brand tier 2/3/4
  const handles = [];
  for (const [key, brand] of Object.entries(INDEPENDENT_WATCHMAKERS)) {
    if (brand.tier >= 2 && brand.instagram?.length > 0) {
      handles.push({ handle: brand.instagram[0], brand: { key, ...brand } });
    }
    if (brand.founderInstagram) {
      handles.push({ handle: brand.founderInstagram, brand: { key, ...brand }, isFounder: true });
    }
  }

  // Controlla ogni account
  for (const { handle, brand, isFounder } of handles.slice(0, 15)) {
    try {
      await sleep(2000);
      const result = await checkInstagramForDrop(handle);
      if (result?.hasDropSignal) {
        drops.push({
          ...result, brand, isFounder,
          urgency: 'DROP IMMINENTE — compra prima che esaurisca',
        });
        console.log(`[IG DROP] @${handle} (${brand.name}): ${result.dropKeywordsFound.join(', ')}`);
      }
    } catch {}
  }

  return drops;
}

// ─────────────────────────────────────────────
// CALCOLO ROI PORTFOLIO
// ─────────────────────────────────────────────
async function calculatePortfolioROI(items, searchAllPlatforms, getGoldPrice) {
  const results = [];
  let totalCost = 0, totalValue = 0;

  for (const item of items) {
    try {
      await sleep(1500);
      const marketData = await searchAllPlatforms(item.name);
      const currentMarketPrice = marketData.lowest?.priceEur || null;

      // Valore oro se applicabile
      let goldValue = null;
      if (item.isGold && item.goldGrams) {
        const goldPrice = await getGoldPrice();
        goldValue = Math.round(item.goldGrams * goldPrice);
      }

      const effectiveValue = Math.max(currentMarketPrice || 0, goldValue || 0);
      const roi = effectiveValue && item.purchasePrice
        ? ((effectiveValue - item.purchasePrice) / item.purchasePrice) * 100
        : null;

      // WatchCharts per dati storici
      const wc = await getWatchChartsData(item.name).catch(() => null);

      totalCost += item.purchasePrice || 0;
      totalValue += effectiveValue || item.purchasePrice || 0;

      results.push({
        ...item,
        currentMarketPrice,
        goldValue,
        effectiveValue,
        roi: roi ? Math.round(roi * 10) / 10 : null,
        roiEur: effectiveValue ? Math.round(effectiveValue - (item.purchasePrice || 0)) : null,
        watchCharts: wc,
        marketTrend: wc?.marketTrend || null,
        lowestPlatform: marketData.lowest?.platform,
        lowestUrl: marketData.lowest?.url,
        priceChange1y: wc?.priceChange1y || null,
      });
    } catch (e) {
      console.error(`[ROI] ${item.name}:`, e.message);
      results.push({ ...item, error: e.message });
    }
  }

  const totalROI = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const sorted = [...results].filter(r => r.roi !== null).sort((a, b) => (b.roi || 0) - (a.roi || 0));

  return {
    items: results,
    summary: {
      totalCost, totalValue,
      totalROI: Math.round(totalROI * 10) / 10,
      totalROIEur: Math.round(totalValue - totalCost),
      topGainer: sorted[0] || null,
      topLoser: sorted.at(-1) || null,
      itemCount: results.length,
    },
  };
}

// ─────────────────────────────────────────────
// GOOGLE ALERTS SETUP — configura alert automatici
// ─────────────────────────────────────────────
function getGoogleAlertsSetupInstructions(brandNames) {
  // Genera link per configurare Google Alerts manualmente
  return brandNames.map(name => ({
    brand: name,
    alertUrl: `https://www.google.com/alerts#create:q=${encodeURIComponent(name + ' watch orologio')}&f=1&hl=it`,
    rssUrl: googleNewsRSSUrl(name),
  }));
}

module.exports = {
  getWatchChartsData,
  checkGoogleAlerts,
  monitorAllBrandsGoogleNews,
  monitorIndieDrops,
  checkInstagramForDrop,
  calculatePortfolioROI,
  getGoogleAlertsSetupInstructions,
  googleNewsRSSUrl,
  DROP_KEYWORDS,
};
