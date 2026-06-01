const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Database leggero
let db = { watchlist:[], arbitrage:[], gold_prices:[], alerts:[], portfolio:[], signal_history:[], media_articles:[], vintage:[], indie_analyses:[], discovery_alerts:[] };

const app = express();
app.use(cors());
app.use(express.json());

// ── GOLD ─────────────────────────────────────────────────────
let cg=null, gf=0;
async function getGoldPrice() {
  if (cg && Date.now()-gf < 30*60*1000) return cg;
  try {
    const r = await axios.get('https://data-asg.goldprice.org/dbXRates/USD', {headers:{'User-Agent':'Mozilla/5.0',Referer:'https://goldprice.org'},timeout:8000});
    const u = r.data?.items?.[0]?.xauPrice;
    if (u) {
      const fx = await axios.get('https://api.frankfurter.app/latest?from=USD&to=EUR',{timeout:5000});
      const g = u * (fx.data?.rates?.EUR||0.92) / 31.1035;
      cg=g; gf=Date.now();
      db.gold_prices.push({price_eur_per_gram:g, fetched_at:new Date().toISOString()});
      if (db.gold_prices.length > 48) db.gold_prices = db.gold_prices.slice(-48);
      return g;
    }
  } catch {}
  return cg || 78.5;
}

