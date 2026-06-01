/**
 * Database Orologiai Indipendenti
 * 60+ marchi divisi per tier con segnali specifici
 * Discovery Score: quanto è ancora sotto i radar
 */

const INDEPENDENT_WATCHMAKERS = {

  // ══════════════════════════════════════════════════════════
  // TIER 1 — GIÀ ESPLOSI (prezzi alti, mercato maturo)
  // Acquisto sicuro ma upside limitato
  // ══════════════════════════════════════════════════════════
  'fp_journe': {
    name: 'F.P. Journe', founded: 1999, country: 'CH',
    tier: 1, tierLabel: 'Già esploso',
    discoveryScore: 5,  // 0=tutti lo conoscono, 100=nessuno lo sa
    avgPrice: 65000, priceRange: [35000, 250000],
    trend: +35, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['FP Journe', 'François-Paul Journe', 'Chronometre Souverain', 'Resonance', 'Octa'],
    instagram: ['fpjourne'],
    hodinkeeSlug: 'f-p-journe',
    keyModels: ['Chronometre Souverain', 'Resonance', 'Tourbillon Souverain', 'Octa Automatique'],
    buySignal: 'Qualsiasi modello discontinued è un acquisto',
    riskLevel: 'basso',
    notes: 'Journe ha annunciato di voler ridurre la produzione — prezzi destinati a salire ulteriormente',
  },

  'mb_f': {
    name: 'MB&F', founded: 2005, country: 'CH',
    tier: 1, tierLabel: 'Già esploso',
    discoveryScore: 8,
    avgPrice: 75000, priceRange: [40000, 350000],
    trend: +22, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['MB&F', 'HM1', 'HM2', 'HM3', 'HM4', 'HM5', 'HM6', 'HM9', 'LM1', 'LM2', 'Legacy Machine'],
    instagram: ['mbandf'],
    hodinkeeSlug: 'mb-f',
    keyModels: ['HM3', 'HM6', 'Legacy Machine 1', 'LM Split Escapement'],
    buySignal: 'HM discontinuate o serie limitate',
    riskLevel: 'basso',
    notes: 'Massimo Busser ha costruito un brand iconico. Collezionisti tech/luxury lo adorano',
  },

  'de_bethune': {
    name: 'De Bethune', founded: 2002, country: 'CH',
    tier: 1, tierLabel: 'Già esploso',
    discoveryScore: 12,
    avgPrice: 80000, priceRange: [50000, 400000],
    trend: +18, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['De Bethune', 'DB25', 'DB28', 'Dream Watch'],
    instagram: ['debethune_watches'],
    hodinkeeSlug: 'de-bethune',
    keyModels: ['DB25', 'DB28', 'Dream Watch 5'],
    buySignal: 'DB25 in titanio è il modello più liquido',
    riskLevel: 'basso',
  },

  'greubel_forsey': {
    name: 'Greubel Forsey', founded: 2004, country: 'CH',
    tier: 1, tierLabel: 'Già esploso',
    discoveryScore: 10,
    avgPrice: 350000, priceRange: [200000, 2000000],
    trend: +15, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Greubel Forsey', 'Double Tourbillon', 'Art Piece', 'Hand Made'],
    instagram: ['greubelforsey'],
    hodinkeeSlug: 'greubel-forsey',
    keyModels: ['Double Tourbillon 30°', 'Art Piece 1', 'GMT Quadruple Tourbillon'],
    buySignal: 'Qualsiasi esemplare — produzione minima',
    riskLevel: 'molto basso',
  },

  // ══════════════════════════════════════════════════════════
  // TIER 2 — IN CRESCITA ORA (momento ideale di acquisto)
  // ══════════════════════════════════════════════════════════
  'simon_brette': {
    name: 'Simon Brette', founded: 2015, country: 'FR',
    tier: 2, tierLabel: 'In crescita ora',
    discoveryScore: 62,
    avgPrice: 28000, priceRange: [18000, 65000],
    trend: +28, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['Simon Brette', 'Trilobe', 'Assemblage', 'Une Seconde à Paris'],
    instagram: ['simonbrette', 'simon.brette.watches'],
    hodinkeeSlug: 'simon-brette',
    keyModels: ['Trilobe Une Seconde à Paris', 'Assemblage'],
    buySignal: 'Trilobe ora — prezzi quasi raddoppiati in 3 anni, ancora accessibili',
    riskLevel: 'medio',
    notes: 'Francese, vincitore Grand Prix Horlogerie Genève 2022. Ancora pochi esemplari in circolazione',
    founderInstagram: 'simonbrette',
  },

  'czapek': {
    name: 'Czapek & Cie', founded: 2015, country: 'CH',
    tier: 2, tierLabel: 'In crescita ora',
    discoveryScore: 55,
    avgPrice: 22000, priceRange: [12000, 45000],
    trend: +24, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['Czapek', 'Place Vendôme', 'Antarctique', 'Quai des Bergues', 'Faubourg de Cracovie'],
    instagram: ['czapek_geneve'],
    hodinkeeSlug: 'czapek',
    keyModels: ['Place Vendôme', 'Antarctique', 'Faubourg de Cracovie'],
    buySignal: 'Antarctique in metallo speciale — tiratura limitata con lista d\'attesa',
    riskLevel: 'medio',
    notes: 'Revival brand storico (1845). Crowdfunding iniziale ora ha mercato secondario attivo',
    founderInstagram: 'xaviederedon',
  },

  'voutilainen': {
    name: 'Kari Voutilainen', founded: 2002, country: 'FI',
    tier: 2, tierLabel: 'In crescita ora',
    discoveryScore: 40,
    avgPrice: 85000, priceRange: [55000, 200000],
    trend: +20, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Voutilainen', 'Kari Voutilainen', 'Vingt-8', 'GMT-6', 'Observatoire'],
    instagram: ['karivo_watches'],
    hodinkeeSlug: 'voutilainen',
    keyModels: ['Vingt-8', 'GMT-6', 'Observatoire', '28ti'],
    buySignal: 'Lista d\'attesa pluriennale — mercato secondario sempre più attivo',
    riskLevel: 'basso',
  },

  'akrivia': {
    name: 'Akrivia', founded: 2012, country: 'CH',
    tier: 2, tierLabel: 'In crescita ora',
    discoveryScore: 48,
    avgPrice: 55000, priceRange: [35000, 120000],
    trend: +19, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Akrivia', 'AK-06', 'AK-08', 'Rexhep Rexhepi', 'Chronometre Contemporain'],
    instagram: ['akrivia_watches', 'rexhep_rexhepi'],
    hodinkeeSlug: 'akrivia',
    keyModels: ['AK-06', 'AK-08', 'Chronometre Contemporain'],
    buySignal: 'Qualsiasi modello — produzione <50 pezzi/anno',
    riskLevel: 'basso',
    notes: 'Rexhep Rexhepi — il più talentuoso della sua generazione secondo molti esperti',
    founderInstagram: 'rexhep_rexhepi',
  },

  'armin_strom': {
    name: 'Armin Strom', founded: 2007, country: 'CH',
    tier: 2, tierLabel: 'In crescita ora',
    discoveryScore: 52,
    avgPrice: 18000, priceRange: [12000, 40000],
    trend: +14, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Armin Strom', 'Mirrored Force Resonance', 'Skeleton Pure', 'Dual Time Resonance'],
    instagram: ['arminstrom'],
    hodinkeeSlug: 'armin-strom',
    keyModels: ['Mirrored Force Resonance', 'Dual Time Resonance'],
    buySignal: 'Resonance — tecnologia unica, prezzo ancora accessibile',
    riskLevel: 'medio',
  },

  'h_moser': {
    name: 'H. Moser & Cie', founded: 1828, country: 'CH',
    tier: 2, tierLabel: 'In crescita ora',
    discoveryScore: 35,
    avgPrice: 25000, priceRange: [15000, 80000],
    trend: +12, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['H Moser', 'H. Moser', 'Endeavour', 'Swiss Mad', 'Streamliner', 'Perpetual Moon'],
    instagram: ['hmosercie'],
    hodinkeeSlug: 'h-moser',
    keyModels: ['Endeavour Perpetual Moon', 'Streamliner', 'Swiss Mad Watch'],
    buySignal: 'Streamliner — il più originale, apprezzamento costante',
    riskLevel: 'medio-basso',
  },

  // ══════════════════════════════════════════════════════════
  // TIER 3 — DA SCOPRIRE (ancora accessibili, alto upside)
  // ══════════════════════════════════════════════════════════
  'massena_lab': {
    name: 'Massena LAB', founded: 2018, country: 'FR',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 72,
    avgPrice: 4500, priceRange: [3000, 8000],
    trend: +18, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Massena LAB', 'Uni-Racer', 'Bund Strap', 'William Massena'],
    instagram: ['massenalab', 'william_massena'],
    hodinkeeSlug: 'massena-lab',
    keyModels: ['Uni-Racer', 'Type 62'],
    buySignal: 'Qualsiasi collab limitata — si rivendono subito a premio',
    riskLevel: 'medio',
    notes: 'William Massena è un collezionista rispettato — ogni collab è sold out in ore',
    founderInstagram: 'william_massena',
  },

  'raul_pages': {
    name: 'Raul Pagès', founded: 2019, country: 'FR',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 78,
    avgPrice: 35000, priceRange: [25000, 60000],
    trend: +32, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['Raul Pages', 'Raul Pagès', 'Pégase', 'Arceau'],
    instagram: ['raulpages_horlogerie'],
    hodinkeeSlug: 'raul-pages',
    keyModels: ['Pégase'],
    buySignal: 'ADESSO — ancora pochi collezionisti lo conoscono, premiato a Ginevra 2023',
    riskLevel: 'medio-alto',
    notes: 'Ex Hermès, vincitore GPHG 2023. Uno dei nomi più caldi del momento tra gli insider',
    founderInstagram: 'raulpages_horlogerie',
  },

  'ming': {
    name: 'MING', founded: 2017, country: 'MY',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 65,
    avgPrice: 3800, priceRange: [2500, 8000],
    trend: +22, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['MING watch', 'Ming Thein', 'MING 17.01', 'MING 19.01', 'MING 37'],
    instagram: ['ming_watches', 'mingthein'],
    hodinkeeSlug: 'ming',
    keyModels: ['17.01', '17.06', '19.01', '37.05'],
    buySignal: 'Prime serie — 17.01 vale già 3x il prezzo originale',
    riskLevel: 'medio',
    notes: 'Fondato da Ming Thein, fotografo/collezionista. Community online fortissima',
    founderInstagram: 'mingthein',
  },

  'kurono_tokyo': {
    name: 'Kurono Tokyo', founded: 2018, country: 'JP',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 68,
    avgPrice: 2800, priceRange: [1800, 5500],
    trend: +19, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Kurono Tokyo', 'Hai', 'Ichi', 'Toki', 'Tetsuya Kurono'],
    instagram: ['kurono.tokyo'],
    hodinkeeSlug: 'kurono-tokyo',
    keyModels: ['Toki', 'Ichi', 'Hai'],
    buySignal: 'Ogni drop si esaurisce in minuti — mercato secondario immediato',
    riskLevel: 'medio',
    notes: 'Design giapponese purissimo. Drop model = FOMO garantita ad ogni lancio',
  },

  'kudoke': {
    name: 'Kudoke', founded: 2010, country: 'DE',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 74,
    avgPrice: 18000, priceRange: [12000, 35000],
    trend: +16, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Kudoke', 'Stefan Kudoke', 'Kudoke 1', 'Kudoke 2', 'Kudoke 3'],
    instagram: ['kudoke_watches'],
    hodinkeeSlug: 'kudoke',
    keyModels: ['Kudoke 1', 'Kudoke 2', 'Kudoke 3'],
    buySignal: 'Kudoke 1 — skeleton puro fatto a mano, ancora sottovalutato',
    riskLevel: 'medio',
  },

  'bovet': {
    name: 'Bovet 1822', founded: 1822, country: 'CH',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 45,
    avgPrice: 35000, priceRange: [20000, 200000],
    trend: +11, trendLabel: '📈 Rivalutazione',
    searchTerms: ['Bovet', 'Bovet 1822', 'Amadeo', 'Fleurier', 'Récital'],
    instagram: ['bovet1822'],
    hodinkeeSlug: 'bovet',
    keyModels: ['Récital 26 Brainstorm Chapter Two', 'Amadeo Fleurier'],
    buySignal: 'Récital serie — complicazioni eccezionali a prezzi ancora ragionevoli',
    riskLevel: 'medio-basso',
  },

  'baltic': {
    name: 'Baltic Watches', founded: 2017, country: 'FR',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 60,
    avgPrice: 650, priceRange: [400, 1200],
    trend: +15, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Baltic watch', 'Baltic HMS', 'Baltic Aquascaphe', 'Baltic Bicompax'],
    instagram: ['balticwatches'],
    hodinkeeSlug: 'baltic',
    keyModels: ['HMS 001', 'Aquascaphe', 'Bicompax 001'],
    buySignal: 'Edizioni limitate collab — immediate premium sul secondario',
    riskLevel: 'medio',
    notes: 'Micro-brand francese di qualità. Community online enorme relativa al prezzo',
  },

  // ══════════════════════════════════════════════════════════
  // TIER 4 — MICRO-BRAND EMERGENTI (alto rischio, upside enorme)
  // Investimento speculativo — piccole cifre, potenziale x5-x10
  // ══════════════════════════════════════════════════════════
  'habring2': {
    name: 'Habring²', founded: 2004, country: 'AT',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 82,
    avgPrice: 6500, priceRange: [4500, 15000],
    trend: +14, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Habring', 'Habring2', 'Doppel 3', 'Jumping', 'Felix'],
    instagram: ['habring2'],
    hodinkeeSlug: 'habring2',
    keyModels: ['Doppel 3', 'Jumping 2.0', 'Felix'],
    buySignal: 'Doppel 3 — split second chrono a €6k, vale molto di più',
    riskLevel: 'medio-alto',
    notes: 'Marito e moglie austriaci ex-IWC/Jaeger. Qualità manifattura incredibile per il prezzo',
  },

  'sartory_billard': {
    name: 'Sartory Billard', founded: 2018, country: 'FR',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 85,
    avgPrice: 3200, priceRange: [2500, 6000],
    trend: +20, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Sartory Billard', 'SB01', 'SB02', 'SB03'],
    instagram: ['sartorybillard'],
    hodinkeeSlug: 'sartory-billard',
    keyModels: ['SB01', 'SB02 Chronograph'],
    buySignal: 'SB01 first series — già a premio sul secondario',
    riskLevel: 'alto',
    notes: 'Francese, fan base molto fedele. Drop model con lista d\'attesa',
  },

  'garrick': {
    name: 'Garrick', founded: 2014, country: 'UK',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 88,
    avgPrice: 4800, priceRange: [3500, 9000],
    trend: +12, trendLabel: '📈 Rivalutazione',
    searchTerms: ['Garrick watch', 'Garrick S5', 'Garrick Norfolk'],
    instagram: ['garrickwatches'],
    hodinkeeSlug: 'garrick',
    keyModels: ['S5', 'Norfolk'],
    buySignal: 'British made, pochi esemplari — rarità garantita',
    riskLevel: 'alto',
  },

  'cyrus': {
    name: 'Cyrus Watches', founded: 2010, country: 'CH',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 75,
    avgPrice: 22000, priceRange: [15000, 55000],
    trend: +10, trendLabel: '📈 Rivalutazione',
    searchTerms: ['Cyrus watches', 'Klepcys', 'Cyrus Kobeirn'],
    instagram: ['cyruswatches'],
    hodinkeeSlug: 'cyrus',
    keyModels: ['Klepcys GMT', 'Kobeirn'],
    buySignal: 'Klepcys GMT — design unico, ancora sotto i radar in Italia',
    riskLevel: 'medio-alto',
  },

  'andreas_strehler': {
    name: 'Andreas Strehler', founded: 2000, country: 'CH',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 90,
    avgPrice: 45000, priceRange: [30000, 100000],
    trend: +16, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Andreas Strehler', 'Sauterelle', 'Papillon', 'Lune Exacte'],
    instagram: ['andreasstrehler'],
    hodinkeeSlug: 'andreas-strehler',
    keyModels: ['Sauterelle à Lune Exacte', 'Papillon des Temps'],
    buySignal: 'Solo maker puro — ogni orologio fatto interamente da lui',
    riskLevel: 'medio',
    notes: 'Produce <10 orologi/anno. Considerato "il più sottovalutato della scena indie"',
  },

  'roger_smith': {
    name: 'Roger W. Smith', founded: 2000, country: 'UK',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 55,
    avgPrice: 180000, priceRange: [120000, 400000],
    trend: +25, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['Roger Smith', 'Roger W Smith', 'Series 2', 'Series 5', 'Duality'],
    instagram: ['rogerwsmith'],
    hodinkeeSlug: 'roger-w-smith',
    keyModels: ['Series 2', 'Series 5', 'Duality'],
    buySignal: 'Allievo di George Daniels — erede diretto della scuola britannica',
    riskLevel: 'basso',
    notes: 'Ogni orologio completamente fatto a mano da solo. Lista attesa 7+ anni',
  },

  'philippe_dufour': {
    name: 'Philippe Dufour', founded: 1992, country: 'CH',
    tier: 4, tierLabel: 'Legenda vivente',
    discoveryScore: 20,
    avgPrice: 450000, priceRange: [300000, 1500000],
    trend: +40, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['Philippe Dufour', 'Simplicity', 'Duality Dufour', 'Grande Sonnerie Dufour'],
    instagram: ['philippedufour'],
    hodinkeeSlug: 'philippe-dufour',
    keyModels: ['Simplicity', 'Grande et Petite Sonnerie', 'Duality'],
    buySignal: 'Impossibile trovarne — se trovi uno compra senza pensarci',
    riskLevel: 'bassissimo',
    notes: 'Il più grande orologiaio vivente. Ha prodotto ~250 orologi in totale in 30 anni',
  },

  'george_daniels': {
    name: 'George Daniels (estate)', founded: 1969, country: 'UK',
    tier: 4, tierLabel: 'Legenda storica',
    discoveryScore: 15,
    avgPrice: 1200000, priceRange: [500000, 5000000],
    trend: +45, trendLabel: '🚀 Top rivalutazione',
    searchTerms: ['George Daniels', 'Daniels Space Traveller', 'Daniels Anniversary', 'co-axial original'],
    instagram: [],
    hodinkeeSlug: 'george-daniels',
    keyModels: ['Space Traveller I', 'Space Traveller II', 'Anniversary Watch'],
    buySignal: 'All\'asta — ogni apparizione stabilisce record',
    riskLevel: 'bassissimo',
  },

  // Altri notevoli
  'lv_cepe': {
    name: 'L.V. Cépée', founded: 2020, country: 'FR',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 92,
    avgPrice: 5500, priceRange: [4000, 9000],
    trend: +18, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['LV Cépée', 'Cepee', 'Fleuron'],
    instagram: ['lvcepee'],
    hodinkeeSlug: null,
    keyModels: ['Fleuron'],
    buySignal: 'Discovery opportunity — quasi nessuno lo conosce ancora',
    riskLevel: 'alto',
  },

  'torn_and_glazer': {
    name: 'Torn & Glaser', founded: 2021, country: 'IL',
    tier: 4, tierLabel: 'Micro-brand emergente',
    discoveryScore: 95,
    avgPrice: 8500, priceRange: [6000, 14000],
    trend: +22, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Torn Glaser', 'Torn & Glaser'],
    instagram: ['tornandglaser'],
    hodinkeeSlug: null,
    keyModels: ['Explorer I'],
    buySignal: 'Primissimo lancio — finestra di acquisto breve',
    riskLevel: 'molto alto',
    notes: 'Visti su Hodinkee 2023, sold out immediato. Nessuno lo sa ancora in Italia',
  },

  'gronefeld': {
    name: 'Grönefeld', founded: 2008, country: 'NL',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 65,
    avgPrice: 32000, priceRange: [22000, 65000],
    trend: +17, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['Grönefeld', 'Gronefeld', '1941 Remontoire', 'One Hertz', 'Parallax Tourbillon'],
    instagram: ['gronefeldwatches'],
    hodinkeeSlug: 'gronefeld',
    keyModels: ['1941 Remontoire', 'One Hertz'],
    buySignal: 'Fratelli olandesi con manifattura eccezionale, ancora accessibili',
    riskLevel: 'medio',
  },

  'david_candaux': {
    name: 'David Candaux', founded: 2012, country: 'CH',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 70,
    avgPrice: 42000, priceRange: [30000, 90000],
    trend: +15, trendLabel: '🔥 Forte rivalutazione',
    searchTerms: ['David Candaux', 'DC6 Tourbillon', 'DC7', '1740'],
    instagram: ['davidcandaux'],
    hodinkeeSlug: 'david-candaux',
    keyModels: ['DC6 Tourbillon', '1740'],
    buySignal: 'DC6 — tourbillon volante a prezzi ancora ragionevoli',
    riskLevel: 'medio',
  },

  'jean_francois_mojon': {
    name: 'Chronode / J.F. Mojon', founded: 2005, country: 'CH',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 80,
    avgPrice: 0, // solo B2B
    trend: 0, trendLabel: '➡️ Manifattura',
    searchTerms: ['Jean-François Mojon', 'Chronode', 'JF Mojon'],
    instagram: ['jf.mojon'],
    hodinkeeSlug: null,
    keyModels: [],
    buySignal: 'Cerca orologi con movimento Chronode all\'interno',
    riskLevel: 'n/a',
    notes: 'Il più richiesto movement designer. Se un brand piccolo usa Chronode = qualità garantita',
  },

  'yema': {
    name: 'Yema', founded: 1948, country: 'FR',
    tier: 3, tierLabel: 'Da scoprire',
    discoveryScore: 58,
    avgPrice: 850, priceRange: [600, 2500],
    trend: +13, trendLabel: '📈 Rivalutazione',
    searchTerms: ['Yema Superman', 'Yema Rallygraf', 'Yema Navygraf'],
    instagram: ['yema_watches'],
    hodinkeeSlug: 'yema',
    keyModels: ['Superman', 'Rallygraf', 'Navygraf'],
    buySignal: 'Superman vintage anni 70 — ancora sottovalutati',
    riskLevel: 'medio',
  },
};

