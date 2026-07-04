/**
 * ahciRadar.js — RADAR CANDIDATI AHCI (v12.23, richiesta Leonardo 04/07/26)
 * ════════════════════════════════════════════════════════════════════════
 * TESI: i futuri indie da multipli (Coyon, Pagès, Phimphrachanh...) passano
 * quasi tutti dalla porta AHCI come Candidate PRIMA di esplodere. Dann
 * Phimphrachanh è comparso lì nel 2025 a CHF 65k; il momento buono era PRIMA.
 * Questo radar controlla la pagina ufficiale ahci.ch/members/ e avvisa su
 * Telegram quando compare un NOME NUOVO tra i Candidates → si studia con la
 * INDIE_DEBUT_SCORECARD (in brandWatchlist.js) allo stadio rumor, quando il
 * retail è ancora aperto.
 *
 * FUNZIONAMENTO:
 *  - fetch di https://www.ahci.ch/members/ (HTML pubblico, WordPress)
 *  - estrae la sezione tra "Candidates" e "Former members"
 *  - parse dei nomi dai link /members/<slug>/
 *  - confronto con i noti (SEED sotto + eventuali salvati in db.ahciKnown)
 *  - nomi nuovi → alert; i nuovi vengono aggiunti ai noti (persistiti dal
 *    chiamante via saveState, campo db.ahciKnown)
 *
 * SICUREZZE:
 *  - se la sezione non si trova (sito cambiato/giù) → ok:false, MAI alert spuri
 *  - SEED hardcoded al 04/07/26: anche senza persistenza, i 5 noti non
 *    generano falsi alert; al peggio un nuovo nome viene risegnalato dopo
 *    un redeploy (accettabile: meglio due avvisi che zero).
 *
 * USO (index.js):
 *   const ahciRadar = require('./ahciRadar');
 *   const r = await ahciRadar.check(db.ahciKnown);        // db.ahciKnown = array slug noti
 *   if (r.ok && r.newOnes.length) { ...alert tg...; db.ahciKnown = r.known; saveState(); }
 */

const axios = require('axios');

const AHCI_URL = 'https://www.ahci.ch/members/';

// ── SEED: candidati noti al 04/07/2026 (slug della pagina ufficiale) ──
// Chi è qui NON genera alert. Quando un candidato diventa Member o esce,
// resta innocuo nel seed. Nuove voci → alert.
const SEED_KNOWN = [
  'marco-guarino',        // Marco Guarino
  'machiel-hulsman',      // Machiel Hulsman
  'johannes-kallinich',   // Johannes Kallinich (Kallinich Claeys)
  'maciej-misnik',        // Maciej Miśnik
  'dann-phimphrachanh',   // Dann Phimphrachanh (Seconde Vive) — già CHF 65k, tardi
];

// Estrae i candidati (slug + nome) dall'HTML della pagina members.
// Basato sulla struttura reale vista il 04/07/26: heading "Candidates" ...
// heading "Former members", con dentro link https://www.ahci.ch/members/<slug>/
function parseCandidates(html) {
  const h = String(html || '');
  const i1 = h.indexOf('Candidates');
  if (i1 < 0) return null;                       // struttura cambiata → non mi fido
  let i2 = h.indexOf('Former members', i1);
  if (i2 < 0) i2 = h.length;                     // fallback: fino alla fine
  const section = h.slice(i1, i2);
  const re = /href="https?:\/\/(?:www\.)?ahci\.ch\/members\/([a-z0-9\-]+)\/?"[^>]*>([^<]*)</gi;
  const found = new Map(); // slug -> nome
  let m;
  while ((m = re.exec(section))) {
    const slug = m[1].toLowerCase();
    const name = (m[2] || '').trim();
    if (!slug || slug === 'members') continue;
    // tengo il nome "migliore" (non vuoto, non un URL)
    const prev = found.get(slug);
    if (!prev || (!prev && name) || (prev && !/[a-zà-ÿ]/i.test(prev) && name)) {
      if (name && !name.startsWith('http')) found.set(slug, name);
      else if (!found.has(slug)) found.set(slug, slug.replace(/-/g, ' '));
    }
  }
  return Array.from(found, ([slug, name]) => ({ slug, name }));
}

/**
 * Controlla la pagina AHCI e confronta con i noti.
 * @param {string[]} knownSlugs  slug già noti (da db.ahciKnown; può essere vuoto)
 * @returns {Promise<{ok:boolean, candidates?:Array, newOnes?:Array, known?:string[], error?:string}>}
 */
async function check(knownSlugs) {
  const known = new Set([...(knownSlugs || []), ...SEED_KNOWN].map(s => String(s).toLowerCase()));
  try {
    const r = await axios.get(AHCI_URL, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WatchbotAHCI/1.0)' },
      maxContentLength: 3 * 1024 * 1024,
    });
    const candidates = parseCandidates(r.data);
    if (!candidates) return { ok: false, error: 'sezione Candidates non trovata (layout cambiato?)' };
    if (!candidates.length) return { ok: false, error: 'zero candidati estratti: parser da verificare' };
    const newOnes = candidates.filter(c => !known.has(c.slug));
    // aggiorno i noti con TUTTI i candidati visti (nuovi inclusi)
    const updatedKnown = Array.from(new Set([...known, ...candidates.map(c => c.slug)]));
    return { ok: true, candidates, newOnes, known: updatedKnown };
  } catch (e) {
    return { ok: false, error: e.response ? `HTTP ${e.response.status}` : e.message };
  }
}

// Testo pronto per l'alert Telegram (HTML mode del bot).
function formatAlert(newOnes) {
  const rows = newOnes.map(c =>
    `\u{1F195} <b>${c.name}</b>\n\u{1F517} https://www.ahci.ch/members/${c.slug}/`
  ).join('\n\n');
  return (
    `\u{1F6F0}\uFE0F <b>RADAR AHCI \u2014 NUOVO CANDIDATO INDIPENDENTE</b>\n\n` +
    rows + `\n\n` +
    `\u{1F4A1} <b>Stadio RUMOR = la finestra buona.</b> Dann Phimphrachanh \u00E8 comparso qui ` +
    `nel 2025 ed era gi\u00E0 a CHF 65k al debutto pubblico. Studialo ORA con la ` +
    `Scorecard Debutto Indie (background \u2192 calibro \u2192 firma \u2192 finitura \u2192 ` +
    `produzione \u2192 prezzo \u2192 validazione \u2192 vendita). Se 6+/8 e risponde alle ` +
    `email: quello \u00E8 il momento Coyon.`
  );
}

module.exports = { check, parseCandidates, formatAlert, SEED_KNOWN, AHCI_URL };
