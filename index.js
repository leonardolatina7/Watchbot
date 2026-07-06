/**
 * Watch Price Bot v12.4 — RICERCA EBAY GRATIS + ANALISI GROQ (zero costi API)
 *
 * Funziona SENZA API esterne a pagamento (eBay/Chrono24/Subito/Vinted RSS,
 * SerpAPI e Facebook opzionali). Novità v11.13 (sopra la v11.3):
 *  - ANTI-RIPETIZIONE VERA: URL normalizzati (eBay cambiava i parametri di
 *    tracking e lo stesso annuncio sembrava nuovo) + impronta titolo+prezzo
 *    con memoria 14 giorni. Gli scartati restano scartati.
 *  - Stato su disco persistente (/var/data) se montato un Render Disk:
 *    /tmp veniva azzerato a ogni deploy e gli scarti tornavano.
 *  - "DA STUDIARE" sbloccato: bastava prezzo ≤ stima minima (troppo severo),
 *    ora prezzo ≤ stima massima = in linea col mercato.
 *  - Watchlist ampliata dalla ricerca: Piaget oro, LeJour, Helvetia, Clebar,
 *    Invicta vintage vera, Poljot Strela. Blocco G con pool a rotazione.
 *  - I marchi della watchlist-Enciclopedia (Wittnauer, Excelsior Park,
 *    Enicar minori, Gallet, Movado pre-quarzo, Vulcain, EPSA, neo-vintage…)
 *    vengono cercati SEMPRE (blocco G in ogni rotazione) e arrivano come
 *    alert "📚 DA STUDIARE" anche quando NON sono affari forti, purché il
 *    prezzo sia ≤ al valore di mercato.
 *  - brandBonus finalmente collegato in claudeAnalyst (ammorbidisce le soglie).
 *  - Modulo "osservati ma non comprati": registri un pezzo scartato per prezzo
 *    con una soglia che decidi tu; il bot ti riavvisa se ricompare sotto soglia.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ── DIAGNOSI CRASH: logga in chiaro qualsiasi errore non gestito all'avvio o a
//    runtime, invece di morire in silenzio con "status 1". Se qualcosa va storto
//    nei log Render comparirà la riga esatta con [CRASH].
process.on('uncaughtException', (e) => { console.error('[CRASH uncaughtException]', e && e.stack || e); });
process.on('unhandledRejection', (e) => { console.error('[CRASH unhandledRejection]', e && e.stack || e); });

// ── BATTITO CARDIACO (diagnostica) ──────────────────────────
// Ogni 5 minuti scrive nei log Render: "sono vivo, RAM usata X MB, acceso da Y".
// A cosa serve: se il bot muore, guardando l'ULTIMA riga [HEARTBEAT] prima del
// silenzio si capisce la causa SENZA indovinare:
//  - se la RAM stava salendo verso il tetto (Starter ~512MB) → MEMORIA ESAURITA
//    (il sistema lo uccide, i gestori [CRASH] qui sopra non scattano nemmeno);
//  - se la RAM era bassa e i log si fermano di colpo → BLOCCO/loop o problema Render.
// Costa pochissimo (una riga di log ogni 5 min) e non rallenta niente.
const _bootTime = Date.now();
function _heartbeat() {
  const mu = process.memoryUsage();
  const mb = (n) => Math.round(n / 1024 / 1024);
  const upMin = Math.round((Date.now() - _bootTime) / 60000);
  console.log(`[HEARTBEAT] vivo | RAM heap ${mb(mu.heapUsed)}/${mb(mu.heapTotal)}MB · rss ${mb(mu.rss)}MB | acceso da ${upMin} min`);
}
setInterval(_heartbeat, 5 * 60 * 1000);
setTimeout(_heartbeat, 10 * 1000); // primo battito dopo 10s dall'avvio, per conferma immediata

const { findWatchModel } = require('./metalsDatabase');
const { SEED_BRANDS, scanAllBrands } = require('./discoveryEngine');
const { scanHypeModels, analyzeModel, HYPE_WATCHLIST } = require('./socialEngine');
const { VINTAGE_DB, findVintageModel, evaluateVintageDeal } = require('./vintageDatabase');
const claudeAnalyst = require('./claudeAnalyst');
const priceTracker = require('./priceTracker');
const brandWatchlist = require('./brandWatchlist');
// ── PONTE v12.13: il modulo brandWatchlist (v11.14) è stato riscritto e NON
//    esporta più checkBrand/STATUS_LABEL/BRAND_WATCHLIST (index.js li usava e
//    crashava all'avvio: "Cannot convert undefined to object"). Ora usa quello
//    che il modulo esporta DAVVERO: l'array `watchlist` [{brand,model,caliber,
//    maxBuy,note}]. Questo helper cerca un brand in watchlist e torna la sua
//    nota + tetto d'acquisto, così gli alert mostrano l'info equivalente. ──
function watchlistHit(brand) {
  if (!brand || brand === '?' || brand === 'null') return null;
  const list = brandWatchlist.watchlist || [];
  const b = brand.toLowerCase().trim();
  const m = list.find(w => (w.brand || '').toLowerCase() === b)
         || list.find(w => b.includes((w.brand || '').toLowerCase()) || (w.brand || '').toLowerCase().includes(b));
  if (!m) return null;
  return { note: m.note || '', maxBuy: m.maxBuy || null, model: m.model || '' };
}
const encyclopedicQueries = require('./encyclopedicQueries');
const dealEngine = require('./dealEngine');
const caliberDb = require('./caliberDatabase');
// safeRequire: se un modulo NUOVO è rotto/disallineato, NON abbattere tutto il
// bot — logga l'errore in chiaro e continua con un fallback inerte. Così il bot
// parte comunque e nei log si LEGGE quale modulo ha problemi.
function safeRequire(path, fallback) {
  try { return require(path); }
  catch (e) { console.error(`[safeRequire] modulo ${path} NON caricato:`, e.message); return fallback; }
}
const longines = safeRequire('./longinesCalibers', { longinesLine: () => '', analyzeLongines: () => ({ isLongines:false }) });
const trademarkRadar = require('./trademarkRadar');
const awardsRadar = require('./awardsRadar');
const soldComps = require('./soldComps');
const catalystWatch = safeRequire('./catalystWatch', { runCatalystWatch: async () => [], CATALYST_BRANDS: [] });
const portfolio = require('./portfolio'); // ── MEMORIA DECISIONI + P&L (compro/passo/vendo) ──
const catalystTracking = require('./catalystTracking'); // ── STORICO BRAND + EFFETTO CATALIZZATORE ──
const aiGate = require('./aiGate'); // ── GATE DI TESI PRE-AI (v12.22): scarta la fuffa, Sonnet solo sui caldi ──
const ahciRadar = require('./ahciRadar'); // ── RADAR AHCI (v12.23): nuovi candidati indie allo stadio rumor ──
// ── FLIP CIECO (gemme nascoste da inserzioni generiche) ──
const genericQueries = require('./genericQueries');
const blindHunter = safeRequire('./blindHunter', { huntGems: async () => [], longinesLine: () => '' });
// ── RASSEGNA STAMPA delle 8:00 (tutte le news dalle fonti autorevoli) ──
const morningBrief = safeRequire('./morningBrief', { runMorningBrief: async () => ({ sent: 0 }) });

const app = express();
app.use(cors());
app.use(express.json());

// Limite globale dimensione pagine (anti heap-out-of-memory): ogni richiesta
// axios rifiuta risposte oltre 2MB.
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
axios.defaults.maxContentLength = MAX_PAGE_BYTES;
axios.defaults.maxBodyLength = MAX_PAGE_BYTES;
axios.defaults.maxRedirects = 3;

function parseAndFree(html, extractor) {
  let $ = cheerio.load(html);
  let out = [];
  try { out = extractor($) || []; } catch (e) { out = []; }
  $ = null; html = null;
  return out;
}

// Database in memoria
let db = {
  arbitrage: [], nearArbitrage: [],
  vintageDeals: [],
  discoveries: [], discoveryAlerts: [],
  hypeAnalyses: [], hypeAlerts: [],
  watchlist: [], portfolio: [], alerts: [],
  goldPrices: [], platinumPrices: [], palladiumPrices: [],
  blacklistBrands: [],
  dismissedUrls: [],
  dismissedFps: [], // ── impronte (titolo+prezzo) degli scartati: blocca il pezzo anche se ripubblicato con URL nuovo
  liked: [],
  observed: [],   // ── pezzi "osservati ma non comprati" (soglia manuale)
  alertedFps: {}, // ── impronte degli annunci già segnalati (anti-ripetizione)
  ahciKnown: [], // ── slug candidati AHCI già visti (radar indie, v12.23)
};
let _id = Date.now();
const nid = () => ++_id;

// ── PERSISTENZA FEEDBACK (blacklist) ──
const fs = require('fs');
// Se su Render è montato un Disk persistente (/var/data), uso quello: /tmp
// viene CANCELLATO a ogni riavvio/deploy ed era il motivo per cui gli
// annunci scartati ritornavano. Senza disk, /tmp resta il fallback.
const STATE_FILE = process.env.STATE_FILE ||
  (fs.existsSync('/var/data') ? '/var/data/watchbot-state.json' : '/tmp/watchbot-state.json');

// ── PERSISTENZA DUREVOLE SU GITHUB GIST ──
// Su Render free /tmp viene cancellato a ogni spin-down/deploy, quindi gli
// annunci scartati tornavano. Se imposti GIST_ID + GITHUB_TOKEN (PAT con scope
// "gist") su Render, lo stato viene salvato su un Gist privato e SOPRAVVIVE a
// riavvii e redeploy, gratis. /tmp resta come cache locale veloce.
const GIST_ID    = process.env.GIST_ID || '';
const GIST_TOKEN = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN || '';
const GIST_FILE  = 'watchbot-state.json';
const gistOn = !!(GIST_ID && GIST_TOKEN);
let _gistTimer = null;

async function gistLoad() {
  if (!gistOn) return null;
  try {
    const r = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GIST_TOKEN}`, 'User-Agent': 'watchbot', Accept: 'application/vnd.github+json' },
      timeout: 12000
    });
    const f = r.data.files && r.data.files[GIST_FILE];
    if (f && f.content) return JSON.parse(f.content);
  } catch (e) { console.error('[GIST] load:', e.response?.status || e.message); }
  return null;
}
// PROTEZIONE ANTI-AZZERAMENTO: finché il caricamento iniziale del Gist non è
// andato a buon fine, NON si scrive sul Gist. Senza questo, se il Gist andava in
// timeout all'avvio (dopo un deploy, con /tmp vuoto) il bot ripartiva con memoria
// vuota e al primo alert SOVRASCRIVEVA il Gist a zero → "gli scarti tornano".
let gistLoadOk = false;
// Patch del Gist con debounce: durante una scansione saveState() viene chiamato
// molte volte; accorpo in un'unica PATCH ~4s dopo l'ultima modifica per non
// martellare l'API GitHub (limite 5000 req/h, ma inutile sprecarle).
function gistSaveDebounced(payload) {
  if (!gistOn) return;
  if (!gistLoadOk) { console.log('[GIST] salvataggio rimandato: load iniziale non ancora confermato (proteggo la memoria)'); return; }
  if (_gistTimer) clearTimeout(_gistTimer);
  _gistTimer = setTimeout(async () => {
    try {
      await axios.patch(`https://api.github.com/gists/${GIST_ID}`,
        { files: { [GIST_FILE]: { content: JSON.stringify(payload) } } },
        { headers: { Authorization: `Bearer ${GIST_TOKEN}`, 'User-Agent': 'watchbot', Accept: 'application/vnd.github+json' }, timeout: 12000 });
      console.log(`[GIST] salvato (${(payload.dismissedUrls||[]).length} scartati, ${Object.keys(payload.alertedFps||{}).length} impronte, ${(payload.blacklistBrands||[]).length} marchi)`);
    } catch (e) { console.error('[GIST] save:', e.response?.status || e.message); }
  }, 4000);
}

// Normalizza un URL: via parametri di tracking (eBay li cambia a ogni
// visita, quindi lo stesso annuncio sembrava sempre "nuovo"), via hash,
// host minuscolo. Confrontiamo SOLO la parte stabile.
function normUrl(u) {
  try {
    const x = new URL(String(u||''));
    return (x.host.toLowerCase().replace(/^www\./,'') + x.pathname.replace(/\/$/,'')).toLowerCase();
  } catch { return String(u||'').toLowerCase().split('?')[0].split('#')[0]; }
}
// Impronta dell'annuncio: titolo normalizzato + prezzo arrotondato a 25€.
// Stesso pezzo ripubblicato con URL diverso = stessa impronta = niente doppione.
function listingFp(title, priceEur) {
  const t = String(title||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().slice(0,70);
  return t + '|' + (Math.round((priceEur||0)/25)*25);
}
const ALERT_COOLDOWN_MS = 14*24*3600000; // non ri-avvisare lo stesso pezzo per 14 giorni
function alreadyAlerted(fp) {
  const ts = db.alertedFps[fp];
  return ts && (Date.now() - ts) < ALERT_COOLDOWN_MS;
}
function markAlerted(fp) {
  db.alertedFps[fp] = Date.now();
  // pulizia: tengo solo gli ultimi 30 giorni
  const cutoff = Date.now() - 30*24*3600000;
  for (const k of Object.keys(db.alertedFps)) if (db.alertedFps[k] < cutoff) delete db.alertedFps[k];
}
function buildStatePayload() {
  return {
    blacklistBrands: db.blacklistBrands,
    dismissedUrls: db.dismissedUrls.slice(-2000),
    dismissedFps: db.dismissedFps.slice(-4000),
    liked: db.liked.slice(-500),
    observed: db.observed.slice(-300),
    alertedFps: db.alertedFps,
    ahciKnown: db.ahciKnown || [],
  };
}
function saveState() {
  const payload = buildStatePayload();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload));
  } catch (e) { console.error('[STATE] save:', e.message); }
  gistSaveDebounced(payload); // memoria durevole gratis (se configurata)
}
// Salvataggio Gist IMMEDIATO (niente debounce da 4s). Serve per le azioni
// utente una-tantum — scarta / blocca marchio — che spesso sono l'ultima
// attività prima dello spin-down di Render: col debounce il timer non scattava
// mai e lo scarto si perdeva (→ "gli scarti tornano"). Qui scriviamo subito.
async function gistSaveNow() {
  if (!gistOn) return;
  if (_gistTimer) { clearTimeout(_gistTimer); _gistTimer = null; }
  const payload = buildStatePayload();
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(payload)); } catch (e) { console.error('[STATE] save:', e.message); }
  if (!gistLoadOk) { console.log('[GIST] save-now rimandato: load iniziale non confermato (proteggo la memoria su Gist)'); return; }
  try {
    await axios.patch(`https://api.github.com/gists/${GIST_ID}`,
      { files: { [GIST_FILE]: { content: JSON.stringify(payload) } } },
      { headers: { Authorization: `Bearer ${GIST_TOKEN}`, 'User-Agent': 'watchbot', Accept: 'application/vnd.github+json' }, timeout: 12000 });
    console.log(`[GIST] salvato SUBITO (azione utente — ${payload.dismissedUrls.length} scartati)`);
  } catch (e) { console.error('[GIST] save-now:', e.response?.status || e.message); }
}
function loadState() {
  if (process.env.BLACKLIST_BRANDS) {
    for (const b of process.env.BLACKLIST_BRANDS.split(',').map(s=>s.trim()).filter(Boolean)) {
      if (!db.blacklistBrands.includes(b)) db.blacklistBrands.push(b);
    }
  }
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      for (const b of (s.blacklistBrands||[])) if (!db.blacklistBrands.includes(b)) db.blacklistBrands.push(b);
      // converto i vecchi URL scartati in forma normalizzata
      db.dismissedUrls = Array.from(new Set([...(db.dismissedUrls||[]), ...((s.dismissedUrls||[]).map(normUrl))]));
      db.dismissedFps = Array.from(new Set([...(db.dismissedFps||[]), ...(s.dismissedFps||[])]));
      db.liked = s.liked || [];
      db.observed = s.observed || [];
      db.alertedFps = s.alertedFps || {};
      db.ahciKnown = Array.from(new Set([...(db.ahciKnown||[]), ...(s.ahciKnown||[])]));
      console.log(`[STATE] Caricati da ${STATE_FILE}: ${db.blacklistBrands.length} marchi bloccati, ${db.dismissedUrls.length} annunci scartati, ${db.liked.length} piaciuti, ${db.observed.length} osservati, ${Object.keys(db.alertedFps).length} impronte`);
    }
  } catch (e) { console.error('[STATE] load:', e.message); }
}
// Overlay durevole: dopo loadState() (env + /tmp), sovrappongo il Gist.
// Union, mai clobber: il Gist sopravvive ai riavvii, il /tmp no, quindi
// in pratica è il Gist a ripopolare gli scartati persi.
async function loadStateGist() {
  if (!gistOn) { console.log('[GIST] non configurato (manca GIST_ID o GITHUB_TOKEN) — persistenza solo /tmp, gli scartati possono tornare dopo un riavvio.'); return; }
  const s = await gistLoad();
  if (!s) {
    // load fallito (timeout/errore): NON abilito la scrittura, così non azzero
    // il Gist buono. Riproverò al prossimo avvio. Meglio nessun salvataggio che
    // sovrascrivere la memoria con uno stato vuoto.
    console.error('[GIST] load iniziale FALLITO — scrittura Gist DISABILITATA per sicurezza (la memoria su Gist resta intatta).');
    return;
  }
  for (const b of (s.blacklistBrands||[])) if (!db.blacklistBrands.includes(b)) db.blacklistBrands.push(b);
  db.dismissedUrls = Array.from(new Set([...(db.dismissedUrls||[]), ...((s.dismissedUrls||[]).map(normUrl))]));
  db.dismissedFps = Array.from(new Set([...(db.dismissedFps||[]), ...(s.dismissedFps||[])]));
  if ((s.liked||[]).length    >= db.liked.length)    db.liked = s.liked;
  if ((s.observed||[]).length >= db.observed.length) db.observed = s.observed;
  db.alertedFps = Object.assign({}, s.alertedFps||{}, db.alertedFps||{});
  gistLoadOk = true; // SOLO ora abilito la scrittura sul Gist
  console.log(`[GIST] caricato: ${db.blacklistBrands.length} marchi bloccati, ${db.dismissedUrls.length} annunci scartati, ${Object.keys(db.alertedFps).length} impronte — scrittura ABILITATA`);
}
function normBrand(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function isBrandBlacklisted(brand) {
  if (!brand) return false;
  const n = normBrand(brand);
  return db.blacklistBrands.some(b => { const nb = normBrand(b); return nb && (n === nb || n.includes(nb) || nb.includes(n)); });
}
const SELF_URL = (process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'https://watchbot-g6kl.onrender.com').replace(/\/$/, '');
const MAX_PRICE = parseInt(process.env.MAX_PRICE || '10000');
// Pavimento di scansione. Era cablato a 200 → tagliava i grezzi (manifattura
// che l'ignorante mette a €90–180), proprio i pezzi del canale FLIP GREZZO.
// Default 70: sopra il lotto/giocattolo, sotto la soglia dei grezzi veri.
// L'AI (isInteresting/isFlipGrezzo) resta il filtro vero. Tunabile da Render.
const SCAN_FLOOR = parseInt(process.env.SCAN_FLOOR || '40');

// ── FILTRO PEZZI DI RICAMBIO ──
const PARTS_PATTERNS = [
  /\bsolo\s+(quadrante|movimento|cassa|lancette|ghiera|corona|fondello|vetro)\b/i,
  /\b(quadrante|movimento|cassa|lancette|ghiera|corona|fondello|vetro|cinturino|bracciale)\s+(solo|only|per)\b/i,
  /\b(dial|movement|case|hands|bezel|crown|caseback|crystal|strap|band|bracelet)\s+only\b/i,
  /\bonly\s+(dial|movement|case|hands|bezel|crown|caseback|crystal|strap|band)\b/i,
  /\b(dial|movement|bezel|crown|caseback|crystal)\s+for\b/i,
  /\bfor\s+parts?\b/i,
  /\bspare\s+parts?\b/i,
  /\b(ricambi|ricambio|per\s+ricambi|da\s+ricambi)\b/i,
  /\bquadrante\s+e\s+lancette\b/i,
  /\bdial\s+(and|&|\+)\s+hands\b/i,
  /\bcassa\s+vuota\b/i,
  /\bempty\s+case\b/i,
  /\bsenza\s+movimento\b/i,
  /\bnur\s+(zifferblatt|gehäuse|uhrwerk|zeiger)\b/i,
  /\bcadran\s+seul\b/i,
  /\bzifferblatt\s+(für|nur)\b/i,
  /\b(set|kit)\s+(lancette|hands|quadrante)\b/i,
];
function looksLikeParts(title) {
  const t = String(title||'');
  return PARTS_PATTERNS.some(re => re.test(t));
}

// ─────────────────────────────────────────────────────────────────────────
// FILTRO CATEGORIA NON-OROLOGIO (multilingua: IT/EN/NL/FR/DE/ES)
// Un marchio in watchlist (Cartier, Omega, Longines...) vende anche occhiali,
// penne, gioielli, accendini. Senza questo filtro un "Cartier zonnebril"
// (occhiali da sole, NL) passa il match-marchio e brucia token su Claude.
// Questo è l'UNICO chokepoint: gira a costo zero PRIMA di ogni analisi/alert.
// Regola: se il titolo contiene un termine di categoria non-orologio E NON
// contiene un termine inequivocabilmente da orologio, l'annuncio si scarta.
// ─────────────────────────────────────────────────────────────────────────
const NOT_A_WATCH_PATTERNS = [
  // Occhiali / sole / vista
  /\b(occhial[ei]|sunglass(es)?|eyewear|zonnebril(len)?|\bbril(len)?\b|lunettes?|brille|gafas|sonnenbrille|montatur[ae])\b/i,
  // Penne / stilografiche
  /\b(penna|penne|stilografica|stylo|vulpen|fountain\s*pen|ballpoint|kugelschreiber|roller\s*ball)\b/i,
  // Gioielli (anello, bracciale-gioiello, collana, orecchini, ciondolo, spilla)
  /\b(anello|anelli|\bring\b|\bringe\b|collana|collane|necklace|ketting|collier|halskette|orecchin[oi]|earrings?|oorbel|ciondolo|pendant|hanger|spilla|brooch|broche|gemell[oi]|cufflinks?|manchetknopen)\b/i,
  // Accendini
  /\b(accendino|lighter|aansteker|briquet|feuerzeug|encendedor)\b/i,
  // Borse / portafogli / cinture / foulard / occhiali da lettura
  /\b(borsa|borsetta|\bbag\b|handbag|tas\b|sac\b|portafogli|wallet|portemonnee|portefeuille|cintura|\bbelt\b|riem\b|ceinture|g\u00fcrtel|foulard|scarf|sciarpa|sjaal|\btie\b|cravatta|stropdas)\b/i,
  // Profumi / cosmetici
  /\b(profumo|perfume|parfum|eau\s*de\s*(toilette|parfum)|aftershave|cologne)\b/i,
  // Portachiavi / accessori vari
  /\b(portachiavi|keychain|sleutelhanger|porte-cl\u00e9s)\b/i,
];
// ── CATEGORIA "DURA": MAI un orologio da polso, anche se il titolo contiene
//    la parola "orologio"/"watch" (es. "quadro pubblicitario Eberhard orologi",
//    "orologio da parete Eberhard", "sveglia"). Questi NON passano dall'override.
//    Sono i falsi annunci che continuavano ad arrivare: quadri, stampe,
//    pubblicità d'epoca, orologi da muro/tavolo, sveglie, pendole.
//    NB: "da tasca" (pocket) NON è qui: i pocket watch li vogliamo. ──
const HARD_NOT_A_WATCH_PATTERNS = [
  // Quadri / stampe / pubblicità / cartellonistica d'epoca
  /\b(quadr[oi]|cornice|cornici|stampa|stampe|poster|manifesto|manifesti|locandin[ae]|pubblicit\u00e0|pubblicitari[oa]|advertis(ing|ement)|werbung|affiche|cartell[oi]|insegna|insegne|targa|targhe|plaque|sign\b|placca)\b/i,
  // DIPINTI / ARTE (multilingua) — un PITTORE che si chiama come un marchio
  // (es. "Heinrich Eberhard 1874-1973", olio su tela) non è un orologio.
  /\b(dipint[oi]|olio\s+su\s+tela|pittura|pittore|tempera|acquerell[oi]|acquarell[oi]|painting|oil\s+on\s+canvas|artwork|watercolou?r|fine\s*art|schilderij(en)?|olieverf(schilderij)?|\bdoek\b|schilder\b|schilderkunst|aquarel|prerafa|\bkunst\b|gem[\u00e4a]lde|[\u00f6o]lgem[\u00e4a]lde|leinwand|maler\b|peinture|tableau|huile\s+sur\s+toile|aquarelle|pintura|cuadro|\b[\u00f3o]leo\b|lienzo|acuarela)\b/i,
  // Orologi NON da polso: da parete, da tavolo, da muro, sveglie, pendole
  /\b(da\s*parete|a\s*muro|da\s*muro|da\s*tavolo|da\s*mensola|wall\s*clock|table\s*clock|desk\s*clock|wandklok|tafelklok|wanduhr|tischuhr|pendule\s*murale|sveglia|sveglie|alarm\s*clock|wekker|r\u00e9veil|pendol[oa]|pendul[eo]|pendola|comtoise|carillon|grandfather\s*clock|orologio\s*da\s*(parete|tavolo|muro|mensola|camino))\b/i,
  // Cataloghi / riviste / documentazione (non l'orologio)
  /\b(catalogo|catalogue|katalog|rivista|magazine|brochure|d\u00e9pliant|depliant|libro\s+su|book\s+about|boek\b)\b/i,
];
// Termini che, se presenti, confermano che È un orologio (override): salvano
// casi tipo "watch + box" o annunci misti dove l'orologio è il pezzo vero.
const IS_WATCH_OVERRIDE = /\b(orologio|orologi|watch|wristwatch|horloge|montre|armbanduhr|uhr\b|reloj|zegarek|zegarka|ceas|chronograph|chronographe|cronografo|automatic|automatico|automatique|automatyczny|carica\s*manuale|hand[\s-]*wind|datejust|seamaster|speedmaster|submariner|calibr[eo]|caliber|jewels?|rubis|movement|movimento|quadrante|\bdial\b|ghiera|bracelet\s*watch)\b/i;

function looksLikeNotAWatch(title) {
  const t = String(title || '');
  // 1) Categoria DURA: scarta sempre, l'override NON la salva.
  if (HARD_NOT_A_WATCH_PATTERNS.some(re => re.test(t))) return true;
  // 2) Categoria morbida: scarta solo se non è chiaramente un orologio.
  if (!NOT_A_WATCH_PATTERNS.some(re => re.test(t))) return false;
  if (IS_WATCH_OVERRIDE.test(t)) return false;
  return true;
}

function feedbackLinks(brand, url, title, price) {
  const b = encodeURIComponent(brand || '');
  const u = encodeURIComponent(url || '');
  const ti = encodeURIComponent((title || '').slice(0, 80));
  const pr = encodeURIComponent(price != null ? String(price) : '');
  const piace   = `<a href="${SELF_URL}/api/fb?a=lk&b=${b}&u=${u}&t=${ti}">\u{1F44D} Mi piace</a>`;
  const blocca  = brand ? `<a href="${SELF_URL}/api/fb?a=bl&b=${b}">\u{1F6AB} Niente ${brand}</a>` : '';
  const scarta  = `<a href="${SELF_URL}/api/fb?a=dz&u=${u}&t=${ti}&p=${pr}">\u{1F44E} Scarta questo</a>`;
  const osserva = `<a href="${SELF_URL}/api/osserva?b=${b}&u=${u}&t=${ti}&p=${pr}">\u{1F441}\uFE0F Osserva (riavvisa se scende)</a>`;
  const analizza= `<a href="${SELF_URL}/api/analyze?b=${b}&u=${u}&t=${ti}&p=${pr}">\u{1F50D} Analizza con Claude</a>`;
  return `${piace}\n${blocca ? blocca + '   ' : ''}${scarta}\n${osserva}\n${analizza}`;
}

// ── PREZZI METALLI ──

// Un'unica chiamata recupera oro+platino+palladio insieme (erano 3 chiamate
// identiche). goldprice.org a volte blocca: c'è una fonte di riserva.
let metalsSpot = null, metalsFetched = 0, metalsLive = false;
let lastScraperDiag = null; // ultimo conteggio annunci per-piazza (per /api/diagnostica)
async function fetchMetalsSpot() {
  if (metalsSpot && Date.now() - metalsFetched < 30*60*1000) return metalsSpot;
  // tasso USD->EUR (se fallisce, 0.92)
  let eur = 0.92;
  try {
    const fx = await axios.get('https://api.frankfurter.app/latest?from=USD&to=EUR', { timeout: 6000 });
    if (fx.data?.rates?.EUR) eur = fx.data.rates.EUR;
  } catch (e) { console.warn('[FX] fallback 0.92:', e.message); }

  // FONTE 1: goldprice.org (prezzi per oncia troy in USD)
  try {
    const r = await axios.get('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer:'https://goldprice.org/', Accept:'application/json' },
      timeout: 9000
    });
    const it = r.data?.items?.[0];
    if (it && it.xauPrice) {
      metalsSpot = {
        gold:      it.xauPrice * eur / 31.1035,
        platinum: (it.xptPrice||0) * eur / 31.1035,
        palladium:(it.xpdPrice||0) * eur / 31.1035,
      };
      metalsFetched = Date.now(); metalsLive = true;
      console.log(`[METALLI] LIVE goldprice.org: oro €${metalsSpot.gold.toFixed(2)}/g pt €${metalsSpot.platinum.toFixed(2)} pd €${metalsSpot.palladium.toFixed(2)}`);
      return metalsSpot;
    }
  } catch (e) { console.error('[METALLI] goldprice.org KO:', e.response?.status||e.code||e.message); }

  // FONTE 2 (riserva): metals.live / gold-api
  try {
    const r = await axios.get('https://api.gold-api.com/price/XAU', { timeout: 8000 });
    const ptR = await axios.get('https://api.gold-api.com/price/XPT', { timeout: 8000 }).catch(()=>null);
    const pdR = await axios.get('https://api.gold-api.com/price/XPD', { timeout: 8000 }).catch(()=>null);
    if (r.data?.price) {
      metalsSpot = {
        gold:      r.data.price * eur / 31.1035,
        platinum: (ptR?.data?.price||0) * eur / 31.1035,
        palladium:(pdR?.data?.price||0) * eur / 31.1035,
      };
      metalsFetched = Date.now(); metalsLive = true;
      console.log(`[METALLI] LIVE gold-api (riserva): oro €${metalsSpot.gold.toFixed(2)}/g`);
      return metalsSpot;
    }
  } catch (e) { console.error('[METALLI] gold-api KO:', e.response?.status||e.code||e.message); }

  // Nessuna fonte risponde: tengo l'ultimo valido se c'è, altrimenti stime
  metalsLive = false;
  if (!metalsSpot) {
    console.warn('[METALLI] Nessuna fonte live, uso stime di emergenza');
    metalsSpot = { gold: 95, platinum: 30, palladium: 32 };
  } else {
    console.warn('[METALLI] Fonti KO, riuso ultimo valore noto');
  }
  return metalsSpot;
}

async function getGoldPrice() {
  const m = await fetchMetalsSpot();
  if (metalsLive) {
    db.goldPrices.push({ price: m.gold, at: new Date().toISOString() });
    if (db.goldPrices.length > 96) db.goldPrices = db.goldPrices.slice(-96);
  }
  return m.gold;
}
async function getPlatinumPrice() {
  const m = await fetchMetalsSpot();
  if (metalsLive && m.platinum) {
    db.platinumPrices.push({ price: m.platinum, at: new Date().toISOString() });
    if (db.platinumPrices.length > 96) db.platinumPrices = db.platinumPrices.slice(-96);
  }
  return m.platinum || 30;
}
async function getPalladiumPrice() {
  const m = await fetchMetalsSpot();
  if (!db.palladiumPrices) db.palladiumPrices = [];
  if (metalsLive && m.palladium) db.palladiumPrices.push({ price: m.palladium, at: new Date().toISOString() });
  return m.palladium || 32;
}

// ── METALLI ──
const GOLD_KW = ['18k','18kt','750','au750','18ct','18 karat','18 carati','18 carats','or 18','oro 18','gold 18','yellow gold','rose gold','white gold','solid gold','oro giallo','oro rosa','oro bianco','or jaune','or rose','or blanc','everose','sedna','moonshine','gelbgold','rotgold','weissgold'];
// Toglie dal titolo le sequenze che NON sono carature ma referenze/calibri:
// "702-916", "ref. 916", "cal 750", "7750", numeri attaccati a trattino/ref/cal.
// Va applicata PRIMA di cercare il punzone, altrimenti il numero di una
// referenza (es. Zodiac 702-916) viene scambiato per oro 916/750.
function stripRefNumbers(s) {
  return (s || '')
    .replace(/\b(ref|rif|cal|calibre|calibro|movement|mvmt|modell?o?|art|cod|n[._]?)\.?\s*[a-z]?\d[\d.\-\/]*/gi, ' ') // ref/cal/art + numero
    .replace(/\b\d{2,4}\s*-\s*\d{2,4}\b/g, ' ')   // sequenze con trattino tipo 702-916, 6239-12
    .replace(/\b\d{4,}\b/g, ' ');                  // numeri lunghi (7750, 2446, seriali): mai carature
}
const PLAT_KW = ['platino','platinum','pt950','pt 950','pt900','platin','platine'];
function detectMetal(t) {
  const raw = (t||'').toLowerCase();
  // 1) Pulisco prima referenze/calibri/seriali: i loro numeri non sono carature.
  const s = stripRefNumbers(raw);

  // 2) Oro solo PARZIALE (ghiera/corona/quadrante in oro, bicolore, placcato,
  //    laminato, gold-filled): NON è oro massiccio → niente arbitraggio metallo.
  const goldPart = /\b(ghiera|lunetta|bezel|corona|crown|quadrante|dial|indici|index|lancette|hands|fibbia|buckle|maglie|links?)\b/i;
  const goldWord = /\b(oro|gold|or|gouden|gouд)\b/i;
  const steelWord = /\b(acciaio|inox|inossidabile|steel|stainless|stahl|acier|staal)\b/i;
  const partialGold =
       /\b(ghiera|lunetta|bezel|corona|crown|quadrante|dial|indici|lancette|fibbia|buckle)\s+(in\s+)?(oro|gold|or|gouden)\b/i.test(s)
    || /\b(oro|gold|or|gouden)\s+(ghiera|lunetta|bezel|corona|crown|fibbia|buckle)\b/i.test(s)
    || /\b(solo|only)\s+(la\s+)?(ghiera|lunetta|bezel|corona|crown)\b.*\b(oro|gold|or)\b/i.test(s)
    || /\b(acciaio\s*[\/e]+\s*oro|oro\s*[\/e]+\s*acciaio|steel\s*(and|&|\/)\s*gold|gold\s*(and|&|\/)\s*steel|two.?tone|bicolor|bicolore|acier\s*or|stahl\s*gold|staal\s*[\/e]*\s*goud|goud\s*[\/e]*\s*staal)\b/i.test(s)
    || /\b(placcat|plated|plaqu|gold.?cap(ped)?\b|cappato|cappata|laminat|gold.?filled|gold.?tone|gold.?plated|dorat|doré|doree|vergoldet|rolled\s*gold|microni|micron|plaque\s*or|gold\s*shell)\b/i.test(s)
    // REGOLA FORTE (fix falso positivo Omega staal/goud): se nel titolo compaiono
    // INSIEME una parola-acciaio e una parola-oro, è bicolore/trim, NON oro massiccio.
    // Un vero orologio d'oro massiccio non scrive "acciaio/staal/steel" nel titolo.
    // Prima la rete richiedeva anche una parte specifica (ghiera/maglie) e i titoli
    // stringati come "Staal/14K Goud" sfuggivano → venivano quotati come oro pieno.
    || (steelWord.test(s) && goldWord.test(s))
    // fondello in acciaio + oro = la cassa NON è oro massiccio (le casse d'oro hanno fondello d'oro)
    || /\b(fondello|caseback|case\s*back|snap.?back|fondo)\s+(in\s+)?(acciaio|steel|inox|stainless)\b/i.test(s);
  if (partialGold) return null;

  if (PLAT_KW.some(k=>s.includes(k))) return 'platinum';

  // 3) Oro FORTE: parole esplicite di oro massiccio.
  const goldStrong = ['18k','18kt','18 karat','18 carati','18 carats','or 18','oro 18','gold 18',
    'yellow gold','rose gold','white gold','solid gold','oro massiccio','oro giallo','oro rosa','oro bianco',
    'or jaune','or rose','or blanc','or massif','everose','sedna','moonshine','gelbgold','rotgold','weissgold',
    'oro 18k','oro 18kt','14k','14kt','oro 14','9k','9kt','oro 9'];
  // 4) Caratura come PUNZONE (750/585/375/999) — SOLO se accompagnata, vicino,
  //    da una parola d'oro vera. 916 RIMOSSA: collide con referenze/anni ed è
  //    un punzone rarissimo sugli orologi europei (era la causa del falso oro).
  //    "vicino" = entro pochi caratteri, così "750" isolato in un titolo non basta.
  const punzoneVicinoOro =
    /\b(oro|gold|or|au|z[łl]ot\w*|aur|goud\w*|golden\w*)\b[^0-9]{0,6}(750|585|375|999)\b/i.test(s) ||
    /\b(750|585|375|999)\b[^0-9]{0,6}(oro|gold|or|kt|karat|carat|ct|aur|goud\w*)\b/i.test(s) ||
    // Lingue con parola-oro lontana dal punzone ("złoty zegarek Longines 750",
    // "gouden horloge 750"): finestra larga SOLO in avanti, ed ESCLUSO il caso
    // valuta polacca — "750 zł" è un PREZZO, non un punzone.
    /\b(z[łl]ot\w*|aur|goud\w*)\b[^0-9]{0,18}\b(750|585|375)\b(?!\s*z[łl])/i.test(s);

  // ── CARATURA REALE (v12.26, fix Seamaster "14k Gold Cap" quotato come 18k):
  //    prima QUALSIASI oro dichiarato tornava '18k' e la matematica del 750
  //    veniva applicata anche a pezzi 585/375 → sopravvalutazione del 22-50%.
  //    Ora la caratura dichiarata comanda; senza caratura esplicita resta 18k
  //    (il caso tipico dei marchi nobili europei). ──
  if (goldStrong.some(k => s.includes(k)) || punzoneVicinoOro) {
    if (/\b(14\s?kt?|585)\b/i.test(s) && !/\b(18\s?kt?|750)\b/i.test(s)) return '14k';
    if (/\b(9\s?kt?|375)\b/i.test(s) && !/\b(18\s?kt?|750)\b/i.test(s)) return '9k';
    return '18k';
  }

  return null;
}
// ── TESI MELT-SCARCITY: marchi nobili solo-tempo oro che vengono fusi per il
//    peso → scarsità futura. Se il titolo combacia, aggiungo un suggerimento
//    operativo all'alert oro: non è un flip, è un accumulo da tenere. ──
const MELT_SCARCITY_BRANDS = ['omega','longines','iwc','universal','movado','vacheron','patek','girard','jaeger','lecoultre','zenith','eterna','eberhard'];
function meltScarcityHint(title) {
  const s = String(title||'').toLowerCase();
  const isNoble = MELT_SCARCITY_BRANDS.some(b => s.includes(b));
  const isCrono = /(chrono|crono|valjoux|venus|landeron|lemania|el primero)/.test(s);
  const isLadies = /(donna|signora|lady|ladies|damen|femme)/.test(s);
  if (!isNoble && !isLadies) return '';
  if (isCrono) return ''; // i crono da collezione NON rientrano nella tesi melt
  return `\u{1F4A1} <b>MELT-SCARCITY PLAY:</b> dress/ladies oro 18k marchio nobile = categoria che viene FUSA per il peso. Compra vicino al melt (floor=rischio ~zero) SOLO con quadrante originale + cassa non lucidata: i sopravvissuti salgono per scarsità 3-5 anni. Da TENERE, non flippare.\n`;
}
async function calcMetal(title, priceEur) {
  const metal = detectMetal(title);
  if (!metal) return null;
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  const model = findWatchModel(title);
  if (!model) return null;
  const spot = metal === 'platinum' ? platinum : gold;
  // ── SCALA CARATURA (v12.26): il database pesi assume la versione 18k.
  //    Stessa cassa in 14k/9k = stesso volume, meno fino dentro. ──
  const purityAdj = metal === '14k' ? (0.585/0.75) : metal === '9k' ? (0.375/0.75) : 1;
  const pureGrams = Math.round(model.pureMetalGrams * purityAdj * 10) / 10;
  const gramsLowAdj  = model.gramsLow  ? Math.round(model.gramsLow  * purityAdj * 10) / 10 : null;
  const gramsHighAdj = model.gramsHigh ? Math.round(model.gramsHigh * purityAdj * 10) / 10 : null;
  // ── GUARDIA PESO (v12.26, fix falso positivo "Seamaster 71g" su vintage a
  //    cinturino): i pesi grossi (>60g puri) nel database vengono dai modelli
  //    moderni con BRACCIALE in oro integrato. Valgono SOLO se il titolo cita
  //    la referenza esatta; senza referenza, il peso grosso NON si applica →
  //    confidenza bassa, niente alert metallo (il pezzo prosegue verso l'AI). ──
  let weightKnown = model.weightKnown === true;
  let confidence = model.confidence;
  if (model.pureMetalGrams > 60) {
    const tRaw = String(title || '').toLowerCase();
    const refHit = (model.refs || []).some(r => r && tRaw.includes(String(r).toLowerCase()));
    if (!refHit) { weightKnown = false; confidence = 'low'; }
  }
  const metalValue = Math.round(pureGrams * spot);
  const diff = metalValue - priceEur;
  const diffPct = Math.round((diff/metalValue)*1000)/10;
  const valueLow  = gramsLowAdj  ? Math.round(gramsLowAdj  * spot) : metalValue;
  const valueHigh = gramsHighAdj ? Math.round(gramsHighAdj * spot) : metalValue;
  const safeFloor = valueLow;
  const underSafeFloor = priceEur <= safeFloor;
  return { metal, pureMetalGrams: pureGrams, metalValue,
    gramsLow: gramsLowAdj, gramsHigh: gramsHighAdj,
    valueLow, valueHigh, safeFloor, underSafeFloor,
    spotPrice: Math.round(spot*100)/100, diffPct, diff,
    isArbitrage: diffPct>0, isNear: diffPct>-15&&diffPct<=0,
    confidence, weightKnown,
    generic: model.generic === true, brand: model.brand };
}

