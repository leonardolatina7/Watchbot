/**
 * PRICE TRACKER — il cervello "da investitore a lungo termine"
 * ════════════════════════════════════════════════════════════════
 *
 * L'idea di Leonardo: trattare gli orologi come AZIONI.
 *  • Un modello buono che SCENDE del 20-30% = azione sottovalutata → COMPRA IL DIP
 *  • Un modello che SALE del 20-30% = titolo sopra prezzo → VENDI (se ce l'hai)
 *  • Un marchio risorto che "lavora bene" (Czapek, Nivada, UG...) = azienda
 *    che macina utili → si entra prima che il mercato lo prezzi del tutto.
 *
 * Come fa il bot a saperlo SENZA API a pagamento: costruisce lui lo
 * storico. Ogni volta che la scansione vede un modello a un certo prezzo,
 * registra l'osservazione. Con abbastanza osservazioni nel tempo, calcola
 * la MEDIANA recente vs la MEDIANA storica e capisce se il modello sta
 * salendo o scendendo — come un grafico azionario costruito dal basso.
 *
 * Anti-rumore (fondamentale): un singolo annuncio a poco NON è un calo di
 * mercato. Serve un minimo di osservazioni e si usa la MEDIANA (resiste
 * agli outlier) non la media. Le soglie (-20% dip / +20% picco) sono
 * tarate sui dati di mercato 2026: un indice che si muove ~1%/mese rende
 * un -20% su un modello un segnale forte e raro, da prendere sul serio.
 *
 * Persistenza: tutto su /tmp/watchbot-pricehistory.json (sopravvive ai
 * riavvii; per i deploy si può fare backup via /api/tracker/export).
 */

const fs = require('fs');
const HISTORY_FILE = '/tmp/watchbot-pricehistory.json';

// ── PARAMETRI (modificabili da Render se serve) ──
const MIN_OBS_BASELINE = parseInt(process.env.TRACKER_MIN_OBS || '5');   // osservazioni minime per fidarsi
const DIP_THRESHOLD    = parseFloat(process.env.TRACKER_DIP || '-20');   // % sotto cui scatta "compra il dip"
const PEAK_THRESHOLD   = parseFloat(process.env.TRACKER_PEAK || '20');   // % sopra cui scatta "vendi/realizza"
const RECENT_DAYS      = parseInt(process.env.TRACKER_RECENT_DAYS || '30'); // finestra "adesso"
const BASELINE_DAYS    = parseInt(process.env.TRACKER_BASELINE_DAYS || '180'); // finestra "storico di riferimento"
const MAX_OBS_PER_KEY  = 400;  // tetto osservazioni per modello (memoria)
const ALERT_COOLDOWN_DAYS = 14; // non ripetere lo stesso alert per lo stesso modello entro 14 giorni

// ── STATO IN MEMORIA ──
// history[modelKey] = { brand, model, obs: [{price, at}], lastAlert: {type, at, level} }
let history = {};
let portfolio = []; // [{id, modelKey, brand, model, buyPrice, buyDate, note}]

function load() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const s = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      history = s.history || {};
      portfolio = s.portfolio || [];
      const n = Object.keys(history).length;
      console.log(`[TRACKER] Caricato storico: ${n} modelli tracciati, ${portfolio.length} in portafoglio`);
    }
  } catch (e) { console.error('[TRACKER] load:', e.message); }
}
function save() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history, portfolio }));
  } catch (e) { console.error('[TRACKER] save:', e.message); }
}

// ── UTIL STATISTICI ──
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function daysAgo(n) { return Date.now() - n * 24 * 60 * 60 * 1000; }

// Chiave modello normalizzata: brand + modello, minuscolo, senza accenti/
// punteggiatura. Così "Universal Genève Polerouter" e "universal geneve
// polerouter" finiscono nello stesso paniere.
function modelKey(brand, model) {
  const norm = s => String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return (norm(brand) + ' ' + norm(model)).trim().replace(/\s+/g, ' ');
}

// ════════════════════════════════════════════════════════════════
// REGISTRA UN'OSSERVAZIONE DI PREZZO
// Chiamata dal bot ogni volta che identifica un modello noto a un prezzo.
// Ritorna un eventuale SEGNALE ("dip"/"peak") se è scattata la soglia.
// ════════════════════════════════════════════════════════════════
function record(brand, model, priceEur, opts = {}) {
  if (!brand || !model || !priceEur || priceEur < 50) return null;
  const key = modelKey(brand, model);
  if (!key) return null;

  if (!history[key]) history[key] = { brand, model, obs: [], lastAlert: null };
  const h = history[key];
  h.obs.push({ price: Math.round(priceEur), at: new Date().toISOString() });
  if (h.obs.length > MAX_OBS_PER_KEY) h.obs = h.obs.slice(-MAX_OBS_PER_KEY);

  // Calcola il segnale (può essere null se non ci sono abbastanza dati)
  const signal = computeSignal(key, opts);
  save();
  return signal;
}

