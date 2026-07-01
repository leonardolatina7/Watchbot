// ============================================================================
//  visionEngine.js — MOTORE AI UNICO MULTI-PROVIDER (Gemini → Groq fallback)
// ----------------------------------------------------------------------------
//  Perché esiste:
//    - Groq free tier dà 429 RATE-LIMIT AL MINUTO: durante uno scan con decine
//      di query l'AI viene respinta e il bot resta senza verdetti/lettura foto.
//    - Il modello vision Groq (llama-4-scout) è in DEPRECAZIONE.
//    - Gemini Flash (Google AI Studio) ha free tier più generoso (~1.500 req/gg
//      + 1M token/min), vede bene le foto, non è in deprecazione.
//
//  Strategia: PROVA GEMINI PER PRIMO. Se Gemini è assente (niente chiave),
//  fallisce o è a quota, RIPIEGA su Groq. Vale sia per il TESTO (analisi coi
//  3 scenari) sia per la VISION (lettura marca/quadrante da foto).
//
//  Due funzioni pubbliche:
//    textComplete(prompt, {maxTokens, temperature, jsonMode})   -> string | null
//    visionComplete(imageUrl, prompt, {maxTokens, temperature}) -> string | null
//  Ritornano SEMPRE il testo grezzo della risposta (o null). Il parsing JSON
//  lo fa il chiamante (claudeAnalyst / blindHunter), che già lo faceva.
//
//  Config via env (Render):
//    GEMINI_API_KEY        chiave Google AI Studio (aistudio.google.com, gratis)
//    GEMINI_MODEL          default 'gemini-2.0-flash'
//    GROQ_API_KEY          chiave Groq (fallback testo + vision)
//    GROQ_MODEL            default 'openai/gpt-oss-120b'          (testo)
//    GROQ_VISION_MODEL     default 'meta-llama/llama-4-scout-17b-16e-instruct' (vision)
//    AI_MIN_INTERVAL_MS    distanza minima tra chiamate (anti-429), default 1200
// ============================================================================
const axios = require('axios');

const GEMINI_KEY   = process.env.GEMINI_API_KEY || null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GROQ_KEY     = process.env.GROQ_API_KEY || null;
const GROQ_MODEL   = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_VISION  = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const GEMINI_URL = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';

// ── Throttle globale (una sola coda per tutte le chiamate AI del bot) ──
const MIN_INTERVAL_MS = parseInt(process.env.AI_MIN_INTERVAL_MS || '1200');
let _lastCall = 0;
const _sleep = ms => new Promise(r => setTimeout(r, ms));
async function _throttle() {
  const wait = _lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await _sleep(wait);
  _lastCall = Date.now();
}

// ── Contatori d'uso (visibili via getStats, utile per /api/status) ──
const stats = { geminiOk: 0, geminiFail: 0, groqOk: 0, groqFail: 0, groq429: 0 };
function getStats() {
  return {
    ...stats,
    geminiConfigured: !!GEMINI_KEY,
    groqConfigured: !!GROQ_KEY,
    geminiModel: GEMINI_MODEL,
    groqTextModel: GROQ_MODEL,
    groqVisionModel: GROQ_VISION,
  };
}
function isConfigured() { return !!GEMINI_KEY || !!GROQ_KEY; }

// ── Scarica un'immagine e la converte in base64 (per Gemini inline_data e Groq) ──
async function fetchImageBase64(imageUrl) {
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) return null;
  try {
    const r = await axios.get(imageUrl, {
      responseType: 'arraybuffer', timeout: 10000,
      maxContentLength: 4 * 1024 * 1024,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const ct = r.headers['content-type'] || 'image/jpeg';
    let mediaType = 'image/jpeg';
    if (ct.includes('png')) mediaType = 'image/png';
    else if (ct.includes('webp')) mediaType = 'image/webp';
    else if (ct.includes('gif')) mediaType = 'image/gif';
    return { mediaType, base64: Buffer.from(r.data, 'binary').toString('base64') };
  } catch { return null; }
}

// ============================================================================
//  GEMINI
// ============================================================================
async function geminiCall(parts, { maxTokens = 1200, temperature = 0.2, jsonMode = false } = {}) {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const r = await axios.post(GEMINI_URL(GEMINI_MODEL), body, {
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    timeout: 30000,
  });
  // La risposta sta in candidates[0].content.parts[*].text
  const cand = r.data?.candidates?.[0];
  const txt = (cand?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!txt) throw new Error('Gemini: risposta vuota');
  return txt;
}

// ============================================================================
//  GROQ (formato OpenAI chat-completions)
// ============================================================================
async function groqCall(messages, model, { maxTokens = 1200, temperature = 0.2, jsonMode = false } = {}) {
  const body = {
    model, temperature, max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    messages,
  };
  const r = await axios.post(GROQ_URL, body, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    timeout: 30000,
  });
  const txt = (r.data?.choices?.[0]?.message?.content || '').trim();
  if (!txt) throw new Error('Groq: risposta vuota');
  return txt;
}

