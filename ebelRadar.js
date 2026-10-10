// ebelRadar.js — Radar Ebel epoca Blum (1977–1995)
// Catalizzatore: cessione 95% Ebel a Montres Journe / Chanel / Pierre Jacques (annuncio 7–8 ott 2026, closing "nei prossimi mesi")
// Modulo SOLO DATI: nessuna chiamata a funzioni esterne. Si importa e si legge.
// Uso (index.js v12.35): BLOCCO K query a rotazione + classify() dopo il gate di tesi → alert Telegram dedicato

const CATALYST_TAG = 'CATALYST_JOURNE_2026';

// Decodifica referenza a 7 cifre: [metallo][calibro][cassa]
const METALLO = { '1': 'acciaio-oro', '3': 'oro bianco', '4': 'platino', '5': 'oro rosa', '8': 'oro giallo', '9': 'acciaio' };
const CALIBRO = { '134': 'El Primero crono', '136': 'El Primero crono + calendario perpetuo', '137': 'Le Modulor (base Lemania 1340)', '124': 'Voyager world time' };
const CASSA   = { '901': '38 mm crono fondo chiuso', '240': 'Le Modulor 40 mm fondo a vista', '241': 'Le Modulor 40 mm fondo chiuso', '913': 'Voyager 38 mm' };
// Seriale: "64" + metallo (10 giallo, 20 rosa, 30 bianco, 50 acciaio, 61 bicolore, 70 platino) + 4 cifre
const SERIALE_METALLO = { '10': 'oro giallo', '20': 'oro rosa', '30': 'oro bianco', '50': 'acciaio', '61': 'acciaio-oro', '70': 'platino' };

// Prezzi di riferimento in EUR (venduti Phillips/Sotheby's/Joopiter/Uhren-Muser 2024–2026, premio incluso).
// buyMax = soglia massima d'acquisto ~55–60% del comparabile medio, per lasciare margine dopo commissioni e servizio.
const TARGETS = [
  { ref: '4136901', tier: 'S', nome: 'Perpetuo crono PLATINO',        compEUR: 21700, buyMax: 13000 },
  { ref: '3136901', tier: 'S', nome: 'Perpetuo crono oro bianco',      compEUR: 15000, buyMax: 9000 },
  { ref: '5136901', tier: 'S', nome: 'Perpetuo crono oro rosa',        compEUR: 15000, buyMax: 9000 },
  { ref: '8136901', tier: 'S', nome: 'Perpetuo crono oro giallo',      compEUR: 15000, buyMax: 9000 },
  { ref: '4137240', tier: 'S', nome: 'Le Modulor LE 1995 PLATINO',     compEUR: null,  buyMax: null },
  { ref: '3137240', tier: 'S', nome: 'Le Modulor LE 1995 oro bianco',  compEUR: 7000,  buyMax: 4500 },
  { ref: '5137240', tier: 'S', nome: 'Le Modulor LE 1995 oro rosa',    compEUR: 7000,  buyMax: 4500 },
  { ref: '8137240', tier: 'S', nome: 'Le Modulor LE 1995 oro giallo',  compEUR: 5500,  buyMax: 3500 },
  { ref: '4134901', tier: 'S', nome: 'Crono El Primero PLATINO',       compEUR: null,  buyMax: null },
  { ref: '3134901', tier: 'S', nome: 'Crono El Primero oro bianco',    compEUR: null,  buyMax: null },
  { ref: '5134901', tier: 'A', nome: 'Crono El Primero oro rosa',      compEUR: 12000, buyMax: 7000 },
  { ref: '8134901', tier: 'A', nome: 'Crono El Primero oro giallo',    compEUR: 10000, buyMax: 5500 },
  { ref: '8137241', tier: 'A', nome: 'Le Modulor oro giallo',          compEUR: 11000, buyMax: 6500 },
  { ref: '5137241', tier: 'A', nome: 'Le Modulor oro rosa',            compEUR: 6000,  buyMax: 3500 },
  { ref: '9137240', tier: 'B', nome: 'Le Modulor acciaio, fondello a vista (cal. 137, NON El Primero)', compEUR: 2000, buyMax: 1400 },
  { ref: '9137241', tier: 'B', nome: 'Le Modulor acciaio, fondello chiuso (cal. 137, NON El Primero)',  compEUR: 1900, buyMax: 1300 },
  { ref: '8124913', tier: 'B', nome: 'Voyager world time oro giallo',  compEUR: 4500,  buyMax: 2500 },
  { ref: '3124913', tier: 'B', nome: 'Voyager world time oro bianco',  compEUR: 4500,  buyMax: 2500 },
];
// compEUR null = nessun venduto pubblico noto: valutare a mano, sempre TOP.

