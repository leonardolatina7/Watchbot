// genericQueries.js
// RETE LARGA — query generiche per intercettare le inserzioni di chi NON sa cosa ha.
// Qui non si cerca per marca: si cerca per "orologio qualunque" e poi setaccia blindHunter.js.
// Tetto prezzo gestito a valle (FLIP_CIECO_MAX). Categoria orologi gestita dai singoli scraper.

module.exports = {
  // Soglia massima di prezzo acquisto per la zona flip cieco (override via env FLIP_CIECO_MAX)
  FLIP_CIECO_MAX: Number(process.env.FLIP_CIECO_MAX || 150),

  // Banda "look": sopra il tetto flip ma ancora da guardare/trattare (e mai scartare le
  // marche con variante pregiata). Mettilo = FLIP_CIECO_MAX per disattivare la banda.
  FLIP_CIECO_LOOK: Number(process.env.FLIP_CIECO_LOOK || 220),

  // Quante inserzioni al massimo mandare alla vision per ciclo (protegge i limiti free di Groq)
  VISION_BUDGET: Number(process.env.VISION_BUDGET || 25),

  queries: {
    // ---- ITALIA / Subito ----
    subito: [
      "orologio vintage uomo",
      "orologio svizzero vintage",
      "orologio automatico vecchio",
      "orologio carica manuale uomo",
      "orologio meccanico vintage",
      "orologio acciaio anni 60",
      "orologio polso vecchio",
      "orologio da revisionare",
      "orologio non funzionante meccanico",
      "lotto orologi",
      "stock orologi vintage",
      "orologio eredita nonno"
    ],
    // ---- GERMANIA / eBay DE (qui l'oro a poco e i venditori ignari) ----
    ebay_de: [
      "alte armbanduhr herren",
      "armbanduhr handaufzug herren",
      "armbanduhr automatik vintage",
      "armbanduhr konvolut",
      "armbanduhr sammlung defekt",
      "herrenuhr swiss made alt"
    ],
    // ---- FRANCIA / eBay FR ----
    ebay_fr: [
      "montre ancienne homme",
      "montre mecanique vintage",
      "montre remontage manuel",
      "montre automatique ancienne",
      "lot montres anciennes"
    ],
    // ---- NL / Marktplaats ----
    marktplaats: [
      "vintage horloge heren",
      "oud horloge mechanisch",
      "horloge handopwind",
      "horloge partij"
    ]
  }
};
