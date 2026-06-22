/**
 * BRAND WATCHLIST — i marchi "azienda" da seguire come titoli di borsa
 * ════════════════════════════════════════════════════════════════
 *
 * L'idea di Leonardo: un marchio risorto che lavora bene (Czapek, Nivada,
 * Universal Genève sotto Breitling...) è come un'azienda che macina utili.
 * Si entra sui suoi orologi PRIMA che il mercato prezzi del tutto la
 * rinascita — come comprare l'azione mentre i fondamentali migliorano.
 *
 * Questo file NON scansiona: è la lista di riferimento (la "watchlist di
 * borsa"). Il bot la usa per:
 *  1) dare un BONUS di punteggio quando incrocia un modello di questi marchi;
 *  2) far passare come "📚 DA STUDIARE" i marchi della tua Enciclopedia
 *     anche quando NON sono un affare forte — purché il prezzo sia ≤ al
 *     valore di mercato — così te li vedi arrivare e li studi sul campo.
 *
 * status:
 *   'risorto_forte'  = rilancio in corso che funziona, catalizzatore vivo
 *   'risorto'        = tornato sul mercato, traiettoria positiva
 *   'in_riscoperta'  = marchio morto che i collezionisti stanno riscoprendo
 *   'storico_solido' = manifattura storica sottovalutata, fondamentali sani
 *
 * studyOnly: true  = marchio da TENERE D'OCCHIO PER STUDIO. Anche senza
 *   sconto, se prezzo ≤ valore lo voglio vedere per imparare il mercato.
 *   (i marchi senza il flag passano per studio comunque, ma lo metto sui
 *   target dell'Enciclopedia su cui Leonardo vuole formarsi attivamente)
 */

