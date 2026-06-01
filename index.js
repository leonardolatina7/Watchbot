/**
 * Watch Price Bot v8 — Render Compatible
 * Usa lowdb invece di better-sqlite3 per funzionare su Render gratuito
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const D = require('./database');
require('dotenv').config();

const { WATCH_DATABASE, GOLD_KEYWORDS, AUTO_SCAN_QUERIES, TOP_APPRECIATION, TOP_DEPRECIATION } = require('./watchDatabase');
const { analyzeWatchSignals, scanUndervaluedVintage, searchFacebookMarketplace, ITALIAN_CITIES } = require('./signalEngine');
const { INDEPENDENT_WATCHMAKERS, INDIE_MEDIA_SOURCES } = require('./independentDatabase');
const { analyzeIndependentBrand, scanAllIndependents, checkNewArticles } = require('./discoveryEngine');
const telegram = require('./telegramBot');

const app = express();
app.use(cors());
app.use(express.json());

// ── GOLD ─────────────────────────────────────────────────────
function isGoldWatch(t){return GOLD_KEYWORDS.some(k=>(t||'').toLowerCase().includes(k.toLowerCase()));}
function matchWatchModel(title){const t=(title||'').toLowerCase();let best=null,bs=0;for(const[key,data]of Object.entries(WATCH_DATABASE)){const w=key.split(' ');const s=w.filter(x=>t.includes(x)).length/w.length;if(s>bs&&s>0.5){bs=s;best={key,...data};}if(data.searchTerms)for(const term of data.searchTerms){const tw=term.toLowerCase().split(' ');const ts=tw.filter(x=>t.includes(x)).length/tw.length;if(ts>bs&&ts>0.6){bs=ts;best={key,...data};}}}if(!best&&isGoldWatch(title)){if(t.match(/\b(32|34|36)\b/))best={key:'s',...WATCH_DATABASE['generic 18k gold watch small']};else if(t.match(/\b(44|45|46|47)\b/))best={key:'l',...WATCH_DATABASE['generic 18k gold watch large']};else best={key:'m',...WATCH_DATABASE['generic 18k gold watch medium']};}return best;}
let cg=null,gf=0;
async function getGoldPrice(){if(cg&&Date.now()-gf<30*60*1000)return cg;try{const r=await axios.get('https://data-asg.goldprice.org/dbXRates/USD',{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://goldprice.org'},timeout:8000});const u=r.data?.items?.[0]?.xauPrice;if(u){const fx=await axios.get('https://api.frankfurter.app/latest?from=USD&to=EUR',{timeout:5000});const g=u*(fx.data?.rates?.EUR||0.92)/31.1035;cg=g;gf=Date.now();D.addGoldPrice(g);return g;}}catch{}return cg||78.5;}
async function enrichWithGold(item){const model=matchWatchModel(item.title);if(!model)return{...item,goldData:null};const gp=await getGoldPrice();const gv=model.goldGrams*gp;const p=item.priceEur||item.price;return{...item,goldData:{modelKey:model.key,goldGrams:model.goldGrams,goldValueEur:Math.round(gv),discountPct:Math.round(((gv-p)/gv)*1000)/10,isArbitrage:p<gv,trend:model.trend,trendLabel:model.trendLabel,rarity:model.rarity,goldPricePerGram:Math.round(gp*100)/100}};}

// ── SCRAPERS ─────────────────────────────────────────────────
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rUA=()=>'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const parsePrice=t=>parseFloat((t||'').replace(/[^\d,.]/g,'').replace(',','.'))||0;
let fx={USD:0.92,GBP:1.17},fxF=0;
async function toEur(p,c){if(!p||c==='EUR')return p;if(Date.now()-fxF>3600000){try{const r=await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP',{timeout:5000});fx={USD:1/r.data.rates.USD,GBP:1/r.data.rates.GBP};fxF=Date.now();}catch{}}return p*(fx[c]||1);}
let ebayToken=null,ebayExp=0;
async function getEbayToken(){if(ebayToken&&Date.now()<ebayExp)return ebayToken;if(!process.env.EBAY_CLIENT_ID)return null;const c=Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');const r=await axios.post('https://api.ebay.com/identity/v1/oauth2/token','grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',{headers:{Authorization:`Basic ${c}`,'Content-Type':'application/x-www-form-urlencoded'}});ebayToken=r.data.access_token;ebayExp=Date.now()+(r.data.expires_in-60)*1000;return ebayToken;}
async function searchEbay(q){try{const t=await getEbayToken();if(!t)return[];const r=await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search',{params:{q,category_ids:'31387',sort:'price',limit:15},headers:{Authorization:`Bearer ${t}`,'X-EBAY-C-MARKETPLACE-ID':'EBAY_IT'}});return(r.data.itemSummaries||[]).map(i=>({platform:'eBay',title:i.title,price:parseFloat(i.price?.value||0),currency:i.price?.currency||'EUR',url:i.itemWebUrl})).filter(i=>i.price>0);}catch{return[];}}
async function searchChrono24(q){try{await sleep(800+Math.random()*700);const url=`https://www.chrono24.it/search/index.htm?query=${encodeURIComponent(q)}&dosearch=true&searchType=fulltext&resultview=list`;const r=await axios.get(url,{headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.chrono24.it/'},timeout:12000});const $=cheerio.load(r.data);const res=[];$('[data-article-id],.article-item-container').each((i,el)=>{if(i>=10)return;const $el=$(el);const title=$el.find('.article-title,h3').first().text().trim();const price=parsePrice($el.find('.price,.js-price').first().text());const link=$el.find('a[href*="/watches/"]').first().attr('href');if(title&&price>100)res.push({platform:'Chrono24',title,price,currency:'EUR',url:link?(link.startsWith('http')?link:`https://www.chrono24.it${link}`):url});});return res.sort((a,b)=>a.price-b.price);}catch{return[];}}
async function scrapeG(platform,url,sel){try{await sleep(900+Math.random()*700);const r=await axios.get(url,{headers:{'User-Agent':rUA(),Referer:new URL(url).origin},timeout:12000});const $=cheerio.load(r.data);const res=[];$(sel.item).each((i,el)=>{if(i>=8)return;const $el=$(el);const title=$el.find(sel.title).first().text().trim();const price=parsePrice($el.find(sel.price).first().text());const link=$el.find('a').first().attr('href');if(title&&price>100)res.push({platform,title,price,currency:sel.currency||'USD',url:link?(link.startsWith('http')?link:new URL(url).origin+link):url});});return res;}catch{return[];}}
const sWF=q=>scrapeG('Watchfinder',`https://api.watchfinder.co.uk/catalog/search?query=${encodeURIComponent(q)}&pageSize=8`,{item:'div',title:'title',price:'price',currency:'GBP'});
const sBobs=q=>scrapeG("Bob's Watches",`https://www.bobswatches.com/search?q=${encodeURIComponent(q)}`,{item:'.product-item,[class*="product-card"]',title:'h2,h3',price:'.price',currency:'USD'});
const sCata=q=>scrapeG('Catawiki',`https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(q)}`,{item:'[class*="lot-card"],article[data-lot-id]',title:'[class*="title"],h2',price:'[class*="price"]',currency:'EUR'});
const sVest=q=>scrapeG('Vestiaire',`https://www.vestiairecollective.com/search/?q=${encodeURIComponent(q)}&universe=men&category=watches`,{item:'[class*="product-card"]',title:'[class*="brand"]',price:'[class*="price"]',currency:'EUR'});

async function searchAllPlatforms(query,userCity=null){
  const settled=await Promise.allSettled([searchEbay(query),searchChrono24(query),sWF(query),sBobs(query),sCata(query),sVest(query),userCity?searchFacebookMarketplace(query,userCity):Promise.resolve([])]);
  const raw=settled.flatMap(s=>s.status==='fulfilled'?s.value:[]);
  const enriched=await Promise.all(raw.map(async i=>enrichWithGold({...i,priceEur:Math.round(await toEur(i.price,i.currency))})));
  enriched.sort((a,b)=>a.priceEur-b.priceEur);
  const byP={};for(const i of enriched)if(!byP[i.platform]||i.priceEur<byP[i.platform].priceEur)byP[i.platform]=i;
  return{query,timestamp:new Date().toISOString(),results:Object.values(byP).sort((a,b)=>a.priceEur-b.priceEur),allListings:enriched,lowest:enriched[0]||null,arbitrageOpportunities:enriched.filter(i=>i.goldData?.isArbitrage),facebookListings:enriched.filter(i=>i.platform.includes('Facebook')),goldPricePerGram:cg?Math.round(cg*100)/100:null,platformsScanned:Object.keys(byP)};
}

// ── NOTIFICHE ────────────────────────────────────────────────
const mailer=nodemailer.createTransport({host:process.env.SMTP_HOST||'smtp.gmail.com',port:587,secure:false,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
async function notify(channels,subject,telegramText){
  if(channels.email&&process.env.SMTP_USER){mailer.sendMail({from:`PriceRadar <${process.env.SMTP_USER}>`,to:channels.email,subject,html:`<div style="font-family:Georgia;background:#050510;padding:24px;color:#E0D8C8">${telegramText.replace(/\n/g,'<br>').replace(/<[^>]+>/g,'')}</div>`}).catch(()=>{});}
  if(process.env.TELEGRAM_TOKEN){telegram.sendTelegramMessage(channels.telegramChatId||process.env.TELEGRAM_CHAT_ID,telegramText).catch(()=>{});}
}

// ── CACHE ────────────────────────────────────────────────────
const cache=new Map();
const getCached=k=>{const e=cache.get(k);return e&&Date.now()-e.ts<15*60*1000?e.d:null;};
const setCache=(k,d)=>cache.set(k,{d,ts:Date.now()});

// ── ROUTES ───────────────────────────────────────────────────
app.get('/api/search',async(req,res)=>{const q=req.query.q?.trim(),city=req.query.city||null;if(!q)return res.status(400).json({error:'?q= richiesto'});const ck=`${q}:${city||''}`;const cached=getCached(ck);if(cached)return res.json({...cached,fromCache:true});try{const d=await searchAllPlatforms(q,city);setCache(ck,d);res.json(d);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/signals',async(req,res)=>{const q=req.query.q?.trim(),city=req.query.city||null;if(!q)return res.status(400).json({error:'?q= richiesto'});const ck=`sig:${q}:${city||''}`;const cached=getCached(ck);if(cached)return res.json({...cached,fromCache:true});try{const wd=matchWatchModel(q);const a=await analyzeWatchSignals(q,{isVintage:q.toLowerCase().includes('vintage'),hasGold:isGoldWatch(q),trend:wd?.trend||0},city);D.addSignalHistory({watch_model:q,hype_score:a.hypeScore.score,hype_label:a.hypeScore.label,yt_score:a.hypeScore.breakdown.youtube,reddit_score:a.hypeScore.breakdown.reddit,ig_score:a.hypeScore.breakdown.instagram,forum_score:a.hypeScore.breakdown.watchuseek,chrono24_score:a.hypeScore.breakdown.chrono24,fb_score:a.hypeScore.breakdown.facebook,yt_videos:a.hypeScore.signals.ytVideosFound,reddit_posts:a.hypeScore.signals.redditPosts,fb_listings:a.hypeScore.signals.fbListings,raw_data:JSON.stringify(a)});setCache(ck,a);res.json(a);}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/arbitrage',(req,res)=>res.json(D.getArbitrage()));
app.get('/api/gold-price',async(req,res)=>{const p=await getGoldPrice().catch(()=>null);res.json({pricePerGram:p?Math.round(p*100)/100:null,history:D.getGoldHistory()});});
app.get('/api/gold-scan',(req,res)=>{res.json({message:'Scansione oro avviata'});(async()=>{for(const q of AUTO_SCAN_QUERIES.sort(()=>Math.random()-0.5).slice(0,8)){try{await sleep(4000);const d=await searchAllPlatforms(q);for(const o of d.arbitrageOpportunities||[]){D.addArbitrage({platform:o.platform,title:o.title,price:o.priceEur,currency:'EUR',gold_weight_grams:o.goldData?.goldGrams,gold_value_eur:o.goldData?.goldValueEur,discount_pct:o.goldData?.discountPct,trend_pct:o.goldData?.trend||null,trend_label:o.goldData?.trendLabel||null,url:o.url});await telegram.sendTelegramMessage(null,`🥇 ARBITRAGGIO: ${o.title?.slice(0,40)}\n€${o.priceEur} vs oro €${o.goldData?.goldValueEur} (−${o.goldData?.discountPct}%)\n${o.url}`).catch(()=>{});}}catch{}}})();});

app.get('/api/vintage-scan',(req,res)=>{const city=req.query.city||null;res.json({message:'OK'});(async()=>{const results=await scanUndervaluedVintage(city).catch(()=>[]);for(const r of results)D.addVintage({model:r.query,hype_score:r.hypeScore.score,hype_label:r.hypeScore.label,yt_videos:r.hypeScore.signals.ytVideosFound,reddit_posts:r.hypeScore.signals.redditPosts,fb_listings:r.hypeScore.signals.fbListings,chrono24_listings:r.hypeScore.signals.chrono24Listings,chrono24_avg_price:r.signals.chrono24?.avgPrice||0,signal_breakdown:JSON.stringify(r.hypeScore.breakdown)});})();});
app.get('/api/vintage',(req,res)=>res.json(D.getVintage()));
app.get('/api/trends',(req,res)=>res.json({topAppreciation:TOP_APPRECIATION,topDepreciation:TOP_DEPRECIATION}));
app.get('/api/top-hype',(req,res)=>res.json(D.getTopHype()));
app.get('/api/facebook',(req,res)=>res.json(D.getFacebook(req.query.q,req.query.city)));
app.get('/api/cities',(req,res)=>res.json(Object.keys(ITALIAN_CITIES)));

app.get('/api/indie/brands',(req,res)=>{const tier=req.query.tier?parseInt(req.query.tier):null;const brands=Object.entries(INDEPENDENT_WATCHMAKERS).filter(([,b])=>!tier||b.tier===tier).map(([key,b])=>({key,...b})).sort((a,b)=>b.tier-a.tier||b.discoveryScore-a.discoveryScore);res.json({count:brands.length,brands});});
app.get('/api/indie/analyze/:brandKey',async(req,res)=>{const{brandKey}=req.params;if(!INDEPENDENT_WATCHMAKERS[brandKey])return res.status(404).json({error:'Brand non trovato'});const ck=`indie:${brandKey}`;const cached=getCached(ck);if(cached)return res.json({...cached,fromCache:true});try{const analysis=await analyzeIndependentBrand(brandKey);D.addIndieAnalysis({brand_key:brandKey,brand_name:analysis.brand.name,tier:analysis.brand.tier,discovery_score:analysis.discovery.score,discovery_urgency:analysis.discovery.urgency,discovery_thesis:analysis.discovery.thesis,hodinkee_articles:analysis.signals.hodinkee?.articles?.length||0,auction_results:(analysis.signals.auctions?.phillips?.count||0)+(analysis.signals.auctions?.sothebys?.count||0),reddit_posts:analysis.signals.reddit?.totalPosts||0,ig_followers:analysis.signals.instagram?.reduce((s,i)=>s+(i.followersCount||0),0)||0,gphg_nominated:analysis.signals.gphg?.nominated?1:0});for(const[alertType,isAlert]of Object.entries(analysis.alerts)){if(isAlert){const msg={firstHodinkeeArticle:'Prima menzione su Hodinkee!',firstAuctionAppearance:'Prima apparizione in asta!',gphgNomination:'Nominato GPHG!',redditExploding:'Reddit in esplosione!'}[alertType];if(msg){D.addDiscoveryAlert({brand_key:brandKey,brand_name:analysis.brand.name,alert_type:alertType,message:msg,importance:analysis.brand.tier*20+20});await telegram.sendTelegramMessage(null,`🔭 DISCOVERY: ${analysis.brand.name}\n${msg}\nDiscovery Score: ${analysis.discovery.score}/100\n${analysis.discovery.urgency}`).catch(()=>{});}}}setCache(ck,analysis);res.json(analysis);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/indie/scan',(req,res)=>{res.json({message:'OK'});scanAllIndependents().catch(()=>{});});
app.get('/api/indie/opportunities',(req,res)=>res.json(D.getIndieOpps().map(a=>({...a,brandData:INDEPENDENT_WATCHMAKERS[a.brand_key]||null}))));
app.get('/api/indie/alerts',(req,res)=>res.json(D.getDiscoveryAlerts()));
app.get('/api/indie/articles',(req,res)=>res.json(D.getMediaArticles(req.query.brand)));
app.get('/api/indie/drops',(req,res)=>res.json(D.getDrops()));

app.post('/api/watchlist',(req,res)=>{const{query,threshold,email,telegramChatId,goldArbitrage,trackSignals,userCity,radiusKm}=req.body;if(!query)return res.status(400).json({error:'query richiesta'});const r=D.addWatchlist({query,threshold:threshold||null,email:email||null,telegram_chat_id:telegramChatId||process.env.TELEGRAM_CHAT_ID||null,gold_arbitrage:goldArbitrage?1:0,track_signals:trackSignals!==false?1:0,user_city:userCity||null,radius_km:radiusKm||100});res.json(r);});
app.get('/api/watchlist',(req,res)=>res.json(D.getWatchlist()));
app.delete('/api/watchlist/:id',(req,res)=>{D.removeWatchlist(req.params.id);res.json({ok:true});});
app.get('/api/history/:id',(req,res)=>res.json(D.getPriceHistory(req.params.id)));
app.get('/api/alerts',(req,res)=>res.json(D.getAlerts()));

app.get('/api/portfolio',(req,res)=>res.json(D.getPortfolio()));
app.post('/api/portfolio',(req,res)=>{const{name,brand,purchasePrice,purchaseDate,isGold,goldGrams,notes}=req.body;if(!name)return res.status(400).json({error:'name richiesto'});const r=D.addPortfolio({name,brand:brand||null,purchase_price:purchasePrice||null,purchase_date:purchaseDate||null,is_gold:isGold?1:0,gold_grams:goldGrams||null,notes:notes||null});res.json(r);});
app.delete('/api/portfolio/:id',(req,res)=>{D.removePortfolio(req.params.id);res.json({ok:true});});
app.get('/api/portfolio/summary',(req,res)=>{const items=D.getPortfolio();const totalCost=items.reduce((s,i)=>s+(i.purchase_price||0),0);res.json({totalCost,totalValue:totalCost,totalROI:0,itemCount:items.length});});

app.post('/api/telegram/register',(req,res)=>{const{chatId}=req.body;if(!chatId)return res.status(400).json({error:'chatId richiesto'});telegram.sendTelegramMessage(chatId,'✅ <b>PriceRadar v8</b> configurato!\n\nRiceverai notifiche per prezzi, oro, FOMO e indie discovery 🔭').catch(()=>{});res.json({ok:true,chatId});});
app.post('/api/telegram/test',(req,res)=>{const chatId=req.body.chatId||process.env.TELEGRAM_CHAT_ID;telegram.sendTelegramMessage(chatId,'⌚ PriceRadar v8 — Test OK! 🟢').catch(()=>{});res.json({ok:true});});
app.post('/telegram/webhook',async(req,res)=>{res.sendStatus(200);await telegram.handleTelegramCommand(req.body,{prepare:()=>({all:()=>[],get:()=>null,run:()=>{}})},searchAllPlatforms);});

app.get('/api/status',async(req,res)=>{const gp=await getGoldPrice().catch(()=>null);const stats=D.getStats();res.json({status:'online',version:'8.0',platforms:7,...stats,goldPricePerGram:gp?Math.round(gp*100)/100:null,modelsInDatabase:Object.keys(WATCH_DATABASE).length,independentBrands:Object.keys(INDEPENDENT_WATCHMAKERS).length,ebayConfigured:!!(process.env.EBAY_CLIENT_ID),telegramConfigured:!!(process.env.TELEGRAM_TOKEN),emailConfigured:!!(process.env.SMTP_USER),uptime:Math.floor(process.uptime())});});

// ── CRON ─────────────────────────────────────────────────────
cron.schedule('*/30 * * * *',async()=>{
  const items=D.getWatchlist();
  for(const item of items){try{await sleep(2000);const data=await searchAllPlatforms(item.query,item.user_city);for(const r of data.allListings.slice(0,15)){D.addPriceHistory({watchlist_id:item.id,platform:r.platform,price:r.priceEur,currency:'EUR',url:r.url,title:r.title,gold_weight_grams:r.goldData?.goldGrams||null,gold_value_eur:r.goldData?.goldValueEur||null,is_arbitrage:r.goldData?.isArbitrage?1:0,trend_pct:r.goldData?.trend||null});if(item.threshold&&r.priceEur<=item.threshold){if(!D.hasRecentAlert(item.id,r.platform)){await notify({email:item.email,telegramChatId:item.telegram_chat_id},`🔔 ${item.query} → €${r.priceEur}`,`🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${r.priceEur} su ${r.platform}\n<a href="${r.url}">→ VEDI</a>`);D.addAlert({watchlist_id:item.id,platform:r.platform,price:r.priceEur,message:`€${r.priceEur}`});}}}cache.delete(`${item.query}:${item.user_city||''}`);}catch{}}
});

