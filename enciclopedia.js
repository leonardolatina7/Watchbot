// =============================================================================
//  enciclopedia.js  —  Watchbot v12.34
//  Il sapere dell'Enciclopedia del Vintage (v22) trasformato in regole-macchina,
//  più le regole "value investing" (margine di sicurezza, cerchio di competenza,
//  fondo curva, melt play da tasca).
//
//  Filosofia (Buffett applicato agli orologi):
//   1. MARGINE DI SICUREZZA: su un pezzo d'oro, il melt è il pavimento. Se il
//      melt copre gran parte del prezzo chiesto, il downside è quasi zero.
//   2. CERCHIO DI COMPETENZA: si compra solo dentro la nicchia che si conosce
//      (solo-tempo dress/manifattura vintage). Fuori dal cerchio = penalità.
//   3. MR. MARKET: la fascia media moderna deprezza -30/50% nei primi anni.
//      Non si compra MAI a listino; si compra il coltello quando ha FINITO
//      di cadere (fondo curva).
//   4. IL GEMELLO POVERO: stesso calibro/design, marchio minore = stesso
//      hardware a frazione del prezzo (UG microrotor vs Polerouter).
//   5. MELT PLAY DEMOGRAFICO: i collezionisti da tasca invecchiano; i pocket
//      d'oro nobili scivolano verso/ sotto il fuso = acquisto d'oro con
//      storia in omaggio.
//
//  API:
//    const ency = require('./enciclopedia');
//    const r = ency.analyzeWithRules({ title, description, priceEur });
//    r.flags        → array di flag macchina (es. 'REDIAL_DECLARED')
//    r.summaryLines → righe pronte per l'alert Telegram
//    r.meltEstimate → stima melt se peso trovato nel testo (o null)
//    ency.DIGEST    → compendio ~1.300 token da iniettare nel prompt AI (tier TOP)
//
//  Nessuna dipendenza esterna.
// =============================================================================

'use strict';

// -----------------------------------------------------------------------------
//  0) CONFIG  (aggiornabile via env senza toccare il codice)
// -----------------------------------------------------------------------------
const CONFIG = {
  // Regola melt: 18k ≈ €85/g di peso LORDO CASSA (oro fino €114/g × 0.75).
  // MAI peso totale orologio × prezzo oro puro. Env: GOLD18K_EUR_G
  gold18kEurPerGram: parseFloat(process.env.GOLD18K_EUR_G || '85'),
  // Se l'annuncio dà solo il peso TOTALE, la cassa è stimata prudenzialmente
  // al 60% (si sottraggono movimento + vetro). Stima conservativa.
  caseWeightShareOfTotal: 0.60,
  // 9k = 0.375 → rapporto su 18k (0.750): la metà esatta.
  k9FactorVs18k: 0.5,
  k14FactorVs18k: 0.583 / 0.750, // 14k=0.583
};

// -----------------------------------------------------------------------------
//  1) TABELLE DAL LIBRO
// -----------------------------------------------------------------------------
// Marchi nobili melt-eligible (Parte VI): solo Svizzera certificata.
const NOBLE_BRANDS = [
  'vacheron', 'audemars', 'patek', 'jaeger', 'lecoultre', 'universal geneve',
  'universal genève', 'iwc', 'omega', 'longines', 'eberhard', 'girard-perregaux',
  'girard perregaux', 'eterna', 'movado', 'zenith',
];

// Calibri nobili per marca (uniti dai capitoli marca).
const NOBLE_CALIBERS = [
  // Longines
  '30ch', '13zn', '13.33', '12.68', '30l', '23z', '27m',
  // Universal Genève microrotor + crono
  'cal. 215', 'cal 215', 'cal. 218', 'cal 218', '1-66', 'cal 69', 'microtor', 'micro-rotor', 'microrotor',
  // Omega
  'cal. 321', 'cal 321', '30t2', '30 t2', 'cal. 861', 'cal 861', '33.3', 'cal. 265', 'cal 265', 'cal. 266', 'cal 266', 'cal. 283', 'cal 283', 'cal. 1040', 'cal 1040',
  // JLC
  'cal. 920', 'cal 920', 'cal. 849', 'cal 849', 'memovox', 'futurematic', 'p478', 'k480',
  // AP
  'cal. 2120', 'cal 2120', 'cal. 2121', 'cal 2121', '13vzas', 'cal. 2003', 'cal 2003',
  // Valjoux/Venus nobili (école & crono)
  'valjoux 72', 'valjoux 88', 'valjoux 23', 'venus 230', 'venus 175',
  // Eterna / GP
  'eterna-matic', 'eterna matic', 'gyromatic',
];

