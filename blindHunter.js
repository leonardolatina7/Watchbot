// blindHunter.js
// SETACCIO a 3 cancelli per il flip cieco.
// A) testo (gratis)  B) vision Groq (sui sopravvissuti)  C) lookup marca -> gemma/verifica.
// Allineato ai punti: vincolo originalita (redial), prudenza famosi, moderni a -60% listino.

const axios = require("axios");
const { FLIP_CIECO_MAX, FLIP_CIECO_LOOK, VISION_BUDGET } = require("./genericQueries");
const { lookupBrand } = require("./brandValue");

// Modello vision Groq (legge la marca dalla foto). Id corrente: scout di Llama 4,
// quello indicato dai docs Groq per OCR/immagini (giu 2026). Override con env
// GROQ_VISION_MODEL su Render. Se un domani torna 400/404 = modello rimosso:
// apri console.groq.com/docs/models, prendi il vision/multimodale attivo e
// aggiorna la env. Il bot non si rompe: il flip cieco semplicemente non spara.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_KEY = process.env.GROQ_API_KEY;

// ---------- CANCELLO A: punteggio testo ----------
const POS = [
  [/\bcarica manuale\b|\bhandaufzug\b|\bremontage manuel\b|\bmanual wind\b/i, 3],
  [/\bautomatic\w*|\bautomatik\b/i, 2],
  [/\bswiss made\b|\bsuisse\b|\bsvizzer\w+/i, 2],
  [/\b(15|17|21|23)\s*(rubini|jewels|rubis|steine)\b/i, 3],
  [/\bincabloc\b/i, 2],
  [/\bacciaio\b|\binox\b|\bsteel\b|\bedelstahl\b/i, 1],
  [/\bplacca\w+|\bplaqu[eé]\b|\bgold ?filled\b|\blamin\w+|\bcappato\b/i, 1],
  [/\boro\b|\bgold\b|\b18k\b|\b14k\b|\b750\b|\b585\b/i, 2],
  [/\banni\s*['’]?\s*(40|50|60|70)\b|\b19[4567]\d\b/i, 2],
  [/\bvintage\b|\bd['’ ]?epoca\b|\bancien\w*|\bvecchio\b|\balt\w+\b/i, 1],
  [/\bfondello a vite\b|\bscrew\s?back\b/i, 1],
  [/\b(non funziona|da revisionare|da sistemare|defekt|fermo|ferma)\b/i, 2] // ignaro + economico
];
const KILL = /\b(quarzo|quartz|batter\w+|casio|swatch|daniel wellington|fossil|smartwatch|digitale|silicone|replica|fashion|bambino|kids|44 ?mm|45 ?mm|46 ?mm|48 ?mm)\b/i;

function textScore(listing) {
  const t = `${listing.title || ""} ${listing.description || ""}`;
  if (KILL.test(t)) return { score: -99, kill: true };
  let s = 0;
  for (const [re, w] of POS) if (re.test(t)) s += w;
  // se nel testo c'e' gia' una marca nota -> bonus (a volte e' nella descrizione, non nel titolo)
  if (lookupBrand(t)) s += 2;
  return { score: s, kill: false };
}

// ---------- CANCELLO B: vision Groq ----------
const VISION_PROMPT =
  "Sei un perito di orologi vintage. Guarda la foto e leggi SOLO cio' che vedi davvero. " +
  "Rispondi in JSON con: testo_quadrante (tutte le scritte sul quadrante), marca (se leggibile, altrimenti null), " +
  "calibro (se visibile movimento, altrimenti null), redial (true se la stampa sembra rifatta/troppo netta per l'eta'), " +
  "materiale (acciaio/oro/placcato/sconosciuto), diametro_stimato_mm, confidenza (0-1). " +
  "Nessun testo fuori dal JSON.";

async function visionIdentify(imageUrl) {
  if (!GROQ_KEY || !imageUrl) return null;
  try {
    const r = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
      model: GROQ_VISION_MODEL,
      temperature: 0,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }]
    }, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      timeout: 20000
    });
    let raw = r.data?.choices?.[0]?.message?.content || "";
    raw = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[blindHunter] vision errore:", e.response?.status || "", e.message);
    return null;
  }
}

// ---------- CANCELLO C: classificazione a 3 livelli ----------
// 💎 gemma  = prezzo <= tetto d'acquisto (flip chiaro)
// 👀 guarda = sopra il tetto ma sotto la banda look, OPPURE marca con variante
//             pregiata (mai scartare alla cieca: potrebbe essere il crono che vale 10x)
// ⚠️ verifica = marca famosa/falsificata
function classify(listing, vis, opts = {}) {
  const flipMax = opts.flipMax ?? FLIP_CIECO_MAX;
  const lookMax = opts.lookMax ?? FLIP_CIECO_LOOK;
  const blob = `${vis?.marca || ""} ${vis?.testo_quadrante || ""}`;
  const hit = lookupBrand(blob);
  if (!hit) return null;

  const price = Number(listing.price) || 0;
  if (price <= 0) return null;

  if (hit.kind === "verifica") {
    return { tipo: "verifica", marca: hit.key, prezzo: price, nota: hit.note,
             redial: !!vis?.redial, confidenza: vis?.confidenza ?? null };
  }

  const buyCeiling = hit.buy?.[1] ?? flipMax;
  const sellLo = hit.sell?.[0] ?? 0;
  const base = {
    marca: hit.key, prezzo: price, acquisto_zona: hit.buy, vendita_zona: hit.sell,
    liquidita: hit.liq, redial: !!vis?.redial, materiale: vis?.materiale || null,
    diametro: vis?.diametro_stimato_mm || null, confidenza: vis?.confidenza ?? null,
    nota: hit.note, calibro: vis?.calibro || null, variante: hit.variant || null
  };

  // 1) SOTTO COSTO -> gemma (flip)
  if (price <= Math.min(buyCeiling, flipMax)) {
    return Object.assign({ tipo: "gemma", margine_stimato: sellLo - price }, base);
  }
  // 2) DA GUARDARE/TRATTARE -> sopra il tetto ma entro banda look, o marca con variante
  if (hit.variant || price <= lookMax) {
    return Object.assign({ tipo: "guarda", tratta_sotto: buyCeiling }, base);
  }
  // 3) sopra banda e senza variante -> scarta
  return null;
}

