/**
 * catalystWatch.js — RADAR NEWS / CATALIZZATORI DI MERCATO
 * ============================================================
 *
 * COSA FA:
 *  - Legge i feed Google News (RSS) per ogni brand monitorato
 *  - Filtra SOLO i titoli con parole-catalizzatore (rilancio, nuovo
 *    modello, edizione limitata, acquisizione, anniversario, record asta…)
 *  - Anti-ripetizione: usa le impronte già presenti nel bot (db.alertedFps)
 *    così non ti rimanda due volte la stessa notizia, e sopravvive ai
 *    riavvii grazie al Gist (stessa persistenza degli scarti).
 *  - Manda un alert Telegram con brand + titolo + fonte + link
 *
 * PERCHÉ UN FILE A PARTE (e non dentro claudeAnalyst/brandWatchlist):
 *  - Logica diversa: legge NEWS, non annunci/prezzi
 *  - Cron separato: 2x al giorno, non ogni ora come lo scan oro
 *  - Isolamento del rischio: se il feed news si rompe, il bot prezzi gira
 *  - Completa trademarkRadar (marchi) e awardsRadar (premi) con le news
 *    generiche di prodotto/azienda.
 *
 * DIPENDENZE: solo axios (già nel progetto). Nessun pacchetto nuovo.
 *
 * USO (vedi index.js, già agganciato):
 *    const catalystWatch = require('./catalystWatch');
 *    cron.schedule('0 7,19 * * *', () => catalystWatch.runCatalystWatch({ tg, db, markAlerted, alreadyAlerted, saveState }));
 */

const axios = require('axios');

// ── BRAND MONITORATI ───────────────────────────────────────
// Watchlist core (manifatture vintage) + indie moderni top-tier:
// sono i brand dove un catalizzatore sposta DAVVERO il secondario.
const CATALYST_BRANDS = [
  // Manifatture vintage core
  'Universal Geneve', 'Vulcain', 'Cyma', 'Gallet', 'Vacheron Constantin',
  'Eberhard', 'Movado', 'Zenith', 'Nivada Grenchen', 'Croton',
  'Eterna', 'Longines', 'Omega', 'Heuer', 'Breitling', 'Tissot',
  'Piaget', 'Mido', 'Wittnauer', 'Excelsior Park', 'Gruen',
  'Girard-Perregaux', 'A. Lange & Sohne', 'IWC',
  // Indie moderni top tier (catalizzatori d'attenzione sul vintage)
  'Berneron', 'Akrivia Rexhepi', 'F.P. Journe', 'Czapek',
  'Atelier Wen', 'Ochs und Junior', 'Urban Jurgensen',
  'Bradley Taylor watchmaker', 'Pequignet', 'Akhor',
];

// ── PAROLE-CATALIZZATORE (IT + EN) ─────────────────────────
const CATALYST_KEYWORDS = [
  'relaunch','relaunches','revival','revived','reborn','comeback',
  'rilancio','rinasce','ritorna','rinascita',
  'new model','new release','unveils','introduces','launches','debuts','new watch',
  'nuovo modello','presenta','svela','lancia','nuovo orologio',
  'limited edition','limited series','one-off','unique piece',
  'edizione limitata','serie limitata','pezzo unico',
  'reissue','reedition','re-edition','heritage','archive','tribute',
  'riedizione','rievoca',
  'acquisition','acquires','acquired','partnership','investment','invests',
  'new owner','new ceo','backed by',
  'acquisizione','acquisisce','nuovo proprietario','nuovo ceo',
  'anniversary','years of','celebrates',
  'anniversario','celebra',
  'nour la lumière','nour la lumiere','akhor',
  'gold melt','melt value','gold floor','melt squeeze','spot gold record',
  'gold price record','scrap gold','meltdown','solid gold 18k','18k gold case',
  'oro 18k','oro massiccio','quotazione oro','prezzo oro record',
  'black gilt','gilt dial','salmon dial','sector dial',
  'lange undervalued','lange resurgence',
  // Longines: termini che segnalano news rilevanti sul vintage in-house
  'ultra-chron','ultrachron','flyback','30ch','13zn','column wheel',
  'longines heritage','conquest heritage','longines archive','spirit zulu',
  'gphg','auction record','record price','sells for',
  'record asta','battuto all\'asta',
  // Nomi degli WATCH SHOW: è lì che gli indie sconosciuti diventano hype.
  // Una news che lega un brand seguito a uno show = segnale di trazione.
  'watches and wonders','watches & wonders','windup','windup watch fair',
  'dubai watch week','geneva watch days','canadian watch show',
  'toronto watch show','only watch','exhibitor','espositore','watch fair',
];

const MAX_ALERTS_PER_RUN = 15;

// ── BANDIERA FASHION-REVIVAL ───────────────────────────────
// Nomi morti ricomprati e rilanciati come fashion brand: la news
// può sembrare un "rilancio" ma è marketing, non un catalizzatore
// di valore. Se nel titolo compare uno di questi gruppi/nomi,
// l'alert viene marcato come ⚠️ revival commerciale (non comprare).
// Pattern: nome+anno appiccicato ("Cadola 1946") + storia del mito,
// non del calibro. Verificare SEMPRE proprietario attuale + movimento.
const FASHION_REVIVAL_FLAGS = [
  'cadola', 'dartmouth brands', 'solar time', 'avi-8', 'spinnaker',
];
function isFashionRevival(item) {
  const hay = (item.title + ' ' + (item.source || '')).toLowerCase();
  return FASHION_REVIVAL_FLAGS.some(f => hay.includes(f));
}

