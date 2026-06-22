// ── RADAR PREMI & NOTIZIE INDIE ───────────────────────────────────────────
// Tiene informato su GPHG, Louis Vuitton Watch Prize, Only Watch e sugli indie
// seguiti, leggendo i feed Google News (formato RSS stabile: niente scraping
// fragile). Deduplica con un set persistente e manda solo le novità su Telegram.
//
// Uso da index.js:
//   const awardsRadar = require('./awardsRadar');
//   awardsRadar.checkAll(tg).catch(e=>console.error('[AWARDS]',e.message));
// dove tg(text) è la stessa funzione Telegram del bot.
//
// Persistenza: DATA_DIR (disco Render) se presente, altrimenti /tmp (fallback).
// Per non spammare dopo un riavvio, posta solo gli articoli usciti negli ultimi
// MAX_AGE_DAYS giorni e ricorda i link già inviati.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/tmp';
const SEEN_FILE = path.join(DATA_DIR, 'awardsSeen.json');
const MAX_AGE_DAYS = 21;          // ignora articoli più vecchi (anti-spam post-riavvio)
const MAX_PER_RUN  = 12;          // tetto di articoli inviati per ciclo

// hl=it: titoli in italiano dove possibile; gl/ceid per il bacino notizie.
const NEWS = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=it&gl=IT&ceid=IT:it`;

// ── BLOCCO PREMI (sempre attivo; a sett/nov esce la roba GPHG) ──
const AWARD_FEEDS = [
  { label: '🏆 GPHG',            url: NEWS('GPHG OR "Grand Prix d\'Horlogerie de Genève"') },
  { label: '🏆 LV Watch Prize',  url: NEWS('"Louis Vuitton Watch Prize"') },
  { label: '🏆 Only Watch',      url: NEWS('"Only Watch" orologi') },
  { label: '🏆 Premi orologeria',url: NEWS('orologeria indipendente premio OR award') },
];

// ── INDIE SEGUITI PER NOME (catalizzatore = premio/asta/nuovo modello) ──
// Curato sui nomi con vero potenziale: ogni nome = un feed.
const TRACKED_INDIES = [
  'Auffret Paris', 'Petermann Bédat', 'Sylvain Pinaud', 'Simon Brette',
  'Raúl Pagès', 'Grönefeld', 'Krayon watch', 'Haute Rive watch',
  'Rexhep Rexhepi', 'Urban Jürgensen', 'Habring²', 'Kurono Tokyo',
  'Naoya Hida', 'Atelier Wen',
  // nuovi 2026 da seguire
  'Rémy Cools', 'Aubert Ramel', 'Behrens watch', 'Dunselman watch',
  'Fam al-Hut', 'Celadon watch', 'Qin Gan watch',
];
const INDIE_FEEDS = TRACKED_INDIES.map(name => ({
  label: `🔭 ${name}`,
  url: NEWS(`"${name}" (orologio OR montre OR watch OR horlogerie)`),
}));

// ── persistenza set "già visti" ──
function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')).seen || []); }
  catch { return new Set(); }
}
function saveSeen(set) {
  try {
    // tieni al massimo 800 link per non far crescere il file all'infinito
    const arr = [...set].slice(-800);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SEEN_FILE, JSON.stringify({ seen: arr, updated: Date.now() }));
  } catch (e) { console.error('[AWARDS] saveSeen', e.message); }
}

// ── parsing RSS minimale (Google News) ──
function parseItems(xml) {
  const items = [];
  const blocks = xml.split('<item>').slice(1);
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      if (!m) return '';
      return m[1].replace('<![CDATA[', '').replace(']]>', '').trim();
    };
    const title = pick('title');
    const link = pick('link');
    const pub = pick('pubDate');
    if (title && link) items.push({ title, link, ts: pub ? Date.parse(pub) : NaN });
  }
  return items;
}

async function fetchFeed(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (WatchbotAwardsRadar)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    return parseItems(await r.text());
  } catch (e) { return []; }
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#?\w+;/g, ' ').trim();
}

// ── ciclo principale ──
async function checkAll(tg, opts = {}) {
  const report = opts.report || false;
  const seen = loadSeen();
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const feeds = [...AWARD_FEEDS, ...INDIE_FEEDS];
  const fresh = [];

  for (const f of feeds) {
    const items = await fetchFeed(f.url);
    for (const it of items) {
      if (seen.has(it.link)) continue;
      // se la data c'è ed è vecchia, scarta (ma registra come visto)
      if (!Number.isNaN(it.ts) && it.ts < cutoff) { seen.add(it.link); continue; }
      seen.add(it.link);
      fresh.push({ ...f, ...it });
    }
    await new Promise(r => setTimeout(r, 300)); // gentile coi server
  }

  saveSeen(seen);

  if (!fresh.length) {
    if (report && tg) await tg('🔭 <b>Radar premi/indie</b>: nessuna novità in questo giro.');
    console.log('[AWARDS] nessuna novità');
    return { sent: 0 };
  }

  // ordina dal più recente e taglia al tetto
  fresh.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const batch = fresh.slice(0, MAX_PER_RUN);

  let msg = '🏆 <b>Radar premi &amp; indie — novità</b>\n\n';
  for (const it of batch) {
    msg += `${it.label}\n${decode(it.title)}\n${it.link}\n\n`;
  }
  if (fresh.length > batch.length) msg += `…e altre ${fresh.length - batch.length}.`;

  if (tg) await tg(msg);
  console.log(`[AWARDS] inviate ${batch.length} novità (trovate ${fresh.length})`);
  return { sent: batch.length, found: fresh.length };
}

module.exports = { checkAll, TRACKED_INDIES, AWARD_FEEDS };
