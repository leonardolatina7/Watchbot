/**
 * Database leggero con lowdb v1 (funziona su Render gratuito)
 */
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

db.defaults({
  watchlist:[], price_history:[], signal_history:[],
  arbitrage_opportunities:[], vintage_opportunities:[],
  independent_analyses:[], discovery_alerts:[], media_articles:[],
  facebook_listings:[], alerts_log:[], gold_prices:[],
  portfolio:[], portfolio_valuations:[], instagram_drops:[]
}).write();

let _id = Date.now();
const nid = () => ++_id;

const D = {
  getWatchlist: () => db.get('watchlist').filter({active:1}).sortBy('created_at').reverse().value(),
  addWatchlist: (item) => { const r={id:nid(),active:1,created_at:new Date().toISOString(),...item}; db.get('watchlist').push(r).write(); return r; },
  removeWatchlist: (id) => { db.get('watchlist').find({id:parseInt(id)}).assign({active:0}).write(); },

  addPriceHistory: (item) => { db.get('price_history').push({id:nid(),scanned_at:new Date().toISOString(),...item}).write(); },
  getPriceHistory: (wid) => db.get('price_history').filter({watchlist_id:parseInt(wid)}).sortBy('scanned_at').reverse().take(100).value(),

  getArbitrage: () => db.get('arbitrage_opportunities').filter({active:1}).sortBy('discount_pct').reverse().take(100).value(),
  addArbitrage: (item) => { db.get('arbitrage_opportunities').push({id:nid(),active:1,found_at:new Date().toISOString(),...item}).write(); },

  addGoldPrice: (p) => { db.get('gold_prices').push({id:nid(),price_eur_per_gram:p,fetched_at:new Date().toISOString()}).write(); const all=db.get('gold_prices').value(); if(all.length>48)db.set('gold_prices',all.slice(-48)).write(); },
  getGoldHistory: () => db.get('gold_prices').sortBy('fetched_at').reverse().take(48).value(),

  getAlerts: () => { const al=db.get('alerts_log').sortBy('sent_at').reverse().take(50).value(); const wl=db.get('watchlist').value(); return al.map(a=>({...a,query:wl.find(w=>w.id===a.watchlist_id)?.query||''})); },
  addAlert: (item) => { db.get('alerts_log').push({id:nid(),sent_at:new Date().toISOString(),...item}).write(); },
  hasRecentAlert: (wid,platform,hours=2) => { const since=new Date(Date.now()-hours*3600000).toISOString(); return !!db.get('alerts_log').find(a=>a.watchlist_id===wid&&a.platform===platform&&a.sent_at>since).value(); },

  addSignalHistory: (item) => { db.get('signal_history').push({id:nid(),scanned_at:new Date().toISOString(),...item}).write(); },
  getTopHype: () => { const since=new Date(Date.now()-7*86400000).toISOString(); const rec=db.get('signal_history').filter(s=>s.scanned_at>since).value(); const bm={}; for(const s of rec){if(!bm[s.watch_model]||s.hype_score>bm[s.watch_model].max_score)bm[s.watch_model]={watch_model:s.watch_model,max_score:s.hype_score,hype_label:s.hype_label,last_scan:s.scanned_at};} return Object.values(bm).sort((a,b)=>b.max_score-a.max_score).slice(0,20); },

  getVintage: () => db.get('vintage_opportunities').sortBy('hype_score').reverse().take(50).value(),
  addVintage: (item) => { db.get('vintage_opportunities').push({id:nid(),scanned_at:new Date().toISOString(),...item}).write(); },

  getIndieOpps: () => { const all=db.get('independent_analyses').value(); const bk={}; for(const a of all){if(!bk[a.brand_key]||a.scanned_at>bk[a.brand_key].scanned_at)bk[a.brand_key]=a;} return Object.values(bk).sort((a,b)=>(b.tier*10+b.discovery_score)-(a.tier*10+a.discovery_score)).slice(0,30); },
  addIndieAnalysis: (item) => { db.get('independent_analyses').push({id:nid(),scanned_at:new Date().toISOString(),...item}).write(); },
  getDiscoveryAlerts: () => db.get('discovery_alerts').sortBy('sent_at').reverse().take(50).value(),
  addDiscoveryAlert: (item) => { db.get('discovery_alerts').push({id:nid(),sent_at:new Date().toISOString(),notified:0,...item}).write(); },
  getMediaArticles: (bk) => { const all=db.get('media_articles').sortBy('importance').reverse().value(); return bk?all.filter(a=>a.brand_key===bk).slice(0,20):all.slice(0,50); },
  addMediaArticle: (item) => { const ex=db.get('media_articles').find({url:item.url}).value(); if(!ex)db.get('media_articles').push({id:nid(),saved_at:new Date().toISOString(),...item}).write(); return !ex; },

  getFacebook: (q,city) => { let it=db.get('facebook_listings').filter({active:1}).value(); if(q)it=it.filter(i=>i.watch_model?.toLowerCase().includes(q.toLowerCase())); if(city)it=it.filter(i=>i.location?.toLowerCase().includes(city.toLowerCase())||i.is_local); return it.sort((a,b)=>new Date(b.found_at)-new Date(a.found_at)).slice(0,100); },
  addFacebook: (item) => { db.get('facebook_listings').push({id:nid(),active:1,found_at:new Date().toISOString(),...item}).write(); },

  getPortfolio: () => db.get('portfolio').filter({active:1}).sortBy('created_at').reverse().value(),
  addPortfolio: (item) => { const r={id:nid(),active:1,created_at:new Date().toISOString(),...item}; db.get('portfolio').push(r).write(); return r; },
  removePortfolio: (id) => { db.get('portfolio').find({id:parseInt(id)}).assign({active:0}).write(); },
  addValuation: (item) => { db.get('portfolio_valuations').push({id:nid(),valuated_at:new Date().toISOString(),...item}).write(); },

  getDrops: () => db.get('instagram_drops').sortBy('detected_at').reverse().take(20).value(),
  addDrop: (item) => { db.get('instagram_drops').push({id:nid(),detected_at:new Date().toISOString(),notified:0,...item}).write(); },
  hasRecentDrop: (handle,hours=6) => { const since=new Date(Date.now()-hours*3600000).toISOString(); return !!db.get('instagram_drops').find(d=>d.handle===handle&&d.detected_at>since).value(); },

  getStats: () => ({
    watchlist:db.get('watchlist').filter({active:1}).size().value(),
    totalScans:db.get('price_history').size().value(),
    arbitrageFound:db.get('arbitrage_opportunities').filter({active:1}).size().value(),
    vintageOpps:db.get('vintage_opportunities').size().value(),
    signalsAnalyzed:db.get('signal_history').size().value(),
    independentAnalyses:db.get('independent_analyses').size().value(),
    discoveryAlerts:db.get('discovery_alerts').size().value(),
    mediaArticles:db.get('media_articles').size().value(),
    portfolioItems:db.get('portfolio').filter({active:1}).size().value(),
    instagramDrops:db.get('instagram_drops').size().value(),
    facebookListings:db.get('facebook_listings').filter({active:1}).size().value(),
  }),
};

module.exports = D;
