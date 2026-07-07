/**
 * maisonCalibers.js — DATABASE UNICO CALIBRI MAISON (v1.0, 07/07/26)
 * "Tutto incluso in tutto": UN modulo per Vacheron + Jaeger-LeCoultre +
 * Audemars Piguet + Omega. Sostituisce vacheronCalibers.js (che assorbe
 * per intero) — il vecchio file puo' essere cancellato dal repo.
 *
 * Fonti: Beyond the Dial (VC), Enciclopedia v17 capp. 6-9, venduti 07/2026.
 *
 * COSA FA: dal titolo/descrizione riconosce marca + calibro, assegna il
 * tier, alza bandiere su trappole e incoerenze. Usato negli alert
 * (maisonLine) accanto a longinesCalibers e caliberDatabase.
 *
 * TRAPPOLE CODIFICATE:
 *  - VC "1040" mai esistito (confusione col 1014 o con l'Omega 1040)
 *  - coerenza secondi VC (piccoli vs centrali)
 *  - JLC + "920" = incoerenza (il 920 non fu MAI montato su JLC:
 *    solo AP 2120 / PP 28-255 / VC 1120)
 *  - JLC ref. 111.x anni '80 = spesso QUARZO serie 600
 *  - Omega ref. famiglia 321 (2279/2439/2451/2468/2884) = MAI melt
 *    (chiude il fix misclassificazione del 07/07)
 *  - AP "2003": distinto dall'ANNO 2003 (serve contesto cal./ultra-piatto)
 */
'use strict';

// ── Riconoscimento marca (refusi inclusi: e' li' che stanno gli affari) ──
const BRANDS = [
  { id: 'VC',    re: /(vacheron|constantin|costantin|konstantin)/i, label: 'VC' },
  { id: 'AP',    re: /(audemars|piguet|audemar\b)/i,                label: 'AP' },
  { id: 'JLC',   re: /(jaeger|le\s?coultre|jeager|lecoultre)/i,     label: 'JLC' },
  { id: 'OMEGA', re: /\bomega\b/i,                                   label: 'Omega' },
];

// ── Coerenza secondi VC ──
const VC_SUB = ['453','1001','1007','1070','498','1014'];
const VC_CTR = ['454','1002','1008','1071','1072','1019','499','477'];

