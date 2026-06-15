// ═══════════════════════════════════════════════════════════════
// QUERY ENCICLOPEDICHE — "arrosto, non fumo"
// Ogni query punta a un MARCHIO + MODELLO/CALIBRO preciso preso
// dall'Enciclopedia, oppure a un "parente povero" di un modello
// leggenda (stesso calibro/design a frazione di prezzo).
// NIENTE query generiche tipo "vecchio orologio svizzero": pescano
// centinaia di risultati a caso e bruciano analisi Claude (token).
// Ogni risultato che arriva è già pre-filtrato dal nome stesso.
// ═══════════════════════════════════════════════════════════════

// ── I "PARENTI POVERI" delle leggende (cap.4 Enciclopedia) ──
// stesso calibro o design di un'icona, a una frazione del prezzo
const PARENTI_POVERI = [
  // El Primero / Valjoux 72 a marchio minore = il Daytona accessibile
  'Wittnauer Valjoux 72 cronografo','Helvetia Valjoux 72 cronografo','Gallet Multichron Valjoux 72',
  // Genta prima del Royal Oak: il Polerouter
  'Universal Geneve Polerouter Date','Universal Geneve Polerouter De Luxe',
  // sportivi integrati anni 70 (epigoni Genta accessibili)
  'Vacheron 222 vintage','IWC Ingenieur SL Genta','Tissot PR516 integrata vintage',
  // crono Lemania a marchio proprio = la Speedmaster accessibile
  'Lemania cronografo militare vintage','Tissot Lemania cronografo vintage',
  // Compax UG = il "Nina Rindt" minore
  'Universal Geneve Compax vintage','Universal Geneve Tri-Compax oro',
];

// ── MODELLI/CALIBRI PRECISI per marchio (dall'Enciclopedia) ──
// chiave = marchio in watchlist; valore = query specifiche coi modelli che contano
const QUERY_PER_MARCHIO = {
  'enicar':            ['Enicar Sherpa Graph vintage','Enicar Sherpa Jet vintage','Enicar Super Divette'],
  'universal geneve':  ['Universal Geneve Polerouter','Universal Geneve Compax','Universal Geneve Tri-Compax'],
  'nivada grenchen':   ['Nivada Grenchen Chronomaster Aviator','Nivada Antarctic vintage'],
  'gallet':            ['Gallet Multichron 12 vintage','Gallet Flying Officer vintage'],
  'excelsior park':    ['Excelsior Park 40 cronografo','Excelsior Park Monte Carlo'],
  'vulcain':           ['Vulcain Cricket vintage','Vulcain Cricket Nautical'],
  'zenith':            ['Zenith El Primero A386','Zenith chronograph cal 146','Zenith cal 135 cronometro'],
  'heuer':             ['Heuer Autavia 2446 Valjoux 72','Heuer Camaro vintage','Heuer Carrera vintage'],
  'omega':             ['Omega Speedmaster 145 cal 321','Omega Seamaster 300 vintage','Omega Constellation pie pan'],
  'longines':          ['Longines 13ZN cronografo','Longines 30CH cronografo','Longines Conquest vintage'],
  'eberhard':          ['Eberhard Extra-Fort cronografo','Eberhard Chrono 4 vintage'],
  'movado':            ['Movado M95 cronografo','Movado Datron HS360'],
  'doxa':              ['Doxa Sub 300 vintage 1967','Doxa Sub 300T Conquistador'],
  'seiko':             ['Seiko 6139 chronograph','Seiko 62MAS diver','Seiko 6105 diver'],
  'jaeger-lecoultre':  ['JLC Memovox vintage','JLC Geophysic vintage'],
  'iwc':               ['IWC Ingenieur vintage','IWC Mark XI vintage'],
  'eterna':            ['Eterna KonTiki vintage','Eterna Super KonTiki'],
  'girard-perregaux':  ['Girard Perregaux Gyromatic vintage','Girard Perregaux cronografo vintage'],
  'aquastar':          ['Aquastar Deepstar vintage','Aquastar Benthos'],
  'czapek':            ['Czapek Quai des Bergues','Czapek Antarctique usato'],
  'urban jurgensen':   ['Urban Jurgensen 1140','Urban Jurgensen Jules'],
};

// ── QUERY "REGINE" a sconto: la leggenda nella sua referenza accessibile ──
const QUERY_REGINE_ACCESSIBILI = [
  'Zenith Daytona 16520 El Primero',   // lo Zenith-Daytona, sleeper relativo
  'Omega Speedmaster cal 861 vintage', // Speedy accessibile
  'JLC Reverso vintage acciaio',
];

// Costruisce il pool completo di query enciclopediche.
// brandWatchlist = oggetto BRAND_WATCHLIST per restare sempre allineato.
function buildEncyclopedicQueries(brandWatchlist) {
  const out = [];
  // 1. query specifiche per i marchi che le hanno definite
  for (const [brand, queries] of Object.entries(QUERY_PER_MARCHIO)) {
    if (brandWatchlist[brand]) out.push(...queries);
  }
  // 2. parenti poveri delle leggende
  out.push(...PARENTI_POVERI);
  // 3. regine accessibili
  out.push(...QUERY_REGINE_ACCESSIBILI);
  // dedup
  return Array.from(new Set(out));
}

module.exports = { PARENTI_POVERI, QUERY_PER_MARCHIO, QUERY_REGINE_ACCESSIBILI, buildEncyclopedicQueries };
