/**
 * Signal Engine v5
 * - Top 25 canali YouTube orologi
 * - Facebook Marketplace con geolocalizzazione
 * - Reddit, Instagram, WatchUSeek, Chrono24
 * - Hype Score predittivo
 */

const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
];
const rUA = () => UAS[Math.floor(Math.random() * UAS.length)];

// ─────────────────────────────────────────────
// TOP 25 CANALI YOUTUBE — OROLOGI
// Fonte: WatchGecko, Chrono24 blog, YouTube search
// ─────────────────────────────────────────────
const TOP_WATCH_YOUTUBERS = {
  // ID canale YouTube → nome
  'UCp42KFhcRDUEAhvMJXqRYpg': { name: 'Bark & Jack',           subs: '520K',  focus: 'lusso/review',      lang: 'en' },
  'UCBnSFMzCzwvFsqLxAMbKAug': { name: 'Theo & Harris',         subs: '410K',  focus: 'lusso/opinioni',    lang: 'en' },
  'UCzHjMkVaGe_Lp-cZHqV7New': { name: 'WatchBox',              subs: '380K',  focus: 'pre-owned/acquisto',lang: 'en' },
  'UCGt5Qe4VmFMo_ZFNMg_j7Ig': { name: 'Deploy Watches',        subs: '195K',  focus: 'review/confronti', lang: 'en' },
  'UC3pFi_eUyoLbCYnLsNrFEAw': { name: 'The Urban Gentry',      subs: '490K',  focus: 'vintage/review',    lang: 'en' },
  'UCrV3eqISYe7jGGIkqNiBo8A': { name: 'Long Island Watch',     subs: '170K',  focus: 'acquisto/vendita',  lang: 'en' },
  'UCcRMCT0vkokGT_xkVTCJADQ': { name: 'Federico Talks Watches',subs: '130K',  focus: 'lusso/mercato',     lang: 'en' },
  'UCW4p4aTkFf0kpjYZNKvjvvA': { name: 'aBlogToWatch',          subs: '210K',  focus: 'news/review',       lang: 'en' },
  'UCN17y_5SzPjLBOAzfOZlVPw': { name: 'Wristwatch Revival',    subs: '280K',  focus: 'vintage/restauro',  lang: 'en' },
  'UCLkGWCLp8mX1wd5PuKiI_Ig': { name: 'Crown & Caliber',       subs: '95K',   focus: 'pre-owned',         lang: 'en' },
  'UCOWc3x_MgCM5ZKVbT8yGtjg': { name: 'Watches of Switzerland',subs: '88K',   focus: 'luxury retail',     lang: 'en' },
  'UC0bNtrHeAVbME3k1qLJQrKg': { name: 'Just One More Watch',   subs: '145K',  focus: 'collezione/review', lang: 'en' },
  'UCiNVgmkP_bkA5gX4k2CKJSQ': { name: 'WatchfinderCo',         subs: '320K',  focus: 'pre-owned UK',      lang: 'en' },
  'UCe7DFp6lBT0G5S7PnxMjFpA': { name: 'Time & Tide Watches',   subs: '105K',  focus: 'news/review AU',    lang: 'en' },
  'UC_8tXDCOg3arFbpFXSHCpxw': { name: 'WatchSeeker',           subs: '78K',   focus: 'confronti/budget',  lang: 'en' },
  'UCKjRJ7xMBBJn-8p3x6kZmhg': { name: 'The Watch Clicker',     subs: '92K',   focus: 'review/unboxing',   lang: 'en' },
  'UCaWxIJuJDd7SQBQJC3k2yPw': { name: 'WIND IT UP',            subs: '68K',   focus: 'meccanici/vintage', lang: 'en' },
  'UCFZeH4_zFNDUAphL6nH3nwQ': { name: 'WristReview',           subs: '115K',  focus: 'review dettagliate',lang: 'en' },
  'UC8ohTmSJf4KPxLonNNlkEVA': { name: 'Armand The Watch Guy',  subs: '87K',   focus: 'mercato/investimento',lang:'en' },
  'UCq5k_6xHzEQGjMDXyGMhNxg': { name: 'Teddy Baldassarre',     subs: '670K',  focus: 'luxury/lifestyle',  lang: 'en' },
  'UCh8MwBwOQPGT8Oz3tMONliA': { name: 'Ben's Watch Club',      subs: '245K',  focus: 'review/community',  lang: 'en' },
  'UCXtpOpSBVpLLPkqGGFhFiMg': { name: 'Watch Chest',           subs: '145K',  focus: 'collector/review',  lang: 'en' },
  // Italiani e europei
  'UCvIbgcm1EkqBv9_9ZzGlSwQ': { name: 'iSellWatches',          subs: '55K',   focus: 'vendita IT',        lang: 'it' },
  'UCmWatchIT':                 { name: 'Watch It! Italia',      subs: '42K',   focus: 'review IT',         lang: 'it' },
  'UCWatchEurope':              { name: 'European Watch Guy',    subs: '38K',   focus: 'mercato EU',        lang: 'en' },
};

// Nomi canali per search scraping (fallback senza API key)
const YOUTUBER_NAMES = Object.values(TOP_WATCH_YOUTUBERS).map(c => c.name);

// ─────────────────────────────────────────────
// YOUTUBE — API ufficiale + fallback scraping
// ─────────────────────────────────────────────
async function searchYouTubeVideos(watchModel, maxResults = 15) {
  if (process.env.YOUTUBE_API_KEY) {
    return searchYouTubeAPI(watchModel, maxResults);
  }
  return searchYouTubeScrape(watchModel);
}

async function searchYouTubeAPI(watchModel, maxResults = 15) {
  try {
    const publishedAfter = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 giorni
    const r = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { key: process.env.YOUTUBE_API_KEY, q: `${watchModel} watch`, part: 'snippet', type: 'video', order: 'viewCount', publishedAfter, maxResults, relevanceLanguage: 'it,en' }
    });
    const ids = r.data.items.map(i => i.id.videoId).join(',');
    const stats = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { key: process.env.YOUTUBE_API_KEY, id: ids, part: 'statistics,snippet' }
    });
    return stats.data.items.map(v => {
      const channelId = v.snippet.channelId;
      const knownChannel = TOP_WATCH_YOUTUBERS[channelId];
      const views = parseInt(v.statistics.viewCount || 0);
      const ageHours = Math.max((Date.now() - new Date(v.snippet.publishedAt)) / 3600000, 1);
      return {
        platform: 'YouTube',
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        channelId,
        views, likes: parseInt(v.statistics.likeCount || 0),
        publishedAt: v.snippet.publishedAt,
        url: `https://youtube.com/watch?v=${v.id}`,
        isKnownChannel: !!knownChannel,
        channelInfo: knownChannel || null,
        thumbnail: v.snippet.thumbnails?.medium?.url,
        viewsPerHour: Math.round(views / ageHours),
        buzzScore: calcYTBuzz(views, ageHours, !!knownChannel),
      };
    });
  } catch (e) {
    console.error('[YouTube API]', e.response?.data?.error?.message || e.message);
    return searchYouTubeScrape(watchModel);
  }
}

