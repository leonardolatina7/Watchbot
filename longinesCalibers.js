/**
 * longinesCalibers.js — Modulo specializzato LONGINES per Watch Price Bot
 * ---------------------------------------------------------------------------
 * Si affianca a caliberDatabase.js (non lo sostituisce). Mentre caliberDb è
 * generico, questo modulo conosce le insidie SPECIFICHE di Longines:
 *   - i 3 cronografi interamente in-house (13.33Z / 13ZN / 30CH) vs Valjoux;
 *   - la trappola delle ridenominazioni 1972 (530/538 = 30CH);
 *   - Ultra-chron 430 (36000 vph) vs 6641+ (28800 vph ridotta);
 *   - i crono 330/334/336 su base Valjoux (valore = Valjoux);
 *   - elettronici/diapason (Ultronic, Dynotron) fuori dalla tesi melt;
 *   - DATAZIONE dal seriale sul calibro (1931→1988) con flag anti-franken.
 *
 * Fonte dati: Contatori del Tempo (cronologia + database seriali). Valori
 * INDICATIVI, non definitivi: il modulo lo dichiara sempre negli alert.
 *
 * USO in index.js (stesso pattern di caliberDb.caliberLine):
 *   const longines = require('./longinesCalibers');
 *   ...appendi all'alert:
 *     (longines.longinesLine(item.title) ? longines.longinesLine(item.title)+'\n' : '')
 *
 * longinesLine(title)  -> stringa Telegram-ready (HTML) oppure '' se non Longines
 * dateFromSerial(n)    -> { year, approx, warn } | null
 * analyzeLongines(t)   -> oggetto completo (per /api endpoint diagnostico)
 */

'use strict';

// ───────────────────────── CRONOLOGIA CALIBRI ─────────────────────────
// Mappa: chiave calibro normalizzato -> { year, type, base, note, flag }
// flag: 'inhouse' | 'valjoux' | 'renamed' | 'highbeat' | 'lowbeat' | 'electronic'
const CALIBERS = {
  '13.33Z': { year: 1912, type: 'chrono', flag: 'inhouse',
    note: 'Primo chrono alta gamma da polso. In-house, pezzo da collezione.' },
  '13ZN':   { year: 1937, type: 'chrono', flag: 'inhouse',
    note: 'Flyback in-house, il primo flyback da polso. Leggenda, valori alti.' },
  '30CH':   { year: 1947, type: 'chrono', flag: 'inhouse',
    note: 'Flyback ruota a colonne, in-house. Ultimo grande crono manifattura.' },
  '12.68Z': { year: 1932, type: 'solotempo', flag: 'inhouse',
    note: 'Solo-tempo/sec. centrale. Famiglia Lindbergh (10.68Z) = premio.' },
  '22A':    { year: 1945, type: 'auto', base: '22L', note: 'Primo automatico Longines, 18000 vph.' },
  '19A':    { year: 1952, type: 'auto', base: '8.68N', note: 'Auto sec. centrale, base per date 19AD/ASD.' },
  '280':    { year: 1958, type: 'manual', note: 'Manuale sec. diretta centrale, 19800 vph.' },
  '290':    { year: 1958, type: 'auto', note: 'Auto sec. centrale, 19800 vph.' },
  '430':    { year: 1967, type: 'auto', flag: 'highbeat',
    note: 'Ultra-chron AUTO ALTA FREQUENZA 36000 vph. Punto di forza in vendita.' },
  '431':    { year: 1967, type: 'auto', flag: 'highbeat', note: 'Ultra-chron con data, 36000 vph.' },
  '501':    { year: 1968, type: 'auto', base: 'Record', note: 'Auto data, base Record (post-fusione).' },
  '503':    { year: 1968, type: 'auto', base: 'Record', note: 'Auto day-date, base Record.' },
  '7214':   { year: 1968, type: 'electronic', base: 'ESA 9154', flag: 'electronic',
    note: 'Dynotron (bilanciere/transistor). NON meccanico, fuori tesi melt.' },
  '6312':   { year: 1969, type: 'electronic', base: 'ESA 9162', flag: 'electronic',
    note: 'Ultronic diapason. NON meccanico, profilo di rischio diverso.' },
  '6332':   { year: 1972, type: 'electronic', base: 'ESA 9164', flag: 'electronic',
    note: 'Ultronic diapason day-date. NON meccanico.' },
  '330':    { year: 1970, type: 'chrono', base: 'Valjoux 726', flag: 'valjoux',
    note: 'Chrono su BASE VALJOUX 726. Valore = Valjoux, non manifattura.' },
  '334':    { year: 1972, type: 'chrono', base: 'Valjoux 236', flag: 'valjoux',
    note: 'Chrono su BASE VALJOUX 236. Valore = Valjoux.' },
  '336':    { year: 1972, type: 'chrono', base: 'Valjoux 234', flag: 'valjoux',
    note: 'Chrono su BASE VALJOUX 234. Valore = Valjoux.' },
  '530':    { year: 1972, type: 'chrono', base: '30CH', flag: 'renamed',
    note: 'RIDENOMINAZIONE del 30CH del 1947: STESSO movimento, nessun premio novita.' },
  '538':    { year: 1972, type: 'chrono', base: '30CH', flag: 'renamed',
    note: 'RIDENOMINAZIONE 30CH senza secondi (Nonius): stesso movimento del 1947.' },
  '6641':   { year: 1972, type: 'auto', base: '430', flag: 'lowbeat',
    note: 'Ultra-chron a freq. RIDOTTA 28800 vph: inferiore al 430 originale 36000.' },
  '6651':   { year: 1972, type: 'auto', base: '431', flag: 'lowbeat',
    note: 'Ultra-chron a freq. RIDOTTA 28800 vph.' },
};