// ════════════════════════════════════════════════════════════════
// CALCOLA IL SEGNALE per un modello: confronta MEDIANA recente vs storica
// ════════════════════════════════════════════════════════════════
function computeSignal(key, opts = {}) {
  const h = history[key];
  if (!h) return null;

  const recentCut = daysAgo(RECENT_DAYS);
  const baseCut = daysAgo(BASELINE_DAYS);

  const recentPrices = h.obs.filter(o => new Date(o.at).getTime() >= recentCut).map(o => o.price);
  // baseline = osservazioni tra BASELINE_DAYS fa e RECENT_DAYS fa (il "prima")
  const basePrices = h.obs.filter(o => {
    const t = new Date(o.at).getTime();
    return t >= baseCut && t < recentCut;
  }).map(o => o.price);

  // Servono abbastanza dati in ENTRAMBE le finestre, altrimenti niente segnale
  if (recentPrices.length < 3 || basePrices.length < MIN_OBS_BASELINE) {
    return { key, brand: h.brand, model: h.model, status: 'building',
             obsTotal: h.obs.length, recentN: recentPrices.length, baseN: basePrices.length };
  }

  const recentMed = median(recentPrices);
  const baseMed = median(basePrices);
  if (!recentMed || !baseMed) return null;

  const changePct = Math.round(((recentMed - baseMed) / baseMed) * 1000) / 10;

  let type = null;
  if (changePct <= DIP_THRESHOLD) type = 'dip';   // sceso molto → comprare
  else if (changePct >= PEAK_THRESHOLD) type = 'peak'; // salito molto → vendere

  // Cooldown: non ripetere lo stesso tipo di alert troppo spesso
  const onCooldown = h.lastAlert && h.lastAlert.type === type &&
    (Date.now() - new Date(h.lastAlert.at).getTime()) < ALERT_COOLDOWN_DAYS * 24 * 3600 * 1000;

  const result = {
    key, brand: h.brand, model: h.model,
    status: type || 'stable',
    changePct, recentMed, baseMed,
    recentN: recentPrices.length, baseN: basePrices.length, obsTotal: h.obs.length,
    fireAlert: !!type && !onCooldown,
  };

  if (type && !onCooldown) {
    h.lastAlert = { type, at: new Date().toISOString(), level: changePct };
  }
  return result;
}

// ════════════════════════════════════════════════════════════════
// PORTAFOGLIO — cosa Leonardo ha comprato e a quanto.
// Serve per gli avvisi di VENDITA: se un pezzo che possiede sale,
// il bot calcola la plusvalenza e suggerisce di realizzare.
// ════════════════════════════════════════════════════════════════
function addToPortfolio({ brand, model, buyPrice, buyDate, note }) {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const key = modelKey(brand, model);
  portfolio.push({
    id, modelKey: key, brand, model,
    buyPrice: Math.round(parseFloat(buyPrice) || 0),
    buyDate: buyDate || new Date().toISOString(),
    note: note || '',
  });
  save();
  return { id, key };
}
function removeFromPortfolio(id) {
  const before = portfolio.length;
  portfolio = portfolio.filter(p => p.id !== parseInt(id));
  save();
  return before !== portfolio.length;
}
function getPortfolio() {
  // Arricchisce ogni pezzo con la stima di valore corrente (mediana recente)
  return portfolio.map(p => {
    const h = history[p.modelKey];
    let nowMed = null, changeVsBuy = null, recentN = 0;
    if (h) {
      const recentPrices = h.obs.filter(o => new Date(o.at).getTime() >= daysAgo(RECENT_DAYS)).map(o => o.price);
      recentN = recentPrices.length;
      if (recentPrices.length >= 3) {
        nowMed = median(recentPrices);
        if (p.buyPrice > 0) changeVsBuy = Math.round(((nowMed - p.buyPrice) / p.buyPrice) * 1000) / 10;
      }
    }
    return { ...p, nowMed, changeVsBuy, recentN };
  });
}

// Controlla se un modello appena osservato è in portafoglio e se conviene
// venderlo (salito abbastanza dal prezzo d'acquisto). Ritorna info o null.
function checkPortfolioSell(brand, model) {
  const key = modelKey(brand, model);
  const holdings = portfolio.filter(p => p.modelKey === key);
  if (!holdings.length) return null;
  const h = history[key];
  if (!h) return null;
  const recentPrices = h.obs.filter(o => new Date(o.at).getTime() >= daysAgo(RECENT_DAYS)).map(o => o.price);
  if (recentPrices.length < 3) return null;
  const nowMed = median(recentPrices);
  const out = [];
  for (const hold of holdings) {
    if (hold.buyPrice <= 0) continue;
    const gainPct = Math.round(((nowMed - hold.buyPrice) / hold.buyPrice) * 1000) / 10;
    if (gainPct >= PEAK_THRESHOLD) {
      out.push({ ...hold, nowMed, gainPct, gainEur: nowMed - hold.buyPrice });
    }
  }
  return out.length ? out : null;
}

// Statistiche per il sito/status
function stats() {
  const keys = Object.keys(history);
  let building = 0, tracked = 0;
  for (const k of keys) {
    const sig = computeSignal(k);
    if (sig && sig.status === 'building') building++; else tracked++;
  }
  return {
    modelsTracked: keys.length,
    fullyTracked: tracked,
    stillBuilding: building,
    portfolioCount: portfolio.length,
    totalObservations: keys.reduce((s, k) => s + history[k].obs.length, 0),
  };
}

// Top movers: i modelli che si muovono di più (per una dashboard)
function topMovers(limit = 20) {
  const out = [];
  for (const k of Object.keys(history)) {
    const sig = computeSignal(k);
    if (sig && sig.status !== 'building' && typeof sig.changePct === 'number') {
      out.push(sig);
    }
  }
  out.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return out.slice(0, limit);
}

function exportData() { return { history, portfolio }; }

module.exports = {
  load, save, record, computeSignal, modelKey,
  addToPortfolio, removeFromPortfolio, getPortfolio, checkPortfolioSell,
  stats, topMovers, exportData,
  // costanti esposte per i messaggi
  DIP_THRESHOLD, PEAK_THRESHOLD, RECENT_DAYS, BASELINE_DAYS,
};