// ── SCRAPERS ─────────────────────────────────────────────────
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const rUA = () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const parsePrice = t => parseFloat((t||'').replace(/[^\d,.]/g,'').replace(',','.'))||0;
let fx={USD:0.92,GBP:1.17}, fxF=0;
async function toEur(p,c) {
  if (!p||c==='EUR') return p;
  if (Date.now()-fxF > 3600000) {
    try { const r=await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP',{timeout:5000}); fx={USD:1/r.data.rates.USD,GBP:1/r.data.rates.GBP}; fxF=Date.now(); } catch {}
  }
  return p*(fx[c]||1);
}

let ebayToken=null, ebayExp=0;
async function searchEbay(q) {
  if (!process.env.EBAY_CLIENT_ID) return [];
  try {
    if (!ebayToken || Date.now() >= ebayExp) {
      const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
      const r = await axios.post('https://api.ebay.com/identity/v1/oauth2/token','grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',{headers:{Authorization:`Basic ${c}`,'Content-Type':'application/x-www-form-urlencoded'}});
      ebayToken=r.data.access_token; ebayExp=Date.now()+(r.data.expires_in-60)*1000;
    }
    const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search',{params:{q,category_ids:'31387',sort:'price',limit:15},headers:{Authorization:`Bearer ${ebayToken}`,'X-EBAY-C-MARKETPLACE-ID':'EBAY_IT'}});
    return (r.data.itemSummaries||[]).map(i=>({platform:'eBay',title:i.title,price:parseFloat(i.price?.value||0),currency:i.price?.currency||'EUR',url:i.itemWebUrl})).filter(i=>i.price>0);
  } catch { return []; }
}

async function searchChrono24(q) {
  try {
    await sleep(1000);
    const url = `https://www.chrono24.it/search/index.htm?query=${encodeURIComponent(q)}&dosearch=true&searchType=fulltext&resultview=list`;
    const r = await axios.get(url,{headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.chrono24.it/'},timeout:12000});
    const $ = cheerio.load(r.data);
    const res = [];
    $('[data-article-id],.article-item-container').each((i,el)=>{
      if(i>=8)return;
      const $el=$(el);
      const title=$el.find('.article-title,h3').first().text().trim();
      const price=parsePrice($el.find('.price,.js-price').first().text());
      const link=$el.find('a[href*="/watches/"]').first().attr('href');
      if(title&&price>100) res.push({platform:'Chrono24',title,price,currency:'EUR',url:link?(link.startsWith('http')?link:`https://www.chrono24.it${link}`):url});
    });
    return res.sort((a,b)=>a.price-b.price);
  } catch { return []; }
}

async function searchAllPlatforms(query) {
  const gp = await getGoldPrice();
  const [ebay, chrono] = await Promise.allSettled([searchEbay(query), searchChrono24(query)]);
  const raw = [
    ...(ebay.status==='fulfilled'?ebay.value:[]),
    ...(chrono.status==='fulfilled'?chrono.value:[]),
  ];
  const enriched = await Promise.all(raw.map(async item => {
    const priceEur = Math.round(await toEur(item.price, item.currency));
    return {...item, priceEur};
  }));
  enriched.sort((a,b)=>a.priceEur-b.priceEur);
  const byP={};
  for(const i of enriched) if(!byP[i.platform]||i.priceEur<byP[i.platform].priceEur) byP[i.platform]=i;
  return {query, timestamp:new Date().toISOString(), results:Object.values(byP).sort((a,b)=>a.priceEur-b.priceEur), allListings:enriched, lowest:enriched[0]||null, arbitrageOpportunities:[], goldPricePerGram:gp?Math.round(gp*100)/100:null, platformsScanned:Object.keys(byP)};
}

// ── EMAIL + TELEGRAM ─────────────────────────────────────────
const mailer = nodemailer.createTransport({host:'smtp.gmail.com',port:587,secure:false,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});

async function sendTelegram(chatId, text) {
  if (!process.env.TELEGRAM_TOKEN) return;
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,{chat_id:chatId||process.env.TELEGRAM_CHAT_ID,text,parse_mode:'HTML'},{timeout:10000});
  } catch(e) { console.error('[TG]',e.message); }
}

async function notify(item, found) {
  const msg = `🔔 <b>${item.query}</b>\n💰 €${found.priceEur?.toLocaleString('it-IT')} su ${found.platform}\n<a href="${found.url}">VEDI →</a>`;
  if (item.email && process.env.SMTP_USER) {
    mailer.sendMail({from:`PriceRadar <${process.env.SMTP_USER}>`,to:item.email,subject:`🔔 ${item.query} → €${found.priceEur}`,html:`<div style="font-family:Georgia;background:#050510;padding:24px;color:#E0D8C8"><h3>${item.query}</h3><div style="font-size:22px;color:#C9A84C">€${found.priceEur?.toLocaleString('it-IT')}</div><p>${found.platform}</p><a href="${found.url}">VEDI →</a></div>`}).catch(()=>{});
  }
  await sendTelegram(item.telegram_chat_id, msg);
}

// ── CACHE ────────────────────────────────────────────────────
const cache = new Map();
const getCached = k => { const e=cache.get(k); return e&&Date.now()-e.ts<15*60*1000?e.d:null; };
const setCache = (k,d) => cache.set(k,{d,ts:Date.now()});

let _id = Date.now();
const nid = () => ++_id;

// ── ROUTES ───────────────────────────────────────────────────
app.get('/api/search', async(req,res)=>{
  const q=req.query.q?.trim();
  if(!q) return res.status(400).json({error:'?q= richiesto'});
  const cached=getCached(q); if(cached) return res.json({...cached,fromCache:true});
  try { const d=await searchAllPlatforms(q); setCache(q,d); res.json(d); }
  catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/api/watchlist', (req,res) => res.json(db.watchlist.filter(w=>w.active)));
app.post('/api/watchlist', (req,res) => {
  const {query,threshold,email,telegramChatId,goldArbitrage,userCity} = req.body;
  if(!query) return res.status(400).json({error:'query richiesta'});
  const r = {id:nid(),query,threshold:threshold||null,email:email||null,telegram_chat_id:telegramChatId||process.env.TELEGRAM_CHAT_ID||null,gold_arbitrage:goldArbitrage?1:0,user_city:userCity||null,active:true,created_at:new Date().toISOString()};
  db.watchlist.push(r); res.json(r);
});
app.delete('/api/watchlist/:id', (req,res) => {
  const item = db.watchlist.find(w=>w.id===parseInt(req.params.id));
  if(item) item.active = false;
  res.json({ok:true});
});

app.get('/api/arbitrage', (req,res) => res.json(db.arbitrage.sort((a,b)=>(b.discount_pct||0)-(a.discount_pct||0)).slice(0,50)));
app.get('/api/gold-price', async(req,res) => {
  const p = await getGoldPrice().catch(()=>null);
  res.json({pricePerGram:p?Math.round(p*100)/100:null, history:db.gold_prices.slice(-48).reverse()});
});

app.get('/api/gold-scan', (req,res) => {
  res.json({message:'Scansione avviata'});
  (async()=>{
    const queries = ['Rolex Day-Date gold','Rolex Daytona gold','Patek Philippe gold','Audemars Piguet gold','Cartier gold 18k','Omega gold 18k'];
    const gp = await getGoldPrice();
    for (const q of queries) {
      try {
        await sleep(3000);
        const d = await searchAllPlatforms(q);
        for (const item of d.allListings) {
          // Simple gold detection
          const t = (item.title||'').toLowerCase();
          if (t.includes('gold')||t.includes('oro')||t.includes('18k')||t.includes('750')) {
            const goldGrams = 30; // stima conservativa
            const goldValue = goldGrams * gp;
            if (item.priceEur < goldValue) {
              db.arbitrage.push({id:nid(),platform:item.platform,title:item.title,price:item.priceEur,gold_value_eur:Math.round(goldValue),gold_weight_grams:goldGrams,discount_pct:Math.round(((goldValue-item.priceEur)/goldValue)*100*10)/10,url:item.url,found_at:new Date().toISOString(),active:1});
              await sendTelegram(null,`🥇 ARBITRAGGIO ORO\n${item.title?.slice(0,50)}\n€${item.priceEur} vs oro €${Math.round(goldValue)}\n${item.url}`);
            }
          }
        }
      } catch {}
    }
  })();
});

app.get('/api/portfolio', (req,res) => res.json(db.portfolio.filter(p=>p.active)));
app.post('/api/portfolio', (req,res) => {
  const r = {id:nid(),active:true,created_at:new Date().toISOString(),...req.body};
  db.portfolio.push(r); res.json(r);
});
app.delete('/api/portfolio/:id', (req,res) => {
  const item = db.portfolio.find(p=>p.id===parseInt(req.params.id));
  if(item) item.active = false;
  res.json({ok:true});
});
app.get('/api/portfolio/summary', (req,res) => {
  const items = db.portfolio.filter(p=>p.active);
  const totalCost = items.reduce((s,i)=>s+(parseFloat(i.purchasePrice)||0),0);
  res.json({totalCost,totalValue:totalCost,totalROI:0,itemCount:items.length});
});

app.get('/api/alerts', (req,res) => res.json(db.alerts.slice(-50).reverse()));
app.get('/api/trends', (req,res) => res.json({
  topAppreciation:[
    {model:"F.P. Journe Chronometre Gold",trend:35,note:"Artigianale, pochissimi esemplari"},
    {model:"Patek Philippe Nautilus Gold",trend:28,note:"Lista d'attesa pluriennale"},
    {model:"Raul Pagès Pégase",trend:32,note:"Vincitore GPHG 2023"},
    {model:"Rolex Daytona Yellow Gold",trend:18,note:"Classico intramontabile"},
    {model:"Simon Brette Trilobe",trend:28,note:"In forte crescita"},
  ],
  topDepreciation:[
    {model:"Hublot Big Bang Gold",trend:-8.4,note:"Moda passata"},
    {model:"Franck Muller Casablanca",trend:-7.8,note:"Brand in difficoltà"},
    {model:"Ebel 1911 Gold",trend:-4.2,note:"Brand in declino"},
    {model:"Omega De Ville Gold",trend:-4.5,note:"Scarsa domanda"},
    {model:"Breitling Chronomat Gold",trend:-1.8,note:"Stagnante"},
  ]
}));

app.get('/api/top-hype', (req,res) => res.json(db.signal_history.slice(-20)));

app.post('/api/telegram/register', (req,res) => {
  const {chatId} = req.body;
  if(!chatId) return res.status(400).json({error:'chatId richiesto'});
  sendTelegram(chatId,'✅ <b>PriceRadar</b> configurato!\nRiceverai notifiche per prezzi e arbitraggi oro 🥇');
  res.json({ok:true});
});
app.post('/api/telegram/test', (req,res) => {
  sendTelegram(req.body.chatId||process.env.TELEGRAM_CHAT_ID,'⌚ PriceRadar — Test OK! 🟢');
  res.json({ok:true});
});

app.get('/api/indie/brands', (req,res) => {
  // Dati statici indie brands
  res.json({count:8,brands:[
    {key:"simon_brette",name:"Simon Brette",tier:2,discoveryScore:62,trend:28,country:"FR",founded:2015,avgPrice:28000,buySignal:"Trilobe ora — prezzi quasi raddoppiati in 3 anni"},
    {key:"czapek",name:"Czapek & Cie",tier:2,discoveryScore:55,trend:24,country:"CH",founded:2015,avgPrice:22000,buySignal:"Antarctique — tiratura limitata"},
    {key:"raul_pages",name:"Raul Pagès",tier:3,discoveryScore:78,trend:32,country:"FR",founded:2019,avgPrice:35000,buySignal:"ADESSO — vincitore GPHG 2023"},
    {key:"ming",name:"MING",tier:3,discoveryScore:65,trend:22,country:"MY",founded:2017,avgPrice:3800,buySignal:"Prime serie — 17.01 vale 3x il prezzo originale"},
    {key:"massena_lab",name:"Massena LAB",tier:3,discoveryScore:72,trend:18,country:"FR",founded:2018,avgPrice:4500,buySignal:"Qualsiasi collab — sold out in ore"},
    {key:"akrivia",name:"Akrivia",tier:2,discoveryScore:48,trend:19,country:"CH",founded:2012,avgPrice:55000,buySignal:"Qualsiasi modello — <50 pezzi/anno"},
    {key:"habring2",name:"Habring²",tier:4,discoveryScore:82,trend:14,country:"AT",founded:2004,avgPrice:6500,buySignal:"Doppel 3 — chrono a €6k sottovalutato"},
    {key:"andreas_strehler",name:"Andreas Strehler",tier:4,discoveryScore:90,trend:16,country:"CH",founded:2000,avgPrice:45000,buySignal:"Solo maker — produce <10 orologi/anno"},
  ]});
});
app.get('/api/indie/alerts', (req,res) => res.json(db.discovery_alerts.slice(-20).reverse()));
app.get('/api/indie/articles', (req,res) => res.json(db.media_articles.slice(-20).reverse()));
app.get('/api/indie/drops', (req,res) => res.json([]));
app.get('/api/indie/opportunities', (req,res) => res.json([]));
app.get('/api/vintage', (req,res) => res.json(db.vintage));
app.get('/api/facebook', (req,res) => res.json([]));
app.get('/api/cities', (req,res) => res.json(['roma','milano','napoli','torino','firenze','bologna','venezia','genova','bari','palermo']));

app.get('/api/status', async(req,res) => {
  const gp = await getGoldPrice().catch(()=>null);
  res.json({
    status:'online', version:'8.0', platforms:2,
    watchlist:db.watchlist.filter(w=>w.active).length,
    arbitrageFound:db.arbitrage.length,
    portfolioItems:db.portfolio.filter(p=>p.active).length,
    goldPricePerGram:gp?Math.round(gp*100)/100:null,
    ebayConfigured:!!(process.env.EBAY_CLIENT_ID),
    telegramConfigured:!!(process.env.TELEGRAM_TOKEN),
    emailConfigured:!!(process.env.SMTP_USER),
    uptime:Math.floor(process.uptime()),
  });
});

// ── CRON ─────────────────────────────────────────────────────
cron.schedule('*/30 * * * *', async() => {
  const items = db.watchlist.filter(w=>w.active);
  for (const item of items) {
    try {
      await sleep(2000);
      const data = await searchAllPlatforms(item.query);
      if (item.threshold && data.lowest && data.lowest.priceEur <= parseFloat(item.threshold)) {
        const recent = db.alerts.find(a=>a.watchlist_id===item.id&&Date.now()-new Date(a.sent_at)<2*3600000);
        if (!recent) {
          await notify(item, data.lowest);
          db.alerts.push({id:nid(),watchlist_id:item.id,platform:data.lowest.platform,price:data.lowest.priceEur,message:`€${data.lowest.priceEur}`,sent_at:new Date().toISOString()});
        }
      }
      cache.delete(item.query);
    } catch {}
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', async() => {
  const gp = await getGoldPrice().catch(()=>null);
  console.log(`\n⌚ Watch Price Bot v8 — Online porta ${PORT}`);
  console.log(`   Oro: €${gp?.toFixed(2)||'N/A'}/g`);
  console.log(`   eBay: ${process.env.EBAY_CLIENT_ID?'✓':'✗'} | TG: ${process.env.TELEGRAM_TOKEN?'✓':'✗'} | Email: ${process.env.SMTP_USER?'✓':'✗'}\n`);
  // Manda messaggio Telegram di avvio
  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await sendTelegram(process.env.TELEGRAM_CHAT_ID, '✅ <b>PriceRadar avviato!</b>\nIl bot è online e monitora i prezzi 🟢');
  }
});
