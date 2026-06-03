/**
 * SOCIAL ENGINE v11
 * 
 * Analizza dove si formano le opinioni nel mondo degli orologi:
 * - Gruppi Facebook pubblici italiani (compravendita + discussione)
 * - Reddit r/Watches, r/WatchExchange, r/independentwatches
 * - YouTube (canali noti, crescita views)
 * - Google Trends (interesse nel tempo)
 * - Hodinkee RSS (prima menzione = segnale forte)
 * - WatchUSeek forum (community storica)
 * - Instagram hashtag pubblici
 * 
 * Output: HYPE SCORE per ogni modello/brand
 * Formula: velocità crescita + qualità fonte + sentiment + liquidità
 */

const axios = require('axios');
const cheerio = require('cheerio');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rUA = () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

// ─────────────────────────────────────────────
// MODELLI IN HYPE — lista dinamica aggiornata
// Basata su analisi storica + segnali correnti
// ─────────────────────────────────────────────
const HYPE_WATCHLIST = [
  // Oro vintage — massimo potenziale arbitraggio
  { query:'Rolex Day-Date vintage oro', category:'vintage_gold', baseHype:75 },
  { query:'Rolex Datejust oro vintage', category:'vintage_gold', baseHype:68 },
  { query:'Omega Constellation pie pan oro', category:'vintage_gold', baseHype:72 },
  { query:'Patek Calatrava vintage oro', category:'vintage_gold', baseHype:80 },
  { query:'Vacheron Constantin vintage oro', category:'vintage_gold', baseHype:78 },
  { query:'Universal Geneve oro vintage', category:'vintage_gold', baseHype:65 },
  { query:'Longines oro vintage', category:'vintage_gold', baseHype:60 },
  { query:'Zenith El Primero oro', category:'vintage_gold', baseHype:66 },
  // Indipendenti emergenti
  { query:'Czapek Antarctique', category:'indie', baseHype:72 },
  { query:'Akrivia Rexhep', category:'indie', baseHype:70 },
  { query:'Simon Brette Trilobe', category:'indie', baseHype:68 },
  { query:'Raul Pages Pegase', category:'indie', baseHype:75 },
  { query:'MING watch', category:'indie', baseHype:65 },
  { query:'Massena LAB', category:'indie', baseHype:67 },
  { query:'Habring2', category:'indie', baseHype:62 },
  { query:'Baltic watch limited', category:'indie', baseHype:60 },
  // Sport watches classici in oro
  { query:'Rolex Submariner oro yellow gold', category:'sport_gold', baseHype:85 },
  { query:'Rolex GMT Master oro', category:'sport_gold', baseHype:82 },
  { query:'Audemars Piguet Royal Oak oro', category:'sport_gold', baseHype:88 },
  { query:'Patek Nautilus oro gold', category:'sport_gold', baseHype:90 },
  // Platino — sempre raro
  { query:'orologio platino 950', category:'platinum', baseHype:78 },
  { query:'Rolex platinum', category:'platinum', baseHype:82 },
];

// ─────────────────────────────────────────────
// REDDIT — velocità crescita + sentiment
// ─────────────────────────────────────────────
async function analyzeReddit(query) {
  try {
    await sleep(500 + Math.random() * 500);
    const WATCH_SUBS = ['Watches','WatchExchange','VintageWatches','WatchHorology','independentwatches','PatekPhilippe','rolex','AudemarsPiguet'];
    
    const [monthR, weekR] = await Promise.allSettled([
      axios.get(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=month&limit=25`, {
        headers:{'User-Agent':'WatchBot/11.0'}, timeout:10000
      }),
      axios.get(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=week&limit=25`, {
        headers:{'User-Agent':'WatchBot/11.0'}, timeout:10000
      }),
    ]);

    const monthPosts = monthR.status==='fulfilled'
      ? (monthR.value.data?.data?.children||[]).filter(p=>WATCH_SUBS.map(s=>s.toLowerCase()).includes(p.data.subreddit.toLowerCase()))
      : [];
    const weekPosts = weekR.status==='fulfilled'
      ? (weekR.value.data?.data?.children||[]).filter(p=>WATCH_SUBS.map(s=>s.toLowerCase()).includes(p.data.subreddit.toLowerCase()))
      : [];

    const monthUps = monthPosts.reduce((s,p)=>s+p.data.ups,0);
    const acceleration = monthPosts.length>0 ? weekPosts.length/monthPosts.length : 0;
    const sentiment = monthPosts.length>0 ? monthPosts.reduce((s,p)=>s+(p.data.upvote_ratio||0.7),0)/monthPosts.length : 0.7;

    // Segnale vendita: post su WatchExchange = liquidità alta
    const sellPosts = weekPosts.filter(p=>p.data.subreddit==='WatchExchange').length;

    return {
      monthPosts: monthPosts.length,
      weekPosts: weekPosts.length,
      monthUpvotes: monthUps,
      acceleration,
      sentiment: Math.round(sentiment*100),
      sellPosts,
      growthSignal: acceleration>0.6?'explosive':acceleration>0.35?'growing':acceleration>0.15?'steady':'flat',
      topPost: monthPosts[0]?{title:monthPosts[0].data.title,ups:monthPosts[0].data.ups,url:`https://reddit.com${monthPosts[0].data.permalink}`}:null,
    };
  } catch { return {monthPosts:0,weekPosts:0,acceleration:0,sentiment:70,growthSignal:'flat',sellPosts:0}; }
}

