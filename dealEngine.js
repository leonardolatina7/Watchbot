/**
 * DEAL ENGINE — il cervello che trasforma "ho trovato un affare" in "so quanto
 * e quanto in fretta ci guadagno". Tre idee, un file solo, zero dipendenze dal
 * resto: riceve i dati che gia circolano nello scan e restituisce arricchimenti.
 *
 *  IDEA 1 — ROI ANNUALIZZATO / VELOCITA DI RIVENDITA
 *    Il margine nominale inganna: un pezzo a +400€ che resta 8 mesi in cassetto
 *    rende meno di uno a +150€ che rigiri in 2 settimane. Qui stimiamo i GIORNI
 *    di rivendita (dalla liquidita osservata) e calcoliamo il guadagno PER MESE
 *    di capitale immobilizzato. E' la metrica che dice DOVE mettere i soldi.
 *
 *  IDEA 2 — SOTTOPREZZO RELATIVO (mediana mobile 90 giorni)
 *    L'affare vero non e "sotto una soglia fissa" ma "sotto gli altri uguali in
 *    vendita ORA". Teniamo lo storico prezzi per modello e segnaliamo quando un
 *    pezzo e sotto la mediana corrente: cattura il venditore che ha messo il
 *    "prezzo di due anni fa" su un modello nel frattempo salito.
 *
 *  IDEA 3 — FLIP vs TESORO
 *    Due modi di fare soldi: FLIP = giro veloce, margine piccolo, capitale che
 *    rota (Tudor, Seiko diver, Omega comuni). TESORO = margine grande, tempi
 *    lunghi, da collezionista. Classifichiamo ogni affare cosi sai che tipo di
 *    capitale stai impegnando.
 *
 *  (IDEA 4 — caccia geografica attiva: e nelle query, vedi geoHuntQueries.)
 */

const fs = require('fs');

// ── Storage prezzi per modello (idea 2). Persistente su disco se disponibile. ──
const STATE_DIR = fs.existsSync('/var/data') ? '/var/data' : '.';
const PRICES_FILE = `${STATE_DIR}/dealengine_prices.json`;
const WINDOW_DAYS = 90;

let priceHistory = {}; // key modello -> [{price, ts}]
try {
  if (fs.existsSync(PRICES_FILE)) priceHistory = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8')) || {};
} catch { priceHistory = {}; }

let saveTimer = null;
function persist() {
  // throttle: salva al massimo ogni 10s per non martellare il disco
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.writeFileSync(PRICES_FILE, JSON.stringify(priceHistory)); } catch {}
  }, 10000);
}