// Parole chiave che alzano la priorità (bonus)
const BONUS = [
  { re: /3019\s?phc/i,                         motivo: 'El Primero NOS anni 70 (1982–85)', tier: 'S' },
  { re: /perpetu|quanti[eè]me|ewiger/i,         motivo: 'Calendario perpetuo',              tier: 'S' },
  { re: /le\s?modulor.*(limited|limit|\/\s?(99|249|499))/i, motivo: 'Le Modulor LE numerato', tier: 'S' },
  { re: /voyager.*bmw|bmw.*voyager/i,           motivo: 'Voyager BMW 500 pz 1993',          tier: 'B' },
  { re: /madreperla|mother.?of.?pearl|nacre|perlmutt|ossidiana|obsidian/i, motivo: 'Quadrante raro', tier: 'A' },
  { re: /wave/i,                                motivo: 'Bracciale wave (primi Sport Classic)', tier: 'A' },
  { re: /bracciale oro|gold bracelet|goldband|or massif|full gold/i, motivo: 'Bracciale oro integrale', tier: 'A' },
  { re: /el\s?primero|cal\.?\s?134|cal\.?\s?136|cal\.?\s?137/i, motivo: 'Calibro meccanico epoca Blum', tier: 'A' },
];

// Esclusioni (epoca Movado o materiale povero)
const SCARTO = [
  { re: /sellita|sw\s?510|sw\s?300|1216\d{3}/i, motivo: 'Moderno Movado/reissue' },
  { re: /\bquar(tz|zo)\b/i,                      motivo: 'Quarzo (tenere solo se oro massiccio e sotto melt)' },
];

// Regole fisse
const RULES = {
  meltEURperGram: 85,               // regola permanente: €85/g peso lordo cassa 18k
  bicoloreAvviso: 'Bracciale wave bicolore: parti interne placcate 24k, NON oro massiccio. Lunetta e corona 18k.',
  steelBicoloreMaxEUR: 1200,        // acciaio/bicolore solo sotto questa soglia
  verificaObbligatoria: ['foto fondello con ref a 7 cifre', 'seriale 64xxxxxx coerente col metallo', 'calibro visibile o dichiarato', 'bracciale originale'],
};

function decodeRef(ref) {
  const m = String(ref || '').match(/(?:^|[^0-9])([134589])(124|134|136|137)(240|241|901|913)(?![0-9])/);
  if (!m) return null;
  return { ref: m[1]+m[2]+m[3], metallo: METALLO[m[1]], calibro: CALIBRO[m[2]], cassa: CASSA[m[3]] };
}

