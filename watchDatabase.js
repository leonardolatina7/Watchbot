/**
 * Database completo orologi in oro 18k
 * Include: marchi famosi, marchi minori, vintage, generici
 * + dati storici di rivalutazione/svalutazione
 */

// ─────────────────────────────────────────────────────────────
// FORMATO:
// goldGrams: grammi di ORO PURO (già calcolato al 75% per 18k)
// trend: % media annua di variazione prezzo (+ = sale, - = scende)
// trendLabel: descrizione del trend
// rarity: 'common' | 'rare' | 'very_rare'
// searchTerms: termini aggiuntivi per trovarlo sulle piattaforme
// ─────────────────────────────────────────────────────────────

const WATCH_DATABASE = {

  // ══════════════════════════════════════════════════════
  // ROLEX
  // ══════════════════════════════════════════════════════
  "rolex day-date 40 yellow gold":       { goldGrams: 36.45, trend: +12.5, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["rolex day-date 40 yellow", "rolex 228238"] },
  "rolex day-date 40 white gold":        { goldGrams: 36.45, trend: +10.2, trendLabel: "📈 rivalutazione",      rarity: "rare",      searchTerms: ["rolex day-date 40 white gold", "rolex 228239"] },
  "rolex day-date 40 rose gold":         { goldGrams: 36.45, trend: +11.8, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["rolex day-date 40 everose", "rolex 228235"] },
  "rolex day-date 36 yellow gold":       { goldGrams: 33.15, trend: +9.5,  trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["rolex day-date 36 118238", "rolex 128238"] },
  "rolex daytona yellow gold":           { goldGrams: 37.58, trend: +18.3, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["rolex daytona gold 116508", "rolex daytona 126508"] },
  "rolex daytona white gold":            { goldGrams: 37.58, trend: +15.7, trendLabel: "🔥 forte rivalutazione", rarity: "very_rare", searchTerms: ["rolex daytona white gold 116509", "126529"] },
  "rolex submariner yellow gold":        { goldGrams: 41.78, trend: +14.2, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["rolex submariner gold 116618", "126618"] },
  "rolex gmt-master ii yellow gold":     { goldGrams: 39.23, trend: +13.6, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["rolex gmt master gold 116718", "126718"] },
  "rolex sky-dweller yellow gold":       { goldGrams: 44.10, trend: +8.9,  trendLabel: "📈 rivalutazione",      rarity: "rare",      searchTerms: ["rolex sky-dweller gold 326938"] },
  "rolex yacht-master 40 yellow gold":   { goldGrams: 36.90, trend: +7.2,  trendLabel: "📈 lieve rivalutazione", rarity: "common",   searchTerms: ["rolex yacht-master gold 16628", "126625"] },
  "rolex datejust 41 yellow gold":       { goldGrams: 28.50, trend: +4.1,  trendLabel: "➡️ stabile",            rarity: "common",    searchTerms: ["rolex datejust 41 yellow gold 126333"] },
  "rolex cellini time yellow gold":      { goldGrams: 26.25, trend: -3.2,  trendLabel: "📉 lieve svalutazione", rarity: "common",    searchTerms: ["rolex cellini 50505 gold"] },

  // ══════════════════════════════════════════════════════
  // PATEK PHILIPPE
  // ══════════════════════════════════════════════════════
  "patek philippe nautilus yellow gold": { goldGrams: 64.50, trend: +28.5, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["patek nautilus 5711 gold", "patek 5726"] },
  "patek philippe aquanaut yellow gold": { goldGrams: 43.50, trend: +22.1, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["patek aquanaut gold 5167R", "5167J"] },
  "patek philippe calatrava yellow gold":{ goldGrams: 21.00, trend: +6.3,  trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["patek calatrava 5196J", "5127J", "5227J"] },
  "patek philippe grand complications":  { goldGrams: 38.00, trend: +19.4, trendLabel: "🔥 forte rivalutazione", rarity: "very_rare", searchTerms: ["patek 5270 gold", "patek 5204 gold"] },
  "patek philippe annual calendar gold": { goldGrams: 32.00, trend: +12.8, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["patek 5205R", "patek 5396R annual calendar"] },

  // ══════════════════════════════════════════════════════
  // AUDEMARS PIGUET
  // ══════════════════════════════════════════════════════
  "audemars piguet royal oak yellow gold":         { goldGrams: 60.00, trend: +24.7, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["AP royal oak gold 15202BA", "15300BA"] },
  "audemars piguet royal oak offshore yellow gold":{ goldGrams: 71.25, trend: +16.3, trendLabel: "🔥 forte rivalutazione", rarity: "very_rare", searchTerms: ["AP royal oak offshore gold 26470BA"] },
  "audemars piguet millenary gold":                { goldGrams: 38.00, trend: +5.2,  trendLabel: "📈 lieve rivalutazione", rarity: "rare",      searchTerms: ["AP millenary gold 15350BA"] },

  // ══════════════════════════════════════════════════════
  // CARTIER
  // ══════════════════════════════════════════════════════
  "cartier santos yellow gold":      { goldGrams: 31.50, trend: +6.8,  trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["cartier santos large gold", "cartier santos 100 gold"] },
  "cartier tank louis yellow gold":  { goldGrams: 22.50, trend: +5.4,  trendLabel: "📈 lieve rivalutazione", rarity: "common",    searchTerms: ["cartier tank louis gold", "cartier tank YG"] },
  "cartier ballon bleu yellow gold": { goldGrams: 28.50, trend: +4.9,  trendLabel: "➡️ stabile",            rarity: "common",    searchTerms: ["cartier ballon bleu gold 42mm"] },
  "cartier panthere yellow gold":    { goldGrams: 26.25, trend: +8.3,  trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["cartier panthere gold medium"] },
  "cartier crash yellow gold":       { goldGrams: 18.00, trend: +31.0, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["cartier crash gold yellow"] },
  "cartier tank cintrée yellow gold":{ goldGrams: 20.00, trend: +12.5, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["cartier tank cintree gold"] },

  // ══════════════════════════════════════════════════════
  // VACHERON CONSTANTIN
  // ══════════════════════════════════════════════════════
  "vacheron constantin overseas yellow gold":         { goldGrams: 58.50, trend: +14.2, trendLabel: "🔥 forte rivalutazione", rarity: "rare",      searchTerms: ["vacheron overseas gold 4500V"] },
  "vacheron constantin traditionnelle yellow gold":   { goldGrams: 21.75, trend: +7.6,  trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["vacheron traditionnelle gold"] },
  "vacheron constantin patrimony yellow gold":        { goldGrams: 19.50, trend: +6.1,  trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["vacheron patrimony gold 81180"] },

  // ══════════════════════════════════════════════════════
  // IWC
  // ══════════════════════════════════════════════════════
  "iwc portugieser yellow gold":         { goldGrams: 25.50, trend: +5.2, trendLabel: "📈 lieve rivalutazione", rarity: "common",  searchTerms: ["IWC portugieser gold IW500704"] },
  "iwc portofino yellow gold":           { goldGrams: 22.00, trend: +2.8, trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["IWC portofino gold IW356504"] },
  "iwc big pilot yellow gold":           { goldGrams: 34.00, trend: -2.1, trendLabel: "📉 lieve svalutazione", rarity: "common",  searchTerms: ["IWC big pilot gold IW500901"] },

  // ══════════════════════════════════════════════════════
  // OMEGA
  // ══════════════════════════════════════════════════════
  "omega seamaster yellow gold":         { goldGrams: 31.50, trend: +3.4, trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["omega seamaster gold 18k"] },
  "omega constellation yellow gold":     { goldGrams: 27.00, trend: +2.1, trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["omega constellation gold 18k"] },
  "omega de ville yellow gold":          { goldGrams: 24.75, trend: -4.5, trendLabel: "📉 svalutazione",       rarity: "common",  searchTerms: ["omega de ville gold 18k"] },
  "omega speedmaster yellow gold":       { goldGrams: 33.00, trend: +9.8, trendLabel: "📈 rivalutazione",      rarity: "rare",    searchTerms: ["omega speedmaster gold 18k moonwatch"] },

  // ══════════════════════════════════════════════════════
  // JAEGER-LECOULTRE
  // ══════════════════════════════════════════════════════
  "jaeger lecoultre reverso yellow gold":{ goldGrams: 22.50, trend: +8.4,  trendLabel: "📈 rivalutazione",      rarity: "common",  searchTerms: ["JLC reverso gold 18k classic"] },
  "jaeger lecoultre master yellow gold": { goldGrams: 24.00, trend: +3.2,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["JLC master control gold"] },
  "jaeger lecoultre atmos gold":         { goldGrams: 28.00, trend: +6.7,  trendLabel: "📈 rivalutazione",      rarity: "rare",    searchTerms: ["JLC atmos clock gold"] },

  // ══════════════════════════════════════════════════════
  // BREGUET
  // ══════════════════════════════════════════════════════
  "breguet classique yellow gold":  { goldGrams: 22.50, trend: +7.1, trendLabel: "📈 rivalutazione",      rarity: "common",    searchTerms: ["breguet classique gold 5177BA"] },
  "breguet marine yellow gold":     { goldGrams: 28.50, trend: +4.8, trendLabel: "➡️ stabile",            rarity: "common",    searchTerms: ["breguet marine gold 5817BA"] },
  "breguet tradition yellow gold":  { goldGrams: 26.00, trend: +9.3, trendLabel: "📈 rivalutazione",      rarity: "rare",      searchTerms: ["breguet tradition 7027BA"] },

  // ══════════════════════════════════════════════════════
  // PANERAI
  // ══════════════════════════════════════════════════════
  "panerai luminor goldtech":       { goldGrams: 51.00, trend: +6.2, trendLabel: "📈 rivalutazione",      rarity: "rare",      searchTerms: ["panerai luminor goldtech PAM00625"] },
  "panerai radiomir yellow gold":   { goldGrams: 42.00, trend: +3.1, trendLabel: "➡️ stabile",            rarity: "common",    searchTerms: ["panerai radiomir gold PAM00379"] },

  // ══════════════════════════════════════════════════════
  // BREITLING
  // ══════════════════════════════════════════════════════
  "breitling navitimer yellow gold":{ goldGrams: 33.75, trend: +2.4,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["breitling navitimer gold 18k"] },
  "breitling chronomat yellow gold":{ goldGrams: 36.00, trend: -1.8,  trendLabel: "📉 lieve svalutazione", rarity: "common",  searchTerms: ["breitling chronomat gold"] },

  // ══════════════════════════════════════════════════════
  // MARCHI NON FAMOSI / VINTAGE / MINORI
  // Spesso i migliori arbitraggi perché poco ricercati
  // ══════════════════════════════════════════════════════

  // Zenith
  "zenith el primero yellow gold":  { goldGrams: 27.00, trend: +4.2,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["zenith el primero gold 18k vintage"] },
  "zenith chronomaster yellow gold":{ goldGrams: 24.75, trend: +3.8,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["zenith chronomaster gold"] },

  // Longines (vintage oro)
  "longines conquest vintage gold": { goldGrams: 18.00, trend: +5.6,  trendLabel: "📈 lieve rivalutazione", rarity: "common",  searchTerms: ["longines conquest vintage gold 18k"] },
  "longines flagship gold vintage": { goldGrams: 16.50, trend: +4.9,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["longines flagship gold 18k"] },

  // Tissot vintage
  "tissot vintage yellow gold":     { goldGrams: 14.25, trend: +3.1,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["tissot vintage solid gold 18k"] },

  // Universal Genève (vintage raro)
  "universal geneve tri-compax gold":{ goldGrams: 22.50, trend: +18.7, trendLabel: "🔥 forte rivalutazione", rarity: "rare",   searchTerms: ["universal geneve tri-compax gold", "universal geneve gold vintage"] },
  "universal geneve polerouter gold":{ goldGrams: 19.50, trend: +12.3, trendLabel: "🔥 forte rivalutazione", rarity: "rare",   searchTerms: ["universal geneve polerouter gold"] },

  // Movado vintage
  "movado triple calendar gold":    { goldGrams: 21.00, trend: +9.4,  trendLabel: "📈 rivalutazione",      rarity: "rare",    searchTerms: ["movado triple calendar gold vintage"] },
  "movado polyplan gold":           { goldGrams: 17.25, trend: +14.2, trendLabel: "🔥 forte rivalutazione", rarity: "rare",    searchTerms: ["movado polyplan gold 18k"] },

  // Eberhard & Co
  "eberhard contograf gold":        { goldGrams: 23.25, trend: +5.8,  trendLabel: "📈 lieve rivalutazione", rarity: "common",  searchTerms: ["eberhard contograf gold 18k"] },

  // Girard-Perregaux
  "girard perregaux laureato gold": { goldGrams: 38.25, trend: +8.7,  trendLabel: "📈 rivalutazione",      rarity: "rare",    searchTerms: ["girard perregaux laureato gold 18k"] },
  "girard perregaux vintage 1945 gold":{ goldGrams: 24.00, trend: +7.3, trendLabel: "📈 rivalutazione",    rarity: "common",  searchTerms: ["girard perregaux vintage 1945 gold"] },

  // Piaget
  "piaget altiplano yellow gold":   { goldGrams: 19.50, trend: +6.4,  trendLabel: "📈 rivalutazione",      rarity: "common",  searchTerms: ["piaget altiplano gold ultra thin"] },
  "piaget polo yellow gold":        { goldGrams: 42.00, trend: +4.1,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["piaget polo gold 18k"] },

  // Chopard
  "chopard happy sport yellow gold":{ goldGrams: 29.25, trend: +3.2,  trendLabel: "➡️ stabile",            rarity: "common",  searchTerms: ["chopard happy sport gold 18k"] },
  "chopard l.u.c yellow gold":      { goldGrams: 22.50, trend: +6.9,  trendLabel: "📈 rivalutazione",      rarity: "rare",    searchTerms: ["chopard LUC gold 18k"] },

  // Franck Muller
  "franck muller vanguard yellow gold":  { goldGrams: 45.00, trend: -5.2,  trendLabel: "📉 svalutazione",   rarity: "common",  searchTerms: ["franck muller vanguard gold"] },
  "franck muller casablanca yellow gold":{ goldGrams: 38.00, trend: -7.8,  trendLabel: "📉 svalutazione",   rarity: "common",  searchTerms: ["franck muller casablanca gold"] },

  // Hublot
  "hublot big bang yellow gold":    { goldGrams: 52.50, trend: -8.4,  trendLabel: "📉 svalutazione",       rarity: "common",  searchTerms: ["hublot big bang gold 18k"] },
  "hublot classic fusion yellow gold":{ goldGrams: 38.25, trend: -4.1, trendLabel: "📉 lieve svalutazione", rarity: "common", searchTerms: ["hublot classic fusion gold"] },

  // A. Lange & Söhne
  "a lange sohne saxonia yellow gold":   { goldGrams: 24.75, trend: +16.8, trendLabel: "🔥 forte rivalutazione", rarity: "rare",   searchTerms: ["lange saxonia gold 18k"] },
  "a lange sohne datograph yellow gold": { goldGrams: 36.00, trend: +21.4, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["lange datograph gold"] },

  // F.P. Journe
  "fp journe chronometre souverain gold":{ goldGrams: 28.50, trend: +35.0, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["FP journe chronometre souverain gold"] },

  // Richard Mille (oro raro)
  "richard mille rm 67 yellow gold": { goldGrams: 32.25, trend: +42.0, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["richard mille rm 067 gold"] },

  // Tudor vintage oro
  "tudor prince oysterdate yellow gold":{ goldGrams: 24.75, trend: +8.9, trendLabel: "📈 rivalutazione",    rarity: "common",  searchTerms: ["tudor prince oysterdate gold vintage 18k"] },
  "tudor submariner yellow gold vintage":{ goldGrams: 31.50, trend: +15.3, trendLabel: "🔥 forte rivalutazione", rarity: "rare", searchTerms: ["tudor submariner gold vintage"] },

  // Genova / Gioiellieri italiani vintage
  "corum golden bridge yellow gold": { goldGrams: 23.25, trend: +22.5, trendLabel: "🚀 top rivalutazione",  rarity: "very_rare", searchTerms: ["corum golden bridge gold 18k"] },
  "corum coin watch yellow gold":    { goldGrams: 18.75, trend: +6.3,  trendLabel: "📈 rivalutazione",      rarity: "rare",    searchTerms: ["corum coin watch gold 18k"] },

  // Orologi vintage italiani / meno noti
  "baume mercier riviera yellow gold":   { goldGrams: 26.25, trend: -2.8, trendLabel: "📉 lieve svalutazione", rarity: "common", searchTerms: ["baume mercier riviera gold 18k"] },
  "rado diastar yellow gold":            { goldGrams: 19.50, trend: -3.5, trendLabel: "📉 svalutazione",       rarity: "common", searchTerms: ["rado diastar gold"] },
  "ebel 1911 yellow gold":               { goldGrams: 27.75, trend: -4.2, trendLabel: "📉 svalutazione",       rarity: "common", searchTerms: ["ebel 1911 gold 18k"] },
  "ebel sportwave yellow gold":          { goldGrams: 29.25, trend: -6.1, trendLabel: "📉 svalutazione",       rarity: "common", searchTerms: ["ebel sportwave gold"] },
  "tag heuer carrera yellow gold":       { goldGrams: 30.75, trend: -1.2, trendLabel: "➡️ stabile",            rarity: "common", searchTerms: ["TAG heuer carrera gold 18k"] },
  "tag heuer monaco yellow gold":        { goldGrams: 28.50, trend: +4.3, trendLabel: "➡️ stabile",            rarity: "common", searchTerms: ["TAG heuer monaco gold 18k"] },

  // Orologi a carica manuale / pocket watch oro vintage
  "pocket watch yellow gold 18k large":  { goldGrams: 45.00, trend: +3.2, trendLabel: "➡️ stabile",            rarity: "common", searchTerms: ["orologio tasca oro 18k", "pocket watch 18k gold"] },
  "pocket watch yellow gold 18k medium": { goldGrams: 30.00, trend: +2.8, trendLabel: "➡️ stabile",            rarity: "common", searchTerms: ["orologio tasca oro 18k medio"] },

  // ── FALLBACK GENERICI per "18k" non in lista ──────────────
  "generic 18k gold watch small":        { goldGrams: 18.75, trend: 0,    trendLabel: "➡️ non classificato",   rarity: "common", searchTerms: ["orologio oro 18k"] },
  "generic 18k gold watch medium":       { goldGrams: 26.25, trend: 0,    trendLabel: "➡️ non classificato",   rarity: "common", searchTerms: ["watch gold 18k"] },
  "generic 18k gold watch large":        { goldGrams: 37.50, trend: 0,    trendLabel: "➡️ non classificato",   rarity: "common", searchTerms: ["orologio oro 18 carati"] },
};

