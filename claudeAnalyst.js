/**
 * CLAUDE ANALYST — analisi intelligente degli annunci
 *
 * Invece di cercare una corrispondenza in un database fisso, manda
 * titolo + prezzo dell'annuncio a Claude (API Anthropic) e riceve
 * un ragionamento esperto: marca, modello, calibro probabile,
 * materiale, fascia di valore indicativa, e se vale la pena guardarlo.
 *
 * IMPORTANTE — limiti onesti di questa analisi:
 * - Claude vede solo il TITOLO, non le foto. Nel vintage le condizioni
 *   e l'originalità (che stanno nelle foto) contano moltissimo.
 * - Il valore è una STIMA RAGIONATA basata su conoscenza di mercato,
 *   non una quotazione live. Va sempre verificato dall'utente.
 * - Serve quindi come PRIMO FILTRO intelligente, non come perizia.
 *
 * Protezioni:
 * - Cache: non rianalizza lo stesso titolo due volte (risparmia soldi).
 * - Limite giornaliero di chiamate (anti-sorpresa in bolletta).
 * - Si attiva solo se ANTHROPIC_API_KEY è configurata.
 */

const axios = require('axios');

// Haiku 4.5: il modello più veloce ed economico, ideale per analizzare
// molti annunci a basso costo. ID verificato sul catalogo Anthropic.
const MODEL = 'claude-haiku-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

// ── Protezione costi ──
const DAILY_LIMIT = parseInt(process.env.CLAUDE_DAILY_LIMIT || '700'); // max analisi/giorno (rete più ampia)
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
  return !!process.env.ANTHROPIC_API_KEY;
}

function getUsage() {
  return { used: usage.count, limit: DAILY_LIMIT, cached: cache.size };
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
 *            valueHigh, reasoning, confidence, sawImage } oppure null.
 */
