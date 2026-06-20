// brandValue.js
// Il CERVELLO del flip cieco: marca letta dalla foto -> fasce acquisto/vendita + flag.
// Seminato dall'Enciclopedia. Estendibile a mano (aggiungi righe sotto).
// buy/sell in EUR. liq = liquidita. famousRisk = nome iper-falsificato: NON flip automatico.

// Marche famose ad alto rischio falso/esborso: lette da un'inserzione generica vanno in
// "VERIFICA SOSPETTA", mai gemma automatica.
const FAMOUS_RISK = new Set([
  "rolex","omega","patek","patek philippe","audemars","audemars piguet","vacheron",
  "vacheron constantin","heuer","tag heuer","breitling","jaeger","jaeger-lecoultre","jlc",
  "iwc","panerai","cartier","zenith","tudor","longines","universal geneve","universal genève"
]);

// Oscuri CONOSCIUTI = la nicchia del flip. Qui sta il "compro 100 vendo 300".
const BRANDS = {
  "camy":        { buy:[20,120],  sell:[120,300],  liq:"media", note:"Oscuro svizzero, gemello di Cauny. Diver/crono a poco. Volumi." },
  "cauny":       { buy:[20,120],  sell:[100,300],  liq:"media", note:"Svizzero-spagnolo oscuro. Ogni tanto un Landeron." },
  "cyma":        { buy:[80,150],  sell:[250,450],  liq:"alta",  variant:"Se e' il Watersport CHRONOGRAPH clamshell (cal. 946) vale 5.000-9.500, NON 250-450!", note:"Manifattura R459 Cymaflex (NON il bracciale). La nicchia di casa. Col corredo fino 600." },
  "tavannes":    { buy:[60,200],  sell:[200,600],  liq:"media", variant:"Crono clamshell come il gemello Cyma = quattro cifre. Controlla se e' crono.", note:"Gemella di Cyma, manifattura antica." },
  "roamer":      { buy:[20,120],  sell:[120,400],  liq:"media", note:"Calibri propri MST. Stingray/Searock robusti." },
  "marvin":      { buy:[30,200],  sell:[150,600],  liq:"media", note:"Manifattura 1850 rinata. In lenta risalita." },
  "eterna":      { buy:[80,400],  sell:[300,900],  liq:"media", note:"Manifattura rotore a sfere. KonTiki ricercato. Attento datario 3 livelli." },
  "cortebert":   { buy:[40,300],  sell:[200,900],  liq:"media", note:"Movimenti per primi Rolex/Panerai. Manifattura ignorata." },
  "cortébert":   { buy:[40,300],  sell:[200,900],  liq:"media", note:"Movimenti per primi Rolex/Panerai. Manifattura ignorata." },
  "perseo":      { buy:[40,250],  sell:[150,900],  liq:"media", note:"Ferroviere FS derivato Cortébert. Cercato dai collezionisti FS." },
  "record":      { buy:[30,250],  sell:[150,800],  liq:"media", note:"Manifattura poi assorbita Longines. Sleeper solido." },
  "helvetia":    { buy:[40,300],  sell:[200,1200], liq:"bassa", note:"Primo big-date 1932. Alcuni crono Valjoux 72." },
  "mido":        { buy:[40,300],  sell:[200,1000], liq:"media", note:"Multifort. Multicenterchrono = Valjoux VZ rarissimo." },
  "certina":     { buy:[40,250],  sell:[200,800],  liq:"alta",  note:"DS Double Security, manifattura 25-65. PH200M esploso post-reissue." },
  "wyler":       { buy:[30,200],  sell:[150,400],  liq:"media", note:"Incaflex brevettato, cassa monocoque. Prendere se in oro." },
  "nivada":      { buy:[80,400],  sell:[500,1800], liq:"alta",  variant:"Se e' il Chronomaster (crono diver/aviazione) vale 1000-4000, non l'Antarctic 500-1800.", note:"Grenchen RILANCIATO 2020 = catalizzatore. Antarctic/Depthmaster indietro." },
  "enicar":      { buy:[80,600],  sell:[600,2800], liq:"media", variant:"Se e' lo Sherpa Graph (crono Valjoux 72) vale 3000-12000.", note:"Sherpa. Fratelli minori del Graph esploso. Casse EPSA." },
  "technos":     { buy:[20,150],  sell:[100,400],  liq:"media", note:"Diver svizzeri robusti dimenticati. Borazon monoblocco." },
  "edox":        { buy:[40,200],  sell:[200,600],  liq:"media", note:"Diver compressore svizzero, casse di qualita." },
  "squale":      { buy:[60,300],  sell:[300,1000], liq:"alta",  note:"Casa delle CASSE diver. 1521 iconico." },
  "zodiac":      { buy:[60,300],  sell:[300,1000], liq:"alta",  note:"Sea Wolf tra i primi diver da polso. Cult crescente." },
  "delma":       { buy:[20,120],  sell:[100,400],  liq:"media", note:"Diver svizzeri robusti. Volumi + nicchia." },
  "eza":         { buy:[20,120],  sell:[80,300],   liq:"media", note:"Diver svizzeri economici e onesti. Volumi." },
  "sicura":      { buy:[20,120],  sell:[80,300],   liq:"media", note:"Ernest Schneider (salvo Breitling). Diver funky." },
  "solvil":      { buy:[20,150],  sell:[100,400],  liq:"media", note:"Solvil et Titus (Paul Ditisheim). Diver/crono onesti." },
  "lanco":       { buy:[15,120],  sell:[80,400],   liq:"bassa", note:"Langendorf, antica manifattura. Ogni tanto un oro." },
  "dugena":      { buy:[20,120],  sell:[80,400],   liq:"media", note:"Dress tedeschi di qualita ignorati. PUW/ETA." },
  "sandoz":      { buy:[30,150],  sell:[150,600],  liq:"media", note:"Crono Valjoux 7733/7734 a poco. Volumi." },
  "election":    { buy:[30,200],  sell:[150,900],  liq:"bassa", note:"Marchio antico dimenticato. Crono Valjoux irrisori." },
  "mulco":       { buy:[40,250],  sell:[200,1000], liq:"bassa", note:"Crono oscuri molto cercati dai conoscitori. Design audaci." },
  "waltham":     { buy:[40,200],  sell:[200,800],  liq:"media", note:"USA poi svizzero. Diver/crono sottovalutatissimi." },
  "gruen":       { buy:[30,300],  sell:[150,1200], liq:"media", note:"Curvex cassa curva iconica, spesso oro. Manifattura cal.440." },
  "bucherer":    { buy:[40,300],  sell:[200,900],  liq:"media", note:"Grande nome svizzero, vintage a volte in oro." },
  "buren":       { buy:[40,250],  sell:[200,900],  liq:"bassa", note:"Microrotor base del primo crono auto 1969. Storia enorme." },
  "junghans":    { buy:[40,250],  sell:[200,1000], liq:"alta",  note:"Max Bill Bauhaus iconico, crono J88 manifattura." },
  "stowa":       { buy:[40,250],  sell:[200,1200], liq:"media", note:"Flieger B-Uhr e Antea Bauhaus. Sottovalutato." },
  "laco":        { buy:[40,250],  sell:[200,1200], liq:"media", note:"Uno dei 5 fornitori B-Uhr. Storia militare forte." },
  "glycine":     { buy:[80,400],  sell:[400,2000], liq:"media", note:"Airman 24h GMT piloti transpolari. Storia aviazione." },
  "fortis":      { buy:[40,200],  sell:[200,900],  liq:"media", note:"Storico svizzero poi spazio. Vintage sottovalutati." },
  "favre-leuba": { buy:[150,800], sell:[1500,6000],liq:"bassa", note:"Bivouac altimetro. Manifattura, sleeper tecnico raro." },
  "moeris":      { buy:[20,150],  sell:[100,600],  liq:"bassa", note:"Base onesta. Ogni tanto crono o oro interessante." },
  "ernest borel":{ buy:[30,150],  sell:[150,500],  liq:"media", note:"Cocktail/Kaleidoscope = liquidita mercato orientale." },
  "eska":        { buy:[40,200],  sell:[150,500],  liq:"media", variant:"Se e' il diver AMPHIBIAN 600 (Marina FR, paragonato al Fifty Fathoms) = grail raro, migliaia. Crono Valjoux 22 a colonne = premio.", note:"S.Kocher Grenchen 1918, manifattura onesta dress+crono. Rilanciato meta' anni 2020 = catalizzatore. Tardi = base ETA; sorella Royce." },
  "nicolet":     { buy:[40,250],  sell:[150,700],  liq:"bassa", variant:"Crono con Landeron 39 / Valjoux a COLONNE o oro 18k = premio (300-1200). NB: Charles Nicolet Tramelan VINTAGE != Armand Nicolet moderno (boutique 7750).", note:"Charles Nicolet, Tramelan ~1920. Dress e crono onesti, oscuri. Verifica colonne lato pulsanti." },
  "duward":      { buy:[30,150],  sell:[120,400],  liq:"media", variant:"Se e' doppia firma DUWARD + AQUASTAR (diver: 63/Deepstar/Calypsomatic/Continual compressor) vale molto di piu': 300-2000+; il Deepstar crono Valjoux 23 ancora di piu'.", note:"Importatore spagnolo che co-firmava svizzeri. Plain Duward dress = volume; il valore e' nelle doppie firme Aquastar." },
  "lunesa":      { buy:[10,60],   sell:[40,150],   liq:"bassa", note:"Etablisseur di Bettlach (S.A. ~1946), volume tier basso, calibri base ETA/AS. ATTENZIONE: storia 'fondata 1777 Ginevra / manifattura' sui siti di vendita = marketing (pattern nome altisonante)." }
};

// normalizza testo per match (minuscolo, no accenti, no punteggiatura)
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Cerca una marca nota dentro al testo letto dalla foto / descrizione.
// Ritorna { key, kind:'gemma'|'verifica', ...data } oppure null.
function lookupBrand(text) {
  const t = norm(text);
  if (!t) return null;

  for (const fam of FAMOUS_RISK) {
    if (t.includes(norm(fam))) {
      return { key: fam, kind: "verifica", note: "Nome famoso/falsificato: verificare a mano, non flip automatico." };
    }
  }
  for (const key of Object.keys(BRANDS)) {
    if (t.includes(norm(key))) {
      return Object.assign({ key, kind: "gemma" }, BRANDS[key]);
    }
  }
  return null;
}

module.exports = { BRANDS, FAMOUS_RISK, lookupBrand, norm };