// ─────────────────────────────────────────────────────────────
// PAROLE CHIAVE RILEVAMENTO ORO
// ─────────────────────────────────────────────────────────────
const GOLD_KEYWORDS = [
  '18k', '18kt', '18 karat', '18 carati', '18 carats', '750',
  'oro giallo', 'oro rosa', 'oro bianco', 'oro 18',
  'yellow gold', 'rose gold', 'white gold', 'solid gold',
  'everose', 'sedna gold', 'moonshine gold', 'goldtech',
  'or jaune', 'or rose', 'or blanc',
  'gelbgold', 'rotgold', 'weissgold',
  'ouro amarelo', 'oro amarillo',
];

// ─────────────────────────────────────────────────────────────
// QUERY PREDEFINITE PER SCANSIONE AUTOMATICA
// Copre marchi famosi E non famosi
// ─────────────────────────────────────────────────────────────
const AUTO_SCAN_QUERIES = [
  // Rolex
  "Rolex Day-Date gold 18k", "Rolex Daytona gold 18k",
  "Rolex Submariner gold 18k", "Rolex GMT-Master gold",
  // Patek / AP
  "Patek Philippe gold 18k", "Audemars Piguet Royal Oak gold",
  // Cartier
  "Cartier Santos gold 18k", "Cartier Tank gold 18k",
  // Marchi minori e vintage
  "orologio oro 18k vintage", "watch gold 18k vintage",
  "Universal Geneve gold 18k", "Movado gold 18k vintage",
  "Girard-Perregaux gold 18k", "Piaget gold 18k",
  "A Lange Sohne gold", "FP Journe gold",
  "Tudor gold 18k vintage", "Longines gold 18k vintage",
  "Corum golden bridge gold", "Zenith gold 18k",
  // Generico
  "orologio tasca oro 18k", "pocket watch 18k gold",
  "solid gold watch 18k carati", "montre or 18k",
];

