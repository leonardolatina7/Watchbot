/**
 * vacheronCalibers.js — DATABASE CALIBRI SOLO-TEMPO VACHERON CONSTANTIN
 * (v1.0, 07/07/26 — richiesta Leonardo, gemello del longinesCalibers.js)
 *
 * FONTE PRIMARIA: Beyond the Dial, "Collector Guide — VC Time-Only Movements
 * of the 20th Century" (Farmelo 2022) + venduti/comparabili raccolti 07/2026.
 *
 * PERCHÉ ESISTE: nei VC vintage il CALIBRO decide il premio. Lo stesso
 * solo-tempo oro può valere 4.000 o 8.000 a seconda del motore. Il bot deve
 * riconoscere il calibro nel titolo/descrizione e alzare la bandiera giusta.
 *
 * GERARCHIA (dal vertice):
 *  GRAIL  → 1007/1008 (Chronometer Royal: Sigillo Ginevra + COSC + hacking)
 *  TOP    → K1001/K1002 ("tra i più bei manuali mai fatti", pari solo ai
 *           top Patek 23-300 / 27-AM400) · 453/454 (base storica JLC 450)
 *  CULT   → K1003 ultra-piatto 1,64mm (il più sottile di sempre, ancora oggi
 *           in produzione) · 1120 auto (base JLC 920 = stessa di AP 2120
 *           Royal Oak e PP 28-255 Nautilus; motore del VC 222)
 *  RARO   → 1070 (auto piccoli secondi, quasi introvabile) · 498/499
 *  BUONO  → 1071 (top auto '59-'69, rotore oro) · 1072 (+data) · 1019 · 477
 *  MEDIO  → K1014 (3 ponti, MAI Sigillo Ginevra: buono ma senza premio)
 *
 * REGOLE ANTI-ERRORE CODIFICATE:
 *  - cal. "1040" VC NON È MAI ESISTITO (confusione con 1014 o col
 *    Lemania/Omega 1040). Se un annuncio lo dichiara → bandiera rossa.
 *  - COERENZA quadrante↔calibro: 453/1001/1007/1070/498 = PICCOLI secondi;
 *    454/1002/1008/1071/1072/1019/499/477 = secondi CENTRALI. Layout che
 *    non torna = possibile franken o attribuzione sbagliata.
 *  - "Vacheron Costantin" (refuso) viene riconosciuto lo stesso: è proprio
 *    lì che si nascondono gli affari (sinergia col blocco J errori).
 */
'use strict';

// ── Riconoscimento marca (include i refusi più comuni) ──
const VC_RE = /(vacheron|constantin|costantin|konstantin)/i;

// ── Calibri a PICCOLI secondi vs secondi CENTRALI (per il check coerenza) ──
const SUB_SECONDS = ['453', '1001', '1007', '1070', '498', '1014'];
const CENTER_SECONDS = ['454', '1002', '1008', '1071', '1072', '1019', '499', '477'];

