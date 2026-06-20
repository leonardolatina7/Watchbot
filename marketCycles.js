/**
 * ANDAMENTO DI MERCATO PER SEGMENTO — "marketCycles"
 * ───────────────────────────────────────────────────────────────────────────
 * A che serve: NON decide al posto tuo. Aggiunge una RIGA DI CONTESTO accanto
 * allo scoring investitore, così leggi in che fase del ciclo è il segmento di
 * un pezzo PRIMA di comprare. È un aiuto a comprendere il mercato, non un gate.
 *
 * Principio (deciso con Leonardo, giugno 2026):
 *   - Sotto ~2k si ragiona da FLIPPER (velocità, margine, liquidità).
 *   - Sopra ~2k si ragiona da INVESTITORE (traiettoria a 3-5 anni, ciclo del
 *     segmento). MA la soglia NON è un muro: un 2.200 può essere un flip e un
 *     1.800 un hold. Per questo il contesto-ciclo è SOLO informativo e la sua
 *     spinta sullo score è LEGGERA (±1), non determinante.
 *
 * Dati reali alla base (vedi REFERENCES in fondo). I CICLI SI INVERTONO:
 * l'acciaio sportivo un giorno ripartirà. Rivedere e aggiornare `lastUpdated`
 * periodicamente — il bot non deve restare tarato sulla fotografia del 2026.
 * ───────────────────────────────────────────────────────────────────────────
 */

// Data dell'ultima revisione manuale di QUESTI dati di ciclo.
const LAST_UPDATED = '2026-06-19';

// Ogni segmento: come riconoscerlo + in che fase è + spinta leggera sullo score.
//   phase:  'rising' | 'mature' | 'declining' | 'neutral'
//   scoreNudge: intero piccolo (-1..+1) applicato allo scoring investitore
//   label:  riga breve che il bot stampa accanto al punteggio
//   note:   spiegazione che aiuta a capire (mostrata nei dettagli)
const SEGMENTS = [
  {
    id: 'gold_dress_chrono',
    name: 'Oro dress / crono manifattura in oro (anni 50-60)',
    phase: 'rising',
    scoreNudge: +1,
    label: '📊 Oro dress: ciclo in SALITA',
    note: 'Apprezzamento costante e affidabile negli ultimi anni; i crono Longines/Zenith in oro anni 50-60 in rinascita e spesso ancora sottovalutati. Doppio fondamentale: valore orologiero + oro come pavimento.',
    // riconoscimento
    materials: [/\boro\b|18k|750|\bgold\b|18\s*kt/i],
    types: [/dress|crono|chrono/i],
    brandsHint: [/longines|zenith|universal|omega|movado|gallet|excelsior/i],
  },
  {
    id: 'steel_sport_diver_chrono',
    name: 'Acciaio sportivo / diver-chrono vintage',
    phase: 'mature',
    scoreNudge: -1,
    label: '📊 Acciaio sport: ciclo MATURO (prezzi a fine corsa)',
    note: 'Segmento che ha corso fino al picco 2021-22 e poi corretto. Molti pezzi sono già molto valorizzati: si compra vicino alla cima della parabola. Cautela sui prezzi pieni; ottima liquidità ma upside a 3-5 anni più limitato che in passato.',
    materials: [/acciaio|steel|inox/i],
    types: [/diver|sub|sport|crono|chrono/i],
    brandsHint: [/heuer|zenith|breitling|enicar|nivada|aquastar|doxa/i],
  },
  {
    id: 'indie_modern',
    name: 'Indipendenti moderni',
    phase: 'rising',
    scoreNudge: +1,
    label: '📊 Indie moderni: domanda in CRESCITA',
    note: 'Le "azioni growth" dell\'orologeria: flottante minuscolo, community in espansione. Ogni esemplare usato a prezzo ≤ mercato è un\'occasione.',
    materials: [],
    types: [],
    brandsHint: [/czapek|journe|akrivia|rexhepi|urwerk|atelier wen/i],
    indieByBrandOnly: true,
  },
];