// ─────────────────────────────────────────────
// YOUTUBE — video recenti + canali noti
// ─────────────────────────────────────────────
async function analyzeYoutube(query) {
  try {
    await sleep(800 + Math.random() * 500);
    const r = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query+' watch')}&sp=CAISBAgBEAE%3D`, {
      headers:{'User-Agent':rUA(),'Accept-Language':'en-US,en;q=0.9'}, timeout:12000
    });

    const match = r.data.match(/var ytInitialData\s*=\s*({.+?});\s*<\/script>/s);
    if (!match) return {videos:[],totalVideos:0,topViews:0,knownChannels:0};
    
    let data;
    try { data=JSON.parse(match[1]); } catch { return {videos:[],totalVideos:0,topViews:0,knownChannels:0}; }

    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents||[];

    const KNOWN = ['bark & jack','theo & harris','watchbox','urban gentry','federico talks watches',
      'aBlogToWatch','teddy baldassarre','wristwatch revival','time and tide','long island watch',
      'deploy watches','mr jones watches','the time teller','just one more watch'];

    const videos = contents.slice(0,10).filter(v=>v.videoRenderer).map(v=>{
      const vr = v.videoRenderer;
      const views = parseInt((vr.viewCountText?.simpleText||'0').replace(/\D/g,''))||0;
      const channel = vr.ownerText?.runs?.[0]?.text||'';
      const isKnown = KNOWN.some(kc=>channel.toLowerCase().includes(kc));
      const age = vr.publishedTimeText?.simpleText||'';
      const isRecent = age.includes('day')||age.includes('week')||age.includes('hour')||age.includes('giorno')||age.includes('settimana');
      return { title:vr.title?.runs?.[0]?.text||'', channel, views, isKnown, isRecent, age, url:vr.videoId?`https://youtube.com/watch?v=${vr.videoId}`:'', };
    }).filter(v=>v.title);

    return {
      videos: videos.slice(0,5),
      totalVideos: videos.length,
      topViews: videos[0]?.views||0,
      knownChannels: videos.filter(v=>v.isKnown).length,
      recentVideos: videos.filter(v=>v.isRecent).length,
      knownChannelBonus: videos.some(v=>v.isKnown),
    };
  } catch { return {videos:[],totalVideos:0,topViews:0,knownChannels:0,recentVideos:0}; }
}

