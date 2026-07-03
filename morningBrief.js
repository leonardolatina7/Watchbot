/**
 * morningBrief.js — LA RASSEGNA STAMPA DELLE 8:00
 * ============================================================
 *
 * COSA FA:
 *  - Ogni mattina alle 8:00 ora italiana manda UN messaggio Telegram con
 *    TUTTE le news orologiere uscite nelle ultime 24 ore dalle testate
 *    autorevoli (Hodinkee, Fratello, Monochrome, WatchPro, Oracle Time,
 *    Time+Tide, aBlogtoWatch, WatchTime, Worn&Wound, SJX, Europa Star,
 *    Time and Watches, Quill&Pad).
 *  - NON filtra per "catalizzatore": vuoi TUTTO, anche le news più stupide.
 *    (Il filtro catalizzatore è l'altro modulo, catalystWatch.js.)
 *  - Raggruppa per FONTE (prima Hodinkee coi suoi titoli, poi Fratello, ecc.)
 *    così al mattino scorri le testate e apri solo quello che ti interessa.
 *  - Tetto di ~35 news per non intasare Telegram.
 *  - Anti-doppione: ricorda i link già mandati (così se rigira non ripete).
 *
 * PERCHÉ GOOGLE NEWS E NON I FEED DIRETTI:
 *  - I feed RSS diretti delle testate spesso bloccano i bot (403).
 *  - Google News RSS con "site:dominio" restituisce gli articoli di QUELLA
 *    testata, in formato pulito, ed è la STESSA tecnica che catalystWatch.js
 *    già usa con successo in produzione su Render. Robusto e gratis.
 *
 * DIPENDENZE: solo axios (già nel progetto). Nessun pacchetto nuovo.
 *
 * USO (in index.js):
 *   const morningBrief = require('./morningBrief');
 *   // 8:00 ora italiana. Render gira in UTC: mettere l'ora giusta col fuso.
 *   cron.schedule('0 8 * * *', () =>
 *     morningBrief.runMorningBrief({ tg, db, saveState }),
 *     { timezone: 'Europe/Rome' }
 *   );
 *   // endpoint di prova manuale:
 *   app.get('/api/brief', async (req,res)=>{ await morningBrief.runMorningBrief({tg,db,saveState,force:true}); res.json({ok:true}); });
 */

const axios = require('axios');

// ── FONTI AUTOREVOLI (nome mostrato → dominio) ──────────────
// Aggiungere/togliere qui è tutto ciò che serve per cambiare le fonti.
const SOURCES = [
  { name: '🟠 Hodinkee',        domain: 'hodinkee.com' },
  { name: '🔵 Fratello',        domain: 'fratellowatches.com' },
  { name: '⚫ Monochrome',      domain: 'monochrome-watches.com' },
  { name: '🟣 WatchPro',        domain: 'watchpro.com' },
  { name: '🟡 Oracle Time',     domain: 'oracleoftime.com' },
  { name: '🔴 Time+Tide',       domain: 'timeandtidewatches.com' },
  { name: '🟢 aBlogtoWatch',    domain: 'ablogtowatch.com' },
  { name: '⚪ WatchTime',       domain: 'watchtime.com' },
  { name: '🟤 Worn & Wound',    domain: 'wornandwound.com' },
  { name: '🔶 SJX',             domain: 'watchesbysjx.com' },
  { name: '🔷 Europa Star',     domain: 'europastar.com' },
  { name: '🟩 Time and Watches',domain: 'timeandwatches.com' },
  { name: '🟪 Quill & Pad',     domain: 'quillandpad.com' },
  { name: '🇮🇹 Orafix',         domain: 'orafix.com' },
];

const MAX_TOTAL   = 42;   // tetto news per messaggio (14 fonti, +Orafix IT)
const MAX_PER_SRC = 6;    // massimo per singola testata (equità tra fonti)
const MAX_AGE_H   = 26;   // finestra: ultime ~24h (26 di margine per il fuso)
const STATE_KEY   = 'morningBriefSeen'; // dove ricordo i link già inviati

// ── Parsing RSS senza librerie (identico a catalystWatch, collaudato) ──
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
  return String(str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}
function parseRssItems(xml) {
  const items = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const title = decodeEntities(extractTag(b, 'title'));
    const link = extractTag(b, 'link');
    const pubDate = extractTag(b, 'pubDate');
    if (title) items.push({ title, link, pubDate });
  }
  return items;
}

