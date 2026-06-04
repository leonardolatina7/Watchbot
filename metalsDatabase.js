/**
 * DATABASE PESI PRECISI — Oro 18k e Platino
 * Fonte: schede tecniche ufficiali brand
 * pureMetalGrams = grammi di metallo puro nella cassa
 */

const WATCH_WEIGHTS = {
  // ROLEX
  'rolex day-date 40':     { brand:'Rolex', model:'Day-Date 40',     metal:'18k', pureMetalGrams:107.0, refs:['228238','228235','228239'] },
  'rolex day-date 36':     { brand:'Rolex', model:'Day-Date 36',     metal:'18k', pureMetalGrams:98.5,  refs:['118238','128238','118235'] },
  'rolex daytona gold':    { brand:'Rolex', model:'Daytona Gold',    metal:'18k', pureMetalGrams:112.0, refs:['116508','116505','126508','126505'] },
  'rolex submariner gold': { brand:'Rolex', model:'Submariner Gold', metal:'18k', pureMetalGrams:118.0, refs:['116618','126618'] },
  'rolex gmt gold':        { brand:'Rolex', model:'GMT-Master Gold', metal:'18k', pureMetalGrams:114.0, refs:['116718','126718'] },
  'rolex sky-dweller':     { brand:'Rolex', model:'Sky-Dweller',     metal:'18k', pureMetalGrams:137.0, refs:['326938','336938'] },
  'rolex cellini':         { brand:'Rolex', model:'Cellini',         metal:'18k', pureMetalGrams:58.0,  refs:['50705','50535'] },
  'rolex pearlmaster':     { brand:'Rolex', model:'Pearlmaster',     metal:'18k', pureMetalGrams:84.0,  refs:['86348','69298'] },
  'rolex day-date platinum': { brand:'Rolex', model:'Day-Date Platinum', metal:'platinum', pureMetalGrams:152.0, refs:['228206','118206'] },
  'rolex bubbleback vintage': { brand:'Rolex', model:'Bubbleback Vintage', metal:'18k', pureMetalGrams:36.0, refs:[] },
  // PATEK PHILIPPE
  'patek nautilus gold':   { brand:'Patek Philippe', model:'Nautilus Gold',   metal:'18k', pureMetalGrams:132.0, refs:['5711/1J','5711/1R'] },
  'patek nautilus platinum': { brand:'Patek Philippe', model:'Nautilus Platinum', metal:'platinum', pureMetalGrams:188.0, refs:['5711/1P'] },
  'patek aquanaut gold':   { brand:'Patek Philippe', model:'Aquanaut Gold',   metal:'18k', pureMetalGrams:85.0,  refs:['5167J','5167R'] },
  'patek calatrava':       { brand:'Patek Philippe', model:'Calatrava',       metal:'18k', pureMetalGrams:57.0,  refs:['5196J','6119J','5227J','5227G'] },
  'patek calatrava platinum': { brand:'Patek Philippe', model:'Calatrava Platinum', metal:'platinum', pureMetalGrams:77.0, refs:['5196P'] },
  'patek grand complication': { brand:'Patek Philippe', model:'Grand Complication', metal:'18k', pureMetalGrams:98.0, refs:['5970J','5270J'] },
  // AUDEMARS PIGUET
  'ap royal oak gold':     { brand:'Audemars Piguet', model:'Royal Oak Gold',    metal:'18k', pureMetalGrams:131.0, refs:['15202BA','15500BA','15202OR'] },
  'ap royal oak platinum': { brand:'Audemars Piguet', model:'Royal Oak Platinum', metal:'platinum', pureMetalGrams:185.0, refs:['15202PT'] },
  'ap offshore gold':      { brand:'Audemars Piguet', model:'Royal Oak Offshore Gold', metal:'18k', pureMetalGrams:168.0, refs:['26470BA','26470OR'] },
  // VACHERON CONSTANTIN
  'vacheron patrimony gold': { brand:'Vacheron Constantin', model:'Patrimony Gold',  metal:'18k', pureMetalGrams:51.0, refs:['85180/000J'] },
  'vacheron overseas gold':  { brand:'Vacheron Constantin', model:'Overseas Gold',   metal:'18k', pureMetalGrams:103.0, refs:['4500V/110J'] },
  'vacheron traditionnelle': { brand:'Vacheron Constantin', model:'Traditionnelle',  metal:'18k', pureMetalGrams:61.0, refs:['81590/000J'] },
  // CARTIER
  'cartier santos gold':   { brand:'Cartier', model:'Santos Gold',   metal:'18k', pureMetalGrams:73.0, refs:['WGSA0009'] },
  'cartier tank gold':     { brand:'Cartier', model:'Tank Gold',     metal:'18k', pureMetalGrams:39.0, refs:['WGTA0011','WGTA0059'] },
  'cartier ballon bleu gold': { brand:'Cartier', model:'Ballon Bleu Gold', metal:'18k', pureMetalGrams:88.0, refs:['WGBB0048','WGBB0016'] },
  'cartier crash gold':    { brand:'Cartier', model:'Crash Gold',    metal:'18k', pureMetalGrams:57.0, refs:['WGCR0009'] },
  'cartier drive gold':    { brand:'Cartier', model:'Drive Gold',    metal:'18k', pureMetalGrams:71.0, refs:['WGNM0004'] },
  // OMEGA
  'omega seamaster gold':  { brand:'Omega', model:'Seamaster Gold',  metal:'18k', pureMetalGrams:71.0, refs:['2507.50'] },
  'omega constellation gold': { brand:'Omega', model:'Constellation Gold', metal:'18k', pureMetalGrams:66.0, refs:['123.55'] },
  'omega speedmaster gold': { brand:'Omega', model:'Speedmaster Gold', metal:'18k', pureMetalGrams:103.0, refs:['311.63'] },
  'omega deville gold':    { brand:'Omega', model:'De Ville Gold',   metal:'18k', pureMetalGrams:63.0, refs:['431.63'] },
  // JAEGER-LECOULTRE
  'jaeger reverso gold':   { brand:'Jaeger-LeCoultre', model:'Reverso Gold',  metal:'18k', pureMetalGrams:61.0, refs:['Q2702521'] },
  'jaeger master gold':    { brand:'Jaeger-LeCoultre', model:'Master Gold',   metal:'18k', pureMetalGrams:56.0, refs:['Q1352420'] },
  // BREGUET
  'breguet classique gold': { brand:'Breguet', model:'Classique Gold', metal:'18k', pureMetalGrams:51.0, refs:['5177BA'] },
  'breguet tradition gold': { brand:'Breguet', model:'Tradition Gold', metal:'18k', pureMetalGrams:73.0, refs:['7057BA'] },
  // IWC
  'iwc portugieser gold':  { brand:'IWC', model:'Portugieser Gold',  metal:'18k', pureMetalGrams:88.0, refs:['IW500702'] },
  // A. LANGE & SÖHNE
  'lange saxonia gold':    { brand:'A. Lange & Söhne', model:'Saxonia Gold',   metal:'18k', pureMetalGrams:51.0, refs:['101.021'] },
  'lange datograph gold':  { brand:'A. Lange & Söhne', model:'Datograph Gold', metal:'18k', pureMetalGrams:58.0, refs:['403.021'] },
  'lange 1 gold':          { brand:'A. Lange & Söhne', model:'Lange 1 Gold',   metal:'18k', pureMetalGrams:54.0, refs:['101.021'] },
  // PANERAI
  'panerai luminor gold':  { brand:'Panerai', model:'Luminor Gold',  metal:'18k', pureMetalGrams:123.0, refs:['PAM00537','PAM00692'] },
  // F.P. JOURNE
  'fp journe gold':        { brand:'F.P. Journe', model:'Gold',      metal:'18k', pureMetalGrams:69.0, refs:[] },
  'fp journe platinum':    { brand:'F.P. Journe', model:'Platinum',  metal:'platinum', pureMetalGrams:96.0, refs:[] },
  // PHILIPPE DUFOUR
  'philippe dufour simplicity': { brand:'Philippe Dufour', model:'Simplicity', metal:'18k', pureMetalGrams:39.0, refs:[] },
  // VINTAGE GENERICI
  'vintage pocket watch gold 18k': { brand:'Generico', model:'Pocket Watch Vintage', metal:'18k', pureMetalGrams:42.0, refs:[] },
  'vintage dress watch gold 18k':  { brand:'Generico', model:'Dress Watch Vintage',  metal:'18k', pureMetalGrams:32.0, refs:[] },
};

