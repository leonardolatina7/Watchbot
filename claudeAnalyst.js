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
const DAILY_LIMIT = parseInt(process.env.GROQ_DAILY_LIMIT || '300');
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
  return !!process.env.GROQ_API_KEY;
}

function getUsage() {
  return { used: usage.count, limit: DAILY_LIMIT, cached: cache.size, model: MODEL };
}

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
async function analyzeListing(title, priceEur, imageUrl) {
  if (!isConfigured()) return null;
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

  // Groq (Llama 3.3 70B & co.) è SOLO testo: niente analisi foto. Il giudizio
  // si basa su titolo + dati dell'annuncio. Le foto le guardi tu prima di comprare.
  const img = null;
  const hasImage = !!img;

  const prompt = `Sei un esperto di orologi vintage con un fiuto speciale per i GIOIELLI DIMENTICATI: marchi svizzeri di qualità, oggi sottovalutati, ma con bei calibri (spesso di manifattura o cronografi Valjoux/Venus/Lemania/Excelsior Park) e potenziale di rivalutazione. Esempi del genere che cerchi: Nivada Grenchen, Gallet, Excelsior Park, Wakmann, Eterna, Girard-Perregaux, Zenith cal.135, Enicar, Vulcain, Doxa, Favre-Leuba, Universal Genève, LIP, vintage Movado/Longines/Tissot di qualità.

NON ti interessano i nomi iper-famosi e iper-quotati (Rolex sportivi, Patek moderni) dove non c'è margine: lì il prezzo giusto lo sanno tutti.

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
  "desirability": 1-10,
  "isGrail": true/false (è un pezzo da sogno per i collezionisti),
  "futureOutlook": "rising/stable/declining (come si muove il valore di QUESTO pezzo nei prossimi 3-5 anni)",
  "futureValueLow": numero EUR (stima minima tra 3-5 anni) o null,
  "futureValueHigh": numero EUR (stima massima tra 3-5 anni) o null,
  "evRating": "high/medium/low (potenziale di RIVALUTAZIONE a medio termine, come un'azione sottovalutata)",
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
- Se NON è un orologio, isWatch false e confidence low.
- Premia i marchi sottovalutati di qualità (isSleeper true) e i bei calibri (qualityMovement true): sono il bersaglio.
- DOPPIA FIRMA = TESORO: se il quadrante porta la firma di un rivenditore (Tiffany, Cartier, Hausmann, Pisa, Cusi, Beyer, Gubelin, Wempe, Serpico y Laino...), il pezzo vale MOLTO di piu del normale, anche se la marca e nota. Alza forte desirability e valueHigh, e spiega il premio nel reasoning.
- QUADRANTE SPECIALE = VALORE: tropicale, gilt, sector, pie-pan, esotico, salmone, smalto ecc. fanno salire molto il prezzo tra i collezionisti. Tienine conto nella stima e segnalalo.
- Roba PARTICOLARE e RICERCATA (configurazioni rare, quadranti insoliti, provenienza militare, complicazioni inusuali) vale piu di un pezzo comune: premiala.
- ANALISI DA INVESTITORE (medio termine 3-5 anni): ragiona come per un'azione. Anche se oggi il prezzo e "giusto" e non c'e sconto, chiediti: questo orologio tra 3-5 anni varra di piu? Considera: il marchio sta salendo tra i collezionisti (es. Universal Geneve, vintage di manifattura, indie) o e fermo/in declino (es. quarzo anonimo, marchi morti senza fascino)? E raro o prodotto in massa? Ha un calibro di manifattura che regge il valore? E gia in trend di crescita? Da questo deriva evRating e le stime futureValue. Sii realista: la maggior parte degli orologi NON si rivaluta (evRating medium/low). Metti high solo quando i fattori sono davvero forti.
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
- ${hasImage ? 'Basa il giudizio sulla foto oltre che sul titolo.' : 'Vedi solo il titolo: sii prudente nelle stime.'}`;

  // Costruisci il messaggio: testo + eventuale immagine
  let content;
  if (hasImage) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
      { type: 'text', text: prompt },
    ];
  } else {
    content = prompt;
  }

  try {
    usage.count++;
    const r = await axios.post(API_URL, {
      model: MODEL,
      max_tokens: 1200,
      temperature: 0.2,
      response_format: { type: 'json_object' }, // JSON mode (Groq lo supporta sui Llama)
      messages: [{ role: 'user', content }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      timeout: 30000,
    });

    // Groq usa il formato OpenAI: la risposta sta in choices[0].message.content
    let text = r.data.choices?.[0]?.message?.content || '';
    // Rimuovi markdown e spazi
    text = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Claude a volte aggiunge testo prima/dopo il JSON — tentiamo di estrarlo
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch { console.error('[CLAUDE] Risposta non JSON recuperabile:', text.slice(0, 120)); return null; }
      } else {
        console.error('[CLAUDE] Risposta non JSON:', text.slice(0, 120));
        return null;
      }
    }

    parsed.sawImage = hasImage;
    if (cache.size >= CACHE_MAX) { cache.clear(); }
    cache.set(key, parsed);

    return evaluateWithPrice(parsed, priceEur);
  } catch (e) {
    const status = e.response?.status;
    const body = JSON.stringify(e.response?.data || '').slice(0, 300);
    if (status === 401) console.error('[GROQ] Chiave non valida (401) — controlla GROQ_API_KEY su Render');
    else if (status === 429) console.error('[GROQ] Limite piano gratis raggiunto (429): l\'AI riprende dopo il reset. L\'oro continua a girare gratis.');
    else console.error('[GROQ]', status ? `${status}: ${body}` : e.message);

    // ── GATE STIMA: credito esaurito / quota / auth = NESSUNA VALUTAZIONE ──
    // Una stima prodotta senza il modello non è "più rumorosa": è priva di
    // segnale. Pubblicare una % in questo stato ha valore atteso NEGATIVO,
    // perché ti fa muovere capitale su un numero arbitrario e ti abitua a
    // diffidare anche degli alert buoni. Segnaliamo lo stato in modo
    // esplicito così il chiamante non può inventarsi percentuali.
    lastEstimateFailure = {
      ts: Date.now(),
      status: status || null,
      reason: /credit balance|too low|insufficient|quota|billing/i.test(body) ? 'credito esaurito'
            : status === 429 ? 'limite richieste'
            : status === 401 ? 'chiave non valida'
            : 'errore API',
    };
    return { estimateUnavailable: true, isInteresting: false, priceEur,
             estimateFailReason: lastEstimateFailure.reason };
  }
}

