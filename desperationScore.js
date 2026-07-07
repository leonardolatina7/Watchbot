/**
 * desperationScore.js — MEMORIA PREZZI + PUNTEGGIO "DISPERAZIONE VENDITORE"
 * (v1.0, 07/07/26 — richiesta Leonardo: vantaggio competitivo proprietario)
 *
 * COSA FA, in parole semplici:
 * Il bot si RICORDA ogni annuncio che vede (impronta dal titolo). Quando lo
 * rivede, capisce se: (a) è stato ripubblicato, (b) il prezzo è sceso,
 * (c) è in vendita da tanto. In più legge nel testo i segnali di urgenza
 * ("vendo per necessità", "trasloco", "Nachlass", "urgent"...) in 6 lingue.
 * Da tutto questo tira fuori un punteggio 0-10: quanto quel venditore è
 * probabile che accetti un forte ribasso. Il punteggio alimenta direttamente
 * il metodo "piangere il morto": apertura base 25% sotto, +1,5% per punto,
 * tetto 40%.
 *
 * PERCHÉ È UN VANTAGGIO: in 3-6 mesi questa memoria diventa un database
 * prezzi PROPRIETARIO (chi ha ribassato, quanto, in quanto tempo) che nessun
 * concorrente ha. Il valore cresce da solo a ogni scansione.
 *
 * MEMORIA: compatta e limitata (max 600 voci, 8 prezzi per voce) così sta
 * comoda nel Gist insieme al resto dello stato. Persistenza via
 * exportState()/importState() agganciate a saveState/loadState di index.js.
 */
'use strict';

const MAX_ENTRIES = 600;   // tetto voci in memoria (le più vecchie escono)
const MAX_PRICES = 8;      // tetto storico prezzi per voce
const RELIST_GAP_MS = 5 * 24 * 3600000; // rivisto dopo 5+ giorni = riapparizione

// mem: fp -> { f: primoAvvistamento(ms), l: ultimoAvvistamento(ms),
//              n: numeroApparizioni, p: [[prezzo, ms]...], u: ultimoUrl }
let mem = {};

