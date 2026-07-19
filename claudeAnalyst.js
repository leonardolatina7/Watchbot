/**
 * ANALISTA AI — analisi intelligente degli annunci (motore: GROQ, gratis)
 *
 * Invece di cercare una corrispondenza in un database fisso, manda
 * titolo + dati dell'annuncio a un LLM via GROQ (API gratuita, modelli
 * open come Llama 3.3 70B) e riceve un ragionamento esperto: marca,
 * modello, calibro probabile, materiale, fascia di valore, e se vale
 * la pena guardarlo. NB: l'arbitraggio ORO è calcolo puro e NON passa
 * di qui — non costa nulla e gira su ogni annuncio.
 *
 * NOVITÀ — canale "📚 DA STUDIARE":
 * - Se il marchio è nella tua watchlist-Enciclopedia (brandWatchlist con
 *   studyOnly), è vero vintage, l'identificazione è affidabile e il prezzo
 *   NON è sopra il valore di mercato, l'annuncio passa anche SENZA sconto
 *   (flag studyPick). Serve a vederti arrivare i marchi sottovalutati per
 *   studiarli sul campo, non solo quando sono affari forti.
 *
 * IMPORTANTE — limiti onesti di questa analisi:
 * - Claude vede solo il TITOLO (e la foto se disponibile), non il pezzo in mano.
 * - Il valore è una STIMA RAGIONATA, non una quotazione live.
 * - Serve quindi come PRIMO FILTRO intelligente, non come perizia.
 */

const axios = require('axios');
const brandWatchlist = require('./brandWatchlist');
const marketCycles = require('./marketCycles');
// MOTORE AI UNICO (Gemini primario → Groq fallback), sia testo che vision.
// Sostituisce la chiamata diretta a Groq: risolve il 429 rate-limit al minuto
// (Gemini free tier più generoso) e permette finalmente l'analisi ANCHE della
// foto (Gemini è multimodale; Groq testo no). Vedi visionEngine.js.
const visionEngine = require('./visionEngine');

