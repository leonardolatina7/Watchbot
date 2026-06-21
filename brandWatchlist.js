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
  'favre-leuba':       { status:'in_riscoperta', studyOnly:true, tesi:'Seconda marca svizzera piu antica, primo orologio meccanico con altimetro (Bivouac). Sleeper tecnico raro.' },
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