// Contesto di mercato (note di sfondo, non legate al singolo pezzo).
const CONTEXT = [
  'Quota vendite dress watch +44% tra la Gen Z dal 2018 al 2025 (vs ~29% medio).',
  'Domanda di orologi vintage in oro +25% nel 2024-2025, spinta da incertezza economica e investimento di lusso.',
  'Steel sportivo: picco 2021-22 poi correzione; oro dress in traiettoria inversa, salita costante.',
  'Longines/Zenith crono in oro anni 50-60: rinascita tra i collezionisti, molti ancora sottovalutati.',
];

/**
 * Classifica un pezzo in un segmento di ciclo.
 * Input: { brand, type, material } (qualunque può mancare).
 * type = es. 'diver', 'chrono', 'dress' (puoi passare model/caliber liberi).
 * Ritorna l'oggetto segmento + match, oppure un segmento 'neutral' di default.
 */
function classify({ brand = '', type = '', material = '' } = {}) {
  const b = String(brand || '').toLowerCase();
  const ty = String(type || '').toLowerCase();
  const ma = String(material || '').toLowerCase();

  for (const seg of SEGMENTS) {
    // Indie: scatta SOLO sul brand-hint (sono pochi nomi precisi), mai a strascico.
    if (seg.indieByBrandOnly) {
      if (seg.brandsHint.some(rx => rx.test(b))) return { matched: true, ...seg };
      continue;
    }
    const matMatch  = seg.materials.length ? seg.materials.some(rx => rx.test(ma)) : false;
    const typeMatch = seg.types.length ? seg.types.some(rx => rx.test(ty)) : false;
    const brandMatch = (seg.brandsHint || []).some(rx => rx.test(b));
    // Segmento ORO: il materiale oro VERO è vincolo obbligatorio (il brand da
    // solo non basta — uno Zenith in acciaio non è "oro dress").
    if (seg.id === 'gold_dress_chrono') {
      if (matMatch && (typeMatch || brandMatch)) return { matched: true, ...seg };
      continue;
    }
    // Altri segmenti (es. acciaio sport): materiale+tipo, o brand-hint forte col tipo.
    if ((matMatch && typeMatch) || (brandMatch && matMatch)) {
      return { matched: true, ...seg };
    }
  }
  return {
    matched: false,
    id: 'neutral',
    name: 'Segmento non classificato',
    phase: 'neutral',
    scoreNudge: 0,
    label: '📊 Ciclo di segmento: neutro',
    note: 'Nessun segnale di ciclo forte per questo pezzo: valuta sui soli fondamentali.',
  };
}

/**
 * Spinta leggera sullo score investitore in base al ciclo del segmento.
 * Volutamente piccola (-1..+1): il ciclo INFORMA, non comanda.
 */
function scoreNudge(item) {
  return classify(item).scoreNudge || 0;
}

/** Riga di contesto pronta da stampare accanto allo scoring. */
function contextLine(item) {
  const seg = classify(item);
  return seg.label;
}

/** Dettaglio completo (per /api/diagnostica o messaggi estesi). */
function describe(item) {
  const seg = classify(item);
  return {
    segment: seg.name,
    phase: seg.phase,
    label: seg.label,
    note: seg.note,
    nudge: seg.scoreNudge,
    lastUpdated: LAST_UPDATED,
  };
}

function getContext() {
  return { lastUpdated: LAST_UPDATED, segments: SEGMENTS.map(s => ({ id: s.id, name: s.name, phase: s.phase, label: s.label })), context: CONTEXT };
}

module.exports = { classify, scoreNudge, contextLine, describe, getContext, LAST_UPDATED };

/* ───────────────────────────────────────────────────────────────────────────
 * REFERENCES (dati raccolti il 2026-06-19, da rivedere periodicamente):
 * - Acciaio sportivo: picco 2021-22, poi correzione triennale.
 * - Oro dress vintage: salita costante; pezzo da ~6-7k (3 anni fa) → ~10-12k oggi.
 * - Dress share Gen Z: +44% (2018-2025). Domanda oro vintage: +25% (2024-25).
 * - Longines 30CH (flyback, manifattura, erede del 13ZN) e crono oro Zenith:
 *   rinascita tra i collezionisti, ancora sottovalutati rispetto a heritage.
 * AGGIORNARE `LAST_UPDATED` ad ogni revisione di questi numeri.
 * ─────────────────────────────────────────────────────────────────────────── */
