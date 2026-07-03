// brandWatchlist.js — Watchbot v11.14 | Aggiornato 30/06/26
// Watchlist attiva: modelli da comprare se trovati sotto soglia
//
// NOVITÀ v11.14:
//  (A) Candidati "DROP-HUNTER": microbrand/indie le cui EDIZIONI LIMITATE si
//      apprezzano. Regola d'oro: il valore si cattura SOLO al lancio/preordine.
//      Sul secondario già a premio = treno perso. maxBuy qui = tetto SECONDARIO
//      "sottoprezzo" (gap-hunter): segnala se trovato SOTTO quel valore da
//      venditore non-orologiaio (eredità/sgombero). Il drop al lancio si
//      compra a prezzo di listino, lo gestisce DROP_SYSTEM (vedi sotto).
//  (B) DROP_SYSTEM: scorecard a 6 segnali (>=9/12 = compra al lancio),
//      brand-radar dei drop, alias "gemello famoso", alias Blancpain/Rayville.

const watchlist = [

  // -- PRIORITA MASSIMA -------------------------------------------------------
  { brand: 'Universal Geneve', model: 'Polerouter', caliber: '215 218 1-66 1-69', maxBuy: 900, note: 'Microrotor solo-tempo, catalizzatore 2026' },
  { brand: 'Universal Geneve', model: 'White Shadow', caliber: '1-66', maxBuy: 1000, note: 'Ultra-thin cult, acciaio preferred' },
  { brand: 'Universal Geneve', model: 'Compax', caliber: 'manifattura', maxBuy: 2500, note: 'Panda = premium, verificare quadrante' },
  { brand: 'Gallet', model: 'Excel-O-Graph', caliber: 'EP40 EP40-68', maxBuy: 1800, note: 'Manifattura colonne, max 1800 per margine' },
  { brand: 'Vacheron Constantin', model: 'dress oro 18k', caliber: 'K1014', maxBuy: 3500, note: 'Calcolare melt floor prima — non superare mai' },

  // -- PRIORITA ALTA ----------------------------------------------------------
  { brand: 'Nivada', model: 'CASD Chronomaster', caliber: 'Valjoux 92', maxBuy: 1500, note: 'Config icona broad-arrow, verificare fondello' },
  { brand: 'Nivada', model: 'CASD Chronomaster', caliber: 'Valjoux 23', maxBuy: 2500, note: 'Vertice gerarchia, raro' },
  { brand: 'Movado', model: 'Datron Datochron HS360', caliber: '3019PHC', maxBuy: 1800, note: 'Vero El Primero accessibile' },
  { brand: 'Piaget', model: 'dress oro vintage', caliber: '9P 12P', maxBuy: 1500, note: 'Ultra-sottile manifattura, oro 18k preferred' },
  { brand: 'Gallet', model: 'Jim Clark', caliber: 'Valjoux 72', maxBuy: 2500, note: 'NON confondere con prezzi vecchi 800, mercato 3700-4950' },

  // -- PRIORITA MEDIA ---------------------------------------------------------
  { brand: 'Eberhard', model: 'Chrono 4 Grande Taille', ref: '31052', maxBuy: 2000, note: 'Vedi pezzo di Leonardo — confronto mercato' },
  { brand: 'Cyma', model: 'Watersport Navystar', caliber: 'R459', maxBuy: 120, note: 'Solo tempo manifattura sottovalutato' },
  { brand: 'Helvetia', model: 'cronografo', caliber: 'Valjoux 72', maxBuy: 800, note: 'Daytona accessibile' },
  { brand: 'Invicta', model: 'vintage pre-quarzo', caliber: 'Valjoux 72', maxBuy: 600, note: 'Solo vintage vero, no moderni Invicta' },
  { brand: 'Wittnauer', model: 'cronografo', caliber: 'Valjoux 72', maxBuy: 700, note: 'Parente povero Daytona' },
  { brand: 'Poljot', model: 'Strela', caliber: 'Strela', maxBuy: 400, note: 'Crono russo manifattura' },
  { brand: 'LeJour', model: 'vintage', caliber: 'qualsiasi manifattura', maxBuy: 500, note: 'Sottovalutato, watchlist bot' },
  { brand: 'Clebar', model: 'vintage', caliber: 'qualsiasi manifattura', maxBuy: 400, note: 'Sottovalutato' },

  // -- INDIE MODERNI (eccezione al filtro vintage) ----------------------------
  { brand: 'Czapek', model: 'Quai des Bergues', caliber: 'SXH5', maxBuy: 9000, note: 'In-house, entrata indie' },
  { brand: 'Atelier Wen', model: 'Perception', caliber: 'qualsiasi', maxBuy: 2500, note: 'Primo bracciale tantalio integrato, 700->30k traiettoria' },
  { brand: 'Urban Jurgensen', model: 'ref 1140 P8 Jules', caliber: 'manifattura', maxBuy: 8000, note: 'Pre-rilancio Voutilainen 2025' },

  // -- DROP-HUNTER: limited microbrand che si apprezzano ----------------------
  //    maxBuy = tetto SECONDARIO "sottoprezzo" (gap-hunter): segnala solo se
  //    trovato SOTTO quel valore. Il drop al lancio si compra a listino (DROP_SYSTEM).
  { brand: 'Furlan Marri', model: 'Meteorite Octa', caliber: 'meca-quartz', maxBuy: 900, note: 'Quadrante meteorite Muonionalusta; flip storico; intercetta sottoprezzo' },
  { brand: 'Furlan Marri', model: 'chronograph LE', caliber: 'meca-quartz / mecc.', maxBuy: 700, note: 'Hype 2021, rivendita gonfiata; solo LE sold-out sottoprezzo' },
  { brand: 'Massena LAB', model: 'Uni-Racer / collab LE', caliber: 'Sellita', maxBuy: 1500, note: 'Gemello: UG Big-Eye. Solo LE/collab sold-out' },
  { brand: 'Brew', model: 'Retrograph / Metric LE', caliber: 'meca-quartz', maxBuy: 450, note: 'Sold-out abituale, secondario forte; intercetta sottoprezzo' },
  { brand: 'Baltic', model: 'edizione limitata', caliber: 'Sellita / Miyota', maxBuy: 600, note: 'Solo LE/collab sold-out, no serie aperte' },
  { brand: 'Venezianico', model: 'Bucintoro Legacy of Time (1969/1976/Prima Serie)', caliber: 'Lemania 1873 NOS', maxBuy: 4200, note: 'Gemello: Omega Speedmaster (cal.861). Solo LE Lemania-NOS; serie Seiko NE88 = NO investimento' },

  // -- CATALIZZATORE / SLEEPER (deposito marchio + segnale rilancio) ----------
  //    Aggiunti 01/07/26 dopo segnale catalizzatore Roamer (deposito NewCo Holding AG).
  //    Tesi: marchi svizzeri storici dormienti; se parte un rilancio gli ORIGINALI
  //    d'epoca fanno da traino (pattern Universal Geneve). maxBuy = tetto sottoprezzo
  //    per gli ORIGINALI VERI, non i comuni. Vedi note per quali modelli puntare.
  { brand: 'Roamer', model: 'Stingray Chrono (Valjoux 726) / Rockshell diver', caliber: 'Valjoux 726 / MST 470-471', maxBuy: 700, note: 'CATALIZZATORE: solo Stingray crono Valjoux + Rockshell/Searock diver MST anni 60-70. Comuni dress MST = €90-360 (no). Verificare cassa non cappata (i cromati soffrono pitting)' },
  { brand: 'Squale', model: '100 Atmos Master / 1000m vintage (crown 4h)', caliber: 'Felsa / ETA vintage', maxBuy: 800, note: 'CATALIZZATORE ma ATTENZIONE: solo VINTAGE veri pre-1995 (100 Atmos Master, 1000m, Marina Militare). I 1521 MODERNI Sellita/ETA = €500-900 no-investimento. Squale = terra di FRANKEN: verificare crown Von, seriale, bezel acrilico non mancante' },
  { brand: 'Technos', model: 'Sky Diver 1000m / crono Valjoux vintage', caliber: 'Valjoux / ETA', maxBuy: 400, note: 'CATALIZZATORE debole: solo diver Sky Diver 1000m + crono Valjoux anni 70. Il resto = entry-level economico. Non pagare il nome' },
  { brand: 'Sicura', model: 'diver / jump hour meccanico anni 70', caliber: 'EB / Baumgartner / Ronda', maxBuy: 150, note: 'CATALIZZATORE MOLTO debole: NO vero legame Breitling (mito eBay). Movimenti pin-lever EB economici, casse cromate ottone. Solo diver/jump-hour design anni 70 sottoprezzo per rivendita di stile, NON per qualita. Max €150' },

  // -- B&M CATALIZZATORE DAMIANI (agg. 03/07/26) ------------------------------
  //    Evento: Gruppo Damiani acquisisce 100% Baume & Mercier da Richemont (1 lug 2026).
  //    Grado MEDIO: compratore solido (Valenza, €400M+ fatturato, cresce controtendenza)
  //    ma B&M mid-tier. Regola: comprare SOLO per l'ORO a melt; il catalizzatore e' upside
  //    gratis, NON la ragione d'acquisto. Priorita ai crono oro con movimento nobile.
  { brand: 'Baume & Mercier', model: 'Cornes de Vache (crono calendario completo / fasi luna)', caliber: 'colonne vintage', maxBuy: 3500, note: 'IL tesoro del marchio. Anse a corna anni 50, crono cal-completo+luna oro. Cugino povero del Cornes de Vache Vacheron. Verificare originalita quadrante+movimento' },
  { brand: 'Baume & Mercier', model: 'cronografo oro 18k vintage (Valjoux colonne / Lemania)', caliber: 'Valjoux 92 / Lemania', maxBuy: 1800, note: 'Solo crono ORO 18k con movimento NOBILE (Valjoux colonne o Lemania). Landeron 48/camma = solo valore oro a melt. NO quartz, NO Riviera acciaio, NO placcato/gold-filled' },

  // -- BREITLING CHRONOMAT ROULEAUX (agg. 03/07/26, richiesta Leonardo) --------
  //    Vintage anni 80-90 (nato 1984 dopo Frecce Tricolori 83; bracciale rouleaux/bullet
  //    discontinuato 2000). Leonardo: piace bicolore coi rider tabs ORO. Strategia
  //    "tengo/giro": comprare BASSO cosi va bene sia da portare sia da flippare.
  //    PUNTO DEBOLE: rouleaux che si stira (ricambi cari) -> verificare integro non stirato.
  { brand: 'Breitling', model: 'Chronomat rouleaux ACCIAIO (81950 / A13047 / A13050)', caliber: 'Valjoux 7750-base', maxBuy: 1800, note: 'Acciaio pieno = piu liquido da girare. Rouleaux INTEGRO non stirato + 4 rider tabs presenti + quadrante originale (no redial). Quadrante nero/bianco = piu liquido, blu Frecce = premio' },
  { brand: 'Breitling', model: 'Chronomat rouleaux BICOLORE SS/18K rider tabs ORO (B13047/B13048/81950)', caliber: 'Valjoux 7750-base', maxBuy: 2000, note: 'Look preferito Leonardo. SOLO oro VERO 18k punzonato (mai placcato/gold-plated = solo moda). Bicolore si gira piu lento: comprare BASSO (<2000) cosi non perdi. Cuscino melt minimo se oro punzonato. Rouleaux integro obbligatorio' },

];

