/**
 * coldAuctions.js — CANALI FREDDI: aste giudiziarie IT + dogana DE
 * (v1.0, 07/07/26 — richiesta Leonardo: vantaggio competitivo strutturale)
 *
 * COSA FA, in parole semplici:
 * Due sorgenti dove i dealer con i bot NON guardano:
 *  1) PVP — Portale Vendite Pubbliche del Ministero della Giustizia: per legge
 *     OGNI vendita giudiziaria italiana (fallimenti, pignoramenti, eredità
 *     giacenti) passa da qui. Gli orologi nei lotti "beni mobili" sono spesso
 *     periziati A PESO dal CTU del tribunale — esattamente la formula melt.
 *     A ogni asta deserta la base scende del 20-25%.
 *  2) Zoll-Auktion — il portale UFFICIALE delle dogane tedesche: merce
 *     sequestrata venduta all'asta. Leonardo legge il tedesco nativo; quasi
 *     nessun dealer italiano lo batte.
 *
 * NOTA ONESTA (importante): dalla sandbox di sviluppo questi due portali NON
 * sono raggiungibili, quindi gli endpoint qui sotto sono i migliori noti ma
 * NON verificati dal vivo. Per questo il modulo è costruito a STRATI
 * (API JSON → HTML → ancore generiche) e logga TUTTO (status, lunghezza HTML,
 * conteggi): al primo giro sui log Render si vede subito se un selettore va
 * ritoccato. C'è anche autotest() per il messaggio di avvio e l'endpoint
 * /api/coldauctions per provarlo a mano.
 *
 * FILTRI: WATCH_RE tiene solo gli orologi; NOISE_RE butta pendole/sveglie/
 * orologi da parete (fuori tesi); GOLD_RE marca i lotti con segnale-oro (🥇).
 */
'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const WATCH_RE = /(orolog\w*|armbanduhr|taschenuhr|\buhr\b|\buhren\b|chronograph|cronografo|wristwatch)/i;
const GOLD_RE = /(\boro\b|\bgold\b|\b750\b|18\s*k|massiccio|golduhr)/i;
const NOISE_RE = /(parete|da muro|wanduhr|standuhr|pendol|sveglia|radiosveglia|cuc[u\u00f9]|kuckuck|tischuhr|wecker)/i;

