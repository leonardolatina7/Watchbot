// meltFloor.js — v1.0
// Trova lotti (soprattutto INVENDUTI) dove il valore di fusione dell'oro
// copre o supera il costo all-in. Segmento trascurato: oro grande formato
// moderno, che nessuno vuole portare e le case non sanno prezzare.
//
// ATTENZIONE: la tabella PESI contiene STIME, non dati verificati.
// Ogni voce marcata VERIFICARE va corretta con pesi reali (bilancia o
// condition report) prima di fidarsi degli alert in produzione.

'use strict';

// ---------------------------------------------------------------------------
// 1. ADAPTER — mappa i nomi dei campi del tuo oggetto lotto.
//    Modifica SOLO questa funzione se i nomi nel repo sono diversi.
// ---------------------------------------------------------------------------

function normalizza(lotto) {
  const g = (...chiavi) => {
    for (const k of chiavi) {
      if (lotto[k] !== undefined && lotto[k] !== null && lotto[k] !== '') {
        return lotto[k];
      }
    }
    return null;
  };

  return {
    brand:       g('brand', 'marca', 'maker', 'brandName'),
    ref:         g('ref', 'referenza', 'reference', 'refNumber', 'modello', 'model'),
    titolo:      g('titolo', 'title', 'name', 'descrizione', 'description'),
    stimaBassa:  num(g('stimaBassa', 'estimateMin', 'priceLow', 'stima_bassa', 'estLow', 'basedAsta', 'baseAsta')),
    stimaAlta:   num(g('stimaAlta', 'estimateMax', 'priceHigh', 'stima_alta', 'estHigh')),
    prezzo:      num(g('prezzo', 'price', 'currentBid', 'hammer', 'askingPrice')),
    venduto:     boolVenduto(g('venduto', 'sold', 'status', 'stato', 'esito')),
    casa:        g('casa', 'house', 'source', 'auctionHouse', 'sito', 'site'),
    metallo:     g('metallo', 'metal', 'materiale', 'material', 'case_material'),
    pesoLordo:   num(g('pesoLordo', 'grossWeight', 'peso', 'weight', 'pesoGrammi')),
    tipoPeso:    g('tipoPeso', 'weightType') || 'totale',
    url:         g('url', 'link', 'href', 'permalink'),
    lotNum:      g('lotNum', 'lotto', 'lot', 'lotNumber')
  };
}

function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function boolVenduto(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (/invenduto|unsold|not sold|ritirato|passed|no sale/.test(s)) return false;
  if (/venduto|sold|aggiudicat|hammer/.test(s)) return true;
  return null;
}

// ---------------------------------------------------------------------------
// 2. PARAMETRI ECONOMICI
// ---------------------------------------------------------------------------

const CFG = {
  // Prezzo di realizzo 18k al grammo lordo (regola Leonardo: ~85 €/g).
  euroGrammo18k: 85,

  // Il banco metalli non paga il teorico su casse lavorate.
  resaBanco: 0.91,

  // Fattori di conversione rispetto al 18k (750/1000).
  titoli: {
    '24k': 750 / 750 * (999 / 750),
    '22k': 916 / 750,
    '21k': 875 / 750,
    '18k': 1.00,
    '14k': 585 / 750,
    '9k':  375 / 750
  },

  // Margine minimo richiesto sul fuso perché scatti l'alert.
  // 1.00 = fuso pari all'all-in. 1.10 = fuso 10% sopra all-in.
  sogliaAlert: 1.00,
  sogliaTop:   1.15,

  // Un lotto invenduto si tratta sotto base: quanto scendere in apertura.
  scontoInvenduto: 0.75,

  // Percentuale del peso lordo dichiarato che è effettivamente oro
  // (scarta vetro, movimento, lancette, guarnizioni).
  // Se il peso è "cassa nuda + fondello" usa 1.0 via override.
  quotaOroSuLordo: 1.00,

  // Sconti da applicare quando il peso trovato NON e' oro netto.
  // 'totale'  = orologio completo con cinturino/bracciale non-oro, vetro, movimento
  // 'lordo'   = orologio completo ma con bracciale in oro (scarta solo vetro+movimento)
  // 'cassa'   = solo cassa+fondello, gia' quasi tutto oro
  // 'oro'     = oro netto dichiarato, nessuno sconto
  scontoTipoPeso: {
    totale: 0.66,
    lordo:  0.86,
    cassa:  0.95,
    oro:    1.00
  }
};

