/**
 * DATABASE VINTAGE — Calibri, Referenze, Valori
 *
 * Per ogni modello: calibro, anni, materiali, valore mercato indicativo,
 * rarità, perché è desiderabile.
 *
 * Valori in EUR — fascia mercato secondario condizioni buone (2024-2025).
 * I valori sono INDICATIVI per riconoscere occasioni, non perizie.
 *
 * desirability: 1-10 (quanto è ricercato dai collezionisti)
 * grail: true = pezzo iconico molto richiesto
 */

const VINTAGE_DB = {

  // ═══════════════ OMEGA ═══════════════
  'omega speedmaster 321': { brand:'Omega', model:'Speedmaster ed. 321 (Pre-Moon)', caliber:'cal. 321', years:'1957-1968', material:'acciaio', valueLow:8000, valueHigh:25000, desirability:10, grail:true, note:'Calibro 321 col-wheel, il vero Moonwatch pre-1968. Ed. "Ed White" ref.105.003 tra le più ricercate.' },
  'omega speedmaster 861': { brand:'Omega', model:'Speedmaster ed. 861', caliber:'cal. 861', years:'1968-1996', material:'acciaio', valueLow:3000, valueHigh:7000, desirability:8, note:'Successore del 321. Ancora accessibile, in crescita costante.' },
  'omega seamaster 300 165014': { brand:'Omega', model:'Seamaster 300 ref.165.014', caliber:'cal. 552', years:'1962-1967', material:'acciaio', valueLow:6000, valueHigh:15000, desirability:9, grail:true, note:'Diver vintage iconico, quadrante e lancette a freccia. Molto falsificato.' },
  'omega constellation pie-pan': { brand:'Omega', model:'Constellation Pie-Pan', caliber:'cal. 551/561', years:'1958-1970', material:'oro 18k / oro cappato / acciaio', valueLow:1500, valueHigh:6000, desirability:7, note:'Quadrante "pie-pan" sfaccettato, cronometro certificato. Versioni oro massiccio ~38g valgono molto come metallo. ATTENZIONE: molte sono gold-capped (non massicce).' },
  'omega seamaster deville': { brand:'Omega', model:'Seamaster De Ville', caliber:'cal. 552/562', years:'1960s', material:'acciaio / oro cappato', valueLow:500, valueHigh:1800, desirability:6, note:'Eleganti, sottovalutati. Quadranti tropical molto ricercati.' },
  'omega flightmaster': { brand:'Omega', model:'Flightmaster', caliber:'cal. 910/911', years:'1969-1977', material:'acciaio', valueLow:3000, valueHigh:8000, desirability:8, note:'Da pilota, molto particolare. In forte crescita.' },
  'omega geneve': { brand:'Omega', model:'Genève', caliber:'cal. 601/613', years:'1960s-70s', material:'acciaio / oro cappato', valueLow:300, valueHigh:1200, desirability:5, note:'Entry vintage Omega. Quadranti colorati anni 70 ricercati.' },

  // ═══════════════ ROLEX ═══════════════
  'rolex datejust vintage 1601': { brand:'Rolex', model:'Datejust ref.1601', caliber:'cal. 1570', years:'1959-1977', material:'acciaio / oro / acciaio-oro', valueLow:3000, valueHigh:8000, desirability:8, note:'Classico assoluto. Quadranti particolari (sigma, tropical) valgono molto di più. Versioni oro massiccio pesano ~55g.' },
  'rolex day-date 1803': { brand:'Rolex', model:'Day-Date ref.1803', caliber:'cal. 1555/1556', years:'1959-1977', material:'oro 18k massiccio', valueLow:9000, valueHigh:20000, desirability:9, grail:true, note:'President in oro massiccio ~58g. Sempre oro vero, mai placcato. Ottimo per arbitraggio metallo + valore collezione.' },
  'rolex submariner 5513': { brand:'Rolex', model:'Submariner ref.5513', caliber:'cal. 1520', years:'1962-1989', material:'acciaio', valueLow:12000, valueHigh:40000, desirability:10, grail:true, note:'Diver iconico. Quadranti meters-first, gilt, tropical = valori altissimi.' },
  'rolex gmt 1675': { brand:'Rolex', model:'GMT-Master ref.1675', caliber:'cal. 1565/1575', years:'1959-1980', material:'acciaio / oro / acciaio-oro', valueLow:10000, valueHigh:35000, desirability:10, grail:true, note:'Pepsi/root beer. Quadranti gilt e ghiere fading molto ricercati.' },
  'rolex explorer 1016': { brand:'Rolex', model:'Explorer ref.1016', caliber:'cal. 1560/1570', years:'1963-1989', material:'acciaio', valueLow:9000, valueHigh:25000, desirability:9, grail:true, note:'Quadrante nero, semplicità iconica. Gilt dial = premium enorme.' },
  'rolex oyster perpetual vintage': { brand:'Rolex', model:'Oyster Perpetual vintage', caliber:'cal. 1560/1570', years:'1960s-70s', material:'acciaio / oro cappato / oro', valueLow:1500, valueHigh:5000, desirability:6, note:'Entry vintage Rolex. Versioni bombay oro massiccio interessanti.' },
  'rolex precision vintage oro': { brand:'Rolex', model:'Oyster/Precision oro vintage', caliber:'cal. manuale', years:'1940s-60s', material:'oro 18k massiccio', valueLow:1800, valueHigh:5000, desirability:6, note:'Dress vintage oro massiccio ~35-45g. Spesso sottovalutati = occasioni metallo.' },

  // ═══════════════ LONGINES ═══════════════
  'longines conquest vintage': { brand:'Longines', model:'Conquest vintage', caliber:'cal. 19AS / 290', years:'1954-1970', material:'acciaio / oro cappato / oro 18k', valueLow:400, valueHigh:2500, desirability:6, note:'Automatici eleganti. Versioni oro massiccio ~32g. Molto sottovalutati.' },
  'longines flagship vintage': { brand:'Longines', model:'Flagship vintage', caliber:'cal. 340/341', years:'1957-1967', material:'acciaio / oro cappato / oro 18k', valueLow:500, valueHigh:2200, desirability:6, note:'Dress watch raffinato. Oro massiccio ~33g.' },
  'longines 13zn': { brand:'Longines', model:'Chrono cal. 13ZN', caliber:'cal. 13ZN', years:'1936-1947', material:'acciaio / oro', valueLow:15000, valueHigh:60000, desirability:10, grail:true, note:'Cronografo flyback leggendario. Tra i calibri più ricercati al mondo.' },
  'longines 30ch': { brand:'Longines', model:'Chrono cal. 30CH', caliber:'cal. 30CH', years:'1947-1960s', material:'acciaio / oro', valueLow:8000, valueHigh:30000, desirability:9, grail:true, note:'Cronografo manuale eccezionale, molto ricercato.' },
  'longines heritage vintage': { brand:'Longines', model:'vintage oro generico', caliber:'cal. manuale/auto', years:'1940s-60s', material:'oro 18k massiccio', valueLow:400, valueHigh:1500, desirability:5, note:'Dress oro massiccio. Spesso venduti sotto valore metallo.' },

  // ═══════════════ ZENITH ═══════════════
  'zenith el primero a386': { brand:'Zenith', model:'El Primero A386', caliber:'cal. 3019PHC (El Primero)', years:'1969-1971', material:'acciaio / oro', valueLow:12000, valueHigh:40000, desirability:10, grail:true, note:'Primo cronografo automatico al mondo. Quadrante tricolore iconico. A384/A386 i più ricercati.' },
  'zenith el primero vintage': { brand:'Zenith', model:'El Primero vintage', caliber:'cal. 3019/400', years:'1969-1980s', material:'acciaio / oro', valueLow:3000, valueHigh:10000, desirability:8, note:'Calibro storico. Versioni oro e varianti meno note ancora accessibili.' },
  'zenith vintage oro': { brand:'Zenith', model:'vintage oro dress', caliber:'cal. 2532/manuale', years:'1950s-60s', material:'oro 18k massiccio', valueLow:500, valueHigh:1800, desirability:5, note:'Dress oro massiccio ~40g. Sottovalutati.' },

  // ═══════════════ MOVADO ═══════════════
  'movado m95': { brand:'Movado', model:'Chronograph M95', caliber:'cal. M95', years:'1940s-50s', material:'acciaio / oro', valueLow:3000, valueHigh:12000, desirability:8, note:'Cronografo vintage molto ricercato, specie in oro massiccio.' },
  'movado calendograph': { brand:'Movado', model:'Calendograph', caliber:'cal. 475', years:'1940s-50s', material:'acciaio / oro', valueLow:1500, valueHigh:5000, desirability:7, note:'Triple calendario, esteticamente splendido. In crescita.' },
  'movado vintage oro': { brand:'Movado', model:'vintage oro dress', caliber:'cal. manuale', years:'1940s-60s', material:'oro 18k massiccio', valueLow:400, valueHigh:1400, desirability:5, note:'Dress oro massiccio. Brand sottovalutato = occasioni.' },

  // ═══════════════ UNIVERSAL GENÈVE ═══════════════
  'universal geneve polerouter': { brand:'Universal Genève', model:'Polerouter', caliber:'cal. 215/218 microrotor', years:'1954-1969', material:'acciaio / oro cappato / oro', valueLow:1500, valueHigh:6000, desirability:8, note:'Disegnato da Gérald Genta. Microrotor. In forte rivalutazione. Versioni oro ~31g.' },
  'universal geneve compax': { brand:'Universal Genève', model:'Compax / Tri-Compax', caliber:'cal. 281/287/481', years:'1940s-60s', material:'acciaio / oro', valueLow:3000, valueHigh:15000, desirability:9, grail:true, note:'Cronografi splendidi. Tri-Compax in oro = valori molto alti. Brand in piena riscoperta.' },
  'universal geneve vintage oro': { brand:'Universal Genève', model:'vintage oro dress', caliber:'cal. manuale/auto', years:'1940s-60s', material:'oro 18k massiccio', valueLow:600, valueHigh:2500, desirability:6, note:'Oro massiccio, brand in risalita. Buone occasioni.' },

  // ═══════════════ PATEK PHILIPPE ═══════════════
  'patek calatrava vintage': { brand:'Patek Philippe', model:'Calatrava vintage', caliber:'cal. 27SC / 12-400', years:'1940s-70s', material:'oro 18k massiccio', valueLow:8000, valueHigh:30000, desirability:9, grail:true, note:'Dress watch per eccellenza. Sempre oro massiccio. Ref.96, 2526, 3520 ricercatissime.' },
  'patek 2526': { brand:'Patek Philippe', model:'ref.2526 (primo automatico)', caliber:'cal. 12-600AT', years:'1953-1960', material:'oro 18k massiccio', valueLow:25000, valueHigh:80000, desirability:10, grail:true, note:'Primo automatico Patek. Quadrante smalto. Uno dei migliori calibri mai fatti.' },
  'patek nautilus 3700': { brand:'Patek Philippe', model:'Nautilus ref.3700', caliber:'cal. 28-255C', years:'1976-1990', material:'acciaio / oro', valueLow:60000, valueHigh:200000, desirability:10, grail:true, note:'Il Nautilus originale di Genta. Jumbo. Valori stratosferici.' },
  'patek vintage oro generico': { brand:'Patek Philippe', model:'vintage oro', caliber:'cal. manuale/auto', years:'1940s-70s', material:'oro 18k massiccio', valueLow:6000, valueHigh:25000, desirability:8, note:'Qualsiasi Patek vintage oro massiccio è prezioso. Verifica autenticità con estratto archivio.' },

  // ═══════════════ IWC ═══════════════
  'iwc ingenieur vintage': { brand:'IWC', model:'Ingenieur vintage', caliber:'cal. 852/8541', years:'1955-1970s', material:'acciaio / oro', valueLow:3000, valueHigh:12000, desirability:8, note:'Antimagnetico. Versione SL Genta ricercata. In crescita.' },
  'iwc portofino vintage': { brand:'IWC', model:'Portofino / dress vintage', caliber:'cal. 89', years:'1950s-60s', material:'oro 18k massiccio', valueLow:1500, valueHigh:5000, desirability:6, note:'Calibro 89 eccellente. Dress oro massiccio ~36g.' },
  'iwc yacht club': { brand:'IWC', model:'Yacht Club', caliber:'cal. 8541', years:'1967-1970s', material:'acciaio / oro', valueLow:2500, valueHigh:8000, desirability:7, note:'Automatico sportivo elegante. Sottovalutato, in crescita.' },

  // ═══════════════ JAEGER-LECOULTRE ═══════════════
  'jlc reverso vintage': { brand:'Jaeger-LeCoultre', model:'Reverso vintage', caliber:'cal. manuale', years:'1930s-1990s', material:'acciaio / oro', valueLow:2500, valueHigh:15000, desirability:9, grail:true, note:'Cassa girevole iconica Art Déco. Versioni oro e vintage anni 30 valori alti.' },
  'jlc memovox vintage': { brand:'Jaeger-LeCoultre', model:'Memovox', caliber:'cal. 814/825 (sveglia)', years:'1950s-70s', material:'acciaio / oro', valueLow:2000, valueHigh:8000, desirability:8, note:'Orologio-sveglia. Polaris diver memovox molto ricercato.' },
  'jlc vintage oro': { brand:'Jaeger-LeCoultre', model:'vintage oro dress', caliber:'cal. manuale/auto', years:'1940s-60s', material:'oro 18k massiccio', valueLow:800, valueHigh:3000, desirability:6, note:'Dress oro massiccio. Qualità alta sottovalutata.' },

  // ═══════════════ VACHERON CONSTANTIN ═══════════════
  'vacheron vintage oro': { brand:'Vacheron Constantin', model:'vintage oro dress', caliber:'cal. manuale/auto', years:'1940s-70s', material:'oro 18k massiccio', valueLow:5000, valueHigh:20000, desirability:9, grail:true, note:'Sempre oro massiccio. Alta orologeria. Ref.4178 chrono e dress vintage molto ricercati.' },
  'vacheron 222': { brand:'Vacheron Constantin', model:'ref.222', caliber:'cal. 1121', years:'1977-1985', material:'acciaio / oro', valueLow:25000, valueHigh:80000, desirability:10, grail:true, note:'Sport watch Genta-era, antenato dell\'Overseas. Valori esplosi negli ultimi anni.' },
  'vacheron chronometre royal': { brand:'Vacheron Constantin', model:'Chronomètre Royal', caliber:'cal. manuale cronometro', years:'1950s-60s', material:'oro 18k massiccio', valueLow:6000, valueHigh:20000, desirability:9, note:'Cronometro certificato vintage. Oro massiccio. Eccellente.' },

  // ═══════════════ HEUER ═══════════════
  'heuer carrera vintage': { brand:'Heuer', model:'Carrera vintage', caliber:'cal. Valjoux 72 / 11', years:'1963-1980s', material:'acciaio / oro', valueLow:5000, valueHigh:25000, desirability:9, grail:true, note:'Cronografo da corsa iconico. Ref.2447 e dato-compax ricercatissimi.' },
  'heuer autavia vintage': { brand:'Heuer', model:'Autavia vintage', caliber:'cal. Valjoux 72 / 11', years:'1962-1980s', material:'acciaio', valueLow:5000, valueHigh:30000, desirability:9, grail:true, note:'Cronografo racing/aviazione. Quadranti e ghiere varianti = grandi differenze di prezzo.' },
  'heuer monaco vintage': { brand:'Heuer', model:'Monaco ref.1133', caliber:'cal. 11 (Chronomatic)', years:'1969-1975', material:'acciaio', valueLow:15000, valueHigh:50000, desirability:10, grail:true, note:'Cassa quadrata iconica, McQueen. Primo crono automatico (insieme a Zenith/Seiko).' },

  // ═══════════════ TUDOR ═══════════════
  'tudor submariner vintage': { brand:'Tudor', model:'Submariner vintage', caliber:'cal. ETA', years:'1954-1990s', material:'acciaio', valueLow:5000, valueHigh:25000, desirability:9, grail:true, note:'Snowflake dial molto ricercato. Alternativa accessibile al Rolex Sub vintage.' },
  'tudor vintage oro': { brand:'Tudor', model:'Oyster/dress vintage oro', caliber:'cal. ETA/manuale', years:'1950s-70s', material:'oro cappato / acciaio', valueLow:600, valueHigh:2500, desirability:5, note:'Spesso gold-capped non massiccio. Verifica bene.' },
};

