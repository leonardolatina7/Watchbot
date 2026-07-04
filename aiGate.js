/**
 * aiGate.js — IL BUTTAFUORI DI TESI (v12.22)
 * ════════════════════════════════════════════════════════════════════════
 * PROBLEMA (Leonardo, 03/07/26): l'AI analizzava la MAREA — Fossil quartz,
 * smartwatch, placcati da €45, roba da signora moderna. Costo inutile su
 * annunci che sappiamo GIÀ non essere in tesi, e Sonnet (a pagamento)
 * sprecato su fuffa.
 *
 * SOLUZIONE: un gate deterministico, GRATIS, tra i filtri anti-rumore e la
 * chiamata AI. Tre esiti:
 *   • SCARTO   → l'annuncio è negativo-CERTO per la tesi: niente AI, punto.
 *   • TOP      → candidato caldo (watchlist/brand nobile/calibro nobile/oro
 *                massiccio/vintage-db): merita Claude Sonnet (il motore buono).
 *   • NORMAL   → orologio vero ma tiepido: passa, MA su Gemini/Groq (gratis).
 *
 * PRINCIPIO: si scarta SOLO su segnali negativi ESPLICITI. Nel dubbio si fa
 * passare su motore gratuito — un affare perso costa più di una chiamata
 * Gemini. Ma la fuffa dichiarata (fashion, smartwatch, placcato, replica)
 * non tocca MAI l'AI.
 *
 * NB: l'ORO dichiarato è già gestito PRIMA dal ramo metallo a calcolo puro
 * (gratis). Qui l'oro massiccio serve solo come segnale di tier.
 *
 * USO (index.js):
 *   const aiGate = require('./aiGate');
 *   const g = aiGate.gate(item.title, priceEur, { isWatchlist: !!watchlistHit(item.title), isVintageDb: !!vintage });
 *   if (!g.pass) { continue; }                                  // scartato, log g.reason
 *   const ai = await claudeAnalyst.analyzeListing(title, price, image, { tier: g.tier });
 */

// ── Normalizzazione: minuscole + niente accenti (match multilingua stabile) ──
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
// Parola intera con confini non-lettera (evita "colo[rado]", "k[lip]sch")
function hasWord(text, word) {
  const re = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
  return re.test(text);
}
function hasAnyWord(text, list) { return list.some(w => hasWord(text, w)); }

// ════════════════════════════════════════════════════════════════════════
// LISTE NEGATIVE — scarto immediato, mai AI
// ════════════════════════════════════════════════════════════════════════

// Smartwatch / wearable: mai in tesi.
const SMARTWATCH = [
  'smartwatch', 'smart watch', 'apple watch', 'galaxy watch', 'garmin', 'fitbit',
  'amazfit', 'huawei watch', 'xiaomi watch', 'mi band', 'polar vantage', 'suunto',
  'whoop', 'fenix 7', 'fenix 8', 'venu', 'forerunner',
];

// Brand moda/fashion: valore di rivendita nullo per la tesi, mai AI.
// (Conservativo: solo i CERTI. Seiko/Citizen/Casio NON sono qui: hanno vintage veri.)
const FASHION_BRANDS = [
  'fossil', 'guess', 'armani', 'emporio armani', 'michael kors', 'dkny', 'diesel',
  'police', 'calvin klein', 'daniel wellington', 'ice-watch', 'ice watch',
  'tommy hilfiger', 'hugo boss', 'skagen', 'cluse', 'paul hewitt', 'liu jo',
  'morellato', 'sector no limits', 'chronostar', 'breil', 'hip hop', 'swarovski',
  'toy watch', 'toywatch', 'komono', 'mvmt', 'vincero',
];

// Replica/falso dichiarato: fuori, sempre.
const REPLICA = ['replica', 'replika', 'imitazione', 'imitation', 'fake', 'falso d\'autore'];

// Placcato/laminato/gold-filled dichiarato (multilingua). Tesi: ESCLUSO.
const PLATED = [
  'placcato', 'placcata', 'plaque or', 'plaqué or', 'plaque', 'vergoldet', 'goldfilled',
  'gold filled', 'gold-filled', 'gold plated', 'goldplated', 'laminato oro', 'laminated gold',
  'doublé', 'double or', 'dorato', 'dorata', 'gilt case', 'chapado', 'pozłacany', 'placat',
  'micron', '20 micron', '10 micron', 'rolled gold',
];
// ...ma se dichiara ANCHE oro massiccio, il placcato può riferirsi ad altro (es. fibbia).
const SOLID_GOLD = [
  '18k', '18 k', '18kt', '18 kt', '750', '0.750', '0,750', '14k', '14 k', '14kt', '585',
  'massiccio', 'solid gold', 'or massif', 'oro macizo', 'massivgold', 'gold massiv',
  '18 carati', '14 carati', 'echtgold',
];

// Quarzo dichiarato (il meca-quartz delle watchlist viene salvato PRIMA, dal tier top).
const QUARTZ = ['quartz', 'quarzo', 'quarz', 'kwarcowy', 'cuarzo', 'au quartz'];

// Donna/lady dichiarato (multilingua): fuori tesi salvo pregio (oro/nobile → gestito prima).
const LADY = ['donna', 'lady', 'ladies', 'damen', 'damenuhr', 'femme', 'dames', 'mujer', 'signora', 'damski', 'dama'];

// ════════════════════════════════════════════════════════════════════════
// LISTE POSITIVE — tier TOP (merita Claude Sonnet)
// ════════════════════════════════════════════════════════════════════════

