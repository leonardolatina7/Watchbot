// =============================================================================
//  indieRadar.js  —  Watchbot v12.33
//  Radar "pipeline indipendenti": intercetta i nomi della nuova onda PRIMA
//  che il mercato li scopra, pesando la PROVENIENZA (scuola + premio + maestro).
//
//  Filosofia (tesi Leonardo): il Young Talent Competition di F.P. Journe e la
//  fucina di Morteau sono la pipeline dei futuri "10x". Un debutto che esce da
//  quella rete parte con un pedigree che il mercato paga con 2-5 anni di anticipo.
//
//  Uso tipico:
//    const { scoreIndieListing, indexIndieName, PIPELINE, watchlistKeywords }
//        = require('./indieRadar');
//    const hit = scoreIndieListing({ title, description, price });
//    if (hit.isIndie) { ... }
//
//  Nessuna dipendenza esterna. Solo string-matching robusto + scoring.
// =============================================================================

'use strict';

// -----------------------------------------------------------------------------
//  1) NODI DELLA RETE  (maestri-radice, scuole, premi, connettori)
// -----------------------------------------------------------------------------
const NODES = {
  schools: [
    { id: 'morteau', label: 'Lycée Edgar Faure (Morteau)', weight: 3 },
    { id: 'diderot', label: 'Lycée Diderot (Paris)', weight: 2 },
    { id: 'epfl',    label: 'EPFL Lausanne', weight: 1 },
  ],
  // Maestri-radice e connettori: chi ha formato o fatto da atelier-palestra.
  masters: [
    { id: 'ducret',  label: 'Thierry Ducret',   weight: 2 },
    { id: 'lecomte', label: 'Florent Lecomte',   weight: 2 },
    { id: 'viot',    label: 'Jean-Baptiste Viot', weight: 2 },
    { id: 'monnet',  label: 'Luc Monnet',        weight: 3 }, // connettore trasversale
    { id: 'flaux',   label: 'John-Mikaël Flaux',  weight: 2 }, // automi, prof. Aubert
    { id: 'brette',  label: 'Simon Brette',      weight: 3 }, // nuovo nodo-radice
    { id: 'coperchot', label: 'Denis Coperchot', weight: 1 },
  ],
  // "Palestre" e trampolini: passaggi che alzano il pedigree.
  springboards: [
    { id: 'journe_ytc', label: 'F.P. Journe Young Talent Competition', weight: 3 },
    { id: 'greubel',    label: 'Greubel Forsey',     weight: 2 },
    { id: 'atelier7h38',label: 'Atelier 7h38 (Soprana)', weight: 1 },
    { id: 'ahci',       label: 'AHCI', weight: 2 },
    { id: 'gphg',       label: 'GPHG', weight: 2 },
    { id: 'lv_prize',   label: 'Louis Vuitton Watch Prize', weight: 2 },
  ],
  // La giuria del premio = watchlist implicita (chi premiano, il mercato insegue).
  jury: [
    'Philippe Dufour', 'Andreas Strehler', 'Giulio Papi',
    'Marc Jenni', 'Michael Tay', 'Elizabeth Doerr', 'François-Paul Journe',
  ],
};

