/**
 * catalystTracking.js — STORICO PREZZI A LIVELLO BRAND + EFFETTO CATALIZZATORE
 * ────────────────────────────────────────────────────────────────────────
 * IL CONCETTO (Leonardo): trattare ogni marchio come un'AZIENDA QUOTATA.
 *   - L'INDICE DI BRAND = mediana dei prezzi di tutti i pezzi di quel marchio
 *     visti dal bot nel tempo. È il "titolo" del marchio.
 *   - Il CATALIZZATORE = la news (rilancio, riedizione, record asta, premio).
 *     È l'"annuncio" che muove il titolo.
 *   - L'EFFETTO = quanto si è mosso l'indice di brand DOPO la news, misurato
 *     a +30 / +90 / +180 giorni. Esattamente come si misura la reazione di
 *     un titolo a una trimestrale.
 *
 * PERCHÉ SERVE: la tesi 10x dice "il catalizzatore anticipa i prezzi di 2-5
 * anni". Finora era un'intuizione. Questo modulo la MISURA: se UG rilancia e
 * 90 giorni dopo l'indice UG è +18%, hai la prova che la tesi sta funzionando
 * E sai che la finestra è ancora aperta. Se invece è piatto, il catalizzatore
 * non ha (ancora) morso → aspetti o lasci.
 *
 * ARCHITETTURA: persistenza su DATA_DIR come priceTracker/portfolio. Si
 * alimenta dagli stessi record di prezzo che già passano (brand+prezzo). Gli
 * eventi catalizzatore arrivano da catalystWatch quando spara una news.
 * Zero dipendenze nuove.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : '/tmp');
const CT_FILE = path.join(DATA_DIR, 'watchbot-catalyst-tracking.json');

// Finestre di misura dell'effetto (giorni dopo la news)
const WINDOWS = [30, 90, 180];
// Minimo osservazioni per finestra perché la mediana sia affidabile
const MIN_OBS = parseInt(process.env.CT_MIN_OBS || '4', 10);

// state:
// brandIndex[brandKey] = { brand, obs:[{price,at}] }
// events[]             = { id, brand, brandKey, type, title, at,
//                          baseline:{med,n}, measured:{ '30':{med,n,changePct}, ... },
//                          lastMeasuredAt }
let data = { brandIndex: {}, events: [] };

function load() {
  try {
    if (fs.existsSync(CT_FILE)) {
      data = JSON.parse(fs.readFileSync(CT_FILE, 'utf8')) || { brandIndex: {}, events: [] };
      data.brandIndex = data.brandIndex || {};
      data.events = Array.isArray(data.events) ? data.events : [];
      console.log(`[CAT-TRACK] Caricato: ${Object.keys(data.brandIndex).length} brand, ${data.events.length} eventi`);
    }
  } catch (e) { console.error('[CAT-TRACK] load KO:', e.message); data = { brandIndex: {}, events: [] }; }
}
function save() {
  try { fs.writeFileSync(CT_FILE, JSON.stringify(data)); }
  catch (e) { console.error('[CAT-TRACK] save KO:', e.message); }
}

function brandKey(brand) {
  return String(brand || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '').slice(0, 40);
}
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function daysBetween(a, b) { return (new Date(b).getTime() - new Date(a).getTime()) / 86400000; }
function nid() { return 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// ── 1. Alimenta l'indice di brand (chiamato a ogni pezzo visto) ────────────
// Cap a ~400 osservazioni per brand (ring buffer) per non gonfiare il file.
function recordPrice(brand, priceEur) {
  const key = brandKey(brand);
  if (!key || !(priceEur > 0)) return;
  if (!data.brandIndex[key]) data.brandIndex[key] = { brand, obs: [] };
  const b = data.brandIndex[key];
  b.obs.push({ price: Math.round(priceEur), at: new Date().toISOString() });
  if (b.obs.length > 400) b.obs = b.obs.slice(-400);
  // salvataggio non a ogni colpo: lasciato al saver periodico dell'index
}

// Mediana dei prezzi del brand in una finestra [fromIso, toIso)
function brandMedianBetween(key, fromIso, toIso) {
  const b = data.brandIndex[key];
  if (!b) return { med: null, n: 0 };
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const prices = b.obs.filter(o => {
    const t = new Date(o.at).getTime();
    return t >= from && t < to;
  }).map(o => o.price);
  return { med: median(prices), n: prices.length };
}

// ── 2. Registra un evento catalizzatore (da catalystWatch) ─────────────────
// Baseline = mediana brand nei 90 giorni PRIMA della news.
function recordEvent({ brand, type, title }) {
  const key = brandKey(brand);
  if (!key) return null;
  const now = new Date();
  const ninetyBefore = new Date(now.getTime() - 90 * 86400000).toISOString();
  const baseline = brandMedianBetween(key, ninetyBefore, now.toISOString());
  // Evita doppioni: stesso brand+tipo nelle ultime 2 settimane = stesso evento
  const dup = data.events.find(e => e.brandKey === key && e.type === type &&
    daysBetween(e.at, now.toISOString()) < 14);
  if (dup) return dup;
  const ev = {
    id: nid(), brand, brandKey: key, type: type || 'news',
    title: String(title || '').slice(0, 140), at: now.toISOString(),
    baseline, measured: {}, lastMeasuredAt: null,
  };
  data.events.unshift(ev);
  save();
  return ev;
}

// ── 3. Misura l'effetto: per ogni evento, confronta l'indice di brand DOPO
//    la news (a +30/+90/+180gg) con la baseline pre-news. ────────────────────
function measureAll() {
  const now = new Date();
  let updated = 0;
  for (const ev of data.events) {
    const elapsed = daysBetween(ev.at, now.toISOString());
    for (const w of WINDOWS) {
      // misura una finestra solo se è già trascorsa e non già misurata stabilmente
      if (elapsed < w) continue;
      if (ev.measured[w] && ev.measured[w].n >= MIN_OBS) continue;
      // finestra: dai +0 ai +w giorni dopo l'evento
      const from = ev.at;
      const to = new Date(new Date(ev.at).getTime() + w * 86400000).toISOString();
      const after = brandMedianBetween(ev.brandKey, from, to);
      if (after.med && ev.baseline.med) {
        const changePct = Math.round(((after.med - ev.baseline.med) / ev.baseline.med) * 1000) / 10;
        ev.measured[w] = { med: after.med, n: after.n, changePct };
        updated++;
      } else if (after.n) {
        ev.measured[w] = { med: after.med, n: after.n, changePct: null };
      }
    }
    ev.lastMeasuredAt = now.toISOString();
  }
  if (updated) save();
  return updated;
}

// ── Report Telegram: catalizzatori che stanno MORDENDO ─────────────────────
function telegramReport(limit = 10) {
  measureAll();
  // ordina per effetto a 90gg (o 30 se manca), solo eventi con almeno una misura
  const scored = data.events
    .map(e => {
      const w = e.measured['90'] || e.measured['30'] || e.measured['180'];
      return { e, eff: w && w.changePct != null ? w.changePct : null };
    })
    .filter(x => x.eff != null)
    .sort((a, b) => Math.abs(b.eff) - Math.abs(a.eff))
    .slice(0, limit);
  if (!scored.length) return null;
  let m = `\u{1F4C8} <b>EFFETTO CATALIZZATORI</b> (indice di brand dopo la news)\n`;
  for (const { e } of scored) {
    const w30 = e.measured['30'], w90 = e.measured['90'], w180 = e.measured['180'];
    const fmt = (x) => x && x.changePct != null ? `${x.changePct >= 0 ? '+' : ''}${x.changePct}%` : '\u2014';
    m += `\n\u2022 <b>${e.brand}</b> \u2014 ${e.type}\n`;
    m += `  base \u20AC${e.baseline.med || '?'} \u2192 30g ${fmt(w30)} \u00B7 90g ${fmt(w90)} \u00B7 180g ${fmt(w180)}\n`;
  }
  m += `\n<i>Indice = mediana dei prezzi visti dal bot per quel marchio. Effetto positivo e crescente = finestra ancora aperta.</i>`;
  return m;
}

function summary() {
  return {
    brandTracked: Object.keys(data.brandIndex).length,
    events: data.events.length,
    brandIndex: Object.values(data.brandIndex).map(b => ({
      brand: b.brand, obs: b.obs.length,
      medAllTime: median(b.obs.map(o => o.price)),
    })),
    eventList: data.events,
  };
}

function exportData() { return data; }

module.exports = {
  load, save, recordPrice, recordEvent, measureAll, telegramReport, summary, exportData,
  brandKey, WINDOWS, MIN_OBS,
};