// Premi d'acquisto per casa d'asta (Parte aste). match sul testo/URL.
const AUCTION_PREMIUMS = [
  { match: ['cambi'], label: 'Cambi', rule: '+28% IVA inclusa sul martello' },
  { match: ['bidinside', 'nomisma'], label: 'Bidinside/Nomisma',
    rule: '+21% +€15 SOLO su lotti aggiudicati; invenduti a prezzo fisso = nessun premio, solo spedizione' },
  { match: ["sant'agostino", 'santagostino', 'sant agostino'], label: "Sant'Agostino", rule: '+20% +IVA, non negoziabile' },
];

// Parole che nel condition report/descrizione = redial dichiarato → PASS.
const REDIAL_DECLARED = [
  'ristampato', 'quadrante ristampato', 'redial', 're-dial', 'refinished dial',
  'restored dial', 'zifferblatt restauriert', 'cadran restauré', 'repainted',
];

// Segnali di redial da verificare (texture): granuloso/sabbioso = flag.
const REDIAL_SUSPECT = [
  'granuloso', 'sabbioso', 'powdery', 'grainy dial',
];

// Casse nazionali di valore inferiore (UK Dennison 9k ecc.).
const NATIONAL_CASE_FLAGS = [
  { words: ['dennison', 'ds&s', 'ds & s', '9k', '9 k', '375'], label: 'cassa UK 9k (Dennison/DS&S): vale MENO della svizzera 18k; melt = metà del 18k' },
];

// Fascia media moderna: la legge della curva (Cap. 24).
const MODERN_MIDRANGE = [
  'tudor', 'tag heuer', 'baume', 'mercier', 'longines heritage', 'oris',
  'bell & ross', 'bremont', 'nomos', 'zenith defy', 'hublot',
];

// Fuori dal cerchio di competenza (Parte nicchia).
const OUT_OF_CIRCLE = [
  { words: ['quartz', 'quarzo'], label: 'quarzo (fuori nicchia, salvo Megaquartz da studio)' },
  { words: ['smartwatch', 'apple watch'], label: 'smartwatch (fuori)' },
  { words: ['baume & mercier', 'baume et mercier'], label: 'B&M: deprezza 75-80%, evitare (Cap. 24)' },
  { words: ['damiani'], label: 'fashion/gioielleria: evitare' },
];

// Solo-tempo dress vintage = core. Diver/crono vintage veri = edge accettabile.
const CORE_WORDS = ['solo tempo', 'time only', 'dress', 'calatrava', 'manuale', 'handaufzug', 'small seconds', 'piccoli secondi'];
const EDGE_WORDS = ['chronograph', 'crono', 'diver', 'compressor', 'gmt'];

// -----------------------------------------------------------------------------
//  2) UTILITY
// -----------------------------------------------------------------------------
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
function has(blob, w) { return blob.includes(norm(w)); }
function hasAny(blob, arr) { return arr.some(w => has(blob, w)); }

// Estrae un peso in grammi dal testo ("45g", "45 gr", "grammi 45", "peso 45").
function extractGrams(blob) {
  const m = blob.match(/(\d{2,3})\s*(?:g\b|gr\b|grammi|gramm|grams)/) ||
            blob.match(/(?:peso|weight|gewicht)\D{0,10}(\d{2,3})/);
  if (!m) return null;
  const g = parseInt(m[1], 10);
  return (g >= 15 && g <= 250) ? g : null; // range plausibile orologio/tasca
}