// Brand della tesi melt-scarcity + nobili + watchlist caldi.
const NOBLE_BRANDS = [
  'universal geneve', 'universal genève', 'polerouter', 'longines', 'omega', 'iwc',
  'movado', 'eterna', 'girard-perregaux', 'girard perregaux', 'vacheron', 'patek',
  'audemars', 'jaeger-lecoultre', 'jaeger lecoultre', 'lecoultre', 'rolex', 'tudor',
  'zenith', 'el primero', 'heuer', 'breitling', 'cartier', 'piaget', 'blancpain',
  'rayville', 'gallet', 'nivada', 'croton', 'wittnauer', 'enicar', 'vulcain',
  'ulysse nardin', 'baume & mercier', 'baume et mercier', 'baume mercier',
  'cornes de vache', 'chopard', 'czapek', 'urban jurgensen', 'journe', 'akrivia',
  'berneron', 'atelier wen', 'moser', 'voutilainen', 'furlan marri', 'massena lab',
  'venezianico', 'aquastar', 'doxa', 'glycine', 'cyma', 'helvetia', 'wakmann',
  // indie growth aggiunti 04/07/26 ("azioni" dell'orologeria, tier top):
  'pascal coyon', 'coyon', 'atelier de chronometrie', 'bernhard zwinz', 'winnerl',
  'andersen geneve', 'andersen genève', 'flaux', 'brivet-naudot', 'theo auffret',
  'auffret', 'garrick', 'anordain', 'rexhep rexhepi', 'laurent ferrier',
  'simon brette', 'raul pages', 'sylvain pinaud',
  // ondata-2 scouting indie 04/07/26 (formula-Coyon, fase early):
  'habring', 'kudoke', 'ophion', 'phimphrachanh', 'j.n. shapiro', 'jn shapiro', 'shapiro',
  'petermann bedat', 'petermann bédat', 'sarpaneva', 'delaloye', 'ochs und junior',
];

// Calibri/segnali tecnici nobili: se il venditore li nomina, il pezzo merita occhi buoni.
const NOBLE_CALIBERS = [
  'valjoux', 'lemania', 'venus 17', 'venus 175', 'venus 178', 'venus 188',
  'landeron 48', 'excelsior park', 'microrotor', 'micro-rotor', 'micro rotor',
  'ruota a colonne', 'column wheel', 'roue a colonnes', 'schaltrad',
  'el primero', '30ch', '13zn', '13.33', 'cal 321', 'calibre 321', 'cal. 321',
  'cal 285', 'cal 281', 'peseux 260', 'zenith 135',
];

// ════════════════════════════════════════════════════════════════════════
// IL GATE
// ════════════════════════════════════════════════════════════════════════
/**
 * @param {string} title      titolo annuncio
 * @param {number} priceEur   prezzo (per regole future; oggi non scarta sul prezzo)
 * @param {object} flags      { isWatchlist:bool, isVintageDb:bool } calcolati dal chiamante
 * @returns {{ pass:boolean, tier:'top'|'normal'|null, reason:string }}
 */
function gate(title, priceEur, flags = {}) {
  const t = norm(title);
  if (!t) return { pass: true, tier: 'normal', reason: 'titolo vuoto: passa economico' };

  const isWatchlist = !!flags.isWatchlist;
  const isVintageDb = !!flags.isVintageDb;
  const saysQuartz  = hasAnyWord(t, QUARTZ);
  const saysSolid   = SOLID_GOLD.some(x => t.includes(norm(x)));
  const nobleBrand  = hasAnyWord(t, NOBLE_BRANDS);
  const nobleCal    = NOBLE_CALIBERS.some(x => t.includes(norm(x)));

  // ── 1. SCARTI ASSOLUTI: vincono su tutto (una "replica Rolex" non è un Rolex) ──
  if (hasAnyWord(t, REPLICA))        return { pass: false, tier: null, reason: 'replica dichiarata' };
  if (hasAnyWord(t, SMARTWATCH))     return { pass: false, tier: null, reason: 'smartwatch' };
  if (hasAnyWord(t, FASHION_BRANDS)) return { pass: false, tier: null, reason: 'brand fashion' };

  // ── 2. TIER TOP: i candidati caldi passano PRIMA degli scarti condizionali
  //       (così il meca-quartz Furlan Marri in watchlist non muore sul filtro quartz).
  if (isWatchlist)  return { pass: true, tier: 'top', reason: 'watchlist' };
  if (isVintageDb)  return { pass: true, tier: 'top', reason: 'vintage-db' };
  if (nobleCal)     return { pass: true, tier: 'top', reason: 'calibro nobile' };
  if (saysSolid)    return { pass: true, tier: 'top', reason: 'oro massiccio dichiarato' };
  if (nobleBrand) {
    // Brand nobile MA quarzo dichiarato = tiepido (trappola JLC-quartz style):
    // passa, ma su motore gratuito. Meccanico/non dichiarato = top.
    return saysQuartz
      ? { pass: true, tier: 'normal', reason: 'brand nobile ma quartz → economico' }
      : { pass: true, tier: 'top', reason: 'brand nobile' };
  }

  // ── 3. SCARTI CONDIZIONALI: negativi certi sul resto ──
  if (!saysSolid && PLATED.some(x => t.includes(norm(x))))
    return { pass: false, tier: null, reason: 'placcato/gold-filled dichiarato' };
  if (saysQuartz)                    return { pass: false, tier: null, reason: 'quartz senza brand nobile' };
  if (hasAnyWord(t, LADY) && !saysSolid)
    return { pass: false, tier: null, reason: 'da donna senza pregio dichiarato' };

  // ── 4. IL RESTO: orologio vero ma tiepido → passa su motore GRATUITO ──
  return { pass: true, tier: 'normal', reason: 'orologio generico → economico' };
}

module.exports = { gate, NOBLE_BRANDS, NOBLE_CALIBERS, FASHION_BRANDS, SMARTWATCH };