// ── Prezzo europeo dal testo: "€ 1.250,00" / "1.250 EUR" / "€1250".
function parsePriceEu(t) {
  const s = String(t || '').replace(/\s+/g, ' ');
  const m = s.match(/(\d{1,3}(?:[.\u00a0 ]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:\u20ac|EUR)/i)
        || s.match(/\u20ac\s*(\d{1,3}(?:[.\u00a0 ]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/[.\u00a0 ]/g, '').replace(',', '.')) || 0;
}

function absUrl(base, href) {
  try { return new URL(href, base).href; } catch { return ''; }
}

// ── Estrazione GENERICA a prova di redesign: prendo le ancore che puntano a
//    pagine di dettaglio (href che matcha hrefRe), il titolo dall'ancora o
//    dal contenitore, il prezzo dal testo del contenitore. Niente selettori
//    fragili legati a classi CSS specifiche.
function mineAnchors($, { base, hrefRe, max = 15 }) {
  const seen = new Set();
  const out = [];
  $('a[href]').each((_, a) => {
    if (out.length >= max) return;
    const href = $(a).attr('href') || '';
    if (!hrefRe.test(href)) return;
    const url = absUrl(base, href);
    if (!url || seen.has(url)) return;
    let title = $(a).text().replace(/\s+/g, ' ').trim();
    const $box = $(a).closest('li, article, tr, .card, .risultato, .item, div');
    if (title.length < 8) {
      title = $box.find('h1,h2,h3,h4,[class*="titolo"],[class*="title"]').first().text().replace(/\s+/g, ' ').trim() || title;
    }
    if (!title || title.length < 8) return;
    if (!WATCH_RE.test(title)) return;
    if (NOISE_RE.test(title)) return;
    const boxText = $box.text().replace(/\s+/g, ' ').slice(0, 800);
    const price = parsePriceEu(boxText);
    seen.add(url);
    out.push({ title: title.slice(0, 110), price, url, gold: GOLD_RE.test(title) || GOLD_RE.test(boxText) });
  });
  return out;
}

// ══════════════ PVP — Portale Vendite Pubbliche (giustizia.it) ══════════════
async function scanPVP(max = 15) {
  const diag = { source: 'PVP', steps: [], found: 0 };
  const items = [];

  // STRATO 1 — tentativo API JSON interna (il portale è una SPA: se uno di
  // questi endpoint risponde JSON, è la via pulita e stabile).
  const apiCandidates = [
    'https://pvp.giustizia.it/pvp/api/ricerca/vendite?testoLibero=orologio&page=0&size=30',
    'https://pvp.giustizia.it/pvp-api/ricerca/vendite?testoLibero=orologio&page=0&size=30',
  ];
  for (const u of apiCandidates) {
    try {
      const r = await axios.get(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 20000, validateStatus: (s) => s < 500 });
      const ct = String(r.headers['content-type'] || '');
      diag.steps.push({ via: 'api', status: r.status, ct: ct.slice(0, 30) });
      if (r.status === 200 && ct.includes('json') && r.data) {
        const arr = r.data.content || r.data.vendite || r.data.risultati || r.data.items || (Array.isArray(r.data) ? r.data : []);
        for (const v of (arr || []).slice(0, max * 2)) {
          const title = String(v.titolo || v.descrizione || v.denominazione || '').replace(/\s+/g, ' ').trim();
          if (!title || !WATCH_RE.test(title) || NOISE_RE.test(title)) continue;
          const price = Number(v.prezzoBase || v.prezzoValore || v.offertaMinima || 0) || parsePriceEu(JSON.stringify(v).slice(0, 400));
          const id = v.id || v.idVendita || v.idInserzione || '';
          const url = id ? `https://pvp.giustizia.it/pvp/it/dettaglio_annuncio.page?idVendita=${encodeURIComponent(id)}` : 'https://pvp.giustizia.it';
          items.push({ source: 'PVP \u2696\ufe0f giudiziario IT', title: title.slice(0, 110), price, currency: 'EUR', url, gold: GOLD_RE.test(title) });
          if (items.length >= max) break;
        }
        if (items.length) { diag.found = items.length; diag.winner = 'api'; return { items, diag }; }
      }
    } catch (e) {
      diag.steps.push({ via: 'api', err: String(e.code || e.message || '').slice(0, 60) });
    }
    await sleep(800);
  }

  // STRATO 2 — fallback HTML: pagina risultati + estrazione ancore generica.
  for (const kw of ['orologio', 'orologi oro']) {
    try {
      const u = `https://pvp.giustizia.it/pvp/it/risultati_ricerca.page?testoLibero=${encodeURIComponent(kw)}`;
      const r = await axios.get(u, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'it-IT' }, timeout: 20000, validateStatus: (s) => s < 500, maxRedirects: 5 });
      diag.steps.push({ via: 'html', kw, status: r.status, len: String(r.data || '').length });
      if (r.status !== 200) continue;
      const $ = cheerio.load(String(r.data || ''));
      const mined = mineAnchors($, { base: 'https://pvp.giustizia.it', hrefRe: /dettaglio|annuncio|vendita|lotto/i, max });
      for (const m of mined) {
        if (!items.some((x) => x.url === m.url)) items.push({ source: 'PVP \u2696\ufe0f giudiziario IT', currency: 'EUR', ...m });
        if (items.length >= max) break;
      }
      if (items.length >= max) break;
    } catch (e) {
      diag.steps.push({ via: 'html', kw, err: String(e.code || e.message || '').slice(0, 60) });
    }
    await sleep(1200);
  }
  diag.found = items.length;
  if (items.length) diag.winner = 'html';
  return { items, diag };
}