// ── Database calibri. `need` = contesto extra richiesto (anti falsi positivi). ──
const CAL = {
  VC: [
    { id:'1007', re:/\b1007\b/, tier:'GRAIL', sec:'piccoli',
      line:'cal. 1007 CHRONOMETER ROYAL — GRAIL: 453 rifinito al vertice, 19 rubini, Sigillo di Ginevra, COSC, hacking (BS)' },
    { id:'1008', re:/\b1008\b/, tier:'GRAIL', sec:'centrali',
      line:'cal. 1008 CHRONOMETER ROYAL — GRAIL: come il 1007 ma secondi centrali. Sigillo + COSC' },
    { id:'K1001', re:/\bk?\s*[- ]?\s*1001\b/i, tier:'TOP', sec:'piccoli',
      line:'cal. K1001 — TOP: manuale sottile 5 ponti, base JLC esclusiva. Col 1002 "tra i piu\u0300 bei manuali mai fatti" (pari solo ai top Patek). /1 = Gyromax + Sigillo' },
    { id:'K1002', re:/\bk?\s*[- ]?\s*1002\b/i, tier:'TOP', sec:'centrali',
      line:'cal. K1002 — TOP: il gemello a secondi CENTRALI del K1001 (base JLC 819)' },
    { id:'K1003', re:/\bk?\s*[- ]?\s*1003\b/i, tier:'CULT', sec:'solo ore/minuti',
      line:'cal. K1003 — CULT: ultra-piatto 1,64mm, il manuale PIU\u0300 SOTTILE DI SEMPRE. Gemello del cal. AP 2003 (progetto congiunto). Vintage sottovalutato vs Historiques moderno' },
    { id:'K1014', re:/\bk?\s*[- ]?\s*1014\b/i, tier:'MEDIO', sec:'piccoli',
      line:'cal. K1014 — MEDIO: 3 ponti, MAI Sigillo di Ginevra: niente premio da calibro' },
    { id:'1120', re:/\b1120\b/, tier:'CULT', sec:'varie',
      line:'cal. 1120 — LEGGENDA AUTO: base JLC 920, la STESSA di AP 2120 (Royal Oak) e PP 28-255 (Nautilus). Motore del VC 222' },
    { id:'1071', re:/\b1071\b/, tier:'TOP AUTO', sec:'centrali',
      line:'cal. 1071 — TOP AUTO 1959-69: Gyromax, collo di cigno, rotore bordato ORO 18k' },
    { id:'1070', re:/\b1070\b/, tier:'RARO', sec:'piccoli',
      line:'cal. 1070 — RARISSIMO: il 1071 a piccoli secondi. Caccia grossa' },
    { id:'1072', re:/\b1072\b/, tier:'BUONO', sec:'centrali',
      line:'cal. 1072 — BUONO: 1071 + data. Comune su 35mm anche in ACCIAIO (entry-point VC)' },
    { id:'1019', re:/\b1019\b/, tier:'BUONO', sec:'centrali', line:'cal. 1019 — auto bidirezionale 1956-59' },
    { id:'498',  re:/\b498\b/,  tier:'RARO', sec:'piccoli',  line:'cal. 498 — auto rotore completo 1954-56, piccoli secondi: raro' },
    { id:'499',  re:/\b499\b/,  tier:'RARO', sec:'centrali', line:'cal. 499 — auto rotore completo 1954-56: raro' },
    { id:'477',  re:/\b477\b/,  tier:'BUONO', sec:'centrali', line:'cal. 477 — primo auto VC (1951), rotore bumper' },
    { id:'453',  re:/\b(?:p\.?\s*)?453(?:\s*\/\s*\w+)?\b/i, tier:'TOP', sec:'piccoli',
      line:'cal. 453 (P453) — TOP: base JLC 450 raffinata VC, anni 40-60. /xB con collo di cigno' },
    { id:'454',  re:/\b(?:p\.?\s*)?454(?:\s*\/\s*\w+)?\b/i, tier:'TOP', sec:'centrali',
      line:'cal. 454 (P454) — TOP: il gemello a secondi CENTRALI del 453. Frequente su anse teardrop' },
  ],
  JLC: [
    { id:'K911/916', re:/\bk?\s?9(11|16)\b/i, tier:'TOP',
      line:'cal. K911/K916 "Speed Beat" 28.800 A/h (1970): gli ultimi e migliori Memovox' },
    { id:'849', re:/\b849\b/, tier:'TOP',
      line:'cal. 849 — manuale ultrapiatto 1,85mm, decenni di produzione. Dress oro 18k = tesi melt + finezza da manifattura' },
    { id:'825', re:/\b825\b/, tier:'TOP',
      line:'cal. 825 — Memovox auto a rotore pieno: meglio del bumper 815. Il JLC iconico ancora accessibile (€1.500-3.500)' },
    { id:'815', re:/\b815\b/, tier:'BUONO', line:'cal. 815 — Memovox auto bumper (pre-825)' },
    { id:'497', re:/\b497\b/, tier:'CULT',
      line:'cal. 497 FUTUREMATIC — auto SENZA corona di carica, riserva a lancetta: icona anni 50 sottovalutata (€1.200-2.500)' },
    { id:'489', re:/\b489\b/, tier:'BUONO', line:'cal. 489 — Memovox manuale anni 50' },
    { id:'P478', re:/\b(?:p\.?\s?)?478\b/i, tier:'CULT',
      line:'cal. P478 — GEOPHYSIC 1958: chronometer antimagnetico. Cult; catalizzatore (riedizione 2014) gia\u0300 scattato: esemplare onesto sotto mercato = caccia grossa' },
    { id:'450', re:/\b450\b/, tier:'TOP',
      line:'cal. 450 famiglia — la base dei VC 453/454: stesso DNA a prezzo JLC ("mezzo Vacheron")' },
    { id:'101', re:/\b101\b/, tier:'CULT',
      line:'cal. 101 (1929) — il movimento meccanico piu\u0300 piccolo del mondo (~1g): museo/gioielleria' },
  ],
  AP: [
    { id:'13VZAS', re:/(vzas|13\s?vz)/i, tier:'GRAIL',
      line:'cal. 13VZAS (base Valjoux) — ~300 cronografi AP totali pre-1990: tra i piu\u0300 rari al mondo, aste a SEI CIFRE. Se mal catalogato = jackpot; franken proporzionali' },
    { id:'2120/21', re:/\b212[01]\b/, tier:'LEGGENDA',
      line:'cal. 2120/2121 — base JLC 920: il motore del Royal Oak 5402 "Jumbo" (2121 = +data), in produzione fino al 15202' },
    { id:'2003', re:/\b2003\b/, need:/(cal\w*|kal)\.?\s*2003|ultra|piatt|thin|extra.?flat|sottil/i, tier:'CULT',
      line:'cal. 2003 — ultra-piatto 1,64mm, progetto congiunto AP-JLC-VC: GEMELLO del VC K1003. Motore del 5043 "grail silenzioso" (dealer €4.500-8.000)' },
    { id:'920', re:/\b920\b/, tier:'INFO', line:'base JLC 920 = AP cal. 2120 (v. sopra)' },
  ],
  OMEGA: [
    { id:'321', re:/\b321\b/, tier:'GRAIL',
      line:'cal. 321 — ruota a colonne, il "calibro della Luna" pre-68. REGOLA: MAI melt; in oro = doppio pavimento (metallo + collezione)' },
    { id:'33.3', re:/33[\.,]3|\bchro\b/i, tier:'RARO',
      line:'cal. 33.3 CHRO — crono anni 30-40 pre-321 (base Lemania 15TL): €3.000-8.000, spesso ricassato → anti-franken rigoroso' },
    { id:'30T2/26x', re:/\b(30\s?t2|265|266|267|283|286)\b/i, tier:'TOP',
      line:'cal. 30T2/serie 26x — il manuale da osservatorio anni 40-50: value assoluto (acciaio €400-900, oro €800-1.800)' },
    { id:'5xx', re:/\b(550|551|552|561|562|564)\b/, tier:'TOP',
      line:'serie 500 — top auto anni 60, 24 rubini. 561/564 Constellation chronometer: quadrante pie-pan = premium' },
    { id:'861', re:/\b861\b/, tier:'BUONO',
      line:'cal. 861 — il post-321 a camma: ottimo movimento ma NIENTE premio colonne. Non pagarlo "da 321"' },
    { id:'1040', re:/\b1040\b/, tier:'NICCHIA',
      line:'cal. 1040 (base Lemania 1340) — il PRIMO crono automatico Omega (Mark III, Flightmaster). E\u0300 QUESTO il "1040" che i venditori confondono col VC 1040 inesistente' },
    { id:'354/47x', re:/\b(354|470|471)\b/, tier:'BUONO',
      line:'cal. 354/470/471 — primi automatici Omega (354 bumper anni 50): fascino a prezzi umani' },
    { id:'Megaquartz', re:/(megaquartz|\b240[01]\b)/i, tier:'CULT',
      line:'Megaquartz 2400/2401 (2,4 MHz) — il quarzo che e\u0300 collezione vera: l\u2019eccezione informata al "no quarzo"' },
  ],
};

