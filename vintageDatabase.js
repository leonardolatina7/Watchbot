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

  // ═══════════════ OMEGA (espansione) ═══════════════
  'omega seamaster 300 spectre': { brand:'Omega', model:'Seamaster 300 Master Co-Axial', caliber:'cal. 8400', years:'2014-oggi', material:'acciaio', valueLow:3000, valueHigh:6000, desirability:7, note:'Diver moderno molto apprezzato. Spectre LE ricercata.' },
  'omega ranchero': { brand:'Omega', model:'Ranchero', caliber:'cal. 267', years:'1958-1963', material:'acciaio', valueLow:4000, valueHigh:12000, desirability:8, note:'Raro, quadrante a numeri. Molto ricercato dai collezionisti Omega.' },
  'omega railmaster vintage': { brand:'Omega', model:'Railmaster CK2914', caliber:'cal. 284/285', years:'1957-1963', material:'acciaio', valueLow:8000, valueHigh:25000, desirability:9, grail:true, note:'Parte della trilogia 1957. Antimagnetico. Rarissimo originale.' },
  'omega seamaster ploprof': { brand:'Omega', model:'Seamaster PloProf 600', caliber:'cal. 1002', years:'1970-1979', material:'acciaio', valueLow:6000, valueHigh:18000, desirability:8, note:'Diver professionale iconico, design brutale. In crescita.' },
  'omega de ville oro': { brand:'Omega', model:'De Ville vintage oro', caliber:'cal. 620/625', years:'1960s-70s', material:'oro 18k / oro cappato', valueLow:500, valueHigh:2000, desirability:5, note:'Dress sottile. Versioni oro massiccio sottovalutate.' },
  'omega chronostop': { brand:'Omega', model:'Chronostop', caliber:'cal. 865', years:'1966-1972', material:'acciaio', valueLow:800, valueHigh:2500, desirability:6, note:'Mono-pulsante driver. Quadranti racing ricercati.' },
  'omega geneve dynamic': { brand:'Omega', model:'Genève Dynamic', caliber:'cal. 565', years:'1968-1970s', material:'acciaio', valueLow:400, valueHigh:1200, desirability:5, note:'Design ellittico anni 70. Cult crescente.' },

  // ═══════════════ ROLEX (espansione) ═══════════════
  'rolex daytona 6263': { brand:'Rolex', model:'Daytona ref.6263', caliber:'cal. 727', years:'1971-1988', material:'acciaio / oro', valueLow:80000, valueHigh:250000, desirability:10, grail:true, note:'Cosmograph manuale leggendario. Paul Newman dial = milioni.' },
  'rolex daytona 6239': { brand:'Rolex', model:'Daytona ref.6239', caliber:'cal. 722', years:'1963-1969', material:'acciaio / oro', valueLow:60000, valueHigh:200000, desirability:10, grail:true, note:'Prima Daytona. Paul Newman valori record.' },
  'rolex air-king vintage': { brand:'Rolex', model:'Air-King ref.5500', caliber:'cal. 1520', years:'1957-1989', material:'acciaio', valueLow:2500, valueHigh:6000, desirability:6, note:'Entry vintage Rolex. Quadranti speciali (Domino, Comex) valgono molto.' },
  'rolex sea-dweller 1665': { brand:'Rolex', model:'Sea-Dweller ref.1665', caliber:'cal. 1570', years:'1967-1983', material:'acciaio', valueLow:18000, valueHigh:60000, desirability:9, grail:true, note:'Double Red / Great White ricercatissimi. Diver professionale.' },
  'rolex milgauss 1019': { brand:'Rolex', model:'Milgauss ref.1019', caliber:'cal. 1580', years:'1960-1988', material:'acciaio', valueLow:15000, valueHigh:45000, desirability:9, grail:true, note:'Antimagnetico per scienziati. CERN dial raro.' },
  'rolex datejust 16014': { brand:'Rolex', model:'Datejust ref.16014', caliber:'cal. 3035', years:'1977-1988', material:'acciaio / acciaio-oro', valueLow:3000, valueHigh:7000, desirability:6, note:'Quadranti vignette, blu, particolari = premium.' },
  'rolex oysterquartz': { brand:'Rolex', model:'Oysterquartz Datejust', caliber:'cal. 5035', years:'1977-2001', material:'acciaio / oro', valueLow:4000, valueHigh:12000, desirability:7, note:'Cassa angolare integrata Genta-style. Cult in forte crescita.' },
  'rolex thunderbird': { brand:'Rolex', model:'Datejust Turn-O-Graph', caliber:'cal. 1570', years:'1960s-70s', material:'acciaio / acciaio-oro', valueLow:4000, valueHigh:10000, desirability:7, note:'Ghiera girevole, raro. Sottovalutato.' },

  // ═══════════════ PATEK (espansione) ═══════════════
  'patek 3940 perpetual': { brand:'Patek Philippe', model:'ref.3940 Perpetual Calendar', caliber:'cal. 240Q', years:'1985-2007', material:'oro 18k / platino', valueLow:40000, valueHigh:100000, desirability:10, grail:true, note:'Calendario perpetuo sottile iconico. Philippe Stern preferito.' },
  'patek 3970': { brand:'Patek Philippe', model:'ref.3970 Perpetual Chrono', caliber:'cal. CH 27-70 Q', years:'1986-2004', material:'oro 18k / platino', valueLow:90000, valueHigh:250000, desirability:10, grail:true, note:'Crono perpetuo. Uno dei Patek moderni più ricercati.' },
  'patek aquanaut 5060': { brand:'Patek Philippe', model:'Aquanaut ref.5060', caliber:'cal. 330 SC', years:'1997-2006', material:'acciaio', valueLow:25000, valueHigh:50000, desirability:9, grail:true, note:'Primo Aquanaut. Tropical strap. In forte ascesa.' },
  'patek ellipse oro': { brand:'Patek Philippe', model:'Golden Ellipse', caliber:'cal. 240', years:'1968-oggi', material:'oro 18k', valueLow:6000, valueHigh:20000, desirability:8, note:'Proporzione aurea, quadrante blu oro. Dress iconico sottovalutato.' },
  'patek gondolo': { brand:'Patek Philippe', model:'Gondolo', caliber:'cal. 215', years:'1990s-2000s', material:'oro 18k', valueLow:8000, valueHigh:22000, desirability:8, note:'Art Déco rettangolare. Oro massiccio.' },

  // ═══════════════ AUDEMARS PIGUET (espansione) ═══════════════
  'ap royal oak 5402': { brand:'Audemars Piguet', model:'Royal Oak ref.5402 A-series', caliber:'cal. 2121', years:'1972-1977', material:'acciaio', valueLow:80000, valueHigh:250000, desirability:10, grail:true, note:'Il primo Royal Oak di Genta. Jumbo A-series valori record.' },
  'ap royal oak 14790': { brand:'Audemars Piguet', model:'Royal Oak ref.14790', caliber:'cal. 2225', years:'1992-2005', material:'acciaio / acciaio-oro', valueLow:12000, valueHigh:30000, desirability:8, note:'Mid-size classico. Accessibile rispetto al jumbo.' },
  'ap royal oak offshore 25721': { brand:'Audemars Piguet', model:'Royal Oak Offshore "The Beast"', caliber:'cal. 2126', years:'1993-2003', material:'acciaio', valueLow:20000, valueHigh:50000, desirability:9, grail:true, note:'Primo Offshore. Cult assoluto, in forte crescita.' },

  // ═══════════════ VACHERON (espansione) ═══════════════
  'vacheron overseas vintage': { brand:'Vacheron Constantin', model:'Overseas prima serie ref.42042', caliber:'cal. 1310', years:'1996-2004', material:'acciaio', valueLow:8000, valueHigh:18000, desirability:8, note:'Erede del 222. Sport watch sottovalutato.' },
  'vacheron 4178 chrono': { brand:'Vacheron Constantin', model:'ref.4178 Chronograph', caliber:'cal. Valjoux 22', years:'1940s-50s', material:'oro 18k', valueLow:40000, valueHigh:120000, desirability:10, grail:true, note:'Crono vintage oro leggendario. Valori da capogiro.' },
  'vacheron 222 oro': { brand:'Vacheron Constantin', model:'ref.222 Jumbo oro', caliber:'cal. 1121', years:'1977-1985', material:'oro 18k', valueLow:40000, valueHigh:120000, desirability:10, grail:true, note:'Versione oro del 222. Rarissimo.' },

  // ═══════════════ JAEGER-LECOULTRE (espansione) ═══════════════
  'jlc deep sea alarm': { brand:'Jaeger-LeCoultre', model:'Deep Sea Alarm', caliber:'cal. 815', years:'1959-1960s', material:'acciaio', valueLow:8000, valueHigh:25000, desirability:9, grail:true, note:'Diver con sveglia rarissimo. Ricercatissimo.' },
  'jlc geophysic': { brand:'Jaeger-LeCoultre', model:'Geophysic', caliber:'cal. 478BWSbr', years:'1958', material:'acciaio / oro', valueLow:6000, valueHigh:20000, desirability:9, grail:true, note:'IGY 1958, antimagnetico. Reissue 2014 cult. Originali rari.' },
  'jlc futurematic': { brand:'Jaeger-LeCoultre', model:'Futurematic', caliber:'cal. 497/817', years:'1953-1959', material:'acciaio / oro', valueLow:2000, valueHigh:7000, desirability:7, note:'Senza corona, power reserve. Design unico anni 50.' },

  // ═══════════════ HEUER (espansione) ═══════════════
  'heuer monaco 1133b': { brand:'Heuer', model:'Monaco ref.1133B (McQueen blue)', caliber:'cal. 11', years:'1969-1975', material:'acciaio', valueLow:30000, valueHigh:80000, desirability:10, grail:true, note:'Il Monaco blu di Steve McQueen in Le Mans. Iconico.' },
  'heuer skipper': { brand:'Heuer', model:'Carrera Skipper', caliber:'cal. Valjoux 7730 / 15', years:'1968-1980s', material:'acciaio', valueLow:10000, valueHigh:40000, desirability:9, grail:true, note:'Quadrante regata "Skipperera" verde/blu. Rarissimo.' },
  'heuer camaro': { brand:'Heuer', model:'Camaro', caliber:'cal. Valjoux 72/7733', years:'1968-1972', material:'acciaio', valueLow:4000, valueHigh:12000, desirability:8, note:'Cassa cuscino. Sottovalutato vs Carrera/Autavia.' },
  'heuer monza': { brand:'Heuer', model:'Monza', caliber:'cal. 15', years:'1976-1980s', material:'acciaio PVD', valueLow:6000, valueHigh:18000, desirability:8, note:'Niki Lauda. Cassa nera. Cult crescente.' },

  // ═══════════════ ZENITH (espansione) ═══════════════
  'zenith a384': { brand:'Zenith', model:'El Primero A384', caliber:'cal. 3019PHC', years:'1969-1971', material:'acciaio', valueLow:10000, valueHigh:30000, desirability:10, grail:true, note:'Cassa tonneau, quadrante panda. Tra i primi El Primero.' },
  'zenith defy vintage': { brand:'Zenith', model:'Defy vintage', caliber:'cal. 2562PC', years:'1969-1970s', material:'acciaio', valueLow:2000, valueHigh:6000, desirability:7, note:'Cassa ottagonale, ghiera scolpita. In riscoperta.' },
  'zenith captain vintage': { brand:'Zenith', model:'Captain vintage oro', caliber:'cal. 2542', years:'1960s', material:'oro 18k / acciaio', valueLow:600, valueHigh:2000, desirability:5, note:'Dress automatico. Oro massiccio sottovalutato.' },

  // ═══════════════ IWC (espansione) ═══════════════
  'iwc mark xi': { brand:'IWC', model:'Mark XI', caliber:'cal. 89', years:'1948-1984', material:'acciaio', valueLow:6000, valueHigh:20000, desirability:9, grail:true, note:'Orologio militare RAF. Antimagnetico. Icona pilot watch.' },
  'iwc aquatimer vintage': { brand:'IWC', model:'Aquatimer ref.812', caliber:'cal. 8541', years:'1967-1982', material:'acciaio', valueLow:8000, valueHigh:25000, desirability:9, grail:true, note:'Primo diver IWC. Ghiera interna. Rarissimo originale.' },
  'iwc da vinci vintage': { brand:'IWC', model:'Da Vinci SL', caliber:'cal. 375', years:'1969-1970s', material:'acciaio / oro', valueLow:2000, valueHigh:6000, desirability:7, note:'Genta design. Cassa integrata. Sottovalutato.' },

  // ═══════════════ LONGINES (espansione) ═══════════════
  'longines ultra-chron': { brand:'Longines', model:'Ultra-Chron', caliber:'cal. 431', years:'1967-1970s', material:'acciaio / oro', valueLow:800, valueHigh:3000, desirability:6, note:'Alta frequenza 36000 vph. Diver version ricercata.' },
  'longines admiral vintage': { brand:'Longines', model:'Admiral', caliber:'cal. 505/431', years:'1960s-70s', material:'acciaio / oro cappato', valueLow:500, valueHigh:1800, desirability:5, note:'Automatico cinque stelle. Quadranti particolari ricercati.' },
  'longines legend diver': { brand:'Longines', model:'Legend Diver vintage', caliber:'cal. 290', years:'1960s', material:'acciaio', valueLow:4000, valueHigh:12000, desirability:8, grail:true, note:'Super-compressor diver. Reissue cult, originali rari.' },
  'longines silver arrow': { brand:'Longines', model:'Silver Arrow', caliber:'cal. 19AS', years:'1950s', material:'acciaio / oro', valueLow:1500, valueHigh:5000, desirability:7, note:'Mid-century design, lancetta a freccia. Da collezione.' },

  // ═══════════════ UNIVERSAL GENÈVE (espansione) ═══════════════
  'universal geneve white shadow': { brand:'Universal Genève', model:'White Shadow', caliber:'cal. 1-66 microrotor', years:'1970s', material:'acciaio / oro', valueLow:1000, valueHigh:3500, desirability:7, note:'Microrotor più sottile del mondo all\'epoca. Cult.' },
  'universal geneve space-compax': { brand:'Universal Genève', model:'Space-Compax', caliber:'cal. 146', years:'1960s-70s', material:'acciaio', valueLow:4000, valueHigh:14000, desirability:9, grail:true, note:'Crono space age, Nina Rindt panda dial = grail assoluto.' },
  'universal geneve aero-compax': { brand:'Universal Genève', model:'Aero-Compax', caliber:'cal. 130/481', years:'1940s-60s', material:'acciaio / oro', valueLow:3000, valueHigh:12000, desirability:8, note:'Crono pilota con sveglia. Splendido.' },

  // ═══════════════ ALTRI BRAND DA OCCASIONE ═══════════════
  'breitling navitimer vintage': { brand:'Breitling', model:'Navitimer vintage', caliber:'cal. Venus 178 / cal.11', years:'1952-1980s', material:'acciaio', valueLow:5000, valueHigh:20000, desirability:9, grail:true, note:'Regolo calcolatore pilota. AOPA dial ricercato.' },
  'breitling top time': { brand:'Breitling', model:'Top Time', caliber:'cal. Venus 178', years:'1964-1970s', material:'acciaio', valueLow:3000, valueHigh:12000, desirability:8, note:'James Bond Thunderball. Quadranti reverse panda ricercati.' },
  'breitling chronomat vintage': { brand:'Breitling', model:'Chronomat 808', caliber:'cal. Venus 175', years:'1940s-60s', material:'acciaio / oro', valueLow:3000, valueHigh:10000, desirability:8, note:'Regolo circolare. Crono storico Breitling.' },
  'seiko 6139 pogue': { brand:'Seiko', model:'6139 "Pogue"', caliber:'cal. 6139', years:'1969-1970s', material:'acciaio', valueLow:800, valueHigh:3000, desirability:7, note:'Primo crono automatico nello spazio. Quadrante giallo Pogue cult.' },
  'seiko 6105 diver': { brand:'Seiko', model:'6105 Diver "Captain Willard"', caliber:'cal. 6105', years:'1968-1977', material:'acciaio', valueLow:1500, valueHigh:5000, desirability:8, grail:true, note:'Apocalypse Now. Cassa asimmetrica. Cult diver crescente.' },
  'seiko 62mas': { brand:'Seiko', model:'62MAS prima serie diver', caliber:'cal. 6217', years:'1965-1968', material:'acciaio', valueLow:3000, valueHigh:10000, desirability:9, grail:true, note:'Primo diver Seiko. Rarissimo originale.' },
  'grand seiko vintage': { brand:'Grand Seiko', model:'62GS / 44GS vintage', caliber:'cal. 5722 / 4420', years:'1960s', material:'acciaio / oro cappato', valueLow:1500, valueHigh:6000, desirability:8, note:'Finitura Zaratsu leggendaria. In forte rivalutazione mondiale.' },
  'eberhard chrono vintage': { brand:'Eberhard', model:'Chronograph vintage', caliber:'cal. Valjoux', years:'1940s-60s', material:'acciaio / oro', valueLow:1500, valueHigh:6000, desirability:7, note:'Crono italiani ricercati. Extra-fort e pre-extra molto richiesti.' },
  'girard perregaux gyromatic': { brand:'Girard-Perregaux', model:'Gyromatic / vintage oro', caliber:'cal. GP', years:'1950s-60s', material:'acciaio / oro 18k', valueLow:500, valueHigh:2500, desirability:5, note:'Manifattura sottovalutata. Oro massiccio occasioni.' },
  'girard perregaux laureato vintage': { brand:'Girard-Perregaux', model:'Laureato prima serie', caliber:'cal. 705 quartz / auto', years:'1975-1980s', material:'acciaio', valueLow:4000, valueHigh:12000, desirability:8, note:'Sport watch integrato anni 70. In forte crescita.' },
  'enicar sherpa': { brand:'Enicar', model:'Sherpa Graph / Guide', caliber:'cal. Valjoux 72 / 724', years:'1960s', material:'acciaio', valueLow:3000, valueHigh:12000, desirability:8, grail:true, note:'Crono e GMT da spedizione. Jim Clark. Cult assoluto.' },
  'doxa sub 300': { brand:'Doxa', model:'SUB 300 "Black Lung"', caliber:'cal. ETA', years:'1967-1970s', material:'acciaio', valueLow:3000, valueHigh:10000, desirability:8, grail:true, note:'Diver arancione iconico. Cousteau. Cult crescente.' },
  'tissot navigator vintage': { brand:'Tissot', model:'Navigator / Seastar vintage', caliber:'cal. 2481', years:'1960s-70s', material:'acciaio / oro cappato', valueLow:400, valueHigh:1500, desirability:5, note:'Crono e diver vintage sottovalutati. Buone occasioni.' },
  'mido multifort vintage': { brand:'Mido', model:'Multifort vintage', caliber:'cal. auto', years:'1940s-60s', material:'acciaio / oro cappato', valueLow:300, valueHigh:1200, desirability:4, note:'Automatici robusti. Spesso sotto valore.' },
  'wittnauer chrono vintage': { brand:'Wittnauer', model:'Chronograph vintage', caliber:'cal. Valjoux 72', years:'1950s-60s', material:'acciaio', valueLow:2000, valueHigh:7000, desirability:7, note:'Crono professionali sottovalutati. 72 col stesso movimento Daytona.' },

  // ═══════════════════════════════════════════════════════════════
  // GIOIELLI DIMENTICATI — marchi di qualità sottovalutati,
  // alto potenziale di rivalutazione. Il territorio dei veri affari.
  // ═══════════════════════════════════════════════════════════════

  // ── NIVADA GRENCHEN (svizzera, tool watch, in piena risalita) ──
  'nivada chronomaster aviator': { brand:'Nivada Grenchen', model:'Chronomaster Aviator Sea Diver', caliber:'Valjoux 92 / Venus 210 / Landeron 248', years:'1960s', material:'acciaio', valueLow:1000, valueHigh:4000, desirability:8, sleeper:true, note:'Crono diver/aviazione iconico. In salita costante. Croton = stesso brand per USA. Verifica movimento (varia).' },
  'nivada antarctic': { brand:'Nivada Grenchen', model:'Antarctic', caliber:'auto ETA', years:'1950s-60s', material:'acciaio', valueLow:500, valueHigh:1800, desirability:7, sleeper:true, note:'Robusto da spedizione antartica. Reissue moderno ha riacceso interesse. Originali sottovalutati.' },
  'nivada depthmaster': { brand:'Nivada Grenchen', model:'Depthmaster', caliber:'auto', years:'1965+', material:'acciaio', valueLow:1500, valueHigh:5000, desirability:8, sleeper:true, note:'Diver 1000m, cassa compressore chunky. Raro, molto ricercato dai connoisseur.' },

  // ── GALLET (crono per professioni, connoisseur brand) ──
  'gallet multichron': { brand:'Gallet', model:'MultiChron / Decimal / Yachting', caliber:'Excelsior Park 4 / Valjoux 72', years:'1940s-60s', material:'acciaio', valueLow:1500, valueHigh:6000, desirability:8, sleeper:true, note:'Crono professionali splendidi, movimenti Excelsior Park/Valjoux. Marchio da conoscitori, sottovalutato vs qualità.' },
  'gallet flying officer': { brand:'Gallet', model:'Flying Officer', caliber:'Venus 178 / Excelsior Park', years:'1940s-50s', material:'acciaio / placcato', valueLow:1800, valueHigh:7000, desirability:8, sleeper:true, note:'Crono pilota con secondo fuso, voluto da Truman. Storia + qualità, prezzi ancora umani.' },

  // ── EXCELSIOR PARK (manifattura di calibri crono leggendari) ──
  'excelsior park chrono': { brand:'Excelsior Park', model:'Chronograph', caliber:'EP cal. 40 / 4 (manifattura)', years:'1940s-60s', material:'acciaio', valueLow:1500, valueHigh:6000, desirability:8, sleeper:true, note:'Facevano i movimenti per Gallet e altri. Crono di manifattura purissima, ignorato dal mercato di massa.' },

  // ── WAKMANN (Breitling-partner, Valjoux 72 economici) ──
  'wakmann triple date': { brand:'Wakmann', model:'Triple Date Chronograph', caliber:'Valjoux 72C / 730', years:'1950s-60s', material:'acciaio', valueLow:1200, valueHigh:4500, desirability:7, sleeper:true, note:'Stesso Valjoux 72 del Daytona, frazione del prezzo. Legato a Breitling. Ottimo entry crono di qualità.' },

  // ── ETERNA (manifattura, primo con cuscinetti a sfera) ──
  'eterna kontiki vintage': { brand:'Eterna', model:'KonTiki vintage', caliber:'Eterna-Matic (manifattura)', years:'1958-70s', material:'acciaio', valueLow:600, valueHigh:2500, desirability:7, sleeper:true, note:'Diver legato alla spedizione KonTiki. Eterna-Matic coi 5 cuscinetti a sfera (il logo). Manifattura sottovalutata.' },
  'eterna 1856 vintage': { brand:'Eterna', model:'dress vintage manifattura', caliber:'Eterna-Matic', years:'1950s-60s', material:'oro / acciaio', valueLow:400, valueHigh:1500, desirability:6, sleeper:true, note:'Una delle grandi manifatture dimenticate. Qualità alta, prezzi bassissimi. Da prendere ora.' },

  // ── GIRARD-PERREGAUX (manifattura, calibro 32A high-beat storico) ──
  'girard perregaux gyromatic hf': { brand:'Girard-Perregaux', model:'Gyromatic HF cal. 32A', caliber:'GP cal. 32A (high-beat 36000, manifattura)', years:'1966+', material:'oro / acciaio', valueLow:600, valueHigh:2500, desirability:8, sleeper:true, note:'Primo high-beat commerciale al mondo, importanza storica enorme. Manifattura. Prezzi ridicoli per ciò che è.' },
  'girard perregaux sea hawk vintage': { brand:'Girard-Perregaux', model:'Sea Hawk / Gyromatic vintage', caliber:'GP Gyromatic', years:'1950s-60s', material:'acciaio / oro', valueLow:500, valueHigh:2000, desirability:7, sleeper:true, note:'Manifattura sottovalutata, qualità pari a Omega/Zenith dello stesso periodo a meno della metà.' },

  // ── ZENITH (calibro 135 cronometro, A277 crono sleeper) ──
  'zenith 135 chronometre': { brand:'Zenith', model:'Cal. 135 Chronomètre', caliber:'Zenith 135 (record di concorsi cronometria)', years:'1949-1962', material:'oro / acciaio', valueLow:1500, valueHigh:6000, desirability:9, sleeper:true, grail:true, note:'Il calibro che vinse più concorsi di cronometria di sempre. Pezzo da conoscitori assoluti, ancora accessibile.' },
  'zenith a277 chrono': { brand:'Zenith', model:'A277 Chronograph', caliber:'Zenith 146HP (base Martel)', years:'1960s', material:'acciaio', valueLow:2000, valueHigh:7000, desirability:8, sleeper:true, note:'Crono diver pre-El Primero, sottovalutato. 38mm, ghiera, lume. Sleeper vero degli anni 60.' },

  // ── LONGINES (calibri manifattura 30CH, 13ZN già in lista alta) ──
  'longines 30ch chrono': { brand:'Longines', model:'Chronograph cal. 30CH', caliber:'Longines 30CH (manifattura, monopulsante)', years:'1947-60s', material:'acciaio / oro', valueLow:5000, valueHigh:20000, desirability:9, sleeper:true, grail:true, note:'Manifattura Longines purissima. In forte rivalutazione, ma ancora sotto i big.' },

  // ── DOXA (Sub diver, arancione iconico) ──
  'doxa sub 300t': { brand:'Doxa', model:'SUB 300T Conquistador', caliber:'ETA', years:'1960s-70s', material:'acciaio', valueLow:1500, valueHigh:5000, desirability:8, sleeper:true, note:'Diver arancione amato da Cousteau. Cult crescente, originali vintage ancora abbordabili.' },

  // ── ENICAR (Sherpa, spedizioni himalayane) ──
  'enicar sherpa graph': { brand:'Enicar', model:'Sherpa Graph / Sherpa Guide', caliber:'Valjoux 72 / 724', years:'1960s', material:'acciaio', valueLow:2500, valueHigh:9000, desirability:8, sleeper:true, note:'Crono e GMT da spedizione, Jim Clark lo indossava. Cult tra connoisseur, sleeper di qualità.' },

  // ── VULCAIN (Cricket, sveglia, "orologio dei presidenti") ──
  'vulcain cricket': { brand:'Vulcain', model:'Cricket', caliber:'Vulcain 120 (sveglia, manifattura)', years:'1947-70s', material:'acciaio / oro / placcato', valueLow:500, valueHigh:2500, desirability:7, sleeper:true, note:'Prima sveglia da polso affidabile, indossata dai presidenti USA. Manifattura, storia, prezzi bassi.' },

  // ── MIDO (Multifort, robustezza, sottovalutato) ──
  'mido multifort vintage2': { brand:'Mido', model:'Multifort / Powerwind vintage', caliber:'auto manifattura epoca', years:'1930s-60s', material:'acciaio / oro placcato', valueLow:300, valueHigh:1200, desirability:6, sleeper:true, note:'Automatici robustissimi, antimagnetici/impermeabili in anticipo sui tempi. Molto sotto valore.' },

  // ── LIP (francese, calibri propri, design space-age) ──
  'lip vintage chrono': { brand:'LIP', model:'Chronograph / Nautic-Ski / Mach 2000', caliber:'LIP / Valjoux', years:'1950s-70s', material:'acciaio', valueLow:400, valueHigh:2000, desirability:7, sleeper:true, note:'Manifattura francese, design Roger Tallon (Mach 2000) e diver Nautic-Ski. Cult di nicchia in crescita.' },

  // ── UNIVERSAL GENÈVE (già in lista, qui il microrotor dimenticato) ──
  'universal geneve polerouter sub': { brand:'Universal Genève', model:'Polerouter Sub / Date', caliber:'UG microrotor 215/218 (manifattura)', years:'1955-69', material:'acciaio / oro placcato', valueLow:1200, valueHigh:5000, desirability:8, sleeper:true, note:'Genta + microrotor di manifattura. In piena rivalutazione, ma ancora margine rispetto ai big.' },

  // ── TISSOT (i crono Lemania/Lemania-powered sottovalutati) ──
  'tissot seastar chrono vintage': { brand:'Tissot', model:'Seastar Chronograph (Lemania)', caliber:'Lemania 1277 / Valjoux', years:'1960s-70s', material:'acciaio', valueLow:600, valueHigh:2500, desirability:7, sleeper:true, note:'Crono Tissot con base Lemania (stesso DNA di Omega Speedmaster). Incredibilmente sottovalutati.' },

  // ── FAVRE-LEUBA (2a marca svizzera più antica, Bivouac/Bathy) ──
  'favre leuba bivouac': { brand:'Favre-Leuba', model:'Bivouac / Bathy', caliber:'FL manifattura (altimetro/profondimetro)', years:'1960s-70s', material:'acciaio', valueLow:1500, valueHigh:6000, desirability:8, sleeper:true, note:'Primo orologio meccanico con altimetro (Bivouac). Manifattura storica, sleeper tecnico raro.' },

  // ── BENRUS / CROTON / WALTHAM (americani-svizzeri sottovalutati) ──
  'benrus sky chief': { brand:'Benrus', model:'Sky Chief / Citation Chronograph', caliber:'Valjoux 72 / Venus', years:'1940s-60s', material:'acciaio / placcato', valueLow:600, valueHigh:2500, desirability:6, sleeper:true, note:'Crono americani con movimenti svizzeri di qualità. Molto sotto i pari europei.' },

  // ═══════════════════════════════════════════════════════════════
  // TESORI NASCOSTI — i nomi che fanno dire "questo chi è?".
  // Marchi oscuri ma con orologeria seria. Roba da scovare a poco.
  // ═══════════════════════════════════════════════════════════════

  // ── OLLECH & WAJS (O&W) — tool watch militari Vietnam, Valjoux ──
  'ollech wajs caribbean': { brand:'Ollech & Wajs', model:'Caribbean 1000 / M-series diver', caliber:'ETA auto (cassa 1000m)', years:'1960s-70s', material:'acciaio', valueLow:500, valueHigh:2000, desirability:7, sleeper:true, note:'Diver svizzero oscuro, 1000m, usato in Vietnam. Cult tra i pochi che lo conoscono. Stesso fornitori di Rolex/Breitling.' },
  'ollech wajs chrono': { brand:'Ollech & Wajs', model:'Chronograph / Aviation', caliber:'Valjoux 72/92/7733', years:'1960s-70s', material:'acciaio', valueLow:700, valueHigh:3000, desirability:7, sleeper:true, note:'Crono con Valjoux veri (stesso del Daytona), assemblati con stock Breitling Navitimer. Quasi sconosciuto, ottimo affare.' },

  // ── AIRAIN — Type 20 militare francese, sleeper assoluto ──
  'airain type 20': { brand:'Airain', model:'Type 20 / Sous-Marine', caliber:'Valjoux 22 / flyback', years:'1950s-60s', material:'acciaio', valueLow:2000, valueHigh:8000, desirability:8, sleeper:true, note:'Crono militare flyback Type 20 francese, fratello povero del Breguet Type 20. Riscoperto da poco, in salita.' },

  // ── YEMA — Yachtingraf, Superman diver, francese ──
  'yema yachtingraf': { brand:'Yema', model:'Yachtingraf / Rallygraf', caliber:'Valjoux 7730/92', years:'1960s-70s', material:'acciaio', valueLow:1000, valueHigh:4500, desirability:7, sleeper:true, note:'Crono regata francese con disco colorato, cult crescente. Superman diver pure ricercato. Sottovalutato vs estetica.' },
  'yema superman': { brand:'Yema', model:'Superman diver', caliber:'auto FE/ETA', years:'1960s-70s', material:'acciaio', valueLow:800, valueHigh:3000, desirability:7, sleeper:true, note:'Diver con blocco ghiera caratteristico. Storia militare francese. In rivalutazione.' },

  // ── EBERHARD pre-Extra Fort — crono italiani di pregio ──
  'eberhard pre extra fort': { brand:'Eberhard', model:'Pre-Extra-Fort / Extra-Fort', caliber:'Eberhard/Valjoux (monopulsante early)', years:'1930s-50s', material:'acciaio / oro', valueLow:2000, valueHigh:8000, desirability:8, sleeper:true, note:'Crono pre-1950 molto ricercati dai conoscitori italiani. Tipografia e qualità uniche. Sleeper di pregio.' },

  // ── LEMANIA — la manifattura crono dietro Omega/Patek ──
  'lemania branded chrono': { brand:'Lemania', model:'Chronograph (a marchio proprio)', caliber:'Lemania 27CH/15TL/2310 (manifattura)', years:'1940s-70s', material:'acciaio / placcato', valueLow:800, valueHigh:4000, desirability:8, sleeper:true, note:'Lemania faceva i movimenti per Omega Speedmaster e Patek! I crono a marchio Lemania sono purissima manifattura, quasi ignorati. Affare di qualità raro.' },

  // ── NIVADA Depthomatic / Aviator Sea Diver varianti ──
  'nivada depthomatic': { brand:'Nivada Grenchen', model:'Depthomatic', caliber:'auto', years:'1960s', material:'acciaio', valueLow:1500, valueHigh:5000, desirability:8, sleeper:true, note:'Primo diver con profondimetro a depressione. Pezzo tecnico raro, da conoscitori assoluti.' },

  // ── CROTON — marchio USA di Nivada, crono economici di qualità ──
  'croton chronomaster': { brand:'Croton', model:'Chronomaster Aviator Sea Diver', caliber:'Valjoux 92 / Venus 210', years:'1960s', material:'acciaio', valueLow:800, valueHigh:3000, desirability:7, sleeper:true, note:'È il Nivada Chronomaster venduto in USA come Croton. Stesso orologio, prezzo spesso più basso perché il nome confonde. Affare.' },

  // ── WALTHAM (Swiss-era) — crono e diver dimenticati ──
  'waltham diver chrono vintage': { brand:'Waltham', model:'Diver / Chronograph (Swiss-era)', caliber:'Valjoux / ETA', years:'1960s-70s', material:'acciaio', valueLow:300, valueHigh:1500, desirability:5, sleeper:true, note:'Marchio storico USA poi svizzero. Diver e crono sottovalutatissimi. Buon entry per volumi.' },

  // ── SANDOZ / HEUER-sourced — crono Valjoux a poco ──
  'sandoz chronograph vintage': { brand:'Sandoz', model:'Chronograph vintage', caliber:'Valjoux 7733/7734', years:'1960s-70s', material:'acciaio', valueLow:300, valueHigh:1200, desirability:5, sleeper:true, note:'Crono svizzeri Valjoux a prezzi bassissimi. Qualità movimento sopra il prezzo. Per volumi.' },

  // ── DUGENA / MEISTER — tedeschi-svizzeri, dress di qualità ──
  'dugena meister vintage': { brand:'Dugena', model:'Meister / Monza vintage', caliber:'PUW / ETA manifattura tedesca', years:'1960s-70s', material:'acciaio / placcato', valueLow:150, valueHigh:700, desirability:4, sleeper:true, note:'Dress watch tedeschi di qualità ignorati del tutto. Prezzi irrisori, buoni per volumi a basso rischio.' },

  // ── BWC / OGIVAL / EDOX — diver compressore anni 60 ──
  'edox geoscope vintage': { brand:'Edox', model:'Geoscope / Delfin diver vintage', caliber:'auto ETA (cassa compressore)', years:'1960s-70s', material:'acciaio', valueLow:400, valueHigh:1800, desirability:6, sleeper:true, note:'Diver compressore svizzero dimenticato. Casse di qualità. Sottovalutato vs i compressori più noti.' },
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
