// ============================================================
// vintageKnowledge.js — Watchbot knowledge module (v1.0, 18/07/2026)
// Codifica il sapere dell'Enciclopedia: lume dating, cassai,
// quadrantai, calibri, keyword boost/flag, controlli di coerenza.
//
// INTEGRAZIONE (Watchbot v12.x):
//   const vk = require('./vintageKnowledge');
//   const r = vk.analyzeListing(titolo + ' ' + descrizione, { yearClaim: 1955 });
//   score += r.scoreDelta;                    // dentro aiGate.js, prima del tier routing
//   if (r.flags.length) alertText += '\n⚠️ ' + r.flags.join('\n⚠️ ');
//   if (r.boosts.length) alertText += '\n★ ' + r.boosts.join('\n★ ');
//   r.tags -> utile per catalystTracking / morningBrief
// Nessuna dipendenza esterna. Solo testo: non richiede AI (gratis, zero token).
// ============================================================

'use strict';

// ---------- 1. LUME DATING ----------
// La scritta sotto le 6 data il quadrante. Incrocio con l'anno dichiarato = anti-franken.
const LUME = [
  { re: /\bT\s*SWISS\s*(MADE\s*)?T\b|\bSWISS\s*T\s*<\s*25\b|\bT\s*<\s*25\b/i,
    material: 'trizio', from: 1960, to: 1998 },
  { re: /\bRADIUM\b|\bRADIO\b(?!\w)/i, material: 'radio', from: 1900, to: 1963 },
];

function lumeCheck(text, yearClaim) {
  const out = { flags: [], boosts: [], tags: [] };
  for (const l of LUME) {
    if (l.re.test(text)) {
      out.tags.push('lume:' + l.material);
      if (yearClaim && (yearClaim < l.from - 3 || yearClaim > l.to + 2)) {
        out.flags.push(
          `INCOERENZA LUME/ANNO: quadrante ${l.material} (${l.from}-${l.to}) ma anno dichiarato ${yearClaim} — possibile dial di servizio o data falsa`);
      }
      if (l.material === 'radio') out.flags.push('RADIO: maneggiare con cautela, Geiger consigliato');
    }
  }
  return out;
}

// ---------- 2. CASSAI (case makers) ----------
// Punzoni e nomi che aggiungono valore/attribuzione.
const CASE_MAKERS = [
  { re: /\bSPILLMANN\b|\bC\.?R\.?S\.?\b(?=.{0,40}(cassa|case|punzon))/i, name: 'C.R. Spillmann (Rolex Oyster/Daytona)', boost: 10 },
  { re: /\bWENGER\b/i, name: 'Wenger (VC/Patek/Omega c-case)', boost: 8 },
  { re: /\bTAUBERT\b|\bBORGEL\b/i, name: 'Taubert/Borgel (waterproof VC/Patek)', boost: 12 },
  { re: /\bSERVA\b/i, name: 'Serva (Constellation Pie-Pan)', boost: 6 },
  { re: /\bTENOR\b/i, name: 'Tenor (fornitore UG)', boost: 4 },
  { re: /\bGERLACH\b/i, name: 'Antoine Gerlach (Patek)', boost: 8 },
  { re: /\bEPSA\b|\bSUPER\s*COMPRESSOR\b|\bCOMPRESSOR\b|elmo\s+(da\s+)?palombaro|diving\s+helmet/i,
    name: 'EPSA Compressor/Super Compressor', boost: 9, tag: 'epsa' },
  { re: /\bDENNISON\b|\bDS&S\b|\b9\s*ct\b|\b375\b(?=.{0,30}(oro|gold))/i,
    name: 'Dennison/9k UK — vale MENO della cassa svizzera', boost: -6, flag: true },
  { re: /plaqu[eé]|gold\s*filled|laminat|placcat|\b\d{1,3}\s*microns?\b/i,
    name: 'PLACCATO/laminato — melt zero', boost: -10, flag: true },
];