function goldKarat(blob) {
  if (/\b18\s*k|750\b|0[.,]750/.test(blob)) return 18;
  if (/\b14\s*k|585\b|0[.,]585/.test(blob)) return 14;
  if (/\b9\s*k|375\b|0[.,]375/.test(blob)) return 9;
  if (hasAny(blob, ['oro', 'gold', 'or rose', 'rose gold', 'oro rosa', 'gelbgold', 'rotgold'])) return 18; // presunzione prudente da verificare
  return 0;
}

// -----------------------------------------------------------------------------
//  3) ANALISI CON LE REGOLE DEL LIBRO
// -----------------------------------------------------------------------------
function analyzeWithRules({ title = '', description = '', priceEur = null } = {}) {
  const blob = norm(title + ' ' + description);
  const flags = [];
  const lines = [];   // righe pronte per Telegram
  let meltEstimate = null;
  let marginOfSafety = null;

  // --- 3a) REDIAL: dichiarato = PASS automatico (regola Cambi) ---
  if (hasAny(blob, REDIAL_DECLARED)) {
    flags.push('REDIAL_DECLARED');
    lines.push('\u26D4 REDIAL DICHIARATO nel testo = PASS automatico (regola condition report)');
  } else if (hasAny(blob, REDIAL_SUSPECT)) {
    flags.push('REDIAL_SUSPECT');
    lines.push('\u26A0\uFE0F Texture sospetta (granulosa/sabbiosa): chiedere macro luce radente prima di offrire');
  }

  // --- 3b) CASSA NAZIONALE (Dennison 9k UK) ---
  for (const nc of NATIONAL_CASE_FLAGS) {
    if (nc.words.filter(w => has(blob, w)).length >= 2) { // servono 2 indizi (es. dennison+9k)
      flags.push('NATIONAL_CASE');
      lines.push('\u26A0\uFE0F ' + nc.label);
      break;
    }
  }

  // --- 3c) MELT & MARGINE DI SICUREZZA (regola Buffett #1) ---
  const karat = goldKarat(blob);
  const noble = hasAny(blob, NOBLE_BRANDS);
  if (karat > 0 && noble) {
    const grams = extractGrams(blob);
    if (grams) {
      // Se il peso sembra totale-orologio, stima cassa prudenziale al 60%.
      const caseGrams = Math.round(grams * CONFIG.caseWeightShareOfTotal);
      let perGram = CONFIG.gold18kEurPerGram;
      if (karat === 14) perGram *= CONFIG.k14FactorVs18k;
      if (karat === 9) perGram *= CONFIG.k9FactorVs18k;
      meltEstimate = Math.round(caseGrams * perGram);
      lines.push(`\u{1FA99} Melt stimato ~\u20AC${meltEstimate} (cassa ~${caseGrams}g prudenziale da ${grams}g dichiarati, ${karat}k)`);
      if (priceEur && priceEur > 0) {
        marginOfSafety = +(meltEstimate / priceEur).toFixed(2);
        if (marginOfSafety >= 0.8) {
          flags.push('MARGIN_OF_SAFETY');
          lines.push(`\u{1F6E1}\uFE0F MARGINE DI SICUREZZA: il fuso copre il ${Math.round(marginOfSafety*100)}% del prezzo \u2014 downside quasi zero`);
        } else if (marginOfSafety >= 0.5) {
          lines.push(`\u2696\uFE0F Copertura melt ${Math.round(marginOfSafety*100)}% del prezzo`);
        }
      }
    } else if (karat === 18) {
      lines.push('\u{1FA99} Oro nobile senza peso dichiarato: CHIEDERE il peso \u2014 regola melt \u20AC' + CONFIG.gold18kEurPerGram + '/g cassa');
      flags.push('ASK_WEIGHT');
    }
  }

  // --- 3d) MELT PLAY DA TASCA (regola Buffett #5, demografica) ---
  if (karat >= 14 && noble && hasAny(blob, ['tasca', 'pocket watch', 'taschenuhr', 'savonnette', 'da taschino'])) {
    flags.push('POCKET_MELT_PLAY');
    lines.push('\u{1F570}\uFE0F POCKET MELT PLAY: collezionisti in calo demografico \u2192 trattare DAL FUSO in su, non dal "valore collezionistico". Non spacchettare: intero vale pi\u00F9.');
  }

  // --- 3e) CALIBRO NOBILE ---
  if (hasAny(blob, NOBLE_CALIBERS)) {
    flags.push('NOBLE_CALIBER');
    lines.push('\u2699\uFE0F Calibro nobile riconosciuto nel testo (vedi capitolo marca in Enciclopedia)');
    // Eccezione Omega 321: collector, non melt.
    if (hasAny(blob, ['321']) && has(blob, 'omega')) {
      lines.push('\u2757 Omega cal. 321 = pezzo da COLLEZIONE, mai valutarlo col metro del fuso');
    }
    // UG microrotor: finestra catalizzatore.
    if (hasAny(blob, ['microtor', 'microrotor', 'micro-rotor', 'cal. 215', 'cal 215', 'cal. 218', 'cal 218', '1-66']) && hasAny(blob, ['universal'])) {
      lines.push('\u{1F4C8} UG microrotor: "fratello povero" del Polerouter \u2014 finestra catalizzatore rilancio UG 12-24 mesi');
    }
  }

  // --- 3f) LADY ≤33mm: penalità liquidità 15-25% ---
  const diamMatch = blob.match(/(\d{2})\s*(?:mm|millimetri)/);
  if (diamMatch) {
    const d = parseInt(diamMatch[1], 10);
    if (d > 0 && d <= 33) {
      flags.push('SMALL_DIAMETER');
      lines.push(`\u{1F4CF} ${d}mm: penalit\u00E0 liquidit\u00E0 15-25% (salvo modelli nativamente piccoli) \u2014 scontarla nella trattativa`);
    }
  }
  if (hasAny(blob, ['lady', 'donna', 'damen', 'femme']) && !flags.includes('SMALL_DIAMETER')) {
    flags.push('LADY');
    lines.push('\u{1F4CF} Referenza lady: applicare penalit\u00E0 liquidit\u00E0 15-25%');
  }

  // --- 3g) CERCHIO DI COMPETENZA (regola Buffett #2) ---
  let circle = 'edge';
  for (const o of OUT_OF_CIRCLE) {
    if (hasAny(blob, o.words)) { circle = 'out'; lines.push('\u{1F3AF} FUORI CERCHIO: ' + o.label); flags.push('OUT_OF_CIRCLE'); break; }
  }
  if (circle !== 'out') {
    if (hasAny(blob, CORE_WORDS) || (noble && !hasAny(blob, EDGE_WORDS))) circle = 'core';
    if (circle === 'core') { flags.push('CORE_NICHE'); }
  }

  // --- 3h) FONDO CURVA fascia media (regola Buffett #3) ---
  if (hasAny(blob, MODERN_MIDRANGE) && priceEur && priceEur > 0) {
    // segnali testuali di sconto forte / fondo curva
    if (hasAny(blob, ['listino', 'retail']) || /\-\s?[4-9]\d\s?%/.test(blob)) {
      lines.push('\u{1F4C9} Fascia media moderna: comprare SOLO a fondo curva (-30/50% dal listino). Verificare sconto reale vs retail. Tudor BB58 = eccezione che tiene (84-94%).');
      flags.push('MIDRANGE_CURVE');
    }
  }

  // --- 3i) PREMIO D'ASTA (se il testo/URL nomina la casa) ---
  for (const a of AUCTION_PREMIUMS) {
    if (hasAny(blob, a.match)) {
      flags.push('AUCTION_' + a.label.toUpperCase().replace(/[^A-Z]/g, ''));
      lines.push(`\u{1F3DB}\uFE0F ${a.label}: ${a.rule}`);
      break;
    }
  }

  // --- 3j) SERVICE DOCUMENTATO = premio ---
  if (hasAny(blob, ['revisionato', 'serviced', 'service 20', 'revisione 20', 'tagliando', 'r\u00E9vis\u00E9'])) {
    flags.push('SERVICED');
    lines.push('\u{1F527} Service dichiarato: vale +\u20AC100-300 in rivendita e riduce trattativa \u2014 chiedere ricevuta');
  }

  return {
    flags,
    summaryLines: lines,
    meltEstimate,
    marginOfSafety,
    circle,
    karat: karat || null,
    isNobleBrand: noble,
  };
}

