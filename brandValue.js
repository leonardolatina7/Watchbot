// brandValue.js — Watchbot v11.13 | Aggiornato 23/06/26
// ═══════════════════════════════════════════════════════════════════════════
// REGOLA CRITICA PREZZI ORO:
//   Usare SEMPRE prezzo oro 18kt (non 24kt) per melt value.
//   Oro 24kt ~€115-117/g → oro 18kt = 75% = ~€87/g (23/06/26)
//   Platino: €30/g (fallback fisso)
//
// REGOLA DIRITTI ASTA:
//   Catawiki/Bidinside/aste E-Live: ~20% diritti acquirente sopra il martello.
//   Aggiungere sempre al calcolo del costo reale.
//   Bidinside: pagamento bonifico entro 15gg, reso ESCLUSO (visto e piaciuto).
//
// SOGLIE AFFARE:
//   < €500:  sconto ≥25% o margine ≥€70
//   €500-2000: sconto ≥30% o margine ≥€250
//   > €2000: sconto ≥35% o (margine ≥€600 e sconto ≥25%)
//
// REGOLA QUADRANTI ORIGINALE vs REDIAL (verificata 23/06/26):
//   FACILI da rifare (i PIÙ ridipinti, max cautela): matte/opachi piatti, lacca liscia.
//     → superficie piatta = tela ideale del redialer.
//   QUASI IMPOSSIBILI da rifare bene (integri = forte segnale ORIGINALE):
//     sunburst/sunray (raggiera INCISA al tornio), guilloché (inciso),
//     smalto/enamel + porcellana (cotti ad alta temp), gilt vero (galvanico).
//     → i redialer comuni non hanno tornio/attrezzatura/forni.
//   SFUMATURA CHIAVE: il redial su un sunburst lo CANCELLA (dipinge sopra e
//     spiana gli indici), NON lo ricrea. Quindi verificare che il sunburst sia
//     VIVO/cangiante a luce radente — se è spento/piatto dov'era raggiera = redial.
//   GILT: scritte SOTTO strato traslucido ("in profondità") = originale;
//     scritte SOPRA in rilievo = redial.
//   5 segnali redial: texture troppo uniforme; numeri sovrapposti bordi netti;
//     colore impossibile per la base (blu su argentato anni'40); nessun gemello
//     online; nome poetico inventato ("Stardust Galaxy Blue").
// ═══════════════════════════════════════════════════════════════════════════