// ── FX ──
let fx = { USD:0.92, GBP:1.17, CHF:1.05, PLN:0.23, MXN:0.050, BRL:0.16, RON:0.20 }, fxF = 0;
async function toEur(price, currency) {
  if (!price||currency==='EUR') return price;
  if (Date.now()-fxF>3600000) {
    try { const r=await axios.get('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF,PLN,MXN,BRL,RON',{timeout:5000}); fx={USD:1/r.data.rates.USD,GBP:1/r.data.rates.GBP,CHF:1/r.data.rates.CHF,PLN:1/r.data.rates.PLN,MXN:1/r.data.rates.MXN,BRL:1/r.data.rates.BRL,RON:1/r.data.rates.RON}; fxF=Date.now(); } catch {}
  }
  return price*(fx[currency]||1);
}
const parsePrice = t => parseFloat((t||'').replace(/[€$£\s]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.')) || 0;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const rUA = () => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'][Math.floor(Math.random()*2)];

// ── FILTRO ANTI-RUMORE per marketplace a categoria larga (OLX cat.99, Mercado
//    Libre) che pescano anche elettronica/giochi/accessori. Scarta i titoli che
//    NON sembrano un orologio da polso vintage. Conservativo: nel dubbio TIENE
//    (meglio un falso positivo che perdere una gemma con titolo scarno).
const NOISE_TOKENS = [
  'ps5','ps4','xbox','playstation','konsola','consola','console','simulator','simulfrom','simucube',
  'laptop','notebook','iphone','samsung galaxy','airpods','smartwatch','smart watch','apple watch',
  'drone','gopro','nintendo','switch','macbook','tablet','ipad','monitor','televisor','telewizor',
  'parede','parete','wall clock','sveglia','réveil','wecker','pendulum','pendolo','clock','reloj de pared',
  'correa','cinturino','strap','pulseira','bracelet only','solo cinturino','band only','caixa','box only',
];

// ── GATE POSITIVO (LISTA BIANCA) per marketplace a CATEGORIA LARGA ──
//    OLX.pl/.ro, Allegro, Sprzedajemy, Mercado Libre vendono di TUTTO
//    (cuffie, stereo, manometri, frigoriferi...). Una blacklist non basta:
//    non puoi prevedere ogni merceologia, e i termini sono in polacco/spagnolo.
//    Qui invertiamo la logica: su questi mercati un annuncio passa SOLO SE
//    mostra un segnale POSITIVO di orologio da polso — o una parola-orologio
//    (multilingua, incluso PL/RO) o una marca-orologio nota. Niente segnale
//    positivo = scartato. Questo blocca cuffie Klipsch, stereo JVC, manometri.
//
//    NB: i marketplace a categoria-orologi dedicata (eBay cat.watches, Subito,
//    Chrono24, Catawiki, Vinted cat.14000, Marktplaats 363...) NON passano da
//    qui: lì la categoria già garantisce che è un orologio, e un gate positivo
//    rischierebbe di perdere annunci dal titolo scarno ("Omega oro" senza la
//    parola "orologio"). Il gate positivo si applica SOLO ai mercati larghi.
const WATCH_POSITIVE_WORDS = /\b(orolog\w*|watch|wristwatch|horloge|montre\w*|armbanduhr|uhr|reloj\w*|zegar\w*|ceas\w*|chronograph\w*|chronographe|cronograf\w*|chrono\b|automatic\w*|automatico|automatique|automatyczny|carica\s*manuale|hand[\s-]*wind|naked\s*winding|datejust|seamaster|speedmaster|submariner|calibr[eo]|caliber|kaliber|jewels?|rubis|rubini|movement|movimento|mechanizm|quadrante|\bdial\b|tarcza|ghiera|diver|skin\s*diver|day[\s-]?date|oyster|polerouter|microrotor|micro[\s-]?rotor)\b/i;

// Marche-orologio note: presenza nel titolo = segnale positivo forte.
// Si appoggia a MELT_SCARCITY_BRANDS + watchlist + un set extra di marche
// diffuse sui mercati dell'Est che il bot già caccia.
const WATCH_BRAND_WORDS = [
  ...MELT_SCARCITY_BRANDS,
  'rolex','tudor','heuer','tag heuer','breitling','cartier','piaget','audemars','chopard',
  'cyma','enicar','doxa','mido','tissot','certina','rado','oris','hamilton','bulova','wittnauer',
  'glycine','favre','nivada','wakmann','lemania','jaeger-lecoultre','lecoultre','universal geneve',
  'lip','eza','yema','pierce','aquastar','squale','vulcain','helvetia','seiko','citizen','orient',
  'poljot','strela','raketa','sekonda','vostok','zenith','el primero','baume','mercier','ulysse',
];

// Restituisce true se il titolo mostra un segnale POSITIVO di orologio.
// IMPORTANTE: le marche vanno cercate come PAROLA INTERA, non come substring.
// Marche corte (lip, eza, rado, oris, mido...) altrimenti matchano dentro
// parole estranee: "k[lip]sch" (cuffie Klipsch), "wi[eza]" (stereo JVC),
// "colo[rado]", "do[oris]"... — è la causa dei falsi positivi su OLX.pl.
function hasWatchSignal(title) {
  if (!title) return false;
  const t = String(title).toLowerCase();
  if (WATCH_POSITIVE_WORDS.test(t)) return true;
  for (const b of WATCH_BRAND_WORDS) {
    // \b non funziona bene a cavallo di caratteri non-ASCII/accentati: uso un
    // confine "non-lettera" esplicito su entrambi i lati. Copre anche łśżź ecc.
    const re = new RegExp(`(^|[^\\p{L}])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
    if (re.test(t)) return true;
  }
  return false;
}

// Mercati a categoria larga su cui pretendere il segnale positivo.
const BROAD_CATEGORY_MARKETS = ['OLX.pl','OLX.ro','Allegro','Sprzedajemy','Okazii','MercadoLibre','Wallapop'];
function isBroadCategoryMarket(platform) {
  const p = String(platform || '');
  return BROAD_CATEGORY_MARKETS.some(m => p.includes(m));
}

// ── SALUTE FONTI ESTERE (v12.25): ultimo esito per scraper → /api/diagnostica.
//    Così si vede SUBITO se una fonte risponde, quanti risultati dà, o con che
//    errore muore (403 = bloccati, timeout = lenti, 0 = query/layout). Prima
//    "non trova niente" era invisibile senza i log di Render. ──
const SRC_HEALTH = {};
function srcOk(name, n) { SRC_HEALTH[name] = { ok: true, risultati: n, quando: new Date().toISOString() }; }
function srcErr(name, e) { SRC_HEALTH[name] = { ok: false, errore: String(e?.response?.status || e?.code || e?.message || e).slice(0, 120), quando: new Date().toISOString() }; }

// ── FUNNEL GIORNALIERO (v12.26): contatori di dove muoiono gli annunci.
//    "Grezzi 0, da studiare 0" era invisibile: non si sapeva se il problema
//    fosse a monte (niente candidati) o a valle (AI che boccia tutto).
//    Visibile in /api/diagnostica → _funnel. Reset automatico a mezzanotte. ──
const FUNNEL = { giorno: new Date().getDate(), senzaSegnaleForte: 0, gateTesiScartati: 0, analizzatiAI: 0, aiSenzaRisposta: 0, aiNonInteressante: 0, aiInteressante: 0 };
function funnelBump(k) {
  const d = new Date().getDate();
  if (d !== FUNNEL.giorno) { for (const key of Object.keys(FUNNEL)) if (key !== 'giorno') FUNNEL[key] = 0; FUNNEL.giorno = d; }
  FUNNEL[k] = (FUNNEL[k] || 0) + 1;
}

// Vecchia firma mantenuta per compatibilità: blacklist generica.
function looksLikeWatchListing(title) {
  if (!title) return true; // titolo vuoto: non posso giudicare, tengo
  const t = title.toLowerCase();
  for (const bad of NOISE_TOKENS) if (t.includes(bad)) return false;
  return true;
}

// ── TELEGRAM / EMAIL ──
async function tg(text, chatId) {
  if (!process.env.TELEGRAM_TOKEN) return;
  try { await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,{chat_id:chatId||process.env.TELEGRAM_CHAT_ID,text,parse_mode:'HTML'},{timeout:10000}); }
  catch(e) { console.error('[TG]',e.message); }
}
const mailer = nodemailer.createTransport({host:'smtp.gmail.com',port:587,secure:false,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});

// ══════════════ EBAY API UFFICIALE (se disponibile) ══════════════
let ebayToken = null, ebayExp = 0, ebayLastError = null;
async function getEbayToken() {
  if (ebayToken && Date.now()<ebayExp) return ebayToken;
  if (!process.env.EBAY_CLIENT_ID) { ebayLastError = 'EBAY_CLIENT_ID mancante'; return null; }
  try {
    const c = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
    const r = await axios.post('https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      {headers:{Authorization:`Basic ${c}`,'Content-Type':'application/x-www-form-urlencoded'}}
    );
    ebayToken = r.data.access_token;
    ebayExp = Date.now()+(r.data.expires_in-60)*1000;
    ebayLastError = null;
    return ebayToken;
  } catch (e) {
    ebayLastError = e.response?.data || e.message;
    console.error('[eBay OAuth]', e.response?.status||'', JSON.stringify(ebayLastError).slice(0,300));
    return null;
  }
}
// ── ebayHealth: stato REALE della ricerca eBay, non solo "la variabile esiste".
//    Prova davvero a ottenere il token. Così il messaggio di avvio e /api/status
//    dicono la VERITÀ: se le chiavi sono scadute/revocate, lo vedi col motivo
//    esatto (es. "invalid_client"), non un finto "ATTIVO" di facciata. ──
async function ebayHealth() {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    return { ok: false, reason: 'chiavi mancanti', detail: 'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET non impostate su Render' };
  }
  const token = await getEbayToken();
  if (token) return { ok: true, reason: 'token valido', detail: null };
  // chiavi presenti ma eBay le rifiuta → riporto l'errore VERO di eBay
  const det = typeof ebayLastError === 'string' ? ebayLastError : JSON.stringify(ebayLastError || {}).slice(0, 200);
  return { ok: false, reason: 'eBay rifiuta le chiavi', detail: det || 'errore sconosciuto (vedi log [eBay OAuth])' };
}
// ── Variante per l'AVVIO: le env di Render a volte non sono ancora iniettate
//    nel primissimo istante in cui parte il processo, e ebayHealth() darebbe un
//    falso "chiavi mancanti". Qui riprovo qualche volta SOLO in quel caso
//    (tempismo). Se invece eBay RIFIUTA le chiavi (scadute), NON riprovo: è un
//    problema vero e va detto subito. Così il messaggio di avvio è onesto senza
//    falsi allarmi. ──
async function ebayHealthWithRetry(tentativi = 4, pausaMs = 4000) {
  let last = null;
  for (let i = 0; i < tentativi; i++) {
    last = await ebayHealth();
    if (last.ok) return last;                          // funziona → esco subito
    if (last.reason !== 'chiavi mancanti') return last; // rifiuto vero → niente retry
    if (i < tentativi - 1) {
      console.log(`[eBay] chiavi non ancora visibili (tentativo ${i+1}/${tentativi}), riprovo tra ${pausaMs/1000}s...`);
      await new Promise(r => setTimeout(r, pausaMs));
    }
  }
  return last;
}
async function searchEbayAPI(query) {
  const token = await getEbayToken();
  if (!token) return [];
  const results = [];
  // La valuta del marketplace: il filtro price di eBay viene IGNORATO senza
  // priceCurrency, perciò eBay restituiva i 30 articoli più economici (parti
  // da 6€) che il filtro >=200 poi azzerava → 0 risultati. Ora il pavimento
  // 200 è applicato lato server e tornano orologi veri.
  const CUR = { EBAY_IT:'EUR', EBAY_FR:'EUR', EBAY_DE:'EUR', EBAY_ES:'EUR', EBAY_GB:'GBP' };
  for (const market of ['EBAY_IT','EBAY_FR','EBAY_DE','EBAY_GB','EBAY_ES']) {
    const cur = CUR[market] || 'EUR';
    const floor = cur === 'GBP' ? Math.round(SCAN_FLOOR*0.85) : SCAN_FLOOR;
    try {
      const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search',{
        params:{q:query,category_ids:'31387',sort:'newlyListed',limit:50,filter:`price:[${floor}..],priceCurrency:${cur}`},
        headers:{Authorization:`Bearer ${token}`,'X-EBAY-C-MARKETPLACE-ID':market},
        timeout:12000
      });
      results.push(...(r.data.itemSummaries||[]).map(i=>({
        platform:`eBay ${market.replace('EBAY_','')}`,
        title:i.title, price:parseFloat(i.price?.value||0),
        currency:i.price?.currency||cur, url:i.itemWebUrl,
        location:i.itemLocation?.country||'',
      })).filter(i=>i.price>=floor));
      await sleep(200);
    } catch (e) {
      ebayLastError = e.response?.data || e.message;
      console.error(`[eBay API ${market}]`, e.response?.status||'', JSON.stringify(ebayLastError).slice(0,250));
    }
  }
  return results;
}

// ══════════════ EBAY RSS (pubblico) ══════════════
async function searchEbayRSS(query) {
  try {
    await sleep(500+Math.random()*500);
    const q = encodeURIComponent(query);
    const url = `https://www.ebay.it/sch/i.html?_nkw=${q}&_sop=10&_sacat=31387&LH_ItemCondition=3&rt=nc&_mPrRngCbx=1&_udlo=${SCAN_FLOOR}&_rss=1`;
    const r = await axios.get(url, { headers:{'User-Agent':rUA(),'Accept':'application/rss+xml,application/xml,text/xml'}, timeout:12000 });
    const $ = cheerio.load(r.data, {xmlMode:true});
    const results = [];
    $('item').each((i,el) => {
      if (i>=15) return;
      const $el = $(el);
      const title = $el.find('title').first().text().trim();
      const link = $el.find('link').first().text().trim();
      const desc = $el.find('description').first().text();
      const priceMatch = desc.match(/[\€$£]?\s*(\d[\d.,]*)/);
      const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
      if (title && price>=SCAN_FLOOR) results.push({ platform:'eBay IT', title, price, currency:'EUR', url:link });
    });
    return results;
  } catch(e) { console.error('[eBay RSS]',e.message); return []; }
}
async function searchEbayAllCountries(query) {
  const domains = [
    {dom:'it', curr:'EUR', lang:'it-IT'}, {dom:'fr', curr:'EUR', lang:'fr-FR'},
    {dom:'de', curr:'EUR', lang:'de-DE'}, {dom:'co.uk', curr:'GBP', lang:'en-GB'},
    {dom:'es', curr:'EUR', lang:'es-ES'}, {dom:'ch', curr:'CHF', lang:'de-CH'},
    {dom:'com', curr:'USD', lang:'en-US'},
  ];
  const results = [];
  const apiResults = await searchEbayAPI(query);
  if (apiResults.length > 0) { console.log(`[eBay API] ${query}: ${apiResults.length} risultati`); return apiResults; }
  for (const {dom, curr, lang, extra, label} of domains) {
    try {
      await sleep(500+Math.random()*400);
      const q = encodeURIComponent(query);
      // HTML moderno (NON più RSS: eBay ha dismesso i feed _rss=1)
      const url = `https://www.ebay.${dom}/sch/i.html?_nkw=${q}&_sop=10&_sacat=31387&_udlo=${SCAN_FLOOR}${extra||''}`;
      const r = await axios.get(url, { headers:{
        'User-Agent':rUA(), 'Accept-Language':lang,
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }, timeout:14000 });
      const items = parseAndFree(r.data, ($) => {
        const out = [];
        // eBay moderno: li.s-item con .s-item__title e .s-item__price
        $('li.s-item, .s-item').each((i, el) => {
          if (out.length >= 12) return;
          const $el = $(el);
          const title = $el.find('.s-item__title').first().text().replace(/^Nuova inserzione/i,'').replace(/&amp;/g,'&').trim();
          if (!title || /Shop on eBay|Risultati per/i.test(title)) return;
          const priceTxt = $el.find('.s-item__price').first().text().trim();
          const price = parsePrice(priceTxt);
          const link = $el.find('a.s-item__link, a').first().attr('href') || '';
          if (title && price>=SCAN_FLOOR && link.includes('/itm/')) out.push({
            platform: label || `eBay ${dom.toUpperCase().replace('.CO.UK','UK')}`,
            title, price, currency:curr, url: link.split('?')[0]
          });
        });
        return out;
      });
      if (items.length) { results.push(...items); console.log(`[eBay ${dom}] ${query}: ${items.length}`); }
      else console.warn(`[eBay ${dom}] ${query}: 0 (HTML cambiato o bloccato? len=${(r.data||'').length})`);
    } catch (e) { console.error(`[eBay ${dom}] ${query}: ${e.response?.status||e.code||e.message}`); }
  }
  return results;
}

// ══════════════ CHRONO24 / CATAWIKI / SUBITO / ecc. ══════════════
async function searchChrono24RSS(query) {
  try {
    await sleep(800+Math.random()*600);
    const q = encodeURIComponent(query);
    const url = `https://www.chrono24.it/search/index.htm?query=${q}&dosearch=true&searchType=fulltext&resultview=list&priceFrom=200`;
    const r = await axios.get(url, { headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.chrono24.it/'}, timeout:15000 });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-article-id],.article-item-container,.wt-search-results article').each((i,el) => {
      if (i>=15) return;
      const $el = $(el);
      const title = $el.find('.article-title,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('.price,.js-price,[class*="price"]').first().text().trim());
      const link = $el.find('a').first().attr('href');
      if (title && price>=200) results.push({ platform:'Chrono24', title, price, currency:'EUR',
        url: link?(link.startsWith('http')?link:`https://www.chrono24.it${link}`):`https://www.chrono24.it` });
    });
    return results;
  } catch(e) { console.error('[Chrono24]',e.message); return []; }
}
async function searchCatawiki(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.catawiki.com/en/c/80-watches?q=${encodeURIComponent(query)}`, { headers:{'User-Agent':rUA()}, timeout:12000 });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="lot-card"],article[data-lot-id],[class*="LotCard"]').each((i,el) => {
      if (i>=12) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],h2,h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"],[class*="bid"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=200) results.push({ platform:'Catawiki 🔨', title, price, currency:'EUR', isAuction:true,
        url:link?(link.startsWith('http')?link:`https://www.catawiki.com${link}`):'https://www.catawiki.com/en/c/80-watches' });
    });
    return results;
  } catch(e) { console.error('[Catawiki]',e.message); return []; }
}
// ── SUBITO: estrazione difensiva di una lista di "ads" (vale sia per l'API
//    interna JSON sia per il __NEXT_DATA__ della pagina). ──
function parseSubitoAds(ads, max = 15) {
  const out = [];
  for (const ad of (Array.isArray(ads) ? ads : []).slice(0, max)) {
    const title = ad.subject || ad.title || '';
    let price = 0;
    // prezzo: cerco nella lista features quella monetaria / "prezzo"
    const feats = Array.isArray(ad.features) ? ad.features : [];
    for (const f of feats) {
      const isPrice = /price/i.test(f?.uri || '') || /prezzo/i.test(f?.label || '') || f?.type === 'monetary';
      if (isPrice && Array.isArray(f.values) && f.values[0]) {
        price = parsePrice(String(f.values[0].key || f.values[0].value || ''));
        if (price) break;
      }
    }
    if (!price) { const m = JSON.stringify(ad.features || ad.params || {}).match(/"?prezzo"?\s*[:,]\s*"?(\d[\d.,]*)/i); if (m) price = parsePrice(m[1]); }
    if (!price && ad.price) price = parsePrice(String(ad.price));
    const link = ad.urls?.default || ad.url || '';
    if (title && price >= SCAN_FLOOR && link) out.push({ platform:'Subito.it 🇮🇹', title, price, currency:'EUR', isLocal:true, location: ad.geo?.town?.value || ad.geo?.city?.value || '', url: link });
  }
  return out;
}

// ── SUBITO via API INTERNA JSON (Hades) — gratis, NIENTE chiave ──
// È l'endpoint che il sito chiama da solo via XHR: risponde JSON puro, senza
// la pagina HTML (quindi niente challenge Cloudflare sull'HTML). NON è
// ufficiale: può cambiare/sparire senza preavviso → per questo searchSubito
// tiene SEMPRE il fallback HTML qui sotto. Da qui non posso provarlo: lo
// verifichi dal vivo con /api/diagnostica?q=omega e dai log [Subito API].
async function searchSubitoJSON(query) {
  await sleep(500 + Math.random() * 400);
  const r = await axios.get('https://hades.subito.it/v1/search/items', {
    params: { q: query, t: 's', qso: 'true', sort: 'datedesc', lim: 30, start: 0, ps: 200 },
    headers: {
      'User-Agent': rUA(),
      'Accept': 'application/json',
      'Accept-Language': 'it-IT,it;q=0.9',
      'Origin': 'https://www.subito.it',
      'Referer': 'https://www.subito.it/',
    },
    timeout: 12000,
  });
  const data = r.data || {};
  const ads = Array.isArray(data.ads) ? data.ads : (Array.isArray(data.items) ? data.items : []);
  return parseSubitoAds(ads, 15);
}

async function searchSubito(query) {
  // ── 1) API INTERNA JSON (Hades): veloce e pulita, gratis ──
  try {
    const j = await searchSubitoJSON(query);
    if (j.length) { console.log(`[Subito API] ${query}: ${j.length}`); return j; }
    console.warn(`[Subito API] ${query}: 0 → ripiego su HTML`);
  } catch (e) { console.warn(`[Subito API] ${query}: ${e.response?.status||e.code||e.message} → ripiego su HTML`); }

  // ── 2) FALLBACK: pagina HTML + __NEXT_DATA__ (Next.js), come prima ──
  try {
    await sleep(800+Math.random()*500);
    const r = await axios.get(`https://www.subito.it/annunci-italia/vendita/orologi-e-gioielli/?q=${encodeURIComponent(query)}`, { headers:{
      'User-Agent':rUA(),'Accept-Language':'it-IT',
      'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer:'https://www.subito.it/'}, timeout:14000 });
    let results = [];
    // Subito è Next.js: i dati stanno nel JSON __NEXT_DATA__, molto più
    // stabile delle classi CSS che cambiano di continuo.
    const m = String(r.data).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      try {
        const j = JSON.parse(m[1]);
        const stack = [j]; let ads = [];
        while (stack.length && ads.length < 40) {
          const node = stack.pop();
          if (node && typeof node === 'object') {
            if (Array.isArray(node.ads)) ads = ads.concat(node.ads);
            for (const k in node) if (node[k] && typeof node[k]==='object') stack.push(node[k]);
          }
        }
        results = parseSubitoAds(ads, 15);
      } catch (e) { console.error('[Subito JSON]', e.message); }
    }
    // fallback HTML grezzo se anche il __NEXT_DATA__ è vuoto
    if (!results.length) {
      parseAndFree(r.data, ($) => {
        $('div[class*="item-card"], article').each((i,el) => {
          if (results.length>=12) return;
          const $el = $(el);
          const title = $el.find('h2,[class*="title"]').first().text().trim();
          const price = parsePrice($el.find('[class*="price"]').first().text());
          const link = $el.find('a').first().attr('href');
          if (title&&price>=SCAN_FLOOR&&link) results.push({ platform:'Subito.it 🇮🇹', title, price, currency:'EUR', isLocal:true, location:'', url:link.startsWith('http')?link:`https://www.subito.it${link}` });
        });
        return [];
      });
    }
    if (results.length) console.log(`[Subito HTML] ${query}: ${results.length}`);
    else console.warn(`[Subito] ${query}: 0 (len=${(r.data||'').length}, hasNEXT=${!!m})`);
    return results;
  } catch(e) { console.error(`[Subito] ${query}: ${e.response?.status||e.code||e.message}`); return []; }
}
async function searchLeboncoin(query) {
  // FIX v12.12: lo scraping HTML era MORTO (zero annunci da sempre).
  // Leboncoin è dietro DataDome e carica gli annunci in JavaScript,
  // quindi axios+cheerio ricevevano una pagina-guscio senza nessun aditem.
  // Ora colpiamo l'API JSON interna (POST /finder/search), quella che usa
  // il sito stesso: niente rendering JS, niente selettori HTML che cambiano.
  try {
    await sleep(1200+Math.random()*500);
    const r = await axios.post('https://api.leboncoin.fr/finder/search', {
      filters: {
        category: { id: '62' },                 // 62 = Montres & Bijoux
        enums: {},
        keywords: { text: query },
        ranges: { price: { min: SCAN_FLOOR } }
      },
      limit: 20, offset: 0, sort_by: 'time', sort_order: 'desc'
    }, {
      headers: {
        'User-Agent': rUA(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Origin': 'https://www.leboncoin.fr',
        'Referer': 'https://www.leboncoin.fr/'
      },
      timeout: 12000
    });
    const ads = (r.data && r.data.ads) || [];
    const results = [];
    for (const ad of ads) {
      const title = (ad.subject || '').trim();
      let price = Array.isArray(ad.price) ? ad.price[0] : (ad.price_cents ? Math.round(ad.price_cents/100) : ad.price);
      price = parseInt(price) || 0;
      const link = ad.url || (ad.list_id ? `https://www.leboncoin.fr/vi/${ad.list_id}.htm` : 'https://www.leboncoin.fr');
      if (title && price >= SCAN_FLOOR) results.push({
        platform:'Leboncoin 🇫🇷', title, price, currency:'EUR',
        url: link.startsWith('http') ? link : `https://www.leboncoin.fr${link}`
      });
    }
    console.error(`[Leboncoin] "${query}": ${results.length} (ads ricevuti: ${ads.length})`);
    return results;
  } catch(e) {
    console.error('[Leboncoin]', e.response?.status||'', e.message);
    return [];
  }
}
async function searchVestiaire(query) {
  try {
    await sleep(900+Math.random()*400);
    const r = await axios.get(`https://www.vestiairecollective.com/search/?q=${encodeURIComponent(query)}&universe=men&category=watches`, { headers:{'User-Agent':rUA()}, timeout:12000 });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="product-card"],[class*="ProductCard"]').each((i,el) => {
      if (i>=10) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],[class*="brand"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=200) results.push({ platform:'Vestiaire', title, price, currency:'EUR',
        url:link?(link.startsWith('http')?link:`https://www.vestiairecollective.com${link}`):'https://www.vestiairecollective.com' });
    });
    return results;
  } catch(e) { console.error('[Vestiaire]',e.message); return []; }
}
async function searchWatchfinder(query) {
  try {
    await sleep(900+Math.random()*400);
    const r = await axios.get(`https://www.watchfinder.co.uk/search?q=${encodeURIComponent(query)}`, { headers:{'User-Agent':rUA()}, timeout:12000 });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="watch-card"],[class*="WatchCard"],[class*="product-card"]').each((i,el) => {
      if (i>=8) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=300) results.push({ platform:'Watchfinder 🇬🇧', title, price, currency:'GBP',
        url:link?(link.startsWith('http')?link:`https://www.watchfinder.co.uk${link}`):'https://www.watchfinder.co.uk' });
    });
    return results;
  } catch(e) { console.error('[Watchfinder]',e.message); return []; }
}