// ─────────────────────────────────────────────────────────────
// TOP 10 RIVALUTAZIONE (aggiornato manualmente ogni trimestre)
// ─────────────────────────────────────────────────────────────
const TOP_APPRECIATION = [
  { model: "Richard Mille RM 67 Gold",        trend: +42.0, note: "Produzione limitatissima" },
  { model: "F.P. Journe Chronometre Souverain Gold", trend: +35.0, note: "Artigianale, pochissimi esemplari" },
  { model: "Cartier Crash Gold",               trend: +31.0, note: "Design iconico, molto raro" },
  { model: "Patek Philippe Nautilus Gold",     trend: +28.5, note: "Lista d'attesa pluriennale" },
  { model: "Patek Philippe Aquanaut Gold",     trend: +22.1, note: "Discontinuato, mercato in fiamme" },
  { model: "Audemars Piguet Royal Oak Gold",   trend: +24.7, note: "Icona, domanda sempre alta" },
  { model: "A. Lange & Söhne Datograph Gold",  trend: +21.4, note: "Manifattura tedesca, rarissimo" },
  { model: "Universal Genève Tri-Compax Gold", trend: +18.7, note: "Vintage rivalutato fortemente" },
  { model: "Rolex Daytona Yellow Gold",        trend: +18.3, note: "Classico intramontabile" },
  { model: "Movado Polyplan Gold",             trend: +14.2, note: "Vintage raro, poco noto" },
];