// -----------------------------------------------------------------------------
//  2) PIPELINE  —  i maker della nuova onda, con status e provenienza
//     tier: 'established' | 'rising' | 'debut' | 'watch'
// -----------------------------------------------------------------------------
const PIPELINE = [
  // --- già affermati (metro di paragone) ---
  { name: 'Vianney Halter', aka: ['Antiqua', 'Deep Space'], tier: 'established',
    origin: ['THA', 'AHCI'], note: 'Capostipite retro-futurista. Metro dello scorecard.' },
  { name: 'Rémy Cools', aka: ['Remy Cools', 'Tourbillon Atelier', 'Tourbillon Souscription'],
    tier: 'established', origin: ['morteau', 'greubel', 'journe_ytc', 'gphg'],
    note: 'YTC 2018. GPHG Révélation 2024. Tourbillon €85k→159k.' },
  { name: 'Théo Auffret', aka: ['Theo Auffret', 'Tourbillon à Paris', 'Grand Sport'],
    tier: 'established', origin: ['morteau', 'viot', 'coperchot', 'atelier7h38', 'journe_ytc'],
    note: 'YTC 2018. Tourbillon à Paris €108k→Grand Sport €128k.' },
  { name: 'Cyril Brivet-Naudot', aka: ['Brivet-Naudot', 'Eccentricity'],
    tier: 'established', origin: ['morteau', 'epfl', 'monnet', 'ahci'],
    note: 'Eccentricity CHF 75k. Scappamento libero eccentrico. Membro AHCI.' },
  { name: 'Simon Brette', aka: ['Chronomètre Artisans', 'Chronometre Artisans'],
    tier: 'established', origin: ['greubel', 'monnet'],
    note: 'Ex Chronode/MB&F. Nuovo nodo-radice. CHF 50k, paragonato a Voutilainen/Rexhepi.' },

  // --- in rampa / debutto recente (i target caldi) ---
  { name: 'Aubert & Ramel', aka: ['Aubert Ramel', 'Ouréa', 'Ourea'],
    tier: 'debut', origin: ['morteau', 'monnet', 'brette', 'journe_ytc'],
    note: 'Debutto 2025 Ouréa, 14 pz, CHF 72k. Provenienza Morteau+Monnet+Brette. CALDO.' },
  { name: 'Thomas Aubert', aka: ['Séléné', 'Selene'],
    tier: 'rising', origin: ['morteau', 'monnet', 'flaux', 'brette', 'journe_ytc'],
    note: 'YTC 2024. Metà di Aubert & Ramel. Séléné = Unitas stravolto, stella cadente.' },
  { name: 'Alexis Ramel-Sartori', aka: ['Alexis Ramel'],
    tier: 'rising', origin: ['morteau', 'monnet', 'brette'],
    note: 'Metà di Aubert & Ramel.' },

  // --- pipeline premio (da osservare) ---
  { name: 'Alexis Fruhauff', aka: ['Pendule à Seconde'], tier: 'watch',
    origin: ['diderot', 'journe_ytc'],
    note: 'YTC 2025. Pendole/da tavolo (non polso). Ispirato Antide Janvier.' },
  { name: 'Alexandre Hazemann', aka: ['AH.02', 'AH.02 Signature', 'Hazemann & Monnin', 'Hazemann Monnin'], tier: 'rising',
    origin: ['morteau', 'journe_ytc', 'lv_prize'], note: 'YTC 2023. Duo Hazemann & Monnin, montre-école con sonnerie au passage. Nominati LV Prize 2026.' },
  { name: 'Maciej Miśnik', aka: ['Maciej Misnik'], tier: 'watch',
    origin: ['journe_ytc', 'ahci'],
    note: 'YTC 2022. Fisico PL autodidatta, 5ª gen. Candidato AHCI 2024.' },
  { name: 'John-Mikaël Flaux', aka: ['John-Mikael Flaux', 'Abeille Mécanique'], tier: 'watch',
    origin: ['lv_prize'], note: 'Automi. Prof. di Aubert. Shortlist LV Prize.' },
  { name: 'Sylvain Pinaud', aka: [], tier: 'watch',
    origin: ['morteau'], note: 'Uscito da Morteau. Da approfondire.' },

  // --- indie accessibili (comprabili davvero, sotto i big) ---
  { name: 'Habring', aka: ['Habring2', 'Habring²', 'Erwin', 'Felix', 'Doppel 3', 'Chrono-Felix'], tier: 'accessible',
    origin: [], note: 'Coppia austriaca, ex IWC. Complicazioni vere €7–7.750, movimento A11 in-house. 4× GPHG. Comprabile, non lista chiusa. Il primo ingresso indie sensato.' },
  { name: 'Ophion', aka: ['OPH786', 'OPH 786', 'Velos'], tier: 'accessible',
    origin: [], note: 'Spagna. Quadrante guilloché CNC, movimento Technotime rifinito. Entry €1.890–3.150.' },
  { name: 'Garrick', aka: ['Garrick S4'], tier: 'accessible',
    origin: [], note: 'Inghilterra. Fatto su ordine, finiture a mano, bilanciere a vite. ~£5.400.' },

  // --- maestri-costruttori sottovalutati (dietro le quinte) ---
  { name: 'Andreas Strehler', aka: ['Tischkalender', 'Sauterelle'], tier: 'established',
    origin: [], note: 'Ex Renaud et Papi, movimentista dietro mezza industria. Nella giuria YTC.' },
  { name: 'Nicolas Delaloye', aka: ['ND 01'], tier: 'watch',
    origin: [], note: 'Ex Patek (alte complicazioni), lavorò ai tourbillon tri-axe di Halter.' },
];