// Stato dell'ultimo fallimento stima: usalo negli alert per scrivere
// "stima non disponibile" invece di una percentuale inventata.
let lastEstimateFailure = null;
function estimateHealth() {
  if (!lastEstimateFailure) return { ok: true };
  const ageMin = Math.round((Date.now() - lastEstimateFailure.ts) / 60000);
  return { ok: false, reason: lastEstimateFailure.reason, status: lastEstimateFailure.status, ageMin };
}
// Riga pronta per Telegram quando la stima non c'è.
function estimateUnavailableLine(reason) {
  return `\n\u26A0\uFE0F <b>STIMA NON DISPONIBILE</b> (${reason || 'AI offline'})\n` +
         `Nessuna percentuale mostrata: senza il modello il numero sarebbe inventato.\n` +
         `Valuta a mano — l'oro e i venduti reali continuano a funzionare.\n`;
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
  if (analysis.isVintage === false && !modernIndie && !midrange) { out.isInteresting = false; out.notVintage = true; return out; }

  // ── CANALE "🔧 FLIP GREZZO" (fascia bassa, scelta di Leonardo: rumoroso) ──
  // Il flip vero a 200-400€ nasce dal pezzo OSCURO/mal fotografato che l'AI
  // spesso non sa quotare (valueLow null). Prima questi venivano scartati qui
  // sotto. Ora: se il prezzo è basso E ci sono segnali di qualità nonostante
  // l'oscurità, lo mando lo stesso come "DA VERIFICARE TU" — meglio vederne
  // troppi e scartarli a mano che perdere l'affare grezzo. Filosofia: a fascia
  // bassa il volume batte la selezione, l'occhio finale è il tuo.
  const FLIP_GREZZO_MAX = parseInt(process.env.FLIP_GREZZO_MAX || '400');
  const segnaliQualitaGrezzo =
    !!analysis.qualityMovement ||
    /ruota a colonn|column wheel|valjoux|venus|landeron|lemania|manufacture|manifattura/i.test(String(analysis.caliber||'') + ' ' + String(analysis.reasoning||'')) ||
    /oro|18k|750|gold|acciaio|steel|swiss|svizzer/i.test(String(analysis.material||'')) ||
    (analysis.sellerClueless === true) ||
    ((analysis.sleeperTier||0) >= 1);
  const flipGrezzo =
    priceEur > 0 && priceEur <= FLIP_GREZZO_MAX &&
    analysis.isWatch !== false &&
    analysis.isVintage !== false &&
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

  // ── FLOOR METALLO: su un pezzo d'oro il confronto va fatto sui PREMI ──
  // Un Eberhard oro 18k con 13,6 g di cassa ha ~1.150€ di metallo: quella
  // parte del prezzo NON è rischio, è capitale recuperabile. Confrontare il
  // prezzo PIENO con la stima piena schiaccia insieme due cose diverse e
  // produce falsi "sopra/sotto stima" enormi. Il floor tronca la coda
  // sinistra della distribuzione dei rendimenti: va prezzato esplicitamente,
  // non ignorato. meltEur arriva da metalsDatabase SOLO se il metallo è
  // confermato (peso noto): sulle stime generiche non si applica.
  const meltEur = Number(analysis.meltValueEur || 0);
  const floorUsabile = meltEur > 0 && analysis.valueLow > meltEur * 1.15;

  let discountVsLow, marginEur;
  if (floorUsabile) {
    const premiumAsk = priceEur - meltEur;          // quanto paghi l'orologio
    const premiumLow = analysis.valueLow - meltEur; // quanto vale l'orologio
    discountVsLow = premiumLow > 0 ? Math.round(((premiumLow - premiumAsk) / premiumLow) * 100) : 0;
    marginEur = Math.round(premiumLow - premiumAsk);
    out.goldFloored  = true;
    out.meltEur      = Math.round(meltEur);
    out.premiumAsk   = Math.round(premiumAsk);
    out.premiumLow   = Math.round(premiumLow);
    // PERDITA MASSIMA liquidando a fuso (80% dello spot, realistico da
    // compro-oro). È la metrica che dice quanto capitale rischi davvero.
    out.downsideEur  = Math.round(meltEur * 0.80 - priceEur);
    out.floorLine    = `\u{1F3F7}\uFE0F Fuso ~\u20AC${Math.round(meltEur).toLocaleString('it-IT')} \u00B7 ` +
                       `paghi l'orologio \u20AC${Math.round(premiumAsk).toLocaleString('it-IT')} ` +
                       `(vale ~\u20AC${Math.round(premiumLow).toLocaleString('it-IT')})\n` +
                       `\u{1F6E1}\uFE0F Perdita max a fuso: \u20AC${Math.abs(Math.round(meltEur*0.80 - priceEur)).toLocaleString('it-IT')}\n`;
  } else {
    discountVsLow = Math.round(((analysis.valueLow - priceEur) / analysis.valueLow) * 100);
    marginEur = analysis.valueLow - priceEur; // guadagno potenziale minimo
    out.goldFloored = false;
  }

  out.discountVsLow = discountVsLow;
  out.marginEur = marginEur;
  out.isDeal = priceEur < analysis.valueLow;
  out.isGoodDeal = priceEur < analysis.valueLow * 0.85;

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
  const grailScontato = analysis.isGrail && discountVsLow >= 20;
  const tier = analysis.sleeperTier || 0;
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
  const studyPick = studyBrand && idAffidabile && senzaAllarmi && priceEur <= marketCap;
  out.studyPick = !!studyPick;

  const affareVero = idAffidabile && senzaAllarmi &&
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
    out.futureValueLow = analysis.futureValueLow || null;
    out.futureValueHigh = analysis.futureValueHigh || null;
    out.evRating = analysis.evRating || null;
    out.investmentReasons = analysis.investmentReasons || null;
  }
  return out;
}

module.exports = { analyzeListing, isConfigured, getUsage, estimateHealth, estimateUnavailableLine };