// ---------- 3. QUADRANTAI & TECNICHE DIAL ----------
const DIAL_SIGNALS = [
  { re: /\bSTERN\s*(FR[EÈ]RES)?\b/i, name: 'Stern Frères (nobiltà Patek, cloisonné)', boost: 12 },
  { re: /\bSINGER\b/i, name: 'Jean Singer', boost: 6 },
  { re: /\bLEMRICH\b|\bBEYELER\b|\bFL[UÜ]CKIGER\b/i, name: 'quadrantaio storico', boost: 6 },
  { re: /cloisonn[eé]/i, name: 'CLOISONNÉ — il quadrante vale più del marchio (comps CHF 20-25k su UG)', boost: 20, tag: 'dial-art' },
  { re: /grand\s*feu|smalto\s+(a\s+)?gran\s*fuoco/i, name: 'smalto grand feu', boost: 12, tag: 'dial-art' },
  { re: /sector\s*dial|quadrante\s+a\s+settori/i, name: 'sector dial', boost: 8 },
  { re: /\bgilt\b/i, name: 'gilt dial (pre-1966 circa)', boost: 6 },
  { re: /indici\s+applicati|applied\s+(indices|markers)/i, name: 'indici applicati (categoria superiore, anti-redial)', boost: 5 },
  { re: /tropical/i, name: 'tropical dichiarato — VERIFICARE: viraggio uniforme e vellutato = ok; chiazzato/granuloso = degrado', boost: 4, verify: true },
  { re: /ristampato|ridipint|refinished|redial|restaurato(?=.{0,30}quadrante)|quadrante\s+restaurat/i,
    name: 'DIAL RITOCCATO — il mercato 2026 paga l\'originale, sconto forte', boost: -15, flag: true },
];

// ---------- 4. CALIBRI: riconoscimento e tier ----------
// tier: 'top' = collector, 'good' = manifattura solida, 'base' = ébauche comune
const CALIBERS = [
  { re: /\b321\b|\bLEMANIA\s*2310\b/i, name: 'Omega 321 / Lemania 2310 (ruota a colonne)', tier: 'top', boost: 15 },
  { re: /\b30\s*CH\b/i, name: 'Longines 30CH — crono manifattura sottovalutato', tier: 'top', boost: 15 },
  { re: /\b13\s*ZN\b/i, name: 'Longines 13ZN', tier: 'top', boost: 18 },
  { re: /EL\s*PRIMERO|\b3019\b|\bcal\.?\s*400\b/i, name: 'Zenith El Primero', tier: 'top', boost: 12 },
  { re: /VALJOUX\s*72\b/i, name: 'Valjoux 72 (Daytona/Compax/Autavia)', tier: 'top', boost: 12 },
  { re: /VALJOUX\s*(22|23|88)\b/i, name: 'Valjoux 22/23/88', tier: 'good', boost: 8 },
  { re: /\bcal\.?\s*(215|218|1[- ]66|2[- ]66|69)\b(?=.{0,80}(UNIVERSAL|MICROROT))|MICROROTOR|MICROROT/i,
    name: 'UG microrotor — tesi fratelli poveri, finestra catalyst', tier: 'good', boost: 10, tag: 'ug-microrotor' },
  { re: /VACHERON[\s\S]{0,120}\bP?45[34](\/5B)?\b|\bP?45[34](\/5B)?\b[\s\S]{0,120}VACHERON/i, name: 'VC 453/454 (454 = column wheel raro)', tier: 'top', boost: 14 },
  { re: /\b30\s*T2\b/i, name: 'Omega 30T2 — porta d\'ingresso collezionismo', tier: 'good', boost: 7 },
  { re: /\bcal\.?\s*(550|552|55\d|56\d)\b(?=.{0,60}OMEGA)|OMEGA\s+(552|565)/i,
    name: 'Omega 55x/56x top automatico anni 60', tier: 'good', boost: 6 },
  { re: /PELLATON|\bcal\.?\s*85(2|3)\b|\b8541\b/i, name: 'IWC Pellaton', tier: 'good', boost: 8 },
  { re: /ETERNA[- ]?MATIC|\b1247\b/i, name: 'Eterna-Matic 5 sfere', tier: 'good', boost: 5 },
  { re: /VENUS\s*(170|175|178|188)/i, name: 'Venus ruota a colonne — abbordabile', tier: 'good', boost: 6 },
  { re: /LANDERON\s*(48|51|148|248)/i, name: 'Landeron camme — crono del popolo, MAI prezioso', tier: 'base', boost: 0 },
  { re: /\bFHF\b|\bAS\s*\d{3,4}\b|PESEUX\s*3\d{2}\b|ETA\s*2[48]\d{2}\b/i, name: 'ébauche di servizio', tier: 'base', boost: 0 },
];

// claim "manifattura" gonfiato: dichiarano manifattura ma il calibro è base
function claimCheck(text) {
  const claims = /manifattura|manufacture|in[- ]house/i.test(text);
  if (!claims) return null;
  const baseHit = CALIBERS.find(c => c.tier === 'base' && c.re.test(text));
  if (baseHit) return `CLAIM GONFIATO: dichiarata "manifattura" ma calibro ${baseHit.name} — paghi la parola, non il metallo`;
  return null;
}