// ── Database. L'ordine conta: i più specifici prima. ──
const CALIBERS = [
  { id: '1007', re: /\b1007\b/, tier: 'GRAIL', sec: 'piccoli',
    line: 'cal. 1007 CHRONOMETER ROYAL — GRAIL: 453 rifinito al vertice, 19 rubini, Sigillo di Ginevra, COSC, hacking (BS). Il massimo dei solo-tempo VC' },
  { id: '1008', re: /\b1008\b/, tier: 'GRAIL', sec: 'centrali',
    line: 'cal. 1008 CHRONOMETER ROYAL — GRAIL: come il 1007 ma secondi centrali. Sigillo di Ginevra + COSC' },
  { id: 'K1001', re: /\bk?\s*[- ]?\s*1001\b/i, tier: 'TOP', sec: 'piccoli',
    line: 'cal. K1001 — TOP: manuale sottile 5 ponti, 18 rubini, base JLC esclusiva VC. Col 1002 "tra i più bei manuali mai fatti" (pari solo ai top Patek). /1 = Gyromax + Sigillo Ginevra' },
  { id: 'K1002', re: /\bk?\s*[- ]?\s*1002\b/i, tier: 'TOP', sec: 'centrali',
    line: 'cal. K1002 — TOP: il gemello a secondi CENTRALI del K1001 (base JLC 819). /2 = Gyromax + Sigillo Ginevra' },
  { id: 'K1003', re: /\bk?\s*[- ]?\s*1003\b/i, tier: 'CULT', sec: 'solo ore/minuti',
    line: 'cal. K1003 — CULT: ultra-piatto 1,64mm, il manuale tradizionale PIÙ SOTTILE DI SEMPRE (base JLC 839/849), ancora in produzione oggi (Historiques Ultra-Fine, listino £26.900+). Vintage sottovalutato vs il modernissimo' },
  { id: 'K1014', re: /\bk?\s*[- ]?\s*1014\b/i, tier: 'MEDIO', sec: 'piccoli',
    line: 'cal. K1014 — MEDIO: 3 ponti (base JLC 818), 21 rubini, MAI Sigillo di Ginevra. Buono ma è il "fratello economico" del 1001: niente premio da calibro' },
  { id: '1120', re: /\b1120\b/, tier: 'CULT', sec: 'varie',
    line: 'cal. 1120 — LEGGENDA AUTO: base JLC 920, la STESSA di AP 2120 (Royal Oak) e PP 28-255 (Nautilus). Ultra-piatto, 36 rubini, Sigillo Ginevra. Motore del VC 222' },
  { id: '1071', re: /\b1071\b/, tier: 'TOP AUTO', sec: 'centrali',
    line: 'cal. 1071 — TOP AUTO 1959-69: Gyromax + collo di cigno + rotore in ORO 18k, 29 rubini' },
  { id: '1070', re: /\b1070\b/, tier: 'RARO', sec: 'piccoli',
    line: 'cal. 1070 — RARISSIMO: il 1071 a piccoli secondi. Quasi introvabile: caccia grossa, premio da rarità' },
  { id: '1072', re: /\b1072\b/, tier: 'BUONO', sec: 'centrali',
    line: 'cal. 1072 — BUONO: 1071 + data, rotore oro inciso. Comune su 35mm anni 60 anche in ACCIAIO (entry-point VC)' },
  { id: '1019', re: /\b1019\b/, tier: 'BUONO', sec: 'centrali',
    line: 'cal. 1019 — auto bidirezionale 1956-59, 21 rubini' },
  { id: '498', re: /\b498\b/, tier: 'RARO', sec: 'piccoli',
    line: 'cal. 498 — auto a rotore completo 1954-56, PICCOLI secondi: raro' },
  { id: '499', re: /\b499\b/, tier: 'RARO', sec: 'centrali',
    line: 'cal. 499 — auto a rotore completo 1954-56: raro' },
  { id: '477', re: /\b477\b/, tier: 'BUONO', sec: 'centrali',
    line: 'cal. 477 — primo auto VC (1951), rotore bumper (brevetto Rolex bloccava il giro completo)' },
  // 453/454 in fondo: i \b...\b a 3 cifre rischiano più falsi match nei ref;
  // se il titolo dice "P453" o "453/2C" li becca comunque.
  { id: '453', re: /\b(?:p\.?\s*)?453(?:\s*\/\s*\w+)?\b/i, tier: 'TOP', sec: 'piccoli',
    line: 'cal. 453 (P453) — TOP: base storica JLC 450 raffinata VC, anni 40-60, piccoli secondi. Versioni /xB con collo di cigno; alcune 18 rubini + Sigillo Ginevra' },
  { id: '454', re: /\b(?:p\.?\s*)?454(?:\s*\/\s*\w+)?\b/i, tier: 'TOP', sec: 'centrali',
    line: 'cal. 454 (P454) — TOP: il gemello a secondi CENTRALI del 453 (ponte modificato). Frequente nei ref con anse teardrop' },
];

// ── Analisi completa di un titolo/descrizione ──
function analyzeVacheron(text) {
  const t = String(text || '');
  const isVC = VC_RE.test(t);
  if (!isVC) return { isVacheron: false };

  const out = { isVacheron: true, caliber: null, tier: null, warnings: [] };

  // TRAPPOLA cal. 1040: mai esistito in VC
  if (/\b1040\b/.test(t)) {
    out.warnings.push('il cal. "1040" VC NON È MAI ESISTITO (confusione con 1014 o col Lemania/Omega 1040) → chiedi foto movimento, sospetta attribuzione sbagliata');
  }

  for (const c of CALIBERS) {
    if (c.re.test(t)) { out.caliber = c; out.tier = c.tier; break; }
  }

  // Check coerenza quadrante↔calibro quando il testo dichiara il layout
  if (out.caliber && out.caliber.sec === 'piccoli' && /(second[ei] central|center second|sweep second|zentralsekunde)/i.test(t)) {
    out.warnings.push(`il ${out.caliber.id} ha PICCOLI secondi ma l'annuncio parla di secondi centrali → incoerenza: possibile franken o calibro sbagliato`);
  }
  if (out.caliber && out.caliber.sec === 'centrali' && /(piccoli second|small second|sub[- ]second|petite seconde)/i.test(t)) {
    out.warnings.push(`il ${out.caliber.id} ha secondi CENTRALI ma l'annuncio parla di piccoli secondi → incoerenza: possibile franken o calibro sbagliato`);
  }

  return out;
}

// ── Riga pronta per gli alert Telegram ('' se niente da dire) ──
function vacheronLine(text) {
  const a = analyzeVacheron(text);
  if (!a.isVacheron) return '';
  const parts = [];
  if (a.caliber) parts.push(`\u{1F48E} <b>VC ${a.caliber.line}</b>`);
  for (const w of a.warnings) parts.push(`\u{1F6A9} <b>Attenzione VC:</b> ${w}`);
  // Ricordo strutturale che regge il premio su TUTTI i VC d'epoca:
  if (a.caliber && ['GRAIL', 'TOP', 'CULT', 'RARO', 'TOP AUTO'].includes(a.tier)) {
    parts.push(`\u{1F4CC} Anni 40-60: VC produceva max 24 esemplari per referenza/configurazione \u2192 scarsit\u00E0 strutturale reale`);
  }
  return parts.length ? parts.join('\n') : '';
}

module.exports = { analyzeVacheron, vacheronLine, CALIBERS, SUB_SECONDS, CENTER_SECONDS };