async function analyzeListing(title, priceEur, imageUrl) {
  if (!isConfigured()) return null;
  if (!title) return null;

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

  // Prova a scaricare la foto (se c'è)
  const img = await fetchImageBase64(imageUrl);
  const hasImage = !!img;

  const prompt = `Sei un esperto di orologi vintage con un fiuto speciale per i GIOIELLI DIMENTICATI: marchi svizzeri di qualità, oggi sottovalutati, ma con bei calibri (spesso di manifattura o cronografi Valjoux/Venus/Lemania/Excelsior Park) e potenziale di rivalutazione. Esempi del genere che cerchi: Nivada Grenchen, Gallet, Excelsior Park, Wakmann, Eterna, Girard-Perregaux, Zenith cal.135, Enicar, Vulcain, Doxa, Favre-Leuba, Universal Genève, LIP, vintage Movado/Longines/Tissot di qualità.

NON ti interessano i nomi iper-famosi e iper-quotati (Rolex sportivi, Patek moderni) dove non c'è margine: lì il prezzo giusto lo sanno tutti.

${hasImage ? 'Guarda la FOTO e leggi' : 'Leggi'} questo annuncio e rispondi SOLO con un oggetto JSON, senza testo prima o dopo, senza backtick.

Annuncio: "${title}"
${hasImage ? '\nNella foto valuta: condizioni cassa, originalità del quadrante (ridipinto o no), lancette, danni, e se l\'orologio corrisponde alla descrizione.' : ''}

Rispondi con questo formato esatto:
{
  "brand": "marca o null",
  "model": "modello/referenza o null",
  "caliber": "calibro probabile (es. Valjoux 72, manifattura, ecc.) o null",
  "material": "oro 18k / acciaio / oro cappato / placcato / platino / sconosciuto",
  "isWatch": true/false (è un orologio COMPLETO da polso/tasca? false se è SOLO un pezzo: quadrante/dial, lancette, corona, ghiera, cassa vuota, fondello, vetro, movimento sciolto, cinturino, scatola, o un lotto di ricambi. Anche se è di marca pregiata, un quadrante da solo NON è un orologio: isWatch false),
  "condition": "${hasImage ? 'condizioni in foto: ottime/buone/discrete/scarse o null' : 'null'}",
  "isSleeper": true/false (è uno di quei marchi di QUALITÀ ma SOTTOVALUTATI con potenziale di salita?),
  "sleeperTier": numero 0-3 (0=marchio noto/quotato tipo Tissot/Hamilton, NON un tesoro; 1=semi-noto sottovalutato tipo Doxa/Zenith vintage; 2=poco conosciuto di qualità tipo Nivada/Gallet/Enicar; 3=tesoro oscuro per intenditori tipo Lemania a marchio proprio/Excelsior Park/Ollech&Wajs/Airain),
  "qualityMovement": true/false (monta un calibro di qualità: manifattura, cronometro, o crono Valjoux/Venus/Lemania/Excelsior Park?),
  "doubleSigned": "nome del rivenditore se il quadrante ha una DOPPIA FIRMA (seconda firma oltre alla marca), es. Tiffany & Co, Cartier, Hausmann, Pisa, Cusi, Beyer, Gubelin, Wempe, Serpico y Laino, Asprey... oppure null. ATTENZIONE: la doppia firma puo MOLTIPLICARE il valore, e un venditore italiano spesso NON lo sa",
  "specialDial": "se il quadrante ha tratti SPECIALI molto ricercati descrivili brevemente, oppure null. Esempi: tropicale (marrone sbiadito), gilt/dorato, sector/scientifico, pie-pan, esotico/Paul Newman, salmone, nero gilt, spider/craquele, lino/tessuto, due toni, smalto",
  "sellerClueless": true/false (dal titolo sembra che il VENDITORE non sappia cosa ha? titolo generico tipo vecchio orologio, marca assente o scritta male, nessun dettaglio: è il segnale d'oro dei veri affari),
  "valueLow": numero EUR (stima minima mercato attuale) o null,
  "valueHigh": numero EUR (stima massima) o null,
  "desirability": numero 1-10 (quanto è ricercato dai conoscitori),
  "isGrail": true/false,
  "futureOutlook": "rising/stable/declining (come si muovera il valore di QUESTO orologio nei prossimi 3-5 anni, ragionando come un investitore)",
  "futureValueLow": numero EUR (stima minima del valore tra 3-5 anni) o null,
  "futureValueHigh": numero EUR (stima massima tra 3-5 anni) o null,
  "evRating": "high/medium/low (potenziale di RIVALUTAZIONE a medio termine: high = forte upside, e un EV positivo come un'azione sottovalutata; low = restera fermo o calera)",
  "investmentReasons": "una frase sui fattori che spingono (o frenano) il valore futuro: traiettoria del marchio, rarita/produzione limitata, calibro di manifattura, moda tra collezionisti, importanza storica",
  "working": true/false/null (l'orologio funziona? false se l'annuncio dice rotto/fermo/non funzionante/da revisionare/da riparare; null se non si capisce),
  "redFlags": "SOLO veri allarmi di AUTENTICITA o gravi: quadrante ridipinto, parti non originali, falso, frankenwatch. NON mettere qui rotto o non funzionante: quello va nel campo working",
  "reasoning": "una frase: perché è (o non è) un affare interessante, citando il calibro/qualità se rilevante",
  "confidence": "high/medium/low"
}

Regole:
- Se NON è un orologio, isWatch false e confidence low.
- Premia i marchi sottovalutati di qualità (isSleeper true) e i bei calibri (qualityMovement true): sono il bersaglio.
- DOPPIA FIRMA = TESORO: se il quadrante porta la firma di un rivenditore (Tiffany, Cartier, Hausmann, Pisa, Cusi, Beyer, Gubelin, Wempe, Serpico y Laino...), il pezzo vale MOLTO di piu del normale, anche se la marca e nota. Alza forte desirability e valueHigh, e spiega il premio nel reasoning.
- QUADRANTE SPECIALE = VALORE: tropicale, gilt, sector, pie-pan, esotico, salmone, smalto ecc. fanno salire molto il prezzo tra i collezionisti. Tienine conto nella stima e segnalalo.
- Roba PARTICOLARE e RICERCATA (configurazioni rare, quadranti insoliti, provenienza militare, complicazioni inusuali) vale piu di un pezzo comune: premiala.
- ANALISI DA INVESTITORE (medio termine 3-5 anni): ragiona come per un'azione. Anche se oggi il prezzo e "giusto" e non c'e sconto, chiediti: questo orologio tra 3-5 anni varra di piu? Considera: il marchio sta salendo tra i collezionisti (es. Universal Geneve, vintage di manifattura, indie) o e fermo/in declino (es. quarzo anonimo, marchi morti senza fascino)? E raro o prodotto in massa? Ha un calibro di manifattura che regge il valore? E gia in trend di crescita? Da questo deriva evRating e le stime futureValue. Sii realista: la maggior parte degli orologi NON si rivaluta (evRating medium/low). Metti high solo quando i fattori sono davvero forti.
- ROTTO/NON FUNZIONANTE NON è un problema: un orologio di qualità rotto e venduto a poco è un'OCCASIONE (si rivende per pezzi o si fa riparare). Mettilo in working=false ma NON tra i redFlags, e tienine conto abbassando un po' la stima di valore (un pezzo fermo vale meno di uno funzionante, ma vale).
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
      max_tokens: 500,
      messages: [{ role: 'user', content }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      timeout: 25000,
    });

    let text = '';
    for (const block of (r.data.content || [])) {
      if (block.type === 'text') text += block.text;
    }
    text = text.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { console.error('[CLAUDE] Risposta non JSON:', text.slice(0, 100)); return null; }

    parsed.sawImage = hasImage;
    if (cache.size >= CACHE_MAX) { cache.clear(); }
    cache.set(key, parsed);

    return evaluateWithPrice(parsed, priceEur);
  } catch (e) {
    const status = e.response?.status;
    if (status === 401) console.error('[CLAUDE] Chiave API non valida (401)');
    else if (status === 429) console.error('[CLAUDE] Troppe richieste (429)');
    else if (status === 400 && /credit/i.test(JSON.stringify(e.response?.data||''))) console.error('[CLAUDE] Credito esaurito');
    else console.error('[CLAUDE]', e.message);
    return null;
  }
}

// Aggiunge il giudizio confrontando la stima col prezzo reale.
// MODALITÀ "SOLO AFFARI FORTI": segnala solo se c'è un margine reale
// E l'identificazione è affidabile E non ci sono campanelli d'allarme.
function evaluateWithPrice(analysis, priceEur) {
  const out = { ...analysis };
  out.priceEur = priceEur;

  // Scarta se NON è un orologio (cinturino, scatola, accessorio, falso)
  if (analysis.isWatch === false) { out.isInteresting = false; return out; }

  // Senza stima di valore non possiamo giudicare → non segnalare
  if (!analysis.valueLow || !priceEur) { out.isInteresting = false; return out; }

  // ── FILTRO "TROPPO BELLO PER ESSERE VERO" ──
  // Un orologio stimato a valori altissimi NON si trova svenduto a poche
  // centinaia di euro da un privato: o Claude ha sbagliato l'identificazione,
  // o è un falso/replica/quadrante rifatto. Questi sono i falsi "AFFARE
  // FORTE da 200 mila euro". Li scartiamo per non perdere tempo.
  // (Restano gli affari realistici: 200→2000 va benissimo.)
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

  // ── CRITERI "AFFARE FORTE" (tutti devono essere veri) ──
  const idAffidabile = analysis.confidence === 'high' || analysis.confidence === 'medium';
  const senzaAllarmi = !analysis.redFlags || analysis.redFlags === 'null' || analysis.redFlags === null;
  // STRATEGIA VOLUMI: va bene anche un margine piccolo (es. 200→300).
  // Soglie scalate sul prezzo: sui pezzi economici basta un buon margine %,
  // sui pezzi cari si applica comunque una % minima.
  let margineForte;
  if (priceEur < 500) {
    // Pezzi economici: basta +25% di margine O almeno 70€ di guadagno
    margineForte = discountVsLow >= 25 || marginEur >= 70;
  } else if (priceEur < 2000) {
    // Fascia media: +30% o 250€
    margineForte = discountVsLow >= 30 || marginEur >= 250;
  } else {
    // Pezzi cari: +35% o 600€ (con almeno -25%)
    margineForte = discountVsLow >= 35 || (marginEur >= 600 && discountVsLow >= 25);
  }
  const grailScontato = analysis.isGrail && discountVsLow >= 20;
  // I "gioielli dimenticati" passano con margine più basso SOLO se sono
  // davvero sottovalutati (tier >= 1). Un marchio noto (tier 0) come Tissot,
  // anche con bel calibro, deve avere margine FORTE: niente sconto-tesoro.
  const tier = analysis.sleeperTier || 0;
  const sleeperDiQualita = tier >= 1 && (analysis.isSleeper || analysis.qualityMovement) && discountVsLow >= 15 && marginEur >= 50;

  // IDEA GENIO #2 — venditore ignaro su roba di qualità sottovalutata.
  const venditoreIgnaro = analysis.sellerClueless && tier >= 2 && marginEur >= 100;

  // IDEA GENIO #3 — tesori oscuri (tier 3) passano anche con margine minimo.
  const tesoroOscuro = tier >= 3 && discountVsLow >= 10 && marginEur >= 50;

  // ── DOPPIA FIRMA / QUADRANTE SPECIALE = il pezzo è particolare ──
  // Questi tratti SONO il valore: passano anche con margine piccolo, perché
  // un quadrante doppia-firma o tropicale/gilt vale molto più del normale.
  const haDoppiaFirma = !!(analysis.doubleSigned && analysis.doubleSigned !== 'null' && String(analysis.doubleSigned).toLowerCase() !== 'no');
  const haQuadranteSpeciale = !!(analysis.specialDial && analysis.specialDial !== 'null' && String(analysis.specialDial).toLowerCase() !== 'no');
  const pezzoParticolare = (haDoppiaFirma || haQuadranteSpeciale) && marginEur >= 0;

  // ── ANALISI DA INVESTITORE (medio termine) ──
  // Anche se oggi NON è scontato, se ha forte potenziale di rivalutazione
  // a 3-5 anni (evRating high) e non lo paghi sopra il valore attuale,
  // vale come "da tenere". È l'idea: comprare l'azione sottovalutata.
  const evAlto = analysis.evRating === 'high';
  const investimento = evAlto && marginEur >= 0 &&
    (tier >= 1 || analysis.qualityMovement || analysis.isSleeper || haDoppiaFirma || analysis.isGrail);

  out.isInteresting = idAffidabile && senzaAllarmi && (margineForte || grailScontato || sleeperDiQualita || venditoreIgnaro || tesoroOscuro || pezzoParticolare || investimento);

  // Etichetta forza dell'affare (con boost per i segnali genio).
  // Il margine usato per la forza è limitato a valori CREDIBILI: un flip
  // realistico rende qualche centinaio/migliaio di euro, non 200 mila.
  if (out.isInteresting) {
    const margineCredibile = Math.min(marginEur, 8000); // tetto di plausibilità
    let base = (discountVsLow >= 50 || margineCredibile >= 1500) ? 'FORTE'
             : (discountVsLow >= 40 || margineCredibile >= 600) ? 'BUONO'
             : 'INTERESSANTE';
    // Un venditore ignaro su un tesoro oscuro = sempre FORTE, è l'occasione vera
    if (analysis.sellerClueless && (analysis.sleeperTier||0) >= 2) base = 'FORTE';
    // Doppia firma = sempre almeno BUONO (è roba particolare e ricercata)
    if (haDoppiaFirma && base === 'INTERESSANTE') base = 'BUONO';
    out.dealStrength = base;
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

module.exports = { analyzeListing, isConfigured, getUsage };