const brandValues = {

  // ── EBERHARD ──────────────────────────────────────────────────────────────
  'eberhard': {
    tier: 'B',
    focus: ['chrono4', 'extrafort', 'scafograf', 'contograf'],
    priceRanges: {
      'chrono4_31052': { private: [2400, 3000], dealer: [2800, 3500], fullSet: [3500, 4000] },
      'extrafort_prewar': { private: [800, 1800], dealer: [1500, 3000] },
      'scafograf': { private: [600, 1200], dealer: [1200, 2000] },
      'acering': { private: [150, 350], dealer: [300, 500], withDocs: [350, 500] },
    },
    notes: 'Acering = nicchia piccola, solo sotto €180. Chrono4 31052 = revisione Boni Belluno valore leva.',
  },

  // ── TISSOT ────────────────────────────────────────────────────────────────
  'tissot': {
    tier: 'C',
    focus: ['seastar', 'bumper', 'visodate'],
    priceRanges: {
      'seastar_70s': { private: [100, 200], dealer: [150, 225], bluBracelet: [200, 300] },
      'bumper_6547': { private: [200, 400], dealer: [300, 500], specialDial: [400, 700] },
    },
    redFlags: [
      'Quadrante blu Tissot = tra i più ridipinti in assoluto',
      'Bumper 6547: quadrante originale era argentato/crema, NON blu',
      '"Stardust Galaxy Blue" = nome inventato, non in catalogo ufficiale',
      'Catawiki ha listato 6547 con nota esplicita "dial is re-painted"',
    ],
    notes: 'Seastar anni 70 >€300 = passa. Bumper con quadrante speciale: verificare sempre con luce radente macro.',
  },

  // ── UNIVERSAL GENEVE ──────────────────────────────────────────────────────
  'universal geneve': {
    tier: 'A',
    focus: ['polerouter', 'compax', 'tricompax', 'whiteshadow', 'microrotor'],
    priceRanges: {
      'polerouter': { private: [700, 1800], dealer: [1500, 3500] },
      'whiteshadow_166': { private: [800, 1500], dealer: [1000, 2200] },
      'microrotor_soloTempo': { private: [700, 1400], dealer: [900, 1900] },
      'compax_panda': { private: [2000, 4000], dealer: [3500, 6000] },
      'tricompax': { private: [3000, 6000], dealer: [5000, 10000] },
    },
    catalyst: 'Rilancio UG GIÀ USCITO aprile 2026 (Partners Group/parent Breitling). Polerouter nuovo cal.UG-110 microrotor, consegne autunno 2026. Catalizzatore GIÀ scattato — finestra in corso.',
    pricingVerified_23giu26: {
      polerouter_steel_dealer: [1800, 5500],   // 1stDibs min $1600, NON esiste a €1000 da dealer
      polerouter_steel_private: [1000, 1800],   // da Marktplaats/privato SÌ ~€1000
      whiteShadow_giltShadow_microrotor: [850, 900], // venduti reali WatchCharts (parenti poveri)
    },
    redFlags: [
      'Polerouter = tra i più ridipinti/franken del vintage',
      'Microrotor fragile e caro da revisionare (budget revisione €200-300, NON €50)',
      'DS&S 9 375 = cassa inglese 9k, vale meno della svizzera',
      'Arab/Saudi dial = premium fino 2-3x MA tra i più falsificati',
      'INCOERENZA ref/anno = red flag: ref.20217 (early/bumper) + anno 1968 (epoca microrotor) non torna → chiedere foto movimento',
      'Polerouter "as is/incompleto": se è SOLO albero/stem rotto = fix economico (€50-120); ma su microrotor preventivare revisione completa',
    ],
    notes: 'ANGOLO NON OVVIO = microrotor solo-tempo non-Polerouter (White/Gilt Shadow cal.2-66/2-67) a $850-900: stessa firma tecnica, sotto i riflettori del Polerouter. Sunburst champagne/argento integro = forte segnale originale (vedi REGOLA QUADRANTI).',
  },

  // ── MICROBRAND MODERNI (trappola stima gonfiata) ──────────────────────────
  'hermann': {
    tier: 'AVOID',
    focus: [],
    notes: 'MICROBRAND MODERNO 2025 (linea Schild1896/Watches.com), movimento AS5203 ébauche base. NON indie da collezione. "Stima al dettaglio" Catawiki €1100-1300 = ESCA marketing; valore reale €200-400. Deprezza come tutti i microbrand nuovi. LASCIA SEMPRE.',
    redFlags: [
      'Stima al dettaglio Catawiki sui microbrand = gonfiata, non è valore di rivendita',
      'Movimento AS/ETA ébauche base = zero valore aggiunto',
      'Nuovo 2025 = curva deprezzo -50% appena fuori scatola',
    ],
  },

  // ── GALLET ────────────────────────────────────────────────────────────────
  'gallet': {
    tier: 'A',
    focus: ['excel-o-graph', 'multichron', 'jimclark'],
    priceRanges: {
      'excel_o_graph_ep40': { private: [2000, 3500], dealer: [3500, 5800], blueDialDream: [4000, 6000] },
      'jimclark_valjoux72': { private: [2500, 3700], dealer: [3700, 4950] },
      'multichron12_ep40': { private: [1500, 2200], dealer: [2000, 3000] },
    },
    notes: 'EP40-68 = calibro manifattura Excelsior Park ruota a colonne. Difficile trovare in buone condizioni. NON confondere prezzi vecchi (€800) con mercato attuale (€3700-4950 Jim Clark).',
  },

  // ── EXCELSIOR PARK ────────────────────────────────────────────────────────
  'excelsior park': {
    tier: 'A_oem',
    focus: ['ep40-68', 'ep40'],
    priceRanges: {
      'ep40_68_certina': { private: [1500, 2200], dealer: [2420, 3535] },
      'ep40_68_gallet': { private: [2000, 3500], dealer: [3500, 5800] },
    },
    notes: 'Certina EP40-68 a €2200 = prezzo equo, NON affare (mercato €2420-3535). Comprare solo sotto €1800. Calibro manifattura ruota a colonne prodotto a Le Locle.',
  },

  // ── VACHERON CONSTANTIN ───────────────────────────────────────────────────
  'vacheron': {
    tier: 'S',
    focus: ['ref2044', 'dress_gold'],
    priceRanges: {
      'ref2044A_gold': { meltFloor: 'calcolare live', dealer: [5000, 9000] },
    },
    meltCalc: 'Peso totale oro stimato × 0.75 × prezzo_oro_18kt. Esempio ref2044A bracciale ~62g totale → ~50g puro → €4350 melt floor (a €87/g).',
    notes: 'Comprare solo sotto melt floor o con alto margine dealer. Diritti asta 20% = aggiungere al costo.',
  },

  // ── CYMA ──────────────────────────────────────────────────────────────────
  'cyma': {
    tier: 'B',
    focus: ['watersport', 'navystar', 'r459'],
    priceRanges: {
      'soloTempo_r459_steel': { private: [80, 150], dealer: [250, 450], withBox: [350, 600] },
      'watersport_chronograph_946': { private: [3000, 6000], dealer: [5000, 9500] },
    },
    redFlags: [
      '"Cymaflex" = sistema antiurto brevettato, NON il bracciale flessibile',
      'Cassa oro spesso UK DS&S = vale meno',
      'Redial frequente sul quadrante oro rosa applicato',
      'NON confondere il chrono clamshell cal.946 (€5000+) col solo-tempo R459',
    ],
  },

  // ── NIVADA / CROTON ───────────────────────────────────────────────────────
  'nivada': {
    tier: 'A',
    focus: ['casd', 'chronomaster'],
    priceRanges: {
      'casd_valjoux92_icon': { private: [1500, 3000], dealer: [3000, 5000] },
      'casd_landeron248_baton': { private: [600, 1200], dealer: [1000, 1800] },
    },
    calibroHierarchy: ['Valjoux 23 colonne = TOP', 'Valjoux 92 = molto desiderato', 'Venus 210 = prima ref', 'Landeron 248 camme = base'],
    redFlags: [
      'Fondello con incisione a mano del seriale = probabile franken/recase',
      '"Quadrante originale, una delle varianti" = formula pre-emptiva',
      'NON confondere con riedizione moderna Nivada (Sellita SW510, ~€1500)',
    ],
  },

  // ── EDMA ──────────────────────────────────────────────────────────────────
  'edma': {
    tier: 'C',
    focus: ['skindiver'],
    priceRanges: {
      'skindiver': { private: [150, 350], dealer: [300, 500], revised: [220, 350] },
    },
    history: 'Fondata 1944 Saint-Imier. Discende da Moeri & Jeanneret 1892. Forniva movimenti a Seiko/Citizen fino 1956. Acquisita da Tissot ~1970. Calibri tipici: ETA 2472, Moeris.',
    notes: 'Quadrante tropicalizzato = plus. "Revised" = già revisionato vale €80-120 extra. Comprare sotto €220 per avere margine.',
  },

  // ── MOVADO ────────────────────────────────────────────────────────────────
  'movado': {
    tier: 'B',
    focus: ['datron', 'datochron'],
    priceRanges: {
      'datron_hs360_3019phc': { private: [1800, 2800], dealer: [2200, 3500] },
    },
    notes: 'Cal. Zenith 3019PHC = VERO El Primero accessibile. Cushion 38mm. Alternativa corretta a Mondia per chi vuole El Primero dal gruppo MZM.',
  },

  // ── BREITLING ─────────────────────────────────────────────────────────────
  'breitling': {
    tier: 'A_risk',
    focus: ['navitimer', 'chronomat'],
    priceRanges: {
      'chronomat_b13047': { private: [1500, 2200], dealer: [2200, 3500] },
      'navitimer_806': { private: [2000, 4000], dealer: [3500, 7000] },
    },
    redFlags: [
      'Molto falsificati — verificare ref+serial tra anse fisicamente',
      'A prezzo pieno = zero margine',
      'Verificare movimento (Chronomat = ETA Valjoux 7750), scatola/documenti/service',
      'Bracciale Rouleaux originale = plus significativo',
    ],
  },

};

