/**
 * trademarkRadar.js — IL CACCIATORE DI CATALIZZATORI
 * ────────────────────────────────────────────────────────────────────────
 * Idea: il segnale più PRECOCE che un marchio dormiente sta per essere
 * rilanciato non è il prezzo, né la notizia su Hodinkee. È il DEPOSITO DI
 * MARCHIO. Quando un brand morto da anni rinnova o deposita un marchio nuovo
 * (specie in CLASSE 14 di Nizza = orologeria), significa che qualcuno ci sta
 * investendo soldi e avvocati. Mesi prima della stampa, anni prima dei prezzi.
 *
 * È il precedente Universal Genève reso sistematico: chi sapeva ha comprato
 * PRIMA del catalizzatore. Questo modulo cerca di vederlo arrivare.
 *
 * COSA FA:
 *   - tiene una lista di marchi dormienti/risorgenti (i "candidati rilancio")
 *   - una volta al mese interroga la banca dati marchi UE (EUIPO)
 *   - confronta col proprio stato salvato: cosa è NUOVO rispetto all'ultimo giro?
 *   - se trova un deposito/rinnovo nuovo (peso massimo se in classe 14) → ALERT
 *
 * FONTE DATI (adapter intercambiabile, vedi fetchFilings):
 *   - default: actor Apify EUIPO (token semplice) — APIFY_TOKEN
 *   - alternativa ufficiale: EUIPO eSearch Plus (OAuth2) — EUIPO_CLIENT_ID/SECRET
 *   - MODALITÀ TEST: senza chiavi gira con dati finti per vederlo funzionare
 *
 * STATO: /var/data/tm_radar.json (disco persistente Render, come il resto).
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Dove salvo lo stato (disco persistente Render; fallback /tmp) ──
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : '/tmp');
const STATE_FILE = path.join(DATA_DIR, 'tm_radar.json');

// ── Classe di Nizza 14 = metalli preziosi, gioielleria, OROLOGERIA.
//    Un deposito in classe 14 da parte di un brand-orologio = intento vero,
//    non un semplice "tengo il nome per sicurezza". È il segnale forte. ──
const WATCH_NICE_CLASS = '14';
let _mockWarned = false; // per loggare una sola volta che il radar marchi è in pausa (niente fonte)

// ── I CANDIDATI RILANCIO ──────────────────────────────────────────────────
// Marchi storici dormienti o appena risorti che valgono il monitoraggio.
// Se il bot ha brandWatchlist, lo uniamo a questa base. Tu puoi aggiungerne
// via env TM_EXTRA_BRANDS="Marchio1,Marchio2".
const SEED_DORMANT_BRANDS = [
  'Excelsior Park', 'Nivada Grenchen', 'Vulcain', 'Enicar', 'Aquastar',
  'Airain', 'Gallet', 'Lemania', 'Wittnauer', 'Cortebert', 'Mulco',
  'Universal Geneve', 'Zodiac', 'Cyma', 'Tavannes', 'Juvenia', 'Gubelin',
  'Record Geneve', 'Eterna', 'Glycine', 'Buren', 'Auricoste', 'Dodane',
  'Ernest Borel', 'Pierce', 'Helvetia', 'Doxa', 'Favre-Leuba', 'Nepro',
  'Croton', 'Ollech & Wajs', 'Squale', 'Technos', 'Sicura', 'Roamer',
];

function loadBrands(brandWatchlist) {
  const set = new Set(SEED_DORMANT_BRANDS);
  // Unisco i marchi della watchlist-azienda del bot, se disponibile
  try {
    if (brandWatchlist && brandWatchlist.BRAND_WATCHLIST) {
      for (const name of Object.keys(brandWatchlist.BRAND_WATCHLIST)) set.add(name);
    }
  } catch {}
  // Extra da env
  (process.env.TM_EXTRA_BRANDS || '').split(',').map(s => s.trim()).filter(Boolean)
    .forEach(b => set.add(b));
  return [...set];
}

// ── STATO ───────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { seen: {}, lastRun: null }; } // seen[brand] = [filingId, ...]
}
function saveState(state) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state)); }
  catch (e) { console.error('[TM-RADAR] salvataggio stato fallito:', e.message); }
}

// ── FETCH ADAPTER ─────────────────────────────────────────────────────────
// Ritorna array normalizzato: [{ id, mark, status, niceClasses:[..], filedDate,
//                                 owner }]. Una sola funzione da toccare se
// cambi fonte dati. Di default usa l'actor Apify EUIPO; senza chiavi → mock.
async function fetchFilings(brand) {
  // ── Adapter A: Apify EUIPO Trademark Search (token) ──
  if (process.env.APIFY_TOKEN) {
    const actor = process.env.APIFY_TM_ACTOR || 'ryanclinton~euipo-trademark-search';
    const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;
    // NB: i nomi dei campi di INPUT dell'actor vanno confermati al primo giro
    // (fai girare prima in DRY-RUN). Qui passo il nome del marchio come query.
    const { data } = await axios.post(url, { searchTerm: brand, query: brand }, { timeout: 60000 });
    return normalizeApify(data);
  }
  // ── Adapter B: EUIPO eSearch Plus ufficiale (OAuth2) — placeholder isolato ──
  if (process.env.EUIPO_CLIENT_ID && process.env.EUIPO_CLIENT_SECRET) {
    return await fetchEuipoOfficial(brand); // vedi sotto
  }
  // ── Nessuna chiave: NIENTE dati finti. Un radar che inventa segnali è peggio
  //    di un radar spento (ti fa inseguire falsi catalizzatori — es. il finto
  //    "NewCo Holding AG" che usciva per OGNI marchio). Senza una fonte VERA
  //    (Apify o EUIPO), non allarmo. Il mock resta disponibile SOLO forzandolo
  //    a mano con TM_RADAR_MOCK=1, per test in locale. ──
  if (process.env.TM_RADAR_MOCK === '1') return mockFilings(brand);
  if (!_mockWarned) {
    console.warn('[TM-RADAR] nessuna fonte marchi configurata (manca APIFY_TOKEN o EUIPO_CLIENT_ID) → radar marchi in PAUSA, nessun segnale finto. Aggiungi una chiave per attivarlo sui dati reali.');
    _mockWarned = true;
  }
  return [];
}

function normalizeApify(data) {
  const rows = Array.isArray(data) ? data : (data?.items || []);
  return rows.map(r => ({
    id: String(r.applicationNumber || r.id || r.applicationNo || `${r.markName}-${r.applicationDate}`),
    mark: r.markName || r.mark || r.name || '',
    status: (r.status || r.markStatus || '').toString(),
    niceClasses: (r.niceClasses || r.classes || r.classNumbers || []).map(String),
    filedDate: r.applicationDate || r.filingDate || r.date || null,
    owner: r.applicantName || r.owner || r.holder || '',
  })).filter(x => x.mark);
}

// EUIPO eSearch Plus ufficiale: OAuth2 client-credentials + ricerca RSQL.
// Lasciato pronto da completare quando vorrai passare all'ufficiale.
async function fetchEuipoOfficial(brand) {
  console.warn('[TM-RADAR] adapter EUIPO ufficiale non ancora attivo per', brand, '→ nessun segnale (niente dati finti)');
  return [];
}

// ── DATI FINTI per test/dry-run ──
function mockFilings(brand) {
  const today = new Date();
  const recent = new Date(today.getTime() - 12 * 86400000).toISOString().slice(0, 10);
  const old = '2014-03-02';
  // Un deposito vecchio (già visto) + uno recente in classe 14 (= segnale!)
  return [
    { id: `${brand}-OLD-1`, mark: brand, status: 'Registered', niceClasses: ['14'], filedDate: old, owner: `${brand} SA` },
    { id: `${brand}-NEW-${recent}`, mark: brand, status: 'Filed', niceClasses: ['14', '35'], filedDate: recent, owner: 'NewCo Holding AG' },
  ];
}

// ── SCORING DEL SEGNALE ───────────────────────────────────────────────────
// Quanto è forte un deposito nuovo come catalizzatore?
function signalScore(filing) {
  let s = 1;
  if (filing.niceClasses.includes(WATCH_NICE_CLASS)) s += 3; // classe orologi = intento vero
  if (/fil|pending|applica|deposit/i.test(filing.status)) s += 1; // deposito FRESCO (non solo rinnovo vecchio)
  // Nuovo proprietario diverso dallo storico = acquisizione/rilancio
  if (filing.owner && !new RegExp(filing.mark.split(' ')[0], 'i').test(filing.owner)) s += 2;
  return s; // 1..7
}

// ── È recente? (entro N giorni) ──
function isRecent(dateStr, days = 120) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return (Date.now() - d.getTime()) <= days * 86400000;
}

// ── CONTROLLO PRINCIPALE ──────────────────────────────────────────────────
// tgFn = funzione di invio Telegram passata da index.js. brandWatchlist opz.
async function checkAll(tgFn, brandWatchlist, opts = {}) {
  const days = opts.days || 120;
  const minScore = opts.minScore || 4;
  const brands = loadBrands(brandWatchlist);
  const state = loadState();
  let alerts = 0, checked = 0;

  for (const brand of brands) {
    try {
      const filings = await fetchFilings(brand);
      checked++;
      const seen = new Set(state.seen[brand] || []);
      const fresh = [];
      for (const f of filings) {
        if (seen.has(f.id)) continue;            // già visto in un giro precedente
        seen.add(f.id);
        if (!isRecent(f.filedDate, days)) continue; // vecchio: registro ma non allarmo
        const score = signalScore(f);
        if (score >= minScore) fresh.push({ ...f, score });
      }
      state.seen[brand] = [...seen].slice(-200); // tengo memoria limitata

      for (const f of fresh.sort((a, b) => b.score - a.score)) {
        alerts++;
        const cls14 = f.niceClasses.includes(WATCH_NICE_CLASS);
        const ownerChanged = f.owner && !new RegExp(f.mark.split(' ')[0], 'i').test(f.owner);
        if (tgFn) await tgFn(
          `\u{1F6A8} <b>SEGNALE CATALIZZATORE \u2014 ${brand}</b>  \u{1F4C8}\n` +
          `<i>Deposito di marchio NUOVO: il segnale più precoce di un rilancio.</i>\n\n` +
          `\u{1F4DC} Marchio depositato: <b>${f.mark}</b>\n` +
          `\u{1F4C5} Data: <b>${f.filedDate}</b>\n` +
          `\u{1F4CA} Stato: ${f.status || 'n/d'}\n` +
          (cls14 ? `\u2705 <b>Classe 14 (orologeria)</b> \u2014 intento vero, non difensivo\n` : `\u26A0\uFE0F Classi: ${f.niceClasses.join(', ') || 'n/d'} (non classe 14)\n`) +
          (ownerChanged ? `\u{1F465} <b>Nuovo proprietario: ${f.owner}</b> \u2014 odora di acquisizione/rilancio\n` : (f.owner ? `\u{1F464} Titolare: ${f.owner}\n` : '')) +
          `\u{1F525} <b>Forza segnale: ${f.score}/7</b>\n\n` +
          `\u{1F9E0} <b>Tesi:</b> qualcuno sta mettendo soldi e avvocati su questo nome dormiente. ` +
          `Se parte un rilancio, gli ORIGINALI d'epoca fanno da traino (è successo con Universal Genève). ` +
          `Accumula i pezzi veri ORA, finché il mercato non se ne accorge.\n\n` +
          `\u{1F50D} Verifica: cerca news/social del marchio, e controlla quanti originali ci sono in vendita (flottante).`
        );
      }
    } catch (e) {
      console.error(`[TM-RADAR] ${brand}:`, e.response?.status || e.message);
    }
  }

  state.lastRun = new Date().toISOString();
  saveState(state);
  const msg = `[TM-RADAR] giro completato: ${checked} marchi controllati, ${alerts} segnali catalizzatore`;
  console.log(msg);
  if (tgFn && alerts === 0 && opts.report) await tgFn(`\u{1F4E1} <b>Radar marchi</b>: ${checked} brand controllati, nessun nuovo deposito sospetto in questo giro.`);
  return { checked, alerts };
}

module.exports = { checkAll, loadBrands, signalScore, isRecent, _mockFilings: mockFilings, STATE_FILE };

// ── CLI di test: `node trademarkRadar.js --test` (gira coi dati finti) ──
if (require.main === module && process.argv.includes('--test')) {
  (async () => {
    const fakeTg = async (t) => console.log('\n----- TELEGRAM -----\n' + t.replace(/<[^>]+>/g, ''));
    // primo giro: deve trovare il deposito recente finto
    console.log('### PRIMO GIRO ###');
    await checkAll(fakeTg, null, { report: true });
    // secondo giro: ormai è "già visto" → nessun nuovo allarme
    console.log('\n### SECONDO GIRO (stesso stato, niente di nuovo) ###');
    await checkAll(fakeTg, null, { report: true });
  })();
}
