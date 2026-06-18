/**
 * soldComps.js — IL TAPE DEI VENDUTI (non il book degli ordini)
 * ────────────────────────────────────────────────────────────────────────
 * "Tratta gli orologi come azioni" funziona solo se guardi i PREZZI VERI a
 * cui la roba si è VENDUTA, non quelli a cui è listata. Chiunque può chiedere
 * 5.000€: conta solo a quanto è passata di mano.
 *
 * eBay tiene i venduti degli ultimi 90 giorni. Da lì ricaviamo DUE cose che
 * il 95% dei dealer non ha:
 *   1) VALORE REALE   → mediana dei venduti (robusta agli outlier)
 *   2) LIQUIDITÀ VERA → quanti se ne vendono = quanto in fretta recuperi il
 *      capitale. Per un piccolo, riciclare in fretta batte il margine grande
 *      che resta fermo 8 mesi. La velocità è tutto.
 *
 * FONTE: SerpAPI engine "ebay" con filtro venduti (Sold,Complete) — usi già
 * SerpAPI, quindi zero nuove iscrizioni. Param: SERPAPI_KEY.
 * Fallback: nessuno (eBay blocca lo scraping diretto; SerpAPI lo aggira).
 */

const axios = require('axios');

const SERPAPI = 'https://serpapi.com/search.json';

// ── Prende i VENDUTI per una query da un dominio eBay ──────────────────────
// domain es: 'ebay.com', 'ebay.it', 'ebay.de'. Ritorna [{price, title, date}].
async function fetchSold(query, domain = 'ebay.com') {
  if (!process.env.SERPAPI_KEY) { console.warn('[SOLD] manca SERPAPI_KEY'); return []; }
  const params = {
    engine: 'ebay',
    _nkw: query,
    ebay_domain: domain,
    // Filtro venduti+completati (valori SerpAPI, case-sensitive). Se in futuro
    // SerpAPI rinomina il parametro, è l'unica riga da cambiare:
    filter: 'Sold,Complete',
    _sop: '13',           // più recenti
    api_key: process.env.SERPAPI_KEY,
  };
  try {
    const { data } = await axios.get(SERPAPI, { params, timeout: 30000 });
    const rows = data.organic_results || data.search_results || [];
    return rows.map(r => {
      // SerpAPI espone il prezzo in vari formati; normalizzo a numero EUR-ish.
      let p = null;
      if (r.price && typeof r.price === 'object') p = r.price.extracted || r.price.value || null;
      else if (typeof r.price === 'number') p = r.price;
      else if (typeof r.price === 'string') { const m = r.price.replace(/[.,](?=\d{3})/g, '').match(/([\d]+(?:[.,]\d+)?)/); if (m) p = parseFloat(m[1].replace(',', '.')); }
      return { price: p, title: r.title || '', date: r.sold_date || r.date || null, condition: r.condition || null };
    }).filter(x => x.price && x.price > 0);
  } catch (e) {
    console.error('[SOLD]', query, e.response?.status || e.message);
    return [];
  }
}

// ── STATISTICHE robuste su un array di prezzi venduti ──────────────────────
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
// Media spuntata: butta il 10% più alto e più basso = via gli outlier (lotti,
// pezzi rotti, errori di prezzo) che falsano la media semplice.
function trimmedMean(arr, trim = 0.1) {
  if (arr.length < 5) return median(arr);
  const s = [...arr].sort((a, b) => a - b);
  const cut = Math.floor(s.length * trim);
  const core = s.slice(cut, s.length - cut);
  return Math.round(core.reduce((a, b) => a + b, 0) / core.length);
}

// ── LIQUIDITÀ: quanti venduti in 90gg = quanto è liquido ──
function liquidity(count) {
  if (count >= 30) return { tier: 'molto liquido', label: '\u{1F4A7}\u{1F4A7}\u{1F4A7}', days: '<2 settimane' };
  if (count >= 12) return { tier: 'liquido',       label: '\u{1F4A7}\u{1F4A7}',          days: '2-4 settimane' };
  if (count >= 4)  return { tier: 'medio',          label: '\u{1F4A7}',                   days: '1-3 mesi' };
  if (count >= 1)  return { tier: 'illiquido',      label: '\u{1F40C}',                   days: '3-8 mesi' };
  return { tier: 'nessun dato', label: '\u2753', days: 'sconosciuto' };
}