// -----------------------------------------------------------------------------
//  4) DIGEST per il prompt AI (tier TOP)  —  ~1.300 token, la "testa" del dealer
// -----------------------------------------------------------------------------
const DIGEST = `REGOLE DEALER (Enciclopedia del Vintage v22, applicale SEMPRE):
NICCHIA: solo-tempo dress/manifattura vintage svizzero (oro 18k preferito). Marchi nobili: VC, AP, PP, JLC, UG, IWC, Omega, Longines, Eberhard, GP, Eterna, Movado. Diver/crono vintage veri = eccezione valida. Quarzo, fashion, smartwatch = fuori.
MELT: 18k = €85/g di peso LORDO CASSA (fino €114 × 0,75). MAI peso totale × oro puro; sottrarre movimento+vetro. 9k = metà del 18k. Solo oro svizzero certificato conta per l'arbitraggio; Dennison DS&S 9k UK vale meno.
MARGINE DI SICUREZZA: se melt ≥ 80% del prezzo → downside quasi zero, comprare aggressivi. Pocket oro nobile = melt play demografico: trattare dal fuso, non spacchettare.
REDIAL: "ristampato/redial/refinished" nel testo = PASS automatico. Tropical autentico: superficie vellutata, gradazione radiale, stampe affogate, patina anche sotto le lancette. Granuloso/sabbioso = flag, chiedere macro luce radente.
CURVA FASCIA MEDIA: il moderno mid-range perde 30-50% nei primi 1-5 anni. MAI a listino; comprare solo a fondo curva. Tudor BB58 tiene (84-94%); B&M deprezza 75-80%, evitare.
GEMELLO POVERO: stesso calibro, marchio/modello minore = stesso hardware a frazione (UG microrotor cal.215/218/1-66 vs Polerouter; école Valjoux 72C vs Heuer Carrera). Finestra UG: 12-24 mesi dal rilancio 2026.
OMEGA 321 (2279/2439/2451/2468/2884): collezione, mai metro del fuso. Longines 30CH/13ZN in-house = top; datare col seriale.
ASTE: Cambi +28% IVA incl.; Bidinside/Nomisma +21%+€15 SOLO aggiudicati (invenduti prezzo fisso = zero premio); Sant'Agostino +20%+IVA. Leggere sempre le Condizioni di Vendita.
LIQUIDITÀ: ≤33mm o lady = penalità 15-25%. Service documentato = +€100-300 e prima riga d'annuncio.
NEGOZIAZIONE: aprire 25-30% sotto ask ("piangere il morto"), leva emotiva per pezzo, pagamento immediato come carta. Difetti reali citati con precisione tecnica.
VERDETTO SEMPRE in una di 3 forme: COMPRA / TRATTA A X / PASSA, con il perché in una riga.`;

// -----------------------------------------------------------------------------
module.exports = { CONFIG, analyzeWithRules, DIGEST };

// Self-test:  node enciclopedia.js
if (require.main === module) {
  const tests = [
    { title: 'Vacheron Constantin tasca oro 18k 750', description: 'peso 92 grammi, savonnette', priceEur: 2400 },
    { title: 'Longines 30CH oro rosa', description: 'quadrante ristampato, revisionato 2024', priceEur: 6000 },
    { title: 'Universal Geneve microrotor cal 215', description: 'oro 18k, 34mm', priceEur: 1500 },
    { title: 'Omega Speedmaster cal 321', description: 'acciaio', priceEur: 9000 },
    { title: 'Baume & Mercier Classima quartz', description: 'come nuovo', priceEur: 900 },
    { title: 'Orologio lady oro 28mm', description: 'dennison 9k 375 case', priceEur: 400 },
  ];
  for (const t of tests) {
    const r = analyzeWithRules(t);
    console.log('—', t.title);
    console.log('  flags:', r.flags.join(', ') || '(nessuno)');
    r.summaryLines.forEach(l => console.log('  ', l));
    if (r.marginOfSafety) console.log('   marginOfSafety:', r.marginOfSafety);
  }
}
