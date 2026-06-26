/**
 * portfolio.js — MEMORIA DELLE DECISIONI + P&L
 * ────────────────────────────────────────────────────────────────────────
 * Il bot fino a v12.4 NON ricordava nulla di ciò che Leonardo compra o passa.
 * Questo modulo chiude il buco: registra ogni decisione (COMPRATO / PASSATO /
 * VENDUTO) con prezzo reale, costi accessori (diritti asta, spedizione,
 * revisione) e — sui venduti — calcola il P&L vero.
 *
 * PERCHÉ CONTA PER LA TESI:
 *  - Trasforma il bot da "cercatore" a "diario di trading": sai quanto capitale
 *    è immobilizzato, in cosa, da quanto tempo, e quanto hai guadagnato davvero.
 *  - Sui PASSATI tieni memoria del perché (verdetto + prezzo): se quel pezzo poi
 *    sale, impari; se scende, hai avuto ragione. È la base per affinare la tesi.
 *
 * ARCHITETTURA: coerente con priceTracker — persistenza su DATA_DIR (Render
 * Disk / Gist), nessuna dipendenza nuova, controllato via endpoint HTTP perché
 * il bot è solo-invio su Telegram (non riceve comandi chat).
 *
 * COSTI REALI (regole Leonardo, applicati in automatico):
 *  - Bidinside/Nomisma: +21% diritti + €15 packaging
 *  - eBay/PayPal: +~3% fee
 *  - Catawiki: +~20% diritti
 *  Si possono passare costi manuali che hanno la precedenza.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : '/tmp');
const PF_FILE = path.join(DATA_DIR, 'watchbot-portfolio.json');

// stato: { items: [ {id, stato, brand, model, prezzo, costiAccessori, costoReale,
//                     piattaforma, calibro, metallo, note, verdetto, at, soldAt, soldPrice, pnl} ] }
let pf = { items: [] };

function load() {
  try {
    if (fs.existsSync(PF_FILE)) {
      pf = JSON.parse(fs.readFileSync(PF_FILE, 'utf8')) || { items: [] };
      if (!Array.isArray(pf.items)) pf.items = [];
      console.log(`[PORTFOLIO] Caricato: ${pf.items.length} voci`);
    }
  } catch (e) { console.error('[PORTFOLIO] load KO:', e.message); pf = { items: [] }; }
}

function save() {
  try { fs.writeFileSync(PF_FILE, JSON.stringify(pf)); }
  catch (e) { console.error('[PORTFOLIO] save KO:', e.message); }
}

function nid() { return 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Costi accessori automatici per piattaforma ─────────────────────────────
function costiPiattaforma(prezzo, piattaforma) {
  const p = String(piattaforma || '').toLowerCase();
  if (p.includes('bidinside') || p.includes('nomisma')) {
    return Math.round(prezzo * 0.21) + 15;        // 21% diritti + 15 packaging
  }
  if (p.includes('catawiki')) {
    return Math.round(prezzo * 0.20);             // ~20% diritti
  }
  if (p.includes('ebay') || p.includes('paypal')) {
    return Math.round(prezzo * 0.03);             // ~3% fee
  }
  return 0;
}

// ── Registra una decisione ─────────────────────────────────────────────────
// in: { stato:'comprato'|'passato'|'venduto', brand, model, prezzo, piattaforma,
//       calibro, metallo, note, verdetto, costiManuali }
function record(input) {
  const prezzo = Number(input.prezzo) || 0;
  const costi = (input.costiManuali != null)
    ? Number(input.costiManuali)
    : costiPiattaforma(prezzo, input.piattaforma);
  const item = {
    id: nid(),
    stato: (input.stato || 'comprato').toLowerCase(),
    brand: input.brand || '',
    model: input.model || '',
    prezzo,
    costiAccessori: costi,
    costoReale: prezzo + costi,
    piattaforma: input.piattaforma || '',
    calibro: input.calibro || '',
    metallo: input.metallo || '',
    note: input.note || '',
    verdetto: input.verdetto || '',
    at: new Date().toISOString(),
    soldAt: null, soldPrice: null, pnl: null,
  };
  pf.items.unshift(item);
  save();
  return item;
}

// ── Segna come venduto (per id) e calcola P&L ──────────────────────────────
function markSold(id, soldPrice, soldCosti = 0) {
  const it = pf.items.find(x => x.id === id);
  if (!it) return null;
  it.stato = 'venduto';
  it.soldPrice = Number(soldPrice) || 0;
  it.soldAt = new Date().toISOString();
  it.pnl = Math.round(it.soldPrice - it.costoReale - (Number(soldCosti) || 0));
  save();
  return it;
}

function remove(id) {
  const n = pf.items.length;
  pf.items = pf.items.filter(x => x.id !== id);
  save();
  return n !== pf.items.length;
}

// ── Sintesi capitale + P&L ─────────────────────────────────────────────────
function summary() {
  const inMano = pf.items.filter(x => x.stato === 'comprato');
  const venduti = pf.items.filter(x => x.stato === 'venduto');
  const passati = pf.items.filter(x => x.stato === 'passato');
  const capitaleImmobilizzato = inMano.reduce((s, x) => s + (x.costoReale || 0), 0);
  const pnlRealizzato = venduti.reduce((s, x) => s + (x.pnl || 0), 0);
  const giorni = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
  return {
    nInMano: inMano.length, nVenduti: venduti.length, nPassati: passati.length,
    capitaleImmobilizzato, pnlRealizzato,
    inMano: inMano.map(x => ({ ...x, giorniInMano: giorni(x.at) })),
    venduti, passati,
  };
}

// ── Report Telegram ────────────────────────────────────────────────────────
function telegramReport() {
  const s = summary();
  if (s.nInMano === 0 && s.nVenduti === 0 && s.nPassati === 0) return null;
  let m = `\u{1F4BC} <b>PORTAFOGLIO</b>\n`;
  m += `In mano: <b>${s.nInMano}</b> · Capitale fermo: <b>\u20AC${s.capitaleImmobilizzato.toLocaleString('it-IT')}</b>\n`;
  m += `Venduti: <b>${s.nVenduti}</b> · P&L realizzato: <b>${s.pnlRealizzato >= 0 ? '+' : ''}\u20AC${s.pnlRealizzato.toLocaleString('it-IT')}</b>\n`;
  m += `Passati (memoria): <b>${s.nPassati}</b>\n`;
  if (s.inMano.length) {
    m += `\n<b>In portafoglio:</b>\n`;
    s.inMano.slice(0, 15).forEach(x => {
      m += `\u2022 ${x.brand} ${x.model} \u2014 \u20AC${x.costoReale.toLocaleString('it-IT')} (${x.giorniInMano}gg)\n`;
    });
  }
  return m;
}

module.exports = {
  load, save, record, markSold, remove, summary, telegramReport, costiPiattaforma,
  get items() { return pf.items; },
};