// ---------- 5. MATCHING & CONDITION ----------
const CONDITION_SIGNALS = [
  { re: /matching\s+numbers|numeri\s+coinciden/i, name: 'matching numbers — premio significativo su Longines/UG', boost: 8 },
  { re: /non\s+lucidat|unpolished|mai\s+lucidat/i, name: 'cassa non lucidata — geometrie integre', boost: 8 },
  { re: /full\s*set|scatola.{0,20}garanzia|box.{0,15}papers/i, name: 'full set', boost: 7 },
  { re: /estratto\s+d.archivio|extract\s+(of|from)\s+(the\s+)?archiv/i, name: 'estratto archivio', boost: 6 },
  { re: /risaldat|resaldat|re[- ]?soldered|saldatura(?=.{0,30}(ansa|lug))/i,
    name: 'ANSA/CASSA RISALDATA — sconto 15-25% in rivendita', boost: -10, flag: true },
  { re: /ruota\s+a\s+colonne|column\s+wheel/i, name: 'ruota a colonne', boost: 6 },
];

// ---------- 6. FASCIA SLEEPER <$1500 (radar dedicato) ----------
const SLEEPERS = [
  /30\s*T2/i, /FERROVIE\s+DELLO\s+STATO/i, /\bCYMA\b/i, /FAVRE[- ]LEUBA/i,
  /VENUS\s*1[78]\d/i, /MOVADO\s*(M?9[05])/i, /ADMIRALTY/i,
];

// ---------- API PRINCIPALE ----------
/**
 * @param {string} text  titolo+descrizione del lotto/annuncio
 * @param {object} opts  { yearClaim?: number }
 * @returns {{scoreDelta:number, boosts:string[], flags:string[], tags:string[]}}
 */
function analyzeListing(text, opts = {}) {
  const t = String(text || '');
  const res = { scoreDelta: 0, boosts: [], flags: [], tags: [] };

  // lume/anno
  const lu = lumeCheck(t, opts.yearClaim);
  res.flags.push(...lu.flags); res.tags.push(...lu.tags);

  // gruppi keyword
  for (const group of [CASE_MAKERS, DIAL_SIGNALS, CALIBERS, CONDITION_SIGNALS]) {
    for (const k of group) {
      if (k.re.test(t)) {
        res.scoreDelta += (k.boost || 0);
        const line = k.name + (k.tier ? ` [${k.tier}]` : '');
        if ((k.boost || 0) < 0 || k.flag) res.flags.push(line);
        else if ((k.boost || 0) > 0) res.boosts.push(line);
        if (k.tag) res.tags.push(k.tag);
        if (k.verify) res.tags.push('verify-macro');
      }
    }
  }

  // claim manifattura gonfiato
  const cc = claimCheck(t);
  if (cc) { res.flags.push(cc); res.scoreDelta -= 8; }

  // sleeper radar
  if (SLEEPERS.some(re => re.test(t))) {
    res.tags.push('sleeper-under-1500');
    res.boosts.push('SLEEPER radar <$1.5k (segmento in rivalutazione 10-15%/anno)');
    res.scoreDelta += 5;
  }

  // segnale segmento in rivalutazione (macro-trend 2026)
  if (/\bLONGINES\b|\bUNIVERSAL\s+GEN|TISSOT(?=.{0,40}(70|'70|seventies))|MOVADO|EBERHARD/i.test(t)) {
    res.tags.push('revaluation-2026');
    res.scoreDelta += 3;
  }

  // clamp per non dominare lo scoring esistente
  res.scoreDelta = Math.max(-25, Math.min(35, res.scoreDelta));
  return res;
}

// ---------- SELF-TEST (node vintageKnowledge.js) ----------
if (require.main === module) {
  const cases = [
    ['VACHERON solo tempo oro 18k cal 454 cassa Wenger ruota a colonne, ansa risaldata', { yearClaim: 1950 }],
    ['Omega Admiralty 165.038 cal 552 T SWISS MADE T full set non lucidato', { yearClaim: 1970 }],
    ['Cronografo di manifattura Landeron 248 anni 50, quadrante restaurato', { yearClaim: 1955 }],
    ['Universal Geneve quadrante cloisonné smalto, T SWISS T', { yearClaim: 1948 }],
    ['Longines placcato oro 20 microns Dennison 9ct', {}],
  ];
  for (const [txt, o] of cases) {
    const r = analyzeListing(txt, o);
    console.log('\n>>', txt.slice(0, 60));
    console.log('   delta:', r.scoreDelta, '| tags:', r.tags.join(','));
    r.boosts.forEach(b => console.log('   ★', b));
    r.flags.forEach(f => console.log('   ⚠', f));
  }
}

module.exports = { analyzeListing, lumeCheck, CALIBERS, CASE_MAKERS, DIAL_SIGNALS };
