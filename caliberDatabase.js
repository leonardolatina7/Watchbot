/**
 * CALIBER DATABASE — il sapere sui calibri, leggibile dal bot
 * ════════════════════════════════════════════════════════════════
 *
 * Quando un annuncio cita un calibro nel titolo (es. "Longines 30CH",
 * "Valjoux 72", "Omega 321"), il bot lo riconosce e aggiunge il contesto
 * giusto all'alert: manifattura o ébauche? colonne o camma? premio
 * d'investimento? È il capitolo FONDAMENTA dell'Enciclopedia tradotto in
 * dati che il bot può usare in un secondo.
 *
 * Tutti i dati verificati su database tecnici (Ranfft, CaliberCorner),
 * archivi ufficiali Longines/Omega, Grail Watch Wiki, Revolution.
 *
 * Campi:
 *   match     = array di stringhe/regex da cercare nel titolo (minuscolo)
 *   brand     = casa del calibro
 *   tipo      = 'colonne' | 'camma' | 'tempo' (solo tempo/data, no crono)
 *   manifattura = true se calibro proprio della casa, false se ébauche
 *   anni, layout, note = info per l'alert
 *   pregio    = 0-3 (0 nessun premio, 3 grail di calibro)
 */

const CALIBER_DB = [
  // ───────────── VALJOUX (dinastia a colonne) ─────────────
  { match:['valjoux 72c','valjoux72c'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:3,
    anni:'1946-1974', layout:'tricompax + triplo calendario',
    note:'72 + calendario completo. Il Rolex "Jean-Claude Killy". Non-Rolex (Wittnauer, Gallet, UG) = stesso calibro a 3-8k invece di sei cifre.' },
  { match:['valjoux 88','valjoux88'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:3,
    anni:'1948+', layout:'tricompax + calendario + fasi lunari',
    note:'Il piu complicato della famiglia 72. Raro e ricercato.' },
  { match:['valjoux 72','valjoux72'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:3,
    anni:'1938-1974', layout:'tricompax (ore a 6)',
    note:'Il re dei crono manuali a colonne. Stesso motore di Daytona, Carrera 2447, Patek 2499. Sotto un nome minore = stessa qualita a sconto: comprare il motore, non l\'etichetta.' },
  { match:['valjoux 92','valjoux92'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:2,
    anni:'anni 40-50', layout:'bicompax 9-3',
    note:'Il "piccolo 72" a 2 contatori, comando a colonne = premio. In oro 18k 1500-2200. Stesso layout del Landeron 48 ma molto piu pregiato: verifica la torretta a colonne nella foto movimento.' },
  { match:['valjoux 720','valjoux 724','valjoux720','valjoux724'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:3,
    anni:'anni 60', layout:'flyback (720) / GMT (724)',
    note:'Varianti pregiate del 72. Il 724 GMT e nell\'Enicar Sherpa. Premi forti sul base 72.' },
  { match:['valjoux 23','valjoux23'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:2,
    anni:'1916-1974', layout:'bicompax',
    note:'Il 13L a 2 contatori (no ore). Workhorse a colonne, ~125.000 prodotti.' },
  { match:['valjoux 22','valjoux22'], brand:'Valjoux', tipo:'colonne', manifattura:false, pregio:2,
    anni:'1914+', layout:'bicompax, 14L',
    note:'Il capostipite a 9 colonne. Spesso nei Type 20 militari francesi (Airain, Dodane, Auricoste).' },
  { match:['valjoux 7733','valjoux 7734','valjoux7733','valjoux7734','7733','7734'], brand:'Valjoux', tipo:'camma', manifattura:false, pregio:1,
    anni:'anni 60-70', layout:'bicompax/tricompax 3-9 orizzontale',
    note:'Gia a CAMMA (economico). Layout 3-9. Clebar, Le Jour, Sandoz. NON e a colonne: non confondere col 72.' },
  { match:['valjoux 7750','valjoux7750','7750'], brand:'Valjoux/ETA', tipo:'camma', manifattura:false, pregio:0,
    anni:'1973+', layout:'tricompax automatico',
    note:'Il piu diffuso al mondo, automatico, camma + pignone oscillante. MODERNO: non vintage nobile. ATTENZIONE: il numero "7750" non c\'entra con oro o anno.' },

  // ───────────── ALTRI CRONO A COLONNE ─────────────
  { match:['venus 178','venus178'], brand:'Venus', tipo:'colonne', manifattura:false, pregio:2,
    anni:'anni 40-50', layout:'tricompax',
    note:'Breitling Navitimer/Chronomat, Gallet. Poi Venus vende le macchine: nasce la base dei Sea-Gull cinesi.' },
  { match:['venus 175','venus175'], brand:'Venus', tipo:'colonne', manifattura:false, pregio:2,
    anni:'anni 40-50', layout:'bicompax',
    note:'Crono a colonne di qualita, Breitling Chronomat 808 e altri.' },
  { match:['lemania 2310','lemania2310','lemania 27ch'], brand:'Lemania', tipo:'colonne', manifattura:true, pregio:3,
    anni:'anni 40-70', layout:'tricompax',
    note:'La base dell\'Omega Speedmaster (cal. 321) e usata da Patek. A marchio Lemania = manifattura pura quasi ignorata: affare di qualita raro.' },
  { match:['excelsior park','ep 4','ep cal 40'], brand:'Excelsior Park', tipo:'colonne', manifattura:true, pregio:3,
    anni:'anni 40-60', layout:'tricompax manifattura',
    note:'Faceva i motori per Gallet e Girard-Perregaux. Manifattura pura di crono, fallita 1983, produzione minuscola. Una UG in miniatura senza ancora il compratore.' },
  { match:['landeron 48','landeron48','landeron 51','landeron 47','landeron'], brand:'Landeron', tipo:'camma', manifattura:false, pregio:0,
    anni:'anni 40-60', layout:'bicompax 9-3 a camma',
    note:'Il crono economico per eccellenza, milioni di pezzi. STESSO layout del Valjoux 92 ma a CAMMA: vale molto meno (su un oro, quasi solo il melt). La trappola classica.' },

  // ───────────── LONGINES (manifattura) ─────────────
  { match:['longines 13zn','13zn','longines 13 zn'], brand:'Longines', tipo:'colonne', manifattura:true, pregio:3,
    anni:'1936-1947', layout:'flyback, 17 rubini, 29,80mm, 18.000 vph, Breguet',
    note:'PRIMO crono flyback da polso brevettato al mondo. Casse acciaio/oro 34-38mm; le acciaio impermeabili "Tre-Tacce/Sei-Tacce" sono tool watch legate a Wittnauer/aviazione. Leggenda: 15.000-60.000.' },
  { match:['longines 30ch','30ch','longines 30 ch'], brand:'Longines', tipo:'colonne', manifattura:true, pregio:3,
    anni:'1947-anni 70', layout:'manuale, 13.25L, 29,80mm, 17 rubini, 18.000 vph, Breguet',
    note:'Capolavoro, per molti il miglior crono manuale prima dei moderni. Prima serie (classico) e seconda serie (soleil). Il Nonius 8225 usa il cal. 538 derivato. 8.000-30.000, in forte rivalutazione.' },
  { match:['longines 13.33z','13.33z','longines 13 33'], brand:'Longines', tipo:'colonne', manifattura:true, pregio:2,
    anni:'1913', layout:'manuale, ~29mm, 1/5 sec',
    note:'Il PRIMO cronografo da polso Longines. Ancora un po\' trascurato = margine, in salita tra gli intenditori.' },
  { match:['longines 431','ultra-chron','ultrachron','ultra chron'], brand:'Longines', tipo:'tempo', manifattura:true, pregio:2,
    anni:'1967+', layout:'automatico high-beat 36.000 vph',
    note:'Ultra-Chron: grande avanzamento di precisione. Versione diver ricercata. Pezzo tecnico da collezione.' },
  { match:['longines 30l','longines 30 l'], brand:'Longines', tipo:'tempo', manifattura:true, pregio:1,
    anni:'anni 50', layout:'manuale',
    note:'Manuale robusto, spesso in dress oro 18K. Sottovalutato come oro + manifattura.' },
  { match:['longines 19as','longines 290','longines 340','longines 22a','longines 22as'], brand:'Longines', tipo:'tempo', manifattura:true, pregio:1,
    anni:'anni 45-70', layout:'automatico manifattura',
    note:'Automatici dei Conquest/Flagship (340, 19AS, 290) e il primo automatico Longines (22A/22AS, 1945). Versioni oro massiccio sottovalutate. Il 290 e nel Legend Diver.' },

  // ───────────── OMEGA ─────────────
  { match:['omega 321','omega321','calibre 321','caliber 321','speedmaster 321','321 pre-moon','321 premoon'], brand:'Omega', tipo:'colonne', manifattura:true, pregio:3,
    anni:'1957-1968/69', layout:'colonne, base Lemania 2310/2320',
    note:'Speedmaster PRE-MOON (Apollo 11 = 321 del 1967), anche Seamaster/Railmaster. ~18.000 prodotti. Straight-lug e broad-arrow i piu desiderabili. Il crono Omega piu ricercato. Molto falsificato: verifica.' },
  { match:['omega 861','omega861'], brand:'Omega', tipo:'camma', manifattura:true, pregio:2,
    anni:'1968-1996', layout:'camma/shuttle-cam, base Lemania 1873',
    note:'Moonwatch post-1968 (Apollo tarde, Skylab). Comune e robusto: ottimo entry crono manuale vintage, spesso sotto i 2.000. La camma non e un difetto.' },
  { match:['omega 1861','omega1861'], brand:'Omega', tipo:'camma', manifattura:true, pregio:1,
    anni:'1996+', layout:'861 rodiato',
    note:'Versione rodiata dell\'861. Moonwatch moderno: NON vintage.' },
  { match:['omega 30t2','30t2','omega 30 t2'], brand:'Omega', tipo:'tempo', manifattura:true, pregio:2,
    anni:'1939-1963', layout:'manuale, 15 rubini, 30mm, 18.000 vph',
    note:'Il 30mm leggendario. Le versioni CRONOMETRO sono le piu pregiate. Varianti 30T2 PC / PC AM (antimagnetico). Sottovalutato per cio che e, in oro o acciaio.' },
  { match:['omega 551','omega 561','omega551','omega561'], brand:'Omega', tipo:'tempo', manifattura:true, pregio:2,
    anni:'1959+', layout:'automatico 24 rubini cronometro',
    note:'Il cuore dei Constellation pie-pan. 551 senza data, 561 con data. ATTENZIONE: molti Constellation sono gold-capped (cappati), non oro massiccio.' },
  { match:['omega 552','omega 562','omega 564','omega 565','omega552','omega562'], brand:'Omega', tipo:'tempo', manifattura:true, pregio:1,
    anni:'1959+', layout:'automatico 24 rubini',
    note:'Automatici cronometro: 552 nel Railmaster/Seamaster 300, 564/565 nei Constellation/Seamaster tardi.' },
  { match:['omega 750','omega 751','omega 752'], brand:'Omega', tipo:'tempo', manifattura:true, pregio:1,
    anni:'1967+', layout:'day-date automatico cronometro',
    note:'Day-date automatici. Dynamic e sportivi anni 70.' },
  { match:['omega 601','omega 610','omega 611','omega 613','omega 602'], brand:'Omega', tipo:'tempo', manifattura:true, pregio:0,
    anni:'anni 60-70', layout:'manuale',
    note:'Entry vintage Omega: Geneve, De Ville. Quadranti colorati anni 70 ricercati.' },

  // ───────────── ALTRI MANIFATTURA NOTEVOLI ─────────────
  { match:['zenith 135','zenith135','el primero','3019phc'], brand:'Zenith', tipo:'colonne', manifattura:true, pregio:3,
    anni:'1949-1971', layout:'135 cronometro / El Primero high-beat 36.000',
    note:'Il cal. 135 vinse piu concorsi di cronometria di sempre (ancora accessibile). L\'El Primero (1969) = primo crono automatico high-beat.' },
  { match:['gp 32a','girard 32a','high-beat 36000'], brand:'Girard-Perregaux', tipo:'tempo', manifattura:true, pregio:2,
    anni:'1966+', layout:'automatico high-beat 36.000 vph',
    note:'Primo high-beat commerciale al mondo. Manifattura, importanza storica enorme, prezzi ridicoli per cio che e.' },
  { match:['vulcain 120','cricket'], brand:'Vulcain', tipo:'tempo', manifattura:true, pregio:2,
    anni:'1947-70s', layout:'sveglia manuale manifattura',
    note:'Il Cricket: prima sveglia da polso affidabile, "orologio dei presidenti USA". Manifattura, marchio rilanciato.' },
];

// Normalizza il titolo per il confronto
function normTitle(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

// Cerca un calibro citato nel titolo. Ritorna la scheda o null.
// Ordine: prima i match piu specifici (72c prima di 72), gia ordinati nel DB.
function findCaliber(title) {
  const t = normTitle(title);
  for (const c of CALIBER_DB) {
    for (const m of c.match) {
      // match come parola/sequenza intera per evitare falsi positivi
      // (es. "7750" dentro un numero piu lungo)
      const re = new RegExp('(^|[^0-9a-z])' + m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9a-z]|$)');
      if (re.test(t)) return c;
    }
  }
  return null;
}

// Riga pronta per l'alert Telegram (o null se nessun calibro riconosciuto)
function caliberLine(title) {
  const c = findCaliber(title);
  if (!c) return null;
  const tipoLabel = c.tipo === 'colonne' ? '\u{1F3F0} ruota di colonne'
    : c.tipo === 'camma' ? '\u2699\uFE0F camma'
    : '\u{1F551} tempo';
  const manif = c.manifattura ? 'manifattura' : 'ébauche';
  const stelle = c.pregio >= 3 ? ' \u2B50\u2B50\u2B50' : c.pregio === 2 ? ' \u2B50\u2B50' : c.pregio === 1 ? ' \u2B50' : '';
  return `\u2699\uFE0F <b>${c.brand} ${c.layout}</b> (${tipoLabel}, ${manif})${stelle}\n   ${c.note}`;
}

module.exports = { CALIBER_DB, findCaliber, caliberLine };
