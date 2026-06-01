import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "http://localhost:3001/api";
const fmt = (n, c = "EUR") => n != null ? new Intl.NumberFormat("it-IT", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n) : "—";
const fmtPct = n => n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—";
const fmtK = n => n >= 1000000 ? (n/1000000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(0)+"K" : String(n||0);

// ── UI Atoms ─────────────────────────────────────────────────
const TIER_COLORS = {1:"#666",2:"#FF9800",3:"#4CAF50",4:"#00BCD4"};
const TIER_LABELS = {1:"Già esploso",2:"In crescita ★",3:"Da scoprire ★★",4:"Micro-brand ★★★"};

function TierBadge({tier}){const c=TIER_COLORS[tier]||"#555";return<span style={{background:c+"18",color:c,border:`1px solid ${c}33`,padding:"2px 7px",borderRadius:2,fontSize:"8px",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>T{tier} {TIER_LABELS[tier]}</span>;}
function DiscMeter({score}){const c=score>70?"#4CAF50":score>50?"#FF9800":score>30?"#FF5722":"#E53935";const lbl=score>70?"🟢 Finestra aperta":score>50?"🟡 Chiudendosi":score>30?"🟠 Quasi chiusa":"🔴 Scoperto";return(<div><div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#2A2A2A",marginBottom:2}}><span>DISCOVERY</span><span style={{color:c}}>{score}/100</span></div><div style={{height:3,background:"#0A0A0A",borderRadius:2,overflow:"hidden",marginBottom:2}}><div style={{height:"100%",width:`${score}%`,background:c,borderRadius:2,transition:"width 0.8s"}}/></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:c}}>{lbl}</div></div>);}
function HypeG({score,label}){const c=score>=80?"#FF4500":score>=65?"#FF9800":score>=45?"#4CAF50":"#333";const r=28,circ=2*Math.PI*r,dash=(score/100)*circ;return(<div style={{display:"flex",alignItems:"center",gap:10}}><svg width={64} height={64} style={{transform:"rotate(-90deg)"}}><circle cx={32} cy={32} r={r} fill="none" stroke="#0A0A0A" strokeWidth={5}/><circle cx={32} cy={32} r={r} fill="none" stroke={c} strokeWidth={5} strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" style={{transition:"stroke-dasharray 1s ease"}}/><text x={32} y={32} textAnchor="middle" dominantBaseline="middle" style={{fill:c,fontSize:13,fontWeight:"bold",fontFamily:"'DM Mono',monospace",transform:"rotate(90deg)",transformOrigin:"32px 32px"}}>{score}</text></svg><div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A",letterSpacing:"2px",marginBottom:2}}>HYPE</div><div style={{fontSize:10,color:c}}>{label}</div></div></div>);}
function SBar({label,value,color="#C9A84C",icon=""}){return(<div style={{marginBottom:5}}><div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A",marginBottom:2}}><span>{icon} {label}</span><span style={{color}}>{value}/100</span></div><div style={{height:3,background:"#080808",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${value}%`,background:color,borderRadius:2,transition:"width 0.8s"}}/></div></div>);}
function GBar({price,gold}){if(!gold||!price)return null;const isU=price<gold;return(<div style={{marginTop:4}}><div style={{height:3,background:"#080808",borderRadius:2,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",left:"71.4%",top:0,bottom:0,width:1,background:"#FFD70033"}}/><div style={{height:"100%",width:`${Math.min((price/gold)*71.4,100)}%`,background:isU?"linear-gradient(90deg,#1B5E20,#4CAF50)":"linear-gradient(90deg,#C9A84C,#E53935)",transition:"width 0.8s"}}/></div><div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:"7px",marginTop:2}}><span style={{color:isU?"#4CAF50":"#C9A84C"}}>{fmt(price)}</span><span style={{color:"#FFD700"}}>oro {fmt(gold)}</span></div></div>);}
function ROIBadge({pct}){if(pct==null)return<span style={{color:"#333",fontSize:"9px",fontFamily:"'DM Mono',monospace"}}>—</span>;const c=pct>=20?"#4CAF50":pct>=5?"#8BC34A":pct>=0?"#FF9800":pct>=-10?"#FF5722":"#E53935";return<span style={{background:c+"18",color:c,border:`1px solid ${c}33`,padding:"2px 7px",borderRadius:2,fontSize:"9px",fontFamily:"'DM Mono',monospace"}}>{fmtPct(pct)}</span>;}

// ── MAIN ──────────────────────────────────────────────────────
export default function WatchPriceBotV7() {
  const [tab,setTab]=useState("search");
  const [query,setQuery]=useState("");
  const [city,setCity]=useState("");
  const [cities,setCities]=useState([]);
  const [loadingSearch,setLoadingSearch]=useState(false);
  const [loadingSignals,setLoadingSignals]=useState(false);
  const [results,setResults]=useState(null);
  const [signals,setSignals]=useState(null);
  const [error,setError]=useState(null);
  const [watchlist,setWatchlist]=useState([]);
  const [alerts,setAlerts]=useState([]);
  const [arbitrage,setArbitrage]=useState([]);
  const [vintage,setVintage]=useState([]);
  const [topHype,setTopHype]=useState([]);
  const [trends,setTrends]=useState(null);
  const [status,setStatus]=useState(null);
  const [goldPrice,setGoldPrice]=useState(null);
  const [goldHistory,setGoldHistory]=useState([]);
  const [fbListings,setFbListings]=useState([]);
  // Indie
  const [indieBrands,setIndieBrands]=useState([]);
  const [indieTier,setIndieTier]=useState(0);
  const [selectedBrand,setSelectedBrand]=useState(null);
  const [brandAnalysis,setBrandAnalysis]=useState(null);
  const [loadingBrand,setLoadingBrand]=useState(false);
  const [indieAlerts,setIndieAlerts]=useState([]);
  const [indieArticles,setIndieArticles]=useState([]);
  const [indieOpps,setIndieOpps]=useState([]);
  const [indieDrops,setIndieDrops]=useState([]);
  const [indieScanning,setIndieScanning]=useState(false);
  // Portfolio
  const [portfolio,setPortfolio]=useState([]);
  const [portfolioSummary,setPortfolioSummary]=useState(null);
  const [portfolioForm,setPortfolioForm]=useState({name:"",brand:"",purchasePrice:"",purchaseDate:"",isGold:false,goldGrams:"",notes:""});
  const [showAddPortfolio,setShowAddPortfolio]=useState(false);
  const [valuating,setValuating]=useState(false);
  // WatchCharts
  const [watchChartsData,setWatchChartsData]=useState(null);
  const [loadingWC,setLoadingWC]=useState(false);
  // Telegram
  const [telegramChatId,setTelegramChatId]=useState("");
  const [telegramRegistered,setTelegramRegistered]=useState(false);
  // Form
  const [form,setForm]=useState({threshold:"",email:"",telegramChatId:"",goldArbitrage:true,trackSignals:true,userCity:"",radiusKm:50});
  const [aiInsight,setAiInsight]=useState("");
  const [loadingAI,setLoadingAI]=useState(false);
  const [scanning,setScanning]=useState(false);
  const [vintageScanning,setVintageScanning]=useState(false);
  const pollRef=useRef(null);

  const load=useCallback(async(ep,setter)=>{try{const r=await fetch(`${API_BASE}${ep}`);if(r.ok)setter(await r.json());}catch{}},[]);
  const loadStatus=useCallback(async()=>{try{const r=await fetch(`${API_BASE}/status`);const d=await r.json();setStatus(d);if(d.goldPricePerGram)setGoldPrice(d.goldPricePerGram);}catch{setStatus(null);}},[]);

  useEffect(()=>{
    loadStatus();
    load("/watchlist",setWatchlist);load("/alerts",setAlerts);load("/arbitrage",setArbitrage);
    load("/vintage",setVintage);load("/top-hype",setTopHype);load("/trends",setTrends);
    load("/gold-price",d=>{if(d.pricePerGram)setGoldPrice(d.pricePerGram);setGoldHistory(d.history||[]);});
    load("/facebook",setFbListings);load("/cities",setCities);
    load("/indie/brands",d=>setIndieBrands(d.brands||[]));
    load("/indie/opportunities",setIndieOpps);load("/indie/alerts",setIndieAlerts);
    load("/indie/articles",setIndieArticles);load("/indie/drops",setIndieDrops);
    load("/portfolio",setPortfolio);load("/portfolio/summary",setPortfolioSummary);
    pollRef.current=setInterval(()=>{loadStatus();load("/alerts",setAlerts);load("/indie/alerts",setIndieAlerts);load("/portfolio/summary",setPortfolioSummary);},60000);
    return()=>clearInterval(pollRef.current);
  },[load,loadStatus]);

  const analyzeBrand=async(key)=>{setSelectedBrand(key);setLoadingBrand(true);setBrandAnalysis(null);try{const r=await fetch(`${API_BASE}/indie/analyze/${key}`);if(r.ok)setBrandAnalysis(await r.json());}catch{}setLoadingBrand(false);};

  const handleSearch=async()=>{
    if(!query.trim())return;
    setLoadingSearch(true);setLoadingSignals(true);setError(null);setResults(null);setSignals(null);setAiInsight("");setWatchChartsData(null);
    const cp=city?`&city=${encodeURIComponent(city)}`:"";
    try{
      const[pr,sr]=await Promise.all([fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}${cp}`),fetch(`${API_BASE}/signals?q=${encodeURIComponent(query)}${cp}`)]);
      if(!pr.ok)throw new Error(`Errore ${pr.status}`);
      const pd=await pr.json();setResults(pd);setLoadingSearch(false);
      if(pd.goldPricePerGram)setGoldPrice(pd.goldPricePerGram);
      if(sr.ok){const sd=await sr.json();setSignals(sd);}
      setLoadingSignals(false);
      // WatchCharts in background
      setLoadingWC(true);
      fetch(`${API_BASE}/watchcharts?q=${encodeURIComponent(query)}`).then(r=>r.json()).then(d=>{if(d&&!d.error)setWatchChartsData(d);}).catch(()=>{}).finally(()=>setLoadingWC(false));
      // AI
      setLoadingAI(true);
      try{
        const sd=sr.ok?await sr.json().catch(()=>null):null;
        const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:`Sei un analista esperto di orologi di lusso, indipendenti e investimenti.
MODELLO: "${query}" ${city?`| CITTÀ: ${city}`:""}
PREZZO: €${pd.lowest?.priceEur?.toLocaleString("it-IT")} su ${pd.lowest?.platform}
GOLD: €${pd.goldPricePerGram}/g | ARB: ${pd.arbitrageOpportunities?.length||0}
FB LOCALE: ${(pd.facebookListings?.filter(f=>f.isLocal)||[]).length}
HYPE: ${sd?.hypeScore?.score||"—"}/100 — ${sd?.hypeScore?.label||""}
5 frasi: prezzo ok? sentiment? momento giusto? rischio? consiglio finale.`}]})});
        const ai=await r.json();setAiInsight(ai.content?.[0]?.text||"");
      }catch{setAiInsight("Analisi AI non disponibile.");}
      setLoadingAI(false);
    }catch(e){setError(e.message.includes("Failed to fetch")?"Server offline — avvia: cd server && npm start":e.message);setLoadingSearch(false);setLoadingSignals(false);}
  };

  const addToWatchlist=async()=>{if(!results?.query)return;try{await fetch(`${API_BASE}/watchlist`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:results.query,threshold:form.threshold?parseFloat(form.threshold):null,email:form.email||null,telegramChatId:form.telegramChatId||telegramChatId||null,goldArbitrage:form.goldArbitrage,trackSignals:form.trackSignals,userCity:form.userCity||city||null,radiusKm:form.radiusKm})});load("/watchlist",setWatchlist);setTab("watchlist");}catch{}};

  const addPortfolioItem=async()=>{if(!portfolioForm.name.trim())return;try{await fetch(`${API_BASE}/portfolio`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:portfolioForm.name,brand:portfolioForm.brand||null,purchasePrice:portfolioForm.purchasePrice?parseFloat(portfolioForm.purchasePrice):null,purchaseDate:portfolioForm.purchaseDate||null,isGold:portfolioForm.isGold,goldGrams:portfolioForm.goldGrams?parseFloat(portfolioForm.goldGrams):null,notes:portfolioForm.notes||null})});load("/portfolio",setPortfolio);load("/portfolio/summary",setPortfolioSummary);setShowAddPortfolio(false);setPortfolioForm({name:"",brand:"",purchasePrice:"",purchaseDate:"",isGold:false,goldGrams:"",notes:""});}catch{}};

  const valuatePortfolio=async()=>{setValuating(true);try{await fetch(`${API_BASE}/portfolio/valuate`,{method:"POST"});setTimeout(()=>{load("/portfolio",setPortfolio);load("/portfolio/summary",setPortfolioSummary);setValuating(false);},60000);}catch{setValuating(false);}};

  const registerTelegram=async()=>{if(!telegramChatId.trim())return;try{const r=await fetch(`${API_BASE}/telegram/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:telegramChatId})});if(r.ok){setTelegramRegistered(true);alert("✅ Telegram configurato! Controlla il bot per il messaggio di conferma.");}}catch{}};

  const arbs=results?.arbitrageOpportunities||[];
  const fbLocal=results?.facebookListings?.filter(f=>f.isLocal)||[];
  const hs=signals?.hypeScore;
  const serverOnline=!!status;
  const filteredIndie=indieBrands.filter(b=>!indieTier||b.tier===indieTier);

  const TABS=[
    ["search","Ricerca"],["indie",`🔭 Indie (${indieBrands.length})`],
    ["portfolio",`💼 Portfolio (${portfolio.length})`],
    ["facebook",`📍 Locale (${fbListings.filter(f=>f.is_local).length})`],
    ["arbitrage",`🥇 Oro (${arbitrage.length})`],["vintage",`🕰️ Vintage (${vintage.length})`],
    ["hype",`🔥 Hype`],["trends","📈 Mercato"],
    ["setup","⚙️ Setup"],["watchlist",`Lista (${watchlist.length})`],
    ["alerts",`Alert (${alerts.length+indieAlerts.length})`],
  ];

  const s={minHeight:"100vh",background:"#02020B",color:"#CEC6B0",fontFamily:"'Cormorant Garamond',Georgia,serif"};

  return(
  <div style={s}>
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Mono:wght@300;400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#C9A84C18}
    .fade{animation:fade 0.4s ease}@keyframes fade{from{opacity:0;transform:translateY(5px)}}
    .pulse{animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
    .spin{animation:spin 1.2s linear infinite;display:inline-block}@keyframes spin{to{transform:rotate(360deg)}}
    .row:hover{background:#ffffff04!important;transition:background 0.15s}
    .tab{background:none;border:none;font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1px;text-transform:uppercase;padding:10px 11px;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s;white-space:nowrap}
    .on{color:#C9A84C;border-bottom-color:#C9A84C!important}.off{color:#1A1A1A}
    input,button,select,textarea{font-family:inherit}a{color:#C9A84C;text-decoration:none}
    .card{background:#07070F;border:1px solid #ffffff06;border-radius:2px;padding:12px}
  `}</style>

  {/* HEADER */}
  <div style={{background:"#060610",borderBottom:"1px solid #C9A84C0A",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",letterSpacing:"4px",color:"#C9A84C22",marginBottom:2}}>v7 DEFINITIVO · PREZZI · ORO · SOCIAL · FB · INDIE · PORTFOLIO · TELEGRAM</div>
      <div style={{fontSize:"18px",fontWeight:300}}>⌚ PriceRadar <span style={{color:"#FFD700"}}>Gold</span> <span style={{color:"#00BCD4",fontSize:9}}>+ Indie</span> <span style={{color:"#4CAF50",fontSize:9}}>+ Portfolio</span></div>
    </div>
    <div style={{textAlign:"right"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"flex-end",marginBottom:2}}>
        <span style={{width:5,height:5,borderRadius:"50%",background:serverOnline?"#4CAF50":"#E53935",display:"inline-block"}}/>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:serverOnline?"#4CAF50":"#333"}}>{serverOnline?"ONLINE":"OFFLINE"}</span>
        {status?.telegramConfigured&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#2196F3"}}>📱 TG</span>}
      </div>
      {goldPrice&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"#FFD700"}}>🥇 €{goldPrice.toFixed(2)}/g</div>}
      {status&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",marginTop:1}}>{status.independentBrands} indie · {status.portfolioItems} portfolio · {status.mediaArticles} articoli</div>}
    </div>
  </div>

  {/* TABS */}
  <div style={{background:"#060610",borderBottom:"1px solid #ffffff04",padding:"0 16px",display:"flex",overflowX:"auto"}}>
    {TABS.map(([id,label])=><button key={id} className={`tab ${tab===id?"on":"off"}`} onClick={()=>setTab(id)}>{label}</button>)}
  </div>

  <div style={{maxWidth:960,margin:"0 auto",padding:"16px"}}>

  {/* ══ SEARCH ══ */}
  {tab==="search"&&(
  <div className="fade">
    {!serverOnline&&<div style={{background:"#1A0E0E",border:"1px solid #E5393518",borderRadius:2,padding:"8px 11px",marginBottom:9,fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"#E57373"}}>⚠️ Server offline — <code>cd server && npm install && npm start</code></div>}
    <div style={{marginBottom:11}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",letterSpacing:"2px",marginBottom:5}}>11 PIATTAFORME + SOCIAL + FB LOCAL + WATCHCHARTS</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder="Rolex Daytona, Simon Brette Trilobe, Czapek Antarctique..." style={{flex:"3 1 180px",background:"#07070F",border:"1px solid #C9A84C12",borderRadius:2,padding:"9px 11px",color:"#CEC6B0",fontSize:"13px"}}/>
        <select value={city} onChange={e=>setCity(e.target.value)} style={{flex:"1 1 100px",background:"#07070F",border:"1px solid #2196F318",borderRadius:2,padding:"9px",color:city?"#2196F3":"#1A1A1A",fontSize:"10px"}}>
          <option value="">📍 Città</option>{cities.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
        </select>
        <button onClick={handleSearch} disabled={loadingSearch||!serverOnline} style={{flex:"0 0 80px",padding:"9px",background:loadingSearch||!serverOnline?"#060606":"#C9A84C",color:loadingSearch||!serverOnline?"#0F0F0F":"#02020B",border:"none",borderRadius:2,fontSize:"7px",letterSpacing:"2px",fontFamily:"'DM Mono',monospace"}}>
          {loadingSearch?<span className="spin">⌚</span>:"ANALIZZA"}
        </button>
      </div>
    </div>
    {error&&<div style={{background:"#1A0E0E",border:"1px solid #E5393518",borderRadius:2,padding:"8px 11px",marginBottom:9,fontSize:11,color:"#E57373",fontFamily:"'DM Mono',monospace"}}>{error}</div>}

    {(results||loadingSignals)&&<div className="fade">
      <div style={{display:"grid",gridTemplateColumns:signals||loadingSignals?"1fr 1fr":"1fr",gap:8,marginBottom:8}}>
        {/* PREZZI */}
        {results&&<div>
          {fbLocal.length>0&&<div style={{background:"linear-gradient(135deg,#0A1525,#050D18)",border:"1px solid #2196F320",borderRadius:2,padding:"9px 11px",marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#2196F3",letterSpacing:"2px",marginBottom:6}}>📍 {fbLocal.length} VICINO A TE{city?` (${city})`:""}</div>
            {fbLocal.slice(0,2).map((f,i)=><div key={i} style={{marginBottom:5}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,flex:1}}>{f.title?.slice(0,38)}</span><span style={{fontSize:14,color:"#2196F3"}}>{fmt(f.price)}</span></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#2196F333"}}>📍 {f.location} <a href={f.url} target="_blank" rel="noreferrer">→</a></div></div>)}
          </div>}
          {arbs.length>0&&<div style={{background:"linear-gradient(135deg,#0D2000,#080F00)",border:"1px solid #4CAF5015",borderRadius:2,padding:"9px 11px",marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#4CAF50",letterSpacing:"2px",marginBottom:5}}>🥇 {arbs.length} ARBITRAGGIO ORO</div>
            {arbs.slice(0,2).map((a,i)=><div key={i} style={{marginBottom:5}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,flex:1}}>{a.title?.slice(0,38)}</span><span style={{fontSize:13,color:"#4CAF50"}}>{fmt(a.priceEur)}</span></div><GoldBar price={a.priceEur} gold={a.goldData?.goldValueEur}/><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#4CAF50",marginTop:2}}>−{Math.abs(a.goldData?.discountPct)}% <a href={a.url} target="_blank" rel="noreferrer">→</a></div></div>)}
          </div>}
          {results.lowest&&<div className="card" style={{marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#C9A84C",letterSpacing:"2px",marginBottom:3}}>PREZZO PIÙ BASSO — {results.platformsScanned?.length} piattaforme</div>
            <div style={{fontSize:22,fontWeight:300,color:"#C9A84C"}}>{fmt(results.lowest.priceEur)}</div>
            <div style={{fontSize:10,color:"#1A1A1A",marginTop:2}}>{results.lowest.platform} · {results.lowest.title?.slice(0,38)}</div>
          </div>}
          {/* WatchCharts */}
          {(loadingWC||watchChartsData)&&<div className="card" style={{marginBottom:6}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#888",letterSpacing:"2px",marginBottom:5}}>📊 WATCHCHARTS</div>
            {loadingWC?<div className="pulse" style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#111"}}>Carico...</div>
            :watchChartsData&&<div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
                {[["Mercato",watchChartsData.currentPrice,"EUR"],["1 mese",watchChartsData.priceChange1m,"%"],["1 anno",watchChartsData.priceChange1y,"%"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"#030308",padding:"5px 6px",borderRadius:2}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#1A1A1A",marginBottom:1}}>{l}</div>
                    <div style={{fontSize:12,color:c==="%"?(v>=0?"#4CAF50":"#E53935"):"#CEC6B0"}}>{c==="%"?fmtPct(v):fmt(v)}</div>
                  </div>
                ))}
              </div>
              {watchChartsData.marketTrend&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#555",marginTop:4}}>{watchChartsData.marketTrend}</div>}
            </div>}
          </div>}
          <div className="card" style={{overflow:"hidden",padding:0}}>
            {results.results?.slice(0,5).map((r,i)=><div key={i} className="row" style={{display:"grid",gridTemplateColumns:"90px 1fr 68px 14px",padding:"6px 10px",borderBottom:i<results.results.length-1?"1px solid #ffffff03":"none",alignItems:"center",gap:4}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:i===0?"#C9A84C":"#1A1A1A"}}>{r.platform}</span>
              <span style={{fontSize:9,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title?.slice(0,24)}</span>
              <span style={{textAlign:"right",fontSize:i===0?12:10,color:i===0?"#C9A84C":"#CEC6B0"}}>{fmt(r.priceEur)}</span>
              <a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:9,textAlign:"right"}}>→</a>
            </div>)}
          </div>
        </div>}
        {/* SEGNALI */}
        <div>
          {loadingSignals&&!signals&&<div className="card" style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}><div className="pulse" style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",textAlign:"center"}}>⌚ Social...</div></div>}
          {signals&&<div className="card">
            {hs&&<HypeG score={hs.score} label={hs.label}/>}
            {hs?.breakdown&&<div style={{marginTop:9}}><SBar label="YouTube" value={hs.breakdown.youtube} color="#FF0000" icon="▶"/><SBar label="Reddit" value={hs.breakdown.reddit} color="#FF4500" icon="📊"/><SBar label="Instagram" value={hs.breakdown.instagram} color="#E1306C" icon="📸"/><SBar label="WatchUSeek" value={hs.breakdown.watchuseek} color="#C9A84C" icon="💬"/><SBar label="Chrono24" value={hs.breakdown.chrono24} color="#4CAF50" icon="📦"/><SBar label="Facebook" value={hs.breakdown.facebook} color="#2196F3" icon="📍"/></div>}
            {hs?.signals&&<div style={{marginTop:7,fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#1A1A1A",display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}><div>YT: <span style={{color:"#555"}}>{hs.signals.ytVideosFound}</span></div><div>Reddit: <span style={{color:"#555"}}>{hs.signals.redditPosts}</span></div><div>C24: <span style={{color:"#555"}}>{hs.signals.chrono24Listings}</span></div><div>FB: <span style={{color:"#2196F3"}}>{hs.signals.fbLocalListings}</span></div>{hs.signals.ytKnownChannel&&<div style={{gridColumn:"span 2",color:"#FF9800"}}>⭐ {hs.signals.ytTopChannel}</div>}</div>}
            {signals.signals?.youtube?.slice(0,2).map((v,i)=><div key={i} className="row" style={{padding:"3px 0",borderTop:"1px solid #ffffff03",marginTop:7}}><div style={{display:"flex",justifyContent:"space-between",gap:4}}><div style={{flex:1}}><div style={{fontSize:9}}>{v.title?.slice(0,38)}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:v.isKnownChannel?"#FF9800":"#111"}}>{v.channel}{v.isKnownChannel?" ⭐":""}</div></div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#333",whiteSpace:"nowrap"}}>{v.views?.toLocaleString("it-IT")} <a href={v.url} target="_blank" rel="noreferrer">→</a></div></div></div>)}
          </div>}
        </div>
      </div>
      {/* Watchlist form */}
      {results&&<div className="card" style={{marginBottom:7}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",letterSpacing:"2px",marginBottom:7}}>+ MONITORA</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          <input value={form.threshold} onChange={e=>setForm(f=>({...f,threshold:e.target.value}))} placeholder="Soglia €" style={{flex:"1 1 70px",background:"#02020B",border:"1px solid #C9A84C0E",borderRadius:2,padding:"5px 8px",color:"#CEC6B0",fontSize:11}}/>
          <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="Email" style={{flex:"2 1 120px",background:"#02020B",border:"1px solid #C9A84C0E",borderRadius:2,padding:"5px 8px",color:"#CEC6B0",fontSize:11}}/>
          <input value={form.telegramChatId} onChange={e=>setForm(f=>({...f,telegramChatId:e.target.value}))} placeholder="Telegram Chat ID" style={{flex:"1 1 110px",background:"#02020B",border:"1px solid #2196F318",borderRadius:2,padding:"5px 8px",color:"#CEC6B0",fontSize:11}}/>
          <select value={form.userCity} onChange={e=>setForm(f=>({...f,userCity:e.target.value}))} style={{flex:"1 1 80px",background:"#02020B",border:"1px solid #2196F314",borderRadius:2,padding:"5px 6px",color:form.userCity?"#2196F3":"#1A1A1A",fontSize:9}}>
            <option value="">📍 Città</option>{cities.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </select>
          <label style={{display:"flex",gap:3,alignItems:"center",fontSize:8,color:"#FFD700",cursor:"pointer"}}><input type="checkbox" checked={form.goldArbitrage} onChange={e=>setForm(f=>({...f,goldArbitrage:e.target.checked}))}/>Oro</label>
          <button onClick={addToWatchlist} style={{padding:"5px 10px",background:"none",border:"1px solid #C9A84C18",color:"#C9A84C",fontSize:"7px",letterSpacing:"2px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>MONITORA</button>
        </div>
      </div>}
      {/* AI */}
      <div className="card">
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#C9A84C",letterSpacing:"3px",marginBottom:5}}>⚡ ANALISI AI</div>
        {loadingAI?<div className="pulse" style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0A0A0A"}}>Analisi...</div>:<div style={{fontSize:11,lineHeight:1.8,color:"#444",fontStyle:"italic"}}>{aiInsight}</div>}
      </div>
    </div>}
  </div>
  )}

  {/* ══ PORTFOLIO ══ */}
  {tab==="portfolio"&&(
  <div className="fade">
    {/* Summary */}
    {portfolioSummary&&portfolioSummary.itemCount>0&&(
    <div style={{background:"linear-gradient(135deg,#0A0A18,#0A1200)",border:`1px solid ${(portfolioSummary.totalROI||0)>=0?"#4CAF5022":"#E5393522"}`,borderRadius:2,padding:"14px",marginBottom:12}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#888",letterSpacing:"2px",marginBottom:10}}>💼 PORTFOLIO SUMMARY</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
        {[["Valore attuale",fmt(portfolioSummary.totalValue),"#CEC6B0"],["Costo acquisto",fmt(portfolioSummary.totalCost),"#555"],["ROI totale",fmtPct(portfolioSummary.totalROI),(portfolioSummary.totalROI||0)>=0?"#4CAF50":"#E53935"],["Guadagno €",fmt(portfolioSummary.totalROIEur),(portfolioSummary.totalROIEur||0)>=0?"#4CAF50":"#E53935"]].map(([l,v,c])=>(
          <div key={l} style={{background:"#050510",padding:"7px 8px",borderRadius:2}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#1A1A1A",marginBottom:2}}>{l}</div>
            <div style={{fontSize:14,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      {portfolioSummary.topGainer&&<div style={{display:"flex",gap:8,fontSize:10,color:"#555"}}>
        <span style={{color:"#4CAF50"}}>🏆 {portfolioSummary.topGainer.name?.slice(0,30)} +{portfolioSummary.topGainer.roi_pct?.toFixed(1)}%</span>
        {portfolioSummary.topLoser&&<span style={{color:"#E53935"}}>📉 {portfolioSummary.topLoser.name?.slice(0,30)} {portfolioSummary.topLoser.roi_pct?.toFixed(1)}%</span>}
      </div>}
    </div>
    )}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:7}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#111",letterSpacing:"2px"}}>I TUOI OROLOGI — ROI IN TEMPO REALE</div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={valuatePortfolio} disabled={valuating||!portfolio.length} style={{padding:"4px 10px",background:valuating?"#050505":"#0A1200",border:"1px solid #4CAF5015",color:valuating?"#111":"#4CAF50",fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:valuating?"not-allowed":"pointer"}}>
          {valuating?<><span className="spin">⌚</span> CALCOLO...</>:"📊 CALCOLA ROI"}
        </button>
        <button onClick={()=>setShowAddPortfolio(!showAddPortfolio)} style={{padding:"4px 10px",background:"none",border:"1px solid #C9A84C18",color:"#C9A84C",fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>+ AGGIUNGI</button>
      </div>
    </div>

    {/* Add form */}
    {showAddPortfolio&&(
    <div className="card" style={{marginBottom:10,border:"1px solid #C9A84C18"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#C9A84C",letterSpacing:"2px",marginBottom:9}}>AGGIUNGI OROLOGIO AL PORTFOLIO</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        {[["Nome/Modello *","name","text","es. Rolex Submariner 126610LN"],["Brand","brand","text","es. Rolex"],["Prezzo acquisto €","purchasePrice","number","es. 8500"],["Data acquisto","purchaseDate","date",""]].map(([l,k,t,p])=>(
          <div key={k}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#2A2A2A",marginBottom:3}}>{l}</div>
            <input type={t} value={portfolioForm[k]} onChange={e=>setPortfolioForm(f=>({...f,[k]:e.target.value}))} placeholder={p} style={{width:"100%",background:"#02020B",border:"1px solid #ffffff08",borderRadius:2,padding:"6px 8px",color:"#CEC6B0",fontSize:11}}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <label style={{display:"flex",gap:4,alignItems:"center",fontSize:10,color:"#FFD700",cursor:"pointer"}}>
          <input type="checkbox" checked={portfolioForm.isGold} onChange={e=>setPortfolioForm(f=>({...f,isGold:e.target.checked}))}/>
          Orologio in oro 18k
        </label>
        {portfolioForm.isGold&&<input value={portfolioForm.goldGrams} onChange={e=>setPortfolioForm(f=>({...f,goldGrams:e.target.value}))} placeholder="Grammi oro puro (es. 36.45)" type="number" style={{flex:1,background:"#02020B",border:"1px solid #FFD70018",borderRadius:2,padding:"5px 8px",color:"#FFD700",fontSize:11}}/>}
      </div>
      <textarea value={portfolioForm.notes} onChange={e=>setPortfolioForm(f=>({...f,notes:e.target.value}))} placeholder="Note (es. acquistato in garanzia, scatola e documenti)" style={{width:"100%",background:"#02020B",border:"1px solid #ffffff08",borderRadius:2,padding:"6px 8px",color:"#CEC6B0",fontSize:11,height:50,resize:"vertical",marginBottom:8}}/>
      <div style={{display:"flex",gap:6}}>
        <button onClick={addPortfolioItem} style={{padding:"7px 16px",background:"#C9A84C",color:"#02020B",border:"none",borderRadius:2,fontSize:"8px",letterSpacing:"2px",fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>SALVA</button>
        <button onClick={()=>setShowAddPortfolio(false)} style={{padding:"7px 16px",background:"none",border:"1px solid #ffffff0A",color:"#555",borderRadius:2,fontSize:"8px",fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>ANNULLA</button>
      </div>
    </div>
    )}

    {/* Lista portfolio */}
    {portfolio.length===0?<div style={{textAlign:"center",padding:"50px 0",color:"#080808"}}><div style={{fontSize:32,marginBottom:8}}>💼</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Nessun orologio nel portfolio</div><div style={{fontSize:11,color:"#080808",marginTop:4}}>Clicca "+ Aggiungi" per iniziare</div></div>
    :portfolio.map(item=>(
    <div key={item.id} className="row" style={{background:"#07070F",border:`1px solid ${item.roi_pct!=null?(item.roi_pct>=0?"#4CAF5015":"#E5393515"):"#ffffff05"}`,borderRadius:2,padding:"10px 12px",marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:6}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,marginBottom:2}}>{item.name}</div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A",display:"flex",gap:6,flexWrap:"wrap"}}>
            {item.purchase_price&&<span>Acquisto: {fmt(item.purchase_price)}</span>}
            {item.purchase_date&&<span>{item.purchase_date}</span>}
            {item.is_gold?<span style={{color:"#FFD700"}}>🥇 {item.gold_grams}g oro</span>:null}
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          {item.effective_value&&<div style={{fontSize:16,color:"#CEC6B0"}}>{fmt(item.effective_value)}</div>}
          {item.roi_pct!=null&&<ROIBadge pct={item.roi_pct}/>}
          {item.roi_eur!=null&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:item.roi_eur>=0?"#4CAF50":"#E53935",marginTop:2}}>{item.roi_eur>=0?"+":""}{fmt(item.roi_eur)}</div>}
        </div>
      </div>
      {item.gold_value&&<GoldBar price={item.effective_value} gold={item.gold_value}/>}
      {item.market_trend&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#555",marginTop:4}}>{item.market_trend}</div>}
      <div style={{display:"flex",gap:5,marginTop:6}}>
        <button onClick={()=>{setQuery(item.name);setTab("search");}} style={{padding:"3px 7px",background:"none",border:"1px solid #C9A84C14",color:"#C9A84C",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>CERCA PREZZI</button>
        <button onClick={()=>{fetch(`${API_BASE}/portfolio/${item.id}`,{method:"DELETE"}).then(()=>load("/portfolio",setPortfolio));}} style={{padding:"3px 7px",background:"none",border:"1px solid #E5393512",color:"#E57373",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>✕</button>
      </div>
    </div>
    ))}
  </div>
  )}

  {/* ══ SETUP ══ */}
  {tab==="setup"&&(
  <div className="fade">
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#111",letterSpacing:"2px",marginBottom:14}}>CONFIGURAZIONE SERVIZI</div>

    {/* Telegram */}
    <div className="card" style={{marginBottom:10,border:"1px solid #2196F318"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#2196F3",letterSpacing:"2px",marginBottom:10}}>📱 TELEGRAM — NOTIFICHE PUSH</div>
      <div style={{fontSize:12,color:"#555",marginBottom:10,lineHeight:1.7}}>
        Ricevi notifiche istantanee sul telefono per prezzi, arbitraggi oro, FOMO alert e discovery indie.
      </div>
      <div style={{background:"#030308",padding:"10px",borderRadius:2,marginBottom:10,fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"#444",lineHeight:1.8}}>
        <div style={{color:"#2196F3",marginBottom:4}}>SETUP (2 minuti):</div>
        <div>1. Apri Telegram → cerca <span style={{color:"#CEC6B0"}}>@BotFather</span></div>
        <div>2. Scrivi <span style={{color:"#CEC6B0"}}>/newbot</span> → dai un nome → copia il <span style={{color:"#CEC6B0"}}>TOKEN</span></div>
        <div>3. Incolla il TOKEN nel file <span style={{color:"#CEC6B0"}}>.env</span> come <span style={{color:"#CEC6B0"}}>TELEGRAM_TOKEN</span></div>
        <div>4. Cerca <span style={{color:"#CEC6B0"}}>@userinfobot</span> → scrivi qualcosa → copia il <span style={{color:"#CEC6B0"}}>id</span></div>
        <div>5. Incollalo qui sotto e clicca "Registra"</div>
      </div>
      <div style={{display:"flex",gap:7,alignItems:"center"}}>
        <input value={telegramChatId} onChange={e=>setTelegramChatId(e.target.value)} placeholder="Il tuo Telegram Chat ID (es. 123456789)" style={{flex:1,background:"#02020B",border:"1px solid #2196F318",borderRadius:2,padding:"7px 10px",color:"#CEC6B0",fontSize:12}}/>
        <button onClick={registerTelegram} disabled={!telegramChatId.trim()} style={{padding:"7px 14px",background:telegramRegistered?"#0A1200":"#0D1F40",border:`1px solid ${telegramRegistered?"#4CAF5033":"#2196F333"}`,color:telegramRegistered?"#4CAF50":"#2196F3",fontSize:"8px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>
          {telegramRegistered?"✓ REGISTRATO":"REGISTRA"}
        </button>
        <button onClick={()=>fetch(`${API_BASE}/telegram/test`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chatId:telegramChatId})})} disabled={!telegramChatId.trim()} style={{padding:"7px 14px",background:"none",border:"1px solid #ffffff0A",color:"#555",fontSize:"8px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>TEST</button>
      </div>
      {status?.telegramConfigured&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#4CAF50",marginTop:7}}>✓ Server configurato con TELEGRAM_TOKEN</div>}
    </div>

    {/* eBay */}
    <div className="card" style={{marginBottom:10}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#E53238",letterSpacing:"2px",marginBottom:8}}>🔴 EBAY API (gratis)</div>
      <div style={{fontSize:11,color:"#555",lineHeight:1.7,marginBottom:8}}>Accesso ufficiale a prezzi eBay — necessario per risultati eBay.</div>
      <div style={{background:"#030308",padding:"9px",borderRadius:2,fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#444",lineHeight:1.8}}>
        <div>1. Vai su <a href="https://developer.ebay.com" target="_blank" rel="noreferrer">developer.ebay.com</a></div>
        <div>2. "Get an Application Key" → crea app</div>
        <div>3. Copia <span style={{color:"#CEC6B0"}}>App ID (Client ID)</span> e <span style={{color:"#CEC6B0"}}>Cert ID (Secret)</span></div>
        <div>4. Metti in <span style={{color:"#CEC6B0"}}>.env</span> come <span style={{color:"#CEC6B0"}}>EBAY_CLIENT_ID</span> e <span style={{color:"#CEC6B0"}}>EBAY_CLIENT_SECRET</span></div>
      </div>
      {status&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",marginTop:7,color:status.ebayConfigured?"#4CAF50":"#E53935"}}>{status.ebayConfigured?"✓ eBay API configurata":"✗ eBay API non configurata"}</div>}
    </div>

    {/* YouTube */}
    <div className="card" style={{marginBottom:10}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#FF0000",letterSpacing:"2px",marginBottom:8}}>▶ YOUTUBE API (gratis — 10k req/giorno)</div>
      <div style={{fontSize:11,color:"#555",lineHeight:1.7,marginBottom:8}}>Senza questa chiave funziona con scraping — con la chiave hai più risultati e dati precisi.</div>
      <div style={{background:"#030308",padding:"9px",borderRadius:2,fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#444",lineHeight:1.8}}>
        <div>1. Vai su <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a></div>
        <div>2. Nuovo progetto → "Libreria API" → "YouTube Data API v3" → Abilita</div>
        <div>3. "Credenziali" → "Crea credenziali" → "Chiave API"</div>
        <div>4. Metti in <span style={{color:"#CEC6B0"}}>.env</span> come <span style={{color:"#CEC6B0"}}>YOUTUBE_API_KEY</span></div>
      </div>
      {status&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",marginTop:7,color:status.youtubeConfigured?"#4CAF50":"#FF9800"}}>{status.youtubeConfigured?"✓ YouTube API configurata":"⚠ Funziona con scraping (nessuna chiave)"}</div>}
    </div>

    {/* Google Alerts */}
    <div className="card" style={{marginBottom:10}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#4285F4",letterSpacing:"2px",marginBottom:8}}>🔔 GOOGLE ALERTS — monitor brand indie</div>
      <div style={{fontSize:11,color:"#555",lineHeight:1.7,marginBottom:8}}>Il server monitora Google News ogni ora. Puoi anche configurare Google Alerts personali:</div>
      <a href="https://www.google.com/alerts" target="_blank" rel="noreferrer" style={{display:"inline-block",padding:"6px 14px",background:"#0D1830",border:"1px solid #4285F433",color:"#4285F4",fontSize:"8px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2}}>APRI GOOGLE ALERTS →</a>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A",marginTop:7}}>Suggeriti: "Simon Brette" · "Czapek" · "Raul Pagès" · "Akrivia" · "Massena LAB"</div>
    </div>

    {/* Status completo */}
    <div className="card">
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#888",letterSpacing:"2px",marginBottom:10}}>⚙️ STATUS SISTEMA</div>
      {status&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {Object.entries({
          "Piattaforme": status.platforms, "Brand indie DB": status.independentBrands,
          "Modelli oro": status.modelsInDatabase, "YouTuber": status.youtubers,
          "Scansioni tot.": status.totalScans, "Arbitraggi attivi": status.arbitrageFound,
          "Articoli salvati": status.mediaArticles, "Portfolio items": status.portfolioItems,
        }).map(([l,v])=>(
          <div key={l} style={{background:"#030308",padding:"5px 7px",borderRadius:2}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#1A1A1A",marginBottom:1}}>{l}</div>
            <div style={{fontSize:13,color:"#888"}}>{v}</div>
          </div>
        ))}
      </div>}
    </div>
  </div>
  )}

  {/* ══ INDIE ══ */}
  {tab==="indie"&&(
  <div className="fade">
    {indieDrops.length>0&&<div style={{background:"linear-gradient(135deg,#1A0A00,#100600)",border:"1px solid #FF500033",borderRadius:2,padding:"10px 12px",marginBottom:10}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#FF5000",letterSpacing:"2px",marginBottom:7}}>🚨 DROP RILEVATI — AGISCI ORA</div>
      {indieDrops.slice(0,3).map((d,i)=><div key={i} className="row" style={{padding:"5px 0",borderBottom:i<2?"1px solid #ffffff04":"none"}}><div style={{display:"flex",justifyContent:"space-between",gap:7}}><div><span style={{fontSize:11,color:"#FF9800"}}>{d.brand_name}</span><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#555"}}>@{d.handle} · {new Date(d.detected_at).toLocaleString("it-IT")}</div></div><a href={`https://instagram.com/${d.handle}`} target="_blank" rel="noreferrer" style={{fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"#FF5000"}}>IG →</a></div></div>)}
    </div>}
    {indieAlerts.length>0&&<div className="card" style={{marginBottom:10,border:"1px solid #00BCD418"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#00BCD4",letterSpacing:"2px",marginBottom:7}}>🔭 DISCOVERY ALERTS</div>
      {indieAlerts.slice(0,4).map((a,i)=><div key={i} className="row" style={{padding:"5px 0",borderBottom:i<3?"1px solid #ffffff04":"none"}}><div style={{fontSize:10,color:"#00BCD4",marginBottom:1}}>{a.brand_name}</div><div style={{fontSize:10,color:"#888"}}>{a.message?.slice(0,70)}</div></div>)}
    </div>}
    {indieArticles.length>0&&<div className="card" style={{marginBottom:10}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#888",letterSpacing:"2px",marginBottom:7}}>📰 ARTICOLI RECENTI</div>
      {indieArticles.slice(0,5).map((a,i)=><div key={i} className="row" style={{padding:"5px 0",borderBottom:i<4?"1px solid #ffffff04":"none"}}><div style={{display:"flex",justifyContent:"space-between",gap:6}}><div><div style={{fontSize:10,marginBottom:1}}>{a.is_first_mention?<span style={{background:"#4CAF5018",color:"#4CAF50",padding:"1px 4px",borderRadius:2,fontSize:"7px",marginRight:4}}>PRIMO</span>:null}{a.title?.slice(0,55)}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A"}}>{a.source} · {a.brand_name}</div></div>{a.url&&<a href={a.url} target="_blank" rel="noreferrer" style={{fontSize:"9px"}}>→</a>}</div></div>)}
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:7}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px"}}>{filteredIndie.length} BRAND · DISCOVERY = finestra d'acquisto rimasta</div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[0,1,2,3,4].map(t=><button key={t} onClick={()=>setIndieTier(t)} style={{padding:"3px 8px",background:indieTier===t?(TIER_COLORS[t]||"#C9A84C"):"none",color:indieTier===t?"#02020B":(TIER_COLORS[t]||"#1A1A1A"),border:`1px solid ${TIER_COLORS[t]||"#1A1A1A"}33`,fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>{t===0?"TUTTI":`T${t}`}</button>)}
        <button onClick={()=>{setIndieScanning(true);fetch(`${API_BASE}/indie/scan`).catch(()=>{});setTimeout(()=>{load("/indie/opportunities",setIndieOpps);load("/indie/alerts",setIndieAlerts);setIndieScanning(false);},120000);}} disabled={indieScanning} style={{padding:"3px 8px",background:indieScanning?"#030303":"#0A1830",border:"1px solid #00BCD415",color:indieScanning?"#0F0F0F":"#00BCD4",fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:indieScanning?"not-allowed":"pointer"}}>
          {indieScanning?<><span className="spin">⌚</span> SCAN</>:"🔭 SCANSIONA"}
        </button>
        <button onClick={()=>{fetch(`${API_BASE}/indie/scan-drops`).catch(()=>{});setTimeout(()=>load("/indie/drops",setIndieDrops),30000);}} style={{padding:"3px 8px",background:"#1A0A00",border:"1px solid #FF500015",color:"#FF5000",fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>🚨 DROPS</button>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:7}}>
      {filteredIndie.map(brand=>{
        const tc=TIER_COLORS[brand.tier]||"#555";const isSel=selectedBrand===brand.key;
        return(<div key={brand.key} style={{background:isSel?"#0A0A16":"#07070F",border:`1px solid ${isSel?tc+"44":"#ffffff05"}`,borderRadius:2,padding:"11px",cursor:"pointer",transition:"border-color 0.2s"}} onClick={()=>isSel?setSelectedBrand(null):analyzeBrand(brand.key)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
            <div><div style={{fontSize:13,marginBottom:3}}>{brand.name}</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}><TierBadge tier={brand.tier}/>{brand.country&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A"}}>{brand.country} {brand.founded}</span>}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:16,color:brand.trend>15?"#4CAF50":brand.trend>5?"#FF9800":"#333",fontFamily:"'DM Mono',monospace"}}>{brand.trend>0?"+":""}{brand.trend||0}%</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>anno</div></div>
          </div>
          <DiscMeter score={brand.discoveryScore}/>
          <div style={{marginTop:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#1A1A1A"}}>{brand.avgPrice>0?`avg ${fmt(brand.avgPrice)}`:"n/d"}</div>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:tc}}>{isSel?"▲ chiudi":"▼ analizza"}</span>
          </div>
          {isSel&&<div style={{marginTop:8,borderTop:"1px solid #ffffff06",paddingTop:8}}>
            {loadingBrand?<div className="pulse" style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F"}}>Analisi...</div>
            :brandAnalysis?.brandKey===brand.key&&<div className="fade">
              <div style={{background:"#030308",padding:"7px 8px",borderRadius:2,marginBottom:6,border:`1px solid ${tc}18`}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:tc,letterSpacing:"2px",marginBottom:3}}>THESIS</div>
                <div style={{fontSize:10,color:"#555",fontStyle:"italic"}}>{brandAnalysis.discovery?.thesis}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
                {[["Hodinkee",brandAnalysis.signals?.hodinkee?.mentionCount||0,"art."],["Reddit",brandAnalysis.signals?.reddit?.totalPosts||0,"post"],["IG",fmtK(brandAnalysis.signals?.instagram?.reduce((s,i)=>s+(i.followersCount||0),0)||0),""],["Aste",(brandAnalysis.signals?.auctions?.phillips?.count||0)+(brandAnalysis.signals?.auctions?.sothebys?.count||0),"lotti"]].map(([l,v,u])=>(
                  <div key={l} style={{background:"#050510",padding:"4px 6px",borderRadius:2}}><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",marginBottom:1}}>{l}</div><div style={{fontSize:12,color:"#555"}}>{v} <span style={{fontSize:"7px",color:"#1A1A1A"}}>{u}</span></div></div>
                ))}
              </div>
              {Object.entries(brandAnalysis.alerts||{}).filter(([,v])=>v).map(([k])=><div key={k} style={{background:"#0D2A0D",padding:"4px 7px",borderRadius:2,marginBottom:3,fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#4CAF50"}}>⚡ {k==="firstHodinkeeArticle"?"Prima menzione Hodinkee!":k==="gphgNomination"?"GPHG!":"Alert attivo"}</div>)}
              {brand.buySignal&&<div style={{background:"#0A1200",padding:"5px 7px",borderRadius:2,borderLeft:`2px solid #4CAF50`,fontSize:9,color:"#4CAF50",fontStyle:"italic",marginTop:4}}>💡 {brand.buySignal}</div>}
              <button onClick={()=>{setQuery(brand.name);setTab("search");}} style={{marginTop:7,width:"100%",padding:"5px",background:"none",border:`1px solid ${tc}22`,color:tc,fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>CERCA PREZZI →</button>
            </div>}
          </div>}
        </div>);
      })}
    </div>
  </div>
  )}

  {/* ══ FACEBOOK ══ */}
  {tab==="facebook"&&(
  <div className="fade">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:7}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px"}}>ANNUNCI FACEBOOK VICINO A TE</div>
      <select value={city} onChange={e=>setCity(e.target.value)} style={{background:"#07070F",border:"1px solid #2196F318",borderRadius:2,padding:"5px 8px",color:city?"#2196F3":"#1A1A1A",fontSize:10}}>
        <option value="">Tutte</option>{cities.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
      </select>
    </div>
    {fbListings.length===0?<div style={{textAlign:"center",padding:"50px 0",color:"#060606"}}><div style={{fontSize:30,marginBottom:7}}>📍</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Cerca un orologio nella tab Ricerca selezionando la città</div></div>
    :fbListings.filter(f=>!city||f.location?.toLowerCase().includes(city)||f.is_local).map((f,i)=>(
    <div key={i} className="row" style={{background:"linear-gradient(135deg,#0A1525,#050D18)",border:`1px solid ${f.is_local?"#2196F320":"#ffffff05"}`,borderRadius:2,padding:"9px 11px",marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:4}}>
        <div style={{flex:1}}><div style={{fontSize:11,marginBottom:1}}>{f.title}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#2196F333"}}>📍 {f.location||"—"}{f.distance_km?` · ${f.distance_km}km`:""} · {f.group_name}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:16,color:"#2196F3"}}>{fmt(f.price)}</div></div>
      </div>
      <a href={f.url} target="_blank" rel="noreferrer" style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#2196F3",letterSpacing:"1px"}}>VEDI →</a>
    </div>
    ))}
  </div>
  )}

  {/* ══ ARBITRAGGIO ══ */}
  {tab==="arbitrage"&&(
  <div className="fade">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:7}}>
      <div>{goldPrice&&<div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#FFD700"}}>🥇 €{goldPrice.toFixed(2)}/g</div>}<div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px"}}>OROLOGI 18K SOTTO VALORE SPOT ORO</div></div>
      <button onClick={()=>{setScanning(true);fetch(`${API_BASE}/gold-scan`).catch(()=>{});setTimeout(()=>{load("/arbitrage",setArbitrage);setScanning(false);},90000);}} disabled={scanning} style={{padding:"4px 9px",background:scanning?"#040404":"#0D2000",border:"1px solid #4CAF5010",color:scanning?"#0A0A0A":"#4CAF50",fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:scanning?"not-allowed":"pointer"}}>{scanning?<><span className="spin">⌚</span> SCAN</>:"🔍 SCANSIONA"}</button>
    </div>
    {arbitrage.length===0?<div style={{textAlign:"center",padding:"50px 0",color:"#060606"}}><div style={{fontSize:30,marginBottom:7}}>🥇</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Clicca Scansiona</div></div>
    :arbitrage.map((a,i)=>(
    <div key={i} className="row" style={{background:"linear-gradient(135deg,#0D2000,#080F00)",border:"1px solid #4CAF5010",borderRadius:2,padding:"9px 11px",marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:5}}>
        <div style={{flex:1}}><div style={{fontSize:12,marginBottom:1}}>{a.title}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>{a.platform} · {new Date(a.found_at).toLocaleString("it-IT")}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:15,color:"#4CAF50"}}>{fmt(a.price)}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#FFD700"}}>oro {fmt(a.gold_value_eur)}</div></div>
      </div>
      <GoldBar price={a.price} gold={a.gold_value_eur}/>
      <div style={{display:"flex",gap:5,marginTop:5,alignItems:"center"}}>
        <span style={{background:"#4CAF5010",color:"#4CAF50",border:"1px solid #4CAF5018",padding:"1px 5px",borderRadius:2,fontSize:"7px",fontFamily:"'DM Mono',monospace"}}>−{a.discount_pct}%</span>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0A0A0A"}}>{a.gold_weight_grams}g · {fmt((a.gold_value_eur||0)-a.price)} risparmio</span>
        <a href={a.url} target="_blank" rel="noreferrer" style={{marginLeft:"auto",padding:"2px 7px",background:"#4CAF5010",border:"1px solid #4CAF5018",color:"#4CAF50",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2}}>VEDI →</a>
      </div>
    </div>
    ))}
  </div>
  )}

  {/* ══ VINTAGE ══ */}
  {tab==="vintage"&&(
  <div className="fade">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px"}}>VINTAGE SOTTOVALUTATI</div>
      <button onClick={()=>{setVintageScanning(true);fetch(`${API_BASE}/vintage-scan${city?`?city=${city}`:""}`).catch(()=>{});setTimeout(()=>{load("/vintage",setVintage);setVintageScanning(false);},120000);}} disabled={vintageScanning} style={{padding:"4px 9px",background:vintageScanning?"#040404":"#0D0D20",border:"1px solid #C9A84C12",color:vintageScanning?"#0A0A0A":"#C9A84C",fontSize:"7px",letterSpacing:"1px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:vintageScanning?"not-allowed":"pointer"}}>{vintageScanning?<><span className="spin">⌚</span> ANALISI</>:"🕰️ SCANSIONA"}</button>
    </div>
    {vintage.length===0?<div style={{textAlign:"center",padding:"50px 0",color:"#060606"}}><div style={{fontSize:30,marginBottom:7}}>🕰️</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Clicca Scansiona Vintage</div></div>
    :vintage.map((v,i)=>(
    <div key={i} className="row" style={{background:"#07070F",border:`1px solid ${v.hype_score>=60?"#FF980015":"#ffffff04"}`,borderRadius:2,padding:"9px 11px",marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:6}}>
        <div style={{flex:1}}><div style={{fontSize:12,marginBottom:1}}>{v.model}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>{new Date(v.scanned_at).toLocaleString("it-IT")}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:17,color:v.hype_score>=60?"#FF9800":"#333",fontFamily:"'DM Mono',monospace"}}>{v.hype_score}/100</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:6}}>
        {[["YT",v.yt_videos],["Reddit",v.reddit_posts],["FB",v.fb_listings],["C24",v.chrono24_listings]].map(([l,val])=>(
          <div key={l} style={{background:"#040408",padding:"4px 5px",borderRadius:2}}><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",marginBottom:1}}>{l}</div><div style={{fontSize:11,color:"#444"}}>{val||0}</div></div>
        ))}
      </div>
      <button onClick={()=>{setQuery(v.model);setTab("search");}} style={{padding:"3px 7px",background:"none",border:"1px solid #C9A84C12",color:"#C9A84C",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>ANALIZZA →</button>
    </div>
    ))}
  </div>
  )}

  {/* ══ HYPE ══ */}
  {tab==="hype"&&(
  <div className="fade">
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px",marginBottom:10}}>HYPE CRESCENTE — ULTIMI 7 GIORNI</div>
    {topHype.length===0?<div style={{textAlign:"center",padding:"50px 0",color:"#060606"}}><div style={{fontSize:30,marginBottom:7}}>🔥</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Analizza orologi per popolare</div></div>
    :topHype.map((item,i)=>(
    <div key={i} className="row" style={{background:"#07070F",border:`1px solid ${item.max_score>=70?"#FF450015":item.max_score>=50?"#FF980015":"#ffffff04"}`,borderRadius:2,padding:"8px 11px",marginBottom:5,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#0F0F0F",width:14}}>{i+1}</div>
      <div style={{flex:1}}><div style={{fontSize:12,marginBottom:1}}>{item.watch_model}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>{new Date(item.last_scan).toLocaleString("it-IT")}</div></div>
      <div style={{fontSize:18,color:item.max_score>=70?"#FF4500":item.max_score>=50?"#FF9800":"#222",fontFamily:"'DM Mono',monospace"}}>{item.max_score}</div>
      <button onClick={()=>{setQuery(item.watch_model);setTab("search");}} style={{padding:"3px 7px",background:"none",border:"1px solid #C9A84C12",color:"#C9A84C",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>→</button>
    </div>
    ))}
  </div>
  )}

  {/* ══ TRENDS ══ */}
  {tab==="trends"&&(
  <div className="fade">
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <div className="card" style={{border:"1px solid #4CAF5010"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#4CAF50",letterSpacing:"2px",marginBottom:8}}>🚀 TOP RIVALUTAZIONE</div>
        {(trends?.topAppreciation||[]).map((m,i)=>(
          <div key={i} className="row" style={{padding:"5px 0",borderBottom:"1px solid #ffffff03"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:10,flex:1}}>{m.model}</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#4CAF50"}}>+{m.trend}%</span></div>
            <div style={{height:2,background:"#080808",borderRadius:1}}><div style={{height:"100%",width:`${(m.trend/45)*100}%`,background:"#4CAF50"}}/></div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",marginTop:1}}>{m.note}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{border:"1px solid #E5393510"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#E53935",letterSpacing:"2px",marginBottom:8}}>📉 TOP SVALUTAZIONE</div>
        {(trends?.topDepreciation||[]).map((m,i)=>(
          <div key={i} className="row" style={{padding:"5px 0",borderBottom:"1px solid #ffffff03"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:10,flex:1}}>{m.model}</span><span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#E53935"}}>{m.trend}%</span></div>
            <div style={{height:2,background:"#080808",borderRadius:1}}><div style={{height:"100%",width:`${(Math.abs(m.trend)/20)*100}%`,background:"#E53935"}}/></div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",marginTop:1}}>{m.note}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="card" style={{border:"1px solid #FFD70010"}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#FFD700",letterSpacing:"2px",marginBottom:6}}>📊 STORICO ORO</div>
      {goldHistory.length>1?(()=>{const prices=goldHistory.map(h=>h.price_eur_per_gram).filter(Boolean).reverse();const min=Math.min(...prices),max=Math.max(...prices),range=max-min||1;const w=100,h=34;const pts=prices.map((p,i)=>`${(i/(prices.length-1))*w},${h-((p-min)/range)*(h-5)-2}`).join(" ");return<div><svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:42}}><polyline points={pts} fill="none" stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round"/></svg><div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F",marginTop:2}}><span>€{min.toFixed(2)}</span><span style={{color:"#FFD700"}}>€{prices.at(-1)?.toFixed(2)}/g</span><span>€{max.toFixed(2)}</span></div></div>;})():<div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#060606"}}>Disponibile dopo la prima scansione</div>}
    </div>
  </div>
  )}

  {/* ══ WATCHLIST ══ */}
  {tab==="watchlist"&&(
  <div className="fade">
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px",marginBottom:10}}>PREZZI 30min · SOCIAL 4h · INDIE RSS 1h · VINTAGE 24h · PORTFOLIO lunedì</div>
    {watchlist.length===0?<div style={{textAlign:"center",padding:"50px 0",color:"#060606"}}><div style={{fontSize:28,marginBottom:7}}>⌚</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Nessun orologio monitorato</div></div>
    :watchlist.map(item=>(
    <div key={item.id} className="row" style={{background:"#07070F",border:"1px solid #ffffff04",borderRadius:2,marginBottom:5,padding:"8px 11px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:5}}>
      <div><div style={{fontSize:12,marginBottom:1}}>{item.query}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>{new Date(item.created_at).toLocaleString("it-IT")}{item.threshold&&<> · <span style={{color:"#C9A84C"}}>{fmt(item.threshold)}</span></>}{item.gold_arbitrage?<span style={{color:"#FFD700"}}> · 🥇</span>:""}{item.track_signals?<span style={{color:"#FF9800"}}> · 📡</span>:""}{item.telegram_chat_id?<span style={{color:"#2196F3"}}> · 📱</span>:""}{item.user_city&&<span style={{color:"#2196F3"}}> · 📍{item.user_city}</span>}</div></div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={()=>{setQuery(item.query);if(item.user_city)setCity(item.user_city);setTab("search");}} style={{padding:"2px 6px",background:"none",border:"1px solid #C9A84C10",color:"#C9A84C",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>→</button>
        <button onClick={()=>{fetch(`${API_BASE}/watchlist/${item.id}`,{method:"DELETE"}).then(()=>load("/watchlist",setWatchlist));}} style={{padding:"2px 6px",background:"none",border:"1px solid #E5393510",color:"#E57373",fontSize:"7px",fontFamily:"'DM Mono',monospace",borderRadius:2,cursor:"pointer"}}>✕</button>
      </div>
    </div>
    ))}
  </div>
  )}

  {/* ══ ALERTS ══ */}
  {tab==="alerts"&&(
  <div className="fade">
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#0F0F0F",letterSpacing:"2px",marginBottom:10}}>TUTTI GLI ALERT — EMAIL + TELEGRAM</div>
    {indieAlerts.slice(0,5).map(a=>(
    <div key={a.id} className="row" style={{background:"linear-gradient(135deg,#0A1830,#050D20)",border:"1px solid #00BCD415",borderRadius:2,padding:"8px 11px",marginBottom:5,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
      <div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"7px",color:"#00BCD4",marginBottom:1}}>🔭 {a.brand_name}</div><div style={{fontSize:10}}>{a.message?.slice(0,65)}</div></div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>{new Date(a.sent_at).toLocaleString("it-IT")}</div>
    </div>
    ))}
    {alerts.map(a=>(
    <div key={a.id} className="row" style={{background:"#07070F",border:`1px solid ${a.discount_pct?"#4CAF5010":a.hype_score?"#FF980010":"#C9A84C0A"}`,borderRadius:2,padding:"8px 11px",marginBottom:5,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
      <div><div style={{fontSize:11,marginBottom:1}}>{a.query}</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#0F0F0F"}}>{a.platform} · <span style={{color:a.discount_pct?"#4CAF50":"#C9A84C"}}>{fmt(a.price)}</span>{a.gold_value&&<span style={{color:"#FFD700"}}> · oro {fmt(a.gold_value)}</span>}{a.hype_score&&<span style={{color:"#FF9800"}}> · 🔥 {a.hype_score}</span>}</div></div>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:"6px",color:"#060606"}}>{new Date(a.sent_at).toLocaleString("it-IT")}</div>
    </div>
    ))}
    {alerts.length===0&&indieAlerts.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:"#060606"}}><div style={{fontSize:28,marginBottom:7}}>🔔</div><div style={{fontFamily:"'DM Mono',monospace",fontSize:"8px"}}>Nessun alert ancora</div></div>}
  </div>
  )}

  </div>
  </div>
  );
}