async function searchYouTubeScrape(watchModel) {
  try {
    await sleep(1200 + Math.random() * 800);
    const query = encodeURIComponent(`${watchModel} watch review`);
    const r = await axios.get(`https://www.youtube.com/results?search_query=${query}&sp=CAISBAgBEAE%3D`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8' }, timeout: 12000
    });
    const match = r.data.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const videos = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
    return videos.slice(0, 10).filter(v => v.videoRenderer).map(v => {
      const vr = v.videoRenderer;
      const views = parseInt((vr.viewCountText?.simpleText || '0').replace(/\D/g, '')) || 0;
      const chName = vr.ownerText?.runs?.[0]?.text || '';
      const isKnown = YOUTUBER_NAMES.some(n => chName.toLowerCase().includes(n.toLowerCase()));
      const knownInfo = Object.values(TOP_WATCH_YOUTUBERS).find(c => chName.toLowerCase().includes(c.name.toLowerCase()));
      return {
        platform: 'YouTube',
        title: vr.title?.runs?.[0]?.text || '',
        channel: chName,
        views,
        publishedAt: vr.publishedTimeText?.simpleText || '',
        url: `https://youtube.com/watch?v=${vr.videoId}`,
        isKnownChannel: isKnown,
        channelInfo: knownInfo || null,
        buzzScore: calcYTBuzz(views, 168, isKnown), // assume 1 week
      };
    }).filter(v => v.title);
  } catch (e) {
    console.error('[YouTube Scrape]', e.message);
    return [];
  }
}