function keyOf(brand, model) {
  return `${String(brand || '').toLowerCase().trim()}|${String(model || '').toLowerCase().trim()}`
    .replace(/\s+/g, ' ');
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Registra un prezzo visto e ritorna la fotografia del modello (mediana, n. visti).
function recordPrice(brand, model, price) {
  if (!brand || !model || brand === '?' || model === '?' || !price) return null;
  const k = keyOf(brand, model);
  const now = Date.now();
  const cutoff = now - WINDOW_DAYS * 864e5;
  const arr = (priceHistory[k] || []).filter(p => p.ts >= cutoff);
  arr.push({ price: Math.round(price), ts: now });
  priceHistory[k] = arr;
  persist();
  const prices = arr.map(p => p.price);
  return { key: k, count: prices.length, median: median(prices), prices };
}

// Quanti esemplari simili abbiamo visto di recente = proxy della LIQUIDITA.
function seenCount(brand, model) {
  const k = keyOf(brand, model);
  const cutoff = Date.now() - WINDOW_DAYS * 864e5;
  return (priceHistory[k] || []).filter(p => p.ts >= cutoff).length;
}

// ── IDEA 2: sottoprezzo relativo ──
// Ritorna {below:true, medianNow, vsPct} se il pezzo e sotto la mediana corrente
// di almeno minPct%. Serve un minimo di storico (>=4 visti) per avere senso.
function relativeUnderprice(brand, model, price, minPct = 18) {
  const k = keyOf(brand, model);
  const cutoff = Date.now() - WINDOW_DAYS * 864e5;
  const prices = (priceHistory[k] || []).filter(p => p.ts >= cutoff).map(p => p.price);
  // MIN 8 (era 4). Motivo statistico: l'errore standard della mediana è
  // ~1.25*sigma/sqrt(n). Con n=4 vale 0.63*sigma, cioè un "-20% sotto la
  // mediana" cade dentro il rumore e produce falsi affari a raffica. Con n=8
  // scende a 0.44*sigma e il segnale inizia a superare il rumore.
  const MIN_N = parseInt(process.env.DEALENGINE_MIN_N || '8');
  if (prices.length < MIN_N) return { below: false, enoughData: false, sampleSize: prices.length };
  const med = median(prices);
  if (!med) return { below: false, enoughData: false };
  const vsPct = Math.round(((med - price) / med) * 100); // positivo = sotto la mediana
  return {
    below: vsPct >= minPct,
    enoughData: true,
    medianNow: med,
    vsPct,
    sampleSize: prices.length,
  };
}

// ── IDEA 1: velocita di rivendita + ROI annualizzato ──
// Stima i GIORNI di rivendita dalla liquidita (quanti visti) + fascia prezzo +
// bonus marche notoriamente liquide. Non e una previsione esatta: e un ordine di
// grandezza per confrontare gli affari tra loro e capire dove gira il capitale.
const FAST_BRANDS = ['tudor', 'omega', 'seiko', 'rolex', 'cartier', 'longines', 'tag heuer', 'breitling', 'oris', 'hamilton'];
const SLOW_HINTS = ['excelsior park', 'gallet', 'cyma', 'tavannes', 'pierce', 'buren', 'gubelin', 'juvenia', 'record', 'moeris', 'election', 'wittnauer', 'wakmann'];

function estimateResaleDays(brand, model, priceEur) {
  const b = String(brand || '').toLowerCase();
  const isFast = FAST_BRANDS.some(x => b.includes(x));
  const isSlow = SLOW_HINTS.some(x => b.includes(x));

  // liquidita osservata: piu esemplari visti = piu mercato = rivendita piu veloce
  const seen = seenCount(brand, model);
  let days;
  if (seen >= 12) days = 25;
  else if (seen >= 6) days = 45;
  else if (seen >= 3) days = 70;
  else {
    // poco/nessuno storico: parto dalla NATURA della marca, non da un default unico.
    // le marche notoriamente liquide hanno mercato anche se non le ho ancora viste;
    // le oscure invece richiedono il compratore giusto.
    days = isFast ? 50 : isSlow ? 130 : 95;
  }

  // marche liquide accorciano, marche oscure allungano (anche con storico)
  if (isFast) days = Math.round(days * 0.6);
  if (isSlow) days = Math.round(days * 1.5);

  // fascia prezzo: l'economico gira piu in fretta, il costoso ha meno compratori
  if (priceEur <= 500) days = Math.round(days * 0.8);
  else if (priceEur >= 3000) days = Math.round(days * 1.4);
  else if (priceEur >= 1500) days = Math.round(days * 1.15);

  return Math.max(10, Math.min(days, 270)); // tra 10 giorni e 9 mesi
}

// ROI mensile sul capitale: quanto rende OGNI MESE l'euro che immobilizzi.
// Questa e la metrica che cambia quali affari inseguire.
function capitalEfficiency(marginEur, priceEur, resaleDays) {
  if (!marginEur || marginEur <= 0 || !priceEur || priceEur <= 0) return null;
  const months = Math.max(resaleDays / 30, 0.4);
  const profitPerMonth = marginEur / months;          // €/mese di guadagno
  const monthlyRoiPct = (marginEur / priceEur) / months * 100; // % al mese sul capitale
  return {
    resaleDays,
    months: Math.round(months * 10) / 10,
    profitPerMonth: Math.round(profitPerMonth),
    monthlyRoiPct: Math.round(monthlyRoiPct * 10) / 10,
  };
}

// ── IDEA 3: classificazione FLIP vs TESORO ──
// FLIP   = liquido, giro veloce, margine anche piccolo -> capitale che rota.
// TESORO = raro, margine grande o evRating alto, tempi lunghi -> da collezionista.
function classifyDeal({ brand, model, priceEur, marginEur, evRating, resaleDays, sleeperTier }) {
  const b = String(brand || '').toLowerCase();
  const fast = FAST_BRANDS.some(x => b.includes(x));
  const slow = SLOW_HINTS.some(x => b.includes(x));
  const tier = sleeperTier || 0;

  // segnali TESORO
  const tesoroScore =
    (evRating === 'high' ? 2 : 0) +
    (tier >= 3 ? 2 : tier >= 2 ? 1 : 0) +
    (slow ? 1 : 0) +
    (priceEur >= 2000 ? 1 : 0) +
    ((marginEur || 0) >= 800 ? 1 : 0) +
    (resaleDays >= 120 ? 1 : 0);

  // segnali FLIP
  const flipScore =
    (fast ? 2 : 0) +
    (resaleDays <= 45 ? 2 : resaleDays <= 70 ? 1 : 0) +
    (priceEur <= 1500 ? 1 : 0) +
    ((marginEur || 0) > 0 && (marginEur || 0) < 600 ? 1 : 0);

  if (tesoroScore >= flipScore && tesoroScore >= 2) return 'TESORO';
  if (flipScore > tesoroScore && flipScore >= 2) return 'FLIP';
  return null; // niente etichetta forzata se il segnale e debole
}

// Compone le righe Telegram delle idee, pronte da concatenare all'alert.
// Ritorna stringa (puo essere vuota). Mai spinge a comprare oltre il dovuto:
// e informazione operativa su DOVE e COME gira il capitale.
function buildInsightLines({ brand, model, priceEur, marginEur, evRating, sleeperTier }) {
  let out = '';

  const resaleDays = estimateResaleDays(brand, model, priceEur);
  const eff = capitalEfficiency(marginEur, priceEur, resaleDays);

  // IDEA 1: ROI annualizzato / velocita
  if (eff) {
    const tempo = resaleDays <= 35 ? 'veloce \u26A1' : resaleDays <= 75 ? 'medio' : 'lento \u{1F40C}';
    out += `\u23F3 <b>Rivendita stimata:</b> ~${resaleDays} gg (${tempo}) \u2192 ~\u20AC${eff.profitPerMonth}/mese di capitale (${eff.monthlyRoiPct}%/mese)\n`;
  }

  // IDEA 3: FLIP vs TESORO
  const cls = classifyDeal({ brand, model, priceEur, marginEur, evRating, resaleDays, sleeperTier });
  if (cls === 'FLIP') {
    out += `\u{1F501} <b>Tipo: FLIP</b> \u2014 giro veloce, capitale che rota. Buono se ti serve liquidita.\n`;
  } else if (cls === 'TESORO') {
    out += `\u{1F48E} <b>Tipo: TESORO</b> \u2014 margine alto ma tempi lunghi. Da tenere finche arriva il collezionista giusto.\n`;
  }

  // IDEA 2: sottoprezzo relativo (solo se abbiamo storico)
  const rel = relativeUnderprice(brand, model, priceEur);
  if (rel.below) {
    out += `\u{1F4C9} <b>Sotto la mediana del mercato:</b> \u2212${rel.vsPct}% vs gli altri uguali visti di recente (mediana ~\u20AC${rel.medianNow.toLocaleString('it-IT')}, su ${rel.sampleSize} esemplari). \u00C8 economico ANCHE rispetto al suo presente.\n`;
  }

  return { lines: out, resaleDays, efficiency: eff, classe: cls, relative: rel };
}

module.exports = {
  recordPrice,
  seenCount,
  relativeUnderprice,
  estimateResaleDays,
  capitalEfficiency,
  classifyDeal,
  buildInsightLines,
  median,
};
