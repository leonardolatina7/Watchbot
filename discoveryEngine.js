/**
 * Discovery Engine v6
 * Monitora media, aste, Instagram e forum per trovare
 * indipendenti prima che diventino famosi
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { INDEPENDENT_WATCHMAKERS, INDIE_MEDIA_SOURCES, INDIE_INSTAGRAM_INFLUENCERS, GPHG_SIGNAL_WEIGHT, TIER_WEIGHTS } = require('./independentDatabase');
require('dotenv').config();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
];
const rUA = () => UAS[Math.floor(Math.random() * UAS.length)];

// ─────────────────────────────────────────────
// RSS FEED READER — legge articoli da media
// ─────────────────────────────────────────────
async function readRSSFeed(source) {
  if (!source.rssUrl) return [];
  try {
    await sleep(500 + Math.random() * 500);
    const r = await axios.get(source.rssUrl, {
      headers: { 'User-Agent': rUA(), Accept: 'application/rss+xml,application/xml,text/xml' },
      timeout: 10000,
    });
    const $ = cheerio.load(r.data, { xmlMode: true });
    const articles = [];
    $('item').each((i, el) => {
      if (i >= 20) return;
      const $el = $(el);
      articles.push({
        source: source.name,
        title: $el.find('title').first().text().trim(),
        description: $el.find('description').first().text().replace(/<[^>]+>/g, '').slice(0, 200).trim(),
        url: $el.find('link').first().text().trim() || $el.find('guid').first().text().trim(),
        publishedAt: $el.find('pubDate').first().text().trim(),
        sourceWeight: source.weight,
      });
    });
    return articles;
  } catch (e) {
    console.error(`[RSS ${source.name}]`, e.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// HODINKEE — scraping diretto
// ─────────────────────────────────────────────
async function scrapeHodinkee(brandName) {
  try {
    await sleep(1000 + Math.random() * 800);
    const query = encodeURIComponent(brandName);
    const r = await axios.get(`https://www.hodinkee.com/search?q=${query}`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'en-US,en;q=0.9' }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const articles = [];
    $('[class*="article"], [class*="story"], .post, article').each((i, el) => {
      if (i >= 6) return;
      const $el = $(el);
      const title = $el.find('h1, h2, h3, [class*="title"]').first().text().trim();
      const date = $el.find('time, [class*="date"]').first().text().trim();
      const link = $el.find('a').first().attr('href');
      if (title && title.toLowerCase().includes(brandName.toLowerCase().split(' ')[0])) {
        articles.push({
          source: 'Hodinkee',
          title, date,
          url: link ? (link.startsWith('http') ? link : `https://www.hodinkee.com${link}`) : 'https://www.hodinkee.com',
          sourceWeight: 95,
          isFirstMention: articles.length === 0, // primo risultato = prima menzione
        });
      }
    });
    // Conta menzioni totali
    const bodyText = r.data.toLowerCase();
    const mentionCount = (bodyText.match(new RegExp(brandName.toLowerCase().split(' ')[0], 'g')) || []).length;
    return { articles, mentionCount, hasArticle: articles.length > 0 };
  } catch (e) {
    console.error('[Hodinkee]', e.message);
    return { articles: [], mentionCount: 0, hasArticle: false };
  }
}

// ─────────────────────────────────────────────
// PHILLIPS / CHRISTIE'S / SOTHEBY'S
// Prima apparizione all'asta = legitimacy signal fortissimo
// ─────────────────────────────────────────────
async function scrapeAuctionHouses(brandName) {
  const results = { phillips: null, christies: null, sothebys: null };

  // Phillips
  try {
    await sleep(800);
    const r = await axios.get(`https://www.phillips.com/search#q=${encodeURIComponent(brandName)}&department=Watches`, {
      headers: { 'User-Agent': rUA() }, timeout: 10000
    });
    const $ = cheerio.load(r.data);
    const lots = [];
    $('[class*="lot"], [class*="item"], .search-result').each((i, el) => {
      if (i >= 5) return;
      const $el = $(el);
      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const estimate = $el.find('[class*="estimate"], [class*="price"]').first().text().trim();
      const link = $el.find('a').first().attr('href');
      if (title) lots.push({ title, estimate, url: link ? `https://www.phillips.com${link}` : 'https://www.phillips.com/watches' });
    });
    results.phillips = { lots, count: lots.length, hasResults: lots.length > 0 };
  } catch (e) { console.error('[Phillips]', e.message); }

  // Sotheby's
  try {
    await sleep(700);
    const r = await axios.get(`https://www.sothebys.com/en/results?q=${encodeURIComponent(brandName)}&department=watches`, {
      headers: { 'User-Agent': rUA() }, timeout: 10000
    });
    const $ = cheerio.load(r.data);
    const lots = [];
    $('[class*="lot"], [class*="result-item"], article').each((i, el) => {
      if (i >= 5) return;
      const $el = $(el);
      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const estimate = $el.find('[class*="estimate"], [class*="estimate"]').first().text().trim();
      if (title) lots.push({ title, estimate, url: 'https://www.sothebys.com/en/buy/watches' });
    });
    results.sothebys = { lots, count: lots.length, hasResults: lots.length > 0 };
  } catch (e) { console.error('[Sotheby\'s]', e.message); }

  return results;
}

// ─────────────────────────────────────────────
// INSTAGRAM — menzioni da influencer chiave
// ─────────────────────────────────────────────
async function checkInstagramMentions(brandData) {
  const mentions = [];
  // Controlla profili ufficiali del brand
  for (const handle of (brandData.instagram || []).slice(0, 2)) {
    try {
      await sleep(1200 + Math.random() * 800);
      const r = await axios.get(`https://www.instagram.com/${handle}/`, {
        headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9' }, timeout: 12000
      });
      // Estrai follower count dal JSON embedded
      const followerMatch = r.data.match(/"edge_followed_by":\{"count":(\d+)/);
      const followersCount = followerMatch ? parseInt(followerMatch[1]) : 0;
      const postCountMatch = r.data.match(/"edge_owner_to_timeline_media":\{"count":(\d+)/);
      const postCount = postCountMatch ? parseInt(postCountMatch[1]) : 0;
      mentions.push({
        handle, followersCount, postCount,
        profileUrl: `https://www.instagram.com/${handle}/`,
        isActive: postCount > 0,
        followerGrowthSignal: followersCount > 10000 ? 'high' : followersCount > 1000 ? 'medium' : 'early',
      });
    } catch (e) { console.error(`[IG @${handle}]`, e.message); }
  }
  return mentions;
}

// ─────────────────────────────────────────────
// GPHG — Grand Prix Horlogerie Genève
// Scraping dei nominati e vincitori
// ─────────────────────────────────────────────
async function checkGPHGNomination(brandName) {
  try {
    await sleep(800);
    const r = await axios.get('https://www.gphg.org/horlogerie/en/watches', {
      headers: { 'User-Agent': rUA() }, timeout: 10000
    });
    const $ = cheerio.load(r.data);
    const found = [];
    $('[class*="watch"], [class*="nominee"], article').each((i, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes(brandName.toLowerCase().split(' ')[0])) {
        found.push({
          title: $(el).find('h2, h3, [class*="title"]').first().text().trim(),
          year: new Date().getFullYear(),
          url: 'https://www.gphg.org',
        });
      }
    });
    return { nominated: found.length > 0, nominations: found, signalBonus: found.length > 0 ? GPHG_SIGNAL_WEIGHT : 0 };
  } catch (e) {
    console.error('[GPHG]', e.message);
    return { nominated: false, nominations: [], signalBonus: 0 };
  }
}

// ─────────────────────────────────────────────
// REDDIT — cerca menzioni brand indie
// ─────────────────────────────────────────────
async function searchRedditForBrand(brandData) {
  try {
    await sleep(600);
    const searchTerms = [brandData.name, ...(brandData.searchTerms || []).slice(0, 2)];
    const query = searchTerms.join(' OR ');
    const r = await axios.get(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=year&limit=20&type=link`,
      { headers: { 'User-Agent': 'WatchPriceBot/6.0' }, timeout: 10000 }
    );
    const posts = r.data?.data?.children || [];
    const watchPosts = posts.filter(p => {
      const sub = p.data.subreddit.toLowerCase();
      return ['watches', 'watchexchange', 'vintageWatches', 'watchhorology', 'independentwatches'].includes(sub);
    });
    const recentPosts = watchPosts.filter(p => (Date.now() - p.data.created_utc * 1000) < 90 * 86400000); // 90 giorni
    const totalUpvotes = watchPosts.reduce((s, p) => s + p.data.ups, 0);
    return {
      totalPosts: watchPosts.length,
      recentPosts: recentPosts.length,
      totalUpvotes,
      topPosts: watchPosts.slice(0, 5).map(p => ({
        title: p.data.title,
        upvotes: p.data.ups,
        subreddit: p.data.subreddit,
        url: `https://reddit.com${p.data.permalink}`,
        age: Math.round((Date.now() - p.data.created_utc * 1000) / 86400000) + 'd',
      })),
      growthSignal: recentPosts.length >= 5 ? 'explosive' : recentPosts.length >= 2 ? 'growing' : recentPosts.length >= 1 ? 'emerging' : 'quiet',
    };
  } catch (e) {
    console.error('[Reddit indie]', e.message);
    return { totalPosts: 0, recentPosts: 0, totalUpvotes: 0, topPosts: [], growthSignal: 'quiet' };
  }
}

// ─────────────────────────────────────────────
// DISCOVERY SCORE — algoritmo predittivo
// Misura "quanto è ancora sotto i radar"
// Alto score = ancora buona finestra di acquisto
// Basso score = già scoperto = prezzi alti
// ─────────────────────────────────────────────
function calculateDiscoveryScore(brandData, signals) {
  const {
    hodinkee = {}, auctions = {}, instagram = [],
    reddit = {}, gphg = {},
  } = signals;

  // Base: discovery score del brand (configurato nel database)
  let score = brandData.discoveryScore || 50;

  // Modifica in base ai segnali trovati
  // Hodinkee: se ha articoli = già scoperto = abbassa il score
  if (hodinkee.hasArticle) score -= 15;
  if (hodinkee.mentionCount > 10) score -= 10;

  // Aste: prima apparizione = COMPRARE ORA (score scende = finestra chiudendo)
  if (auctions.phillips?.hasResults || auctions.sothebys?.hasResults) score -= 20;

  // Reddit: crescita recente = trend in corso
  if (reddit.growthSignal === 'explosive') score -= 15;
  if (reddit.growthSignal === 'growing') score -= 8;
  if (reddit.growthSignal === 'emerging') score -= 3;

  // GPHG: nominazione = mainstreaming in corso
  if (gphg.nominated) score -= 20;

  // Instagram followers: pochi = ancora early
  const totalFollowers = instagram.reduce((s, i) => s + (i.followersCount || 0), 0);
  if (totalFollowers > 100000) score -= 15;
  else if (totalFollowers > 10000) score -= 5;
  else if (totalFollowers < 1000) score += 10; // ancora sconosciuto

  score = Math.max(0, Math.min(100, score));

  // Urgency: quanto tempo rimane prima che "esploda"
  const urgency = score > 75 ? '🟢 Finestra ampia' :
                  score > 55 ? '🟡 Finestra si sta chiudendo' :
                  score > 35 ? '🟠 Finestra quasi chiusa' :
                  '🔴 Già scoperto';

  // Investment thesis
  const thesis = score > 70 ? 'Entry ideale — pochi lo conoscono, trend in crescita' :
                 score > 50 ? 'Ancora accessibile — comprare prima del prossimo articolo su Hodinkee' :
                 score > 30 ? 'Semi-mainstream — possibile ma premium già incorporato' :
                 'Mainstream — acquisto sicuro ma upside limitato';

  return { score, urgency, thesis };
}

// ─────────────────────────────────────────────
// ANALISI COMPLETA BRAND INDIPENDENTE
// ─────────────────────────────────────────────
async function analyzeIndependentBrand(brandKey) {
  const brand = INDEPENDENT_WATCHMAKERS[brandKey];
  if (!brand) return null;

  console.log(`\n[DISCOVERY] "${brand.name}" (Tier ${brand.tier})`);
  const t0 = Date.now();

  const [hodinkeeData, auctionData, igData, redditData, gphgData] = await Promise.allSettled([
    scrapeHodinkee(brand.name),
    scrapeAuctionHouses(brand.name),
    checkInstagramMentions(brand),
    searchRedditForBrand(brand),
    checkGPHGNomination(brand.name),
  ]);

  const signals = {
    hodinkee:  hodinkeeData.status  === 'fulfilled' ? hodinkeeData.value  : {},
    auctions:  auctionData.status   === 'fulfilled' ? auctionData.value   : {},
    instagram: igData.status        === 'fulfilled' ? igData.value        : [],
    reddit:    redditData.status    === 'fulfilled' ? redditData.value    : {},
    gphg:      gphgData.status      === 'fulfilled' ? gphgData.value      : {},
  };

  const discovery = calculateDiscoveryScore(brand, signals);
  const tierInfo = TIER_WEIGHTS[brand.tier] || {};

  console.log(`[DISCOVERY] ${brand.name} → Discovery: ${discovery.score} | ${discovery.urgency} | ${Date.now()-t0}ms`);

  return {
    brandKey,
    brand,
    signals,
    discovery,
    tierInfo,
    timestamp: new Date().toISOString(),
    // Alert conditions
    alerts: {
      firstHodinkeeArticle: signals.hodinkee?.hasArticle && (signals.hodinkee?.articles?.[0]?.isFirstMention),
      firstAuctionAppearance: signals.auctions?.phillips?.hasResults || signals.auctions?.sothebys?.hasResults,
      gphgNomination: signals.gphg?.nominated,
      redditExploding: signals.reddit?.growthSignal === 'explosive',
    },
  };
}

// ─────────────────────────────────────────────
// SCAN COMPLETO — tutti i brand da scoprire
// ─────────────────────────────────────────────
async function scanAllIndependents() {
  const results = [];
  // Priorità: tier 3 e 4 prima (quelli da scoprire)
  const sortedKeys = Object.keys(INDEPENDENT_WATCHMAKERS).sort((a, b) => {
    const ta = INDEPENDENT_WATCHMAKERS[a].tier;
    const tb = INDEPENDENT_WATCHMAKERS[b].tier;
    return tb - ta; // tier 4 prima
  });

  for (const key of sortedKeys.slice(0, 12)) { // max 12 per volta
    try {
      await sleep(3000);
      const analysis = await analyzeIndependentBrand(key);
      if (analysis) results.push(analysis);
    } catch (e) {
      console.error(`[INDIE SCAN] ${key}:`, e.message);
    }
  }

  return results.sort((a, b) => {
    // Ordina per: tier più alto + discovery score più alto = opportunità migliore
    const scoreA = (a.brand.tier * 10) + a.discovery.score;
    const scoreB = (b.brand.tier * 10) + b.discovery.score;
    return scoreB - scoreA;
  });
}

// ─────────────────────────────────────────────
// MONITOR RSS — articoli nuovi in tempo reale
// Chiama ogni ora per trovare prima menzioni
// ─────────────────────────────────────────────
async function checkNewArticles() {
  const allArticles = [];
  for (const source of INDIE_MEDIA_SOURCES.filter(s => s.rssUrl)) {
    try {
      await sleep(400);
      const articles = await readRSSFeed(source);
      allArticles.push(...articles);
    } catch {}
  }

  // Controlla se qualche articolo menziona brand indie
  const matches = [];
  for (const article of allArticles) {
    for (const [key, brand] of Object.entries(INDEPENDENT_WATCHMAKERS)) {
      const searchTerms = [brand.name, ...(brand.searchTerms || [])];
      const articleText = (article.title + ' ' + article.description).toLowerCase();
      if (searchTerms.some(t => articleText.includes(t.toLowerCase()))) {
        matches.push({
          article,
          brand: { key, ...brand },
          matchedTerm: searchTerms.find(t => articleText.includes(t.toLowerCase())),
          importance: article.sourceWeight,
          isFirstTimeSeen: brand.tier >= 3, // per brand poco noti, ogni articolo è importante
        });
      }
    }
  }

  return matches.sort((a, b) => b.importance - a.importance);
}

module.exports = {
  analyzeIndependentBrand,
  scanAllIndependents,
  checkNewArticles,
  scrapeHodinkee,
  scrapeAuctionHouses,
  checkGPHGNomination,
  searchRedditForBrand,
  calculateDiscoveryScore,
};