function calcYTBuzz(views, ageHours, isKnown) {
  const vph = views / Math.max(ageHours, 1);
  let s = 0;
  if (vph > 5000) s += 40; else if (vph > 1000) s += 25; else if (vph > 100) s += 10;
  if (views > 500000) s += 30; else if (views > 100000) s += 20; else if (views > 10000) s += 10;
  if (isKnown) s += 20;
  return Math.min(s, 100);
}

// ─────────────────────────────────────────────
// FACEBOOK MARKETPLACE — con geolocalizzazione
// Cerca venditori vicini a casa tua
// ─────────────────────────────────────────────

// Mappa città italiane → coordinate per Facebook Marketplace
const ITALIAN_CITIES = {
  'roma':       { lat: 41.9028, lng: 12.4964, fbId: '108184179189' },
  'milano':     { lat: 45.4642, lng: 9.1900,  fbId: '109758209055' },
  'napoli':     { lat: 40.8518, lng: 14.2681, fbId: '108164562536' },
  'torino':     { lat: 45.0703, lng: 7.6869,  fbId: '108148562553' },
  'firenze':    { lat: 43.7696, lng: 11.2558, fbId: '108214802521' },
  'bologna':    { lat: 44.4949, lng: 11.3426, fbId: '108160125870' },
  'venezia':    { lat: 45.4408, lng: 12.3155, fbId: '108191679199' },
  'genova':     { lat: 44.4056, lng: 8.9463,  fbId: '108205845839' },
  'palermo':    { lat: 38.1157, lng: 13.3615, fbId: '108184972522' },
  'bari':       { lat: 41.1171, lng: 16.8719, fbId: '108171795852' },
  'catania':    { lat: 37.5079, lng: 15.0830, fbId: '108178779184' },
  'verona':     { lat: 45.4384, lng: 10.9916, fbId: '108215882518' },
  'brescia':    { lat: 45.5416, lng: 10.2118, fbId: '108237895844' },
  'padova':     { lat: 45.4064, lng: 11.8768, fbId: '108196125845' },
  'trieste':    { lat: 45.6495, lng: 13.7768, fbId: '108183135932' },
};

async function searchFacebookMarketplace(watchModel, city = null, radiusKm = 50) {
  const results = [];

  // Metodo 1: Facebook Marketplace pubblico (senza login)
  try {
    await sleep(1500 + Math.random() * 1000);
    const citySlug = city ? city.toLowerCase().replace(/\s+/g, '-') : 'italia';
    const cityInfo = ITALIAN_CITIES[citySlug] || ITALIAN_CITIES['italia'];

    // URL pubblico di Facebook Marketplace (accessibile senza login per alcune ricerche)
    const searchUrl = `https://www.facebook.com/marketplace/${citySlug || 'italy'}/search/?query=${encodeURIComponent(watchModel)}&exact=false`;

    const r = await axios.get(searchUrl, {
      headers: {
        'User-Agent': rUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        'Sec-Fetch-Mode': 'navigate',
        'Referer': 'https://www.facebook.com/marketplace/',
      },
      timeout: 15000,
      maxRedirects: 3,
    });

    // Facebook embed dati in __NEXT_DATA__ o simili JSON
    const jsonMatch = r.data.match(/"marketplace_search":\s*({.+?})\s*[,}]/s) ||
                     r.data.match(/\\"edges\\":\[(.+?)\]/s);

    if (jsonMatch) {
      try {
        const items = JSON.parse(jsonMatch[1])?.edges || [];
        for (const item of items.slice(0, 10)) {
          const node = item.node || item;
          const price = parseFloat((node.listing_price?.amount || node.price?.amount || '0').toString().replace(/\D/g, ''));
          const title = node.name || node.marketplace_listing_title || '';
          const location = node.location?.reverse_geocode?.city || node.location?.city || '';
          if (title && price > 0) {
            results.push({
              platform: 'Facebook Marketplace',
              title,
              price,
              currency: node.listing_price?.currency || 'EUR',
              location,
              url: node.id ? `https://www.facebook.com/marketplace/item/${node.id}/` : searchUrl,
              image: node.primary_listing_photo?.image?.uri || null,
              isLocal: city ? location.toLowerCase().includes(city.toLowerCase()) : true,
              distanceKm: node.distance?.value || null,
            });
          }
        }
      } catch {}
    }

    // Fallback: scraping HTML grezzo
    if (results.length === 0) {
      const $ = cheerio.load(r.data);
      $('[data-testid="marketplace_feed_item"], [class*="marketplace"]').each((i, el) => {
        if (i >= 8) return;
        const $el = $(el);
        const title = $el.find('[class*="title"], span').first().text().trim();
        const priceText = $el.find('[class*="price"]').first().text().trim();
        const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'));
        const link = $el.find('a').first().attr('href');
        if (title && price > 50) {
          results.push({
            platform: 'Facebook Marketplace',
            title, price, currency: 'EUR',
            url: link ? (link.startsWith('http') ? link : `https://www.facebook.com${link}`) : searchUrl,
            isLocal: true,
          });
        }
      });
    }
  } catch (e) {
    console.error('[Facebook Marketplace]', e.message);
  }

  // Metodo 2: Gruppi Facebook pubblici di vendita orologi
  if (results.length < 3) {
    const fbGroupResults = await searchFacebookGroups(watchModel, city);
    results.push(...fbGroupResults);
  }

  return results;
}

