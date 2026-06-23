// brandWatchlist.js — Watchbot v11.13 | Aggiornato 23/06/26
// Watchlist attiva: modelli da comprare se trovati sotto soglia

const watchlist = [

  // ── PRIORITÀ MASSIMA ──────────────────────────────────────────────────────
  { brand: 'Universal Geneve', model: 'Polerouter', caliber: '215 218 1-66 1-69', maxBuy: 900, note: 'Microrotor solo-tempo, catalizzatore 2026' },
  { brand: 'Universal Geneve', model: 'White Shadow', caliber: '1-66', maxBuy: 1000, note: 'Ultra-thin cult, acciaio preferred' },
  { brand: 'Universal Geneve', model: 'Compax', caliber: 'manifattura', maxBuy: 2500, note: 'Panda = premium, verificare quadrante' },
  { brand: 'Gallet', model: 'Excel-O-Graph', caliber: 'EP40 EP40-68', maxBuy: 1800, note: 'Manifattura colonne, max €1800 per margine' },
  { brand: 'Vacheron Constantin', model: 'dress oro 18k', caliber: 'K1014', maxBuy: 3500, note: 'Calcolare melt floor prima — non superare mai' },

  // ── PRIORITÀ ALTA ─────────────────────────────────────────────────────────
  { brand: 'Nivada', model: 'CASD Chronomaster', caliber: 'Valjoux 92', maxBuy: 1500, note: 'Config icona broad-arrow, verificare fondello' },
  { brand: 'Nivada', model: 'CASD Chronomaster', caliber: 'Valjoux 23', maxBuy: 2500, note: 'Vertice gerarchia, raro' },
  { brand: 'Movado', model: 'Datron Datochron HS360', caliber: '3019PHC', maxBuy: 1800, note: 'Vero El Primero accessibile' },
  { brand: 'Piaget', model: 'dress oro vintage', caliber: '9P 12P', maxBuy: 1500, note: 'Ultra-sottile manifattura, oro 18k preferred' },
  { brand: 'Gallet', model: 'Jim Clark', caliber: 'Valjoux 72', maxBuy: 2500, note: 'NON confondere con prezzi vecchi €800, mercato €3700-4950' },

  // ── PRIORITÀ MEDIA ────────────────────────────────────────────────────────
  { brand: 'Eberhard', model: 'Chrono 4 Grande Taille', ref: '31052', maxBuy: 2000, note: 'Vedi pezzo di Leonardo — confronto mercato' },
  { brand: 'Cyma', model: 'Watersport Navystar', caliber: 'R459', maxBuy: 120, note: 'Solo tempo manifattura sottovalutato' },
  { brand: 'Helvetia', model: 'cronografo', caliber: 'Valjoux 72', maxBuy: 800, note: 'Daytona accessibile' },
  { brand: 'Invicta', model: 'vintage pre-quarzo', caliber: 'Valjoux 72', maxBuy: 600, note: 'Solo vintage vero, no moderni Invicta' },
  { brand: 'Wittnauer', model: 'cronografo', caliber: 'Valjoux 72', maxBuy: 700, note: 'Parente povero Daytona' },
  { brand: 'Poljot', model: 'Strela', caliber: 'Strela', maxBuy: 400, note: 'Crono russo manifattura' },
  { brand: 'LeJour', model: 'vintage', caliber: 'qualsiasi manifattura', maxBuy: 500, note: 'Sottovalutato, watchlist bot' },
  { brand: 'Clebar', model: 'vintage', caliber: 'qualsiasi manifattura', maxBuy: 400, note: 'Sottovalutato' },

  // ── INDIE MODERNI (eccezione al filtro vintage) ───────────────────────────
  { brand: 'Czapek', model: 'Quai des Bergues', caliber: 'SXH5', maxBuy: 9000, note: 'In-house, entrata indie' },
  { brand: 'Atelier Wen', model: 'Perception', caliber: 'qualsiasi', maxBuy: 2500, note: 'Primo bracciale tantalio integrato, $700→$30k traiettoria' },
  { brand: 'Urban Jurgensen', model: 'ref 1140 P8 Jules', caliber: 'manifattura', maxBuy: 8000, note: 'Pre-rilancio Voutilainen 2025' },

];

module.exports = { watchlist };