// ══════════════ SERPAPI (Google Shopping, opzionale) ══════════════
// ATTENZIONE: impostare SERPAPI_LIMIT in base al tuo piano reale.
// Piano free = 100/mese. Piano pagamento = verificare dashboard SerpAPI.
// Leonardo ha piano da 1000/mese → limite 950 (margine sicurezza 5%).
const SERPAPI_MONTHLY_LIMIT = parseInt(process.env.SERPAPI_LIMIT||'950');
let serpUsage = { month: new Date().getMonth(), count: 0 };
function serpQuotaOk() {
  const m = new Date().getMonth();
  if (m !== serpUsage.month) { serpUsage = { month: m, count: 0 }; }
  const ok = serpUsage.count < SERPAPI_MONTHLY_LIMIT;
  if (!ok) console.warn(`[SerpAPI] Quota esaurita (${serpUsage.count}/${SERPAPI_MONTHLY_LIMIT}). Upgrade piano o aspetta il mese prossimo.`);
  return ok;
}
function serpTick() {
  serpUsage.count++;
  if (serpUsage.count % 10 === 0) console.log(`[SerpAPI] Ricerche usate questo mese: ${serpUsage.count}/${SERPAPI_MONTHLY_LIMIT}`);
}
async function searchSerpAPI(query, country='it') {
  if (!process.env.SERPAPI_KEY) return [];
  if (!serpQuotaOk()) { console.warn('[SerpAPI] Quota quasi esaurita'); return []; }
  try {
    serpTick();
    const r = await axios.get('https://serpapi.com/search',{ params:{engine:'google_shopping',q:query,gl:country,hl:country,api_key:process.env.SERPAPI_KEY,num:20}, timeout:15000 });
    const results = (r.data.shopping_results||[]).map(i=>({
      platform:`Google Shopping ${country.toUpperCase()}`,
      title:i.title, price:parseFloat(String(i.price||'0').replace(/[^\d,.]/g,'').replace(',','.'))||0,
      currency:'EUR', url:i.link||i.product_link||'', image:i.thumbnail||i.serpapi_thumbnail||'', source:i.source||''
    })).filter(i=>i.price>=200&&i.url);
    if (results.length) console.log(`[SerpAPI ${country}] ${query}: ${results.length}`);
    return results;
  } catch(e) { console.error(`[SerpAPI ${country}]`,e.message); return []; }
}

// SerpAPI engine eBay — non viene bloccato (403) perché passa da SerpAPI,
// non dallo scraper diretto. Copre eBay.it, .de, .fr, .co.uk, .com
async function searchEbaySerpAPI(query) {
  if (!process.env.SERPAPI_KEY) return [];
  if (!serpQuotaOk()) return [];
  const results = [];
  const markets = [
    { domain:'ebay.it', currency:'EUR' },
    { domain:'ebay.de', currency:'EUR' },
    { domain:'ebay.fr', currency:'EUR' },
  ];
  for (const { domain, currency } of markets) {
    try {
      serpTick();
      const r = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'ebay', _nkw: query, ebay_domain: domain,
          _sop: 10, _udlo: SCAN_FLOOR,
          api_key: process.env.SERPAPI_KEY, num: 20
        }, timeout: 15000
      });
      const items = (r.data.organic_results || []).map(i => ({
        platform: `eBay ${domain.split('.')[1].toUpperCase()} (SerpAPI)`,
        title: i.title || '',
        price: parseFloat(String(i.price?.extracted || i.price?.raw || '0').replace(/[^\d,.]/g,'').replace(',','.'))||0,
        currency,
        url: i.link || '',
        image: i.thumbnail || ''
      })).filter(i => i.price >= SCAN_FLOOR && i.url && i.title);
      if (items.length) {
        results.push(...items);
        console.log(`[eBay SerpAPI ${domain}] ${query}: ${items.length}`);
      }
      await sleep(800);
    } catch(e) { console.error(`[eBay SerpAPI ${domain}]`, e.message); }
  }
  return results;
}

async function searchSerpAPILocal(query) {
  if (!process.env.SERPAPI_KEY) return [];
  if (!serpQuotaOk()) { console.warn('[SerpAPI local] Quota quasi esaurita'); return []; }
  try {
    serpTick();
    const r = await axios.get('https://serpapi.com/search',{ params:{engine:'google_shopping', q:query, gl:'it', hl:'it', location:'Belluno,Veneto,Italy', api_key:process.env.SERPAPI_KEY, num:20}, timeout:15000 });
    const results = (r.data.shopping_results||[]).map(i=>({
      platform:'Google Shopping 🇮🇹', title:i.title,
      price:parseFloat(String(i.price||'0').replace(/[^\d,.]/g,'').replace(',','.'))||0,
      currency:'EUR', url:i.link||i.product_link||'', image:i.thumbnail||i.serpapi_thumbnail||'', source:i.source||''
    })).filter(i=>i.price>=200&&i.url);
    if (results.length) console.log(`[SerpAPI local] ${query}: ${results.length}`);
    return results;
  } catch(e) { console.error('[SerpAPI local]',e.message); return []; }
}