// ══════════════ ZOLL-AUKTION — dogana tedesca (zoll-auktion.de) ══════════════
async function scanZoll(max = 15) {
  const diag = { source: 'Zoll', steps: [], found: 0 };
  const items = [];
  // URL di ricerca candidati (sito PHP storico: la prima forma che rende è
  // quella giusta; le altre non costano nulla).
  const tries = [
    'https://www.zoll-auktion.de/auktion/suchergebnisse.php?suchwort=armbanduhr',
    'https://www.zoll-auktion.de/auktion/suche.php?suchwort=armbanduhr',
    'https://www.zoll-auktion.de/auktion/index.php?such=armbanduhr',
  ];
  for (const u of tries) {
    try {
      const r = await axios.get(u, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'de-DE' }, timeout: 20000, validateStatus: (s) => s < 500, maxRedirects: 5 });
      diag.steps.push({ url: u.split('?')[0].split('/').pop(), status: r.status, len: String(r.data || '').length });
      if (r.status !== 200) continue;
      const $ = cheerio.load(String(r.data || ''));
      const mined = mineAnchors($, { base: 'https://www.zoll-auktion.de', hrefRe: /detail|artikel|id=\d+/i, max });
      for (const m of mined) {
        if (!items.some((x) => x.url === m.url)) items.push({ source: 'Zoll \u{1F1E9}\u{1F1EA} dogana DE', currency: 'EUR', ...m });
        if (items.length >= max) break;
      }
      if (items.length) { diag.winner = u.split('/').pop().split('?')[0]; break; }
    } catch (e) {
      diag.steps.push({ url: u.split('?')[0].split('/').pop(), err: String(e.code || e.message || '').slice(0, 60) });
    }
    await sleep(1000);
  }
  diag.found = items.length;
  return { items, diag };
}

// ══════════════ ORCHESTRAZIONE ══════════════
async function scanAll({ maxPerSource = 15 } = {}) {
  const [p, z] = await Promise.allSettled([scanPVP(maxPerSource), scanZoll(maxPerSource)]);
  const items = [];
  const diag = [];
  for (const r of [p, z]) {
    if (r.status === 'fulfilled') { items.push(...r.value.items); diag.push(r.value.diag); }
    else diag.push({ err: String((r.reason && r.reason.message) || r.reason || '').slice(0, 80) });
  }
  return { items, diag };
}

function formatTelegram(items) {
  const by = {};
  for (const it of items) (by[it.source] = by[it.source] || []).push(it);
  let msg = `\u{1F9CA} <b>CANALI FREDDI \u2014 aste giudiziarie & dogana</b>\n` +
            `<i>Perizie spesso a peso, concorrenza minima. Qui il melt vince.</i>\n`;
  for (const [src, list] of Object.entries(by)) {
    msg += `\n<b>${src}</b>\n`;
    for (const it of list.slice(0, 10)) {
      msg += `\u2022 ${it.gold ? '\u{1F947} ' : ''}${it.title}` +
             `${it.price ? ` \u2014 base <b>\u20ac${Math.round(it.price).toLocaleString('it-IT')}</b>` : ''}\n` +
             `  <a href="${it.url}">apri il lotto</a>\n`;
    }
  }
  msg += `\n\u26a0\ufe0f Regole dei canali freddi: NIENTE resi, lotti spesso misti (ispezione da Boni prima di offrire), ` +
         `possibile ritiro in loco (Zoll = Germania), diritti d'asta variabili per tribunale. ` +
         `Asta deserta = base che scende: segnati il lotto e aspetta il ribasso.`;
  return msg;
}

// ── Autotest raggiungibilità per il messaggio di avvio.
async function autotest() {
  const out = {};
  const targets = [
    ['pvp', 'https://pvp.giustizia.it/pvp/it/homepage.page'],
    ['zoll', 'https://www.zoll-auktion.de/'],
  ];
  for (const [k, u] of targets) {
    try {
      const r = await axios.get(u, { headers: { 'User-Agent': UA }, timeout: 10000, validateStatus: () => true, maxRedirects: 5 });
      out[k] = { ok: r.status === 200, status: r.status };
    } catch (e) {
      out[k] = { ok: false, err: String(e.code || e.message || '').slice(0, 50) };
    }
  }
  return out;
}

module.exports = {
  scanAll, scanPVP, scanZoll, formatTelegram, autotest,
  _test: { parsePriceEu, mineAnchors, WATCH_RE, GOLD_RE, NOISE_RE },
};