function getVerifyLink(brand, model, refs) {
  // WatchCharts ha i pesi precisi per tutti i modelli noti
  const q = encodeURIComponent(`${brand} ${model}`);
  if (refs && refs.length > 0) {
    return `https://watchcharts.com/watches/search?q=${q}`;
  }
  // Fallback: Chrono24 scheda tecnica
  const brandSlug = (brand||'').toLowerCase()
    .replace(/\s+/g,'-').replace(/\./g,'')
    .replace('audemars-piguet','audemars-piguet')
    .replace('fp-journe','f-p-journe')
    .replace('a-lange-&-söhne','a-lange-soehne')
    .replace('jaeger-lecoultre','jaeger-lecoultre');
  return `https://www.chrono24.it/${brandSlug}/index.htm`;
}

function findWatchModel(title) {
  if (!title) return null;
  const t = title.toLowerCase();

  // 1. Match per numero di referenza
  const refMatch = t.match(/\b(\d{5,6}[a-z]{0,4}(?:\/\d{1,3}[a-z]{0,2})?)\b/i);
  if (refMatch) {
    const ref = refMatch[1].toUpperCase();
    for (const [key, data] of Object.entries(WATCH_WEIGHTS)) {
      if (data.refs?.some(r => r.toUpperCase().includes(ref) || ref.includes(r.toUpperCase()))) {
        return { key, ...data, confidence: 'high', verifyLink: getVerifyLink(data.brand, data.model, data.refs) };
      }
    }
  }

  // 2. Match per parole chiave del titolo
  let bestMatch = null, bestScore = 0;
  for (const [key, data] of Object.entries(WATCH_WEIGHTS)) {
    const keyWords = key.split(' ');
    const score = keyWords.filter(w => w.length > 2 && t.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { key, ...data, confidence: score >= 3 ? 'high' : 'medium', verifyLink: getVerifyLink(data.brand, data.model, data.refs) };
    }
  }
  if (bestScore >= 2) return bestMatch;

  // 3. Stima generica basata su dimensioni
  const isPlatinum = /platino|platinum|pt\s?950|platin/i.test(t);
  const sizeM = t.match(/\b(28|30|32|34|36|38|39|40|41|42|43|44|45|46|47|48)\s*mm/);
  const size = sizeM ? parseInt(sizeM[1]) : 38;
  const isPocket = /tasca|pocket|gousset|savonnette/i.test(t);
  let grams;
  if (isPocket) grams = 42;
  else if (size <= 34) grams = isPlatinum ? 30 : 26;
  else if (size <= 38) grams = isPlatinum ? 45 : 38;
  else if (size <= 41) grams = isPlatinum ? 65 : 55;
  else if (size <= 44) grams = isPlatinum ? 88 : 75;
  else grams = isPlatinum ? 108 : 92;

  return {
    key:'generic', brand:'Generico', model:'Orologio oro/platino',
    metal: isPlatinum ? 'platinum' : '18k', pureMetalGrams: grams,
    confidence: 'low',
    verifyLink: `https://watchcharts.com/watches/search?q=${encodeURIComponent(title.slice(0,40))}`,
    source: 'stima dimensioni'
  };
}

module.exports = { WATCH_WEIGHTS, findWatchModel, getVerifyLink };