// ============================================================================
// DROP_SYSTEM — riconoscere il PROSSIMO "Bucintoro" PRIMA che esploda.
// Lezione: una limited microbrand si apprezza quando ha >=4-5 di 6 ingredienti.
// Il valore si cattura SOLO al lancio/preordine. Dopo il sold-out a premio,
// l'unico affare resta il gap-hunter (qualcuno che rivende sottoprezzo).
// ============================================================================

// Brand-radar: pagine "new/preorder" da monitorare + canali stampa che anticipano.
const DROP_RADAR_BRANDS = [
  { brand: 'Furlan Marri',  site: 'furlanmarri.com',   tier: 'caldo' },
  { brand: 'Venezianico',   site: 'venezianico.com',   tier: 'caldo' },
  { brand: 'Brew',          site: 'brew-watches.com',  tier: 'caldo' },
  { brand: 'Massena LAB',   site: 'massenalab.com',    tier: 'alto' },
  { brand: 'Baltic',        site: 'baltic-watches.com',tier: 'alto' },
  { brand: 'Atelier Wen',   site: 'atelierwen.com',    tier: 'alto' },
  { brand: 'Berneron',      site: 'berneron.ch',       tier: 'osservato' },
];
const DROP_PRESS_FEEDS = [
  'fratellowatches.com', 'monochrome-watches.com', 'hodinkee.com',
  'watchesbysjx.com', 'thewatchpages.com', 'timeandtidewatches.com',
];

