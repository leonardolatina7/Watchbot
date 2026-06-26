// encyclopedicQueries.js — Watchbot v11.13 | Aggiornato 23/06/26
// Pool di 84+ query mirate brand+modello+calibro
// Rotazione: 15 query per ciclo → 100% copertura in 6 cicli/24h

const encyclopedicQueries = [

  // ── UNIVERSAL GENEVE (priorità max — catalizzatore 2026) ──────────────────
  'Universal Geneve Polerouter automatic vintage',
  'Universal Geneve microrotor cal 215 solo tempo',
  'Universal Geneve White Shadow cal 1-66',
  'Universal Geneve Compax panda vintage chronograph',
  'Universal Geneve Tri-Compax triple calendar',
  'UG microrotor 218 vintage steel',
  'Universal Geneve Polerouter Sub diver',
  'Universal Geneve Polerouter Date microrotor sunburst',
  'Universal Geneve Gilt Shadow cal 2-67 ultra thin',
  'Universal Geneve microrotor solo tempo acciaio occasione',
  'Polerouter ref 20217 20363 microrotor steel',

  // ── GALLET / EXCELSIOR PARK ───────────────────────────────────────────────
  'Gallet Excel-O-Graph EP40 chronograph',
  'Gallet Excel-O-Graph EP40-68 blue dial',
  'Gallet Multichron 12 Excelsior Park chronograph',
  'Gallet Jim Clark Valjoux 72 chronograph vintage',
  'Excelsior Park EP40 chronograph vintage',
  'Certina Excelsior Park EP40-68 chronograph',

  // ── NIVADA / CROTON CASD ──────────────────────────────────────────────────
  'Nivada Chronomaster Aviator Sea Diver CASD',
  'Nivada CASD Valjoux 92 chronograph',
  'Croton Chronomaster panda dial vintage',
  'Nivada Super Chronograph broad arrow hands',

  // ── VACHERON CONSTANTIN VINTAGE ───────────────────────────────────────────
  'Vacheron Constantin dress watch gold vintage 1970s automatic',
  'Vacheron 222 steel vintage Genta',
  'Vacheron Constantin ref 2044 gold bracelet',

  // ── MOVADO EL PRIMERO ─────────────────────────────────────────────────────
  'Movado Datron HS360 El Primero automatic',
  'Movado Datochron Zenith 3019PHC vintage',

  // ── EBERHARD ──────────────────────────────────────────────────────────────
  'Eberhard Chrono 4 31052 automatic',
  'Eberhard Extra-Fort vintage chronograph',
  'Eberhard Contograf diver vintage',
  'Eberhard Scafograf vintage automatic',

  // ── TISSOT BUMPER ─────────────────────────────────────────────────────────
  'Tissot Bumper automatic vintage 6547',
  'Tissot Bumper cal 285 original dial',

  // ── CYMA MANIFATTURA ──────────────────────────────────────────────────────
  'Cyma Watersport R459 automatic vintage',
  'Cyma Navystar automatic Swiss vintage',
  'Cyma Time-O-Vox R459 vintage',

  // ── PIAGET ULTRA-THIN ─────────────────────────────────────────────────────
  'Piaget cal 9P ultra-thin gold vintage',
  'Piaget cal 12P automatic gold dress watch',

  // ── PARENTI POVERI LEGGENDA ───────────────────────────────────────────────
  // (stesso calibro/design, marchio minore = sconto sul gemello)
  'Wittnauer Valjoux 72 chronograph vintage',
  'Helvetia Valjoux 72 chronograph',
  'Yema Valjoux 72 chronograph vintage',
  'Juvenia Valjoux 72 chronograph',
  'Le Jour chronograph vintage manifattura',
  'Clebar chronograph vintage Swiss',
  'Wakmann Valjoux 72 triple calendar',
  'Breitling Navitimer Venus 178 vintage',

  // ── LEMANIA SPEEDMASTER PARENTI ───────────────────────────────────────────
  'Lemania 321 chronograph vintage',
  'Lemania 5100 military chronograph',
  'Heuer Autavia Valjoux 72 vintage',
  'Heuer Monaco manual wind vintage',

  // ── ZENITH EL PRIMERO ─────────────────────────────────────────────────────
  'Zenith El Primero A386 vintage chronograph',
  'Zenith El Primero 3019PHC vintage',
  'Zenith El Primero 16520 Daytona vintage',

  // ── DIVER VINTAGE ─────────────────────────────────────────────────────────
  'Edma skin diver vintage automatic',
  'Yema Superman skin diver vintage',
  'Enicar Sherpa diver vintage',
  'Aquastar diver vintage Swiss',
  'Movado Sub Sea diver vintage',
  'IWC Aquatimer vintage automatic',
  'Doxa Sub 300 1967 original vintage',

  // ── SOLO TEMPO DRESS MANIFATTURA ──────────────────────────────────────────
  'IWC Ingenieur SL cal 1832 vintage',
  'Jaeger LeCoultre Futurematic vintage',
  'Longines 30L automatic vintage dress',
  'Omega Constellation manifattura vintage',
  'Patek Philippe ref 2526 enamel dial',
  'Vacheron Constantin solo tempo dress oro vintage',
  'AP Royal Oak 5402ST Jumbo vintage Genta',

  // ── CALENDARIO TRIPLE ─────────────────────────────────────────────────────
  'Leonidas triple calendar moonphase Valjoux 72',
  'Movado triple calendar moonphase vintage',
  'Omega triple calendar moonphase vintage',
  'Glycine triple calendar moonphase',

  // ── ORO MELT ARBITRAGE ────────────────────────────────────────────────────
  'orologio oro 18k automatico vintage asta',
  'montre or 18k automatique vintage encheres',
  'gold watch 18k vintage automatic auction',
  'orologio oro 18 carati automatico',
  'cronografo oro 18k vintage carica manuale',

  // ── INDIE MODERNI ─────────────────────────────────────────────────────────
  'Czapek Quai des Bergues SXH5 usato',
  'Atelier Wen Perception tantalum vintage',
  'Urban Jurgensen ref 1140 usato',
  'F.P. Journe Chronometre Bleu usato',

  // ── PIAGET / LECOULTRE MICRO ──────────────────────────────────────────────
  'Piaget Altiplano vintage ultra slim gold',
  'JLC Ultra-Thin vintage gold',
  'Vacheron Patrimony ultra-thin vintage',

  // ── MISC NICCHIA ──────────────────────────────────────────────────────────
  'Poljot Strela chronograph Soviet vintage',
  'Bulova Accutron tuning fork vintage',
  'Hamilton Intra-Matic vintage automatic',
  'Rado Golden Horse vintage automatic',
  'Certina DS PH200M vintage',
  'Tissot Visodate automatic vintage',
  'Girard Perregaux Gyromatic vintage',
  'Roamer Anfibio diver vintage',
  'Enicar Sherpa Super automatic',
  'Dugena Sport vintage automatic',

];

// Funzione di rotazione: prende 15 query per ciclo
function getQueryBatch(cycleIndex) {
  const batchSize = 15;
  const start = (cycleIndex * batchSize) % encyclopedicQueries.length;
  const batch = [];
  for (let i = 0; i < batchSize; i++) {
    batch.push(encyclopedicQueries[(start + i) % encyclopedicQueries.length]);
  }
  return batch;
}

module.exports = { encyclopedicQueries, getQueryBatch };