// Etichette dei flag per l'alert
const FLAG_LABEL = {
  inhouse:    '\u2728 IN-HOUSE Longines',
  valjoux:    '\u26A0\uFE0F base Valjoux (valore=Valjoux)',
  renamed:    '\u26A0\uFE0F 30CH ridenominato (no premio novita)',
  highbeat:   '\u2728 alta freq. 36000 vph',
  lowbeat:    '\u26A0\uFE0F freq. ridotta 28800 vph',
  electronic: '\u{1F50B} elettronico/diapason (fuori tesi melt)',
};

// ───────────────────────── DATABASE SERIALI ─────────────────────────
// Punti di ancoraggio (anno -> seriale calibro). Interpoliamo linearmente
// tra i punti noti. Dati indicativi (fonte Contatori del Tempo).
const SERIAL_ANCHORS = [
  [1931, 5031000], [1932, 5104500], [1933, 5177000], [1934, 5250000],
  [1935, 5333000], [1936, 5416000], [1937, 5500000], [1938, 5750000],
  [1939, 5850000], [1940, 5950000], [1941, 6140000], [1942, 6332000],
  [1943, 6523000], [1944, 6714000], [1945, 6905000], [1946, 7107000],
  [1947, 7309000], [1948, 7511000], [1949, 7713000], [1950, 7915000],
  [1951, 8225000], [1952, 8535000], [1953, 8845000], [1954, 9183000],
  [1955, 9521000], [1956, 9859000], [1957, 10201000], [1958, 10331299],
  [1959, 10501813], [1960, 10822087], [1961, 11538000], [1962, 11864000],
  [1963, 12116000], [1964, 12368900], [1965, 12621000], [1966, 12874000],
  [1967, 13835380], [1968, 14834000], [1969, 15000000],
];

// Zona di incongruenza nota (fatturazioni 1958/1959 mescolate)
const FUZZY_LOW = 10300000, FUZZY_HIGH = 10550000;

/**
 * dateFromSerial(n) -> { year, approx, warn } | null
 * n = numero seriale letto sul CALIBRO.
 */
function dateFromSerial(n) {
  if (!n || isNaN(n)) return null;
  n = Math.round(Number(n));

  // Serie moderna 50 milioni (1970-1988)
  if (n >= 50000000 && n <= 58100000) {
    return { year: null, approx: '1970\u20131988',
      warn: 'Serie 50 mln (post-10/02/1970): progressione non lineare, datazione solo a fasce. Il seriale sul FONDELLO va ignorato.' };
  }
  if (n > 58100000) {
    return { year: null, approx: 'post-1988',
      warn: 'Oltre 58.051.000 (fine numerazione 1988). Dal 1990 referenze moderne, non seriali.' };
  }

  // Sotto il primo ancoraggio o sopra i 15 mln
  if (n < SERIAL_ANCHORS[0][1]) {
    return { year: null, approx: 'pre-1931', warn: 'Sotto il range tabellato: anteguerra, datazione indicativa.' };
  }
  if (n > 15000000 && n < 50000000) {
    return { year: 1969, approx: '~1969', warn: 'Vicino al tetto della prima serie (15 mln, 1969).' };
  }

  // Interpolazione lineare tra ancoraggi
  let year = null;
  for (let i = 0; i < SERIAL_ANCHORS.length - 1; i++) {
    const [y0, s0] = SERIAL_ANCHORS[i];
    const [y1, s1] = SERIAL_ANCHORS[i + 1];
    if (n >= s0 && n <= s1) {
      const frac = (n - s0) / (s1 - s0);
      year = Math.round(y0 + frac * (y1 - y0));
      break;
    }
  }
  if (year === null) year = 1969;

  const warn = (n >= FUZZY_LOW && n <= FUZZY_HIGH)
    ? 'ZONA INCONGRUENTE (~10,5 mln): fatturazioni 1958/1959 mescolate, datazione \u00B11-2 anni.'
    : null;

  return { year, approx: '~' + year, warn };
}

// ───────────────────────── PARSING TITOLO ─────────────────────────
function isLongines(title) {
  return /longines/i.test(title || '');
}