// ---------------------------------------------------------------------------
// 3. COMMISSIONI PER CASA (regole già in enciclopedia — replicate qui
//    per rendere il modulo autonomo).
// ---------------------------------------------------------------------------

function commissione(casa, hammer) {
  const c = String(casa || '').toLowerCase();

  if (/spangaro/.test(c))                 return hammer <= 2000 ? 0.30 : 0.25;
  if (/cambi/.test(c))                    return 0.28;
  if (/bidinside|nomisma/.test(c))        return 0.21; // + €15 fissi, gestiti sotto
  if (/sant.?agostino/.test(c))           return 0.20;
  if (/liveauctioneers/.test(c))          return 0.05;
  if (/catawiki/.test(c))                 return 0.09;
  if (/subito|ebay|marktplaats|chrono24/.test(c)) return 0.00;

  return 0.25; // default prudente
}

function fissi(casa) {
  return /bidinside|nomisma/i.test(String(casa || '')) ? 15 : 0;
}

function allIn(casa, hammer) {
  return hammer * (1 + commissione(casa, hammer)) + fissi(casa);
}

// ---------------------------------------------------------------------------
// 4. TABELLA PESI — TUTTI I VALORI SONO STIME. VERIFICARE.
//    pesoOro = grammi d'oro stimati (cassa + fondello + fibbia/deployante
//    se inclusa nel lotto). Range min/max: il calcolo usa il MIN, prudente.
// ---------------------------------------------------------------------------

const PESI = [
  // ===================== CARTIER =====================
  // Pasha 2770 42mm oro rosa: esemplare Collector Square 117,41 g TOTALE
  // (cassa+fondello+bezel+corona+deployante oro, cinturino pelle).
  // Oro netto stimato dopo scarto vetro/movimento/lancette/pelle.
  { match: /cartier.*pasha.*(2770|42\s?mm)/i, min: 74, max: 86,
    fonte: 'Collector Square 117,41 g totale', conf: 'ALTA' },

  // Santos 100 XL crono ref. 2935 oro rosa: 254,5 g dichiarati come "metal weight"
  // su The Back Vault. Include cassa massiccia + fondello a viti.
  { match: /cartier.*santos.*(100|xl|2935|w2020)/i, min: 110, max: 165,
    fonte: 'The Back Vault 254,5 g (ref. 2935)', conf: 'MEDIA — verifica se bracciale oro o pelle' },

  { match: /cartier.*ballon bleu.*4[26]/i, min: 68, max: 95,
    fonte: 'stima per analogia con Pasha 42', conf: 'BASSA — VERIFICARE' },

  { match: /cartier.*tank.*(americaine|xl|louis)/i, min: 35, max: 60,
    fonte: 'stima', conf: 'BASSA — VERIFICARE' },

  // ===================== ROLEX =====================
  // Day-Date 40 ref. 228238: fonti concordi 100-120 g d'oro tra cassa,
  // bracciale President e fibbia. Un esemplare dichiarato 150 g totali.
  { match: /rolex.*day.?date.*(40|228238|18038|18238|presidente|president)/i, min: 100, max: 120,
    fonte: 'Bobs Watches 100-120 g oro; ref. 18238 ~114 g', conf: 'ALTA' },

  // Datejust 16018 oro pieno su President: 134 g totali misurati (unpolished).
  { match: /rolex.*datejust.*(16018|1601\b|18038|oro pieno|full gold|yellow gold).*36/i, min: 95, max: 120,
    fonte: 'WatchForum 16018 su President = 134 g totali', conf: 'MEDIA' },

  // Datejust acciaio-oro: SOLO lunetta e maglie centrali sono oro. Poco metallo.
  { match: /rolex.*datejust.*(acciaio e oro|two.?tone|steel.*gold|16013|16233)/i, min: 12, max: 22,
    fonte: 'ref. 1601 acciaio/oro = 93 g totali ma oro parziale', conf: 'BASSA — oro solo su lunetta/maglie' },

  // ===================== VC / PATEK / AP VINTAGE DRESS =====================
  // Dato d'asta reale: VC bracelet watch 33mm, peso lordo 32,5 g CON fibbia oro.
  // VC Jubilee 35mm con bracciale oro: 93,9 g lordi.
  { match: /(vacheron|patek|audemars).*(3[2-6]\s?mm|ultra.?thin|extra.?piatto|dress|solo.?tempo)/i, min: 20, max: 34,
    fonte: 'asta VC 33mm = 32,5 g lordi con fibbia', conf: 'MEDIA — casse sottili anni 50-60' },

  // Stesse maison ma con bracciale in oro integrato: cambia tutto.
  { match: /(vacheron|patek|audemars).*(bracciale|bracelet|maglia).*oro/i, min: 60, max: 95,
    fonte: 'VC Jubilee ref. 6038 = 93,9 g lordi', conf: 'MEDIA' },

  // ===================== ALTRI VINTAGE ORO =====================
  { match: /omega.*(constellation|seamaster|de ville).*oro.*3[4-6]/i, min: 22, max: 40,
    fonte: 'stima per analogia', conf: 'BASSA — VERIFICARE' },

  { match: /universal.*(polerouter|microrotor|geneve).*oro/i, min: 18, max: 30,
    fonte: 'stima', conf: 'BASSA — VERIFICARE' },

  { match: /longines.*oro.*3[4-7]/i, min: 18, max: 33,
    fonte: 'stima', conf: 'BASSA — VERIFICARE' },

  { match: /(jaeger|iwc|girard).*oro.*3[4-6]/i, min: 20, max: 36,
    fonte: 'stima', conf: 'BASSA — VERIFICARE' },

  // ===================== CRONOGRAFI ORO VINTAGE =====================
  // Eberhard Extra-Fort: peso reale dichiarato 13,6 g. Fondello a pressione,
  // casse leggerissime. Il fuso non copre mai il prezzo di questi pezzi.
  { match: /eberhard.*extra.?fort/i, min: 12, max: 18,
    fonte: 'annuncio Subito ref. 14007 = 13,6 g', conf: 'ALTA' },

  { match: /(universal|longines|omega|angelus).*(crono|chrono).*oro.*3[5-8]/i, min: 28, max: 48,
    fonte: 'stima', conf: 'BASSA — VERIFICARE' },

  // ===================== TASCA =====================
  { match: /(tasca|pocket|savonette|lepine).*oro/i, min: 55, max: 120,
    fonte: 'stima — varianza enorme per diametro', conf: 'BASSA — chiedi sempre il peso' }
];