// ── Impronta dal titolo: minuscole, solo lettere/numeri, max 64 caratteri.
//    Regge al cambio di URL (ripubblicazioni) e a piccole differenze di
//    punteggiatura. NON regge a un titolo riscritto da zero (accettabile).
function normFp(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

// ── Segnali di urgenza multilingua (IT/DE/FR/ES/PL/EN).
//    ATTENZIONE falsi amici: NIENTE "estate" da solo (in italiano è la
//    stagione) — solo "estate sale". "urge" con \b per non prendere "urgenza
//    di..." dentro altre parole a caso.
const URGENCY = [
  { re: /(urgente|urgent\b|dringend|pilne|pilnie|\burge\b)/i,                                  w: 3, tag: 'urgenza' },
  { re: /(vendo per necessit|per bisogno|realizzo|svendo|must sell|need gone|quick sale)/i,    w: 3, tag: 'necessità dichiarata' },
  { re: /(trasloco|trasferimento|umzug|d[ée]m[ée]nagement|mudanza|moving out|moving abroad)/i, w: 2, tag: 'trasloco' },
  { re: /(eredit\u00e0|ereditat|nachlass|haushaltsaufl|succession\b|spadek|estate sale)/i,     w: 2, tag: 'eredità' },
  { re: /(trattabil|verhandlungsbasis|\bvb\b|[àa] d[ée]battre|negociable|do negocjacji|\bobo\b)/i, w: 1, tag: 'trattabile' },
  { re: /(ultimo prezzo|prezzo finale|letzter preis|last price|precio final)/i,                w: 1, tag: 'ultimo prezzo' },
];

// ── Registra un avvistamento. Da chiamare per OGNI annuncio valido che passa
//    i filtri categoria (prima delle decisioni di alert): è la raccolta dati.
function observe(listing) {
  const fp = normFp(listing && listing.title);
  const price = Number(listing && listing.price) || 0;
  if (!fp || price <= 0) return;
  const now = Date.now();
  let e = mem[fp];
  if (!e) {
    mem[fp] = { f: now, l: now, n: 1, p: [[price, now]], u: (listing.url || '') };
    _pruneIfNeeded();
    return;
  }
  const gap = now - e.l;
  const urlChanged = !!(listing.url && e.u && listing.url !== e.u);
  if (gap > RELIST_GAP_MS || urlChanged) e.n++;
  e.l = now;
  if (listing.url) e.u = listing.url;
  const lastP = e.p.length ? e.p[e.p.length - 1][0] : null;
  // registro il prezzo solo se è cambiato di più del 2% (niente rumore)
  if (lastP === null || Math.abs(price - lastP) / lastP > 0.02) {
    e.p.push([price, now]);
    if (e.p.length > MAX_PRICES) e.p = e.p.slice(-MAX_PRICES);
  }
}

// ── Punteggio 0-10 + motivi + apertura suggerita per la trattativa.
function score(listing) {
  const text = `${(listing && listing.title) || ''} ${(listing && listing.description) || ''}`;
  let s = 0;
  const reasons = [];
  for (const { re, w, tag } of URGENCY) {
    if (re.test(text)) { s += w; reasons.push(tag); }
  }
  const fp = normFp(listing && listing.title);
  const e = mem[fp];
  let dropPct = 0, relist = 0, ageDays = 0;
  if (e) {
    relist = Math.max(0, e.n - 1);
    ageDays = Math.round((Date.now() - e.f) / 86400000);
    const first = e.p[0] && e.p[0][0];
    const last = e.p[e.p.length - 1] && e.p[e.p.length - 1][0];
    if (first && last && last < first) dropPct = Math.round((1 - last / first) * 100);
    if (dropPct >= 20) { s += 3; reasons.push(`prezzo \u2212${dropPct}%`); }
    else if (dropPct >= 10) { s += 2; reasons.push(`prezzo \u2212${dropPct}%`); }
    if (relist >= 3) { s += 3; reasons.push(`${relist + 1}\u00aa apparizione`); }
    else if (relist >= 1) { s += 2; reasons.push(`riapparso ${relist}x`); }
    if (ageDays >= 60) { s += 2; reasons.push(`in vendita da ${ageDays}gg`); }
    else if (ageDays >= 30) { s += 1; reasons.push(`in vendita da ${ageDays}gg`); }
  }
  s = Math.min(10, s);
  // apertura "piangere il morto": base 25% + 1,5% per punto, tetto 40%
  const suggestedOpenPct = Math.min(40, 25 + Math.round(s * 1.5));
  return { score: s, reasons, suggestedOpenPct, dropPct, relist, ageDays };
}

// ── Riga pronta per l'alert Telegram. Vuota sotto punteggio 4 (niente rumore:
//    la riga compare solo quando c'è pressione VERA sul venditore).
function telegramLine(listing) {
  const r = score(listing);
  if (r.score < 4) return '';
  return `\u{1F3AF} <b>Venditore sotto pressione ${r.score}/10</b> (${r.reasons.join(', ')}) \u2192 apri a \u2212${r.suggestedOpenPct}%\n`;
}

// ── Potatura: tengo le MAX_ENTRIES voci viste più di recente.
function _pruneIfNeeded() {
  const keys = Object.keys(mem);
  if (keys.length <= MAX_ENTRIES) return;
  keys.sort((a, b) => (mem[b].l || 0) - (mem[a].l || 0)); // più recenti prima
  const keep = {};
  for (const k of keys.slice(0, MAX_ENTRIES)) keep[k] = mem[k];
  mem = keep;
}

// ── Persistenza (agganciata a saveState/loadState di index.js).
function exportState() { _pruneIfNeeded(); return mem; }

// importState: sostituisce (default) o FONDE tenendo per ogni voce quella
// con l'avvistamento più recente (merge:true — usato per l'overlay Gist).
function importState(obj, opts) {
  if (!obj || typeof obj !== 'object') return;
  if (opts && opts.merge) {
    for (const [k, v] of Object.entries(obj)) {
      if (!v || typeof v !== 'object') continue;
      const cur = mem[k];
      if (!cur || (v.l || 0) > (cur.l || 0)) mem[k] = v;
    }
  } else {
    mem = obj;
  }
  _pruneIfNeeded();
}

function statsSummary() { return { voci: Object.keys(mem).length }; }

module.exports = { observe, score, telegramLine, exportState, importState, normFp, statsSummary };