// TOP 10 SVALUTAZIONE
const TOP_DEPRECIATION = [
  { model: "Richard Mille (acciaio/titanio)",  trend: -18.0, note: "Mercato saturo, prezzi crollati" },
  { model: "Hublot Big Bang Gold",             trend: -8.4,  note: "Moda passata, svalutazione continua" },
  { model: "Franck Muller Casablanca Gold",    trend: -7.8,  note: "Brand in difficoltà" },
  { model: "Hublot Classic Fusion Gold",       trend: -4.1,  note: "Liquidità bassa" },
  { model: "Franck Muller Vanguard Gold",      trend: -5.2,  note: "Mercato secondario debole" },
  { model: "IWC Big Pilot Gold",               trend: -2.1,  note: "Lieve correzione in corso" },
  { model: "Omega De Ville Gold",              trend: -4.5,  note: "Scarsa domanda usato" },
  { model: "Breitling Chronomat Gold",         trend: -1.8,  note: "Stagnante" },
  { model: "Ebel 1911 Gold",                   trend: -4.2,  note: "Brand in declino" },
  { model: "Rado Diastar Gold",                trend: -3.5,  note: "Mercato secondario debole" },
];

module.exports = {
  WATCH_DATABASE,
  GOLD_KEYWORDS,
  AUTO_SCAN_QUERIES,
  TOP_APPRECIATION,
  TOP_DEPRECIATION,
};