cron.schedule('0 * * * *',async()=>{
  const matches=await checkNewArticles().catch(()=>[]);
  for(const match of matches){const isNew=D.addMediaArticle({source:match.article.source,title:match.article.title,description:match.article.description,url:match.article.url,brand_key:match.brand.key,brand_name:match.brand.name,importance:match.importance,is_first_mention:match.isFirstTimeSeen?1:0,published_at:match.article.publishedAt});if(isNew&&match.isFirstTimeSeen&&match.importance>=70){D.addDiscoveryAlert({brand_key:match.brand.key,brand_name:match.brand.name,alert_type:'RSS',message:match.article.title,url:match.article.url,importance:match.importance});await telegram.sendTelegramMessage(null,`🔭 <b>DISCOVERY</b>\n${match.brand.name} su ${match.article.source}\n${match.article.title?.slice(0,80)}\n${match.article.url}`).catch(()=>{});}}
});

cron.schedule('0 */2 * * *',async()=>{for(const q of AUTO_SCAN_QUERIES.sort(()=>Math.random()-0.5).slice(0,5)){try{await sleep(4000);const d=await searchAllPlatforms(q);for(const o of d.arbitrageOpportunities||[])D.addArbitrage({platform:o.platform,title:o.title,price:o.priceEur,currency:'EUR',gold_weight_grams:o.goldData?.goldGrams,gold_value_eur:o.goldData?.goldValueEur,discount_pct:o.goldData?.discountPct,url:o.url});}catch{}}});

const PORT=process.env.PORT||3001;
app.listen(PORT,'0.0.0.0',async()=>{
  const gp=await getGoldPrice().catch(()=>null);
  console.log(`\n⌚ Watch Price Bot v8 — Online`);
  console.log(`   Porta: ${PORT} | Oro: €${gp?.toFixed(2)||'N/A'}/g`);
  console.log(`   eBay: ${process.env.EBAY_CLIENT_ID?'✓':'✗ (aggiungi domani)'} | TG: ${process.env.TELEGRAM_TOKEN?'✓':'✗'} | Email: ${process.env.SMTP_USER?'✓':'✗'}\n`);
  if(process.env.RENDER_EXTERNAL_URL)telegram.setupWebhook(process.env.RENDER_EXTERNAL_URL).catch(()=>{});
});
