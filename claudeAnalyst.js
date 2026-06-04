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
const DAILY_LIMIT = parseInt(process.env.CLAUDE_DAILY_LIMIT || '300'); // max analisi/giorno
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
  "isWatch": true/false (è un orologio da polso/tasca vero? false se cinturino/scatola/accessorio/falso),
  "condition": "${hasImage ? 'condizioni in foto: ottime/buone/discrete/scarse o null' : 'null'}",
  "isSleeper": true/false (è uno di quei marchi di QUALITÀ ma SOTTOVALUTATI con potenziale di salita?),
  "qualityMovement": true/false (monta un calibro di qualità: manifattura, cronometro, o crono Valjoux/Venus/Lemania/Excelsior Park?),
  "valueLow": numero EUR (stima minima mercato attuale) o null,
  "valueHigh": numero EUR (stima massima) o null,
  "desirability": numero 1-10 (quanto è ricercato dai conoscitori),
  "isGrail": true/false,
  "redFlags": "campanelli d'allarme o null",
  "reasoning": "una frase: perché è (o non è) un affare interessante, citando il calibro/qualità se rilevante",
  "confidence": "high/medium/low"
}

Regole:
- Se NON è un orologio, isWatch false e confidence low.
- Premia i marchi sottovalutati di qualità (isSleeper true) e i bei calibri (qualityMovement true): sono il bersaglio.
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
  // I "gioielli dimenticati" di qualità passano anche con margine un po'
  // più basso: sono il bersaglio della strategia (qualità + potenziale).
  const sleeperDiQualita = (analysis.isSleeper || analysis.qualityMovement) && discountVsLow >= 15 && marginEur >= 50;

  out.isInteresting = idAffidabile && senzaAllarmi && (margineForte || grailScontato || sleeperDiQualita);

  // Etichetta forza dell'affare
  if (out.isInteresting) {
    out.dealStrength = (discountVsLow >= 50 || marginEur >= 1000) ? 'FORTE'
                     : (discountVsLow >= 40 || marginEur >= 600) ? 'BUONO'
                     : 'INTERESSANTE';
  }
  return out;
}

module.exports = { analyzeListing, isConfigured, getUsage };