// GROQ — inferenza gratuita su modelli open (formato compatibile OpenAI).
// Default: Llama 3.3 70B = giudizio migliore, multilingue, JSON affidabile.
// Per PIÙ verdetti/giorno sul piano gratis si può mettere su Render:
//   GROQ_MODEL=llama-3.1-8b-instant   (molto più volume, meno finezza)
//   GROQ_MODEL=openai/gpt-oss-120b    (forte, volume medio)
// NB: l'arbitraggio ORO è calcolo puro e NON passa di qui (gratis, illimitato).
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ── Tetto morbido analisi/giorno (il piano gratis Groq limita anche i TOKEN
// al giorno: se si tocca il limite, un 429 mette in pausa l'AI fino al reset
// — l'oro intanto continua a girare). Alzalo/abbassalo con GROQ_DAILY_LIMIT. ──
const DAILY_LIMIT = parseInt(process.env.GROQ_DAILY_LIMIT || '1000');
let usage = { day: new Date().getDate(), count: 0 };
function quotaOk() {
  const d = new Date().getDate();
  if (d !== usage.day) usage = { day: d, count: 0 }; // reset giornaliero
  return usage.count < DAILY_LIMIT;
}

// ── Cache per non rianalizzare lo stesso annuncio ──
const cache = new Map();
const CACHE_MAX = 2000;
function cacheKey(title) {
  return (title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}

function isConfigured() {
  // Basta UNO dei due provider (Gemini o Groq) per far girare l'analisi.
  return visionEngine.isConfigured();
}

function getUsage() {
  // Etichetta modello REALE: il motore primario è Claude (via visionEngine).
  // Prima mostrava il vecchio Groq llama-3.3, fuorviante in /api/status.
  const modelLabel = process.env.ANTHROPIC_API_KEY
    ? (process.env.CLAUDE_MODEL || 'claude-sonnet-5')
    : (process.env.GEMINI_API_KEY ? (process.env.GEMINI_MODEL || 'gemini') : MODEL);
  return { used: usage.count, limit: DAILY_LIMIT, cached: cache.size, model: modelLabel };
}

// NB: il throttle anti-429 e il fallback tra provider ora vivono in
// visionEngine.js (motore unico). Qui non serve più gestirli.

/**
 * Scarica un'immagine e la converte in base64 per Claude.
 * Limiti: max 4MB, timeout 10s. Se fallisce, ritorna null (si procede senza foto).
 */
async function fetchImageBase64(imageUrl) {
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) return null;
  try {
    const r = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 4 * 1024 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const contentType = r.headers['content-type'] || 'image/jpeg';
    // Claude accetta solo questi formati
    let mediaType = 'image/jpeg';
    if (contentType.includes('png')) mediaType = 'image/png';
    else if (contentType.includes('webp')) mediaType = 'image/webp';
    else if (contentType.includes('gif')) mediaType = 'image/gif';
    const base64 = Buffer.from(r.data, 'binary').toString('base64');
    return { mediaType, base64 };
  } catch (e) {
    return null; // foto non scaricabile, si procede col solo titolo
  }
}

/**
 * Analizza un singolo annuncio. Se c'è un'immagine, Claude la GUARDA.
 * Ritorna: { isInteresting, brand, model, caliber, material, valueLow,
 *            valueHigh, reasoning, confidence, sawImage, studyPick } oppure null.
 */
async function analyzeListing(title, priceEur, imageUrl, opts = {}) {
  if (!isConfigured()) return null;
  // ── TIER MOTORE (v12.22, gate di tesi): 'top' = candidato caldo → Claude
  //    Sonnet (primario a pagamento). Tutto il resto → skipClaude: parte
  //    direttamente da Gemini Flash (gratis) e ripiega su Groq. Così Sonnet
  //    lavora SOLO sulle opportunità vere e il budget mensile regge.
  const _skipClaude = opts.tier !== 'top';
  if (!title) return null;

  // ── PRE-FILTRO ANTI-FUMO (a costo zero, PRIMA di Claude) ──
  // Scarta subito ciò che non è un orologio da polso vintage da uomo,
  // così non bruciamo un'analisi Claude (= token) su robaccia ovvia.
  const t = title.toLowerCase();
  const SCARTA = [
    'sveglia','da parete','da tavolo','pendolo','carillon','cucù','cucu',
    'smartwatch','apple watch','samsung','fitbit','garmin','huawei','xiaomi',
    'cinturino','bracciale ricambio','solo cinturino','solo quadrante','solo cassa',
    'scatola vuota','box vuota','solo box','solo scatola','teca','espositore',
    'sveglietta','timer','cronometro da tasca da muro','orologio da muro',
    'replica','first copy','tipo rolex','stile rolex','no brand','senza marca',
    'giocattolo','bambino','cartoon','disney','plastica','silicone',
  ];
  if (SCARTA.some(k => t.includes(k))) return null;
  // serve almeno un indizio di orologio da polso
  if (!/(orolog|watch|cronograf|chrono|automatic|carica manuale|diver|montre|uhr|reloj)/i.test(t)) return null;

  // Cache hit (chiave include se c'era una foto, perché l'analisi cambia)
  const key = cacheKey(title) + (imageUrl ? '|img' : '');
  if (cache.has(key)) {
    const cached = cache.get(key);
    return evaluateWithPrice(cached, priceEur);
  }

  if (!quotaOk()) {
    console.warn('[CLAUDE] Limite giornaliero raggiunto, salto analisi');
    return null;
  }

  // Il motore ora usa Gemini (multimodale) come primario: se c'è una foto E
  // Gemini è configurato, la ANALIZZIAMO. Se Gemini manca, si ripiega su Groq
  // testo (che le foto non le vede) e l'analisi resta sul solo titolo.
  // Vision attiva se c'è un provider che vede le foto: Claude (primario) o
  // Gemini. Prima era legata alla sola GEMINI_API_KEY: con Claude primario
  // la foto non sarebbe mai stata usata senza anche Gemini. Groq vision
  // (llama-4-scout, in deprecazione) NON abilita da solo il ramo foto.
  const hasImage = !!imageUrl && (!!process.env.ANTHROPIC_API_KEY || !!process.env.GEMINI_API_KEY);

  // ── DIGEST ENCICLOPEDIA (v12.34): le regole del dealer (Enciclopedia del
  //    Vintage v22) iniettate nel prompt quando index.js le passa. ~500 token:
  //    su Gemini/Groq gratis il costo è zero, il guadagno è che l'AI valuta
  //    "con la testa del dealer" (melt, redial, curva, cerchio) e non da
  //    modello generico. I flag già rilevati dalla macchina (enciclopedia.js)
  //    le vengono passati per non farle ripetere il lavoro. ──
  const _ency = opts.encyclopediaDigest
    ? `\n${opts.encyclopediaDigest}\n` +
      (Array.isArray(opts.encyFlags) && opts.encyFlags.length
        ? `FLAG GIÀ RILEVATI DALLA MACCHINA (tienine conto): ${opts.encyFlags.join(', ')}\n`
        : '')
    : '';

  const prompt = `Sei un esperto di orologi vintage con un fiuto speciale per i GIOIELLI DIMENTICATI: marchi svizzeri di qualità, oggi sottovalutati, ma con bei calibri (spesso di manifattura o cronografi Valjoux/Venus/Lemania/Excelsior Park) e potenziale di rivalutazione. Esempi del genere che cerchi: Nivada Grenchen, Gallet, Excelsior Park, Wakmann, Eterna, Girard-Perregaux, Zenith cal.135, Enicar, Vulcain, Doxa, Favre-Leuba, Universal Genève, LIP, vintage Movado/Longines/Tissot di qualità.

NON ti interessano i nomi iper-famosi e iper-quotati (Rolex sportivi, Patek moderni) dove non c'è margine: lì il prezzo giusto lo sanno tutti.
${_ency}
${hasImage ? 'Guarda la FOTO e leggi' : 'Leggi'} questo annuncio e rispondi SOLO con un oggetto JSON, senza testo prima o dopo, senza backtick.

Annuncio: "${title}"
${hasImage ? '\nNella foto valuta: condizioni cassa, originalità del quadrante (ridipinto o no), lancette, danni, e se l\'orologio corrisponde alla descrizione.' : ''}

Rispondi con SOLO questo JSON, niente testo prima o dopo, niente backtick:
{
  "brand": "marca o null",
  "model": "modello/referenza o null",
  "caliber": "calibro probabile o null",
  "material": "oro 18k / acciaio / oro cappato / placcato / sconosciuto",
  "goldGramsEstimate": numero o null (se oro vero, stima grammi oro NETTO dalla foto: dress 36-38mm 16-26g, crono 18-28g, sportivo 24-40g, oversize 35-60g, tasca 25-45g. Meglio sottostimare),
  "isWatch": true/false (false se è solo un pezzo: quadrante, lancette, cassa vuota, movimento sciolto, cinturino, scatola, lotto ricambi),
  "isVintage": true/false (d'epoca anni 1940-1980. FALSE se moderno o riedizione. Non dedurre l'anno da numeri di calibro/referenza. Servono 2+ segnali d'epoca veri),
  "isSleeper": true/false (marchio di QUALITÀ ma SOTTOVALUTATO con potenziale di salita),
  "sleeperTier": 0-3 (0=noto/quotato; 1=semi-noto tipo Doxa/Zenith; 2=poco noto di qualità tipo Nivada/Gallet/Enicar; 3=tesoro oscuro tipo Lemania proprio/Excelsior Park/Airain),
  "qualityMovement": true/false (manifattura, cronometro, o crono Valjoux/Venus/Lemania/Excelsior Park),
  "doubleSigned": "rivenditore se doppia firma (Tiffany, Cartier, Hausmann, Pisa, Cusi, Beyer, Gubelin, Serpico y Laino) o null — può MOLTIPLICARE il valore",
  "specialDial": "tropicale/gilt/sector/pie-pan/esotico/salmone/smalto/ecc o null",
  "sellerClueless": true/false (il venditore non sa cosa ha? titolo generico, marca assente/storpiata = segnale d'oro),
  "valueLow": numero EUR (minima mercato attuale) o null,
  "valueHigh": numero EUR (massima attuale) o null,
  "valueBasis": "una frase BREVE che dice su COSA si basa la stima: la REFERENZA/CALIBRO ESATTI di QUESTO annuncio e i venduti reali comparabili che conosci per QUELLA referenza. NON citare il valore del modello iconico della famiglia se questa referenza è diversa.",
  "refUncertain": true/false (true se NON sei sicuro che la referenza/modello che hai in mente corrisponda davvero a quello dell'annuncio, o se stai stimando sulla famiglia e non sulla referenza esatta. Nel dubbio METTI true),
  "desirability": 1-10,
  "isGrail": true/false (è un pezzo da sogno per i collezionisti),
  "futureOutlook": "rising/stable/declining (come si muove il valore di QUESTO pezzo nei prossimi 3-5 anni)",
  "scenarioPessimistico": numero EUR o null (a 5 anni nello scenario PRUDENTE/sfavorevole: nessun catalizzatore, mercato piatto, o piccola difficoltà. Per oro/brand nobile = recuperi grazie al floor metallo; per acciaio comune = circa il prezzo di mercato di oggi, fermo. NON deve quasi mai essere catastrofico: l'orologio di marca ha sempre un compratore),
  "scenarioBase": numero EUR o null (a 5 anni nello scenario PIÙ PROBABILE. ⚠️ REGOLA CHIAVE: stima la base in modo CONSERVATIVO, più bassa di quanto l'entusiasmo suggerirebbe. La base è lo scenario che si avvera nella MAGGIORANZA dei casi (~65%) SE il pezzo è comprato bene. Se per essere un buon affare il pezzo ha bisogno dello scenario ottimistico, allora NON è comprato bene: tieni la base prudente e lascia che sia il prezzo a dover scendere),
  "scenarioOttimistico": numero EUR o null (a 5 anni se il motore lavora come previsto: catalizzatore parte, scarsità morde. NON un miracolo — niente code da +300%, quelle non si prezzano. Solo il buon esito atteso),
  "scenarioBasis": "una frase: su COSA si fonda lo scenario BASE conservativo (comparabili venduti reali, motore presente o assente). Di' apertamente se il pezzo regge SOLO sull'ottimistico (= non è comprato bene a questo prezzo)",
  "motoreRivalutazione": "quale motore di rivalutazione è ACCESO: melt (floor oro), catalizzatore (rilancio/asta/stampa), liquidita (flusso veloce alta domanda), oppure 'nessuno' (prezzo fermo, magazzino non investimento)",
  "evRating": "high/medium/low (potenziale di RIVALUTAZIONE a medio termine, come un'azione sottovalutata. ⚠️ Dai high SOLO se lo scenario BASE conservativo già rende il giusto rispetto al prezzo; se serve l'ottimistico per giustificarlo, NON è high)",
  "investmentReasons": "una frase sui fattori che spingono/frenano il valore futuro: traiettoria marchio, rarità/produzione, calibro manifattura, moda collezionisti, importanza storica",
  "strongMarket": "paese/mercato dove QUESTO modello si rivende meglio (es. Italia, Germania, Francia, USA, Giappone, internazionale) o null se indifferente",
  "geoEdgePct": numero (differenza % stimata di prezzo tra il mercato forte e gli altri, es. 15 se nel paese forte vale ~15% in più) o null,
  "geoNote": "una frase sul PERCHÉ quel mercato è più forte per questo pezzo (gusto locale, storia, dove fu venduto all'epoca) o null",
  "working": true/false/null (false se rotto/fermo/da revisionare; null se non chiaro),
  "redFlags": "SOLO allarmi autenticità: ridipinto, parti non originali, falso, franken. NON mettere qui rotto/non funzionante (va in working)",
  "reasoning": "una frase: perché è o non è un affare, citando calibro/qualità",
  "confidence": "high/medium/low"
}

Regole:
- ⛔ REGOLA FONDAMENTALE — VALUTA LA REFERENZA ESATTA, NON LA FAMIGLIA (è la regola che conta più di tutte):
  Stima valueLow/valueHigh SOLO sulla referenza, modello e calibro EFFETTIVAMENTE scritti nell'annuncio. Una stessa famiglia di nome famoso contiene modelli con valori DIVERSISSIMI: NON applicare il prezzo del modello iconico/vintage a una referenza moderna o diversa.
  Esempi dell'errore da NON fare MAI:
  • Breitling Navitimer: il 806 vintage (Venus 178, anni '50-'60, AOPA) vale 5.000-20.000€, MA un A30022 / "Navitimer 92" (calibro automatico B13/B30 base Valjoux 7750, anni '90) vale solo 2.000-3.000€. Sono entrambi "Navitimer" ma 5-10 volte diversi. Se l'annuncio dice A30022, vale come A30022, NON come 806.
  • IWC: un cal. 89 dress oro vale 1.500-2.800€, NON come un Ingenieur cal. 852/8541 (3.000-12.000€). Se l'annuncio dice "cal. 89", è un cal. 89.
  • Omega: un Seamaster cal. 552 dress vale meno di uno Speedmaster 321. Non confonderli.
  Se nell'annuncio c'è una REFERENZA ALFANUMERICA precisa (es. A30022, 14764, 16520) o un CALIBRO preciso (cal. 89, B30, 552), quella è la verità: ancora la stima a QUELLA, non al nome della collezione. Se non sei SICURO della corrispondenza referenza→valore, metti refUncertain=true e allarga/abbassa la stima per prudenza. MEGLIO SOTTOSTIMARE che gonfiare: un falso "affare" fa perdere soldi e figure.
- In valueBasis scrivi sempre su quali comparabili reali ti basi (referenza + calibro esatti).
- Se NON è un orologio, isWatch false e confidence low.
- Premia i marchi sottovalutati di qualità (isSleeper true) e i bei calibri (qualityMovement true): sono il bersaglio.
- DOPPIA FIRMA = TESORO: se il quadrante porta la firma di un rivenditore (Tiffany, Cartier, Hausmann, Pisa, Cusi, Beyer, Gubelin, Wempe, Serpico y Laino...), il pezzo vale MOLTO di piu del normale, anche se la marca e nota. Alza forte desirability e valueHigh, e spiega il premio nel reasoning.
- QUADRANTE SPECIALE = VALORE: tropicale, gilt, sector, pie-pan, esotico, salmone, smalto ecc. fanno salire molto il prezzo tra i collezionisti. Tienine conto nella stima e segnalalo.
- Roba PARTICOLARE e RICERCATA (configurazioni rare, quadranti insoliti, provenienza militare, complicazioni inusuali) vale piu di un pezzo comune: premiala.
- ANALISI DA INVESTITORE (medio termine 3-5 anni): ragiona come per un'azione. Anche se oggi il prezzo e "giusto" e non c'e sconto, chiediti: questo orologio tra 3-5 anni varra di piu? Considera: il marchio sta salendo tra i collezionisti (es. Universal Geneve, vintage di manifattura, indie) o e fermo/in declino (es. quarzo anonimo, marchi morti senza fascino)? E raro o prodotto in massa? Ha un calibro di manifattura che regge il valore? E gia in trend di crescita? Da questo derivano evRating e i tre scenari (scenarioPessimistico/scenarioBase/scenarioOttimistico — vedi regola 16). Sii realista: la maggior parte degli orologi NON si rivaluta (evRating medium/low). Metti high solo quando lo scenario BASE conservativo gia regge.
- CRITERI CONCRETI PER evRating HIGH (il precedente che insegna: Universal Geneve, comprata da Breitling nel 2023, i Compax sono raddoppiati/triplicati — chi conosceva i fondamentali ha comprato PRIMA del catalizzatore). Dai evRating high quando vedi ALMENO DUE di questi: (a) calibro a ruota di colonne o manifattura propria sotto un nome che il mercato non prezza (es. Excelsior Park, Gallet, Wittnauer Valjoux 72 = stesso motore degli Heuer a un terzo del prezzo); (b) marchio morto o appena rilanciato con storia documentata, archivi e community (es. Nivada, Vulcain, Aquastar, Airain: la riedizione fa pubblicita agli originali); (c) famiglia di modelli dove il capofamiglia e gia esploso e i fratelli no (es. Enicar: Sherpa Graph esploso, Super Divette/Jet/Guide ancora fermi); (d) flottante stretto (produzione minuscola, pochi esemplari in vendita); (e) pavimento di valore (oro 18k vicino al melt, o acciaio sportivo molto richiesto); (f) neo-vintage 1985-2000 con calibro giusto, comprato finche e "solo usato" e non ancora "collezione". Dai invece evRating LOW quando: prezzo gia salito piu del 100% in 2 anni senza nuovo catalizzatore (sei in cima), mercato di una sola generazione anziana, o pezzo non originale (redial/lucidato/franken: l'investimento richiede originalita, sempre).
- ROTTO/NON FUNZIONANTE NON è un problema: un orologio di qualità rotto e venduto a poco è un'OCCASIONE (si rivende per pezzi o si fa riparare). Mettilo in working=false ma NON tra i redFlags, e tienine conto abbassando un po' la stima di valore (un pezzo fermo vale meno di uno funzionante, ma vale).
- REGOLE IMPARATE SUL CAMPO (applicale SEMPRE, sono le cose che fanno perdere o guadagnare soldi davvero):
- 0) SOLO VERO VINTAGE: ci interessano SOLO orologi d'epoca (anni 1940-1980 circa). Le RIEDIZIONI MODERNE e i modelli NUOVI NON interessano, anche se la marca è giusta (Yema, Doxa, Squale, Zodiac, Nivada moderni ecc. sono da SCARTARE). Se isVintage è false, NON è interessante. I moderni non si rivalutano e non sono il nostro gioco.
- 1) QUADRANTE RIDIPINTO (redial): un quadrante ridipinto o sostituito ABBATTE il valore del 40-60%. In foto spesso non si vede. Segnali: stampe troppo nette/recenti su un vintage, font sbagliato, scritte non allineate o troppo spesse, lume rifatto uniforme, minuteria stampata male ai bordi. Se sospetti redial mettilo in redFlags e abbassa molto valueLow/valueHigh. Nel reasoning ricorda SEMPRE di chiedere al venditore "il quadrante è originale o ridipinto?".
- 2) CASSA NAZIONALE ITALIANA: nel dopoguerra molti svizzeri (anche Omega, Longines, Baume & Mercier) arrivavano in Italia come solo movimento+quadrante e la cassa d'oro veniva fatta in Italia ("cassa nazionale"). Vale MOLTO MENO di una cassa originale svizzera di manifattura, anche se è oro vero. Segnali: punzone "ITALY", marchio di garanzia italiano (testa/stemma) invece dei punzoni svizzeri, fondello liscio senza riferimento/seriale del marchio, cassa leggera. Se sospetti cassa nazionale, NON dare valore al nome del brand: vale circa solo il peso dell'oro. Segnalalo nel reasoning e abbassa la stima.
- 3) ORO: non basta che "sia oro". Conta CARATURA (18k/750 vero o solo placcato "plaqué or"/laminato?) e PESO/peso cassa. Una cassa dress sottile pesa poco = poco oro = poco valore. Se non c'è punzone 750 o sembra placcato, trattalo come acciaio (niente paracadute metallo). Nel reasoning chiedi sempre: punzone, caratura, peso, foto fondello.
- 4) MARCHI MINORI SENZA MERCATO (es. Dalor, Nobellux, Augustus, FHB, Gigandet, Rewel, Lanco, Camy, Cauny, Mulco e simili nomi oscuri NON tra gli sleeper di qualità): sono "piacere", non investimento. Onesti ma non si rivalutano e si rivendono alla stessa cifra. NON metterli mai isInteresting per potenziale futuro: passali solo se a pochi euro con margine reale. evRating al massimo low/medium.
- 5) DA DONNA = niente mercato: gli orologi sotto i ~32mm spesso sono da donna e NON si rivalutano (domanda quasi nulla). Se sembra piccolo/da donna, abbassa forte desirability e non trattarlo come investimento.
- 6) FALSO PRESTIGIO / FINTI SVIZZERI DA CATALOGO (es. Bernhard H. Mayer e simili che usano "depuis 18xx", "Genève", "Swiss Made" ma sconosciuti ai collezionisti): niente valore di rivendita. NON farti ingannare dalle parole altisonanti. Se il marchio non è tra quelli veri/noti ai collezionisti, trattalo come senza valore.
- 7) PREZZO RIDICOLO SU MARCHIO FAMOSO = FALSO: un Rolex/Omega/Breitling/Cartier a una frazione del prezzo reale è quasi sempre un falso o una replica. Mettilo in redFlags.
- 8) MARCHE NOTE A PREZZO PIENO: i marchi famosi (Omega Genève dress comune, ecc.) vengono spesso messi a prezzo GONFIATO sul nome. Se è comune e a prezzo pieno, NON è un affare: serve sconto vero o un paracadute (oro pesante) o un modello davvero ricercato (diver/sport, quadrante speciale).
- 9) VERIFICA ORIGINALITÀ sui pezzi importanti: calibro corretto per quel riferimento, bracciale/ghiera/lancette originali, fondello col riferimento e seriale. Su crono e diver il "franken" (pezzi misti) è comune. Nel reasoning ricorda di chiedere foto di movimento e fondello.
- 10) DOXA E SIMILI — RIEDIZIONI TRAVESTITE: i Doxa Sub VERI vintage sono solo 1967-1975 circa (Sub 300/300T era Synchron/Aubry: plexi, lunetta no-deco in alluminio, quadranti arancio/giallo/nero d'epoca) e valgono 1500-5000+. I Doxa moderni (rilancio 2002-oggi, "Clive Cussler", Sub 300 Carbon, zaffiro, ceramica) citano apposta 1967/1970 nel testo: è marketing, NON sono vintage, isVintage false. Stessa logica per ogni brand rilanciato. In dubbio: confidence low e chiedi foto movimento/fondello nel reasoning.
- 11) VALJOUX 92 vs LANDERON 48 — STESSO LAYOUT, VALORE DIVERSO: entrambi bicompax 9-3, il quadrante NON li distingue. Valjoux 92 = RUOTA A COLONNE (torretta dentellata a castello vicino ai pulsanti, lato movimento) = premio collezionisti, in oro 18k vale 1500-2200. Landeron 48/51 = piastra a CAMME = vale quasi solo l'oro. Se l'annuncio dichiara "Valjoux 92" senza foto del movimento lato pulsanti, NON dare il premio: stima da Landeron e nel reasoning chiedi la foto della ruota a colonne. Brand assemblatori minori (Oriental, Chronographe Suisse) con 92 CONFERMATO = eccezione alla regola "brand minore": il calibro a colonne crea domanda propria. Nota: scritta METAL sull'anello interno cassa = normale (anello porta-movimento non in oro), NON è un red flag.
- 12) STORIA DI SERVIZIO: marchi di orologiaio incisi/scritti dentro il fondello (es. "LAR 4-90" = laboratorio + mese-anno) = orologio seguito, segnale positivo. Ma data l'ultima revisione: se più vecchia di 10 anni, sconta 250-350 euro di servizio crono dalla stima. Una revisione recente DOCUMENTATA (ricevuta + scheda lavori) vale invece un premio di 100-300 euro: citala nel reasoning se l'annuncio la menziona.
- 13) COMPLICAZIONI: il valore sta nell'ESECUZIONE, non nella funzione. PREMIA: ora saltante/jump hour d'epoca o d'autore, seconde morte/jumping seconds (calibro Chézard 115/116 anni 50 anche su Doxa & co. = sleeper vintage prezioso, segnalalo SEMPRE), Crazy Hours Franck Muller, UN Freak originale, tourbillon SOLO se di manifattura vera con finitura alta. TRAPPOLA: "tourbillon" sotto i 1500 euro = movimento cinese, ZERO valore di rivendita, redFlags. Su ogni complicato ricorda nel reasoning il costo del servizio (rattrapante/ripetizioni/Freak = 2000-5000+ euro solo in casa madre).
- 14) MERCATO FORTE (arbitraggio geografico): certi modelli si rivendono MEGLIO in un paese che in un altro per gusto e storia locale. Stima strongMarket, geoEdgePct e geoNote SOLO quando hai un motivo concreto; altrimenti metti null (la maggior parte dei pezzi non ha un vero edge geografico: non inventarlo). Esempi del fenomeno: cronografi e dress svizzeri venduti in Italia all'epoca (doppie firme italiane Hausmann/Cusi/Pisa, "cassa nazionale") → più richiesti in ITALIA; orologi tedeschi (Glashütte, Junghans crono, Stowa, Sinn) e militari Bund → mercato caldo in GERMANIA; militari francesi (type 20: Airain, Dodane, Auricoste), LIP, Yema → FRANCIA; diver e crono americani anni 60-70 e Bulova/Hamilton US → USA; Seiko/Citizen JDM e King/Grand Seiko vintage → GIAPPONE. È SOLO un'informazione di contesto su dove monetizzi meglio: NON deve cambiare valueLow/valueHigh né far scattare un affare. L'affare resta tale solo per prezzo vs mercato.
- 15) CICLO DEL SEGMENTO (leggi il mercato, non solo il pezzo): i segmenti hanno cicli. Oggi (dato 2026, può cambiare): ORO DRESS / crono di manifattura in oro anni 50-60 = ciclo IN SALITA, costante, ancora sottovalutati (Longines 30CH, crono oro Zenith): su orizzonte 3-5 anni è il profilo migliore, doppio fondamentale orologio+oro. ACCIAIO SPORTIVO / diver-chrono vintage = ciclo MATURO: ha corso fino al picco 2021-22 e poi corretto, molti pezzi sono già al massimo del ciclo (ottima liquidità, ma upside futuro più limitato). Tienine conto in evRating/futureOutlook: a parità di pezzo, un crono oro dress sottovalutato ha traiettoria migliore di un diver-chrono acciaio già esploso. NON è un gate, è lettura di contesto.
- ${hasImage ? 'Basa il giudizio sulla foto oltre che sul titolo.' : 'Vedi solo il titolo: sii prudente nelle stime.'}
- 16) RAGIONA DA INVESTITORE / PORTAFOGLIO (regola che governa scenari ed evRating): valuti come un'azione, non come una singola scommessa. Tre scenari a 5 anni — pessimistico / BASE / ottimistico — e la BASE è quella che pesa (~65% dei casi SE comprato bene). Principi: (a) la BASE va tenuta CONSERVATIVA, sotto l'entusiasmo: è la conseguenza meccanica del comprare bene, non una speranza. (b) NON prezzare le code: né il +300% miracoloso né il disastro — sulla lunga si annullano, decidi sul centro. (c) Il filtro decisivo: un pezzo è un buon affare SOLO se rende il giusto già nello scenario BASE conservativo; se "funziona" solo nell'ottimistico, vuol dire che NON è comprato bene a quel prezzo → evRating basso e nel reasoning di' che serve uno sconto. (d) Questo NON penalizza l'acciaio: un acciaio col MOTORE acceso (catalizzatore/liquidità) comprato a prezzo onesto regge benissimo la base → può essere high. Quello che resta fuori è il pezzo SENZA motore pagato pieno (base piatta = magazzino, non investimento), oro o acciaio che sia. (e) L'upside oltre la base, se il lavoro è fatto bene (studio, comparabili, dial verificato), è un BONUS gratis non prezzato: meglio sotto-promettere.`;

  // ── CHIAMATA AL MOTORE UNICO (Gemini→Groq). Se c'è foto usa la vision
  //    (Gemini multimodale), altrimenti l'analisi testuale. Il motore gestisce
  //    da sé throttle, fallback e retry sul 429. ──
  try {
    usage.count++;
    let text;
    if (hasImage) {
      text = await visionEngine.visionComplete(imageUrl, prompt, { maxTokens: 1200, temperature: 0.2, jsonMode: true, skipClaude: _skipClaude });
    } else {
      text = await visionEngine.textComplete(prompt, { maxTokens: 1200, temperature: 0.2, jsonMode: true, skipClaude: _skipClaude });
    }
    if (!text) { console.error('[CLAUDE] Nessuna risposta dal motore AI (Gemini+Groq falliti)'); return null; }

    const parsed = visionEngine.parseJsonLoose(text);
    if (!parsed) { console.error('[CLAUDE] Risposta non JSON:', text.slice(0, 120)); return null; }

    parsed.sawImage = hasImage;
    parsed._title = title; // serve alla guardia referenza in evaluateWithPrice
    if (cache.size >= CACHE_MAX) { cache.clear(); }
    cache.set(key, parsed);

    return evaluateWithPrice(parsed, priceEur);
  } catch (e) {
    console.error('[CLAUDE] Errore analisi:', e.message);
    return null;
  }
}

// Helper: nessun campanello d'allarme (usato anche prima del calcolo completo).
function senzaAllarmiPre(analysis) {
  return !analysis.redFlags || analysis.redFlags === 'null' || analysis.redFlags === null;
}
// Solo per il canale GREZZO: blocca esclusivamente gli allarmi GRAVI (falso/
// replica/tarocco/tourbillon cinese = vale zero). I sospetti tipici di un
// grezzo oscuro ("redial sospetto", "foto sfocate", "non valutabile dal
// titolo") NON lo uccidono: sono proprio ciò che vai a verificare di persona,
// e finiscono nel messaggio "DA VERIFICARE TU". Coerente con la filosofia del
// canale: rumoroso, volume > selezione, l'occhio finale è di Leonardo.
function senzaAllarmiGraviGrezzo(analysis) {
  const rf = String(analysis.redFlags || '').toLowerCase();
  if (!rf || rf === 'null') return true;
  return !/fals|fake|replica|replika|tarocc|contraffatt|cinese|cinos/.test(rf);
}

// Aggiunge il giudizio confrontando la stima col prezzo reale.
// MODALITÀ "SOLO AFFARI FORTI": segnala solo se c'è un margine reale
// E l'identificazione è affidabile E non ci sono campanelli d'allarme.
// MODALITÀ "DA STUDIARE": i marchi della watchlist-Enciclopedia passano
// anche senza sconto, se vero vintage + id affidabile + prezzo ≤ valore.
function evaluateWithPrice(analysis, priceEur) {
  const out = { ...analysis };
  out.priceEur = priceEur;

  // Scarta se NON è un orologio (cinturino, scatola, accessorio, falso)
  if (analysis.isWatch === false) { out.isInteresting = false; return out; }
  // SOLO VERO VINTAGE: scarta i moderni e le riedizioni (Yema, Doxa, Squale... nuovi)
  // ECCEZIONE 1: gli INDIPENDENTI MODERNI (Czapek, UJ, Journe, Akrivia...) ci
  // interessano anche da moderni: sono le "azioni growth" dell'orologeria.
  // ECCEZIONE 2: la FASCIA MEDIA (Tudor, Grand Seiko, JLC, Cartier) passa il
  // filtro MA solo come affare vero (sconto concreto): mai come "da studiare".
  const modernIndie = brandWatchlist.isModernIndie(analysis.brand);
  const midrange = brandWatchlist.isMidrange(analysis.brand);
  out.modernIndie = modernIndie;
  out.midrange = midrange;

  // RESCUE GREZZO (strozzatura B): un pezzo ECONOMICO con un CALIBRO DI QUALITÀ
  // riconosciuto (Valjoux/Venus/Lemania/Landeron/manifattura, o qualityMovement)
  // merita il tuo occhio ANCHE se l'AI non è riuscita a confermare "vintage" da
  // un titolo generico (il prompt pretende 2+ segnali d'epoca → l'annuncio
  // dell'ignorante li manca quasi sempre). Segnale STRETTO di proposito: il
  // fashion / quarzo moderno NON ha un calibro così → resta fuori, gli scarti
  // restano puliti. Così i grezzi non muoiono qui sotto prima della rete.
  const _grezzoCap = parseInt(process.env.FLIP_GREZZO_MAX || '600');
  const grezzoForte =
    priceEur > 0 && priceEur <= _grezzoCap &&
    senzaAllarmiGraviGrezzo(analysis) &&
    (!!analysis.qualityMovement ||
     /ruota a colonn|column wheel|valjoux|venus|landeron|lemania|manufacture|manifattura/i.test(String(analysis.caliber||'') + ' ' + String(analysis.reasoning||'')));

  if (analysis.isVintage === false && !modernIndie && !midrange && !grezzoForte) { out.isInteresting = false; out.notVintage = true; return out; }

  // ── CANALE "🔧 FLIP GREZZO" (fascia bassa, scelta di Leonardo: rumoroso) ──
  // Il flip vero a 200-400€ nasce dal pezzo OSCURO/mal fotografato che l'AI
  // spesso non sa quotare (valueLow null). Prima questi venivano scartati qui
  // sotto. Ora: se il prezzo è basso E ci sono segnali di qualità nonostante
  // l'oscurità, lo mando lo stesso come "DA VERIFICARE TU" — meglio vederne
  // troppi e scartarli a mano che perdere l'affare grezzo. Filosofia: a fascia
  // bassa il volume batte la selezione, l'occhio finale è il tuo.
  const FLIP_GREZZO_MAX = parseInt(process.env.FLIP_GREZZO_MAX || '600');
  const segnaliQualitaGrezzo =
    !!analysis.qualityMovement ||
    /ruota a colonn|column wheel|valjoux|venus|landeron|lemania|manufacture|manifattura/i.test(String(analysis.caliber||'') + ' ' + String(analysis.reasoning||'')) ||
    /oro|18k|750|gold|acciaio|steel|swiss|svizzer/i.test(String(analysis.material||'')) ||
    (analysis.sellerClueless === true) ||
    ((analysis.sleeperTier||0) >= 1);
  const flipGrezzo =
    priceEur > 0 && priceEur <= FLIP_GREZZO_MAX &&
    analysis.isWatch !== false &&
    (analysis.isVintage !== false || grezzoForte) &&
    senzaAllarmiGraviGrezzo(analysis) &&
    segnaliQualitaGrezzo;

  // Senza stima di valore: PRIMA scartavo sempre. Ora scarto solo se NON è
  // nemmeno un candidato flip grezzo (così i pezzi oscuri a basso prezzo con
  // segnali di qualità sopravvivono e te li mando da verificare).
  if (!analysis.valueLow || !priceEur) {
    if (flipGrezzo) {
      out.isInteresting = true;
      out.isFlipGrezzo = true;
      out.dealStrength = 'GREZZO';
      out.marketCycleLine = marketCycles.contextLine({ brand: analysis.brand, material: analysis.material, type: [analysis.model, analysis.caliber].filter(Boolean).join(' ') });
      out.reasoning = (analysis.reasoning ? analysis.reasoning + ' ' : '') +
        '⚠️ DA VERIFICARE TU: prezzo basso + segnali di qualità, ma valore non stimabile dal solo titolo. Chiedi foto movimento/fondello e valuta di persona — è il tipo di grezzo dove nasce il flip.' +
        (analysis.redFlags && analysis.redFlags !== 'null' && analysis.redFlags !== null ? ' 🔎 Da controllare: ' + analysis.redFlags : '');
      return out;
    }
    out.isInteresting = false; return out;
  }

  // ── FILTRO "TROPPO BELLO PER ESSERE VERO" ──
  const ratio = analysis.valueLow / priceEur;
  const valoreAssurdo =
    (analysis.valueLow > 15000 && priceEur < 3000) ||  // pezzo "da 15k+" a meno di 3k
    (ratio > 12 && analysis.valueLow > 5000);          // valore oltre 12x il prezzo su pezzo caro
  if (valoreAssurdo) {
    out.isInteresting = false;
    out.suspect = true;
    out.reasoning = 'Valore stimato troppo alto per il prezzo: probabile errore di identificazione o pezzo non autentico. Scartato.';
    return out;
  }

  const discountVsLow = Math.round(((analysis.valueLow - priceEur) / analysis.valueLow) * 100);
  const marginEur = analysis.valueLow - priceEur; // guadagno potenziale minimo
  out.discountVsLow = discountVsLow;
  out.marginEur = marginEur;
  out.isDeal = priceEur < analysis.valueLow;
  out.isGoodDeal = priceEur < analysis.valueLow * 0.85;

  // ── GUARDIA REFERENZA INCERTA (anti-figuraccia) ──────────────────────────
  // Causa nº1 dei falsi "affare": l'AI stima sul modello ICONICO della famiglia
  // (Navitimer 806, IWC Ingenieur...) mentre l'annuncio è una referenza diversa
  // e più economica (A30022, cal.89...). Se l'AI ha segnalato refUncertain, NON
  // dichiariamo l'affare sulla base di quello sconto: il pezzo passa SOLO come
  // "DA VERIFICARE" con avviso esplicito, mai come occasione sotto-prezzo.
  // Inoltre: se nel TITOLO c'è una referenza alfanumerica precisa ma lo sconto
  // stimato è enorme (>40%), trattiamo la stima come inaffidabile per prudenza.
  const refInTitle = /\b([a-z]{1,3}\s?\d{4,6}|ref\.?\s?\d{3,6})\b/i.test(String(analysis._title || out.title || ''));
  const scontoSospetto = discountVsLow >= 40;
  out.refUncertain = analysis.refUncertain === true;
  if (analysis.refUncertain === true || (refInTitle && scontoSospetto)) {
    out.isInteresting = true;
    out.isFlipGrezzo = false;
    out.refCheck = true;            // flag per un alert dedicato "verifica referenza"
    out.isDeal = false;             // NON è un affare confermato
    out.isGoodDeal = false;
    out.dealStrength = 'VERIFICA';
    out.marketCycleLine = marketCycles.contextLine({ brand: analysis.brand, material: analysis.material, type: [analysis.model, analysis.caliber].filter(Boolean).join(' ') });
    out.reasoning = (analysis.reasoning ? analysis.reasoning + ' ' : '') +
      `⚠️ STIMA NON CONFERMATA: il valore (${analysis.valueLow}-${analysis.valueHigh}€) potrebbe riferirsi a un modello diverso della stessa famiglia. ` +
      (analysis.valueBasis ? `Base stima: ${analysis.valueBasis}. ` : '') +
      `Verifica la REFERENZA esatta (${analysis.model || '?'}) e il CALIBRO (${analysis.caliber || '?'}) prima di considerarlo un affare: NON fidarti dello sconto mostrato.`;
    return out;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const idAffidabile = analysis.confidence === 'high' || analysis.confidence === 'medium';
  const senzaAllarmi = !analysis.redFlags || analysis.redFlags === 'null' || analysis.redFlags === null;

  // ── BONUS WATCHLIST-AZIENDA: collego finalmente brandBonus ──
  // Marchi-azienda in salute (Czapek, UG, Nivada...) ottengono punti che
  // ammorbidiscono le soglie: la qualità del marchio è essa stessa un segnale.
  const bonus = brandWatchlist.brandBonus(analysis.brand) || 0; // 0..3
  out.brandBonus = bonus;
  // Marchio "senza mercato" (Dalor, Lanco...) NON deve mai fingersi sleeper.
  const senzaMercato = brandWatchlist.isNoMarketBrand(analysis.brand);
  if (senzaMercato) { out.sleeperTier = 0; out.isSleeper = false; }

  // STRATEGIA VOLUMI: soglie scalate sul prezzo, ammorbidite dal brandBonus.
  // Ogni punto di bonus abbassa la soglia di sconto richiesta di 2 punti %.
  const softening = bonus * 2;
  let margineForte;
  if (priceEur < 500) {
    margineForte = discountVsLow >= (25 - softening) || marginEur >= 70;
  } else if (priceEur < 2000) {
    margineForte = discountVsLow >= (30 - softening) || marginEur >= 250;
  } else {
    margineForte = discountVsLow >= (35 - softening) || (marginEur >= 600 && discountVsLow >= 25);
  }
  const tier = analysis.sleeperTier || 0;

  // GUARDIA MODERNO CELEBRATIVO: un pezzo di marchio famoso con segnali da
  // edizione moderna celebrativa/limitata (anniversary, limited edition,
  // riedizione, "80th"...) NON è un grail vintage. Era il buco che ha fatto
  // passare la Carrera "Jack Heuer 80th" a €2.800 come OCCASIONE: l'AI le dava
  // un valore gonfiato + isGrail e scattava grailScontato scavalcando le regole
  // sui moderni. Qui lo blocco a valle, in codice (il prompt è ignorabile).
  const modernCelebrativo = /\b(anniversary|anniversario|jubil[eé]|limited edition|edizione limitata|re-?edition|reissue|riedizione|special edition|\d{2,3}\s*(st|nd|rd|th)\s*ann)\b/i
    .test(`${analysis.brand||''} ${analysis.model||''} ${analysis.reasoning||''}`);

  const grailScontato = analysis.isGrail && discountVsLow >= 20 && !modernCelebrativo;
  const sleeperDiQualita = tier >= 1 && (analysis.isSleeper || analysis.qualityMovement) && discountVsLow >= 15 && marginEur >= 50;
  const venditoreIgnaro = analysis.sellerClueless && tier >= 2 && marginEur >= 100;
  const tesoroOscuro = tier >= 3 && discountVsLow >= 10 && marginEur >= 50;

  // ── DOPPIA FIRMA / QUADRANTE SPECIALE ──
  const haDoppiaFirma = !!(analysis.doubleSigned && analysis.doubleSigned !== 'null' && String(analysis.doubleSigned).toLowerCase() !== 'no');
  const haQuadranteSpeciale = !!(analysis.specialDial && analysis.specialDial !== 'null' && String(analysis.specialDial).toLowerCase() !== 'no');
  const pezzoParticolare = (haDoppiaFirma || haQuadranteSpeciale) && marginEur >= 0;

  // ── ANALISI DA INVESTITORE (medio termine) ──
  const evAlto = analysis.evRating === 'high';
  const investimento = evAlto && marginEur >= 0 &&
    (tier >= 1 || analysis.qualityMovement || analysis.isSleeper || haDoppiaFirma || analysis.isGrail);

  // ─────────────────────────────────────────────────────────────────────
  // PUNTEGGIO INVESTITORE 0–10 — l'orologio come un'azione.
  // Le sei voci di bilancio dell'Enciclopedia tradotte in punti. Non dipende
  // più dal solo evRating "high" binario: pesa motore, rarità, storia,
  // pavimento, liquidità e catalizzatore. Gate bilanciato a >=7.
  // Scelta di Leonardo: scatta ANCHE a prezzo pieno (≤ mercato), perché il
  // punto è comprare i fondamentali PRIMA del catalizzatore. L'unico vincolo
  // duro è l'ORIGINALITÀ: un pezzo non originale non è mai un investimento.
  // ─────────────────────────────────────────────────────────────────────
  const f = {
    motore:   0, // calibro/manifattura (il prodotto dell'azienda)
    rarita:   0, // flottante stretto / sleeper tier
    storia:   0, // marchio-azienda documentato e in salute
    pavimento:0, // oro/melt o acciaio sportivo molto richiesto
    liquidita:0, // si rivende? (grail/doppia firma/quadrante speciale)
    catalizzatore: 0, // notizia che muove il titolo (evRating/outlook)
  };
  // 1. Motore — calibro nobile
  if (analysis.qualityMovement) f.motore += 2;
  if (analysis.isGrail) f.motore += 1;
  // 2. Rarità / flottante
  if (tier >= 3) f.rarita += 2; else if (tier >= 1) f.rarita += 1;
  if (analysis.isSleeper) f.rarita += 1;
  // 3. Storia documentabile (watchlist-azienda in salute → brandBonus 0..3)
  f.storia += Math.min(bonus, 3);
  // 4. Pavimento di valore (downside protetto)
  if (/oro\s*18|18k|18\s*kt|750\b/i.test(String(analysis.material||''))) f.pavimento += 1;
  // 5. Liquidità — segnali che si rivende in fretta
  if (haDoppiaFirma) f.liquidita += 2; else if (haQuadranteSpeciale) f.liquidita += 1;
  // 6. Catalizzatore — la traiettoria (evRating/outlook)
  if (analysis.evRating === 'high') f.catalizzatore += 3;
  else if (analysis.evRating === 'medium') f.catalizzatore += 1;
  if (analysis.futureOutlook === 'rising') f.catalizzatore += 1;
  // Penalità originalità: un pezzo non originale NON è un investimento.
  const nonOriginale = !senzaAllarmi;
  let investorScore = f.motore + f.rarita + f.storia + f.pavimento + f.liquidita + f.catalizzatore;
  if (nonOriginale) investorScore -= 4; // taglio netto: l'originalità è sacra
  if (analysis.working === false) investorScore -= 1; // da revisionare = piccolo sconto

  // ── CICLO DEL SEGMENTO (informativo, spinta leggera ±1) ──
  // Legge la fase di mercato del pezzo (oro dress salita / acciaio sport maturo
  // / indie crescita) e modula appena lo score. Aggiornabile in marketCycles.js.
  const cycleItem = {
    brand: analysis.brand,
    material: analysis.material,
    type: [analysis.model, analysis.caliber,
           (/diver|sub/i.test(String(analysis.model||'')) ? 'diver' : ''),
           (analysis.qualityMovement ? 'chrono' : 'dress')].filter(Boolean).join(' '),
  };
  out.marketCycle = marketCycles.describe(cycleItem);
  out.marketCycleLine = out.marketCycle.label;
  investorScore += marketCycles.scoreNudge(cycleItem); // -1..+1

  investorScore = Math.max(0, Math.min(10, investorScore));
  // Marchi senza mercato e fascia media (Tudor/GS/JLC/Cartier ovunque) NON
  // sono investimenti-sleeper: restano sul canale FLIP, fuori dall'investitore.
  if (senzaMercato || midrange) investorScore = 0;
  out.investorScore = investorScore;
  out.fundamentals = f;
  // Gate BILANCIATO: >=7, identificazione affidabile, originale, prezzo non
  // sopra il mercato (≤ valueHigh). Nessuno sconto richiesto.
  const prezzoNonSopraMercato = priceEur <= (analysis.valueHigh || analysis.valueLow);
  const investorPick = investorScore >= 7 && idAffidabile && !nonOriginale && prezzoNonSopraMercato;
  out.investorPick = !!investorPick;

  // ── CANALE "📚 DA STUDIARE" (scelta di Leonardo: solo prezzo ≤ valore) ──
  // Marchio della watchlist-Enciclopedia (studyOnly), vero vintage, id
  // affidabile, niente allarmi, e prezzo NON sopra il valore di mercato.
  // Passa ANCHE senza sconto: serve a vedere e studiare il mercato.
  // "Prezzo ≤ valore di mercato" = non sopra la stima MASSIMA: un annuncio
  // onesto sta tra valueLow e valueHigh, prima lo scartavo per troppa severità.
  // Gli INDIPENDENTI MODERNI passano per lo stesso canale: ogni avvistamento
  // usato a prezzo ≤ mercato va visto (sono rari, ognuno è un'occasione di studio).
  // La FASCIA MEDIA invece NO: Tudor/GS/JLC/Cartier sono ovunque, niente da
  // studiare — entrano SOLO dai canali affare (margineForte & co.).
  const studyBrand = (brandWatchlist.isStudyBrand(analysis.brand) || modernIndie) && !midrange;
  const marketCap = analysis.valueHigh || analysis.valueLow;
  // I BEN NOTI già quotati (i "soliti Omega/Longines/IWC" comuni: tier 0, non
  // sleeper, non indie) NON passano più a prezzo pieno dal canale DA STUDIARE:
  // li mando solo se c'è uno sconto reale o un angolo speciale. Gli SCONOSCIUTI
  // di qualità (tier ≥ 1 / sleeper / indie) restano studiabili anche a prezzo
  // ≤ mercato → il feed si riempie di oscuri, non dei noti già prezzati.
  const benNoto = (analysis.sleeperTier||0) === 0 && !analysis.isSleeper && !modernIndie;
  const studyNotoOk = !benNoto || discountVsLow >= 15 || analysis.qualityMovement || haDoppiaFirma || haQuadranteSpeciale;
  const studyPick = studyBrand && idAffidabile && senzaAllarmi && priceEur <= marketCap && studyNotoOk;
  out.studyPick = !!studyPick;

  const affareVero = idAffidabile && senzaAllarmi && !modernCelebrativo &&
    (margineForte || grailScontato || sleeperDiQualita || venditoreIgnaro || tesoroOscuro || pezzoParticolare || investimento);

  out.isInteresting = affareVero || out.studyPick || out.investorPick;
  out.isRealDeal = affareVero; // distingue affare vero (FLIP) da studio/investimento
  out.isInvestor = out.investorPick; // pezzo da accumulare (TESORO), anche a prezzo pieno

  if (out.isInteresting) {
    const margineCredibile = Math.min(marginEur, 8000);
    let base = (discountVsLow >= 50 || margineCredibile >= 1500) ? 'FORTE'
             : (discountVsLow >= 40 || margineCredibile >= 600) ? 'BUONO'
             : 'INTERESSANTE';
    if (analysis.sellerClueless && (analysis.sleeperTier||0) >= 2) base = 'FORTE';
    if (haDoppiaFirma && base === 'INTERESSANTE') base = 'BUONO';
    // Se è solo studio (nessun affare vero), la forza è neutra
    out.dealStrength = affareVero ? base : 'STUDIO';
    out.sellerClueless = analysis.sellerClueless || false;
    out.sleeperTier = analysis.sleeperTier || 0;
    out.doubleSigned = haDoppiaFirma ? analysis.doubleSigned : null;
    out.specialDial = haQuadranteSpeciale ? analysis.specialDial : null;
    out.futureOutlook = analysis.futureOutlook || null;
    // Modello a 3 scenari (base dominante e conservativa)
    out.scenarioPessimistico = analysis.scenarioPessimistico || null;
    out.scenarioBase = analysis.scenarioBase || null;
    out.scenarioOttimistico = analysis.scenarioOttimistico || null;
    out.scenarioBasis = analysis.scenarioBasis || null;
    out.motoreRivalutazione = analysis.motoreRivalutazione || null;
    // Retrocompat: i vecchi campi puntano agli estremi degli scenari
    out.futureValueLow = analysis.scenarioPessimistico || null;
    out.futureValueHigh = analysis.scenarioOttimistico || null;
    out.evRating = analysis.evRating || null;
    out.investmentReasons = analysis.investmentReasons || null;
  }
  return out;
}

module.exports = { analyzeListing, isConfigured, getUsage };