// ---------- ORCHESTRATORE ----------
// listings: [{id,title,description,price,imageUrl,url,source}]
// ritorna { gemme:[...], guarda:[...], verifiche:[...], visionUsate:n, ...conteggi }
async function huntGems(listings, opts = {}) {
  const flipMax = opts.flipMax ?? FLIP_CIECO_MAX;
  const lookMax = opts.lookMax ?? FLIP_CIECO_LOOK;
  const budget = opts.visionBudget ?? VISION_BUDGET;
  const minScore = opts.minScore ?? 3;
  const seen = opts.seen || new Set();   // riusa la blacklist persistente: niente doppie vision

  // 1) prezzo (fino alla banda look) + 2) cancello A testo.
  // SELEZIONE: non solo il punteggio testo, ma un BLEND col prezzo basso — la gemma
  // vive nell'annuncio economico del venditore ignaro. Piu' e' sotto FLIP_CIECO_MAX,
  // piu' sale in cima (priceBonus). Cosi' la vision (budget limitato) la spendiamo
  // sui pezzi giusti, non sugli annunci piu' "verbosi".
  const candidati = listings
    .filter(l => Number(l.price) > 0 && Number(l.price) <= lookMax && !seen.has(l.id))
    .map(l => {
      const sc = textScore(l);
      const price = Number(l.price) || 0;
      const priceBonus = Math.max(0, Math.round((flipMax - Math.min(price, flipMax)) / 15));
      return { l, sc, rank: sc.score + priceBonus };
    })
    .filter(x => !x.sc.kill && x.sc.score >= minScore)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, budget);

  const gemme = [], guarda = [], verifiche = [];
  let visionUsate = 0, conMarca = 0, senzaMarca = 0, vuoteErrore = 0;

  for (const { l } of candidati) {
    seen.add(l.id);
    const vis = await visionIdentify(l.imageUrl);
    visionUsate++;
    if (!vis) { vuoteErrore++; continue; }

    // diagnostica: COSA ha letto la vista, per capire se "non trova" o "scarta giusto"
    const marcaLetta = String(vis.marca || "").trim();
    const dial = String(vis.testo_quadrante || "").replace(/\s+/g, " ").slice(0, 32);
    if (marcaLetta || dial) conMarca++; else senzaMarca++;
    console.log(`[flip cieco] vista €${l.price} | marca:${marcaLetta || "—"} | "${dial}"`);

    const r = classify(l, vis, { flipMax, lookMax });
    if (!r) continue;
    r.url = l.url; r.id = l.id; r.source = l.source; r.titolo = l.title;
    if (r.tipo === "gemma") gemme.push(r);
    else if (r.tipo === "guarda") guarda.push(r);
    else verifiche.push(r);
  }
  console.log(`[flip cieco] resa vision: lette ${visionUsate}, con-testo-quadrante ${conMarca}, vuote ${senzaMarca}, errore/null ${vuoteErrore} → gemme ${gemme.length}, guarda ${guarda.length}, verifiche ${verifiche.length}`);
  return { gemme, guarda, verifiche, visionUsate, conMarca, senzaMarca, vuoteErrore };
}

// Messaggi Telegram pronti
function formatGemma(g) {
  const rd = g.redial ? "  ⚠️ sospetto REDIAL (ok flip se costa poco, MAI investimento)" : "";
  const conf = g.confidenza != null ? ` · conf ${Math.round(g.confidenza * 100)}%` : "";
  return (
    `💎 GEMMA NASCOSTA — ${String(g.marca).toUpperCase()}${conf}\n` +
    `Prezzo: €${g.prezzo}  →  rivendita stimata €${g.vendita_zona?.[0]}-${g.vendita_zona?.[1]}\n` +
    `Margine lordo ~€${g.margine_stimato} · liquidita ${g.liquidita}${rd}\n` +
    (g.calibro ? `Calibro letto: ${g.calibro}\n` : "") +
    `${g.nota}\n${g.url}`
  );
}

function formatGuarda(g) {
  const conf = g.confidenza != null ? ` · conf ${Math.round(g.confidenza * 100)}%` : "";
  const varLine = g.variante ? `\n⚠️ VARIANTE: ${g.variante}` : "";
  return (
    `👀 GUARDA / TRATTA — ${String(g.marca).toUpperCase()}${conf}\n` +
    `Prezzo: €${g.prezzo} (sopra il tetto flip). Rivendita ~€${g.vendita_zona?.[0]}-${g.vendita_zona?.[1]}.\n` +
    `Comune: nessun margine a questo prezzo → tratta sotto €${g.tratta_sotto}.${varLine}\n` +
    `${g.nota}\n${g.url}`
  );
}

module.exports = { huntGems, textScore, visionIdentify, classify, formatGemma, formatGuarda, GROQ_VISION_MODEL };