// Alias "gemello famoso" (segnale 5): se la limited scende da un riferimento
// costoso e NOTO, vale di piu. Keyword per riconoscerlo nei testi/annunci.
const TWIN_ALIASES = {
  'Lemania 1873': ['Omega Speedmaster', 'cal.861', 'Moonwatch'],
  'Big-Eye':      ['Universal Geneve Big Eye', 'UG Compax'],
  'Valjoux 72':   ['Rolex Daytona', 'Heuer Autavia'],
  'Valjoux 92':   ['Nivada Chronomaster', 'Aquastar Deepstar'],
  'meteorite':    ['Rolex meteorite', 'Omega meteorite'],
};

// Alias trappola-Blancpain (rimasti in sospeso): un Fifty Fathoms "nascosto"
// sotto firma US Divers / Rayville. Chi lista cosi spesso non sa cos'ha.
const BLANCPAIN_HIDDEN_ALIASES = {
  brand: 'Blancpain', model: 'Fifty Fathoms (doppia firma)',
  aliases: ['Rayville', 'Aqua-Lung', 'Aqua Lung', 'US Divers', 'Spirotechnique'],
  // NON confondere con questi (deprezzano / altra cosa):
  excludeNoise: ['Swatch', 'Bioceramic', 'Scuba Fifty Fathoms', 'Ocean of Storms',
                 'cinturino', 'strap', 'tribute strap', 'Healthways', 'Aquastarlet'],
  note: 'Verifica fisica obbligatoria (heavily faked). Mai a scatola chiusa.',
};