const BRAND_WATCHLIST = {
  // ── RILANCI CHE FUNZIONANO (azienda che "lavora bene") ──
  'czapek':            { status:'risorto_forte', studyOnly:true, tesi:'Manifattura indipendente rinata 2012, premiata (GPHG), produzione piccola e domanda in crescita. Azione di una azienda sana che cresce: i modelli recenti tengono e salgono.' },
  'universal geneve':  { status:'risorto_forte', studyOnly:true, tesi:'Acquisita da Breitling (2023) con rilancio annunciato. Caso-scuola del catalizzatore: i Compax/Polerouter vintage gia raddoppiati. Comprare il vintage prima delle riedizioni.' },
  'nivada grenchen':   { status:'risorto_forte', studyOnly:true, tesi:'Rilanciata 2020, riedizioni di successo che fanno pubblicita agli originali. Chronomaster gia salito; Antarctic/Depthmaster ancora indietro.' },
  'vulcain':           { status:'risorto', studyOnly:true, tesi:'Cricket rilanciato (2021). La sveglia dei presidenti USA: narrativa fortissima, manifattura, prezzi vintage ancora bassi.' },
  'aquastar':          { status:'risorto', studyOnly:true, tesi:'Marchio diver rinato, riedizioni Deepstar accolte bene. Vintage molto ricercati dai conoscitori, in salita.' },
  'airain':            { status:'risorto', studyOnly:true, tesi:'Marchio militare francese rilanciato. Type 20 originali in salita, fratello povero del Breguet Type 20.' },
  'doxa':              { status:'risorto', studyOnly:true, tesi:'SUB moderni di successo, ma ATTENZIONE: solo i vintage 1967-75 sono roba nostra. Il rilancio tiene caldo il mercato degli originali.' },
  'yema':              { status:'risorto', studyOnly:true, tesi:'Marchio francese rilanciato con buona accoglienza. Superman e Yachtingraf vintage in rivalutazione.' },

  // ── IN RISCOPERTA (morti ma i collezionisti li scoprono ora) ──
  'enicar':            { status:'in_riscoperta', studyOnly:true, tesi:'Sherpa Graph esploso, libro dedicato uscito. I fratelli minori (Super Divette, Jet, Guide) ancora fermi: strategia famiglia.' },
  'gallet':            { status:'in_riscoperta', studyOnly:true, tesi:'Crono dei professionisti pre-Heuer, flottante strettissimo. Quando si muove, si muove forte.' },
  'excelsior park':    { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura pura di crono (motori per Gallet e GP), fallita 1983, produzione minuscola. Una UG in miniatura senza ancora il compratore.' },
  'wittnauer':         { status:'in_riscoperta', studyOnly:true, tesi:'Stesso Valjoux 72 di Heuer/Daytona a un terzo del prezzo. Il mercato USA li sta scoprendo.' },
  'lemania':           { status:'in_riscoperta', studyOnly:true, tesi:'La manifattura dietro lo Speedmaster e Patek. I crono a marchio proprio sono purissima manifattura quasi ignorata.' },
  'favre-leuba':       { status:'in_riscoperta', studyOnly:true, tesi:'Seconda marca svizzera piu antica, primo orologio meccanico con altimetro (Bivouac). Sleeper tecnico raro. CATALIZZATORE 2026: rilanciata da Titan Group (India), debutto a Watches&Wonders con Harpoon Revival = il rilancio fa pubblicita agli ORIGINALI vintage (Bivouac/Bathy). Comprare il vintage ora, prima che salga.' },
  'wakmann':           { status:'in_riscoperta', studyOnly:true, tesi:'Crono Valjoux (7733/72) spesso co-firmati Breitling. Fratello americano sottovalutato dei Breitling vintage.' },
  'ollech wajs':       { status:'in_riscoperta', studyOnly:true, tesi:'Diver svizzero anni 60-70 venduto per corrispondenza, robusto e raro. Riscoperto da OW rilancio moderno. Originali ancora a buon prezzo.' },
  'zodiac':            { status:'in_riscoperta', studyOnly:true, tesi:'Sea Wolf vintage = uno dei primi diver di serie. ATTENZIONE: oggi Fossil produce Zodiac moderni, solo i vintage anni 50-70 contano.' },
  'gruen':             { status:'in_riscoperta', studyOnly:true, tesi:'Curvex e Doctor\'s watch art déco, manifattura USA-svizzera dimenticata. Forme particolari ricercate.' },
  // ── PRIVATE LABEL DI QUALITÀ (basi Valjoux/Venus, design audaci, sotto i radar) ──
  'lejour':            { status:'in_riscoperta', studyOnly:true, tesi:'Private label di qualita, alcuni casi fatti da Heuer. Basi Valjoux/Venus, design piu audaci dei grandi nomi a meta prezzo. Gli esperti li indicano come sotto i radar "per ora".' },
  'clebar':            { status:'in_riscoperta', studyOnly:true, tesi:'Crono anni 60 dal look Heuer Carrera (Landeron/Valjoux) a prezzi accessibili: alternativa economica gia notata dai collezionisti USA.' },
  'invicta':           { status:'in_riscoperta', studyOnly:true, tesi:'SOLO il vintage anni 50-70 svizzero vero (alcuni con Valjoux 72): nulla a che vedere con la Invicta moderna di plastica. Diffidare: il 99% degli annunci Invicta e robaccia moderna.' },
  'poljot':            { status:'in_riscoperta', studyOnly:true, tesi:'Strela 3017: il crono dei cosmonauti sovietici, storia spaziale tipo Speedmaster a prezzi bassi. ATTENZIONE: pieno di falsi e franken.' },

  // ── STORICI SOLIDI (fondamentali sani, sottovalutati) ──
  'piaget':            { status:'storico_solido', studyOnly:true, tesi:'Vintage in oro con calibri di manifattura ultra-piatti (9P/12P): indicato da Wind Vintage come sottovalutato. Oro vero + manifattura = pavimento melt e upside. Solo vintage pre-1985.' },
  'movado':            { status:'storico_solido', studyOnly:true, tesi:'Manifattura vera e storia enorme a prezzo da brand rovinato dal quarzo. Kingmatic e calendari fermi mentre i crono M95 salgono. Pre-quarzo (pre-1970) è il target.' },
  'girard-perregaux':  { status:'storico_solido', studyOnly:true, tesi:'Manifattura, primo high-beat commerciale (cal. 32A). Qualita pari ai big a prezzi ancora ragionevoli. Laureato in forte crescita.' },
  'zenith':            { status:'storico_solido', studyOnly:true, tesi:'El Primero e il leggendario cal. 135 da cronometria. Il 135 e ancora accessibile per cio che e.' },
  'longines':          { status:'storico_solido', studyOnly:true, tesi:'I crono manifattura 13ZN e 30CH in forte rivalutazione, ma ancora sotto i big. Heritage che traina.' },
  'certina':           { status:'storico_solido', studyOnly:true, tesi:'Sistema DS, manifattura vera. Il PH200M e raddoppiato dopo la riedizione: DS-2 e PH500M sulla stessa traiettoria.' },
  'tissot':            { status:'storico_solido', studyOnly:true, tesi:'I crono base Lemania (DNA Speedmaster) sono incredibilmente sottovalutati. PR516 racing in salita lenta.' },
  'eberhard':          { status:'storico_solido', studyOnly:true, tesi:'Manifattura/assemblatore storico milanese-svizzero. Crono pre-quarzo (Extra-fort, contograf) di qualita, mercato italiano forte.' },
  'minerva':           { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura di crono purissima (oggi Montblanc Villeret). I crono a marchio proprio sono altissima orologeria a prezzi ancora umani.' },
  'angelus':           { status:'in_riscoperta', studyOnly:true, tesi:'Chronodato (primo crono datario triplo di serie) e calibri propri. Marchio rinato come ultra-lusso: i vintage ne beneficiano.' },

  // ── NEO-VINTAGE 1985-2000 (comprare finche e "solo usato") ──
  // Marchi/famiglie da seguire nel neo-vintage: calibro giusto, ancora a prezzo "usato"
  'omega neovintage':  { status:'storico_solido', studyOnly:true, neovintage:true, tesi:'Neo-vintage 1985-2000: Speedmaster ref. moderne, Seamaster pre-Bond/Bond cal. 1120. Comprare finche e usato e non collezione.' },

  // ── ALTRI TARGET DI STUDIO (vintage classico sottovalutato) ──
  'heuer':             { status:'in_riscoperta', studyOnly:true, tesi:'PRE-TAG (pre-1985): Carrera, Autavia, Monaco vintage = icone gia partite, ma Camaro, Cortina, Daytona (si chiama cosi!) e i cronografi minori sono ancora abbordabili. Valjoux 72/7730.' },
  'breitling':         { status:'in_riscoperta', studyOnly:true, tesi:'Navitimer e Chronomat vintage pre-quarzo: Venus 178 poi Valjoux 7740. I Top Time sono il fratello accessibile. ATTENZIONE: molto falsificato, verifica ref+seriale tra le anse.' },
  'omega':             { status:'storico_solido', studyOnly:true, tesi:'Vintage vero: Seamaster e Constellation anni 50-60 (cal. 5xx bumper e 56x), Speedmaster pre-Moon. Manifattura di altissimo livello a prezzi ancora umani sui non-Speedy.' },
  'iwc':               { status:'storico_solido', studyOnly:true, tesi:'Ingenieur e Mark XI/XII vintage, calibri di manifattura (89, 852). Sottovalutato rispetto alla qualita; il vintage IWC e uno sleeper tra i big.' },
  'jaeger-lecoultre':  { status:'storico_solido', studyOnly:true, tesi:'Vintage: Memovox (sveglia), Futurematic, Geophysic. Manifattura purissima a prezzi da marchio medio. Il vintage JLC e tra i piu sottovalutati in assoluto.' },
  'rado':              { status:'in_riscoperta', studyOnly:true, tesi:'DiaStar e i diver anni 60-70 (Captain Cook originale!). Il Captain Cook vintage e gia partito, ma molti Rado sub minori sono ancora ignorati.' },
  'mido':              { status:'in_riscoperta', studyOnly:true, tesi:'Multifort e Ocean Star vintage, casse Aquadura, automatici robusti anni 40-60. IL pezzo chiave = Multicenterchrono: crono col Valjoux VZ (stesso base degli AP cal.VZSS e dei primi Patek Observatory!) e lancetta minuti al centro, rarissimo. Marchio onesto dimenticato, prezzi bassissimi.' },
  'tissot vintage':    { status:'storico_solido', studyOnly:true, tesi:'(vedi tissot) Navigator, Visodate, PR516, crono Lemania anni 60-70.' },
  'wittnauer geneve':  { status:'in_riscoperta', studyOnly:true, tesi:'(vedi wittnauer) Professional e crono Valjoux, mercato USA in risveglio.' },
  'bulova':            { status:'in_riscoperta', studyOnly:true, tesi:'Accutron (diapason, primo orologio elettronico, 1960) e i crono Valjoux. Spaceview Accutron = pezzo storico ancora accessibile.' },
  'hamilton':          { status:'in_riscoperta', studyOnly:true, tesi:'Vintage USA: Ventura (elettrico, Elvis), Pacer, e i militari. I crono Chrono-matic e i modelli elettrici anni 50-60 sono sleeper di design.' },
  'seiko':             { status:'in_riscoperta', studyOnly:true, tesi:'Vintage giapponese: 62MAS (primo diver, 1965), 6139 crono (primo crono automatico al mondo!), 6105 (Apocalypse Now), Grand Seiko vintage 44GS/62GS. Mercato in forte crescita.' },
  'lip':               { status:'in_riscoperta', studyOnly:true, tesi:'Marchio francese storico: i crono e i modelli design anni 70 (Mach 2000 di Roger Tallon). Sleeper di design industriale.' },
  'baume mercier':     { status:'in_riscoperta', studyOnly:true, tesi:'SOLO vintage pre-quarzo: crono Valjoux e dress oro anni 50-60. Il moderno deprezza, il vintage di manifattura no. Spesso doppia firma.' },

  // ── NUOVI TESORI OSCURI (sessione giugno 2026) — i veri sotto-i-radar ──
  'gubelin':           { status:'in_riscoperta', studyOnly:true, tesi:'IL tesoro nascosto: rivenditore svizzero d\'elite (vendeva Patek e AP) che fece orologi PROPRI con movimenti altissimi. Pochissima documentazione esistente = mercato cieco. Un Ellipse Gubelin e un AP/Patek travestito. Doppia firma su altri marchi = premio.' },
  'gübelin':           { status:'in_riscoperta', studyOnly:true, tesi:'(alias) vedi gubelin.' },
  'juvenia':           { status:'in_riscoperta', studyOnly:true, tesi:'Architect e Sextant (calcolatrice/regolo al quadrante), spesso co-firmati Gubelin. Un Architect Sextant acciaio firmato Gubelin gia listato ~6k: il mercato inizia a capirli. Manifattura fine sottovalutata.' },
  'record':            { status:'in_riscoperta', studyOnly:true, tesi:'Record Geneve: manifattura di qualita poi fusa in Longines (1961). Datofix e i dress con calibri propri ottimi a prezzi ancora da nessuno. Pre-fusione = il target.' },
  'record geneve':     { status:'in_riscoperta', studyOnly:true, tesi:'(alias) vedi record.' },
  'cyma':              { status:'in_riscoperta', studyOnly:true, tesi:'Un tempo colosso (gemello di Tavannes), oggi dimenticato. Crono Valjoux e i Watersport in casse Dennison a cifre ridicole (100-300 euro). Tavannes/Cyma indicati dagli esperti come la prossima riscoperta.' },
  'pierce':            { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura propria di cronografi (raro!): calibro crono in-house a camma anni 40, spesso monopulsante. Pochi sanno che facevano il movimento in casa. Design art deco unici a prezzi bassi.' },
  'buren':             { status:'in_riscoperta', studyOnly:true, tesi:'Pioniere del micro-rotore (Super Slender). Calibro automatico ultrapiatto proprio, poi confluito in Hamilton/Heuer (Chrono-matic cal.11). I micro-rotore Buren sono tecnica vera a prezzi minimi.' },
  'vacheron constantin': { status:'storico_solido', studyOnly:true, tesi:'IL nome piu nobile, eppure il vintage time-only resta sottovalutato. Referenze anni 50-70 con calibro derivato da base JLC (lignaggio 818/1014): il "poor man\'s Patek" col blasone piu alto. Oro 18k = pavimento melt + upside del nome.' },
  'vacheron':          { status:'storico_solido', studyOnly:true, tesi:'(alias) vedi vacheron constantin.' },

  // ── I PRIMATISTI E I DIMENTICATI (sessione giugno 2026, parte 2) ──
  // Marchi che hanno fatto un PRIMATO tecnico o un pezzo che ha lasciato il segno.
  'eterna':            { status:'storico_solido', studyOnly:true, tesi:'DOPPIO primato: prima sveglia da polso di serie (1914) E l\'Eterna-Matic, primo rotore su cuscinetti a sfere (i 5 punti del logo, oggi marchio ETA). Una delle grandi manifatture dimenticate, prezzi bassissimi. KonTiki il modello chiave.' },
  'tavannes':          { status:'in_riscoperta', studyOnly:true, tesi:'Gemello storico di Cyma. PRIMATO: il Submarine fu uno dei primissimi orologi da polso waterproof (1917, commissione di comandanti di sommergibili). Manifattura enorme oggi a terra = sleeper di pazienza.' },
  'helvetia':          { status:'in_riscoperta', studyOnly:true, tesi:'PRIMATO: primo movimento da polso con GRANDE DATA (big date, 1932). Marchio svizzero storico dimenticato; alcuni crono montano il Valjoux 72 (motore di Heuer/Daytona) a frazione del prezzo.' },
  'cortebert':         { status:'in_riscoperta', studyOnly:true, tesi:'PRIMATO: jumping hour col movimento Pallweber (poi famoso su IWC) e il calibro base che Rolex usò nei primi Panerai. In Italia = PERSEO, gli orologi delle Ferrovie (Mussolini vietava i nomi stranieri). Archivi persi in un incendio = mercato cieco.' },
  'perseo':            { status:'in_riscoperta', studyOnly:true, tesi:'Il nome italiano di Cortebert (dal 1927): orologi delle Ferrovie dello Stato. Storia ferroviaria italiana fortissima, mercato locale caldo, prezzi ancora bassi.' },
  'kelek':             { status:'in_riscoperta', studyOnly:true, tesi:'PRIMATO: il piu piccolo cronografo automatico del suo tempo (cal. 1369). Parte del consorzio Chronomatic (primo crono automatico 1969), poi assorbita: oggi e Chronometrie Breitling. Rarissimo, tecnico, sconosciuto.' },
  'chezard':           { status:'in_riscoperta', studyOnly:true, tesi:'PRIMATO: i calibri 115/116 a SECONDE MORTE (dead-beat/jumping seconds), montati anche su Doxa e altri. Sleeper tecnico raro: segnalalo SEMPRE, e una complicazione che pochi sanno riconoscere.' },
  'revue thommen':     { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura con calibri propri (Gédéon Thommen, Waldenburg; portò il Nivarox). PRIMATO: cronografi per l\'aviazione svizzera e strumenti di volo. CAPOFILA del gruppo MSR (1961) con Vulcain, Phénix, Buser; Marvin entrò nel 1973; nel 1984 rilevò Excelsior Park e nel 1987 riemise il Vulcain Cricket. Stessa galassia dei tuoi watchlist.' },
  'marvin':            { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura storica (famiglia Didisheim, fondata 800), ancora attiva. Dress e crono di buona qualita a prezzi minimi, marchio uscito dai radar.' },
  'ernest borel':      { status:'in_riscoperta', studyOnly:true, tesi:'Il celebre quadrante Cocktail/Kaleidoscope (effetto ottico ipnotico), molto cercato in Asia. Manifattura solida, design unico riconoscibile = liquidita sul mercato orientale (arbitraggio geografico).' },
  'roamer':            { status:'in_riscoperta', studyOnly:true, tesi:'Calibri MST propri robustissimi (Anfibio, Stingray, Searock). Tool watch onesti e tecnici, sottovalutati. Casse monoscocca interessanti.' },
  'auricoste':         { status:'in_riscoperta', studyOnly:true, tesi:'Cronografi militari francesi TYPE 20 (flyback), forniti all\'aeronautica. Mercato francese caldo (arbitraggio geo). Flyback militare = complicazione vera a prezzo accessibile vs Breguet Type 20.' },
  'dodane':            { status:'in_riscoperta', studyOnly:true, tesi:'L\'altro grande fornitore di TYPE 20 flyback all\'aeronautica francese. Stessa logica Auricoste: militare flyback, mercato FR forte, fratello povero del Breguet Type 20.' },
  'vixa':              { status:'in_riscoperta', studyOnly:true, tesi:'TYPE 20 francese raro col calibro Hanhart. Pochissimi esemplari, militare flyback. Sleeper per conoscitori del Type 20.' },
  'hanhart':           { status:'in_riscoperta', studyOnly:true, tesi:'Cronografi militari tedeschi col pulsante rosso (per evitare azzeramenti accidentali in volo), monopulsante storici anni 30-40. Mercato tedesco forte (arbitraggio geo).' },
  'tutima':            { status:'in_riscoperta', studyOnly:true, tesi:'I flieger di Glashutte della Seconda Guerra (cal. UROFA 59). Storia tedesca importante, mercato DE caldo. Solo i vintage veri: il moderno e altra cosa.' },
  'glycine':           { status:'in_riscoperta', studyOnly:true, tesi:'PRIMATO: l\'Airman, primo GMT 24h per piloti transpolari (1953), precede il GMT-Master per certi versi. Vintage Airman ancora accessibili, storia aviazione forte.' },
  'paul picot':        { status:'in_riscoperta', studyOnly:true, tesi:'Movimenti in-house, marchio di nicchia dimenticato. Firshire e i dress di qualita a prezzi bassi per cio che offrono.' },
  'mondia':            { status:'in_riscoperta', studyOnly:true, tesi:'Legata a Zenith. Gli Orbitron e i design anni 70 audaci. ATTENZIONE: verificare sempre, molti modelli minori senza valore; contano i design particolari e i legami Zenith.' },
  'mathey-tissot':     { status:'in_riscoperta', studyOnly:true, tesi:'Crono Valjoux di buon livello, doppia firma frequente (anche per il mercato USA). Sleeper accessibile tra i crono vintage. Niente a che vedere con Tissot.' },
  'election':          { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura di La Chaux-de-Fonds, cronografi di qualita dimenticati. Nome quasi sparito dai radar = prezzi bassi su pezzi onesti.' },
  'moeris':            { status:'in_riscoperta', studyOnly:true, tesi:'Manifattura di buona qualita, crono e dress anni 30-50. Marchio storico dimenticato, base per pezzi onesti a poco.' },
  'bovet':             { status:'in_riscoperta', studyOnly:true, tesi:'Bovet Fleurier vintage: storici cronografi per il mercato cinese (800-900). Nome oggi ultra-lusso: i vintage hanno narrativa e rarita. ATTENZIONE a non confondere col Bovet moderno.' },

  // ── GRUPPO MSR (la galassia che lega Vulcain/Excelsior Park/Marvin) ──
  // Nel 1961 Revue Thommen + Vulcain + Phénix + Buser Frères -> holding MSR.
  // Marvin entra 1973; nel 1984 Revue Thommen rileva Excelsior Park; nel 1987
  // riemette il Vulcain Cricket. Stessa famiglia = stessa storia da raccontare.
  'buser':             { status:'in_riscoperta', studyOnly:true, tesi:'Buser Frères, sorella di gruppo MSR (con Revue Thommen, Vulcain, Phénix). Dress onesti, marchio sparito nel 1973. Base economica, non sleeper forte ma storia di gruppo.' },
  'phenix':            { status:'in_riscoperta', studyOnly:true, tesi:'Phénix, sorella MSR cessata 1984. Solo tempo onesti svizzeri. Valore basso ma fa parte della galassia Revue Thommen/Vulcain.' },

  // ── BRITANNICI MILITARI — qui sta il valore vero del \"nord\" ──
  // REGOLA DA CAMPO: fondello inciso \"W.W.W.\" + freccia (broad arrow) sul
  // quadrante = potenziale DIRTY DOZEN, verifica subito quale dei 12.
  // I 12: Buren, Cyma, Eterna, Grana, JLC, Lemania, Longines, IWC, Omega,
  // Record, Timor, Vertex (9 già in lista sopra; qui i mancanti).
  'vertex':            { status:'in_riscoperta', studyOnly:true, tesi:'UNICO marchio britannico della Dirty Dozen (fondato 1912 da Claude Lyons). Il W.W.W. originale col cal. 59, mandato alle truppe del D-Day. Fondello W.W.W. + freccia = grail militare. Rinato 2015. Vintage W.W.W. in salita.' },
  'smiths':            { status:'in_riscoperta', studyOnly:true, tesi:'Il vero orologiaio INGLESE (made in UK). Hillary portò uno Smiths sull\'Everest nel 1953 accanto al Rolex. Target: Everest/De Luxe inglesi e il militare W10 (fondello con freccia). Narrativa britannica forte, mercato UK caldo.' },
  'timor':            { status:'in_riscoperta', studyOnly:true, tesi:'Dirty Dozen. Fece orologi per l\'esercito UK sotto specifiche A.T.P. oltre al W.W.W. Fondello W.W.W. + freccia = il pezzo che conta. Rinato 2015. Vintage militare cercato.' },
  'grana':            { status:'in_riscoperta', studyOnly:true, tesi:'LA rarissima della Dirty Dozen (forse ~1000 esemplari): la più preziosa del set, poi diventata Certina. Se vedi un W.W.W. firmato Grana col fondello freccia = colpo grosso, migliaia di euro. Verifica autenticità con cura.' },
  'newmark':          { status:'in_riscoperta', studyOnly:true, tesi:'Importatore poi produttore a Croydon. Nel 1980 consegnò alla RAF il cronografo 6BB (Valjoux 7733). Target: il 6BB militare. Il moderno Newmark (2018) è altra cosa.' },
  'cwc':              { status:'in_riscoperta', studyOnly:true, tesi:'Cabot Watch Company: sostituì Hamilton per le forze britanniche. Diver di ordinanza Royal Navy e il G10 \"fatboy\". Valore nei pezzi issue (fondello con freccia e numeri NATO). Il quarzo G10 vale meno del diver.' },
  'garrard':          { status:'in_riscoperta', studyOnly:true, tesi:'Gioielliere della Corona britannica, anche militari di ordinanza. Vintage onesti, mercato UK. Pezzi issue = premio.' },
  'services':         { status:'in_riscoperta', studyOnly:true, tesi:'Marchio UK budget anni 30-40 (Despatch Rider). Per lo più base economica, ma i militari d\'epoca hanno un piccolo mercato di nicchia UK. Non sleeper forte.' },

  // ── NORD EUROPA — onesto: magro per il vintage, quasi tutto moderno fashion ──
  // La carne del \"nord\" è britannica, NON scandinava. Qui i pochi veri.
  'halda':            { status:'in_riscoperta', studyOnly:true, tesi:'Il più antico orologiaio svedese (1887, Henning Hammarlund, Svängsta): orologi da tasca e strumenti di precisione per le ferrovie svedesi. Produzione originale cessata a inizio \'900, nome rilanciato 2009. SOLO il vintage vero (tasca/strumenti) conta, raro e da nicchia. Il moderno modulare è altra cosa.' },
  'jacob jensen':     { status:'in_riscoperta', studyOnly:true, tesi:'Danimarca, 1958: design-icona (estetica Bang&Olufsen). ATTENZIONE: quasi tutto QUARZO = da collezione di design, non da flip meccanico. Valore solo nei pezzi-design riconosciuti, mercato di nicchia.' },

  // ── DORMIENTI / CANDIDATI RILANCIO (radar, NON growth indie) ──
  'jeanrichard':      { status:'in_riscoperta', studyOnly:true, tesi:'Sister-brand economica di Girard-Perregaux (Sowind/Kering), oggi DORMIENTE; scorporata al management nel 2022 con GP/Ulysse Nardin. NON e un indie da rivalutazione: nome storico (Daniel JeanRichard, padre del Giura) su marchio moderno morto. Modern (Terrascope/Aquascope/JR1000) = solo FLIP a forte sconto. Tienilo nel RADAR rilanci tipo UG/Nivada: se deposita marchi nuovi, occhio.' },
  'jean richard':     { status:'in_riscoperta', studyOnly:true, tesi:'(alias) vedi jeanrichard.' },
  'daniel jeanrichard':{ status:'in_riscoperta', studyOnly:true, tesi:'(alias) vedi jeanrichard. Il nome storico vale piu del marchio moderno.' },
};

// ── INDIPENDENTI MODERNI — eccezione al filtro "solo vintage" ──
// Questi marchi interessano ANCHE da moderni/usati: sono le "azioni growth"
// dell'orologeria (firma dell'orologiaio, calibri in-house, produzione
// minuscola, catalizzatori vivi). Il bot NON li scarta se isVintage=false.
const MODERN_INDIE_BRANDS = {
  'urban jurgensen':   { tesi:'Rilancio 2025 con Voutilainen co-CEO + GPHG subito. Le ref PRE-rilancio (1140, P8, Jules, era Baumberger/Pratt) sono i Polerouter di questo ciclo.' },
  'czapek':            { tesi:'10 anni dal revival, calibri SXH in-house, guilloche artigianale. Quai des Bergues usato = porta d\'ingresso indie sotto 12k.' },
  'andersen geneve':   { tesi:'Svend Andersen, co-fondatore AHCI, tradizione worldtimer Cottier. Produzione minima da 40 anni: profilo riscoperta alla Daniels.' },
  'fp journe':         { tesi:'Il capostipite: risonanza, remontoir, movimenti in oro. Prime serie 38mm/ottone = il tesoro. Fuori budget ma da segnalare sempre: anche un affare parziale vale.' },
  'f.p. journe':       { tesi:'(alias) vedi fp journe.' },
  'akrivia':           { tesi:'Rexhep Rexhepi: RRCC I 15x in 5 anni. Fuori budget, segnalare comunque ogni avvistamento usato.' },
  'rexhep rexhepi':    { tesi:'(alias) vedi akrivia.' },
  'voutilainen':       { tesi:'Il piu premiato indipendente (11 GPHG), ora co-CEO UJ. Ogni suo lavoro storico si rivaluta col rilancio UJ.' },
  'de bethune':        { tesi:'Indipendente consacrato, titanio blu e bilancieri propri. Usato in correzione = entrate interessanti.' },
  'h. moser':          { tesi:'Fumé dials, manifattura vera, produzione piccola. Fascia "in costruzione" della piramide.' },
  'moser':             { tesi:'(alias) vedi h. moser.' },
  'atelier wen':       { tesi:'Pionieri del TANTALIO di serie (Perception Hong, Inflection full-tantalum con movimento GP e grand feu). Da $700 a $30k in 7 anni. I primi Perception acciaio/titanio usati (2-3k) = la "prima serie" da prendere.' },
  'sarpaneva':         { tesi:'Indie finlandese di Stepan Sarpaneva: quadranti-luna scolpiti (Korona/Supermoon), estetica nordica inconfondibile, produzione minuscola. L unico vero collezionabile scandinavo, ma e MODERNO indie, non vintage: trattalo come azione growth.' },

  // ── INDIE INVESTIMENTO (lista Leonardo giu 2026) — TIER 1: holy grail ──
  // Tesi di fondo: comprare le PRIME SERIE / souscription (come i Polerouter
  // pre-boom). Firma riconosciuta + produzione minuscola + lista d attesa.
  'simon brette':      { tesi:'TIER 1 holy grail. Ex-Chronode/MB&F, GPHG Revelation 2023. ~12 pezzi/anno, prenotato oltre il 2030; gia da retail a 75-150k in asta. Prendi QUALUNQUE esemplare, le souscription/prime serie sono il massimo.' },
  'raul pages':        { tesi:'TIER 1. Vincitore Louis Vuitton Watch Prize 2024 (RP1 scappamento a detente, grail cronometria). 4-5 pezzi/anno, CHF 85k. Catalizzatore LVMH vivo. Buy&hold qualsiasi pezzo.' },
  'raul pages ':       { tesi:'(alias) vedi raul pages.' },
  'pages':             { tesi:'(alias) vedi raul pages (Raúl Pagès).' },
  'luca soprana':      { tesi:'TIER 1 known-unknown. La mano dietro Jacob&Co Astronomia, Vianney Halter, il revival Derek Pratt. Nome proprio ~10 pezzi/anno (Time Only). Illiquido ma altissimo: prime serie = il pezzo.' },
  'soprana':           { tesi:'(alias) vedi luca soprana.' },
  'gronefeld':         { tesi:'TIER 1. Fratelli olandesi (Horological Brothers), formati a Renaud&Papi/AP. Piu GPHG vinti (Parallax, 1941 Remontoire, Gronograaf). ~70-80 pezzi/anno, liste lunghe. One Hertz dead-seconds = firma. Buy&hold.' },
  'gronefeld brothers':{ tesi:'(alias) vedi gronefeld.' },
  'krayon':            { tesi:'TIER 1 holy grail. Remi Maillat: complicazioni poetiche (Everywhere alba-tramonto, Anyday). GPHG. Produzione minima, tecnica vera.' },
  'greubel forsey':    { tesi:'TIER 1 vertice. Cronometria/tourbillon estremi, ultra-rari. Downside bassissimo ma prezzi gia stratosferici: upside in % minore. Hold di qualita.' },
  'ferdinand berthoud':{ tesi:'TIER 1. Chopard, cronometria fusee-chaine, GPHG. Ultra-raro e costoso. Hold di prestigio piu che growth esplosivo.' },

  // ── TIER 2: forte potenziale / value (firma seria, prezzo umano) ──
  'haute rive':        { tesi:'TIER 2 newcomer forte. Stephane von Gunten (ex Patek/Ulysse Nardin/GP, 30+ brevetti). Honoris: riserva 1000 ore, CHF 148k, ~10 pezzi/anno. Entrare presto sulle prime serie.' },
  'haute-rive':        { tesi:'(alias) vedi haute rive.' },
  'armin strom':       { tesi:'TIER 2 VALUE. Manifattura vera (risonanza, sistemi propri) a prezzo umano per la qualita. Uno dei migliori rapporti qualita/prezzo tra gli indie.' },
  'schwarz etienne':   { tesi:'TIER 2 VALUE. Manifattura propria con micro-rotore, sottovalutata. Qualita da grande nome a prezzo accessibile.' },
  'arnold & son':      { tesi:'TIER 2. Nome storico inglese enorme (John Arnold), manifattura, oggi a sconto sul secondario = gioco di recupero. STRATEGIA: oltre al moderno, CACCIA IL VINTAGE/early del nome storico.' },
  'arnold and son':    { tesi:'(alias) vedi arnold & son.' },
  'emmanuel bouchet':  { tesi:'TIER 2. Complication One, ex-MB&F/HYT. Firma vera, di nicchia, produzione minima.' },
  'martin braun':      { tesi:'TIER 2. Complicazioni astronomiche (equazione del tempo), tornato in attivita. Di nicchia ma firma riconosciuta.' },

  // ── TIER 3: emergenti tipo Rexhepi (potenziale non provato, ILLIQUIDI) ──
  'cleguer':           { tesi:'TIER 3 emergente. Mathieu Cleguer (Bretagna), parte come incisore. Giovane indie, illiquido: scommessa, entra solo a prezzo giusto.' },
  'klanic':            { tesi:'TIER 3 emergente. Indie visto a Ginevra 2026. Da osservare, illiquido.' },
  'holthinrichs':      { tesi:'TIER 3 emergente. OLANDESE (non tedesco), casse stampate in 3D, design innovativo. Nicchia, illiquido.' },
  'zeitwinkel':        { tesi:'TIER 3. SVIZZERO (non tedesco), manifattura propria. Value/emergente, da osservare.' },
  'laine':             { tesi:'TIER 3 emergente. Torsti Laine (Finlandia), complicazioni a prezzo piu accessibile. Illiquido.' },
  'edouard koehn':     { tesi:'TIER 3. Marchio di famiglia, maestro orologiaio dal 1891, rilanciato classico. Da capire la trazione.' },
  'koehn':             { tesi:'(alias) vedi edouard koehn.' },
  'lyrique':           { tesi:'TIER 3 da seguire. NON e un atelier-firma (tipo Rexhepi): e un orologio costruito coi migliori fornitori-ombra del settore (Fiedler lancette = quelli di Rolex, Metalem quadrante, AGENHOR movimento, base dell AgenGraphe di Moser/Singer). Etude No.1 solo tempo svizzero. Fondamentali tecnici veri, ma manca la firma del singolo maestro e la lista d attesa pluriennale: trazione e liquidita da dimostrare. Occhio alle prime serie se il progetto decolla.' },
  'lirique':           { tesi:'(alias, ortografia errata) vedi lyrique (Lyrique Etude).' },

  // ════ TIER 3 — LA CANTERA (giu 2026): emergenti dove c'e ancora spazio ════
  // INDIE veri (firma/manifattura) = hold/growth, prendi le prime serie.
  'petermann bedat':   { tesi:'TIER 3 alto (quasi 2). Gael Petermann & Florian Bedat, formati A.Lange + Dominique Renaud. Ref.1967 seconde morte, GPHG. PROVA: un 1967 acciaio in asta CHF 215.900 (stima 40-80k). Authorized: A Collected Man/Hour Glass. Le prime serie sono il pezzo.' },
  'sylvain pinaud':    { tesi:'TIER 3 alto. Meilleur Ouvrier de France 2019, GPHG Revelation 2022. Origine in asta CHF 165.100 (stima 60-120k). Firma in forte ascesa.' },
  'auffret':           { tesi:'TIER 3 caldo. Theo Auffret (Auffret Paris), Young Talent FHH/Journe 2018, Tourbillon a Paris (souscription), semifinalista LV Prize. Finissaggio charbonnage. Prime serie.' },
  'theo auffret':      { tesi:'(alias) vedi auffret.' },
  'habring':           { tesi:'TIER 3 VALUE (il piu accessibile). Maria & Richard Habring (Austria): foudroyante/seconde morte a prezzi reali (~$9-10k). Orologeria vera, non hype. Ottimo ingresso.' },
  'kudoke':            { tesi:'TIER 3 value. Stefan Kudoke (Germania), incisione a mano, GPHG Petite Aiguille. Da ~$9k. Accessibile, firma riconosciuta.' },
  'kurono':            { tesi:'TIER 3 liquido. Linea accessibile di Hajime Asaoka: serie minuscole, sold-out istantaneo, secondario stabile. Il miglior rapporto entrata/liquidita: flip+hold.' },
  'kurono tokyo':      { tesi:'(alias) vedi kurono.' },
  'trilobe':           { tesi:'TIER 3. Parigi 2018, display del tempo non convenzionale (Les Matinaux/Nuit Fantastique). Gia considerati grail, lista d attesa ~6 mesi, ~20k. Design-driven.' },
  'hajime asaoka':     { tesi:'TIER 2-3 grail JP. Top indie giapponese AHCI (Tsunami, Project T, tourbillon). Produzione minima, molto ricercato.' },
  'andreas strehler':  { tesi:'TIER 2-3. Maestro svizzero (lune piu precise al mondo); il Sirna porta la sua firma a un pubblico piu ampio. Tecnico purissimo.' },
  'pascal coyon':      { tesi:'TIER 3 value under-radar. Francese (Bayonne), cronometro a finissaggio superlativo su base Unitas 6498 pesantemente modificata. Ordine diretto, attesa. Accessibile per la qualita.' },
  'cyril brivet-naudot':{ tesi:'TIER 3 grail-emergente. Fa TUTTO a mano senza CNC (Eccentricity), AHCI. Produzione quasi nulla, illiquido ma altissima stima tra i cognoscenti.' },
  'christian klings':  { tesi:'TIER 3 ultra-raro. Tedesco, pezzi bespoke fatti a mano, finissaggio da leggenda. Quasi introvabile, da conoscitori assoluti.' },
  'dominique renaud':  { tesi:'TIER 2-3 grail. La "R" di Renaud & Papi (il fornitore di mezza alta orologeria). Pulse60, batte una volta al secondo. Nome enorme tra gli addetti.' },
  'romain gauthier':   { tesi:'TIER 2. Indie affermato (Logical One, C by Romain Gauthier ed. titanio di 88). Manifattura propria, finissaggio top.' },
  'kikuchi nakagawa':  { tesi:'TIER 3 JP. Duo giapponese, classico raffinatissimo, molto ricercato, produzione minima.' },
  'naoya hida':        { tesi:'TIER 3 JP caldo. Quadranti a settore inciso, calibri base rilavorati a mano. Lista d attesa, secondario forte.' },
  'lang & heyne':      { tesi:'TIER 2-3 DE. Dresda, manifattura in-house, classico sassone di altissimo livello. Sottovalutato fuori dalla Germania.' },
  'lang und heyne':    { tesi:'(alias) vedi lang & heyne.' },
  'moritz grossmann':  { tesi:'TIER 2-3 DE. Glashutte, manifattura in-house, finissaggio sassone. Buon value vs A.Lange.' },
  'ressence':          { tesi:'TIER 2-3 cult. Display orbitale a olio (niente lancette classiche), Type 1/3/5. Identita fortissima, secondario solido.' },
  'konstantin chaykin':{ tesi:'TIER 2-3 LIQUIDO. Il Joker (volto a ore vaganti) e un fenomeno di culto: tra gli indie piu liquidi, secondario caldo e premi sulle serie.' },
  'laurent ferrier':   { tesi:'TIER 2 affermato. Ex direttore tecnico Patek; Galet/Sport Auto, micro-rotore, scappamento naturale. Qualita Patek-level, comunita fedele.' },
  'garrick':           { tesi:'TIER 3 English. Fatti a mano in Inghilterra (Norfolk), finissaggio in-house in crescita. Nicchia britannica emergente.' },
  'david candaux':     { tesi:'TIER 3. Svizzero (Half Hunter, tourbillon inclinato). Firma tecnica, produzione minima.' },
  'thomas prescher':   { tesi:'TIER 3. Maestro del tourbillon a tre assi e dei pezzi complicati. Da conoscitori, illiquido.' },
  'j.n. shapiro':      { tesi:'TIER 3 USA. Primo orologio interamente made-in-USA dal 1969 (Resurgence), quadranti guilloche, movimento in-house. Semifinalista LV. Storia forte.' },
  'shapiro':           { tesi:'(alias) vedi j.n. shapiro.' },
  'naoya hida & co':   { tesi:'(alias) vedi naoya hida.' },
  'fam al-hut':        { tesi:'TIER 3 speculativo (Cina). Mobius, sostenuto da Revolution (Maison de Revolution), semifinalista LV. Frontiera cinese in ascesa: scommessa.' },

  // MICROBRAND DI HYPE (NON in-house): flip con premio sul secondario, non hold.
  'furlan marri':      { tesi:'TIER 3 FLIP (microbrand, non in-house). Mr Grey & i crono: sold-out, premio sul secondario. Si compra a retail e si gira. Non e rivalutazione lunga: flip di hype.' },
  'baltic':            { tesi:'TIER 3 FLIP (microbrand). Aquascaphe/MR01 con liste d attesa; le PRIME edizioni si rivendono sopra. Liquido, capitale basso.' },
  'ming':              { tesi:'TIER 3 (microbrand premium). Culto forte, secondario solido (alcune ref sopra retail). Tra i microbrand quello con piu tenuta di valore.' },
  'studio underd0g':   { tesi:'TIER 3 FLIP (microbrand). Crono colorati di hype, sold-out, premio sul secondario alle uscite. Flip veloce.' },
  'serica':            { tesi:'TIER 3 (microbrand). Field/diver francesi ben fatti, comunita in crescita. Flip/volume.' },
  'lorier':            { tesi:'TIER 3 (microbrand). Diver/crono retro USA accessibili, seguito fedele. Volume/flip.' },
  'unimatic':          { tesi:'TIER 3 (microbrand). Design utilitaristico milanese, edizioni limitate che si esauriscono. Flip di design.' },

  // ════ NUOVI 2026 — i debutti e i nomi freschi (qui c'e il massimo upside) ════
  'remy cools':        { tesi:'NUOVO HOT. Francese ~27 anni, Tourbillon Atelier; ex-Greubel Forsey (Hand Made 1), Young Talent FP Journe 2018, modello a souscription. Tra i giovani piu promettenti in assoluto: prendere prestissimo se possibile.' },
  'aubert & ramel':    { tesi:'NUOVO 2026. Duo da Morteau (Thomas Aubert, Young Talent FP Journe 2024, + Alexis Ramel). Debutto Ourea: quasi tutto a mano, movimento in-house, finissaggio altissimo, 14 pezzi titanio CHF 72k. Debutto fortissimo.' },
  'aubert et ramel':   { tesi:'(alias) vedi aubert & ramel.' },
  'dunselman':         { tesi:'NUOVO 2026 (Olanda). Annelinde Dunselman, Black Tulip: time-only in-house, dettagli a tema tulipano, 10 pezzi, EUR 38k. Rara watchmaker donna con atelier proprio. Da seguire.' },
  'manteio':           { tesi:'NUOVO. Alex Goetschi, Zeus: quadrante d impatto. Giovane indie emergente, da osservare.' },
  'alan birchall':     { tesi:'NUOVO artigiano estremo (Giappone rurale): fa il 95% a mano con macchinari vintage anni 70. Produzione minuscola, da conoscitori. Illiquido ma unico.' },
  'felipe pikullik':   { tesi:'NUOVA generazione (giovane indie citato tra i nomi emergenti da seguire). Verifica modelli/prezzi prima di entrare.' },
  'minhoon yoo':       { tesi:'NUOVA generazione (giovane indie emergente). Da osservare.' },
  'behrens':           { tesi:'NUOVO frontiera CINA. Primo marchio cinese a Watches&Wonders (2026); serie Ultralight, collab Vianney Halter (KWH Master). Capacita R&D/manifattura proprie. Scommessa sulla nuova ondata cinese: segui le prime serie e le collab.' },
  'bianchet':          { tesi:'NUOVO-ish. Coppia ex-fintech, tourbillon ispirati a Sezione Aurea/Fibonacci. A Watches&Wonders 2026. Tecnico, di nicchia.' },
  'charles girardier': { tesi:'NUOVO indie a Watches&Wonders 2026. Identita creativa propria. Da capire trazione.' },
  'daniel roth':       { tesi:'RILANCIO (catalizzatore). Rinato sotto La Fabrique du Temps Louis Vuitton, ricostruito con cura (Tourbillon, Extra-Plat platino). Nome storico fortissimo; il rilancio fa salire anche i Daniel Roth VINTAGE originali: occhio a quelli.' },

  // ── PEQUIGNET — manifattura francese con movimento proprio ──
  'pequignet':         { tesi:'Manifattura FRANCESE col Calibre Royal in-house (raro: pochi francesi fanno il movimento). Brand storicamente in difficolta, piu volte rilanciato. La sostanza c e (movimento proprio), ma trazione/secondario deboli: piu value/flip che growth. Il Calibre Royal e la tesi, non il nome.' },
  'pequinet':          { tesi:'(alias, ortografia errata) vedi pequignet.' },

  // ════ ONDATA CINESE 2026 — la frontiera che quasi nessuno segue ancora ════
  'fam al hut':        { tesi:'NUOVO sensazione CINA. Lukas Young & Xinyan Dai (2024, Chongqing->Shanghai). Mobius: tourbillon bi-assiale + ore saltanti + retrogrado, vince l Audacity Prize al GPHG 2025. Restano <few hundred/anno. La punta di diamante della nuova Cina: prime serie = scommessa forte.' },
  'mgraver':           { tesi:'NUOVO CINA. Shiming Yang, Ventrallis: fatto a mano, semifinalista LV Watch Prize 2025-26. Emergente vero, illiquido.' },
  'celadon':           { tesi:'CINA alta gamma. Benjamin Chee: smalti cloisonne + movimenti in-house del maestro AHCI Lin Yong Hua (CH1/CH5/CH4414 ore saltanti). Linea BCHH avant-garde da CHF 50k+. Arte+meccanica cinese di vertice.' },
  'celadon hh':        { tesi:'(alias) vedi celadon.' },
  'qin gan':           { tesi:'CINA artigiano raffinato (Chongqing). Solo-tempo e calendari dress finiti a mano (Pastorale). Tra i piu stimati indie cinesi: hand-finishing serio, prezzi ancora umani.' },
  'lin yong hua':      { tesi:'CINA. Uno dei 3 cinesi riconosciuti AHCI. Movimenti in-house (CH1/CH5, Breguet overcoil, black polish) usati anche da Celadon. Maestro, base della nuova orologeria cinese.' },
  'lyh':               { tesi:'(alias) vedi lin yong hua.' },
  'logan kuan rao':    { tesi:'CINA (Guangzhou). Studio proprio, calibri unici creati da zero. Emergente da osservare.' },
  'neo kung':          { tesi:'CINA. Orienta Chronograph. Giovane indie emergente.' },
  'boyu tang':         { tesi:'CINA. Ha presentato il primo orologio a soli 17 anni: nome da segnare per il lungo periodo.' },
  'peacock':           { tesi:'CINA value. Manifattura storica (Liaoning): tourbillon in-house con quadrante guilloche a mano a prezzi bassi per cio che e. Buon rapporto sostanza/prezzo, da conoscitori.' },
  'kiu tai yu':        { tesi:'CINA storico/grail. Il padre dell orologeria indipendente cinese (mystery tourbillon), primo cinese AHCI. Pezzi rari e fondativi: valore storico.' },
  'ma xushu':          { tesi:'CINA AHCI (2° cinese ammesso, 2015). Tourbillon cilindrici, lancette a pantografo, creazioni uniche. Da conoscitori.' },
  'tan zehua':         { tesi:'CINA AHCI (2019). Ex restauratore, ossessionato dagli scappamenti: ha sviluppato il proprio Di-Axial. Tecnico puro, emergente.' },
  'ciga design':       { tesi:'CINA microbrand. Shenzhen, design-forward accessibile (Seagull), ha vinto al GPHG nella categoria challenge. Flip/design, non haute.' },
  'memorigin':         { tesi:'HONG KONG microbrand. Tourbillon accessibili (William Shum). Sub-brand Memoire piu alto. Volume/flip, non rivalutazione.' },

  // ── GIAPPONE indie emergente ──
  'quiet club':        { tesi:'GIAPPONE indie. Norifumi Seki (ex Young Talent FP Journe), Fading Hours: design poetico + sveglia che batte contro il retro del quadrante. Semifinalista LV. Da seguire.' },
};

function isModernIndie(brand) {
  if (!brand) return false;
  const n = normBrand(brand);
  return Object.keys(MODERN_INDIE_BRANDS).some(k => { const nk = normBrand(k); return nk && (n === nk || n.includes(nk) || nk.includes(n)); });
}

// ── FASCIA MEDIA (€1.500-6.000, il "mondo Tudor") ──
// Questi marchi passano il filtro vintage anche da moderni, MA solo come
// AFFARI VERI (sconto concreto sul valore usato): niente "da studiare",
// sono ovunque e non c'è nulla da studiare. Il margine si fa all'acquisto.
const MIDRANGE_BRANDS = {
  'tudor':            { tesi:'Referenze calde (BB58 79030N 84-94% retention, Pelagos, BB GMT Pepsi) = liquide; ref anonime usate a -40% = flip. Vintage (Snowflake, Big Block) gia in Parte IV. Fondazione Wilsdorf = ricambi per sempre. ATTENZIONE FALSI.' },
  'grand seiko':      { tesi:'Curva a fondo piatto: Snowflake 6k->4k usato; 9F quartz SBGV/SBGN 1.8-2.5k = Zaratsu a prezzo regalo. Comprare SOLO usato a -30/40%.' },
  'jaeger-lecoultre': { tesi:'Deprezza 25-40% poi si ferma: Reverso/Master usato = altissima manifattura a prezzo Tudor, rivalutazione lenta.' },
  'jaeger lecoultre': { tesi:'(alias) vedi jaeger-lecoultre.' },
  'cartier':          { tesi:'-20/30% poi stabile; Santos e Tank Must liquidissimi, vintage gia in boom, Basculante sleeper. MOLTO falsificato: verifica sempre.' },
  'franck muller':    { tesi:'Il neo-vintage piu sottovalutato del lusso: Crazy Hours meta-2000s 4-8k, tourbillon <40k (un terzo degli equivalenti AP). Stigma bling = sconto; riabilitazione in corso. ATTENZIONE: molto falsificato e molti quarzi anonimi.' },
  'ulysse nardin':    { tesi:'Anomalia Freak: l\'originale 2001 (primo silicio della storia) usato ~20k < Freak X nuovo. Condizioni e servizio UN documentato obbligatori. Marine/Diver = curva piatta normale.' },
};

function isMidrange(brand) {
  if (!brand) return false;
  const n = normBrand(brand);
  return Object.keys(MIDRANGE_BRANDS).some(k => { const nk = normBrand(k); return nk && (n === nk || n.includes(nk) || nk.includes(n)); });
}

// ── MARCHI MINORI SENZA MERCATO — mai studyOnly, sono solo "piacere" ──
// (lista di riferimento per non confonderli mai con gli sleeper di qualità)
const NO_MARKET_BRANDS = ['dalor','nobellux','augustus','fhb','gigandet','rewel','lanco','camy','cauny','mulco','bernhard h mayer',
  // fashion nordici moderni: quarzo/zero valore di rivendita, MAI sleeper
  'daniel wellington','triwa','skagen','bering','nordgreen','tid','tuseno','kronaby','larsson jennings','cluse'];

// Normalizza un nome marchio per il confronto (minuscolo, senza accenti)
function normBrand(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 -]/g, '').trim();
}

// Ritorna i dati watchlist se il marchio è monitorato, altrimenti null.
function checkBrand(brand) {
  if (!brand) return null;
  const n = normBrand(brand);
  for (const [k, v] of Object.entries(BRAND_WATCHLIST)) {
    const nk = normBrand(k);
    if (n === nk || n.includes(nk) || nk.includes(n)) {
      return { brand: k, ...v };
    }
  }
  return null;
}

// È un marchio della watchlist che voglio vedere anche per STUDIO?
function isStudyBrand(brand) {
  const w = checkBrand(brand);
  return !!(w && w.studyOnly === true);
}

// È un marchio "senza mercato" da NON trattare mai come sleeper?
function isNoMarketBrand(brand) {
  if (!brand) return false;
  const n = normBrand(brand);
  return NO_MARKET_BRANDS.some(b => { const nb = normBrand(b); return nb && (n === nb || n.includes(nb) || nb.includes(n)); });
}

// Bonus di punteggio investimento per i marchi-azienda in salute.
function brandBonus(brand) {
  const w = checkBrand(brand);
  if (!w) return 0;
  return { risorto_forte: 3, risorto: 2, in_riscoperta: 2, storico_solido: 1 }[w.status] || 0;
}

const STATUS_LABEL = {
  risorto_forte: '\u{1F680} rilancio che funziona',
  risorto: '\u{1F331} marchio risorto',
  in_riscoperta: '\u{1F50D} in riscoperta',
  storico_solido: '\u{1F3DB}\uFE0F storico sottovalutato',
};

module.exports = {
  BRAND_WATCHLIST, checkBrand, brandBonus, normBrand, STATUS_LABEL,
  isStudyBrand, isNoMarketBrand, NO_MARKET_BRANDS,
  MODERN_INDIE_BRANDS, isModernIndie,
  MIDRANGE_BRANDS, isMidrange,
};