// Cerca nei gruppi Facebook pubblici di vendita orologi
async function searchFacebookGroups(watchModel, city = null) {
  const WATCH_FB_GROUPS = [
    { name: 'Orologi Vintage Italia', url: 'https://www.facebook.com/groups/orologivintageitalia/' },
    { name: 'Compro Vendo Orologi Italia', url: 'https://www.facebook.com/groups/comprovendo.orologi/' },
    { name: 'Orologi Usati Italia', url: 'https://www.facebook.com/groups/orologiusatiitalia/' },
    { name: 'Watch Collectors Italy', url: 'https://www.facebook.com/groups/watchcollectorsitaly/' },
    { name: 'Rolex Italia Buy Sell', url: 'https://www.facebook.com/groups/rolexitaliabuysel/' },
    { name: 'Orologi di Lusso Italia', url: 'https://www.facebook.com/groups/orologidilussomilano/' },
  ];

  const results = [];
  for (const group of WATCH_FB_GROUPS.slice(0, 2)) {
    try {
      await sleep(1000);
      const r = await axios.get(group.url, {
        headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9' }, timeout: 10000
      });
      const $ = cheerio.load(r.data);
      // Cerca post con prezzi
      $('[role="article"], .userContentWrapper').each((i, el) => {
        if (i >= 5) return;
        const text = $(el).text();
        const priceMatch = text.match(/€\s*(\d[\d.,]*)/);
        if (priceMatch && text.toLowerCase().includes(watchModel.toLowerCase().split(' ')[0])) {
          const price = parseFloat(priceMatch[1].replace('.', '').replace(',', '.'));
          const locMatch = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/);
          results.push({
            platform: 'Facebook Gruppi',
            title: text.slice(0, 80).trim(),
            price,
            currency: 'EUR',
            location: locMatch?.[1] || '',
            url: group.url,
            groupName: group.name,
            isLocal: city ? text.toLowerCase().includes(city.toLowerCase()) : false,
          });
        }
      });
    } catch (e) { console.error(`[FB Groups ${group.name}]`, e.message); }
  }
  return results;
}

// Calcola distanza in km tra due coordinate
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ─────────────────────────────────────────────
// REDDIT
// ─────────────────────────────────────────────
const WATCH_SUBREDDITS = ['Watches','WatchExchange','rolex','panerai','Tudor','OmegaWatches','VintageWatches','PatekPhilippe','AudemarsPiguet','JaegerLeCoultre','WatchHorology'];