// ── COMPS COMPLETI per brand+model: valore reale + velocità ────────────────
// Cerca su uno o più domini eBay (default .com globale, opz. anche .it/.de).
async function getComps(brand, model, opts = {}) {
  const q = [brand, model].filter(Boolean).join(' ').trim();
  if (!q) return null;
  const domains = opts.domains || ['ebay.com'];
  let all = [];
  for (const d of domains) {
    const sold = await fetchSold(q, d);
    all = all.concat(sold);
  }
  const prices = all.map(x => x.price).filter(Boolean);
  if (!prices.length) return { query: q, count: 0, ...liquidity(0) };
  const lq = liquidity(prices.length);
  return {
    query: q,
    count: prices.length,
    median: median(prices),
    fair: trimmedMean(prices),     // valore "giusto" robusto
    min: Math.min(...prices),
    max: Math.max(...prices),
    liquidityTier: lq.tier,
    liquidityLabel: lq.label,
    resaleEstimate: lq.days,
  };
}

// ── VERDETTO PREZZO: confronta un prezzo richiesto col tape venduto ─────────
function priceVerdict(askPrice, comps) {
  if (!comps || !comps.fair) return null;
  const deltaPct = Math.round(((comps.fair - askPrice) / comps.fair) * 100); // + = sotto il giusto
  let tag;
  if (deltaPct >= 25) tag = '\u{1F525} BEN SOTTO il venduto reale';
  else if (deltaPct >= 10) tag = '\u2705 sotto il venduto reale';
  else if (deltaPct >= -10) tag = '\u2696\uFE0F in linea col venduto reale';
  else tag = '\u{1F6A9} SOPRA il venduto reale';
  return { deltaPct, tag };
}

// ── Riga pronta per gli alert Telegram ──
function buildSoldLine(askPrice, comps) {
  if (!comps || !comps.count) return '';
  const v = priceVerdict(askPrice, comps);
  return `\n\u{1F4C8} <b>VENDUTI REALI (eBay 90gg):</b> mediana \u20AC${comps.median.toLocaleString('it-IT')} ` +
    `(${comps.min.toLocaleString('it-IT')}\u2013${comps.max.toLocaleString('it-IT')}, n=${comps.count})\n` +
    `${comps.liquidityLabel} Liquidità: <b>${comps.liquidityTier}</b> \u00B7 rivendi in ~${comps.resaleEstimate}\n` +
    (v ? `\u{1F3AF} Il prezzo chiesto è ${v.tag}${v.deltaPct ? ` (${v.deltaPct > 0 ? '-' : '+'}${Math.abs(v.deltaPct)}% vs giusto)` : ''}\n` : '');
}

module.exports = { getComps, fetchSold, priceVerdict, buildSoldLine, median, trimmedMean, liquidity };

// ── CLI di test: `node soldComps.js --test` (stats su dati finti) ──
if (require.main === module && process.argv.includes('--test')) {
  const fake = [180, 210, 220, 230, 240, 250, 250, 260, 275, 290, 1200 /*outlier lotto*/, 95 /*rotto*/];
  console.log('Mediana:', median(fake));
  console.log('Giusto (trimmed):', trimmedMean(fake), '<- l\'outlier 1200 e il 95 non lo sballano');
  console.log('Liquidità n=' + fake.length + ':', liquidity(fake.length));
  const comps = { query: 'Enicar Sherpa', count: fake.length, median: median(fake), fair: trimmedMean(fake), min: Math.min(...fake), max: Math.max(...fake), ...liquidity(fake.length), liquidityTier: liquidity(fake.length).tier, liquidityLabel: liquidity(fake.length).label, resaleEstimate: liquidity(fake.length).days };
  console.log('\nAlert a prezzo 190:', buildSoldLine(190, comps).replace(/<[^>]+>/g, ''));
  console.log('Alert a prezzo 320:', buildSoldLine(320, comps).replace(/<[^>]+>/g, ''));
}