// ─────────────────────────────────────────────
// MEDIA E FONTI DI DISCOVERY
// Dove nascono i trend degli indipendenti
// ─────────────────────────────────────────────
const INDIE_MEDIA_SOURCES = [
  { name: 'Hodinkee',          url: 'https://hodinkee.com',          rssUrl: 'https://www.hodinkee.com/feed',              weight: 95, type: 'media' },
  { name: 'Revolution Watch',  url: 'https://revolution.watch',      rssUrl: 'https://revolution.watch/feed',              weight: 85, type: 'media' },
  { name: 'WatchCollecting',   url: 'https://watchcollecting.com',   rssUrl: 'https://watchcollecting.com/feed',           weight: 80, type: 'media' },
  { name: 'A Blog To Watch',   url: 'https://www.ablogtowatch.com',  rssUrl: 'https://www.ablogtowatch.com/feed',          weight: 75, type: 'media' },
  { name: 'Time+Tide',         url: 'https://timeandtidewatches.com',rssUrl: 'https://timeandtidewatches.com/feed',        weight: 70, type: 'media' },
  { name: 'WristReview',       url: 'https://wristreview.com',       rssUrl: 'https://wristreview.com/feed',               weight: 65, type: 'media' },
  { name: 'Monochrome',        url: 'https://monochrome-watches.com',rssUrl: 'https://monochrome-watches.com/feed',        weight: 72, type: 'media' },
  { name: 'The Purists',       url: 'https://www.thepurists.com',    rssUrl: null,                                         weight: 90, type: 'forum' },
  { name: 'WatchUSeek',        url: 'https://www.watchuseek.com',    rssUrl: null,                                         weight: 75, type: 'forum' },
  { name: 'Phillips Watches',  url: 'https://www.phillips.com/watches', rssUrl: null,                                      weight: 88, type: 'auction' },
  { name: 'Christie\'s Watches',url: 'https://www.christies.com',   rssUrl: null,                                         weight: 88, type: 'auction' },
  { name: 'Sotheby\'s Watches',url: 'https://www.sothebys.com',     rssUrl: null,                                         weight: 88, type: 'auction' },
];

