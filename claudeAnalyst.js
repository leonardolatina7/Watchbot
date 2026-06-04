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
 * Analizza un singolo annuncio.
 * Ritorna: { isInteresting, brand, model, caliber, material, valueLow,
 *            valueHigh, reasoning, confidence } oppure null se non configurato/errore.
 */
async function analyzeListing(title, priceEur) {
  if (!isConfigured()) return null;
  if (!title) return null;

  // Cache hit
  const key = cacheKey(title);
  if (cache.has(key)) {
    const cached = cache.get(key);
    // ricalcola solo il giudizio "occasione" col prezzo attuale
    return evaluateWithPrice(cached, priceEur);
  }

  if (!quotaOk()) {
    console.warn('[CLAUDE] Limite giornaliero raggiunto, salto analisi');
    return null;
  }

  const prompt = `Sei un esperto di orologi vintage e da collezione. Analizza questo annuncio e rispondi SOLO con un oggetto JSON, senza testo prima o dopo, senza backtick.

Annuncio: "${title}"

Rispondi con questo formato esatto:
{
  "brand": "marca identificata o null",
  "model": "modello/referenza identificata o null",
  "caliber": "calibro probabile o null se non determinabile",
  "material": "oro 18k / acciaio / oro cappato / platino / sconosciuto",
  "valueLow": numero in EUR (stima minima mercato secondario, condizioni medie) o null,
  "valueHigh": numero in EUR (stima massima) o null,
  "desirability": numero 1-10 (quanto è ricercato dai collezionisti),
  "isGrail": true/false (è un pezzo iconico molto richiesto),
  "redFlags": "eventuali campanelli d'allarme dal titolo (rid ipinto, parti non originali, troppo economico per essere vero) o null",
  "reasoning": "una frase sul perché è o non è interessante",
  "confidence": "high/medium/low (quanto sei sicuro dell'identificazione dal solo titolo)"
}

Regole:
- Se il titolo è troppo vago per identificare il modello, metti confidence "low" e valori null.
- Le stime di valore sono indicative di mercato secondario, non quotazioni precise.
- Considera che vedi solo il titolo, non le foto: sii prudente.`;

  try {
    usage.count++;
    const r = await axios.post(API_URL, {
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      timeout: 20000,
    });

    // Estrai il testo della risposta
    let text = '';
    for (const block of (r.data.content || [])) {
      if (block.type === 'text') text += block.text;
    }
    // Pulisci eventuali backtick e parse
    text = text.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { console.error('[CLAUDE] Risposta non JSON:', text.slice(0, 100)); return null; }

    // Salva in cache (senza il giudizio prezzo, che dipende dal prezzo del momento)
    if (cache.size >= CACHE_MAX) { cache.clear(); } // svuota se troppo grande
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
  // Margine reale: sconto di almeno il 35%, OPPURE margine assoluto ≥600€
  // ma SOLO se c'è comunque almeno un 25% di sconto (evita sconti minimi
  // su pezzi costosi che in % sono irrisori).
  const margineForte = discountVsLow >= 35 || (marginEur >= 600 && discountVsLow >= 25);
  // I grail molto sotto prezzo passano anche con margine un po' più basso
  const grailScontato = analysis.isGrail && discountVsLow >= 20;

  out.isInteresting = idAffidabile && senzaAllarmi && (margineForte || grailScontato);

  // Etichetta forza dell'affare
  if (out.isInteresting) {
    out.dealStrength = (discountVsLow >= 50 || marginEur >= 1000) ? 'FORTE'
                     : (discountVsLow >= 40 || marginEur >= 600) ? 'BUONO'
                     : 'INTERESSANTE';
  }
  return out;
}

module.exports = { analyzeListing, isConfigured, getUsage };
