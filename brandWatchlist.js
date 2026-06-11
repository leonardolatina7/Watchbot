/**
 * BRAND WATCHLIST — i marchi "azienda" da seguire come titoli di borsa
 * ════════════════════════════════════════════════════════════════
 *
 * L'idea di Leonardo: un marchio risorto che lavora bene (Czapek, Nivada,
 * Universal Genève sotto Breitling...) è come un'azienda che macina utili.
 * Si entra sui suoi orologi PRIMA che il mercato prezzi del tutto la
 * rinascita — come comprare l'azione mentre i fondamentali migliorano.
 *
 * Questo file NON scansiona: è la lista di riferimento (la "watchlist di
 * borsa"). Il bot la usa per:
 *  1) dare un BONUS di punteggio quando incrocia un modello di questi marchi;
 *  2) far passare come "📚 DA STUDIARE" i marchi della tua Enciclopedia
 *     anche quando NON sono un affare forte — purché il prezzo sia ≤ al
 *     valore di mercato — così te li vedi arrivare e li studi sul campo.
 *
 * status:
 *   'risorto_forte'  = rilancio in corso che funziona, catalizzatore vivo
 *   'risorto'        = tornato sul mercato, traiettoria positiva
 *   'in_riscoperta'  = marchio morto che i collezionisti stanno riscoprendo
 *   'storico_solido' = manifattura storica sottovalutata, fondamentali sani
 *
 * studyOnly: true  = marchio da TENERE D'OCCHIO PER STUDIO. Anche senza
 *   sconto, se prezzo ≤ valore lo voglio vedere per imparare il mercato.
 *   (i marchi senza il flag passano per studio comunque, ma lo metto sui
 *   target dell'Enciclopedia su cui Leonardo vuole formarsi attivamente)
 */