// ── Parsing RSS senza librerie esterne ─────────────────────
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  let val = m[1].trim();
  const cdata = val.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) val = cdata[1].trim();
  return val;
}
function decodeEntities(str) {
  return String(str||'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'")
    .replace(/&apos;/g,"'");
}
function parseRssItems(xml) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const title = decodeEntities(extractTag(b, 'title'));
    const link = extractTag(b, 'link');
    const pubDate = extractTag(b, 'pubDate');
    const source = decodeEntities(extractTag(b, 'source'));
    if (title) items.push({ title, link, pubDate, source });
  }
  return items;
}

function googleNewsUrl(brand) {
  const q = encodeURIComponent(`"${brand}" watch`);
  return `https://news.google.com/rss/search?q=${q}&hl=it&gl=IT&ceid=IT:it`;
}

async function fetchBrandNews(brand) {
  try {
    const r = await axios.get(googleNewsUrl(brand), {
      headers: { 'User-Agent': 'Mozilla/5.0 (WatchbotCatalyst/1.0)' },
      timeout: 12000,
      responseType: 'text',
    });
    return parseRssItems(r.data).map(it => ({ ...it, brand }));
  } catch (e) {
    console.warn(`[catalyst] ${brand}: fetch fallito — ${e.response?.status || e.message}`);
    return [];
  }
}

function isCatalyst(item) {
  const hay = (item.title + ' ' + (item.source || '')).toLowerCase();
  return CATALYST_KEYWORDS.some(kw => hay.includes(kw.toLowerCase()));
}

// Impronta news per anti-ripetizione (riusa lo stesso meccanismo del bot)
function catalystFp(item) {
  const t = String(item.title||'').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,80);
  return 'CATALYST|' + item.brand.toLowerCase() + '|' + t;
}

function formatAlert(item) {
  const src = item.source ? ` · <i>${item.source}</i>` : '';
  const flag = isFashionRevival(item)
    ? `\n\n⚠️ <b>FASHION-REVIVAL</b>: nome rilanciato come fashion brand. Verifica proprietario + movimento prima di valutare. Probabile NON catalizzatore di valore.`
    : '';
  return `📰 <b>CATALIZZATORE — ${item.brand}</b>${src}\n\n${item.title}${flag}\n\n<a href="${item.link}">→ LEGGI</a>`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Runner principale.
 * deps = { tg, db, markAlerted, alreadyAlerted, saveState }
 * Tutto iniettato da index.js così riusa la persistenza esistente.
 */
async function runCatalystWatch(deps = {}) {
  const { tg, db, markAlerted, alreadyAlerted, saveState, onCatalyst } = deps;
  if (!tg || !db || !markAlerted || !alreadyAlerted) {
    console.error('[catalyst] dipendenze mancanti — chiamare con { tg, db, markAlerted, alreadyAlerted, saveState }');
    return { error: 'deps mancanti' };
  }

  console.log(`[catalyst] avvio scansione news — ${new Date().toISOString()}`);
  let allHits = [];

  for (const brand of CATALYST_BRANDS) {
    const news = await fetchBrandNews(brand);
    allHits.push(...news.filter(isCatalyst));
    await sleep(400); // gentile con Google News
  }

  // dedup interno + contro lo storico impronte del bot
  const fresh = [];
  const localSeen = new Set();
  for (const item of allHits) {
    const fp = catalystFp(item);
    if (localSeen.has(fp)) continue;
    if (alreadyAlerted(fp)) continue;
    localSeen.add(fp);
    fresh.push({ item, fp });
  }

  fresh.sort((a, b) => (Date.parse(b.item.pubDate)||0) - (Date.parse(a.item.pubDate)||0));

  const toSend = fresh.slice(0, MAX_ALERTS_PER_RUN);
  let sent = 0;
  for (const { item, fp } of toSend) {
    try {
      await tg(formatAlert(item));
      markAlerted(fp);
      sent++;
      // Registra l'evento catalizzatore per il tracking dell'effetto sui prezzi,
      // SALVO i fashion-revival (non sono catalizzatori di valore reale).
      if (typeof onCatalyst === 'function' && !isFashionRevival(item)) {
        try { onCatalyst({ brand: item.brand, type: 'news', title: item.title }); } catch {}
      }
      await sleep(350); // rate limit Telegram
    } catch (e) {
      console.error('[catalyst] invio fallito:', e.message);
    }
  }

  if (typeof saveState === 'function') saveState();

  console.log(`[catalyst] fine — ${allHits.length} match grezzi, ${fresh.length} nuovi, ${sent} inviati`);
  return { rawMatches: allHits.length, fresh: fresh.length, sent };
}

module.exports = {
  runCatalystWatch,
  CATALYST_BRANDS,
  CATALYST_KEYWORDS,
};