// ═══════════════════════════════════════════════════════════════════════════
// REGOLE-SCARTO (verificate 23/06/26 sera) — casi che SEMBRANO affari ma NON lo sono
// ───────────────────────────────────────────────────────────────────────────
//  FUORI NICCHIA "da donna": orologi 24-28mm (Rolex Lady-Date 6516, Movado Lady,
//    ecc.) = fuori nicchia solo-tempo UOMO di Leonardo. Mercato di rivendita
//    LENTO e poco liquido. Anche se Rolex: senza papers/garanzia il margine sparisce
//    (Bob's vende 6516 $3.295 MA con papers che tu non avresti).
//    → LASCIA salvo melt molto sotto floor.
//
//  MELT SOTTO FLOOR in asta: il pavimento d'oro protegge SOLO se aggiudichi
//    sotto il melt diritti-inclusi. Esempio Movado Lady 1659 oro bianco 18kt:
//    melt reale ~€350, ma base €350 + 20% diritti = €420 → paghi €420 per €350
//    di fuso = PERDI sul metallo. Regola: per giocare il melt, autobid max tale
//    che (martello × 1.20) < melt floor. NB peso LORDO ≠ peso oro (togliere vetro,
//    movimento, lancette, bracciale acciaio).
//
//  MARCHIO OSCURO + bel quadrante (es. Perfine gilt AS1130 €230): può essere
//    CARINO e onesto (nicchia estetica dress anni'40) ma marchio senza storia =
//    nessun catalizzatore, rivendita lenta, margine sottile. = "piacere da polso
//    o flip piccolo", NON investimento. Non confondere col tier A/S.
// ═══════════════════════════════════════════════════════════════════════════

const studyOnlyBrands = [
  'omega', 'rolex', 'patek', 'audemars', 'iwc', 'jaeger', 'longines',
  'zenith', 'seiko', 'tag heuer', 'hamilton', 'bulova', 'rado', 'certina',
  'grand seiko', 'cartier', 'piaget_modern', 'tudor_modern',
];

// Pre-filtro anti-fumo: parole che indicano NON orologio vintage da acquistare
const rejectKeywords = [
  'sveglia', 'alarm', 'alarm clock', 'orologio da tavolo', 'pocket watch accessory',
  'cinturino', 'strap', 'bracelet only', 'solo cinturino', 'ricambio',
  'smartwatch', 'digitale', 'quarzo economico', 'replica', 'fake', 'homage',
  'repair kit', 'tool', 'strumento', 'movimento solo', 'movement only parts',
  'orologio donna', "ladies' watch",
];

module.exports = { brandValues, studyOnlyBrands, rejectKeywords };