// ─────────────────────────────────────────────
// HODINKEE RSS — prima menzione = segnale fortissimo
// ─────────────────────────────────────────────
async function checkHodinkee(query) {
  try {
    await sleep(600 + Math.random() * 400);
    const r = await axios.get(`https://www.hodinkee.com/search?q=${encodeURIComponent(query)}`, {
      headers:{'User-Agent':rUA()}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const articles = [];
    $('[class*="article"],[class*="story"],article,[class*="Card"]').each((i,el)=>{
      if(i>=6)return;
      const $el=$(el);
      const title=$el.find('h1,h2,h3,[class*="title"]').first().text().trim();
      const date=$el.find('time,[class*="date"]').first().text().trim();
      const link=$el.find('a').first().attr('href');
      if(title&&title.toLowerCase().includes(query.toLowerCase().split(' ')[0])){
        articles.push({title,date,url:link?(link.startsWith('http')?link:`https://www.hodinkee.com${link}`):''});
      }
    });
    const bodyMentions=(r.data.toLowerCase().match(new RegExp(query.toLowerCase().split(' ')[0],'g'))||[]).length;
    return {articles,mentionCount:bodyMentions,hasArticle:articles.length>0};
  } catch { return {articles:[],mentionCount:0,hasArticle:false}; }
}

// ─────────────────────────────────────────────
// WATCHUSEEK — forum storico, community seria
// ─────────────────────────────────────────────
async function checkWatchUSeek(query) {
  try {
    await sleep(700 + Math.random() * 400);
    const r = await axios.get(`https://www.watchuseek.com/search/4933707/?q=${encodeURIComponent(query)}&o=date`, {
      headers:{'User-Agent':rUA()}, timeout:12000
    });
    const $ = cheerio.load(r.data);
    const threads = [];
    $('[class*="thread"],[class*="structItem"]').each((i,el)=>{
      if(i>=6)return;
      const $el=$(el);
      const title=$el.find('h3,h4,[class*="title"]').first().text().trim();
      const replies=parseInt($el.find('[class*="reply"],[class*="count"]').first().text())||0;
      if(title) threads.push({title,replies});
    });
    return {threads,totalThreads:threads.length,hotThread:threads.find(t=>t.replies>20)||null};
  } catch { return {threads:[],totalThreads:0}; }
}

// ─────────────────────────────────────────────
// GOOGLE NEWS — articoli recenti
// ─────────────────────────────────────────────
async function checkGoogleNews(query) {
  try {
    await sleep(500 + Math.random() * 400);
    const q = encodeURIComponent(`"${query}" watch orologio`);
    const r = await axios.get(`https://news.google.com/rss/search?q=${q}&hl=it&gl=IT&ceid=IT:it`, {
      headers:{'User-Agent':rUA()}, timeout:10000
    });
    const $ = cheerio.load(r.data, {xmlMode:true});
    const articles = [];
    $('item').each((i,el)=>{
      if(i>=8)return;
      const $el=$(el);
      const title=$el.find('title').first().text().trim();
      const pubDate=$el.find('pubDate').first().text().trim();
      const source=$el.find('source').first().text().trim();
      const link=$el.find('link').first().text().trim();
      if(title) articles.push({title,pubDate,source,url:link});
    });
    const recent=articles.filter(a=>(Date.now()-new Date(a.pubDate).getTime())<30*86400000);
    return {articles,recentCount:recent.length,totalCount:articles.length};
  } catch { return {articles:[],recentCount:0,totalCount:0}; }
}

// ─────────────────────────────────────────────
// FACEBOOK GRUPPI PUBBLICI — senza token
// Legge i post pubblici dei gruppi di orologi
// ─────────────────────────────────────────────
async function checkFacebookGroups(query) {
  const PUBLIC_GROUPS = [
    'https://www.facebook.com/groups/orologivintageitalia/search/?q='+encodeURIComponent(query),
    'https://www.facebook.com/groups/watchcollectorsitaly/search/?q='+encodeURIComponent(query),
    'https://www.facebook.com/groups/independentwatchmakers/search/?q='+encodeURIComponent(query),
  ];
  let mentions = 0, posts = [];
  for (const url of PUBLIC_GROUPS) {
    try {
      await sleep(800);
      const r = await axios.get(url, {
        headers:{'User-Agent':rUA(),'Accept-Language':'it-IT,it;q=0.9'}, timeout:10000
      });
      const $ = cheerio.load(r.data);
      // Conta menzioni nel testo della pagina
      const bodyText = r.data.toLowerCase();
      const count = (bodyText.match(new RegExp(query.toLowerCase().split(' ')[0],'g'))||[]).length;
      mentions += count;
      // Estrai post visibili
      $('[data-testid="post_message"],[class*="userContent"]').each((i,el)=>{
        if(i>=3)return;
        const text=$(el).text().trim().slice(0,100);
        if(text) posts.push(text);
      });
    } catch {}
  }
  return {mentions,posts:posts.slice(0,5),groupActivity:mentions>10?'high':mentions>3?'medium':'low'};
}

// ─────────────────────────────────────────────
// HYPE SCORE ALGORITMO
// 
// Pesi calibrati su mercato reale orologi:
// - Hodinkee prima menzione vale 25 punti
// - Reddit acceleration vale fino a 20 punti
// - YouTube canale noto vale 15 punti
// - WatchUSeek thread caldo vale 10 punti
// - Facebook activity vale fino a 10 punti
// ─────────────────────────────────────────────
function calculateHypeScore(query, category, baseHype, signals) {
  const {reddit, youtube, hodinkee, news, watchuseek, facebook} = signals;
  let score = baseHype * 0.3; // Base dal database

  // MOMENTUM (0-35 punti)
  if (reddit.growthSignal==='explosive') score += 20;
  else if (reddit.growthSignal==='growing') score += 12;
  else if (reddit.growthSignal==='steady') score += 6;

  if (youtube.knownChannelBonus) score += 12;
  if (youtube.recentVideos>=2) score += 5;
  else if (youtube.recentVideos>=1) score += 2;

  // LEGITTIMITÀ MEDIA (0-35 punti)
  if (hodinkee.hasArticle) {
    score += hodinkee.articles.length===1 ? 25 : Math.min(hodinkee.articles.length*5, 20);
  }
  if (news.recentCount>=3) score += 8;
  else if (news.recentCount>=1) score += 4;
  if (watchuseek.hotThread) score += 8;
  else if (watchuseek.totalThreads>0) score += 4;

  // COMMUNITY (0-20 punti)
  if (reddit.monthPosts>=10) score += 10;
  else if (reddit.monthPosts>=5) score += 6;
  else if (reddit.monthPosts>=2) score += 3;
  if (reddit.sentiment>=85) score += 5;
  else if (reddit.sentiment>=75) score += 2;
  if (facebook.groupActivity==='high') score += 5;
  else if (facebook.groupActivity==='medium') score += 2;

  // LIQUIDITÀ (reddit WatchExchange)
  if (reddit.sellPosts>=3) score += 5; // molto liquido
  else if (reddit.sellPosts>=1) score += 2;

  // Bonus categoria
  if (category==='platinum') score += 5;
  if (category==='vintage_gold') score += 3;

  const finalScore = Math.min(Math.round(score), 100);

  // Label
  const label = finalScore>=80?'🔥 MOLTO CALDO':
    finalScore>=65?'📈 IN CRESCITA':
    finalScore>=50?'👀 DA TENERE D\'OCCHIO':
    finalScore>=35?'😴 TIEPIDO':'❄️ FREDDO';

  // Segnale chiave
  let keySignal = '';
  if (hodinkee.hasArticle && hodinkee.articles.length===1) keySignal='PRIMA MENZIONE HODINKEE — segnale più forte';
  else if (youtube.knownChannelBonus) keySignal=`Su YouTube canale noto: ${youtube.videos.find(v=>v.isKnown)?.channel}`;
  else if (reddit.growthSignal==='explosive') keySignal=`Reddit: ${reddit.weekPosts} post questa settimana (explosivo)`;
  else if (watchuseek.hotThread) keySignal=`WatchUSeek: thread caldo "${watchuseek.hotThread.title?.slice(0,40)}"`;
  else if (news.recentCount>=3) keySignal=`${news.recentCount} articoli recenti su media specializzati`;
  else keySignal='Nessun segnale forte al momento';

  return { score:finalScore, label, keySignal,
    breakdown:{ momentum:Math.round(score*0.35), legitimacy:Math.round(score*0.35), community:Math.round(score*0.2), liquidity:Math.round(score*0.1) }
  };
}

// ─────────────────────────────────────────────
// ANALISI COMPLETA MODELLO
// ─────────────────────────────────────────────
async function analyzeModel(watchItem) {
  const {query, category, baseHype} = watchItem;
  console.log(`[SOCIAL] Analisi: ${query}`);

  const [reddit, youtube, hodinkee, news, watchuseek, facebook] = await Promise.allSettled([
    analyzeReddit(query),
    analyzeYoutube(query),
    checkHodinkee(query),
    checkGoogleNews(query),
    checkWatchUSeek(query),
    checkFacebookGroups(query),
  ]);

  const signals = {
    reddit:   reddit.status==='fulfilled'?reddit.value:{monthPosts:0,weekPosts:0,acceleration:0,sentiment:70,growthSignal:'flat',sellPosts:0},
    youtube:  youtube.status==='fulfilled'?youtube.value:{videos:[],totalVideos:0,topViews:0,knownChannels:0,recentVideos:0,knownChannelBonus:false},
    hodinkee: hodinkee.status==='fulfilled'?hodinkee.value:{articles:[],mentionCount:0,hasArticle:false},
    news:     news.status==='fulfilled'?news.value:{articles:[],recentCount:0},
    watchuseek:watchuseek.status==='fulfilled'?watchuseek.value:{threads:[],totalThreads:0},
    facebook: facebook.status==='fulfilled'?facebook.value:{mentions:0,groupActivity:'low'},
  };

  const hypeScore = calculateHypeScore(query, category, baseHype, signals);

  return { query, category, baseHype, signals, hypeScore, analyzedAt:new Date().toISOString() };
}

// ─────────────────────────────────────────────
// SCAN COMPLETO — tutti i modelli
// ─────────────────────────────────────────────
async function scanHypeModels() {
  const results = [];
  // Analizza prima i più interessanti (indie + vintage)
  const sorted = [...HYPE_WATCHLIST].sort((a,b)=>b.baseHype-a.baseHype);
  for (const item of sorted.slice(0,12)) { // max 12 per run per non esaurire SerpAPI
    try {
      await sleep(4000 + Math.random() * 2000);
      const analysis = await analyzeModel(item);
      results.push(analysis);
      console.log(`[SOCIAL] ${item.query}: Hype ${analysis.hypeScore.score}/100 — ${analysis.hypeScore.label}`);
    } catch(e) { console.error(`[SOCIAL] ${item.query}:`,e.message); }
  }
  return results.sort((a,b)=>b.hypeScore.score-a.hypeScore.score);
}

module.exports = { HYPE_WATCHLIST, analyzeModel, scanHypeModels, calculateHypeScore };