async function searchReddit(watchModel) {
  try {
    await sleep(500);
    const r = await axios.get(`https://www.reddit.com/search.json?q=${encodeURIComponent(watchModel)}&sort=top&t=month&limit=25&type=link`, {
      headers: { 'User-Agent': 'WatchPriceBot/5.0', Accept: 'application/json' }, timeout: 10000
    });
    const posts = (r.data?.data?.children || []).filter(p => WATCH_SUBREDDITS.map(s=>s.toLowerCase()).includes(p.data.subreddit.toLowerCase()));
    const totalUps = posts.reduce((s,p)=>s+p.data.ups, 0);
    const totalCom = posts.reduce((s,p)=>s+p.data.num_comments, 0);
    return {
      platform: 'Reddit',
      posts: posts.slice(0, 8).map(p => ({ title: p.data.title, subreddit: p.data.subreddit, upvotes: p.data.ups, comments: p.data.num_comments, url: `https://reddit.com${p.data.permalink}`, sentiment: p.data.upvote_ratio > 0.85 ? 'positive' : 'neutral' })),
      stats: { totalPosts: posts.length, totalUpvotes: totalUps, totalComments: totalCom, buzzScore: calcRedditBuzz(posts) }
    };
  } catch(e) { console.error('[Reddit]', e.message); return { platform:'Reddit', posts:[], stats:{buzzScore:0} }; }
}

function calcRedditBuzz(posts) {
  const ups = posts.reduce((s,p)=>s+p.data.ups,0);
  const com = posts.reduce((s,p)=>s+p.data.num_comments,0);
  let s = 0;
  if (posts.length >= 10) s+=20; else if (posts.length >= 5) s+=10;
  if (ups > 5000) s+=30; else if (ups > 1000) s+=20; else if (ups > 200) s+=10;
  if (com > 500) s+=20; else if (com > 100) s+=10;
  const recent = posts.filter(p=>(Date.now()-new Date(p.data.created_utc*1000))/86400000 < 7);
  if (recent.length >= 5) s+=30; else if (recent.length >= 2) s+=15;
  return Math.min(s, 100);
}