// Google News per-fonte: gli articoli di UNA testata, formato RSS pulito.
function googleNewsSiteUrl(domain) {
  const q = encodeURIComponent(`site:${domain}`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchSource(src) {
  try {
    const r = await axios.get(googleNewsSiteUrl(src.domain), {
      headers: { 'User-Agent': 'Mozilla/5.0 (WatchbotMorningBrief/1.0)' },
      timeout: 12000,
      responseType: 'text',
    });
    return parseRssItems(r.data).map(it => ({ ...it, sourceName: src.name }));
  } catch (e) {
    console.warn(`[brief] ${src.name}: fetch fallito — ${e.response?.status || e.message}`);
    return [];
  }
}

// news delle ultime MAX_AGE_H ore?
function isRecent(pubDate) {
  if (!pubDate) return true; // se manca la data, non la scarto (meglio in più che in meno)
  const d = new Date(pubDate);
  if (isNaN(d)) return true;
  return (Date.now() - d.getTime()) <= MAX_AGE_H * 3600 * 1000;
}

// Google News avvolge il link: "…&url=LINKVERO" a volte. Pulisco se possibile.
function cleanLink(link) {
  if (!link) return link;
  const m = link.match(/[?&]url=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { /* ignore */ } }
  return link;
}

// Titolo Google News finisce spesso con " - NomeTestata": lo tolgo (la fonte
// la mostro io a parte).
function cleanTitle(title) {
  return String(title || '').replace(/\s+-\s+[^-]+$/, '').trim();
}

// ── STATO (anti-doppione) ───────────────────────────────────
// Riuso il db del bot se passato; altrimenti memoria volatile.
function loadSeen(db) {
  try {
    if (db && db[STATE_KEY] && Array.isArray(db[STATE_KEY])) return new Set(db[STATE_KEY]);
  } catch { /* ignore */ }
  return new Set();
}
function saveSeen(db, seenSet, saveState) {
  try {
    if (db) {
      db[STATE_KEY] = [...seenSet].slice(-800); // memoria limitata
      if (typeof saveState === 'function') saveState();
    }
  } catch (e) { console.warn('[brief] salvataggio stato fallito:', e.message); }
}

// ── COMPOSIZIONE DEL MESSAGGIO ──────────────────────────────
function buildMessage(bySource, totalCount) {
  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  let m = `☕ <b>RASSEGNA STAMPA OROLOGI — ${oggi}</b>\n`;
  m += `<i>Tutte le news di oggi dalle fonti autorevoli. ${totalCount} titoli.</i>\n`;
  for (const src of SOURCES) {
    const list = bySource[src.name];
    if (!list || !list.length) continue;
    m += `\n<b>${src.name}</b>\n`;
    for (const it of list) {
      const t = cleanTitle(it.title);
      const link = cleanLink(it.link);
      m += `• <a href="${link}">${t}</a>\n`;
    }
  }
  m += `\n<i>Buona giornata e buona caccia. 🕵️</i>`;
  return m;
}

// Telegram limita i messaggi a ~4096 caratteri: spezzo se serve.
function splitForTelegram(text, limit = 3900) {
  if (text.length <= limit) return [text];
  const parts = [];
  const lines = text.split('\n');
  let buf = '';
  for (const line of lines) {
    if ((buf + '\n' + line).length > limit) { parts.push(buf); buf = line; }
    else buf = buf ? buf + '\n' + line : line;
  }
  if (buf) parts.push(buf);
  return parts;
}

// ── FUNZIONE PRINCIPALE ─────────────────────────────────────
// opts: { tg, db, saveState, force }
//   tg(text)   = invia su Telegram (obbligatoria)
//   db         = oggetto stato del bot per l'anti-doppione (opzionale)
//   saveState  = persiste db (opzionale)
//   force      = ignora l'anti-doppione (per test manuali via /api/brief)
async function runMorningBrief(opts = {}) {
  const { tg, db, saveState, force = false } = opts;
  if (typeof tg !== 'function') { console.warn('[brief] manca tg(), esco'); return { sent: 0 }; }

  const seen = force ? new Set() : loadSeen(db);
  const bySource = {};
  let total = 0;

  // Scarico tutte le fonti in parallelo (veloce; ognuna col suo try/catch)
  const results = await Promise.all(SOURCES.map(fetchSource));

  for (let i = 0; i < SOURCES.length; i++) {
    const src = SOURCES[i];
    const items = results[i] || [];
    const fresh = [];
    for (const it of items) {
      if (fresh.length >= MAX_PER_SRC) break;
      if (total >= MAX_TOTAL) break;
      if (!isRecent(it.pubDate)) continue;
      const link = cleanLink(it.link);
      const fp = link || it.title;
      if (seen.has(fp)) continue;      // già mandata in un giro precedente
      seen.add(fp);
      fresh.push(it);
      total++;
    }
    if (fresh.length) bySource[src.name] = fresh;
    if (total >= MAX_TOTAL) break;
  }

  if (total === 0) {
    // Onesto: se non è uscito nulla di nuovo, lo dico invece di tacere.
    await tg('☕ <b>Rassegna stampa orologi</b>\n<i>Stamattina nessuna news nuova dalle fonti seguite (o feed non raggiungibili). Riprovo domani.</i>');
    console.log('[brief] nessuna news nuova');
    return { sent: 0 };
  }

  const msg = buildMessage(bySource, total);
  const chunks = splitForTelegram(msg);
  for (const c of chunks) {
    try { await tg(c); } catch (e) { console.warn('[brief] invio fallito:', e.message); }
  }

  saveSeen(db, seen, saveState);
  console.log(`[brief] rassegna inviata: ${total} news da ${Object.keys(bySource).length} fonti, ${chunks.length} messaggi`);
  return { sent: total, sources: Object.keys(bySource).length };
}

module.exports = { runMorningBrief, SOURCES, MAX_TOTAL };