// -----------------------------------------------------------------------------
//  2b) MONTRE-ÉCOLE  —  sleeper vintage: pezzi-scuola sottovalutati
//      Segnale = parola-scuola + (calibro nobile OR finitura a mano)
// -----------------------------------------------------------------------------
const ECOLE = {
  schoolWords: [
    'ecole horlogerie', "ecole d'horlogerie", 'montre ecole', 'school watch',
    'school piece', 'schuluhr', 'le locle', 'saint-imier', 'st-imier',
    'vallee de joux', 'la chaux-de-fonds', 'porrentruy', 'technicum', 'wostep',
  ],
  nobleCalibers: [
    'valjoux 72', 'valjoux 72c', 'valjoux 88', 'venus 230', 'venus 175',
    'lemania', 'minerva', 'longines 30', 'peseux 260',
  ],
  handFinish: [
    'cotes de geneve', 'anglage', 'guilloche', 'hand finish', 'hand-finished',
    'fait main', 'hand engraved', 'perlage', 'colimacon', 'geneva stripes',
  ],
};

function scoreEcole(blob) {
  const school = ECOLE.schoolWords.some(w => hasPhrase(blob, w));
  if (!school) return null;
  const caliber = ECOLE.nobleCalibers.some(w => hasPhrase(blob, w));
  const finish = ECOLE.handFinish.some(w => hasPhrase(blob, w));
  let score = 3;
  if (caliber) score += 3;
  if (finish) score += 2;
  const strong = caliber || finish;
  return {
    isEcole: true,
    strong,
    score,
    reasons: [
      'ecole:parola-scuola',
      caliber ? 'ecole:calibro-nobile' : null,
      finish ? 'ecole:finitura-mano' : null,
    ].filter(Boolean),
  };
}