const BRAND_WATCHLIST = {
  // ── RILANCI CHE FUNZIONANO (azienda che "lavora bene") ──
  'czapek':            { status:'risorto_forte', studyOnly:true, tesi:'Manifattura indipendente rinata 2012, premiata (GPHG), produzione piccola e domanda in crescita. Azione di una azienda sana che cresce: i modelli recenti tengono e salgono.' },
  'universal geneve':  { status:'risorto_forte', studyOnly:true, tesi:'Acquisita da Breitling (2023) con rilancio annunciato. Caso-scuola del catalizzatore: i Compax/Polerouter vintage gia raddoppiati. Comprare il vintage prima delle riedizioni.' },
  'nivada grenchen':   { status:'risorto_forte', studyOnly:true, tesi:'Rilanciata 2020, riedizioni di successo che fanno pubblicita agli originali. Chronomaster gia salito; Antarctic/Depthmaster ancora indietro.' },
  'vulcain':           { status:'risorto', studyOnly:true, tesi:'Cricket rilanciato (2021). La sveglia dei presidenti USA: narrativa fortissima, manifattura, prezzi vintage ancora bassi.' },
  'aquastar':          { status:'risorto', studyOnly:true, tesi:'Marchio diver rinato, riedizioni Deepstar accolte bene. Vintage molto ricercati dai conoscitori, in salita.' },
  'airain':            { status:'risorto', studyOnly:true, tesi:'Marchio militare francese rilanciato. Type 20 originali in salita, fratello povero del Breguet Type 20.' },
  'doxa':              { status:'risorto', tesi:'SUB moderni di successo, ma ATTENZIONE: solo i vintage 1967-75 sono roba nostra. Il rilancio tiene caldo il mercato degli originali.' },
  'yema':              { status:'risorto', tesi:'Marchio francese rilanciato con buona accoglienza. Superman e Yachtingraf vintage in rivalutazione.' },

  // ── IN RISCOPERTA (morti ma i collezionisti li scoprono ora) ──
  'enicar':            { status:'in_riscoperta', studyOnly:true, tesi:'Sherpa Graph esploso, libro dedicato uscito. I fratelli minori (Super Divette, Jet, Guide) ancora fermi: strategia famiglia.' },
  'gallet':            { status:'in_riscoperta', studyOnly:true, tesi:'Crono dei professionisti pre-Heuer, flottante strettissimo. Quando si muove, si muove forte.' },
  'excelsior park':    { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura pura di crono (motori per Gallet e GP), fallita 1983, produzione minuscola. Una UG in miniatura senza ancora il compratore.' },
  'wittnauer':         { status:'in_riscoperta', studyOnly:true, tesi:'Stesso Valjoux 72 di Heuer/Daytona a un terzo del prezzo. Il mercato USA li sta scoprendo.' },
  'lemania':           { status:'in_riscoperta', studyOnly:true, tesi:'La manifattura dietro lo Speedmaster e Patek. I crono a marchio proprio sono purissima manifattura quasi ignorata.' },
  'favre-leuba':       { status:'in_riscoperta', studyOnly:true, tesi:'Seconda marca svizzera piu antica, primo orologio meccanico con altimetro (Bivouac). Sleeper tecnico raro.' },
  'wakmann':           { status:'in_riscoperta', studyOnly:true, tesi:'Crono Valjoux (7733/72) spesso co-firmati Breitling. Fratello americano sottovalutato dei Breitling vintage.' },
  'ollech wajs':       { status:'in_riscoperta', studyOnly:true, tesi:'Diver svizzero anni 60-70 venduto per corrispondenza, robusto e raro. Riscoperto da OW rilancio moderno. Originali ancora a buon prezzo.' },
  'zodiac':            { status:'in_riscoperta', tesi:'Sea Wolf vintage = uno dei primi diver di serie. ATTENZIONE: oggi Fossil produce Zodiac moderni, solo i vintage anni 50-70 contano.' },
  'gruen':             { status:'in_riscoperta', studyOnly:true, tesi:'Curvex e Doctor\'s watch art déco, manifattura USA-svizzera dimenticata. Forme particolari ricercate.' },

  // ── STORICI SOLIDI (fondamentali sani, sottovalutati) ──
  'movado':            { status:'storico_solido', studyOnly:true, tesi:'Manifattura vera e storia enorme a prezzo da brand rovinato dal quarzo. Kingmatic e calendari fermi mentre i crono M95 salgono. Pre-quarzo (pre-1970) è il target.' },
  'eterna':            { status:'storico_solido', studyOnly:true, tesi:'Inventrice del rotore a cuscinetti (i 5 punti del logo). Una delle grandi manifatture dimenticate, prezzi bassissimi. KonTiki il modello chiave.' },
  'girard-perregaux':  { status:'storico_solido', tesi:'Manifattura, primo high-beat commerciale (cal. 32A). Qualita pari ai big a prezzi ancora ragionevoli. Laureato in forte crescita.' },
  'zenith':            { status:'storico_solido', studyOnly:true, tesi:'El Primero e il leggendario cal. 135 da cronometria. Il 135 e ancora accessibile per cio che e.' },
  'longines':          { status:'storico_solido', tesi:'I crono manifattura 13ZN e 30CH in forte rivalutazione, ma ancora sotto i big. Heritage che traina.' },
  'certina':           { status:'storico_solido', tesi:'Sistema DS, manifattura vera. Il PH200M e raddoppiato dopo la riedizione: DS-2 e PH500M sulla stessa traiettoria.' },
  'tissot':            { status:'storico_solido', tesi:'I crono base Lemania (DNA Speedmaster) sono incredibilmente sottovalutati. PR516 racing in salita lenta.' },
  'eberhard':          { status:'storico_solido', studyOnly:true, tesi:'Manifattura/assemblatore storico milanese-svizzero. Crono pre-quarzo (Extra-fort, contograf) di qualita, mercato italiano forte.' },
  'minerva':           { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura di crono purissima (oggi Montblanc Villeret). I crono a marchio proprio sono altissima orologeria a prezzi ancora umani.' },
  'angelus':           { status:'in_riscoperta', studyOnly:true, tesi:'Chronodato (primo crono datario triplo di serie) e calibri propri. Marchio rinato come ultra-lusso: i vintage ne beneficiano.' },

  // ── NEO-VINTAGE 1985-2000 (comprare finche e "solo usato") ──
  // Marchi/famiglie da seguire nel neo-vintage: calibro giusto, ancora a prezzo "usato"
  'omega neovintage':  { status:'storico_solido', studyOnly:true, neovintage:true, tesi:'Neo-vintage 1985-2000: Speedmaster ref. moderne, Seamaster pre-Bond/Bond cal. 1120. Comprare finche e usato e non collezione.' },
};

// ── MARCHI MINORI SENZA MERCATO — mai studyOnly, sono solo "piacere" ──
// (lista di riferimento per non confonderli mai con gli sleeper di qualità)
const NO_MARKET_BRANDS = ['dalor','nobellux','augustus','fhb','gigandet','rewel','lanco','camy','cauny','mulco','bernhard h mayer'];

// Normalizza un nome marchio per il confronto (minuscolo, senza accenti)
function normBrand(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 -]/g, '').trim();
}

// Ritorna i dati watchlist se il marchio è monitorato, altrimenti null.
function checkBrand(brand) {
  if (!brand) return null;
  const n = normBrand(brand);
  for (const [k, v] of Object.entries(BRAND_WATCHLIST)) {
    const nk = normBrand(k);
    if (n === nk || n.includes(nk) || nk.includes(n)) {
      return { brand: k, ...v };
    }
  }
  return null;
}

// È un marchio della watchlist che voglio vedere anche per STUDIO?
function isStudyBrand(brand) {
  const w = checkBrand(brand);
  return !!(w && w.studyOnly === true);
}

// È un marchio "senza mercato" da NON trattare mai come sleeper?
function isNoMarketBrand(brand) {
  if (!brand) return false;
  const n = normBrand(brand);
  return NO_MARKET_BRANDS.some(b => { const nb = normBrand(b); return nb && (n === nb || n.includes(nb) || nb.includes(n)); });
}

// Bonus di punteggio investimento per i marchi-azienda in salute.
function brandBonus(brand) {
  const w = checkBrand(brand);
  if (!w) return 0;
  return { risorto_forte: 3, risorto: 2, in_riscoperta: 2, storico_solido: 1 }[w.status] || 0;
}

const STATUS_LABEL = {
  risorto_forte: '\u{1F680} rilancio che funziona',
  risorto: '\u{1F331} marchio risorto',
  in_riscoperta: '\u{1F50D} in riscoperta',
  storico_solido: '\u{1F3DB}\uFE0F storico sottovalutato',
};

module.exports = {
  BRAND_WATCHLIST, checkBrand, brandBonus, normBrand, STATUS_LABEL,
  isStudyBrand, isNoMarketBrand, NO_MARKET_BRANDS,
};