// ─────────────────────────────────────────────
// MATCH MODELLO VINTAGE DAL TITOLO
// ─────────────────────────────────────────────
function findVintageModel(title) {
  if (!title) return null;
  const t = title.toLowerCase().replace(/[''`.]/g,' ').replace(/\s+/g,' ').trim();

  let bestMatch = null, bestScore = 0;
  for (const [key, data] of Object.entries(VINTAGE_DB)) {
    const keyWords = key.split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w) || w.length >= 4);
    let score = 0;
    // Punteggio per parole chiave matchate
    for (const w of keyWords) {
      if (t.includes(w)) score += w.length > 4 ? 2 : 1;
    }
    // Bonus brand match
    if (t.includes(data.brand.toLowerCase().split(' ')[0])) score += 2;
    // Bonus referenza esatta
    const refInKey = key.match(/\d{3,6}|a3\d\d|m95|13zn|30ch|222|2526|3700/);
    if (refInKey && t.includes(refInKey[0])) score += 5;
    // Bonus calibro
    if (data.caliber) {
      const calNum = data.caliber.match(/\d{2,4}/);
      if (calNum && t.includes(calNum[0])) score += 4;
    }
    if (score > bestScore) { bestScore = score; bestMatch = { key, ...data, matchScore: score }; }
  }
  // Soglia minima per evitare falsi positivi
  return bestScore >= 4 ? bestMatch : null;
}

// Valuta se un prezzo è un'occasione rispetto al valore di mercato
function evaluateVintageDeal(title, priceEur) {
  const model = findVintageModel(title);
  if (!model) return null;
  const midValue = (model.valueLow + model.valueHigh) / 2;
  const discountVsLow = Math.round(((model.valueLow - priceEur) / model.valueLow) * 100);
  const discountVsMid = Math.round(((midValue - priceEur) / midValue) * 100);
  return {
    model: model.model, brand: model.brand, caliber: model.caliber,
    years: model.years, material: model.material,
    valueLow: model.valueLow, valueHigh: model.valueHigh, midValue: Math.round(midValue),
    desirability: model.desirability, grail: model.grail || false, note: model.note,
    discountVsLow, discountVsMid,
    isDeal: priceEur < model.valueLow,          // sotto il minimo di mercato = occasione
    isGoodDeal: priceEur < model.valueLow * 0.85, // 15%+ sotto minimo = ottima occasione
    isGrailDeal: (model.grail && priceEur < model.valueLow),
  };
}

module.exports = { VINTAGE_DB, findVintageModel, evaluateVintageDeal };