// -----------------------------------------------------------------------------
//  3) UTILITY  —  normalizzazione e matching accent-insensitive
// -----------------------------------------------------------------------------
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // toglie accenti
    .toLowerCase()
    .replace(/[^a-z0-9 &.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(hay, needle) {
  const h = norm(hay), n = norm(needle);
  if (!n) return false;
  // confine di parola semplice
  return (' ' + h + ' ').includes(' ' + n + ' ') || h.includes(n);
}

// Ritorna il nodo (label+weight) per un id, cercando in tutte le categorie.
function nodeById(id) {
  for (const k of ['schools', 'masters', 'springboards']) {
    const f = NODES[k].find(x => x.id === id);
    if (f) return f;
  }
  return null;
}

// -----------------------------------------------------------------------------
//  4) SCORING  —  dato un annuncio, dice se è un indie della pipeline e quanto pesa
// -----------------------------------------------------------------------------
function scoreIndieListing({ title = '', description = '', price = null } = {}) {
  const blob = `${title} ${description}`;
  const reasons = [];
  let matchedMaker = null;

  // 4a) match diretto sul nome del maker o suoi modelli.
  //     Priorità: prima chi compare nel TITOLO, poi chi compare solo nella
  //     descrizione. Così "Aubert & Ramel" (titolo) vince su "Simon Brette"
  //     citato come maestro nella descrizione.
  const makerMatch = (m, field) => {
    const names = [m.name, ...(m.aka || [])];
    return names.some(n => hasPhrase(field, n));
  };
  matchedMaker = PIPELINE.find(m => makerMatch(m, title))
              || PIPELINE.find(m => makerMatch(m, description))
              || null;
  if (matchedMaker) reasons.push(`maker:${matchedMaker.name} [${matchedMaker.tier}]`);

  // 4b) segnali di provenienza (anche senza maker noto → possibile nome nuovo!)
  const provenance = [];
  for (const cat of ['schools', 'masters', 'springboards']) {
    for (const node of NODES[cat]) {
      if (hasPhrase(blob, node.label) || hasPhrase(blob, node.id)) {
        provenance.push(node);
        reasons.push(`prov:${node.label}(+${node.weight})`);
      }
    }
  }
  // giuria citata = segnale (chi la giuria premia/menziona conta)
  for (const j of NODES.jury) {
    if (hasPhrase(blob, j)) { reasons.push(`jury:${j}`); provenance.push({ weight: 1, label: j }); }
  }

  // 4c) punteggio
  let score = 0;
  if (matchedMaker) {
    const tierBase = { established: 4, rising: 5, debut: 6, watch: 3, accessible: 4 }[matchedMaker.tier] || 3;
    score += tierBase; // NB: 'debut'/'rising' pesano di più: sono i target da intercettare
    (matchedMaker.origin || []).forEach(id => {
      const n = nodeById(id); if (n) score += n.weight;
    });
  }
  score += provenance.reduce((a, n) => a + (n.weight || 1), 0);

  // 4d) flag "nome nuovo": forte provenienza ma nessun maker noto → ALERT scoperta
  const unknownButPedigreed = !matchedMaker && provenance.length >= 2;
  if (unknownButPedigreed) {
    reasons.push('ALERT: nome sconosciuto con forte provenienza → possibile debutto da intercettare');
    score += 4;
  }

  // 4d-bis) MONTRE-ÉCOLE: sleeper vintage sottovalutato (canale separato)
  const ecole = scoreEcole(blob);
  if (ecole) {
    score += ecole.score;
    ecole.reasons.forEach(r => reasons.push(r));
  }

  const isIndie = !!matchedMaker || unknownButPedigreed || (ecole && ecole.strong);

  // 4e) verdetto leggibile
  let verdict = 'ignoto';
  if (matchedMaker) {
    verdict = ({
      established: 'AFFERMATO — metro di paragone, non un affare-scoperta',
      rising:      'IN RAMPA — target caldo, segui da vicino',
      debut:       'DEBUTTO — massima priorità di intercettazione',
      watch:       'PIPELINE — da osservare (spesso pendole o pre-brand)',
      accessible:  'ACCESSIBILE — comprabile davvero, ingresso indie sensato',
    })[matchedMaker.tier] || 'ignoto';
  } else if (unknownButPedigreed) {
    verdict = 'SCOPERTA POTENZIALE — pedigree forte, nome non ancora tracciato';
  } else if (ecole && ecole.strong) {
    verdict = 'MONTRE-ÉCOLE — sleeper vintage sottovalutato, verifica finiture a mano';
  }

  return {
    isIndie,
    maker: matchedMaker ? matchedMaker.name : null,
    tier: matchedMaker ? matchedMaker.tier : (unknownButPedigreed ? 'discovery' : ((ecole && ecole.strong) ? 'ecole' : null)),
    score,
    verdict,
    provenance: provenance.map(p => p.label),
    reasons,
    note: matchedMaker ? matchedMaker.note : (ecole && ecole.strong ? 'Pezzo-scuola: finiture da alta orologeria, spesso senza marchio sul quadrante = prezzo basso. Verifica anglage/Côtes de Genève a mano.' : null),
  };
}

// -----------------------------------------------------------------------------
//  5) HELPER per il resto del bot
// -----------------------------------------------------------------------------
// Tutte le keyword da iniettare nel loop di scansione multi-mercato.
function watchlistKeywords() {
  const kw = new Set();
  PIPELINE.forEach(m => { kw.add(m.name); (m.aka || []).forEach(a => kw.add(a)); });
  // aggiungo i nodi-radice: cercare "Simon Brette", "Luc Monnet" ecc. scova
  // annunci di allievi non ancora in lista.
  NODES.masters.forEach(m => kw.add(m.label));
  return Array.from(kw);
}

// Indicizza un nome arbitrario contro la rete (per /api/diagnostica).
function indexIndieName(name) {
  const hit = PIPELINE.find(m => [m.name, ...(m.aka || [])].some(n => hasPhrase(name, n)));
  if (!hit) return { known: false };
  return {
    known: true,
    name: hit.name,
    tier: hit.tier,
    note: hit.note,
    provenance: (hit.origin || []).map(id => (nodeById(id) || {}).label).filter(Boolean),
  };
}

module.exports = {
  NODES,
  PIPELINE,
  scoreIndieListing,
  watchlistKeywords,
  indexIndieName,
  _norm: norm, // esportato per test
};

// -----------------------------------------------------------------------------
//  Self-test rapido:  node indieRadar.js
// -----------------------------------------------------------------------------
if (require.main === module) {
  const samples = [
    { title: 'Aubert & Ramel Ouréa titanium', description: 'time only, Morteau, ex Simon Brette' },
    { title: 'Vintage Longines 30CH', description: 'gold chronograph' },
    { title: 'New indie time-only', description: 'graduate of Morteau, worked with Luc Monnet, subscription' },
    { title: 'Simon Brette Chronomètre Artisans', description: 'zirconium, sold out' },
  ];
  for (const s of samples) {
    const r = scoreIndieListing(s);
    console.log('—', s.title);
    console.log('   ', JSON.stringify({ isIndie: r.isIndie, maker: r.maker, tier: r.tier, score: r.score, verdict: r.verdict }));
  }
}