// Estrae un calibro Longines noto dal titolo (se citato)
function findCaliber(title) {
  if (!title) return null;
  const up = title.toUpperCase().replace(/\s+/g, ' ');
  // ordina le chiavi dalla più lunga (evita che "30" matchi prima di "30CH")
  const keys = Object.keys(CALIBERS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    // confine di parola "soft": il calibro può essere preceduto da cal/calibro/cal.
    const kEsc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|[^0-9A-Z])' + kEsc + '(?:[^0-9A-Z]|$)', 'i');
    if (re.test(' ' + up + ' ')) return { key: k, ...CALIBERS[k] };
  }
  return null;
}

// Estrae un possibile seriale dal titolo SOLO se introdotto da una parola-chiave
// esplicita (serial/seriale/movimento/mvt/n.). Evita di scambiare una REFERENZA
// per un seriale e datare a vuoto. Nei fatti il seriale sta nella foto del
// movimento, non nel titolo: meglio prudenti.
function findSerial(title) {
  if (!title) return null;
  const m = (title || '').match(
    /(?:serial(?:e)?|movimento|mvt|n\.?|nr\.?|#)\s*[:#]?\s*(\d{1,2}[.\u2019' ]?\d{3}[.\u2019' ]?\d{3})\b/i
  );
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.\u2019' ]/g, ''), 10);
  if (n >= 300000 && n <= 58100000) return n;
  return null;
}

// ───────────────────────── OUTPUT ─────────────────────────
/**
 * analyzeLongines(title) -> oggetto strutturato (per endpoint diagnostico)
 */
function analyzeLongines(title) {
  if (!isLongines(title)) return { isLongines: false };
  const cal = findCaliber(title);
  const serial = findSerial(title);
  const serialDate = serial ? dateFromSerial(serial) : null;

  // Flag franken: seriale data un'epoca, ma il calibro citato è di un'altra.
  let frankenWarn = null;
  if (cal && serialDate && serialDate.year && cal.year) {
    const gap = Math.abs(serialDate.year - cal.year);
    // un 30CH (1947) può avere seriali fino agli anni '60: tolleranza ampia in avanti,
    // ma il seriale NON può essere precedente all'introduzione del calibro.
    if (serialDate.year < cal.year - 1) {
      frankenWarn = `Seriale ~${serialDate.year} precedente all'introduzione del calibro ${cal.key} (${cal.year}): possibile ricassatura/franken o lettura errata.`;
    } else if (gap > 25) {
      frankenWarn = `Forte distanza tra seriale (~${serialDate.year}) e calibro ${cal.key} (${cal.year}): verifica coerenza cassa/quadrante/movimento.`;
    }
  }

  return { isLongines: true, caliber: cal, serial, serialDate, frankenWarn };
}

/**
 * longinesLine(title) -> stringa Telegram-ready (HTML) o '' se non Longines
 * Stesso contratto di caliberDb.caliberLine: una riga (o poche) da appendere.
 */
function longinesLine(title) {
  const a = analyzeLongines(title);
  if (!a.isLongines) return '';

  const parts = [];
  const cal = a.caliber;

  if (cal) {
    let line = `\u{1F1E8}\u{1F1ED} <b>Longines cal. ${cal.key}</b> (${cal.year})`;
    if (cal.flag && FLAG_LABEL[cal.flag]) line += ` \u2014 ${FLAG_LABEL[cal.flag]}`;
    parts.push(line);
    parts.push(`   <i>${cal.note}</i>`);
    if (cal.base) parts.push(`   base: ${cal.base}`);
  } else {
    // È un Longines ma il calibro non è citato: ricorda di chiederlo.
    parts.push(`\u{1F1E8}\u{1F1ED} <b>Longines</b> \u2014 calibro non indicato: chiedi foto movimento (il valore dipende dal calibro).`);
  }

  if (a.serialDate) {
    if (a.serialDate.year) {
      parts.push(`\u{1F4C5} Seriale ${a.serial.toLocaleString('it-IT')} \u2192 datazione ${a.serialDate.approx} (sul calibro)`);
    } else {
      parts.push(`\u{1F4C5} Seriale ${a.serial.toLocaleString('it-IT')} \u2192 ${a.serialDate.approx}`);
    }
    if (a.serialDate.warn) parts.push(`   \u26A0\uFE0F ${a.serialDate.warn}`);
  }

  if (a.frankenWarn) parts.push(`\u{1F6A9} <b>${a.frankenWarn}</b>`);

  // Promemoria fisso: il seriale sta sul calibro, non sulla cassa.
  if (cal && cal.flag === 'inhouse') {
    parts.push(`   \u{1F4DC} Verifica: clessidra alata vs solo-logo (prima serie = premio), sigla "LXW" sul ponte = import USA.`);
  }

  return parts.join('\n');
}

module.exports = {
  isLongines,
  findCaliber,
  findSerial,
  dateFromSerial,
  analyzeLongines,
  longinesLine,
  CALIBERS,
  SERIAL_ANCHORS,
};