// Scorecard: 6 segnali, 0-2 ciascuno. >=9 = compra al lancio, 6-8 = osserva, <6 = passa.
// signals = oggetto con i 6 punteggi gia valutati (0/1/2). Ritorna verdetto.
function scoreDrop(signals = {}) {
  const keys = ['hardwareStoria', 'scarsita', 'narrazioneArtefatto',
                'domandaPreordine', 'scontoVsGemello', 'momentumBrand'];
  let total = 0;
  for (const k of keys) {
    const v = Number(signals[k] || 0);
    total += Math.max(0, Math.min(2, v));
  }
  let verdetto, azione;
  if (total >= 9)      { verdetto = 'COMPRA AL LANCIO'; azione = 'Preordine/drop a listino. Finestra ORA.'; }
  else if (total >= 6) { verdetto = 'OSSERVA';          azione = 'Segui il drop; compra solo se sale a 9 con sold-out.'; }
  else                 { verdetto = 'PASSA';            azione = 'Non in tesi. Si deprezza.'; }
  return { score: total, max: 12, verdetto, azione };
}

// Guida alla compilazione dei 6 segnali (riferimento per claudeAnalyst/operatore):
const SCORECARD_GUIDE = {
  hardwareStoria:      '0=ETA/Seiko base anonimo | 1=Sellita/Seiko top (NE88) | 2=movimento storico NOS (Lemania, Valjoux 92, Venus colonne)',
  scarsita:            '0=serie aperta | 1=limited 300-500 | 2=numero chiuso <=150, inciso',
  narrazioneArtefatto: '0=generica | 1=storia forte | 2=storia + oggetto fisico (pala Concorde, roccia Everest, meteorite)',
  domandaPreordine:    '0=a magazzino | 1=vende in settimane | 2=sold-out in ore/preordine',
  scontoVsGemello:     '0=nessun riferimento | 1=riferimento vago | 2=gemello costoso noto (Speedmaster, UG Big-Eye) a 3-6x',
  momentumBrand:       '0=sconosciuto | 1=in crescita | 2=premi (GPHG)+community 10k+ +stampa (Fratello/Hodinkee)',
};

// ============================================================================
// FILTRI BRAND — riconoscono le due ECCEZIONI al filtro "solo vero vintage":
//  (1) INDIPENDENTI MODERNI = le "azioni growth" dell'orologeria: ci interessano
//      anche da nuovi. (2) FASCIA MEDIA = passano il filtro ma SOLO come affare
//      vero a sconto concreto, mai "da studiare".
// Usate da claudeAnalyst.js. Match case-insensitive e tollerante agli accenti.
// ============================================================================
function _norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Indipendenti moderni: manifatture indie contemporanee che si apprezzano da nuove.
const MODERN_INDIE_BRANDS = [
  'czapek', 'urban jurgensen', 'journe', 'f.p. journe', 'fp journe', 'akrivia',
  'rexhep rexhepi', 'berneron', 'atelier wen', 'moser', 'h. moser', 'h moser',
  'laurent ferrier', 'kari voutilainen', 'voutilainen', 'ming', 'petermann bedat',
  'sylvain pinaud', 'raul pages', 'simon brette', 'furlan marri', 'baltic',
  'massena lab', 'venezianico', 'brew',
];

// Fascia media: marchi di qualità che passano il filtro solo se sono un affare a sconto.
const MIDRANGE_BRANDS = [
  'tudor', 'grand seiko', 'jaeger-lecoultre', 'jaeger lecoultre', 'jlc', 'cartier',
  'omega', 'longines', 'iwc', 'zenith', 'oris', 'nomos', 'baume & mercier',
  'baume et mercier', 'baume mercier', 'breitling', 'tag heuer', 'rado',
];

function isModernIndie(brand) {
  const b = _norm(brand);
  if (!b) return false;
  return MODERN_INDIE_BRANDS.some(x => b.includes(_norm(x)));
}

function isMidrange(brand) {
  const b = _norm(brand);
  if (!b) return false;
  return MIDRANGE_BRANDS.some(x => b.includes(_norm(x)));
}

module.exports = {
  watchlist,
  DROP_RADAR_BRANDS,
  DROP_PRESS_FEEDS,
  TWIN_ALIASES,
  BLANCPAIN_HIDDEN_ALIASES,
  scoreDrop,
  SCORECARD_GUIDE,
  isModernIndie,
  isMidrange,
  MODERN_INDIE_BRANDS,
  MIDRANGE_BRANDS,
};