// ── Ref. Omega famiglia 321: bandiera anche SENZA "321" nel titolo ──
const OMEGA_321_REFS = /\b(2279|2439|2451|2468|2884)\b/;
// ── Ref. JLC anni '80 a rischio quarzo ──
const JLC_QUARTZ_REF = /\b111\.\d/;

// Tolgo i prezzi dal testo prima del match: "€450" non deve accendere il cal. 450
function stripPrices(s) {
  return String(s || '')
    .replace(/[\u20ac$\u00a3]\s?\d[\d.,]*/g, ' ')
    .replace(/\d[\d.,]*\s?[\u20ac$\u00a3]/g, ' ')
    .replace(/\d[\d.,]*\s?(?:eur\w*|usd|chf)\b/gi, ' ');
}

function analyzeMaison(text) {
  const raw = String(text || '');
  const t = stripPrices(raw);
  const hits = [];      // { brand, caliber }
  const warnings = [];

  const brandsFound = BRANDS.filter(b => b.re.test(raw));
  if (!brandsFound.length) return { isMaison: false, hits, warnings };

  for (const b of brandsFound) {
    // trappole per-marca PRIMA dei calibri
    if (b.id === 'VC' && /\b1040\b/.test(t) && !brandsFound.some(x => x.id === 'OMEGA')) {
      warnings.push('il cal. "1040" VC NON E\u0300 MAI ESISTITO (confusione col 1014 o con l\u2019Omega 1040) → chiedi foto movimento');
    }
    if (b.id === 'JLC' && /\b920\b/.test(t)) {
      warnings.push('il cal. 920 non fu MAI montato su un JLC (solo AP 2120 / PP 28-255 / VC 1120): attribuzione sbagliata o franken');
    }
    if (b.id === 'JLC' && JLC_QUARTZ_REF.test(raw)) {
      warnings.push('ref. JLC 111.x anni \u201980 = spesso QUARZO serie 600: verificare il movimento PRIMA di rilanciare');
    }
    if (b.id === 'OMEGA' && OMEGA_321_REFS.test(raw)) {
      warnings.push('ref. famiglia cal. 321 (2279/2439/2451/2468/2884): MAI classificare come pezzo da fuso — il valore e\u0300 collezionistico');
    }

    for (const c of (CAL[b.id] || [])) {
      if (!c.re.test(t)) continue;
      if (c.need && !c.need.test(raw)) continue;   // contesto richiesto (es. AP 2003 vs anno)
      hits.push({ brand: b, caliber: c });
      break; // un calibro per marca
    }

    // coerenza secondi (solo VC)
    if (b.id === 'VC') {
      const h = hits.find(x => x.brand.id === 'VC');
      if (h && VC_SUB.includes(h.caliber.id.replace('K','')) && /(second[ei] central|center second|sweep second|zentralsekunde)/i.test(raw)) {
        warnings.push(`il ${h.caliber.id} ha PICCOLI secondi ma l'annuncio parla di secondi centrali → possibile franken`);
      }
      if (h && VC_CTR.includes(h.caliber.id.replace('K','')) && /(piccoli second|small second|sub[- ]second|petite seconde)/i.test(raw)) {
        warnings.push(`il ${h.caliber.id} ha secondi CENTRALI ma l'annuncio parla di piccoli secondi → possibile franken`);
      }
    }
  }
  return { isMaison: true, hits, warnings, brands: brandsFound.map(b => b.id) };
}

function maisonLine(text) {
  const a = analyzeMaison(text);
  if (!a.isMaison) return '';
  const parts = [];
  for (const h of a.hits) {
    if (h.caliber.tier === 'INFO') continue; // note minori: non sporcano l'alert
    parts.push(`\u{1F48E} <b>${h.brand.label} ${h.caliber.line}</b>`);
  }
  for (const w of a.warnings) parts.push(`\u{1F6A9} <b>Attenzione:</b> ${w}`);
  // promemoria strutturale VC (scarsita\u0300 reale)
  if (a.hits.some(h => h.brand.id === 'VC' && ['GRAIL','TOP','CULT','RARO','TOP AUTO'].includes(h.caliber.tier))) {
    parts.push('\u{1F4CC} VC anni 40-60: max 24 esemplari per referenza/configurazione \u2192 scarsit\u00e0 strutturale reale');
  }
  return parts.length ? parts.join('\n') : '';
}

module.exports = {
  analyzeMaison, maisonLine, CAL, BRANDS,
  // retrocompatibilita\u0300: chi chiamava il vecchio modulo VC continua a funzionare
  vacheronLine: maisonLine, analyzeVacheron: analyzeMaison,
};