// ══════════════ VINTED / WALLAPOP / RICARDO / MARKTPLAATS / FB ══════════════
async function searchVinted(query) {
  try {
    await sleep(900+Math.random()*500);
    const r = await axios.get(`https://www.vinted.it/catalog?search_text=${encodeURIComponent(query)}&catalog[]=2165&price_from=${SCAN_FLOOR}`, {
      headers:{'User-Agent':rUA(),'Accept-Language':'it-IT',Referer:'https://www.vinted.it/'},
      timeout:12000,
      maxContentLength: 5*1024*1024, // max 5MB invece di illimitato
      maxBodyLength: 5*1024*1024
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[data-testid="grid-item"],[class*="ItemBox"],[class*="item-box"]').each((i,el) => {
      if (i>=12) return;
      const $el = $(el);
      const title = $el.find('[class*="title"],[class*="name"],h3').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=SCAN_FLOOR) results.push({ platform:'Vinted 🇮🇹', title, price, currency:'EUR',
        url:link?(link.startsWith('http')?link:`https://www.vinted.it${link}`):'https://www.vinted.it' });
    });
    return results;
  } catch(e) { console.error('[Vinted]',e.message); return []; }
}
async function searchWallapop(query) {
  query = adaptQueryForMarket(query, 'es');
  try {
    await sleep(900+Math.random()*500);
    const r = await axios.get(`https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(query)}&category_ids=14000&min_sale_price=200&order_by=price_low_to_high`, { headers:{'User-Agent':rUA(),'Accept':'application/json'}, timeout:12000 });
    const items = r.data?.search_objects || r.data?.items || [];
    return items.slice(0,12).map(i=>({
      platform:'Wallapop 🇪🇸', title:i.title||i.content?.title||'',
      price:parseFloat(i.price||i.sale_price||i.content?.price||0), currency:'EUR',
      url:i.web_slug?`https://it.wallapop.com/item/${i.web_slug}`:`https://it.wallapop.com`,
      location:i.location?.city||i.content?.location?.city||'',
    })).filter(i=>i.price>=SCAN_FLOOR&&i.title);
  } catch(e) { console.error('[Wallapop]',e.message); return []; }
}
async function searchRicardo(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.ricardo.ch/it/s/${encodeURIComponent(query)}/?sort=price&order=asc&categoryId=11010`, { headers:{'User-Agent':rUA(),'Accept-Language':'it-CH'}, timeout:12000 });
    const $ = cheerio.load(r.data);
    const results = [];
    $('[class*="ArticleCard"],[class*="article-card"],[data-testid*="article"]').each((i,el) => {
      if (i>=10) return;
      const $el = $(el);
      const title = $el.find('h2,h3,[class*="title"]').first().text().trim();
      const price = parsePrice($el.find('[class*="price"]').first().text());
      const link = $el.find('a').first().attr('href');
      if (title&&price>=300) results.push({ platform:'Ricardo.ch 🇨🇭', title, price, currency:'CHF',
        url:link?(link.startsWith('http')?link:`https://www.ricardo.ch${link}`):'https://www.ricardo.ch' });
    });
    return results;
  } catch(e) { console.error('[Ricardo]',e.message); return []; }
}
async function searchMarktplaats(query) {
  query = adaptQueryForMarket(query, 'nl');
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get(`https://www.marktplaats.nl/lrp/api/search?query=${encodeURIComponent(query)}&categoryId=363&priceFrom=200&sortBy=PRICE_ASC&limit=12`, { headers:{'User-Agent':rUA(),'Accept':'application/json'}, timeout:12000 });
    const listings = r.data?.listings || [];
    return listings.slice(0,12).map(i=>({
      platform:'Marktplaats 🇳🇱', title:i.title||'',
      price:parseFloat(i.priceInfo?.priceCents||0)/100, currency:'EUR',
      url:i.vipUrl?`https://www.marktplaats.nl${i.vipUrl}`:'https://www.marktplaats.nl', location:i.location?.cityName||'',
    })).filter(i=>i.price>=SCAN_FLOOR&&i.title);
  } catch(e) { console.error('[Marktplaats]',e.message); return []; }
}
// ── ADATTATORE LINGUA QUERY (v12.25, 06/07/26): le query nascono in italiano,
//    ma OLX.pl cercato con "orologio oro" restituisce ZERO — i polacchi
//    scrivono "zegarek złoto", i rumeni "ceas aur". Prima di questo fix i
//    mercati esteri trovavano SOLO annunci con nome-brand nel titolo (parole
//    universali) — cioè i pezzi etichettati bene e prezzati giusti, dove
//    l'affare non c'è. Qui i termini generici vengono tradotti nella lingua
//    del mercato PRIMA della ricerca; i nomi di marca restano intatti. ──
const QUERY_LANG_MAP = {
  pl: [[/solo tempo/g,''],[/carica manuale/g,'naciąg ręczny'],[/orologio|orologi/g,'zegarek'],[/\boro\b/g,'złoto'],[/cronografo/g,'chronograf'],[/\buomo\b/g,'męski'],[/donna|signora/g,'damski'],[/eredità|eredita/g,'spadek'],[/d'epoca|epoca/g,'vintage'],[/massiccio/g,'']],
  ro: [[/solo tempo/g,''],[/carica manuale/g,'mecanic'],[/orologio|orologi/g,'ceas'],[/\boro\b/g,'aur'],[/cronografo/g,'cronograf'],[/\buomo\b/g,'barbatesc'],[/donna|signora/g,'dama'],[/eredità|eredita/g,'mostenire'],[/d'epoca|epoca/g,'vintage'],[/massiccio/g,'masiv']],
  nl: [[/solo tempo/g,''],[/carica manuale/g,'handopwinder'],[/orologio|orologi/g,'horloge'],[/\boro\b/g,'goud'],[/cronografo/g,'chronograaf'],[/\buomo\b/g,'heren'],[/donna|signora/g,'dames'],[/eredità|eredita/g,''],[/d'epoca|epoca/g,'vintage'],[/massiccio/g,'massief']],
  es: [[/solo tempo/g,''],[/carica manuale/g,'cuerda manual'],[/orologio|orologi/g,'reloj'],[/cronografo/g,'cronografo'],[/\buomo\b/g,'hombre'],[/donna|signora/g,'mujer'],[/eredità|eredita/g,'herencia'],[/d'epoca|epoca/g,'antiguo'],[/massiccio/g,'macizo']],
};
function adaptQueryForMarket(query, lang) {
  const rules = QUERY_LANG_MAP[lang];
  if (!rules) return query;
  let q = String(query || '').toLowerCase();
  for (const [re, sub] of rules) q = q.replace(re, sub);
  q = q.replace(/\s+/g, ' ').trim();
  return q || query;
}

// ── OLX.pl (Polonia) — API JSON pubblica, più stabile dello scraping HTML.
//    Prezzi in PLN (convertiti in EUR via toEur). EU = niente dogana.
//    Mercato dell'Est: oro nobile spesso più freddo che in IT/DE.
//    category_id 99 = Zegarki (orologi). Filtro prezzo min in PLN (~200€≈860 PLN).
async function searchOlxPl(query) {
  query = adaptQueryForMarket(query, 'pl');
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get('https://www.olx.pl/api/v1/offers/', {
      params: { query, category_id: 99, 'filter_float_price:from': 180, sort_by: 'filter_float_price:asc', limit: 20 },
      headers: { 'User-Agent': rUA(), 'Accept': 'application/json', 'Accept-Language': 'pl-PL' },
      timeout: 13000
    });
    const data = r.data?.data || [];
    const results = [];
    for (const o of data.slice(0, 14)) {
      const title = o.title || '';
      // il prezzo sta in params[], chiave 'price'
      let pln = 0;
      const pp = (o.params || []).find(p => p.key === 'price');
      if (pp) pln = parseFloat(pp.value?.value || pp.value?.value_from || 0) || 0;
      if (title && pln > 0 && looksLikeWatchListing(title)) results.push({
        platform: 'OLX.pl 🇵🇱', title, price: pln, currency: 'PLN',
        url: o.url || `https://www.olx.pl`, location: o.location?.city?.name || ''
      });
    }
    if (results.length) console.log(`[OLX.pl] ${query}: ${results.length}`);
    srcOk('OLX.pl', results.length);
    return results;
  } catch(e) { srcErr('OLX.pl', e); console.error('[OLX.pl]', e.response?.status||e.code||e.message); return []; }
}
// ── Mercado Libre MESSICO (MLM) — API JSON pubblica ufficiale.
//    Solo Messico: il sito ML più vicino agli USA, più probabile trovare orologi
//    importati dal Nord America. Prezzi in MXN (convertiti via toEur).
//    ATTENZIONE OPERATIVA: import dal Messico verso IT = dazi + IVA + dogana +
//    spedizione cara/lenta. Il bot segnala 🇲🇽 così valuti SEMPRE il costo reale
//    sbarcato prima di trattare. Filtro prezzo minimo ~4000 MXN (~200€).
async function searchMercadoLibreMX(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get('https://api.mercadolibre.com/sites/MLM/search', {
      params: { q: query, category: 'MLM1430', limit: 20, sort: 'price_asc' }, // MLM1430 ~ relojes/joyería
      headers: { 'User-Agent': rUA(), 'Accept': 'application/json' },
      timeout: 13000
    });
    const data = r.data?.results || [];
    const results = [];
    for (const o of data.slice(0, 14)) {
      const title = o.title || '';
      const mxn = Number(o.price) || 0;
      // ML restituisce prezzi anche in USD per alcune categorie: rispetta currency_id
      const cur = o.currency_id === 'USD' ? 'USD' : 'MXN';
      if (title && mxn > 0 && looksLikeWatchListing(title)) results.push({
        platform: 'MercadoLibre 🇲🇽', title, price: mxn, currency: cur,
        url: o.permalink || 'https://www.mercadolibre.com.mx',
        location: o.address?.state_name || o.seller_address?.state?.name || ''
      });
    }
    if (results.length) console.log(`[MercadoLibre MX] ${query}: ${results.length}`);
    return results;
  } catch(e) { console.error('[MercadoLibre MX]', e.response?.status||e.code||e.message); return []; }
}
// ── Mercado Libre BRASILE (MLB) — stessa API ufficiale, sito brasiliano.
//    Prezzi in BRL (real). Stesse avvertenze import del Messico: dazi + IVA +
//    spedizione lunga dal Sud America. Il bot segnala 🇧🇷.
async function searchMercadoLibreBR(query) {
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get('https://api.mercadolibre.com/sites/MLB/search', {
      params: { q: query, category: 'MLB3937', limit: 20, sort: 'price_asc' }, // MLB3937 ~ relógios
      headers: { 'User-Agent': rUA(), 'Accept': 'application/json' },
      timeout: 13000
    });
    const data = r.data?.results || [];
    const results = [];
    for (const o of data.slice(0, 14)) {
      const title = o.title || '';
      const brl = Number(o.price) || 0;
      const cur = o.currency_id === 'USD' ? 'USD' : 'BRL';
      if (title && brl > 0 && looksLikeWatchListing(title)) results.push({
        platform: 'MercadoLibre 🇧🇷', title, price: brl, currency: cur,
        url: o.permalink || 'https://www.mercadolivre.com.br',
        location: o.address?.state_name || o.seller_address?.state?.name || ''
      });
    }
    if (results.length) console.log(`[MercadoLibre BR] ${query}: ${results.length}`);
    return results;
  } catch(e) { console.error('[MercadoLibre BR]', e.response?.status||e.code||e.message); return []; }
}
// ── OLX.ro (Romania) — stessa API JSON di OLX.pl. Prezzi in RON (leu rumeno).
//    Mercato dell'Est: oro nobile spesso più freddo. Il bot segnala 🇷🇴.
async function searchOlxRo(query) {
  query = adaptQueryForMarket(query, 'ro');
  try {
    await sleep(1000+Math.random()*500);
    const r = await axios.get('https://www.olx.ro/api/v1/offers/', {
      params: { query, category_id: 99, 'filter_float_price:from': 200, sort_by: 'filter_float_price:asc', limit: 20 },
      headers: { 'User-Agent': rUA(), 'Accept': 'application/json', 'Accept-Language': 'ro-RO' },
      timeout: 13000
    });
    const data = r.data?.data || [];
    const results = [];
    for (const o of data.slice(0, 14)) {
      const title = o.title || '';
      let ron = 0;
      const pp = (o.params || []).find(p => p.key === 'price');
      if (pp) ron = parseFloat(pp.value?.value || pp.value?.value_from || 0) || 0;
      if (title && ron > 0 && looksLikeWatchListing(title)) results.push({
        platform: 'OLX.ro 🇷🇴', title, price: ron, currency: 'RON',
        url: o.url || 'https://www.olx.ro', location: o.location?.city?.name || ''
      });
    }
    if (results.length) console.log(`[OLX.ro] ${query}: ${results.length}`);
    srcOk('OLX.ro', results.length);
    return results;
  } catch(e) { srcErr('OLX.ro', e); console.error('[OLX.ro]', e.response?.status||e.code||e.message); return []; }
}
// ── Allegro.pl (Polonia) — il più grande marketplace polacco. Ha API ufficiale
//    REST (api.allegro.pl) ma richiede OAuth client_credentials (come eBay).
//    Usa env ALLEGRO_TOKEN se presente; senza token NON spara (niente crash).
//    Prezzi in PLN. Il bot segnala 🇵🇱 Allegro.
let allegroToken = process.env.ALLEGRO_TOKEN || null, allegroExp = 0;
async function getAllegroToken() {
  if (allegroToken && Date.now() < allegroExp) return allegroToken;
  const id = process.env.ALLEGRO_CLIENT_ID, secret = process.env.ALLEGRO_CLIENT_SECRET;
  if (!id || !secret) return process.env.ALLEGRO_TOKEN || null;
  try {
    const c = Buffer.from(`${id}:${secret}`).toString('base64');
    const r = await axios.post('https://allegro.pl/auth/oauth/token',
      'grant_type=client_credentials',
      { headers:{ Authorization:`Basic ${c}`, 'Content-Type':'application/x-www-form-urlencoded' }, timeout:10000 });
    allegroToken = r.data.access_token;
    allegroExp = Date.now() + (r.data.expires_in - 60) * 1000;
    return allegroToken;
  } catch(e) { console.error('[Allegro OAuth]', e.response?.status||e.message); return null; }
}
async function searchAllegroPl(query) {
  query = adaptQueryForMarket(query, 'pl');
  try {
    const token = await getAllegroToken();
    if (!token) return []; // nessuna credenziale: non spara, niente crash
    await sleep(800+Math.random()*400);
    const r = await axios.get('https://api.allegro.pl/offers/listing', {
      params: { phrase: query, 'category.id': '7', limit: 20, sort: 'price' }, // 7 ~ Zegarki
      headers: { Authorization:`Bearer ${token}`, Accept:'application/vnd.allegro.public.v1+json', 'User-Agent':rUA() },
      timeout: 13000
    });
    const items = [ ...(r.data?.items?.promoted||[]), ...(r.data?.items?.regular||[]) ];
    const results = [];
    for (const o of items.slice(0, 14)) {
      const title = o.name || '';
      const pln = parseFloat(o.sellingMode?.price?.amount || 0) || 0;
      if (title && pln > 0) results.push({
        platform: 'Allegro 🇵🇱', title, price: pln, currency: 'PLN',
        url: o.id ? `https://allegro.pl/oferta/${o.id}` : 'https://allegro.pl', location: ''
      });
    }
    if (results.length) console.log(`[Allegro.pl] ${query}: ${results.length}`);
    srcOk('Allegro.pl', results.length);
    return results;
  } catch(e) { srcErr('Allegro.pl', e); console.error('[Allegro.pl]', e.response?.status||e.code||e.message); return []; }
}
// ── Sprzedajemy.pl (Polonia) e Okazii.ro (Romania) — niente API pulita,
//    scraping HTML leggero (FRAGILE per natura: se cambiano il layout, tornano
//    0; va verificato dal vivo con /api/diagnostica). Approccio a 2 passaggi:
//    1) trovo i link annuncio con un title=; 2) cerco un prezzo (zł / lei) nelle
//    vicinanze. Non dipende da una classe CSS specifica (la cosa più fragile).
async function searchSprzedajemyPl(query) {
  query = adaptQueryForMarket(query, 'pl');
  try {
    await sleep(900+Math.random()*400);
    const r = await axios.get('https://sprzedajemy.pl/szukaj', {
      params: { inp_text: query }, headers:{ 'User-Agent':rUA(), 'Accept-Language':'pl-PL' }, timeout:13000
    });
    const html = String(r.data||'');
    const results = [];
    // 1° passaggio: ogni link con title= (i listing Sprzedajemy hanno title sul <a>)
    const linkRe = /<a\b[^>]*\bhref="([^"]+)"[^>]*\btitle="([^"]{6,})"[^>]*>/gi;
    let m;
    const seen = new Set();
    while ((m = linkRe.exec(html)) && results.length < 14) {
      const href = m[1], title = m[2].replace(/&[^;]+;/g,' ').trim();
      if (!/\/oferta\//.test(href) && !/sprzedajemy\.pl\//.test(href)) continue; // solo annunci
      if (seen.has(title)) continue; seen.add(title);
      if (!looksLikeWatchListing(title)) continue;
      // 2° passaggio: cerco un prezzo "1 234 zł" nei 1200 caratteri dopo il link
      const after = html.slice(m.index, m.index + 1200);
      const pm = after.match(/(\d[\d \u00a0.]{2,})\s*z[łl]/i);
      const pln = pm ? parseFloat(pm[1].replace(/[ \u00a0.]/g,'')) || 0 : 0;
      const url = href.startsWith('http') ? href : 'https://sprzedajemy.pl'+href;
      if (title && pln >= 180) results.push({ platform:'Sprzedajemy 🇵🇱', title, price:pln, currency:'PLN', url, location:'' });
    }
    if (results.length) console.log(`[Sprzedajemy.pl] ${query}: ${results.length}`);
    srcOk('Sprzedajemy.pl', results.length);
    return results;
  } catch(e) { console.error('[Sprzedajemy.pl]', e.response?.status||e.code||e.message); return []; }
}
async function searchOkaziiRo(query) {
  query = adaptQueryForMarket(query, 'ro');
  try {
    await sleep(900+Math.random()*400);
    const r = await axios.get('https://www.okazii.ro/cauta', {
      params: { q: query }, headers:{ 'User-Agent':rUA(), 'Accept-Language':'ro-RO' }, timeout:13000
    });
    const html = String(r.data||'');
    const results = [];
    const linkRe = /<a\b[^>]*\bhref="([^"]+)"[^>]*\btitle="([^"]{6,})"[^>]*>/gi;
    let m;
    const seen = new Set();
    while ((m = linkRe.exec(html)) && results.length < 14) {
      const href = m[1], title = m[2].replace(/&[^;]+;/g,' ').trim();
      if (!/okazii\.ro|\/p\/|\/a\//.test(href)) continue;
      if (seen.has(title)) continue; seen.add(title);
      if (!looksLikeWatchListing(title)) continue;
      const after = html.slice(m.index, m.index + 1200);
      const pm = after.match(/(\d[\d.,]+)\s*(?:lei|RON)/i);
      const ron = pm ? parseFloat(pm[1].replace(/\./g,'').replace(',','.')) || 0 : 0;
      const url = href.startsWith('http') ? href : 'https://www.okazii.ro'+href;
      if (title && ron >= 200) results.push({ platform:'Okazii 🇷🇴', title, price:ron, currency:'RON', url, location:'' });
    }
    if (results.length) console.log(`[Okazii.ro] ${query}: ${results.length}`);
    return results;
  } catch(e) { console.error('[Okazii.ro]', e.response?.status||e.code||e.message); return []; }
}
async function searchFacebook(query, lat=46.1407, lng=12.2176) {
  if (!process.env.FACEBOOK_ACCESS_TOKEN) return [];
  try {
    const r = await axios.get('https://graph.facebook.com/v19.0/marketplace_search',{ params:{q:query,access_token:process.env.FACEBOOK_ACCESS_TOKEN,latitude:lat,longitude:lng,radius:100000,limit:20,fields:'id,name,price,location,listing_url'}, timeout:15000 });
    return (r.data.data||[]).map(i=>({
      platform:'Facebook Marketplace 📍', title:i.name||'', price:parseFloat(String(i.price?.amount||'0').replace(/[^\d.]/g,''))||0,
      currency:i.price?.currency||'EUR', url:i.listing_url||`https://www.facebook.com/marketplace/item/${i.id}`,
      location:i.location?.city||'', isLocal:true
    })).filter(i=>i.price>=SCAN_FLOOR);
  } catch(e) { console.error('[Facebook]',e.message); return []; }
}

// ══════════════ HYPE SCAN ══════════════
async function runHypeScan() {
  console.log('\n[HYPE SCAN] Analisi social sentiment...');
  try {
    const results = await scanHypeModels();
    db.hypeAnalyses = results;
    for (const analysis of results) {
      const prev = db.hypeAlerts.find(a=>a.query===analysis.query);
      const prevScore = prev?.score||0;
      const jump = analysis.hypeScore.score-prevScore;
      if (analysis.hypeScore.score>=70&&(jump>=10||!prev)) {
        if(prev) prev.score=analysis.hypeScore.score;
        else db.hypeAlerts.push({query:analysis.query,score:analysis.hypeScore.score,category:analysis.category,at:new Date().toISOString()});
        const ce={vintage_gold:'🏺',indie:'⌚',sport_gold:'🏆',platinum:'🔘'}[analysis.category]||'⌚';
        await tg(
          `${ce} <b>HYPE ALERT</b>\n\n🔥 <b>${analysis.query}</b>\n`+
          `📊 Score: <b>${analysis.hypeScore.score}/100</b> — ${analysis.hypeScore.label}\n`+
          (jump>=10?`📈 Crescita: +${jump} punti\n`:'')+
          `\n🔑 ${analysis.hypeScore.keySignal}\n\n`+
          `Reddit: ${analysis.signals.reddit.monthPosts} post · ${analysis.signals.reddit.growthSignal}\n`+
          `YouTube: ${analysis.signals.youtube.totalVideos} video${analysis.signals.youtube.knownChannelBonus?' ⭐':''}\n`+
          `Hodinkee: ${analysis.signals.hodinkee.hasArticle?'✅':'❌'} · WatchUSeek: ${analysis.signals.watchuseek.totalThreads} thread\n`+
          `Facebook gruppi: ${analysis.signals.facebook.groupActivity}\n\n`+
          `💡 Cercalo su Subito.it e Vinted prima che salgano i prezzi`
        );
      }
    }
    return results;
  } catch(e) { console.error('[HYPE SCAN]',e.message); return []; }
}

const cache = new Map();
const getCached = k => { const e=cache.get(k); return e&&Date.now()-e.ts<15*60*1000?e.d:null; };
const setCache = (k,d) => cache.set(k,{d,ts:Date.now()});

async function searchAll(query) {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  const [ebay, chrono, catawiki, subito, leboncoin, vestiaire, watchfinder, vinted, wallapop, ricardo, marktplaats, olxpl, olxro, allegro, sprzed, okazii, mlmx, mlbr, serp, serpLocal, fb] = await Promise.allSettled([
    searchEbayAllCountries(query), searchChrono24RSS(query), searchCatawiki(query), searchSubito(query),
    searchLeboncoin(query), searchVestiaire(query), searchWatchfinder(query), searchVinted(query),
    searchWallapop(query), searchRicardo(query), searchMarktplaats(query), searchOlxPl(query), searchOlxRo(query),
    searchAllegroPl(query), searchSprzedajemyPl(query), searchOkaziiRo(query),
    searchMercadoLibreMX(query), searchMercadoLibreBR(query),
    searchSerpAPI(query, 'it'), searchSerpAPILocal(query), searchFacebook(query),
  ]);
  const all = [
    ...(ebay.status==='fulfilled'?ebay.value:[]), ...(chrono.status==='fulfilled'?chrono.value:[]),
    ...(catawiki.status==='fulfilled'?catawiki.value:[]), ...(subito.status==='fulfilled'?subito.value:[]),
    ...(leboncoin.status==='fulfilled'?leboncoin.value:[]), ...(vestiaire.status==='fulfilled'?vestiaire.value:[]),
    ...(watchfinder.status==='fulfilled'?watchfinder.value:[]), ...(vinted.status==='fulfilled'?vinted.value:[]),
    ...(wallapop.status==='fulfilled'?wallapop.value:[]), ...(ricardo.status==='fulfilled'?ricardo.value:[]),
    ...(marktplaats.status==='fulfilled'?marktplaats.value:[]), ...(olxpl.status==='fulfilled'?olxpl.value:[]),
    ...(olxro.status==='fulfilled'?olxro.value:[]), ...(allegro.status==='fulfilled'?allegro.value:[]),
    ...(sprzed.status==='fulfilled'?sprzed.value:[]), ...(okazii.status==='fulfilled'?okazii.value:[]),
    ...(mlmx.status==='fulfilled'?mlmx.value:[]), ...(mlbr.status==='fulfilled'?mlbr.value:[]),
    ...(serp.status==='fulfilled'?serp.value:[]),
    ...(serpLocal.status==='fulfilled'?serpLocal.value:[]), ...(fb.status==='fulfilled'?fb.value:[]),
  ];
  // ── DIAGNOSTICA PER-PIAZZA: quanti annunci ha reso ogni scraper a questo giro.
  //    'rej' = lo scraper ha tirato errore (piazza morta o bloccata), non 0 reali.
  const _cnt = (r,name) => r.status==='fulfilled' ? (r.value?.length||0) : `rej(${(r.reason&&r.reason.message||'').slice(0,40)})`;
  const _diag = {
    eBay:_cnt(ebay), Chrono24:_cnt(chrono), Catawiki:_cnt(catawiki), Subito:_cnt(subito),
    Leboncoin:_cnt(leboncoin), Vinted:_cnt(vinted), Wallapop:_cnt(wallapop), Ricardo:_cnt(ricardo),
    Marktplaats:_cnt(marktplaats), 'OLX.pl':_cnt(olxpl), 'OLX.ro':_cnt(olxro), Allegro:_cnt(allegro),
    Sprzedajemy:_cnt(sprzed), Okazii:_cnt(okazii), 'ML.mx':_cnt(mlmx), 'ML.br':_cnt(mlbr), FB:_cnt(fb)
  };
  console.error(`[SCRAPER] "${query}" →`, JSON.stringify(_diag));
  lastScraperDiag = { at: new Date().toISOString(), query, counts: _diag };
  const seenUrls = new Set();
  const enriched = [];
  for (const item of all) {
    if (!item.url||seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    const priceEur = Math.round(await toEur(item.price, item.currency));
    if (priceEur<300) continue;
    const metalData = await calcMetal(item.title, priceEur);
    enriched.push({...item, priceEur, metalData});
  }
  enriched.sort((a,b)=>a.priceEur-b.priceEur);
  const byP = {};
  for (const i of enriched) if (!byP[i.platform]||i.priceEur<byP[i.platform].priceEur) byP[i.platform]=i;
  return {
    query, results: Object.values(byP).sort((a,b)=>a.priceEur-b.priceEur),
    allListings: enriched, lowest: enriched[0]||null,
    arbitrage: enriched.filter(i=>i.metalData?.isArbitrage),
    nearArbitrage: enriched.filter(i=>i.metalData?.isNear),
    goldPricePerGram: Math.round(gold*100)/100, platinumPricePerGram: Math.round(platinum*100)/100,
    platforms: Object.keys(byP), totalFound: enriched.length, timestamp: new Date().toISOString(),
  };
}

// ══════════════ QUERY (6 blocchi a rotazione + G sempre attivo) ══════════════
// ── BLOCCHI TEMATICI — solo query MIRATE (niente "esca" generiche che
// bruciano analisi Claude su robaccia). Ogni query nomina marchio/modello/
// calibro o un tratto di quadrante che da solo seleziona pezzi giusti.
const QUERIES_BLOCK_A = ['Nivada Grenchen Chronomaster','Gallet Multichron 12','Universal Geneve Polerouter','Eterna KonTiki vintage','Enicar Sherpa Graph','Lemania cronografo militare','Wakmann Valjoux 72'];
const QUERIES_BLOCK_B = ['Excelsior Park 40 cronografo','Vulcain Cricket vintage','Favre-Leuba Bivouac','Zenith El Primero A386','Doxa Sub 300 1967','Girard Perregaux Gyromatic','Longines 30CH cronografo'];
const QUERIES_BLOCK_C = ['Ollech Wajs vintage','Airain Type 20','Yema Yachtingraf','Heuer Autavia 2446','Eberhard Extra-Fort','Wittnauer Valjoux 72','Helvetia Valjoux 72 cronografo'];
const QUERIES_BLOCK_D = ['orologio doppia firma Tiffany vintage','Serpico Laino cronografo','orologio Hausmann Roma vintage','orologio Cartier dial vintage','Universal Geneve Tri-Compax oro','Movado M95 cronografo'];
const QUERIES_BLOCK_E = ['cronografo quadrante tropicale Valjoux','orologio gilt dial cronografo vintage','Omega Constellation pie pan','orologio sector dial cronografo','Omega Seamaster 300 vintage','cronografo oro 18k Valjoux 72'];
const QUERIES_BLOCK_F = ['Angelus Chronodato','Minerva cronografo vintage','Hanhart flyback','Zodiac Sea Wolf','Aquastar Deepstar','Seiko 6139 chronograph','Seiko 62MAS diver'];
// ── BLOCCO MELT-SCARCITY (tesi giu 2026): dress oro 18k solo-tempo marchi nobili
//    + ladies' gold anni 70-80. Sono i pezzi che vengono FUSI per il peso →
//    scarsità futura. Query mirate a pescarli vicino al melt floor. ──
const QUERIES_BLOCK_G_MELT = [
  'Omega oro 18k solo tempo vintage','Longines oro 18k vintage dress',
  'IWC oro 18k vintage','Universal Geneve oro 18k vintage',
  'Movado oro 18k vintage','Vacheron Constantin oro 18k solo tempo',
  'Patek Philippe Calatrava oro vintage','orologio oro 18k donna vintage anni 70',
  'ladies gold watch 18k vintage','orologio oro 18k signora vintage',
  'Girard Perregaux oro 18k vintage','Jaeger LeCoultre oro 18k vintage',
  'Eterna oro 18k vintage','zegarek złoto 18k vintage','złoty zegarek Omega Longines',
];
// ── BLOCCO H — QUERY GREZZE "VENDITORE IGNARO" (v12.24, fix segnali 06/07/26):
//    gli affari NON stanno negli annunci etichettati bene ("Universal Geneve
//    Polerouter"): chi scrive così SA cosa ha e prezza giusto. Gli affari
//    stanno negli annunci generici — "orologio oro del nonno", "goldene Uhr
//    Nachlass" — dove il venditore non sa cosa vende. Queste query pescano LÌ,
//    multilingua, su tutti i mercati. Il gate di tesi e l'AI poi filtrano. ──
const QUERIES_BLOCK_H_GREZZI = [
  // Italia
  'orologio oro 750 vintage', 'orologio oro 18k carica manuale',
  'orologio d\'epoca oro massiccio', 'orologio oro eredità',
  // Germania (mercato ricco di dress-gold sottoprezzati; Leonardo lo legge nativo)
  'armbanduhr 750 gold handaufzug', 'herrenuhr 18k gold vintage', 'goldene uhr nachlass',
  // Francia
  'montre or 18k mecanique ancienne', 'montre or massif vintage',
  // Olanda
  'horloge 18k goud vintage',
  // Polonia
  'zegarek złoto 750 męski', 'złoty zegarek vintage',
  // Spagna / internazionale
  'reloj oro 18k antiguo', 'solid gold watch 18k manual wind',
];
// BLOCCO G — le query ENCICLOPEDICHE generate dalla watchlist (vedi encyclopedicQueries.js).
const QUERIES_G_CORE = ['Wittnauer Valjoux 72 cronografo','Excelsior Park 40 cronografo','Enicar Sherpa Graph','Gallet Multichron 12','Universal Geneve Compax'];
// Il pool si COSTRUISCE dall'Enciclopedia: marchi+modelli+calibri precisi e
// parenti poveri delle leggende. Aggiungiamo solo qualche pezzo mirato extra.
const QUERIES_G_POOL = Array.from(new Set([
  ...encyclopedicQueries.encyclopedicQueries,
  // indipendenti moderni (rari ma ogni avvistamento conta)
  'Urban Jurgensen 1140','Czapek Quai des Bergues','Andersen Geneve','FP Journe usato',
  'De Bethune','Moser Endeavour','Atelier Wen Perception',
  // fascia media SOLO referenze calde (affari veri, non robaccia)
  'Tudor Black Bay 58 79030N','Tudor Pelagos','Grand Seiko Snowflake','Cartier Santos vintage',
  'JLC Reverso','Zenith El Primero usato',
  // complicazioni mirate
  'Franck Muller Crazy Hours','Ulysse Nardin Freak',
  // altri target di studio precisi
  'Breitling Top Time vintage','Rado Captain Cook vintage','Bulova Accutron Spaceview',
  'Hamilton Ventura','Mido Multifort vintage','Certina DS vintage','LIP Mach 2000',
]));
let scanCounter = 0;

// Tick di rotazione DUREVOLE basato sull'orologio: NON si azzera ai riavvii.
// Su Render free l'istanza riparte di continuo e scanCounter tornava sempre a 0
// → la finestra di query ripartiva sempre dall'inizio → "trova sempre le stesse
// cose". Le ore intere dall'epoch avanzano comunque, quindi la finestra scorre
// davvero sul pool indipendentemente dai riavvii.
function rotationTick() { return Math.floor(Date.now() / 3600000); }

// Ora italiana corrente (Europe/Rome), robusta a UTC del server Render.
function romeHour() {
  try {
    return Number(new Intl.DateTimeFormat('it-IT', { timeZone:'Europe/Rome', hour:'2-digit', hour12:false }).format(new Date()));
  } catch { return new Date().getHours(); }
}
// Di notte (00–07 ora IT) spingiamo di più: Leonardo è sveglio o si sveglia
// presto e vuole trovare tutto pronto. Di giorno restiamo leggeri.
function isNightBoost() { const h = romeHour(); return h >= 0 && h < 7; }

function getGoldQueries() {
  scanCounter++;
  const tick = rotationTick(); // driver di rotazione durevole (vedi rotationTick)
  const night = isNightBoost();
  const rotating = [QUERIES_BLOCK_A, QUERIES_BLOCK_B, QUERIES_BLOCK_C, QUERIES_BLOCK_D, QUERIES_BLOCK_E, QUERIES_BLOCK_F];
  // ── FIX SEGNALI (v12.24, 06/07/26): la TESI gira SEMPRE, i temi ruotano.
  //    Prima G_MELT era 1 blocco su 7 → le query della tesi melt-scarcity
  //    giravano ~1 volta ogni 7 ore di giorno, e le generiche "venditore
  //    ignaro" non esistevano. Ora G_MELT + H_GREZZI entrano in OGNI scan;
  //    i blocchi collezionismo (crono/diver, fuori tesi melt per definizione)
  //    ruotano come contorno: 1 blocco di giorno, 2 di notte. ──
  const themed = night
    ? [...QUERIES_BLOCK_G_MELT, ...QUERIES_BLOCK_H_GREZZI, ...rotating[tick % rotating.length], ...rotating[(tick+3) % rotating.length]]
    : [...QUERIES_BLOCK_G_MELT, ...QUERIES_BLOCK_H_GREZZI, ...rotating[tick % rotating.length]];
  // Finestra scorrevole sul pool enciclopedico: di NOTTE 30 query, di GIORNO 15.
  // Così la notte copre tutto il pool in pochi cicli e al mattino è tutto battuto.
  const N = night ? 30 : 15;
  const off = (tick * N) % QUERIES_G_POOL.length;
  const gRot = [];
  for (let i = 0; i < N; i++) gRot.push(QUERIES_G_POOL[(off + i) % QUERIES_G_POOL.length]);

  // ── IDEA 4: CACCIA GEOGRAFICA ATTIVA ──
  // A ogni ciclo aggiungo qualche query che pesca i modelli DOVE SONO FREDDI:
  // tedeschi su fonti IT, italiani/francesi su fonti DE, giapponesi/USA in EU.
  // Le marco con prefisso "GEO:<mercato>:" così piu sotto scelgo la sorgente
  // giusta. Uso l'array enciclopedico reale come pool (niente funzione esterna).
  const geoMarkets = ['it', 'de', 'eu'];
  const geoPool = encyclopedicQueries.encyclopedicQueries || [];
  const geoQ = [];
  for (const mk of geoMarkets) {
    if (!geoPool.length) continue;
    const base = (tick * 3) % geoPool.length;
    for (let i = 0; i < 3; i++) geoQ.push(`GEO:${mk}:${geoPool[(base + i) % geoPool.length]}`);
  }

  return Array.from(new Set([...QUERIES_G_CORE, ...gRot, ...themed, ...geoQ]));
}
const GOLD_QUERIES = QUERIES_BLOCK_A;

// ══════════════ SCANSIONE PRINCIPALE ══════════════
async function runGoldScan(mode = 'all') {
  const gold = await getGoldPrice();
  const platinum = await getPlatinumPrice();
  console.log(`\n[SCAN v12.4 ${mode==='subito'?'SUBITO':'COMPLETA'}] Oro: €${gold.toFixed(2)}/g | Platino: €${platinum.toFixed(2)}/g`);

  let foundArb=0, foundNear=0, foundVintage=0, foundStudy=0, foundInvestor=0, foundGrezzo=0;
  const cycleBest = []; // ── v12.26: ogni pezzo con stima, anche bocciato → "migliori del giro"
  const seenUrls = new Set([...db.arbitrage,...db.nearArbitrage,...db.vintageDeals].map(a=>normUrl(a.url)));
  const activeQueries = getGoldQueries();

  for (const rawQuery of activeQueries) {
    try {
      // ── IDEA 4: query di caccia geografica marcata "GEO:<mercato>:testo" ──
      let query = rawQuery;
      let geoMarket = null;
      if (rawQuery.startsWith('GEO:')) {
        const parts = rawQuery.split(':');
        geoMarket = parts[1];
        query = parts.slice(2).join(':');
      }
      // ── MIX ITALIA ──
      // Una parte delle query (~35%) gira SOLO su sorgenti italiane, così tra
      // i risultati arriva sempre roba dall'Italia (Subito + Google Shopping IT
      // + eBay IT) e non solo annunci DE/FR. Il resto resta full estero, dove
      // spesso stanno gli affari migliori. Scelta deterministica via hash:
      // la stessa query è sempre nello stesso gruppo (niente doppioni casuali).
      const qHash = Array.from(query).reduce((a,c)=>((a*31 + c.charCodeAt(0))>>>0), 7);
      const italiaFirst = (qHash % 100) < 35;

      // ── SORGENTI 100% GRATIS (v12.4) ──
      // Spina dorsale = API UFFICIALE eBay (searchEbayAllCountries: usa l'API
      // Browse gratuita e copre IT/FR/DE/GB/ES in una sola chiamata, e ripiega
      // sullo scraping solo se manca il token). Niente più SerpAPI a pagamento
      // nelle scansioni. Gli scraper (Subito, Chrono24, Marktplaats, Vinted)
      // restano come BONUS: se il sito è raggiungibile portano roba, se è
      // bloccato non costa nulla. L'oro (calcolo puro) gira su tutto ciò che entra.
      const sources = geoMarket
        ? ( // ── CACCIA GEO: stesso modello, mercato dove è FREDDO ──
            geoMarket === 'it'
              ? [ searchSubito, searchEbayAllCountries ]            // esteri pescati anche in IT
              : geoMarket === 'de'
                ? [ searchMarktplaats, searchEbayAllCountries ]     // italiani/FR pescati in DE
                : [ searchChrono24RSS, searchEbayAllCountries, searchOlxPl, searchOlxRo ] // JP/US/Est in EU
          )
        : mode === 'subito'
        ? [ searchSubito ]
        : italiaFirst
          ? [ // ── Italia-first: Subito + eBay (l'API include eBay IT) ──
              searchSubito,           // 🇮🇹 annunci privati IT
              searchEbayAllCountries, // eBay ufficiale (IT compresa) — GRATIS
              searchChrono24RSS,      // Chrono24
            ]
          : [ // ── Copertura AMPIA: TUTTI i marketplace, non solo i 5 vecchi ──
              searchEbayAllCountries, // eBay ufficiale IT/FR/DE/GB/ES — GRATIS
              searchSubito,           // 🇮🇹
              searchChrono24RSS,
              searchMarktplaats,      // 🇳🇱
              searchVinted,
              searchLeboncoin,        // 🇫🇷
              searchWallapop,         // 🇪🇸
              searchRicardo,          // 🇨🇭
              searchOlxPl,            // 🇵🇱
              searchOlxRo,            // 🇷🇴
              searchAllegroPl,        // 🇵🇱 (se credenziali)
              searchSprzedajemyPl,    // 🇵🇱
              searchOkaziiRo,         // 🇷🇴
              searchMercadoLibreMX,   // 🇲🇽
              searchMercadoLibreBR,   // 🇧🇷
            ];
      if (geoMarket) console.log(`[GEO-HUNT ${geoMarket}] "${query}" → pesco dove e freddo`);
      else if (italiaFirst) console.log(`[MIX-IT] "${query}" → solo sorgenti italiane`);
      // Fonti in PARALLELO (prima erano sequenziali: con 15 marketplace
      // diventavano ~3 min/query). allSettled = se una fallisce, le altre
      // proseguono. Ogni scraper ha già il suo timeout interno.
      let all = [];
      const settled = await Promise.allSettled(sources.map(src => src(query)));
      settled.forEach((res, i) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length) {
          for (const it of res.value) all.push({ platform: it.platform, title: it.title, price: it.price, currency: it.currency, url: it.url, location: it.location || '', image: it.image || '' });
        } else if (res.status === 'rejected') {
          console.error(`[FONTE] ${sources[i]?.name||'unknown'} su "${query}": ${res.reason?.message||res.reason}`);
        }
      });
      console.log(`[SCAN] "${query}": ${all.length} annunci raccolti da ${sources.length} fonti`);

      for (const item of all) {
        if (!item.url) continue;
        const nu = normUrl(item.url);
        if (seenUrls.has(nu)) continue;
        const priceEur = Math.round(await toEur(item.price, item.currency));
        // ── TRACE MERCATI NUOVI: per capire DOVE si fermano gli annunci esteri
        //    (OLX, Allegro, Mercado Libre, ecc.). Logga il percorso di ognuno.
        const NEW_MKTS = ['OLX.pl','OLX.ro','Allegro','Sprzedajemy','Okazii','MercadoLibre'];
        const isNewMkt = NEW_MKTS.some(m => (item.platform||'').includes(m));
        const trace = (stage) => { if (isNewMkt) console.log(`[TRACE ${item.platform}] ${stage} | "${(item.title||'').slice(0,50)}" ${item.price}${item.currency}→${priceEur}€`); };
        trace('1.trovato');
        if (priceEur<SCAN_FLOOR) { trace(`SCARTATO: sotto SCAN_FLOOR(${SCAN_FLOOR}€)`); continue; }
        if (priceEur>MAX_PRICE) { trace(`SCARTATO: sopra MAX_PRICE(${MAX_PRICE}€)`); continue; }
        // Impronta titolo+prezzo: blocca lo stesso annuncio anche se l'URL
        // cambia (tracking eBay) o se è stato ripubblicato identico.
        const fp = listingFp(item.title, priceEur);
        // SCARTO PERSISTENTE: salto se è scartato per URL O per impronta. L'URL
        // da solo non bastava — lo stesso orologio ripubblicato con link nuovo
        // tornava "come una mosca". L'impronta lo tiene fuori per davvero.
        if (db.dismissedUrls.includes(nu) || db.dismissedFps.includes(fp)) { trace('SCARTATO: già dismesso'); continue; }
        if (alreadyAlerted(fp)) { trace('SCARTATO: già avvisato (anti-ripetizione)'); seenUrls.add(nu); continue; }
        if (looksLikeParts(item.title)) { trace('SCARTATO: sembra ricambi'); console.log(`[PARTI] salto: ${item.title?.slice(0,45)}`); continue; }
        if (looksLikeNotAWatch(item.title)) { trace('SCARTATO: sembra non-orologio'); console.log(`[NON-OROLOGIO] salto (occhiali/penna/gioiello): ${item.title?.slice(0,45)}`); continue; }
        // ── GATE POSITIVO sui mercati a categoria larga (OLX.pl/.ro, Allegro,
        //    Sprzedajemy, Mercado Libre, Wallapop): pretendi un segnale di
        //    orologio nel titolo. Senza, è spazzatura generalista (cuffie,
        //    stereo, manometri) che il classifier poi "allucinerebbe" come un
        //    modello del watchlist. Sui mercati a categoria-orologi NON si
        //    applica (la categoria già garantisce l'oggetto). ──
        if (isBroadCategoryMarket(item.platform) && !hasWatchSignal(item.title)) {
          trace('SCARTATO: mercato largo senza segnale-orologio');
          console.log(`[GATE+] salto (mercato largo, nessun segnale orologio): ${item.title?.slice(0,55)}`);
          continue;
        }
        trace('2.passa-filtri-categoria');

        // ── OSSERVATI: un pezzo che segui è ricomparso sotto soglia? ──
        try { await checkObservedMatch(item, priceEur); } catch {}

        // ── METALLO (oro/platino sicuro) PRIMA DI TUTTO ──
        if (detectMetal(item.title)) {
          const metal = await calcMetal(item.title, priceEur);
          if (metal && (metal.isArbitrage || metal.isNear)) {
            const entry = { id:nid(), platform:item.platform, title:item.title, price:priceEur, metalValue:metal.metalValue, metalGrams:metal.pureMetalGrams, metal:metal.metal, diffPct:metal.diffPct, confidence:metal.confidence, url:item.url, location:item.location||'', foundAt:new Date().toISOString() };
            const metalloSicuro = metal.confidence === 'high' && metal.weightKnown === true && metal.generic !== true && metal.diffPct >= -10;
            const metalloConfermato = metalloSicuro || (metal.underSafeFloor && metal.weightKnown && metal.confidence !== 'low');
            // Conto e registro SOLO gli arbitraggi che generano un alert vero.
            // Il ramo 3 (stima non confermata) NON viene contato: così la
            // diagnostica non mostra "arbitrageFound" gonfiati da falsi oro.
            if (metalloConfermato) {
              (metal.isArbitrage ? db.arbitrage : db.nearArbitrage).push(entry);
              if (metal.isArbitrage) foundArb++; else foundNear++;
            }
            if (metalloSicuro) {
              seenUrls.add(nu); markAlerted(fp); saveState();
              const emoji = metal.metal==='platinum'?'\u{1F518}':'\u{1F947}';
              const name = metal.metal==='platinum'?'PLATINO': metal.metal==='14k' ? 'ORO 14K' : metal.metal==='9k' ? 'ORO 9K' : 'ORO 18K';
              const offerta = Math.round(Math.min(metal.metalValue * 0.85, priceEur * 0.75) / 10) * 10;
              const guadagnoSeOfferta = metal.metalValue - offerta;
              const compraSubito = metal.diffPct >= 0;
              const titolo = compraSubito ? `${emoji} <b>${name} \u2014 COMPRA SUBITO \u{1F525}</b>` : `${emoji} <b>${name} \u2014 OCCASIONE METALLO</b>`;
              await tg(
                `${titolo}\n\n\u231A ${item.title?.slice(0,65)}\n`+
                `\u{1F4B0} Chiede: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
                `\u{1F48E} Se \u00E8 oro massiccio, sotto c'\u00E8 ${name==='PLATINO'?'platino':'oro'} per ~<b>\u20AC${metal.metalValue.toLocaleString('it-IT')}</b> (peso tipico del modello ~${metal.pureMetalGrams}g, <b>DA PESARE</b>)\n`+
                `\u26A0\uFE0F Conferma SEMPRE: caratura punzonata (750/18k) + peso della SOLA cassa. Ghiera/corona/indici in oro o cappato = NON massiccio.\n`+
                (metal.diffPct>0 ? `\u{1F4C9} Gi\u00E0 <b>\u2212${metal.diffPct}% sotto il metallo</b>\n` : metal.diffPct===0 ? `\u2696\uFE0F <b>Esattamente al valore del metallo</b>\n` : `\u{1F4CA} Solo ${Math.abs(metal.diffPct)}% sopra il metallo\n`)+
                (compraSubito ? `\n\u{1F512} <b>Acquisto sicuro:</b> paghi quanto vale il metallo, e l'oro storicamente sale nel lungo periodo.\n` : `\n\u{1F3AF} <b>Tratta.</b> Offri ~\u20AC${offerta.toLocaleString('it-IT')}: guadagno \u20AC${guadagnoSeOfferta.toLocaleString('it-IT')} garantito dal metallo.\n`)+
                meltScarcityHint(item.title)+
                `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
                `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
                feedbackLinks(null, item.url, item.title, priceEur)
              );
              continue;
            }
            // ── RAMO 2: metallo REALE ma peso da confermare ──
            //    Parte SOLO se il modello è stato riconosciuto (weightKnown:
            //    peso da database, non stima generica) OPPURE la confidenza è
            //    almeno media E il titolo dichiara oro massiccio esplicito.
            //    Niente più "Oro stimato 16-26g" inventato su pezzi non d'oro:
            //    era la causa del falso positivo (es. Zodiac acciaio "702-916").
            else if (metal.underSafeFloor && metal.weightKnown && metal.confidence !== 'low') {
              seenUrls.add(nu); markAlerted(fp); saveState();
              const g = metal.gramsLow && metal.gramsHigh ? `${metal.gramsLow}\u2013${metal.gramsHigh}g` : `~${metal.pureMetalGrams}g`;
              await tg(
                `\u{1F947}\u26A1 <b>ORO \u2014 POTENZIALE AFFARE (verifica al volo)</b>\n\n\u231A ${item.title?.slice(0,65)}\n`+
                `\u{1F4B0} Chiede: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n\u{1F4CF} Oro stimato: <b>${g}</b>\n`+
                `\u{1F4B0} Vale come oro: <b>\u20AC${metal.valueLow.toLocaleString('it-IT')}\u2013\u20AC${metal.valueHigh.toLocaleString('it-IT')}</b>\n`+
                `\u2705 Anche col peso MINIMO l'oro vale \u20AC${metal.safeFloor.toLocaleString('it-IT')}: paghi meno \u2192 coperto.\n`+
                `\u26A0\uFE0F Conferma punzone e peso col venditore (foto fondello + caratura).\n`+
                `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
                `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
                feedbackLinks(null, item.url, item.title, priceEur)
              );
              continue;
            }
            // ── RAMO 3: metallo NON confermato (peso stimato + confidenza non alta) ──
            //    NON inviamo alcun alert oro: la stima generica produceva falsi
            //    positivi su pezzi in acciaio. Il pezzo prosegue verso l'analisi
            //    Claude come orologio normale (può comunque diventare un affare
            //    vintage, ma NON un "arbitraggio metallo").
            //    Resta contato in db.arbitrage/nearArbitrage per la diagnostica,
            //    ma niente messaggio Telegram fuorviante.
            else {
              if (process.env.DEBUG_METAL) console.log(`[METALLO] stima non confermata, niente alert oro: ${item.title?.slice(0,50)} (conf=${metal.confidence}, weightKnown=${metal.weightKnown})`);
              // NON facciamo "continue": lasciamo proseguire l'item verso Claude.
            }
          }
        }

        const vintage = evaluateVintageDeal(item.title, priceEur);

        // ── PRE-FILTRO AI (v12.14): risparmia le chiamate AI (free tier ha
        //    tetti al minuto). L'oro/melt sopra è già gestito a calcolo puro,
        //    gratis. Qui, PRIMA di spendere una chiamata Gemini/Groq, pretendo
        //    almeno un segnale forte: brand-orologio riconosciuto nel titolo,
        //    OPPURE brand in watchlist, OPPURE modello già nel database vintage.
        //    Un titolo generico/ignoto NON consuma AI (verrebbe scartato comunque).
        //    Così le chiamate scendono da decine a poche per scan → niente 429. ──
        const _segnaleForte = hasWatchSignal(item.title) || !!watchlistHit(item.title) || !!vintage;
        if (!_segnaleForte) {
          funnelBump('senzaSegnaleForte');
          trace(`SALTO AI (nessun segnale forte): ${item.title?.slice(0,50)}`);
          continue;
        }

        // ── GATE DI TESI (v12.22): il buttafuori. Scarta la fuffa dichiarata
        //    (fashion, smartwatch, placcato, quartz anonimo, replica) SENZA
        //    spendere AI, e decide il motore: tier 'top' = Claude Sonnet
        //    (solo candidati caldi: watchlist/brand nobile/calibro nobile/oro),
        //    tier 'normal' = Gemini/Groq gratis. ──
        const _gate = aiGate.gate(item.title, priceEur, { isWatchlist: !!watchlistHit(item.title), isVintageDb: !!vintage });
        if (!_gate.pass) {
          funnelBump('gateTesiScartati');
          trace(`SCARTATO dal gate di tesi: ${_gate.reason}`);
          console.log(`[GATE-TESI] salto (${_gate.reason}): ${item.title?.slice(0,55)}`);
          seenUrls.add(nu); // non rianalizzarlo ai prossimi giri
          continue;
        }
        if (_gate.tier === 'top') console.log(`[GATE-TESI] 🔥 TOP (${_gate.reason}) → Sonnet: ${item.title?.slice(0,55)}`);

        // ── ANALISI AI = MOTORE PRINCIPALE (tier top → Claude; resto → Gemini/Groq) ──
        if (claudeAnalyst.isConfigured()) {
          const ai = await claudeAnalyst.analyzeListing(item.title, priceEur, item.image, { tier: _gate.tier });
          funnelBump('analizzatiAI');
          if (!ai) funnelBump('aiSenzaRisposta'); else if (!ai.isInteresting) funnelBump('aiNonInteressante'); else funnelBump('aiInteressante');
          // ── MIGLIORI DEL GIRO (v12.26): registro ogni pezzo con una stima,
          //    anche se bocciato dalle soglie — mai più un giro muto senza
          //    contesto. I 3 migliori finiscono nel riepilogo scansione. ──
          if (ai && ai.valueLow && priceEur > 0 && cycleBest.length < 60) {
            cycleBest.push({ t: (item.title || '').slice(0, 55), p: priceEur, low: Number(ai.valueLow), url: item.url, ok: !!ai.isInteresting });
          }
          trace(ai ? (ai.isInteresting ? `3.AI INTERESSANTE (${ai.brand||'?'})` : `SCARTATO: AI dice non-interessante (brand letto: ${ai.brand||'?'})`) : 'SCARTATO: AI nessuna risposta');
          if (ai && ai.isInteresting) {
            if (isBrandBlacklisted(ai.brand)) { seenUrls.add(nu); continue; }
            seenUrls.add(nu); markAlerted(fp); saveState();

            // ── CANALE "🔧 FLIP GREZZO": fascia bassa (≤ FLIP_GREZZO_MAX), pezzo
            //    oscuro/mal fotografato che l'AI non sa quotare ma ha segnali di
            //    qualità. Volutamente RUMOROSO: meglio vederne troppi e scartare
            //    a mano che perdere il grezzo dove nasce il flip. Va PER PRIMO:
            //    questi pezzi non hanno valueLow, quindi non rientrano negli altri
            //    canali. L'occhio finale è di Leonardo. ──
            if (ai.refCheck) {
              // ── SOGLIA ANTI-RUMORE (v12.22, richiesta Leonardo 03/07/26) ──
              //    Con referenza incerta la stima è INAFFIDABILE per definizione:
              //    l'unico alert sensato è quando c'è margine anche nello scenario
              //    PEGGIORE. Regola: prezzo ≤ 70% della stima BASSA. "Chiede €3.700,
              //    stima €3.500-6.500" = margine zero nel caso prudente → SILENZIO.
              //    Tarabile via env REFCHECK_MAX_RATIO (0.7 default; 0.6 = più severo).
              const _refRatio = parseFloat(process.env.REFCHECK_MAX_RATIO || '0.7');
              if (!ai.valueLow || priceEur > Number(ai.valueLow) * _refRatio) {
                trace(`SILENZIO refCheck (no margine prudente: chiede €${priceEur} vs stima bassa €${ai.valueLow||'?'})`);
                console.log(`[REF-CHECK] silenzio, no margine prudente: ${item.title?.slice(0,55)}`);
                continue;
              }
              // Referenza incerta MA prezzo ben sotto la stima bassa: questo sì
              // che merita gli occhi di Leonardo. Avviso forte comunque.
              try { dealEngine.recordPrice(ai.brand, ai.model, priceEur); } catch {}
              await tg(
                `\u{1F50E} <b>DA VERIFICARE \u2014 REFERENZA INCERTA</b>\n\n`+
                `\u231A ${item.title?.slice(0,70)}\n`+
                (ai.brand && ai.brand!=='?'?`\u{1F3F7}\uFE0F <b>${ai.brand}${ai.model&&ai.model!=='null'&&ai.model!=='?'?' '+ai.model:''}</b>\n`:'')+
                (ai.caliber&&ai.caliber!=='null'&&ai.caliber!=='?'?`\u2699\uFE0F ${ai.caliber}\n`:'')+
                (ai.material&&ai.material!=='sconosciuto'&&ai.material!=='null'?`\u{1FA99} ${ai.material}\n`:'')+
                `\u{1F4B0} Chiede: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
                (ai.valueLow?`\u{1F4CA} Stima (NON confermata): \u20AC${Number(ai.valueLow).toLocaleString('it-IT')}\u2013\u20AC${Number(ai.valueHigh||ai.valueLow).toLocaleString('it-IT')}\n`:'')+
                `\n\u26A0\uFE0F <b>Lo sconto mostrato potrebbe essere falso:</b> la stima potrebbe riferirsi a un modello pi\u00F9 pregiato della stessa famiglia. Verifica la <b>referenza</b> e il <b>calibro</b> esatti prima di trattare.\n`+
                `\n\u{1F4A1} ${ai.reasoning||''}\n`+
                `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
                `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
                feedbackLinks(ai.brand, item.url, item.title, priceEur)
              );
              continue;
            }
            if (ai.isFlipGrezzo) {
              foundGrezzo = (typeof foundGrezzo === 'number' ? foundGrezzo : 0) + 1;
              try { dealEngine.recordPrice(ai.brand, ai.model, priceEur); } catch {}
              await tg(
                `\u{1F527} <b>FLIP GREZZO \u2014 DA VERIFICARE TU</b>\n\n`+
                `\u231A ${item.title?.slice(0,70)}\n`+
                (ai.brand && ai.brand!=='?'?`\u{1F527} <b>${ai.brand}${ai.model&&ai.model!=='null'&&ai.model!=='?'?' '+ai.model:''}</b>\n`:'')+
                (ai.caliber&&ai.caliber!=='null'&&ai.caliber!=='?'?`\u2699\uFE0F ${ai.caliber}${ai.qualityMovement?' \u2728':''}\n`:'')+
                (ai.material&&ai.material!=='sconosciuto'&&ai.material!=='null'?`\u{1FA99} ${ai.material}\n`:'')+
                `\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
                (ai.marketCycleLine?`${ai.marketCycleLine}\n`:'')+
                (ai.sellerClueless?`\u{1F3AF} <b>Il venditore sembra non sapere cosa ha!</b>\n`:'')+
                `\n\u26A0\uFE0F <b>Valore non stimabile dal solo titolo.</b> Prezzo basso + segnali di qualit\u00E0: \u00E8 il tipo di grezzo dove nasce il flip. Chiedi foto movimento + fondello e valuta di persona.\n`+
                `\n\u{1F4A1} ${ai.reasoning||''}\n`+
                `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
                `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
                feedbackLinks(ai.brand, item.url, item.title, priceEur)
              );
              continue;
            }

            // ── CANALE "📈 INVESTITORE — DA ACCUMULARE": fondamentali solidi,
            //    da tenere come un'azione, ANCHE a prezzo pieno (≤ mercato).
            //    Ha priorità sul DA STUDIARE: se un pezzo è investitore-grade,
            //    non è "da studiare" passivamente, è un segnale di accumulo.
            //    Se è ANCHE un flip (isRealDeal) lascio fare al canale AFFARE,
            //    che mostra già il blocco potenziale 3-5 anni. ──
            if (ai.investorPick && !ai.isRealDeal) {
              foundInvestor++;
              const bw = watchlistHit(ai.brand);
              const f = ai.fundamentals || {};
              const bar = (n, max) => '\u25B0'.repeat(Math.min(n,max)) + '\u25B1'.repeat(Math.max(0,max-n));
              const fvLow = ai.futureValueLow || 0, fvHigh = ai.futureValueHigh || 0;
              const upsidePct = (fvHigh && priceEur) ? Math.round(((fvHigh - priceEur) / priceEur) * 100) : 0;
              try { dealEngine.recordPrice(ai.brand, ai.model, priceEur); } catch {}
              // ── TAPE VENDUTI REALI: solo sui pick investitore (i più importanti),
              //    attivabile con SOLD_COMPS_ON=1 per controllare il costo SerpAPI. ──
              let soldLine = '';
              if (process.env.SOLD_COMPS_ON && ai.brand && ai.brand!=='?') {
                try {
                  const dms = (process.env.COMPS_DOMAINS || 'ebay.com').split(',').map(s=>s.trim());
                  const comps = await soldComps.getComps(ai.brand, (ai.model&&ai.model!=='null')?ai.model:'', { domains: dms });
                  soldLine = soldComps.buildSoldLine(priceEur, comps);
                } catch (e) { console.error('[SOLD]', e.message); }
              }
              await tg(
                `\u{1F4C8} <b>INVESTITORE \u2014 DA ACCUMULARE</b>  \u{1F9E0}\n`+
                `<i>Come un'azione a fondamentali solidi: compra PRIMA del catalizzatore.</i>\n\n`+
                `\u231A ${item.title?.slice(0,65)}\n`+
                (ai.brand?`\u{1F527} <b>${ai.brand}${ai.model&&ai.model!=='null'?' '+ai.model:''}</b>\n`:'')+
                (ai.caliber&&ai.caliber!=='null'?`\u2699\uFE0F ${ai.caliber}${ai.qualityMovement?' \u2728':''}\n`:'')+
                (caliberDb.caliberLine(item.title)?caliberDb.caliberLine(item.title)+'\n':'')+
                (longines.longinesLine(item.title)?longines.longinesLine(item.title)+'\n':'')+
                (bw?`\u{1F4CC} <b>In watchlist:</b> ${bw.note}${bw.maxBuy?` (max \u20AC${bw.maxBuy})`:''}\n`:'')+
                `\n\u{1F4CA} <b>Punteggio investitore: ${ai.investorScore}/10</b>\n`+
                (ai.marketCycleLine?`${ai.marketCycleLine}\n`:'')+
                `\u{1F527} Motore     ${bar(f.motore||0,3)}\n`+
                `\u{1F48E} Rarit\u00E0     ${bar(f.rarita||0,3)}\n`+
                `\u{1F4DC} Storia     ${bar(f.storia||0,3)}\n`+
                `\u{1F3E6} Pavimento  ${bar(f.pavimento||0,1)}\n`+
                `\u{1F4A7} Liquidit\u00E0  ${bar(f.liquidita||0,2)}\n`+
                `\u{1F680} Catalizz.  ${bar(f.catalizzatore||0,4)}\n\n`+
                `\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>`+
                (ai.valueLow?` \u00B7 mercato \u20AC${ai.valueLow.toLocaleString('it-IT')}\u2013\u20AC${(ai.valueHigh||ai.valueLow).toLocaleString('it-IT')}`:'')+`\n`+
                (fvHigh?`\u{1F4C8} <b>Stima 3-5 anni: \u20AC${fvLow.toLocaleString('it-IT')}\u2013\u20AC${fvHigh.toLocaleString('it-IT')}</b>${upsidePct>0?` (+${upsidePct}% sul prezzo)`:''}\n`:'')+
                soldLine+
                ((()=>{ try { return dealEngine.buildInsightLines({ brand:ai.brand, model:ai.model, priceEur, marginEur:ai.marginEur, evRating:ai.evRating, sleeperTier:ai.sleeperTier }).lines || ''; } catch { return ''; } })())+
                `\n\u{1F9E0} ${ai.investmentReasons||ai.reasoning||'Fondamentali solidi: motore nobile, marchio in salita, originale.'}\n`+
                `\u{1F4A1} <b>Tesi:</b> non \u00E8 un flip-margine, \u00E8 un pezzo da TENERE. Il downside \u00E8 protetto, l'upside arriva col catalizzatore (rilancio marchio, riedizione, asta, anniversario). Accumula e holda finch\u00E9 i fondamentali reggono.\n\n`+
                `<a href=\"${item.url}\">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
                feedbackLinks(ai.brand, item.url, item.title, priceEur)
              );
              try { if (ai.brand && ai.model && ai.brand!=='?' && ai.model!=='?') priceTracker.record(ai.brand, ai.model, priceEur); } catch {}
              try { if (ai.brand && ai.brand!=='?') catalystTracking.recordPrice(ai.brand, priceEur); } catch {}
              continue;
            }

            // ── CANALE "📚 DA STUDIARE": marchio Enciclopedia, prezzo ≤ valore,
            //    ma NON un affare vero. Messaggio educativo, niente "COMPRA". ──
            if (ai.studyPick && !ai.isRealDeal) {
              foundStudy++;
              const bw = watchlistHit(ai.brand);
              const stars = '\u2B50'.repeat(Math.min(Math.round((ai.desirability||0)/2),5));
              await tg(
                `\u{1F4DA} <b>DA STUDIARE \u2014 marchio della tua Enciclopedia</b>\n\n`+
                `\u231A ${item.title?.slice(0,65)}\n`+
                (ai.brand?`\u{1F527} <b>${ai.brand}${ai.model&&ai.model!=='null'?' '+ai.model:''}</b>\n`:'')+
                (ai.caliber&&ai.caliber!=='null'?`\u2699\uFE0F ${ai.caliber}${ai.qualityMovement?' \u2728':''}\n`:'')+
                (bw?`\u{1F4CC} <b>In watchlist:</b> ${bw.note}${bw.maxBuy?` (max \u20AC${bw.maxBuy})`:''}\n`:'')+
                `\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>`+
                (ai.valueLow?` \u00B7 mercato \u20AC${ai.valueLow.toLocaleString('it-IT')}\u2013\u20AC${(ai.valueHigh||ai.valueLow).toLocaleString('it-IT')}`:'')+`\n`+
                (ai.evRating?`\u{1F4CA} Potenziale 3-5 anni: <b>${ai.evRating==='high'?'ALTO \u{1F525}':ai.evRating==='medium'?'medio':'basso'}</b>\n`:'')+
                (stars?`${stars} Desiderabilita ${ai.desirability}/10\n`:'')+
                `\n\u{1F4A1} Non \u00E8 un affare-flip: prezzo in linea col mercato. Te lo mostro per studiarlo \u2014 calibro, varianti, quotazioni. ${ai.investmentReasons||ai.reasoning||''}\n\n`+
                `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
                feedbackLinks(ai.brand, item.url, item.title, priceEur)
              );
              // Registro comunque nello storico prezzi (serve al tracker)
              try { if (ai.brand && ai.model && ai.brand!=='?' && ai.model!=='?') priceTracker.record(ai.brand, ai.model, priceEur); } catch {}
              try { if (ai.brand && ai.brand!=='?') catalystTracking.recordPrice(ai.brand, priceEur); } catch {}
              continue;
            }

            foundVintage++;

            // ── INVESTITORE: storico prezzi, dip/picco, vendita portafoglio ──
            try {
              if (ai.brand && ai.model && ai.brand !== '?' && ai.model !== '?') {
                const sells = priceTracker.checkPortfolioSell(ai.brand, ai.model);
                if (sells && sells.length) {
                  for (const s of sells) {
                    await tg(
                      `\u{1F4B0}\u{1F4C8} <b>VENDI \u2014 un tuo pezzo \u00E8 salito!</b>\n\n`+
                      `\u231A <b>${s.brand} ${s.model}</b>\n`+
                      `\u{1F6D2} Comprato a: <b>\u20AC${s.buyPrice.toLocaleString('it-IT')}</b>${s.buyDate?` (${String(s.buyDate).slice(0,10)})`:''}\n`+
                      `\u{1F4CA} Ora il mercato sta a: <b>\u20AC${s.nowMed.toLocaleString('it-IT')}</b>\n`+
                      `\u{1F4C8} Plusvalenza: <b>+${s.gainPct}%</b> = ~\u20AC${s.gainEur.toLocaleString('it-IT')}\n\n`+
                      `\u{1F9E0} Come un'azione che ha corso: valuta se REALIZZARE o continuare a holdare. Fondamentali forti = puoi tenere; corsa da hype = incassa.\n`
                    );
                  }
                }
                const sig = priceTracker.record(ai.brand, ai.model, priceEur);
                try { if (ai.brand && ai.brand!=='?') catalystTracking.recordPrice(ai.brand, priceEur); } catch {}
                try { dealEngine.recordPrice(ai.brand, ai.model, priceEur); } catch {}
                if (sig && sig.fireAlert && sig.status === 'dip') {
                  const c = priceTracker.chartFor(sig.brand, sig.model);
                  await tg(
                    `\u{1F4C9}\u{1F525} <b>DIP DA COMPRARE \u2014 modello sotto del ${Math.abs(sig.changePct)}%</b>\n\n`+
                    `\u231A <b>${sig.brand} ${sig.model}</b>\n`+
                    (c ? `<code>${c.spark}</code> \u2B07\uFE0F\n` : '')+
                    `\u{1F4CA} Storico: <b>\u20AC${sig.baseMed.toLocaleString('it-IT')}</b> \u2192 ora: <b>\u20AC${sig.recentMed.toLocaleString('it-IT')}</b> (${sig.changePct}%)\n\n`+
                    `\u{1F9E0} <b>Da investitore:</b> modello di qualit\u00E0 in saldo. Se i fondamentali tengono, \u00E8 il momento di ACCUMULARE e holdare.\n`+
                    `\u26A0\uFE0F Verifica che il calo sia di mercato, non un singolo pezzo scadente.\n\n`+
                    `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n`
                  );
                }
                if (sig && sig.fireAlert && sig.status === 'peak') {
                  const c = priceTracker.chartFor(sig.brand, sig.model);
                  await tg(
                    `\u{1F4C8}\u{1F525} <b>MODELLO IN CORSA \u2014 su del ${sig.changePct}%</b>\n\n`+
                    `\u231A <b>${sig.brand} ${sig.model}</b>\n`+
                    (c ? `<code>${c.spark}</code> \u2B06\uFE0F\n` : '')+
                    `\u{1F4CA} Storico: <b>\u20AC${sig.baseMed.toLocaleString('it-IT')}</b> \u2192 ora: <b>\u20AC${sig.recentMed.toLocaleString('it-IT')}</b>\n\n`+
                    `\u{1F9E0} Se ce l'hai, \u00E8 il momento di vendere. Se non ce l'hai, comprare ora = entrare dopo la corsa.\n`
                  );
                }
              }
            } catch (e) { console.error('[TRACKER]', e.message); }

            db.vintageDeals.push({ id:nid(), platform:item.platform, title:item.title, price:priceEur, brand:ai.brand||'?', model:ai.model||'?', caliber:ai.caliber||'?', valueLow:ai.valueLow||0, valueHigh:ai.valueHigh||0, discountVsLow:ai.discountVsLow||0, desirability:ai.desirability||0, grail:ai.isGrail||false, sleeper:ai.isSleeper||false, url:item.url, location:item.location||'', source:'claude', foundAt:new Date().toISOString() });

            const grailTag = ai.isGrail ? '\u{1F451} GRAIL ' : '';
            const sleeperTag = (ai.isSleeper && !ai.isGrail) ? '\u{1F48E} SOTTOVALUTATO ' : '';
            const stars = '\u2B50'.repeat(Math.min(Math.round((ai.desirability||0)/2),5));
            const confLabel = ai.confidence==='high'?'\u2705 identificazione sicura':ai.confidence==='medium'?'\u{1F7E1} identificazione probabile':'\u26A0\uFE0F identificazione incerta';
            const photoLabel = ai.sawImage ? '\u{1F4F8} foto analizzata' : '\u{1F4DD} giudizio su titolo + dati annuncio';
            const strengthEmoji = ai.dealStrength==='FORTE'?'\u{1F525}\u{1F525}\u{1F525}':ai.dealStrength==='BUONO'?'\u{1F525}\u{1F525}':'\u{1F525}';
            const fvLow = ai.futureValueLow || 0, fvHigh = ai.futureValueHigh || 0;
            // Watchlist marchio-azienda (Czapek & co.): aggiunge contesto da investitore
            const bw = watchlistHit(ai.brand);
            let verdetto;
            if ((ai.marginEur||0) >= 150 && (ai.discountVsLow||0) >= 20) {
              verdetto = `\u{1F4B8} <b>COMPRA E RIVENDI ORA</b>\n   Paga ~\u20AC${priceEur.toLocaleString('it-IT')} \u2192 rivendi ~\u20AC${(ai.valueLow||0).toLocaleString('it-IT')} \u2192 guadagno ~\u20AC${(ai.marginEur||0).toLocaleString('it-IT')}`;
            } else if (ai.evRating === 'high' && fvHigh > priceEur) {
              verdetto = `\u{1F4C8} <b>COMPRA E TIENI (3-5 anni)</b>\n   Paga ~\u20AC${priceEur.toLocaleString('it-IT')} \u2192 tra 3-5 anni stima \u20AC${fvLow.toLocaleString('it-IT')}\u2013\u20AC${fvHigh.toLocaleString('it-IT')}`;
            } else if (ai.doubleSigned || ai.specialDial) {
              verdetto = `\u{1F50E} <b>PEZZO PARTICOLARE</b> \u2014 raro/ricercato, valuta bene`;
            } else {
              verdetto = `\u{1F4B0} <b>BUON ACQUISTO</b>\n   Paga ~\u20AC${priceEur.toLocaleString('it-IT')}, sotto il valore di mercato (~\u20AC${(ai.valueLow||0).toLocaleString('it-IT')})`;
            }
            await tg(
              `\u{1F916} ${grailTag}${sleeperTag}<b>AFFARE ${ai.dealStrength||''}${ai.discountVsLow>0?' \u2212'+ai.discountVsLow+'%':''} ${strengthEmoji}</b>\n\n`+
              `${verdetto}\n\n\u231A ${item.title?.slice(0,65)}\n`+
              (ai.brand?`\u{1F527} <b>${ai.brand}${ai.model&&ai.model!=='null'?' '+ai.model:''}</b>\n`:'')+
              (ai.caliber&&ai.caliber!=='null'?`\u2699\uFE0F ${ai.caliber}${ai.qualityMovement?' \u2728':''}\n`:'')+
              (caliberDb.caliberLine(item.title)?caliberDb.caliberLine(item.title)+'\n':'')+
                (longines.longinesLine(item.title)?longines.longinesLine(item.title)+'\n':'')+
              (bw?`\u{1F4C8} <b>In watchlist:</b> ${bw.note}${bw.maxBuy?` (max \u20AC${bw.maxBuy})`:''}\n`:'')+
              (ai.doubleSigned?`\u270D\uFE0F <b>DOPPIA FIRMA: ${ai.doubleSigned}</b>\n`:'')+
              (ai.specialDial?`\u{1F3A8} <b>Quadrante speciale:</b> ${ai.specialDial}\n`:'')+
              (ai.material&&ai.material!=='sconosciuto'?`\u{1FA99} ${ai.material}\n`:'')+
              (ai.condition&&ai.condition!=='null'?`\u{1F50D} Condizioni: ${ai.condition}\n`:'')+
              (ai.working===false?`\u{1F527} <b>NON funzionante / da revisionare</b>\n`:'')+
              (ai.sellerClueless?`\u{1F3AF} <b>Il venditore sembra non sapere cosa ha!</b>\n`:'')+
              ((ai.sleeperTier||0)>=3?`\u{1F48E} Tesoro raro per intenditori (tier ${ai.sleeperTier})\n`:'')+
              `\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
              (ai.valueLow?`\u{1F4CA} Di solito si vende: <b>\u20AC${ai.valueLow.toLocaleString('it-IT')}\u2013\u20AC${(ai.valueHigh||ai.valueLow).toLocaleString('it-IT')}</b>\n`:'')+
              (ai.discountVsLow>0?`\u{1F4C9} <b>\u2212${ai.discountVsLow}% sotto la stima</b>\n`:'')+
              (ai.marginEur>0?`\u{1F4B5} Margine potenziale: <b>~\u20AC${ai.marginEur.toLocaleString('it-IT')}</b>\n`:'')+
              (ai.evRating?(()=>{ const ico = ai.futureOutlook==='rising'?'\u{1F4C8}':ai.futureOutlook==='declining'?'\u{1F4C9}':'\u27A1\uFE0F'; const ev = ai.evRating==='high'?'ALTO \u{1F525}':ai.evRating==='medium'?'medio':'basso'; let s = `\n\u{1F4CA} <b>POTENZIALE 3-5 ANNI: ${ev}</b> ${ico}\n`; if(ai.futureValueLow) s += `   Stima futura: <b>\u20AC${ai.futureValueLow.toLocaleString('it-IT')}\u2013\u20AC${(ai.futureValueHigh||ai.futureValueLow).toLocaleString('it-IT')}</b>\n`; if(ai.investmentReasons) s += `   ${ai.investmentReasons}\n`; return s; })():'')+
              (stars?`${stars} Desiderabilita ${ai.desirability}/10\n`:'')+
              (ai.marketCycleLine?`${ai.marketCycleLine}\n`:'')+
              // ── DEAL ENGINE: ROI/velocita rivendita (1), FLIP vs TESORO (3), sottoprezzo relativo (2) ──
              (()=>{ try { return dealEngine.buildInsightLines({ brand:ai.brand, model:ai.model, priceEur, marginEur:ai.marginEur, evRating:ai.evRating, sleeperTier:ai.sleeperTier }).lines || ''; } catch { return ''; } })()+
              // ── Riga GEO (solo info, mai spinta a comprare): dove si rivende meglio ──
              ((ai.strongMarket && ai.strongMarket!=='null' && ai.strongMarket!=='internazionale')?(()=>{
                const flags={italia:'\u{1F1EE}\u{1F1F9}',germania:'\u{1F1E9}\u{1F1EA}',francia:'\u{1F1EB}\u{1F1F7}',usa:'\u{1F1FA}\u{1F1F8}','stati uniti':'\u{1F1FA}\u{1F1F8}',giappone:'\u{1F1EF}\u{1F1F5}',svizzera:'\u{1F1E8}\u{1F1ED}','regno unito':'\u{1F1EC}\u{1F1E7}',uk:'\u{1F1EC}\u{1F1E7}'};
                const fl=flags[String(ai.strongMarket).toLowerCase().trim()]||'\u{1F30D}';
                const edge=(ai.geoEdgePct&&ai.geoEdgePct>=5)?` (~+${ai.geoEdgePct}%)`:'';
                return `\u{1F30D} <i>Si rivende meglio in ${fl} ${ai.strongMarket}${edge}${ai.geoNote&&ai.geoNote!=='null'?' \u2014 '+ai.geoNote:''}</i>\n`;
              })():'')+
              `${confLabel}\n${photoLabel}\n`+
              (ai.redFlags&&ai.redFlags!=='null'?`\u{1F6A9} <b>Attenzione:</b> ${ai.redFlags}\n`:'')+
              `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
              `\u{1F4A1} ${ai.reasoning||''}\n\n`+
              `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
              feedbackLinks(ai.brand, item.url, item.title, priceEur)
            );
            continue;
          }
          seenUrls.add(nu);
          continue;
        }

        // ── FALLBACK: DB locale (solo se Claude non configurato) ──
        if (vintage && vintage.isDeal && !seenUrls.has(nu)) {
          seenUrls.add(nu); markAlerted(fp); saveState();
          foundVintage++;
          try { priceTracker.record(vintage.brand, vintage.model, priceEur); } catch {}
          try { if (vintage.brand) catalystTracking.recordPrice(vintage.brand, priceEur); } catch {}
          db.vintageDeals.push({ id:nid(), platform:item.platform, title:item.title, price:priceEur, brand:vintage.brand, model:vintage.model, caliber:vintage.caliber, valueLow:vintage.valueLow, valueHigh:vintage.valueHigh, discountVsLow:vintage.discountVsLow, desirability:vintage.desirability, grail:vintage.grail, url:item.url, location:item.location||'', foundAt:new Date().toISOString() });
          const grailTag = vintage.grail ? '\u{1F451} GRAIL ' : '';
          const stars = '\u2B50'.repeat(Math.min(Math.round(vintage.desirability/2),5));
          await tg(
            `\u{1F3FA} <b>${grailTag}OCCASIONE VINTAGE</b>\n\n\u231A ${item.title?.slice(0,65)}\n`+
            `\u{1F527} <b>${vintage.brand} ${vintage.model}</b>\n\u2699\uFE0F ${vintage.caliber} \u00B7 ${vintage.years}\n`+
            `\u{1FA99} ${vintage.material}\n\u{1F4B0} Prezzo: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>\n`+
            `\u{1F4CA} Di solito si vende: <b>\u20AC${vintage.valueLow.toLocaleString('it-IT')}\u2013\u20AC${vintage.valueHigh.toLocaleString('it-IT')}</b>\n`+
            (vintage.discountVsLow>0?`\u{1F4C9} <b>\u2212${vintage.discountVsLow}% sotto il minimo</b>\n`:'')+
            `${stars} Desiderabilita ${vintage.desirability}/10\n`+
            `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
            `\u{1F4A1} ${vintage.note}\n\n`+
            `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n\n\u2796\u2796\u2796\n`+
            feedbackLinks(vintage.brand, item.url, item.title, priceEur)
          );
          continue;
        }
      }
      all = null;
      if (global.gc) { try { global.gc(); } catch {} }
    } catch(e) { console.error(`[SCAN] ${rawQuery}:`,e.message); }
  }

  if (db.arbitrage.length>500) db.arbitrage=db.arbitrage.slice(-500);
  if (db.nearArbitrage.length>500) db.nearArbitrage=db.nearArbitrage.slice(-500);
  if (db.vintageDeals.length>500) db.vintageDeals=db.vintageDeals.slice(-500);

  console.log(`[SCAN] Fine: ${foundArb} arbitraggi, ${foundNear} trattabili, ${foundVintage} vintage, ${foundInvestor} investitore, ${foundStudy} da studiare, ${foundGrezzo} flip grezzo`);
  // ── RIEPILOGO AUTO-DIAGNOSTICO (v12.26): il messaggio dice DA SOLO dove
  //    muoiono i segnali (funnel del giorno + stato motori AI) e mostra i 3
  //    migliori candidati visti, anche sotto soglia. "Tutto 0" senza contesto
  //    non esiste più. ──
  let statoTxt = '';
  try {
    const st = require('./visionEngine').getStats() || {};
    statoTxt = `\n🔬 Oggi: <b>${FUNNEL.analizzatiAI}</b> analizzati AI · <b>${FUNNEL.aiInteressante}</b> promossi · <b>${FUNNEL.aiNonInteressante}</b> bocciati · <b>${FUNNEL.aiSenzaRisposta}</b> senza risposta\n⚙️ Motori: gemini ${st.geminiOk||0}✓/${st.geminiFail||0}✗ · groq ${st.groqOk||0}✓/${st.groqFail||0}✗ · haiku ${st.haikuOk||0}✓/${st.haikuFail||0}✗ · sonnet ${st.claudeOk||0}✓/${st.claudeFail||0}✗\n`;
    const _errs = ['claude','haiku','groq','gemini'].map(k => st['lastErr_'+k] ? `${k}: ${st['lastErr_'+k]}` : null).filter(Boolean).slice(0, 2);
    if (_errs.length) statoTxt += `⚠️ Ultimo errore — ${_errs.join(' · ')}\n`;
  } catch {}
  let bestTxt = '';
  try {
    const top = cycleBest.filter(x => x.low > 0)
      .map(x => ({ ...x, d: Math.round(((x.low - x.p) / x.low) * 100) }))
      .sort((a, b) => b.d - a.d).slice(0, 3);
    if (top.length) bestTxt = '\n🔭 <b>Migliori del giro</b> (anche sotto soglia):\n' +
      top.map(x => `• ${x.d >= 0 ? `${x.d}% sotto stima` : `${-x.d}% sopra stima`} — ${x.t} — €${x.p.toLocaleString('it-IT')} <a href="${x.url}">vedi</a>`).join('\n') + '\n';
  } catch {}
  await tg(
    `📊 <b>Scansione completata</b>\n\n🥇 Oro: €${gold.toFixed(2)}/g | 🔘 Platino: €${platinum.toFixed(2)}/g\n\n`+
    `🥇 Arbitraggi metallo: <b>${foundArb}</b>\n💛 Trattabili: <b>${foundNear}</b>\n🏺 Occasioni vintage: <b>${foundVintage}</b>\n📈 Investitore (accumula): <b>${foundInvestor}</b>\n📚 Da studiare: <b>${foundStudy}</b>\n🔧 Flip grezzo: <b>${foundGrezzo}</b>\n`+
    statoTxt + bestTxt +
    (foundArb===0&&foundNear===0&&foundVintage===0&&foundInvestor===0&&foundStudy===0&&!bestTxt?'\nNessuna opportunità in questo ciclo.':'')
  );
  return {foundArb, foundNear, foundVintage, foundInvestor, foundStudy};
}

// ══════════════ OSSERVATI: riavvisa quando un pezzo seguito scende ══════════════
// Leonardo registra un pezzo scartato per prezzo con una soglia che decide LUI.
// Quando ricompare (stesso URL, o stesso marchio+modello) a un prezzo ≤ soglia,
// il bot lo riavvisa. Default: nessuna soglia automatica (la imposti a mano).
function normTxt(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
async function checkObservedMatch(item, priceEur) {
  if (!db.observed.length) return;
  const titleN = normTxt(item.title);
  for (const obs of db.observed) {
    if (!obs.active) continue;
    // SOGLIA: se l'hai messa a mano uso quella; altrimenti AUTOMATICA a -20%
    // dal prezzo a cui ho visto il pezzo la prima volta.
    const auto = obs.seenPrice ? Math.round(obs.seenPrice * 0.80) : null;
    const soglia = obs.threshold || auto;
    if (!soglia) continue; // niente prezzo di riferimento: non posso calcolare
    // match per URL identico, oppure per marchio presente nel titolo
    const sameUrl = obs.url && item.url && normUrl(obs.url) === normUrl(item.url);
    const brandHit = obs.brand && titleN.includes(normTxt(obs.brand));
    if (!sameUrl && !brandHit) continue;
    if (priceEur > soglia) continue;
    const recent = (obs.firedUrls||[]).find(f => f.url===item.url && Date.now()-new Date(f.at).getTime() < 24*3600000);
    if (recent) continue;
    obs.firedUrls = obs.firedUrls || [];
    obs.firedUrls.push({ url:item.url, at:new Date().toISOString() });
    if (obs.firedUrls.length>50) obs.firedUrls = obs.firedUrls.slice(-50);
    saveState();
    const calo = obs.seenPrice ? Math.round((1 - priceEur/obs.seenPrice)*100) : null;
    const tipoSoglia = obs.threshold ? `\u{1F3AF} Tua soglia: <b>\u20AC${Number(obs.threshold).toLocaleString('it-IT')}</b>` : `\u{1F4C9} Soglia automatica \u221220%: <b>\u20AC${soglia.toLocaleString('it-IT')}</b>`;
    await tg(
      `\u{1F441}\uFE0F\u{1F4C9} <b>OSSERVATO SCESO!</b>\n\n`+
      `Stavi tenendo d'occhio: <b>${obs.brand||obs.label||'pezzo'}</b>\n`+
      (obs.seenPrice?`\u{1F453} Visto a: \u20AC${obs.seenPrice.toLocaleString('it-IT')}\n`:'')+
      `${tipoSoglia}\n`+
      `\u231A ${item.title?.slice(0,65)}\n`+
      `\u{1F4B0} Ora chiede: <b>\u20AC${priceEur.toLocaleString('it-IT')}</b>`+(calo!=null?` (\u2212${calo}%)`:'')+`\n`+
      `\u{1F3EA} ${item.platform}${item.location?` \u00B7 \u{1F4CD} ${item.location}`:''}\n\n`+
      `<a href="${item.url}">\u{1F449} VEDI ANNUNCIO</a>\n`
    );
  }
}

// ══════════════ DISCOVERY ══════════════
async function runDiscoveryScan() {
  console.log('\n[DISCOVERY] Analisi brand...');
  try {
    const results = await scanAllBrands();
    db.discoveries = results;
    for (const analysis of results) {
      const {brand, emergingScore} = analysis;
      const prev = db.discoveryAlerts.find(a=>a.brandName===brand.name);
      const prevScore = prev?.score||0;
      if (emergingScore.score>=65&&(emergingScore.score-prevScore>=10||!prev)) {
        if (prev) prev.score=emergingScore.score;
        else db.discoveryAlerts.push({brandName:brand.name,score:emergingScore.score,tier:brand.tier,at:new Date().toISOString()});
        const te = {1:'⚪',2:'🟡',3:'🟢',4:'🔵'}[brand.tier]||'⚪';
        await tg(
          `🔭 <b>DISCOVERY ALERT</b>\n\n${te} <b>${brand.name}</b> — Tier ${brand.tier} (${brand.country})\n`+
          `📊 Emerging Score: <b>${emergingScore.score}/100</b>\n⏳ ${emergingScore.windowLabel}\n\n`+
          `🔑 ${emergingScore.keySignal}\n\n💡 ${emergingScore.thesis}\n\n`+
          `Reddit: ${analysis.signals?.reddit?.monthPosts||0} post/mese · YouTube: ${analysis.signals?.youtube?.totalVideos||0} video · Hodinkee: ${analysis.signals?.hodinkee?.hasArticle?'✅':'❌'}`
        );
      }
    }
    return results;
  } catch(e) { console.error('[DISCOVERY]',e.message); return []; }
}

// ══════════════ API ROUTES ══════════════
app.get('/api/versione', (req, res) => res.json({ versione: '12.21', mercati: ['eBay','Subito','Vinted','Chrono24','Catawiki','Leboncoin','Wallapop','Ricardo','Marktplaats','OLX.pl','OLX.ro','Allegro.pl','Sprzedajemy.pl','Okazii.ro','MercadoLibre MX','MercadoLibre BR'] }));

app.get('/api/diagnostica', async (req, res) => {
  const q = (req.query.q || 'omega').toString();
  const fonti = {
    'eBay (tutti)': searchEbayAllCountries,
    'Subito': searchSubito,
    'Vinted': searchVinted,
    'Chrono24': searchChrono24RSS,
    'Catawiki': searchCatawiki,
    'Leboncoin': searchLeboncoin,
    'Wallapop': searchWallapop,
    'Ricardo.ch': searchRicardo,
    'Marktplaats': searchMarktplaats,
    'OLX.pl': searchOlxPl,
    'OLX.ro': searchOlxRo,
    'Allegro.pl': searchAllegroPl,
    'Sprzedajemy.pl': searchSprzedajemyPl,
    'Okazii.ro': searchOkaziiRo,
    'MercadoLibre MX': searchMercadoLibreMX,
    'MercadoLibre BR': searchMercadoLibreBR,
  };
  const out = {};
  for (const [nome, fn] of Object.entries(fonti)) {
    try {
      const t0 = Date.now();
      const r = await fn(q);
      out[nome] = { ok:true, risultati: Array.isArray(r)?r.length:0, ms: Date.now()-t0,
        esempio: (Array.isArray(r)&&r[0]) ? { titolo:r[0].title?.slice(0,50), prezzo:r[0].price } : null };
    } catch (e) { out[nome] = { ok:false, errore: e.response?.status||e.code||e.message }; }
  }
  out._ebayApiConfigurata = !!process.env.EBAY_CLIENT_ID;
  out._serpApiConfigurata = !!process.env.SERPAPI_KEY;
  // stato prezzi metalli (live o fallback?)
  try {
    const m = await fetchMetalsSpot();
    out._metalli = { live: metalsLive, oro: Math.round(m.gold*100)/100,
      platino: Math.round(m.platinum*100)/100, palladio: Math.round(m.palladium*100)/100 };
  } catch (e) { out._metalli = { errore: e.message }; }
  out._query = q;
  // ── AUTODIAGNOSI v12.10: dice subito se le ultime novità sono ONLINE ──
  out._versione = '12.28';
  out._src_health = SRC_HEALTH;
  out._funnel = FUNNEL;
  out._nuovi_mercati = {
    olx_pl: typeof searchOlxPl === 'function',
    olx_ro: typeof searchOlxRo === 'function',
    allegro_pl: typeof searchAllegroPl === 'function',
    allegro_credenziali: !!(process.env.ALLEGRO_CLIENT_ID && process.env.ALLEGRO_CLIENT_SECRET) || !!process.env.ALLEGRO_TOKEN,
    sprzedajemy_pl: typeof searchSprzedajemyPl === 'function',
    okazii_ro: typeof searchOkaziiRo === 'function',
    mercadolibre_mx: typeof searchMercadoLibreMX === 'function',
    mercadolibre_br: typeof searchMercadoLibreBR === 'function',
    valute_supportate: Object.keys(fx),
  };
  out._novita = {
    filtro_non_orologio: typeof looksLikeNotAWatch === 'function',
    filtro_quadri_pubblicita: (typeof looksLikeNotAWatch==='function') && looksLikeNotAWatch('Quadro pubblicitario Eberhard orologi') === true,
    canale_investitore: typeof soldComps === 'object',
    radar_marchi: !!(trademarkRadar && trademarkRadar.checkAll),
    venduti_reali_serpapi: !!process.env.SERPAPI_KEY,
    venduti_negli_alert: !!process.env.SOLD_COMPS_ON,
    radar_token_apify: !!process.env.APIFY_TOKEN,
  };
  // Prova al volo il filtro sui falsi annunci tipici
  out._test_filtro = {
    'Quadro pubblicitario Eberhard': looksLikeNotAWatch('Quadro pubblicitario Eberhard'),
    'Orologio da parete Eberhard': looksLikeNotAWatch('Orologio da parete Eberhard'),
    'Cartier zonnebril': looksLikeNotAWatch('Cartier Santos zonnebril'),
    'Eberhard schilderij/dipinto (deve dare true)': looksLikeNotAWatch('Hein Eberhard 1874-1973 Kunst Schilderijen olieverfschilderij'),
    'Eberhard Chrono 4 31052 (deve restare false)': looksLikeNotAWatch('Eberhard Chrono 4 Grande Taille 31052'),
  };
  // GATE POSITIVO mercati larghi (OLX.pl/.ro, Allegro...): i falsi positivi
  // reali devono dare hasWatchSignal=false; i veri orologi true.
  out._test_gate_positivo = {
    'Słuchawki klipsch (cuffie) → false':         hasWatchSignal('Słuchawki klipsch reference on ear'),
    'wieża jvc (stereo) → false':                 hasWatchSignal('zestaw - wieża jvc + kolumny, Vintage Stereo System'),
    'Manometry VALUE (manometri) → false':        hasWatchSignal('Manometry VALUE VMG-2-R32 do klimatyzacji walizka'),
    'Wieza JVC glosnikami (stereo) → false':      hasWatchSignal('Wieza JVC z glosnikami'),
    'Zegarek Omega Seamaster → true':             hasWatchSignal('Zegarek Omega Seamaster automatik złoto'),
    'UG Polerouter microrotor → true':            hasWatchSignal('Universal Geneve Polerouter microrotor'),
    'Ceas Rolex Datejust (RO) → true':            hasWatchSignal('Ceas Rolex Datejust aur 18k'),
    'Mido Ocean Star (marca corta) → true':       hasWatchSignal('Mido Ocean Star automatic'),
    'colorado/rado substring → false':            hasWatchSignal('Lampa LED colorado bardzo jasna'),
  };
  // Prova al volo il filtro ORO: la ghiera/bicolore/cappato NON deve dare oro
  out._test_oro = {
    'ghiera in oro (deve dare null)': detectMetal('Omega ghiera in oro 18k acciaio'),
    'bicolore acciaio/oro (null)': detectMetal('Rolex two-tone acciaio oro 18k'),
    'cappato/placcato (null)': detectMetal('cronografo placcato oro 20 micron'),
    'oro 18k massiccio (deve dare 18k)': detectMetal('Patek oro 18k massiccio 750'),
  };
  res.json(out);
});

// Sonda eBay: isola il token OAuth e UNA chiamata Browse, ed espone l'errore
// ESATTO di eBay (qui niente catch silenzioso). Apri: /api/ebay/test?q=omega
app.get('/api/ebay/test', async (req, res) => {
  const q = (req.query.q || 'omega').toString();
  const out = {
    EBAY_CLIENT_ID_presente: !!process.env.EBAY_CLIENT_ID,
    EBAY_CLIENT_SECRET_presente: !!process.env.EBAY_CLIENT_SECRET,
    appId_inizia_con: (process.env.EBAY_CLIENT_ID||'').slice(0,20) || null,
  };
  ebayToken = null; ebayExp = 0; ebayLastError = null;            // forza un token nuovo
  const token = await getEbayToken();
  out.token_ok = !!token;
  if (!token) { out.token_errore = ebayLastError; return res.json(out); }
  out.token_anteprima = String(token).slice(0,16) + '…';
  try {
    const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      params:{ q, category_ids:'31387', sort:'price', limit:5, filter:'price:[200..],priceCurrency:EUR' },
      headers:{ Authorization:`Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID':'EBAY_IT' }, timeout:12000
    });
    out.ricerca_ok = true;
    out.totale_eBay_IT = r.data.total;
    out.ricevuti = (r.data.itemSummaries||[]).length;
    out.esempi = (r.data.itemSummaries||[]).slice(0,3).map(i=>({ titolo:i.title?.slice(0,60), prezzo:i.price?.value, valuta:i.price?.currency }));
  } catch (e) {
    out.ricerca_ok = false;
    out.ricerca_status = e.response?.status;
    out.ricerca_errore = e.response?.data || e.message;
  }
  res.json(out);
});

app.get('/api/search', async(req,res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({error:'?q= richiesto'});
  const cached=getCached(q); if(cached) return res.json({...cached,fromCache:true});
  try { const d=await searchAll(q); setCache(q,d); res.json(d); }
  catch(e) { res.status(500).json({error:e.message}); }
});
app.get('/api/metals', async(req,res) => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  res.json({gold:gold?Math.round(gold*100)/100:null,platinum:platinum?Math.round(platinum*100)/100:null,goldPerOz:gold?Math.round(gold*31.1035):null,platinumPerOz:platinum?Math.round(platinum*31.1035):null,goldHistory:db.goldPrices.slice(-48).reverse(),platinumHistory:db.platinumPrices.slice(-48).reverse()});
});
app.get('/api/gold-price', async(req,res) => {
  const p=await getGoldPrice().catch(()=>null);
  const pt=await getPlatinumPrice().catch(()=>null);
  const pd=await getPalladiumPrice().catch(()=>null);
  res.json({oro:p?Math.round(p*100)/100:null,platino:pt?Math.round(pt*100)/100:null,palladio:pd?Math.round(pd*100)/100:null,pricePerGram:p?Math.round(p*100)/100:null,history:db.goldPrices.slice(-48).reverse()});
});

app.get('/api/oro', async(req,res) => {
  const live = await getGoldPrice().catch(()=>null);
  const livePt = await getPlatinumPrice().catch(()=>null);
  const livePd = await getPalladiumPrice().catch(()=>null);
  const goldFine = live ? Math.round(live*100)/100 : 95;
  const ptFine = livePt ? Math.round(livePt*100)/100 : 38;
  const pdFine = livePd ? Math.round(livePd*100)/100 : 43;
  res.send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Calcolatore Oro</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#11161f;color:#f3f1ea;margin:0;padding:22px;line-height:1.5}.card{max-width:560px;margin:0 auto}h1{font-size:21px;margin:0 0 4px}.live{color:#e8b923;font-weight:700;margin:0 0 18px;font-size:15px}label{display:block;margin:14px 0 5px;font-weight:600;font-size:15px}input,select{width:100%;padding:13px;background:#1b2230;color:#f3f1ea;border:1px solid #3a4456;border-radius:9px;font-size:16px;box-sizing:border-box}button{width:100%;padding:15px;margin-top:18px;border:0;border-radius:10px;font-size:17px;font-weight:700;background:#e8b923;color:#11161f;cursor:pointer}.out{background:#1b2230;border:1px solid #3a4456;border-radius:11px;padding:16px;margin-top:18px;display:none}.big{font-size:26px;font-weight:800;color:#4ccf6a;margin:6px 0}.lab{font-size:13px;color:#9aa3b2;text-transform:uppercase;letter-spacing:.5px}.max{font-size:22px;font-weight:800;color:#e8b923;margin:6px 0}.note{font-size:13px;color:#9aa3b2;margin-top:14px}.hint{font-size:13px;color:#9aa3b2;margin-top:3px}</style></head><body><div class="card">
<h1>🥇 Calcolatore Oro</h1>
<p class="live">Prezzi LIVE oggi:<br>🥇 Oro fino (24k/999) ${goldFine} €/g<br>&nbsp;&nbsp;&nbsp;→ <b>18k (750) = ${Math.round(goldFine*0.750*100)/100} €/g</b> · 14k (585) = ${Math.round(goldFine*0.585*100)/100} €/g<br>⚪ Platino ${ptFine} €/g · ⚫ Palladio ${pdFine} €/g</p>
<label>Peso (grammi)</label><input id="peso" type="number" inputmode="decimal" placeholder="es. 46.18" />
<div class="hint">Se hai solo il peso LORDO, spunta sotto.</div>
<label>Caratura</label><select id="kt"><option value="0.750">18 kt (750)</option><option value="0.585">14 kt (585)</option><option value="0.375">9 kt (375)</option><option value="0.916">22 kt (916)</option><option value="0.999">24 kt (999)</option><option value="0">PLACCATO (vale 0)</option></select>
<label style="margin-top:14px"><input type="checkbox" id="lordo" style="width:auto;margin-right:8px">È peso LORDO (togli ~30%)</label>
<button onclick="calc()">Calcola</button>
<div class="out" id="out"><div class="lab">Valore di fusione (solo oro)</div><div class="big" id="melt">—</div><div class="lab">Offerta MAX consigliata (oro × 0,80)</div><div class="max" id="maxoff">—</div><div class="note" id="note"></div></div>
<p class="note">In asta aggiungi la commissione (21-24%). Compra solo se il totale resta sotto la fusione. Placcato = niente paracadute.</p>
</div><script>var FINE=${goldFine};function calc(){var peso=parseFloat(document.getElementById('peso').value.replace(',','.'));var kt=parseFloat(document.getElementById('kt').value);var lordo=document.getElementById('lordo').checked;if(!peso||peso<=0){alert('Inserisci il peso');return;}var pesoOro=lordo?peso*0.70:peso;var melt=pesoOro*kt*FINE;var out=document.getElementById('out');out.style.display='block';if(kt===0){document.getElementById('melt').textContent='0 € (placcato)';document.getElementById('maxoff').textContent='Solo come orologio';document.getElementById('note').textContent='Placcato: niente valore oro.';return;}var maxoff=melt*0.80;document.getElementById('melt').textContent=Math.round(melt).toLocaleString('it-IT')+' €';document.getElementById('maxoff').textContent='~'+Math.round(maxoff).toLocaleString('it-IT')+' €';var d='Oro netto: '+(Math.round(pesoOro*10)/10)+' g a '+(kt*1000)+'/1000.';if(lordo)d+=' (lordo -30%, stima generosa: chiedi il peso della SOLA cassa)';document.getElementById('note').textContent=d;}</script></body></html>`);
});

// ── TEST MOTORI ON-DEMAND (v12.28): apri /api/test-motori dopo ogni deploy o
//    dubbio → verdetto immediato per ogni motore AI con l'errore ESATTO, più
//    lo stato delle chiavi. Fine dei tentativi al buio. ──
app.get('/api/test-motori', async (req, res) => {
  try {
    const r = await require('./visionEngine').selfTest();
    res.json({
      _versione: '12.28',
      motori: r,
      chiavi: {
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        groq: !!(process.env.GROQ_API_KEY || process.env.GROQ_KEY),
        claude_model_env: process.env.CLAUDE_MODEL || null,
      },
    });
  } catch (e) { res.status(500).json({ errore: e.message }); }
});
app.get('/api/gold-scan',(req,res) => { res.json({message:'Scansione avviata',queries:getGoldQueries().length}); runGoldScan().catch(e=>console.error('[SCAN]',e.message)); });
// Prova manuale della rassegna stampa (force=ignora l'anti-doppione, così la vedi anche se già inviata oggi)
app.get('/api/brief',(req,res) => { res.json({message:'Rassegna stampa avviata, guarda Telegram'}); morningBrief.runMorningBrief({ tg, db, saveState, force:true }).catch(e=>console.error('[BRIEF]',e.message)); });
// Stato di salute: RAM e da quanto è acceso, al volo dal browser (per capire se la memoria sale)
app.get('/api/salute',(req,res) => {
  const mu = process.memoryUsage();
  const mb = (n) => Math.round(n / 1024 / 1024);
  res.json({
    vivo: true,
    accesoDaMinuti: Math.round((Date.now() - _bootTime) / 60000),
    ram: { heapUsedMB: mb(mu.heapUsed), heapTotalMB: mb(mu.heapTotal), rssMB: mb(mu.rss) },
    nota: 'Se rssMB si avvicina a ~512 (tetto Starter) il rischio è memoria esaurita.'
  });
});
app.get('/api/arbitrage',(req,res) => { const all=[...db.arbitrage,...db.nearArbitrage].sort((a,b)=>b.diffPct-a.diffPct); res.json(all.slice(0,200)); });
app.get('/api/arbitrage/real',(req,res) => res.json([...db.arbitrage].sort((a,b)=>b.diffPct-a.diffPct)));
app.get('/api/arbitrage/near',(req,res) => res.json([...db.nearArbitrage].sort((a,b)=>b.diffPct-a.diffPct)));

// ── PORTAFOGLIO: memoria decisioni + P&L ───────────────────────────────────
// Registra: /api/pf/record?stato=comprato&brand=GP&model=Lotto2496&prezzo=400&piattaforma=bidinside&note=quadrante+originale
//   stato = comprato | passato | venduto. costi accessori calcolati in auto per piattaforma (override con &costi=NN)
app.get('/api/pf/record',(req,res) => {
  const q = req.query;
  const it = portfolio.record({
    stato:q.stato, brand:q.brand, model:q.model, prezzo:q.prezzo,
    piattaforma:q.piattaforma, calibro:q.calibro, metallo:q.metallo,
    note:q.note, verdetto:q.verdetto,
    costiManuali: (q.costi!=null && q.costi!=='') ? q.costi : null,
  });
  res.json({ ok:true, registrato:it });
});
// Vendi (calcola P&L): /api/pf/sold?id=pf_xxx&prezzo=650&costi=10
app.get('/api/pf/sold',(req,res) => {
  const it = portfolio.markSold(req.query.id, req.query.prezzo, req.query.costi||0);
  if (!it) return res.status(404).json({ ok:false, error:'id non trovato' });
  res.json({ ok:true, venduto:it });
});
// Elimina: /api/pf/remove?id=pf_xxx
app.get('/api/pf/remove',(req,res) => {
  const ok = portfolio.remove(req.query.id);
  res.json({ ok });
});
// Sintesi JSON
app.get('/api/pf',(req,res) => res.json(portfolio.summary()));
// Report Telegram on-demand
app.get('/api/pf/report',(req,res) => {
  const m = portfolio.telegramReport();
  if (m) tg(m).catch(e=>console.error('[PF-REPORT]',e.message));
  res.json({ ok:true, inviato: !!m });
});

// ── EFFETTO CATALIZZATORI: storico brand + reazione prezzi alla news ────────
app.get('/api/catalyst-tracking',(req,res) => res.json(catalystTracking.summary()));
app.get('/api/catalyst-tracking/measure',(req,res) => { const n = catalystTracking.measureAll(); res.json({ ok:true, finestreAggiornate:n }); });
app.get('/api/catalyst-tracking/report',(req,res) => {
  const m = catalystTracking.telegramReport(10);
  if (m) tg(m).catch(e=>console.error('[CAT-TRACK-REPORT]',e.message));
  res.json({ ok:true, inviato: !!m });
});
// Registrazione manuale evento (es. catalizzatore noto a mano):
// /api/catalyst-tracking/event?brand=Universal+Geneve&type=relaunch&title=UG+2026
app.get('/api/catalyst-tracking/event',(req,res) => {
  const ev = catalystTracking.recordEvent({ brand:req.query.brand, type:req.query.type||'manual', title:req.query.title });
  res.json({ ok:!!ev, evento:ev });
});
app.get('/api/discovery/scan',(req,res) => { res.json({message:'Analisi avviata',brands:SEED_BRANDS.length}); runDiscoveryScan().catch(()=>{}); });
app.get('/api/flip-cieco',(req,res) => { res.json({message:'Flip cieco avviato',tetto:genericQueries.FLIP_CIECO_MAX,vision_model:blindHunter.GROQ_VISION_MODEL}); runFlipCiecoScan().catch(e=>console.error('[FLIP CIECO]',e.message)); });
app.get('/api/discovery',(req,res) => { if (db.discoveries.length>0) return res.json(db.discoveries); res.json(SEED_BRANDS.map(b=>({brand:b,emergingScore:{score:0,windowLabel:'— Avvia analisi',thesis:'Clicca Avvia Analisi.',keySignal:'—',breakdown:{}},signals:{},analyzedAt:null}))); });
app.get('/api/discovery/alerts',(req,res) => res.json(db.discoveryAlerts.slice(-50)));
app.get('/api/hype/scan',(req,res)=>{ res.json({message:'Analisi hype avviata',models:HYPE_WATCHLIST.length}); runHypeScan().catch(()=>{}); });
app.get('/api/hype',(req,res)=>{ if(db.hypeAnalyses.length>0) return res.json(db.hypeAnalyses); res.json(HYPE_WATCHLIST.map(w=>({query:w.query,category:w.category,baseHype:w.baseHype,hypeScore:{score:w.baseHype,label:'— Avvia analisi',keySignal:'—'},signals:{},analyzedAt:null}))); });
app.get('/api/hype/alerts',(req,res)=>res.json(db.hypeAlerts.slice(-30)));
app.get('/api/vintage',(req,res)=>res.json(db.vintageDeals.slice(-100).reverse()));
// ── IDEA 1 applicata allo storico: classifica affari per EFFICIENZA DI CAPITALE ──
// Mostra gli affari trovati ordinati per €/mese di capitale (non per margine
// nominale): dove conviene davvero mettere i soldi. FLIP vs TESORO incluso.
app.get('/api/affari/roi',(req,res)=>{
  const out = db.vintageDeals.slice(-150).map(d=>{
    const margin = (d.valueLow||0) - (d.price||0);
    const days = dealEngine.estimateResaleDays(d.brand, d.model, d.price);
    const eff = dealEngine.capitalEfficiency(margin, d.price, days);
    const cls = dealEngine.classifyDeal({ brand:d.brand, model:d.model, priceEur:d.price, marginEur:margin, evRating:d.evRating, resaleDays:days, sleeperTier:d.sleeperTier });
    return { brand:d.brand, model:d.model, price:d.price, marginEur:margin>0?margin:0,
             resaleDays:days, profitPerMonth:eff?eff.profitPerMonth:0, monthlyRoiPct:eff?eff.monthlyRoiPct:0,
             tipo:cls, url:d.url };
  }).filter(x=>x.marginEur>0)
    .sort((a,b)=> b.profitPerMonth - a.profitPerMonth);
  res.json(out.slice(0,80));
});
app.get('/api/vintage/db',(req,res)=>res.json(Object.entries(VINTAGE_DB).map(([k,v])=>({key:k,...v}))));
app.get('/api/vintage/check',(req,res)=>{ const {title,price}=req.query; if(!title) return res.status(400).json({error:'?title= richiesto'}); const result=evaluateVintageDeal(title,price?parseFloat(price):999999); res.json(result||{match:false,message:'Modello non riconosciuto'}); });
app.get('/api/ahci', async (req,res)=>{ // check manuale radar AHCI (v12.23)
  const r = await ahciRadar.check(db.ahciKnown);
  if (r.ok && r.newOnes.length && req.query.alert==='1') { await tg(ahciRadar.formatAlert(r.newOnes)); db.ahciKnown=r.known; saveState(); }
  res.json(r.ok ? { ok:true, candidati:r.candidates.map(c=>c.name), nuovi:r.newOnes.map(c=>c.name), notiSalvati:(db.ahciKnown||[]).length } : { ok:false, errore:r.error });
});
app.get('/api/claude/check',async(req,res)=>{ const {title,price,image}=req.query; if(!title) return res.status(400).json({error:'?title= richiesto'}); if(!claudeAnalyst.isConfigured()) return res.json({configured:false,message:'GROQ_API_KEY non configurata'}); const result=await claudeAnalyst.analyzeListing(title, price?parseFloat(price):5000, image||'', { tier: req.query.tier || 'top' }); res.json(result||{error:'Analisi fallita'}); });

// ── PORTAFOGLIO INVESTITORE + TRACKER ──
app.get('/api/mio/add', (req, res) => {
  const { brand, model, price, note, date } = req.query;
  if (!brand || !model || !price) return res.status(400).send('Servono brand, model, price');
  priceTracker.addToPortfolio({ brand, model, buyPrice: price, buyDate: date, note });
  res.send(`<!doctype html><meta charset=utf-8><body style="font-family:sans-serif;background:#11161f;color:#eee;padding:24px">✅ Aggiunto: <b>${brand} ${model}</b> a €${price}<br><br>Quando salirà del ${priceTracker.PEAK_THRESHOLD}%+ ti avviso di vendere.</body>`);
});
app.get('/api/mio', (req, res) => res.json(priceTracker.getPortfolio()));

// ── RADAR MARCHI (cacciatore di catalizzatori): controllo manuale ──
app.get('/api/radar/run', (req, res) => {
  res.json({ message: 'Radar marchi avviato', brands: trademarkRadar.loadBrands(brandWatchlist).length });
  trademarkRadar.checkAll(tg, brandWatchlist, { report: true }).catch(e => console.error('[TM-RADAR]', e.message));
});

// Radar premi & indie — lancio manuale
app.get('/api/awards/run', (req, res) => {
  res.json({ message: 'Radar premi/indie avviato', indieSeguiti: awardsRadar.TRACKED_INDIES.length });
  awardsRadar.checkAll(tg, { report: true }).catch(e => console.error('[AWARDS]', e.message));
});
// ── VENDUTI REALI eBay: valore + liquidità per brand/model ──
app.get('/api/comps', async (req, res) => {
  const { brand, model, price } = req.query;
  if (!brand && !model) return res.status(400).json({ error: '?brand= e/o ?model= richiesti' });
  const domains = (process.env.COMPS_DOMAINS || 'ebay.com').split(',').map(s => s.trim());
  const comps = await soldComps.getComps(brand || '', model || '', { domains });
  const verdict = price ? soldComps.priceVerdict(parseFloat(price), comps) : null;
  res.json({ comps, verdict });
});
app.get('/api/mio/remove', (req, res) => res.json({ ok: priceTracker.removeFromPortfolio(req.query.id) }));
app.get('/api/tracker/movers', (req, res) => res.json(priceTracker.topMovers(30)));
// Manda su Telegram lo "studio mercato" a colpo d'occhio (sparkline + frecce)
app.get('/api/tracker/report', (req, res) => {
  const msg = priceTracker.telegramReport(Number(req.query.n) || 10);
  res.json({ message: 'Report mercato inviato su Telegram' });
  tg(msg).catch(e => console.error('[TRACKER-REPORT]', e.message));
});
app.get('/api/tracker/stats', (req, res) => res.json(priceTracker.stats()));
app.get('/api/tracker/export', (req, res) => res.json(priceTracker.exportData()));
// Watchlist marchi-azienda (Czapek & co.)
app.get('/api/marchi', (req, res) => res.json(brandWatchlist.watchlist || []));

// ── OSSERVATI ("tieni d'occhio, riavvisa se scende") ──
// Aggiungi via link feedback o a mano:
//   /api/osserva?b=Girard%20Perregaux&t=GP%20cal%20640%20oro&p=1400
//   Soglia AUTOMATICA a -20% dal prezzo visto (p). Puoi forzarne una a mano
//   con &soglia=750 oppure dopo con /api/osserva/soglia.
app.get('/api/osserva', (req, res) => {
  const { b, t, u, p, soglia } = req.query;
  const brand = (b||'').toString().slice(0,60);
  const label = (t||'').toString().slice(0,90);
  if (!brand && !u && !label) return res.status(400).send('Servono almeno marca o link');
  const threshold = soglia ? parseInt(soglia) : null;
  const seenPrice = p ? parseInt(p) : null;
  const rec = { id:nid(), brand, label, url:(u||'').toString(), seenPrice, threshold, active:true, firedUrls:[], created_at:new Date().toISOString() };
  db.observed.push(rec);
  if (db.observed.length>300) db.observed = db.observed.slice(-300);
  saveState();
  const autoSoglia = seenPrice ? Math.round(seenPrice*0.80) : null;
  const sogliaTxt = threshold
    ? `Ti riavviso quando scende a <b>€${threshold.toLocaleString('it-IT')}</b> o meno.`
    : autoSoglia
      ? `Ti riavviso AUTOMATICAMENTE quando scende del 20% — cioè a <b>€${autoSoglia.toLocaleString('it-IT')}</b> o meno (visto a €${seenPrice.toLocaleString('it-IT')}).<br><br>Vuoi un'altra soglia? <textarea readonly style="width:100%;height:54px;background:#1b2230;color:#f3f1ea;border:1px solid #3a4456;border-radius:8px;padding:8px;font-size:13px">${SELF_URL}/api/osserva/soglia?id=${rec.id}&soglia=METTI_PREZZO</textarea>`
      : `Registrato. Manca il prezzo di riferimento: imposta una soglia a mano:<br><br><textarea readonly style="width:100%;height:54px;background:#1b2230;color:#f3f1ea;border:1px solid #3a4456;border-radius:8px;padding:8px;font-size:13px">${SELF_URL}/api/osserva/soglia?id=${rec.id}&soglia=METTI_PREZZO</textarea>`;
  res.send(fbPage('👁️ In osservazione', `<b>${brand||label||'pezzo'}</b>${seenPrice?` (visto a €${seenPrice.toLocaleString('it-IT')})`:''}<br><br>${sogliaTxt}`));
});
// Imposta/aggiorna soglia a mano (la tua scelta: caso per caso)
app.get('/api/osserva/soglia', (req, res) => {
  const { id, soglia } = req.query;
  const rec = db.observed.find(o => String(o.id) === String(id));
  if (!rec) return res.status(404).send(fbPage('⚠️ Non trovato', 'Osservato inesistente.'));
  const th = parseInt(soglia);
  if (!th || th<=0) return res.status(400).send(fbPage('⚠️ Soglia non valida', 'Metti un prezzo in euro.'));
  rec.threshold = th; rec.active = true; saveState();
  res.send(fbPage('🎯 Soglia impostata', `<b>${rec.brand||rec.label}</b><br>Ti riavviso a <b>€${th.toLocaleString('it-IT')}</b> o meno.`));
});
app.get('/api/osserva/list', (req, res) => res.json(db.observed.filter(o=>o.active)));
app.get('/api/osserva/remove', (req, res) => { const rec = db.observed.find(o=>String(o.id)===String(req.query.id)); if (rec) rec.active=false; saveState(); res.send(fbPage('🗑️ Rimosso', 'Non lo seguo più.')); });

// ══════════════ FLIP CIECO — gemme nascoste ══════════════
// Pipeline a sé: pavimento basso + cattura immagini (gli scraper normali
// hanno il pavimento €200 e buttano le foto). Query generiche → setaccio
// (testo → vision Groq → lookup marca) → 💎 GEMMA / ⚠️ VERIFICA.
const CIECO_FLOOR = Number(process.env.FLIP_CIECO_FLOOR || 25);

function subitoImg(ad) {
  try {
    const im = ad.images || ad.image || [];
    if (Array.isArray(im) && im[0]) {
      if (typeof im[0] === 'string') return im[0];
      if (im[0].uri) return im[0].uri;
      if (Array.isArray(im[0].scale)) { const s = im[0].scale[im[0].scale.length-1]; if (s?.uri) return s.uri; if (s?.secureuri) return s.secureuri; }
    }
    if (ad.thumb) return ad.thumb;
  } catch {}
  return '';
}

async function fetchEbayCieco(query, maxPrice, markets = ['EBAY_IT']) {
  const token = await getEbayToken();
  if (!token) return [];
  const out = [];
  for (const market of markets) {
    try {
      const r = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
        params:{ q:query, category_ids:'31387', sort:'newlyListed', limit:50, filter:`price:[${CIECO_FLOOR}..${maxPrice}],priceCurrency:EUR` },
        headers:{ Authorization:`Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID':market },
        timeout:12000
      });
      for (const i of (r.data.itemSummaries||[])) {
        const img = i.image?.imageUrl || i.thumbnailImages?.[0]?.imageUrl || '';
        out.push({ id:'ebay:'+i.itemId, title:i.title, description:'', price:parseFloat(i.price?.value||0), currency:i.price?.currency||'EUR', imageUrl:img, url:i.itemWebUrl, source:`eBay ${market.replace('EBAY_','')}` });
      }
      await sleep(200);
    } catch (e) { console.error('[flip cieco eBay]', market, e.response?.status||'', e.message); }
  }
  return out;
}

async function fetchSubitoCieco(query, maxPrice) {
  try {
    await sleep(400 + Math.random()*400);
    const r = await axios.get('https://hades.subito.it/v1/search/items', {
      params:{ q:query, t:'s', qso:'true', sort:'datedesc', lim:40, start:0, ps:200 },
      headers:{ 'User-Agent':rUA(), 'Accept':'application/json', 'Accept-Language':'it-IT,it;q=0.9', 'Origin':'https://www.subito.it', 'Referer':'https://www.subito.it/' },
      timeout:12000
    });
    const data = r.data || {};
    const ads = Array.isArray(data.ads) ? data.ads : (Array.isArray(data.items) ? data.items : []);
    const out = [];
    for (const ad of ads) {
      const title = ad.subject || ad.title || '';
      let price = 0;
      const feats = Array.isArray(ad.features) ? ad.features : [];
      for (const f of feats) { const isPrice = /price/i.test(f?.uri||'')||/prezzo/i.test(f?.label||'')||f?.type==='monetary'; if (isPrice && f.values?.[0]) { price = parsePrice(String(f.values[0].key||f.values[0].value||'')); if (price) break; } }
      if (!price && ad.price) price = parsePrice(String(ad.price));
      const url = ad.urls?.default || ad.url || '';
      if (!title || !url || price < CIECO_FLOOR || price > maxPrice) continue;
      out.push({ id:'subito:'+(ad.urn||ad.id||url), title, description:(ad.body||''), price, currency:'EUR', imageUrl:subitoImg(ad), url, source:'Subito.it 🇮🇹' });
    }
    return out;
  } catch (e) { console.error('[flip cieco Subito]', e.message); return []; }
}

// Estrae l'URL immagine da un listing Marktplaats SENZA dipendere dal nome
// esatto del campo: l'API a volte usa pictures[].largeUrl, a volte imageUrls[],
// a volte altro. Cerco in profondità qualunque stringa che sia un URL d'immagine
// (o un id immagine Marktplaats) e la normalizzo. Così funziona comunque.
function mpImageUrl(i) {
  let found = '';
  const isImg = (s) => typeof s === 'string' &&
    (/\.(jpe?g|png|webp)(\?|$)/i.test(s) || /image|img|media|pictures?/i.test(s)) &&
    /^(https?:)?\/\//i.test(s);
  const walk = (v, depth) => {
    if (found || depth > 5 || v == null) return;
    if (typeof v === 'string') { if (isImg(v)) found = v; return; }
    if (Array.isArray(v)) { for (const x of v) { walk(x, depth+1); if (found) return; } return; }
    if (typeof v === 'object') { for (const k of Object.keys(v)) { walk(v[k], depth+1); if (found) return; } }
  };
  walk(i, 0);
  // alcuni feed danno solo un id/percorso senza schema: provo a ricostruirlo
  if (!found) {
    const raw = i?.pictures?.[0];
    const cand = (raw && (raw.largeUrl || raw.url || raw.mediaId)) || i?.imageUrls?.[0] || '';
    if (cand) found = String(cand);
  }
  if (found && found.startsWith('//')) found = 'https:' + found;
  return found || '';
}

// Rete di sicurezza: se l'API non espone l'immagine, la prendo dalla pagina
// dell'annuncio (meta og:image). In produzione su Render marktplaats è
// raggiungibile, quindi questo garantisce l'immagine quasi sempre.
async function fetchOgImage(pageUrl) {
  try {
    const r = await axios.get(pageUrl, { headers:{ 'User-Agent':rUA(), 'Accept':'text/html' }, timeout:10000 });
    const html = String(r.data || '');
    const m = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
    return m ? m[1] : '';
  } catch { return ''; }
}

async function fetchMarktplaatsCieco(query, maxPrice) {
  try {
    await sleep(600 + Math.random()*500);
    const r = await axios.get(`https://www.marktplaats.nl/lrp/api/search?query=${encodeURIComponent(query)}&categoryId=363&sortBy=PRICE_ASC&limit=40`,
      { headers:{ 'User-Agent':rUA(), 'Accept':'application/json' }, timeout:12000 });
    const listings = r.data?.listings || [];
    const out = [];
    let ogFetches = 0;
    for (const i of listings) {
      const title = i.title || '';
      const price = Math.round(parseFloat(i.priceInfo?.priceCents || 0) / 100);
      const url = i.vipUrl ? `https://www.marktplaats.nl${i.vipUrl}` : '';
      if (!title || !url || price < CIECO_FLOOR || price > maxPrice) continue;
      let imageUrl = mpImageUrl(i);
      // fallback og:image solo per gli item validi senza immagine, max 15/query
      if (!imageUrl && ogFetches < 15) { ogFetches++; imageUrl = await fetchOgImage(url); }
      out.push({ id:'mp:'+(i.itemId||i.vipUrl||url), title, description:(i.description||''), price, currency:'EUR', imageUrl, url, source:'Marktplaats 🇳🇱' });
    }
    return out;
  } catch (e) { console.error('[flip cieco Marktplaats]', e.message); return []; }
}

async function runFlipCiecoScan() {
  if (!process.env.GROQ_API_KEY) { console.warn('[flip cieco] GROQ_API_KEY mancante: salto (serve la vision).'); return { gemme:0 }; }
  const max = genericQueries.FLIP_CIECO_MAX;
  const look = genericQueries.FLIP_CIECO_LOOK;   // banda "guarda/tratta" + mai scartare variante
  const Q = genericQueries.queries;
  console.log(`[flip cieco] avvio — flip ≤€${max}, guarda ≤€${look}, budget vision ${genericQueries.VISION_BUDGET}`);

  let grezzo = [];
  for (const q of Q.subito)  { grezzo = grezzo.concat(await fetchSubitoCieco(q, look)); grezzo = grezzo.concat(await fetchEbayCieco(q, look, ['EBAY_IT'])); }
  for (const q of Q.ebay_de)  grezzo = grezzo.concat(await fetchEbayCieco(q, look, ['EBAY_DE']));
  for (const q of Q.ebay_fr)  grezzo = grezzo.concat(await fetchEbayCieco(q, look, ['EBAY_FR']));
  for (const q of (Q.ebay_es||[])) grezzo = grezzo.concat(await fetchEbayCieco(q, look, ['EBAY_ES']));
  for (const q of (Q.marktplaats||[])) grezzo = grezzo.concat(await fetchMarktplaatsCieco(q, look));

  const byId = new Map(); for (const l of grezzo) if (l && l.id && !byId.has(l.id)) byId.set(l.id, l);
  const fresh = [...byId.values()].filter(l => !alreadyAlerted(listingFp(l.title, l.price)));
  console.log(`[flip cieco] grezzo ${grezzo.length} → unici ${byId.size} → freschi ${fresh.length}`);

  const { gemme, guarda, verifiche, visionUsate } = await blindHunter.huntGems(fresh, { seen:new Set(), flipMax:max, lookMax:look });

  const chat = process.env.TELEGRAM_CHAT_GEMME || process.env.TELEGRAM_CHAT_ID;
  for (const g of gemme) {
    await tg(blindHunter.formatGemma(g), chat);
    markAlerted(listingFp(g.titolo, g.prezzo));
    await sleep(300);
  }
  for (const g of guarda) {
    await tg(blindHunter.formatGuarda(g), chat);
    markAlerted(listingFp(g.titolo, g.prezzo));
    await sleep(300);
  }
  for (const v of verifiche) {
    await tg(`\u26A0\uFE0F <b>VERIFICA SOSPETTA — ${String(v.marca).toUpperCase()}</b>\nPrezzo €${v.prezzo} · ${v.nota}\n${v.url}`, chat);
    markAlerted(listingFp(v.titolo || v.marca, v.prezzo));
    await sleep(300);
  }
  saveState();
  console.log(`[flip cieco] fatto — vision ${visionUsate}, gemme ${gemme.length}, guarda ${guarda.length}, verifiche ${verifiche.length}`);
  return { gemme:gemme.length, guarda:guarda.length, verifiche:verifiche.length, vision:visionUsate };
}

// ── FEEDBACK ──
function fbPage(titolo, sottotitolo) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Watch Price Bot</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0f1115;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}.card{padding:28px;max-width:560px}h1{font-size:42px;margin:0 0 12px}p{color:#aaa;font-size:17px;margin:6px 0}.big{font-size:20px;color:#fff;margin:14px 0;line-height:1.5}</style></head><body><div class="card"><h1>${titolo}</h1><div class="big">${sottotitolo}</div><p>Puoi tornare su Telegram.</p></div></body></html>`;
}
app.get('/api/fb', async (req, res) => {
  const { a, b, u } = req.query;
  if (a === 'bl' && b) {
    const brand = String(b).slice(0, 60);
    if (!db.blacklistBrands.includes(brand)) db.blacklistBrands.push(brand);
    await gistSaveNow();
    const lista = db.blacklistBrands.join(',');
    return res.send(fbPage('🚫 Bloccato', `Non riceverai più <b>${brand}</b>.<br><br><b style="color:#e8b923">Per renderlo PERMANENTE</b> copia questa riga su Render in <b>BLACKLIST_BRANDS</b>:<br><br><textarea readonly style="width:100%;height:70px;background:#1b2230;color:#f3f1ea;border:1px solid #3a4456;border-radius:8px;padding:8px;font-size:13px">${lista}</textarea>`));
  }
  if (a === 'dz' && u) {
    const url = normUrl(String(u));
    if (!db.dismissedUrls.includes(url)) db.dismissedUrls.push(url);
    // scarto anche per impronta titolo+prezzo: così il pezzo non torna se
    // ripubblicato con un URL nuovo (eBay/Subito reposting).
    const t = req.query.t ? String(req.query.t) : '';
    const p = req.query.p ? Math.round(parseFloat(req.query.p)) : 0;
    if (t) { const fp = listingFp(t, p); if (!db.dismissedFps.includes(fp)) db.dismissedFps.push(fp); }
    await gistSaveNow();
    return res.send(fbPage('👎 Scartato', `Questo annuncio non tornerà più (bloccato anche se ripubblicato con link diverso).<br><br>Per bloccare TUTTI gli annunci del marchio usa <b>🚫 Niente [marchio]</b>.`));
  }
  if (a === 'lk') {
    db.liked.push({ brand: (b||'').slice(0,60), title: (req.query.t||'').slice(0,80), url: u||'', at: new Date().toISOString() });
    await gistSaveNow();
    return res.send(fbPage('👍 Piace', `Bene, terrò conto dei tuoi gusti.`));
  }
  res.status(400).send(fbPage('⚠️ Errore', 'Richiesta non valida.'));
});
app.get('/api/blacklist', (req, res) => res.json({ marchiBloccati: db.blacklistBrands, annunciScartati: db.dismissedUrls.length }));
app.get('/api/liked', (req, res) => res.json({ totale: db.liked.length, piaciuti: db.liked.slice(-50).reverse() }));
app.get('/api/analyze', (req, res) => {
  const t = (req.query.t || '').toString(), u = (req.query.u || '').toString(), b = (req.query.b || '').toString(), p = (req.query.p || '').toString();
  const prezzo = p ? `€${p}` : 'prezzo da verificare';
  const testo = `Ciao Claude, analizziamo insieme questo orologio come al solito.\n\nMarca: ${b || '(da capire)'}\nAnnuncio: ${t}\nPrezzo richiesto: ${prezzo}\nLink: ${u}\n\nDimmi: è roba mia (crono/diver/oro vintage da uomo)? È vero vintage o moderno? Il prezzo è un affare? Quadrante originale o rischio redial? Cassa nazionale o oro vero? Cosa chiedere al venditore e a quanto trattare? Verdetto: compro, tratto a X, o lascio?`;
  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const testoJs = JSON.stringify(testo);
  res.send(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analizza con Claude</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#11161f;color:#f3f1ea;margin:0;padding:24px;line-height:1.5}.card{max-width:640px;margin:0 auto}h1{font-size:22px;margin:0 0 6px}p.sub{color:#9a7b2e;margin:0 0 18px;font-weight:600}textarea{width:100%;height:230px;background:#1b2230;color:#f3f1ea;border:1px solid #3a4456;border-radius:10px;padding:12px;font-size:15px;box-sizing:border-box}button{width:100%;padding:15px;margin-top:12px;border:0;border-radius:10px;font-size:17px;font-weight:700;cursor:pointer}.copy{background:#9a7b2e;color:#fff}.open{background:#2f6fed;color:#fff;text-decoration:none;display:block;text-align:center;box-sizing:border-box}.ok{color:#4ccf6a;text-align:center;margin-top:10px;font-weight:700;min-height:20px}.steps{background:#1b2230;border:1px solid #3a4456;border-radius:10px;padding:12px 16px;margin-top:16px;font-size:14px;color:#cfc8b8}</style></head><body><div class="card"><h1>🔍 Analizza con Claude</h1><p class="sub">Copia il testo e incollalo nella chat con Claude</p><textarea id="t" readonly>${esc(testo)}</textarea><button class="copy" onclick="cp()">📋 Copia il testo</button><a class="open" href="https://claude.ai/new">💬 Apri Claude</a><div class="ok" id="ok"></div><div class="steps"><b>Come fare:</b><br>1. Tocca <b>Copia</b><br>2. Tocca <b>Apri Claude</b><br>3. <b>Incolla</b> e <b>allega lo screenshot</b><br>4. Analizzate insieme 🎯</div></div><script>function cp(){var v=${testoJs};navigator.clipboard.writeText(v).then(function(){document.getElementById('ok').textContent='✅ Copiato!';}).catch(function(){var ta=document.getElementById('t');ta.removeAttribute('readonly');ta.select();document.execCommand('copy');document.getElementById('ok').textContent='✅ Copiato!';});}</script></body></html>`);
});
app.post('/api/blacklist/remove', (req, res) => {
  const { brand } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'brand richiesto' });
  db.blacklistBrands = db.blacklistBrands.filter(b => b.toLowerCase() !== String(brand).toLowerCase());
  saveState();
  res.json({ ok: true, marchiBloccati: db.blacklistBrands });
});
app.get('/api/blacklist/clear', (req, res) => { db.blacklistBrands = []; db.dismissedUrls = []; saveState(); res.send(fbPage('🧹 Pulito', 'Blacklist svuotata.')); });

app.get('/api/watchlist',(req,res) => res.json(db.watchlist.filter(w=>w.active)));
app.post('/api/watchlist',(req,res) => { const {query,threshold,email,telegramChatId}=req.body; if (!query) return res.status(400).json({error:'query richiesta'}); const r={id:nid(),query,threshold:threshold||null,email:email||null,telegram_chat_id:telegramChatId||process.env.TELEGRAM_CHAT_ID||null,active:true,created_at:new Date().toISOString()}; db.watchlist.push(r); res.json(r); });
app.delete('/api/watchlist/:id',(req,res) => { const item=db.watchlist.find(w=>w.id===parseInt(req.params.id)); if (item) item.active=false; res.json({ok:true}); });
app.get('/api/portfolio',(req,res) => res.json(db.portfolio.filter(p=>p.active)));
app.post('/api/portfolio',(req,res) => { const r={id:nid(),active:true,created_at:new Date().toISOString(),...req.body}; db.portfolio.push(r); res.json(r); });
app.delete('/api/portfolio/:id',(req,res) => { const item=db.portfolio.find(p=>p.id===parseInt(req.params.id)); if (item) item.active=false; res.json({ok:true}); });
app.get('/api/portfolio/summary',(req,res) => { const items=db.portfolio.filter(p=>p.active); res.json({totalCost:items.reduce((s,i)=>s+(parseFloat(i.purchasePrice||i.purchase_price)||0),0),itemCount:items.length}); });
app.get('/api/alerts',(req,res) => res.json(db.alerts.slice(-50).reverse()));
app.post('/api/telegram/test',(req,res) => { tg(`⌚ <b>Watch Price Bot v12.4</b> — Test OK! 🟢`,req.body.chatId); res.json({ok:true}); });

// ── TEST MANUALE RADAR NEWS / CATALIZZATORI ──
// Apri nel browser: <SELF_URL>/api/catalyst-test per forzare una scansione
// news adesso e ricevere subito gli alert su Telegram (rispetta comunque
// l'anti-ripetizione: già visti non li rimanda).
app.get('/api/catalyst-test',async(req,res) => {
  try {
    const r = await catalystWatch.runCatalystWatch({ tg, db, markAlerted, alreadyAlerted, saveState });
    res.json({ ok:true, ...r, timestamp:new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

app.get('/api/status',async(req,res) => {
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  const eh = await ebayHealth().catch(()=>({ok:false,reason:'errore check',detail:null}));
  res.json({
    status:'online',version:'12.21',
    goldPricePerGram:gold?Math.round(gold*100)/100:null, platinumPricePerGram:platinum?Math.round(platinum*100)/100:null,
    arbitrageFound:db.arbitrage.length,nearArbitrageFound:db.nearArbitrage.length, vintageDealsFound:db.vintageDeals.length,
    observedCount:db.observed.filter(o=>o.active).length,
    vintageDatabaseSize:Object.keys(VINTAGE_DB).length, tracker:priceTracker.stats(),
    caliberDatabaseSize:caliberDb.CALIBER_DB.length,
    brandWatchlistSize:(brandWatchlist.watchlist||[]).length,
    aiEngine:'Claude→Gemini→Groq', aiConfigured:claudeAnalyst.isConfigured(), aiUsage:claudeAnalyst.getUsage(),
    aiMotore: (()=>{ try { return require('./visionEngine').getStats(); } catch { return null; } })(),
    claudeConfigured:claudeAnalyst.isConfigured(), claudeUsage:claudeAnalyst.getUsage(),
    ebayApiConfigured:!!process.env.EBAY_CLIENT_ID,
    ebayReale: { attiva: eh.ok, motivo: eh.reason, dettaglio: eh.detail },
    serpApiUsedThisMonth:serpUsage.count, serpApiMonthlyLimit:SERPAPI_MONTHLY_LIMIT,
    watchlist:db.watchlist.filter(w=>w.active).length, uptime:Math.floor(process.uptime()),
  });
});

// ── CRON ──
// BASE: scansione completa ogni 2 ore (cron in UTC su Render). Alzata da 4h→2h:
// con Groq gratis non c'è costo per analisi, quindi conviene battere più spesso.
// ── AUTOTEST ALL'AVVIO (v12.28): a ogni deploy/riavvio il bot testa i motori
//    AI e manda l'esito su Telegram, con l'errore esatto quando fallisce.
//    Ogni avvio si auto-certifica: niente più diagnosi a screenshot.
//    Disattivabile con STARTUP_ENGINE_TEST=false. ──
if (process.env.STARTUP_ENGINE_TEST !== 'false') {
  setTimeout(async () => {
    try {
      const r = await require('./visionEngine').selfTest();
      const righe = r.map(x =>
        `${x.ok ? '✅' : '❌'} <b>${x.engine}</b>${x.model ? ` (${x.model})` : ''}` +
        (x.ok ? ` — ok in ${x.ms}ms` : ` — ${String(x.errore || '').replace(/[<>&]/g, '')}`)
      ).join('\n');
      const tutti = r.every(x => x.ok || /chiave assente/.test(String(x.errore || '')));
      const disponibili = r.some(x => x.ok);
      await tg(
        `🔧 <b>Autotest motori all'avvio</b> (v12.28)\n\n${righe}\n\n` +
        (disponibili
          ? (tutti ? '✅ Tutto il configurato funziona: il bot analizza.' : '⚠️ Qualcosa fallisce: leggi l\'errore qui sopra, dice già la causa.')
          : '🛑 NESSUN motore funziona: il bot raccoglie ma non analizza. L\'errore sopra dice perché.')
      );
    } catch (e) { console.error('[AUTOTEST]', e.message); }
  }, 25000);
}

cron.schedule('0 * * * *',()=>runGoldScan('all').catch(e=>console.error('[SCAN]',e.message)));

// ── BOOST NOTTURNO (ora italiana) ──
// Di notte Leonardo è sveglio o si sveglia presto e vuole trovare TUTTO pronto.
// Aggiungiamo scansioni EXTRA così la notte si batte molto più territorio.
// I cron sono in UTC; l'Italia è UTC+1 (inverno) / UTC+2 (estate). Copriamo un
// range UTC ampio (21–05) e lasciamo che getGoldQueries(), che legge l'ora di
// Roma vera via isNightBoost(), ampli automaticamente il pool (30 query, 3 blocchi).
// Risultato: di notte uno scan ricco ~ogni ora; di giorno resta lo scan base ogni 4h.
for (const h of [21, 22, 23, 1, 2, 3, 5]) {
  cron.schedule(`0 ${h} * * *`, () => {
    if (isNightBoost()) {            // doppio controllo sull'ora italiana reale
      console.log(`[BOOST NOTTE] scan extra (UTC ${h}:00 / IT ${romeHour()}:00)`);
      runGoldScan('all').catch(e=>console.error('[SCAN NOTTE]',e.message));
    }
  });
}

// scansioni di supporto, una volta al giorno, sfasate per non sovrapporsi
cron.schedule('0 7 * * *',()=>runHypeScan().catch(()=>{}));
cron.schedule('0 6 * * *',()=>runDiscoveryScan().catch(()=>{}));
// Flip cieco: ogni 3 ore (era 6h), sfasato di 30' dallo scan oro. Vision Groq
// gratis → si può battere più spesso; VISION_BUDGET resta il tetto per ciclo.
cron.schedule('30 */2 * * *',()=>runFlipCiecoScan().catch(e=>console.error('[FLIP CIECO]',e.message)));
// Radar marchi: 2 volte al mese (giorno 1 e 15, ore 8) — il segnale catalizzatore
cron.schedule('0 8 1,15 * *',()=>trademarkRadar.checkAll(tg, brandWatchlist, { report:true }).catch(e=>console.error('[TM-RADAR]',e.message)));
// Radar premi & indie (GPHG, LV Watch Prize, Only Watch + indie seguiti): ogni lunedì ore 9
cron.schedule('0 9 * * 1',()=>awardsRadar.checkAll(tg).catch(e=>console.error('[AWARDS]',e.message)));
// ── RADAR NEWS / CATALIZZATORI: 2 volte al giorno (07:00 e 19:00 UTC).
// Legge Google News per ogni brand in watchlist+indie e avvisa su Telegram
// quando esce un catalizzatore (rilancio, nuovo modello, edizione limitata,
// acquisizione, anniversario, record d'asta). Anti-ripetizione via db.alertedFps.
cron.schedule('0 7,19 * * *',()=>catalystWatch.runCatalystWatch({ tg, db, markAlerted, alreadyAlerted, saveState, onCatalyst:(ev)=>catalystTracking.recordEvent(ev) }).catch(e=>console.error('[CATALYST]',e.message)));
// RASSEGNA STAMPA: ogni mattina alle 8:00 ORA ITALIANA (Render gira in UTC → fisso il fuso).
cron.schedule('0 8 * * *',()=>morningBrief.runMorningBrief({ tg, db, saveState }).catch(e=>console.error('[BRIEF]',e.message)), { timezone: 'Europe/Rome' });
// Studio mercato a colpo d'occhio (sparkline + frecce su/giù): ogni lunedì ore 9:30
cron.schedule('30 9 * * 1',()=>{ const m=priceTracker.telegramReport(10); if(m) tg(m).catch(e=>console.error('[TRACKER-REPORT]',e.message)); });
cron.schedule('0 10 * * 1',()=>{ const m=portfolio.telegramReport(); if(m) tg(m).catch(e=>console.error('[PF-REPORT]',e.message)); });
// Effetto catalizzatori: misura ogni notte, report settimanale lunedì h10:15
cron.schedule('0 3 * * *',()=>{ try{ catalystTracking.measureAll(); }catch(e){ console.error('[CAT-TRACK]',e.message); } });
cron.schedule('15 10 * * 1',()=>{ const m=catalystTracking.telegramReport(10); if(m) tg(m).catch(e=>console.error('[CAT-TRACK-REPORT]',e.message)); });
cron.schedule('0 */4 * * *',async()=>{
  for (const item of db.watchlist.filter(w=>w.active)){
    try{
      await sleep(2000);
      const data=await searchAll(item.query);
      if(item.threshold&&data.lowest&&data.lowest.priceEur<=parseFloat(item.threshold)){
        const recent=db.alerts.find(a=>a.wid===item.id&&Date.now()-new Date(a.at).getTime()<4*3600000);
        if(!recent){
          await tg(`🔔 <b>PRICE ALERT</b>\n⌚ ${item.query}\n💰 €${data.lowest.priceEur.toLocaleString('it-IT')} su ${data.lowest.platform}\n<a href="${data.lowest.url}">→ VEDI</a>`,item.telegram_chat_id);
          db.alerts.push({id:nid(),wid:item.id,price:data.lowest.priceEur,at:new Date().toISOString()});
        }
      }
      cache.delete(item.query);
    }catch{}
  }
});

// ── AVVIO ──
const PORT=process.env.PORT||3001;
app.listen(PORT,'0.0.0.0',async()=>{
  loadState();
  await loadStateGist(); // memoria durevole gratis: ripopola gli scartati persi da /tmp
  priceTracker.load(); // storico prezzi + portafoglio investitore
  portfolio.load();    // memoria decisioni compro/passo/vendo + P&L
  catalystTracking.load(); // storico indice brand + eventi catalizzatore
  try { catalystTracking.seedKnownEvents(); } catch(e){ console.error('[CAT-TRACK] seed KO:', e.message); } // eventi noti (B&M/Damiani ecc.)
  const gold=await getGoldPrice().catch(()=>null);
  const platinum=await getPlatinumPrice().catch(()=>null);
  console.log(`\n⌚ Watch Price Bot v12.4 — porta ${PORT}`);
  console.log(`   Oro: €${gold?.toFixed(2)||'N/A'}/g | Platino: €${platinum?.toFixed(2)||'N/A'}/g`);
  if(process.env.TELEGRAM_TOKEN&&process.env.TELEGRAM_CHAT_ID){
    const ts = priceTracker.stats();
    const aiOff = !claudeAnalyst.isConfigured();
    const eh = await ebayHealthWithRetry();
    await tg(
      `✅ <b>Watch Price Bot v12.21 Online!</b>\n\n🥇 Oro: €${gold?.toFixed(2)||'N/A'}/g\n🔘 Platino: €${platinum?.toFixed(2)||'N/A'}/g\n\n`+
      `🏺 Database vintage: <b>${Object.keys(VINTAGE_DB).length} modelli</b>\n`+
      `📈 Marchi-azienda seguiti: <b>${(brandWatchlist.watchlist||[]).length}</b>\n`+
      `📊 Storico prezzi: <b>${ts.modelsTracked} modelli</b> · portafoglio: <b>${ts.portfolioCount}</b>\n`+
      (eh.ok
        ? `🔎 Ricerca eBay (API): <b>ATTIVA</b> \u2705 (token ottenuto ora)\n`
        : `\n🔴 <b>RICERCA eBay NON ATTIVA.</b>\nMotivo: ${eh.reason}${eh.detail?` \u2014 <code>${String(eh.detail).slice(0,120)}</code>`:''}\n${eh.reason==='chiavi mancanti'?'Aggiungi EBAY_CLIENT_ID / EBAY_CLIENT_SECRET in Environment.':'Le chiavi ci sono ma eBay le rifiuta: probabilmente SCADUTE o revocate. Rigenera le keyset su developer.ebay.com.'}\n`)+
      (aiOff
        ? `🟠 <b>Analista AI SPENTO.</b> Manca la chiave AI su Render (ANTHROPIC_API_KEY, o GEMINI/GROQ come riserva). L'oro funziona lo stesso (è calcolo puro), ma niente verdetti vintage.\n`
        : `🤖 Analista AI: <b>ATTIVO</b> (Claude \u2192 Gemini \u2192 Groq)\n`)+
      `\n<b>NOVITÀ v12.21:</b>\n`+
      `\u2615 <b>Rassegna stampa ore 8:00</b>: ogni mattina TUTTE le news dalle testate autorevoli (Hodinkee, Fratello, Monochrome, WatchPro, Oracle Time, Time+Tide, aBlogtoWatch, WatchTime, Worn&Wound, SJX, Europa Star), raggruppate per fonte. Provala subito con <code>/api/brief</code>.\n`+
      `\u{1F6D1} <b>Radar marchi finto SPENTO</b>: i segnali "deposito marchio" inventati (falso NewCo Holding AG su ogni marca) sono stati eliminati. Niente più falsi catalizzatori.\n`+
      `\u{1F9E0} Verdetti vintage: motore <b>Claude</b> (primario, qualità alta), con Gemini e Groq come riserva automatica se Claude non risponde.\n`+
      `\u{1F4F8} <b>Analisi foto attiva</b>: sui pezzi senza marca nel titolo, l'AI prova a leggere il logo dalla foto (flip cieco). L'occhio finale resta sempre il tuo.\n`+
      `\u{1F947} Oro/platino: arbitraggio a CALCOLO PURO, gira su OGNI annuncio, gratis e non si ferma mai.\n`+
      `\nPrima scansione tra 90 secondi...`
    );
  }
  setTimeout(()=>runGoldScan().catch(e=>console.error('[GOLD]',e.message)), 90000);
  // ── RADAR AHCI (v12.23): nuovi candidati indipendenti = stadio rumor.
  //    Check 3 min dopo l'avvio, poi 1 volta al giorno. Lezione Phimphrachanh:
  //    quando esce l'orologio è tardi; qui si intercetta il prossimo Coyon. ──
  const runAhciCheck = async () => {
    try {
      const r = await ahciRadar.check(db.ahciKnown);
      if (!r.ok) { console.log('[AHCI] check saltato:', r.error); return; }
      console.log(`[AHCI] candidati sul sito: ${r.candidates.length} | nuovi: ${r.newOnes.length}`);
      if (r.newOnes.length) {
        await tg(ahciRadar.formatAlert(r.newOnes));
        db.ahciKnown = r.known; saveState();
      } else if ((db.ahciKnown||[]).length < r.known.length) {
        db.ahciKnown = r.known; saveState(); // primo giro: memorizzo senza alert
      }
    } catch (e) { console.error('[AHCI]', e.message); }
  };
  setTimeout(runAhciCheck, 180000);
  setInterval(runAhciCheck, 24*3600000);
});