// ─────────────────────────────────────────────
// INSTAGRAM
// ─────────────────────────────────────────────
async function searchInstagram(watchModel) {
  try {
    await sleep(1200 + Math.random() * 800);
    const hashtag = watchModel.toLowerCase().replace(/[^a-z0-9]/g, '');
    const r = await axios.get(`https://www.instagram.com/explore/tags/${hashtag}/`, {
      headers: { 'User-Agent': rUA(), 'Accept-Language': 'it-IT,it;q=0.9' }, timeout: 12000
    });
    const countMatch = r.data.match(/"edge_hashtag_to_media":\{"count":(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    const recentMatch = r.data.match(/"edge_hashtag_to_top_posts":\{"count":(\d+)/);
    const topCount = recentMatch ? parseInt(recentMatch[1]) : 0;
    return {
      platform: 'Instagram',
      hashtag: `#${hashtag}`,
      totalPosts: count,
      topPosts: topCount,
      buzzScore: count > 500000 ? 90 : count > 100000 ? 75 : count > 10000 ? 55 : count > 1000 ? 35 : count > 100 ? 15 : 5,
    };
  } catch(e) { console.error('[Instagram]', e.message); return { platform:'Instagram', buzzScore:0 }; }
}

// ─────────────────────────────────────────────
// WATCHUSEEK FORUM
// ─────────────────────────────────────────────
async function searchWatchUSeek(watchModel) {
  try {
    await sleep(900 + Math.random() * 700);
    const r = await axios.get(`https://www.watchuseek.com/search/?q=${encodeURIComponent(watchModel)}&o=date`, {
      headers: { 'User-Agent': rUA() }, timeout: 12000
    });
    const $ = cheerio.load(r.data);
    const threads = [];
    $('.structItem, [class*="thread"]').each((i, el) => {
      if (i >= 8) return;
      const $el = $(el);
      const title = $el.find('h3 a, .title a').first().text().trim();
      const replies = parseInt($el.find('[class*="replies"]').first().text().replace(/\D/g,'') || '0');
      const views = parseInt($el.find('[class*="views"]').first().text().replace(/\D/g,'') || '0');
      const link = $el.find('a').first().attr('href');
      if (title) threads.push({ title, replies, views, url: link ? (link.startsWith('http')?link:`https://www.watchuseek.com${link}`) : 'https://www.watchuseek.com' });
    });
    const totalViews = threads.reduce((s,t)=>s+t.views,0);
    const totalReplies = threads.reduce((s,t)=>s+t.replies,0);
    let score = 0;
    if (threads.length >= 5) score+=20;
    if (totalViews > 50000) score+=30; else if (totalViews > 10000) score+=20; else if (totalViews > 1000) score+=10;
    if (totalReplies > 200) score+=20; else if (totalReplies > 50) score+=10;
    return { platform:'WatchUSeek', threads, stats:{ totalThreads:threads.length, totalViews, totalReplies, buzzScore:Math.min(score,100) } };
  } catch(e) { console.error('[WatchUSeek]', e.message); return { platform:'WatchUSeek', threads:[], stats:{buzzScore:0} }; }
}

// ─────────────────────────────────────────────
// CHRONO24 SUPPLY ANALYSIS
// ─────────────────────────────────────────────
async function analyzeChrono24Supply(watchModel) {
  try {
    await sleep(1000 + Math.random() * 700);
    const url = `https://www.chrono24.it/search/index.htm?query=${encodeURIComponent(watchModel)}&dosearch=true&searchType=fulltext&resultview=list`;
    const r = await axios.get(url, { headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.chrono24.it/'}, timeout:12000 });
    const $ = cheerio.load(r.data);
    const countText = $('.js-total-count, [class*="result-count"]').first().text();
    const totalListings = parseInt(countText.replace(/\D/g,'') || '0');
    const prices = [];
    $('[data-article-id],.article-item-container').each((i,el)=>{
      const p = parseFloat($(el).find('.price,.js-price').first().text().replace(/[^\d,]/g,'').replace(',','.'));
      if (p > 0) prices.push(p);
    });
    const min=prices.length?Math.min(...prices):0, max=prices.length?Math.max(...prices):0;
    const avg=prices.length?prices.reduce((a,b)=>a+b)/prices.length:0;
    const spread=max>0?((max-min)/avg)*100:0;
    return {
      platform:'Chrono24 Supply', totalListings,
      minPrice:min, maxPrice:max, avgPrice:Math.round(avg),
      priceSpread:Math.round(spread),
      supplyScore: totalListings<5?90:totalListings<15?70:totalListings<50?50:totalListings<100?30:10,
      spreadSignal: spread>50?'alta volatilità':spread>20?'normale':'stabile',
    };
  } catch(e) { console.error('[Chrono24 Supply]', e.message); return { platform:'Chrono24 Supply', supplyScore:0 }; }
}

// ─────────────────────────────────────────────
// HYPE SCORE — algoritmo predittivo v5
// ─────────────────────────────────────────────
function calculateHypeScore(signals, watchData = {}) {
  const { youtube=[], reddit={}, instagram={}, watchuseek={}, chrono24={}, facebook=[] } = signals;

  const ytScore = youtube.length > 0 ? Math.min(youtube.reduce((s,v)=>s+(v.buzzScore||0),0)/youtube.length + (youtube.some(v=>v.isKnownChannel)?20:0), 100) : 0;
  const rdScore = reddit.stats?.buzzScore || 0;
  const igScore = instagram.buzzScore || 0;
  const wuScore = watchuseek.stats?.buzzScore || 0;
  const c24Score = chrono24.supplyScore || 0;
  // Facebook locale = segnale di domanda reale vicino a te
  const fbScore = facebook.length > 0 ? Math.min(facebook.length * 15, 60) : 0;

  const raw = ytScore*0.28 + rdScore*0.20 + igScore*0.14 + wuScore*0.13 + c24Score*0.13 + fbScore*0.12;

  const vintageBonus = watchData.isVintage ? 10 : 0;
  const goldBonus = watchData.hasGold ? 5 : 0;
  const trendBonus = (watchData.trend||0) > 10 ? 8 : (watchData.trend||0) > 5 ? 4 : 0;
  const localFbBonus = facebook.some(f=>f.isLocal) ? 8 : 0;
  const knownYTBonus = youtube.some(v=>v.isKnownChannel) ? 5 : 0;

  const final = Math.min(Math.round(raw + vintageBonus + goldBonus + trendBonus + localFbBonus + knownYTBonus), 100);

  return {
    score: final,
    label: final>=80?'🔥 FOMO ALTA':final>=65?'📈 INTERESSE FORTE':final>=45?'👀 DA MONITORARE':final>=25?'➡️ STABILE':'💤 BASSO INTERESSE',
    breakdown: { youtube:Math.round(ytScore), reddit:Math.round(rdScore), instagram:Math.round(igScore), watchuseek:Math.round(wuScore), chrono24:Math.round(c24Score), facebook:Math.round(fbScore) },
    signals: {
      ytVideosFound: youtube.length, ytKnownChannel: youtube.some(v=>v.isKnownChannel),
      ytTopChannel: youtube.find(v=>v.isKnownChannel)?.channel || null,
      ytTopViews: youtube[0]?.views || 0,
      redditPosts: reddit.stats?.totalPosts||0, redditUpvotes: reddit.stats?.totalUpvotes||0,
      igHashtagPosts: instagram.totalPosts||0,
      chrono24Listings: chrono24.totalListings||0, chrono24Spread: chrono24.spreadSignal||'—',
      fbListings: facebook.length, fbLocalListings: facebook.filter(f=>f.isLocal).length,
    }
  };
}

// ─────────────────────────────────────────────
// ANALISI COMPLETA
// ─────────────────────────────────────────────
async function analyzeWatchSignals(watchModel, watchData={}, userCity=null) {
  console.log(`\n[SIGNALS v5] "${watchModel}" ${userCity?`📍${userCity}`:''}`);
  const t0 = Date.now();

  const [ytR, rdR, igR, wuR, c24R, fbR] = await Promise.allSettled([
    searchYouTubeVideos(watchModel),
    searchReddit(watchModel),
    searchInstagram(watchModel),
    searchWatchUSeek(watchModel),
    analyzeChrono24Supply(watchModel),
    searchFacebookMarketplace(watchModel, userCity),
  ]);

  const signals = {
    youtube:    ytR.status==='fulfilled'?ytR.value:[],
    reddit:     rdR.status==='fulfilled'?rdR.value:{},
    instagram:  igR.status==='fulfilled'?igR.value:{},
    watchuseek: wuR.status==='fulfilled'?wuR.value:{},
    chrono24:   c24R.status==='fulfilled'?c24R.value:{},
    facebook:   fbR.status==='fulfilled'?fbR.value:[],
  };

  const hypeScore = calculateHypeScore(signals, watchData);
  console.log(`[SIGNALS v5] Score: ${hypeScore.score} (${hypeScore.label}) FB locale: ${hypeScore.signals.fbLocalListings} — ${Date.now()-t0}ms`);

  return { watchModel, timestamp: new Date().toISOString(), hypeScore, signals, userCity };
}

// ─────────────────────────────────────────────
// VINTAGE SCANNER
// ─────────────────────────────────────────────
const UNDERVALUED_VINTAGE_QUERIES = [
  'Universal Geneve Tri-Compax vintage','Movado Polyplan gold vintage',
  'Longines Ultra-Chron vintage','Zenith A386 El Primero vintage',
  'Eberhard Contograph vintage gold','Girard-Perregaux Gyromatic vintage',
  'Vulcain Cricket vintage gold','Hamilton Ventura vintage',
  'Heuer Autavia vintage','Breitling Navitimer 806 vintage',
  'Omega Constellation pie-pan vintage','Omega Flightmaster vintage',
  'Tudor Monte Carlo vintage','Rolex Bubbleback vintage gold',
  'Patek Philippe vintage Calatrava gold','Vacheron vintage gold dress watch',
  'IWC Mark XI vintage','Jaeger LeCoultre Memovox vintage',
  'Cartier Must vintage gold','Lip vintage French watch',
  'Gruen Curvex vintage gold','Wittnauer vintage chronograph',
  'Tissot Navigator vintage','Favre-Leuba vintage',
  'Corum Coin Watch gold vintage',
];

async function scanUndervaluedVintage(userCity=null) {
  const results = [];
  for (const query of UNDERVALUED_VINTAGE_QUERIES.slice(0, 8)) {
    try {
      await sleep(2000);
      const analysis = await analyzeWatchSignals(query, { isVintage:true, hasGold:query.toLowerCase().includes('gold') }, userCity);
      results.push({ query, ...analysis });
    } catch(e) { console.error(`[VINTAGE] ${query}:`, e.message); }
  }
  return results.sort((a,b)=>b.hypeScore.score-a.hypeScore.score);
}

module.exports = {
  analyzeWatchSignals, scanUndervaluedVintage,
  searchYouTubeVideos, searchReddit, searchInstagram,
  searchWatchUSeek, analyzeChrono24Supply, searchFacebookMarketplace,
  TOP_WATCH_YOUTUBERS, YOUTUBER_NAMES, UNDERVALUED_VINTAGE_QUERIES,
  ITALIAN_CITIES,
};