// Account Instagram influenti (non brand, ma opinion leaders)
const INDIE_INSTAGRAM_INFLUENCERS = [
  { handle: 'watchanish',          name: 'Anish Bhatt',         followers: '800K', influence: 95 },
  { handle: 'deploywatch',         name: 'Deploy Watch',         followers: '195K', influence: 85 },
  { handle: 'wristcheck',          name: 'Wristcheck',          followers: '250K', influence: 88 },
  { handle: 'thewatchbox',         name: 'The Watch Box',       followers: '380K', influence: 85 },
  { handle: 'collectorsgrade',     name: 'Collectors Grade',    followers: '95K',  influence: 80 },
  { handle: 'watchgang',           name: 'Watch Gang',          followers: '420K', influence: 70 },
  { handle: 'timepiecessociety',   name: 'Timepieces Society',  followers: '180K', influence: 82 },
  { handle: 'independentwatchmakers', name: 'IW Collective',   followers: '45K',  influence: 90 },
  { handle: 'gphg_official',       name: 'GPHG Official',       followers: '62K',  influence: 95 },
  { handle: 'watchesandwonders',   name: 'Watches & Wonders',   followers: '290K', influence: 92 },
  { handle: 'salonqp',             name: 'SalonQP London',      followers: '38K',  influence: 85 },
  { handle: 'cortinawatchofficial',name: 'Cortina Watch',       followers: '115K', influence: 78 },
  { handle: 'thehorologicalatelier',name:'Horological Atelier', followers: '28K',  influence: 88 },
];

// GPHG — Grand Prix d'Horlogerie de Genève
// Vincere o essere nominati = segnale fortissimo di rivalutazione
const GPHG_SIGNAL_WEIGHT = 40; // punti aggiuntivi all'Hype Score

// Watches & Wonders appearance = segnale
const WATCHES_WONDERS_WEIGHT = 25;

// Tier weights per Discovery Score
const TIER_WEIGHTS = {
  1: { discoveryBonus: 0,  priceRisk: 'basso',      note: 'Mercato maturo' },
  2: { discoveryBonus: 15, priceRisk: 'medio',      note: 'Momento ideale' },
  3: { discoveryBonus: 25, priceRisk: 'medio',      note: 'Finestra aperta' },
  4: { discoveryBonus: 35, priceRisk: 'alto',       note: 'Speculativo' },
};

module.exports = {
  INDEPENDENT_WATCHMAKERS,
  INDIE_MEDIA_SOURCES,
  INDIE_INSTAGRAM_INFLUENCERS,
  GPHG_SIGNAL_WEIGHT,
  TIER_WEIGHTS,
};