// Groq con retry sul 429 (rate-limit al minuto): aspetta e riprova UNA volta.
async function groqCallWithRetry(messages, model, opts) {
  try {
    return await groqCall(messages, model, opts);
  } catch (e) {
    if (e.response?.status === 429) {
      stats.groq429++;
      const ra = parseFloat(e.response.headers?.['retry-after']);
      const waitMs = (ra && !isNaN(ra)) ? Math.min(ra * 1000, 15000) : 8000;
      console.error(`[visionEngine] Groq 429: attendo ${Math.round(waitMs/1000)}s e riprovo…`);
      await _sleep(waitMs);
      _lastCall = 0;
      return await groqCall(messages, model, opts);
    }
    throw e;
  }
}

// ============================================================================
//  API PUBBLICA
// ============================================================================

/**
 * TESTO — analisi/ragionamento (es. i 3 scenari di claudeAnalyst).
 * Prova Gemini, poi Groq. Ritorna il testo grezzo della risposta o null.
 */
async function textComplete(prompt, opts = {}) {
  const o = { maxTokens: 1200, temperature: 0.2, jsonMode: true, ...opts };

  if (GEMINI_KEY) {
    try {
      await _throttle();
      const out = await geminiCall([{ text: prompt }], o);
      stats.geminiOk++;
      return out;
    } catch (e) {
      stats.geminiFail++;
      console.error('[visionEngine] Gemini testo fallito:', e.response?.status || '', e.message, '→ fallback Groq');
    }
  }

  if (GROQ_KEY) {
    try {
      await _throttle();
      const out = await groqCallWithRetry([{ role: 'user', content: prompt }], GROQ_MODEL, o);
      stats.groqOk++;
      return out;
    } catch (e) {
      stats.groqFail++;
      console.error('[visionEngine] Groq testo fallito:', e.response?.status || '', e.message);
    }
  }
  return null;
}

/**
 * VISION — legge marca/quadrante da una foto.
 * Prova Gemini (multimodale), poi Groq vision. Ritorna il testo grezzo o null.
 */
async function visionComplete(imageUrl, prompt, opts = {}) {
  const o = { maxTokens: 400, temperature: 0, jsonMode: true, ...opts };
  const img = await fetchImageBase64(imageUrl);
  if (!img) return null; // foto non scaricabile: niente vision

  if (GEMINI_KEY) {
    try {
      await _throttle();
      const parts = [
        { text: prompt },
        { inline_data: { mime_type: img.mediaType, data: img.base64 } },
      ];
      const out = await geminiCall(parts, o);
      stats.geminiOk++;
      return out;
    } catch (e) {
      stats.geminiFail++;
      console.error('[visionEngine] Gemini vision fallito:', e.response?.status || '', e.message, '→ fallback Groq');
    }
  }

  if (GROQ_KEY) {
    try {
      await _throttle();
      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.base64}` } },
        ],
      }];
      const out = await groqCallWithRetry(messages, GROQ_VISION, o);
      stats.groqOk++;
      return out;
    } catch (e) {
      stats.groqFail++;
      console.error('[visionEngine] Groq vision fallito:', e.response?.status || '', e.message);
    }
  }
  return null;
}

// ── Helper: estrae un oggetto JSON dal testo grezzo (tollerante a backtick/preamboli) ──
function parseJsonLoose(text) {
  if (!text) return null;
  let t = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

module.exports = {
  textComplete,
  visionComplete,
  parseJsonLoose,
  fetchImageBase64,
  getStats,
  isConfigured,
};