function decodeSerial(s) {
  const m = String(s || '').replace(/['\s.]/g, '').match(/\b64(10|20|30|50|61|70)\d{4}\b/);
  return m ? { seriale: m[0], metallo: SERIALE_METALLO[m[1]] } : null;
}

// Restituisce { level: 'TOP'|'NORMAL'|'SCARTO', motivi: [], target, sottoBuyMax, tag }
function classify(text, priceEUR) {
  const t = String(text || '');
  if (!/\beb[ae]ll?\b|エベル/i.test(t)) return { level: 'SCARTO', motivi: ['non Ebel'], tag: null };
  const motivi = [];
  const dec = decodeRef(t);
  const target = dec ? TARGETS.find(x => x.ref === dec.ref) : null;
  const oroMassiccio = /\b(18\s?k(t|arati)?|750|0[.,]750|oro massiccio|solid gold|or massif|massivgold)\b/i.test(t);
  for (const s of SCARTO) {
    if (!s.re.test(t) || target) continue;
    if (/quar/i.test(s.motivo) && oroMassiccio) continue; // quarzo in oro 18k: lo gestisce il ramo melt, non scartare
    motivi.push('scarto: ' + s.motivo);
  }
  if (motivi.length) return { level: 'SCARTO', motivi, tag: null };

  let level = 'NORMAL';
  if (dec) {
    motivi.push(`ref ${dec.ref}: ${dec.metallo}, ${dec.calibro}`);
    const steelTarget = target && target.buyMax;
    const soglia = steelTarget ? target.buyMax : RULES.steelBicoloreMaxEUR;
    if ((dec.metallo === 'acciaio' || dec.metallo === 'acciaio-oro') && priceEUR && priceEUR > soglia) {
      if (priceEUR <= soglia * 1.3) {
        return { level: 'NORMAL', motivi: [...motivi, `trattabile: offrire ${soglia} €`], target, sottoBuyMax: false, tag: CATALYST_TAG };
      }
      return { level: 'SCARTO', motivi: [...motivi, 'acciaio/bicolore sopra soglia'], tag: null };
    }
  }
  if (target && (target.tier === 'S' || target.tier === 'A')) level = 'TOP';
  for (const b of BONUS) if (b.re.test(t)) { motivi.push(b.motivo); if (b.tier !== 'B') level = 'TOP'; }
  const sottoBuyMax = target && target.buyMax && priceEUR ? priceEUR <= target.buyMax : null;
  if (/bicolor|two.?tone|acciaio.?oro|stahl.?gold/i.test(t)) motivi.push(RULES.bicoloreAvviso);
  return { level, motivi, target, sottoBuyMax, tag: CATALYST_TAG };
}

// Query di ricerca multilingua per il radar (IT/DE/FR/EN/NL/PL/ES)
const QUERIES = [
  ...TARGETS.map(x => `Ebel ${x.ref}`),
  'Ebel El Primero', 'Ebel 3019PHC', 'Ebel perpetual calendar chronograph', 'Ebel calendario perpetuo cronografo',
  'Ebel ewiger Kalender Chronograph', 'Ebel quantième perpétuel', 'Ebel Le Modulor limited', 'Ebel Le Modulor oro',
  'Ebel Voyager oro', 'Ebel Voyager BMW', 'Ebel 1911 cronografo oro', 'Ebel Sport Classic Chronograph oro',
  'Ebel chronograaf goud', 'Ebel chronograf złoto', 'Ebel cronógrafo oro',
  // Privati: come scrive chi non conosce l'orologio (eredità, cassetti, mercatini)
  'orologio Ebel oro uomo', 'Ebel cronografo eredità', 'Ebel Goldchronograph Herren', 'Ebel Uhr Gold Nachlass',
  'montre Ebel or homme chronographe', 'Ebel 750 cronografo', 'Ebel 18k chronograph vintage',
  // Errori di battitura e nomi sbagliati (prezzi più bassi, meno concorrenza)
  'Ebal cronografo', 'Ebel Le Modular', 'Ebel Modulor', 'Ebel 1911 Beluga chronograph', 'Ebell chronograph',
];
// Giappone (Yahoo Auctions / Mercari via proxy): tenute separate, servono solo su fonti JP
const QUERIES_JP = ['エベル クロノグラフ 金', 'エベル パーペチュアル', 'エベル モデュロール', 'エベル ボイジャー'];

// Fonti consigliate, in ordine di convenienza attesa per Ebel (stima, da validare con i dati del bot)
const SOURCES_PRIORITY = [
  'Kleinanzeigen (DE: storicamente il primo mercato Ebel)', 'Subito.it', 'Leboncoin', 'Catawiki',
  'Bidinside/Nomisma (invenduti: zero premio)', 'case d\'asta minori IT/DE/AT senza specialista orologi',
  'Yahoo Auctions Japan / Mercari via proxy', 'OLX.pl',
];

module.exports = { CATALYST_TAG, TARGETS, BONUS, SCARTO, RULES, QUERIES, QUERIES_JP, SOURCES_PRIORITY, decodeRef, decodeSerial, classify };