function stimaPeso(l, cfg) {
  // Peso dichiarato batte sempre la stima, ma va scontato secondo il tipo.
  if (l.pesoLordo && l.pesoLordo > 3) {
    const k = cfg.scontoTipoPeso[l.tipoPeso] ?? cfg.scontoTipoPeso.totale;
    return {
      grammi: l.pesoLordo * k,
      fonte: `dichiarato ${l.pesoLordo} g (${l.tipoPeso}, ×${k})`,
      incerto: l.tipoPeso === 'totale',
      nota: l.tipoPeso === 'totale'
        ? 'Peso totale: scartati vetro, movimento, lancette, cinturino.'
        : null
    };
  }

  const testo = [l.brand, l.ref, l.titolo, l.metallo].filter(Boolean).join(' ');
  for (const p of PESI) {
    if (p.match.test(testo)) {
      return {
        grammi: p.min,
        fonte: `tabella — ${p.fonte}`,
        nota: `Affidabilita': ${p.conf}`,
        incerto: true,
        range: [p.min, p.max]
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. RILEVAMENTO TITOLO ORO
// ---------------------------------------------------------------------------

function fattoreTitolo(l) {
  const t = [l.metallo, l.titolo, l.ref].filter(Boolean).join(' ').toLowerCase();

  if (/plated|placcat|gold.?filled|laminat|dorat|vermeil|acciaio e oro|two.?tone|bicolor/.test(t)) return null;
  if (/\b(9k|9kt|375)\b/.test(t))                    return CFG.titoli['9k'];
  if (/\b(14k|14kt|585)\b/.test(t))                  return CFG.titoli['14k'];
  if (/\b(21k|21kt|875)\b/.test(t))                  return CFG.titoli['21k'];
  if (/\b(22k|22kt|916)\b/.test(t))                  return CFG.titoli['22k'];
  if (/\b(18k|18kt|750)\b/.test(t))                  return CFG.titoli['18k'];
  if (/\boro\b|\bgold\b|\bor\b/.test(t))             return CFG.titoli['18k']; // assunzione
  return null;
}

// ---------------------------------------------------------------------------
// 6. MOTORE
// ---------------------------------------------------------------------------

function valutaLotto(lottoRaw, opts = {}) {
  const cfg = Object.assign({}, CFG, opts);
  const l = normalizza(lottoRaw);

  const fattore = fattoreTitolo(l);
  if (!fattore) return { alert: false, motivo: 'non oro massiccio o titolo non rilevato' };

  const peso = stimaPeso(l, cfg);
  if (!peso) return { alert: false, motivo: 'peso non disponibile e referenza non in tabella', chiediPeso: true, lotto: l };

  const grammiOro = peso.grammi * cfg.quotaOroSuLordo;

  // Valore di fusione, lordo e netto della resa del banco.
  const fusoTeorico = grammiOro * cfg.euroGrammo18k * fattore;
  const fusoNetto   = fusoTeorico * cfg.resaBanco;

  // Prezzo di partenza su cui ragionare.
  const base = l.stimaBassa ?? l.prezzo;
  if (!base) return { alert: false, motivo: 'nessun prezzo disponibile' };

  // Su invenduto si apre sotto base.
  const invenduto = l.venduto === false;
  const hammerIpotesi = invenduto ? base * cfg.scontoInvenduto : base;
  const costoAllIn = allIn(l.casa, hammerIpotesi);

  const rapporto = fusoNetto / costoAllIn;
  const margine  = fusoNetto - costoAllIn;

  // Prezzo massimo di martello che tiene il fuso in pari.
  const maxHammer = massimoMartello(l.casa, fusoNetto);

  const alert = rapporto >= cfg.sogliaAlert;
  const top   = rapporto >= cfg.sogliaTop;

  return {
    alert,
    top,
    lotto: l,
    grammiOro,
    pesoFonte: peso.fonte,
    pesoIncerto: peso.incerto,
    pesoNota: peso.nota,
    pesoRange: peso.range || null,
    fusoTeorico: round(fusoTeorico),
    fusoNetto: round(fusoNetto),
    invenduto,
    hammerIpotesi: round(hammerIpotesi),
    costoAllIn: round(costoAllIn),
    maxHammer: round(maxHammer),
    margine: round(margine),
    rapporto: +rapporto.toFixed(2)
  };
}

function massimoMartello(casa, target) {
  // Inverte allIn() numericamente: la commissione può cambiare a scaglioni.
  let lo = 0, hi = target * 1.2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (allIn(casa, mid) > target) hi = mid; else lo = mid;
  }
  return lo;
}

function round(n) { return Math.round(n); }

// ---------------------------------------------------------------------------
// 7. SCANSIONE + MESSAGGIO TELEGRAM
// ---------------------------------------------------------------------------

function scan(lotti, opts = {}) {
  const esiti = [];
  const daChiederePeso = [];

  for (const raw of lotti) {
    const r = valutaLotto(raw, opts);
    if (r.chiediPeso) { daChiederePeso.push(r.lotto); continue; }
    if (r.alert) esiti.push(r);
  }

  esiti.sort((a, b) => b.rapporto - a.rapporto);
  return { esiti, daChiederePeso };
}

function formatta(r) {
  const l = r.lotto;
  const nome = [l.brand, l.ref].filter(Boolean).join(' ') || l.titolo || 'Lotto';
  const tag = r.top ? '🔥 MELT TOP' : '🟡 MELT';
  const stato = r.invenduto ? 'INVENDUTO' : 'in asta';

  const righe = [
    `${tag} — ${nome}`,
    `${l.casa || 'casa n/d'}${l.lotNum ? ' · Lotto ' + l.lotNum : ''} · ${stato}`,
    ``,
    `Oro stimato: ${Math.round(r.grammiOro)} g (${r.pesoFonte})`,
    `Fuso netto: €${r.fusoNetto}`,
    `Ipotesi martello: €${r.hammerIpotesi} → all-in €${r.costoAllIn}`,
    `Margine sul fuso: €${r.margine} (${r.rapporto}×)`,
    ``,
    `Offri fino a €${r.maxHammer} di martello per restare in pari sul metallo.`
  ];

  if (r.pesoIncerto) {
    righe.push('', `⚠️ Peso stimato, non dichiarato. Chiedi il peso lordo prima di offrire.`);
    if (r.pesoRange) righe.push(`Range tabella: ${r.pesoRange[0]}–${r.pesoRange[1]} g (calcolo sul minimo).`);
    if (r.pesoNota) righe.push(`Nota: ${r.pesoNota}`);
  }

  if (l.url) righe.push('', l.url);

  return righe.join('\n');
}

function formattaRichiestePeso(lotti) {
  if (!lotti.length) return null;
  const righe = ['📏 Oro senza peso — chiedi il dato alla casa:'];
  for (const l of lotti.slice(0, 10)) {
    const nome = [l.brand, l.ref].filter(Boolean).join(' ') || l.titolo;
    righe.push(`• ${nome}${l.casa ? ' (' + l.casa + ')' : ''}${l.url ? ' — ' + l.url : ''}`);
  }
  return righe.join('\n');
}


// ---------------------------------------------------------------------------
// 8. INDIE RATIO — segnale per indipendenti ultra-nicchia.
//    Su questi marchi il prezzo assoluto non dice nulla: conta il RAPPORTO
//    tra prezzo chiesto e listino di riferimento. I realizzi reali stanno
//    al 25-40% del nuovo perche' il mercato secondario e' sottilissimo.
// ---------------------------------------------------------------------------

const INDIE = [
  // Rudis Sylva (Les Bois, Giura). Harmonious Oscillator, due bilancieri dentati.
  // RS12: listino 250.000 CHF. Realizzo Phillips maggio 2024: $77.060 (sotto stima bassa).
  // Rapporto realizzo/listino ~30%.
  { match: /rudis\s?sylva/i, listino: 250000, valuta: 'CHF', realizzoTipico: 0.30,
    nota: 'RS12 listino 250k CHF, martello Phillips 2024 $77.060. RS23: 80k CHF titanio, 90k CHF oro rosa.' },

  // Placeholder per gli altri del tuo radar — listini da inserire man mano.
  { match: /(voutilainen|akrivia|rexhep)/i, listino: null, valuta: 'CHF', realizzoTipico: 0.90,
    nota: 'Eccezione: questi mantengono o superano il listino. Rapporto alto NON e\' un allarme.' },
  { match: /(pikullik|aubert.*ramel|suhanov)/i, listino: null, valuta: 'EUR', realizzoTipico: 0.55,
    nota: 'Indie emergenti: secondario poco liquido, sconto tipico 40-50%.' }
];

function indieRatio(lottoRaw) {
  const l = normalizza(lottoRaw);
  const testo = [l.brand, l.ref, l.titolo].filter(Boolean).join(' ');

  for (const i of INDIE) {
    if (!i.match.test(testo)) continue;

    const prezzo = l.stimaBassa ?? l.prezzo;
    if (!prezzo) return { indie: true, marchio: testo, motivo: 'nessun prezzo', nota: i.nota };

    if (!i.listino) {
      return { indie: true, marchio: testo, prezzo, listinoNoto: false,
               realizzoTipico: i.realizzoTipico, nota: i.nota,
               azione: 'Listino non in tabella: cerca il realizzo asta piu\' recente prima di offrire.' };
    }

    const ratio = prezzo / i.listino;
    const sogliaInteresse = i.realizzoTipico * 0.70; // 30% sotto il realizzo tipico
    const sogliaCaro      = i.realizzoTipico * 1.15;

    let verdetto;
    if (ratio <= sogliaInteresse) verdetto = 'INTERESSANTE — sotto il realizzo tipico';
    else if (ratio >= sogliaCaro) verdetto = 'CARO — sopra quanto realizza davvero';
    else verdetto = 'IN LINEA — nessun edge';

    return {
      indie: true,
      marchio: testo,
      prezzo,
      listino: i.listino,
      valuta: i.valuta,
      ratio: +ratio.toFixed(2),
      realizzoTipico: i.realizzoTipico,
      massimoDaPagare: Math.round(i.listino * sogliaInteresse),
      verdetto,
      alert: ratio <= sogliaInteresse,
      nota: i.nota
    };
  }
  return { indie: false };
}

function formattaIndie(r) {
  const righe = [
    `${r.alert ? '💎 INDIE EDGE' : '📘 INDIE'} — ${r.marchio}`,
    ``,
    `Prezzo: ${r.prezzo}`,
    r.listino ? `Listino nuovo: ${r.listino} ${r.valuta} → rapporto ${r.ratio}` : `Listino non in tabella.`,
    r.realizzoTipico ? `Realizzo tipico su questo marchio: ${Math.round(r.realizzoTipico * 100)}% del listino` : '',
    r.massimoDaPagare ? `Massimo da pagare per avere edge: ${r.massimoDaPagare} ${r.valuta}` : '',
    r.verdetto ? `` : '',
    r.verdetto || r.azione || '',
    ``,
    `Nota: ${r.nota}`,
    ``,
    `⚠️ Segmento illiquido. Tempi di rivendita 12-24 mesi.`
  ].filter(x => x !== '');
  return righe.join('\n');
}

module.exports = {
  scan,
  valutaLotto,
  formatta,
  formattaRichiestePeso,
  indieRatio,
  formattaIndie,
  INDIE,
  normalizza,
  allIn,
  massimoMartello,
  CFG,
  PESI
};
