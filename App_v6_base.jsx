import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "http://localhost:3001/api";
const fmt = (n, c = "EUR") => n ? new Intl.NumberFormat("it-IT", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n) : "—";
const fmtK = n => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(0) + "K" : String(n || 0);

// ── UI ────────────────────────────────────────────────────────
const TIER_COLORS = { 1: "#888", 2: "#FF9800", 3: "#4CAF50", 4: "#00BCD4" };
const TIER_LABELS = { 1: "Già esploso", 2: "In crescita ora ★", 3: "Da scoprire ★★", 4: "Micro-brand ★★★" };

function TierBadge({ tier }) {
  const color = TIER_COLORS[tier] || "#555";
  return <span style={{ background: color + "18", color, border: `1px solid ${color}33`, padding: "2px 7px", borderRadius: 2, fontSize: "9px", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>T{tier} {TIER_LABELS[tier]}</span>;
}

function DiscoveryMeter({ score }) {
  const color = score > 70 ? "#4CAF50" : score > 50 ? "#FF9800" : score > 30 ? "#FF5722" : "#E53935";
  const label = score > 70 ? "🟢 Finestra aperta" : score > 50 ? "🟡 Chiudendosi" : score > 30 ? "🟠 Quasi chiusa" : "🔴 Scoperto";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#333", marginBottom: 3 }}>
        <span>DISCOVERY</span><span style={{ color }}>{score}/100</span>
      </div>
      <div style={{ height: 4, background: "#111", borderRadius: 2, overflow: "hidden", marginBottom: 3 }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 2, transition: "width 0.8s" }} />
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color }}>{label}</div>
    </div>
  );
}

function HypeGauge({ score, label }) {
  const color = score >= 80 ? "#FF4500" : score >= 65 ? "#FF9800" : score >= 45 ? "#4CAF50" : "#444";
  const r = 30, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={68} height={68} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={34} cy={34} r={r} fill="none" stroke="#111" strokeWidth={5} />
        <circle cx={34} cy={34} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x={34} y={34} textAnchor="middle" dominantBaseline="middle"
          style={{ fill: color, fontSize: 14, fontWeight: "bold", fontFamily: "'DM Mono',monospace", transform: "rotate(90deg)", transformOrigin: "34px 34px" }}>
          {score}
        </text>
      </svg>
      <div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#2A2A2A", letterSpacing: "2px", marginBottom: 2 }}>HYPE</div>
        <div style={{ fontSize: 11, color }}>{label}</div>
      </div>
    </div>
  );
}

function Bar({ label, value, color = "#C9A84C", icon = "" }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#2A2A2A", marginBottom: 2 }}>
        <span>{icon} {label}</span><span style={{ color }}>{value}/100</span>
      </div>
      <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2, transition: "width 0.8s" }} />
      </div>
    </div>
  );
}

function GoldBar({ price, gold }) {
  if (!gold || !price) return null;
  const isUnder = price < gold;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ height: 3, background: "#0A0A0A", borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: "71.4%", top: 0, bottom: 0, width: 1, background: "#FFD70033" }} />
        <div style={{ height: "100%", width: `${Math.min((price / gold) * 71.4, 100)}%`, background: isUnder ? "linear-gradient(90deg,#1B5E20,#4CAF50)" : "linear-gradient(90deg,#C9A84C,#E53935)", transition: "width 0.8s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono',monospace", fontSize: "8px", marginTop: 2 }}>
        <span style={{ color: isUnder ? "#4CAF50" : "#C9A84C" }}>{fmt(price)}</span>
        <span style={{ color: "#FFD700" }}>oro {fmt(gold)}</span>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function WatchPriceBotV6() {
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [cities, setCities] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [results, setResults] = useState(null);
  const [signals, setSignals] = useState(null);
  const [error, setError] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [arbitrage, setArbitrage] = useState([]);
  const [vintage, setVintage] = useState([]);
  const [topHype, setTopHype] = useState([]);
  const [trends, setTrends] = useState(null);
  const [status, setStatus] = useState(null);
  const [goldPrice, setGoldPrice] = useState(null);
  const [goldHistory, setGoldHistory] = useState([]);
  const [fbListings, setFbListings] = useState([]);
  // Indie state
  const [indieBrands, setIndieBrands] = useState([]);
  const [indieTierFilter, setIndieTierFilter] = useState(0); // 0=tutti
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandAnalysis, setBrandAnalysis] = useState(null);
  const [loadingBrand, setLoadingBrand] = useState(false);
  const [indieAlerts, setIndieAlerts] = useState([]);
  const [indieArticles, setIndieArticles] = useState([]);
  const [indieOpportunities, setIndieOpportunities] = useState([]);
  const [indieScanning, setIndieScanning] = useState(false);
  const [form, setForm] = useState({ threshold: "", email: "", goldArbitrage: true, trackSignals: true, userCity: "", radiusKm: 50 });
  const [aiInsight, setAiInsight] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [vintageScanning, setVintageScanning] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async (ep, setter) => {
    try { const r = await fetch(`${API_BASE}${ep}`); if (r.ok) setter(await r.json()); } catch {}
  }, []);

  const loadStatus = useCallback(async () => {
    try { const r = await fetch(`${API_BASE}/status`); const d = await r.json(); setStatus(d); if (d.goldPricePerGram) setGoldPrice(d.goldPricePerGram); } catch { setStatus(null); }
  }, []);

  useEffect(() => {
    loadStatus();
    load("/watchlist", setWatchlist);
    load("/alerts", setAlerts);
    load("/arbitrage", setArbitrage);
    load("/vintage", setVintage);
    load("/top-hype", setTopHype);
    load("/trends", setTrends);
    load("/gold-price", d => { if (d.pricePerGram) setGoldPrice(d.pricePerGram); setGoldHistory(d.history || []); });
    load("/facebook", setFbListings);
    load("/cities", setCities);
    load("/indie/brands", d => setIndieBrands(d.brands || []));
    load("/indie/opportunities", setIndieOpportunities);
    load("/indie/alerts", setIndieAlerts);
    load("/indie/articles", setIndieArticles);
    pollRef.current = setInterval(() => {
      loadStatus();
      load("/alerts", setAlerts);
      load("/indie/alerts", setIndieAlerts);
      load("/indie/articles", setIndieArticles);
    }, 60000);
    return () => clearInterval(pollRef.current);
  }, [load, loadStatus]);

  const analyzeBrand = async (brandKey) => {
    setSelectedBrand(brandKey);
    setLoadingBrand(true);
    setBrandAnalysis(null);
    try {
      const r = await fetch(`${API_BASE}/indie/analyze/${brandKey}`);
      if (r.ok) setBrandAnalysis(await r.json());
    } catch {}
    setLoadingBrand(false);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoadingSearch(true); setLoadingSignals(true);
    setError(null); setResults(null); setSignals(null); setAiInsight("");
    const cp = city ? `&city=${encodeURIComponent(city)}` : "";
    try {
      const [pr, sr] = await Promise.all([
        fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}${cp}`),
        fetch(`${API_BASE}/signals?q=${encodeURIComponent(query)}${cp}`),
      ]);
      if (!pr.ok) throw new Error(`Errore ${pr.status}`);
      const pd = await pr.json();
      setResults(pd); setLoadingSearch(false);
      if (pd.goldPricePerGram) setGoldPrice(pd.goldPricePerGram);
      if (sr.ok) { const sd = await sr.json(); setSignals(sd); }
      setLoadingSignals(false);

      // AI
      setLoadingAI(true);
      try {
        const sd = sr.ok ? await sr.json().catch(() => null) : null;
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514", max_tokens: 1200,
            messages: [{ role: "user", content: `Sei un analista esperto di orologi di lusso, sentiment e investimenti.
MODELLO: "${query}" ${city ? `| CITTÀ: ${city}` : ""}
PREZZO: €${pd.lowest?.priceEur?.toLocaleString("it-IT")} su ${pd.lowest?.platform}
GOLD SPOT: €${pd.goldPricePerGram}/g | ARBITRAGGIO: ${pd.arbitrageOpportunities?.length || 0}
FB LOCALE: ${(pd.facebookListings?.filter(f => f.isLocal) || []).length} annunci
HYPE: ${sd?.hypeScore?.score || "—"}/100 — ${sd?.hypeScore?.label || ""}
YT: ${sd?.hypeScore?.signals?.ytVideosFound || 0} video | Reddit: ${sd?.hypeScore?.signals?.redditPosts || 0} post
5 frasi dirette: prezzo ok? sentiment? FB locale conveniente? momento giusto? un rischio concreto.` }]
          })
        });
        const ai = await r.json();
        setAiInsight(ai.content?.[0]?.text || "");
      } catch { setAiInsight("Analisi AI non disponibile."); }
      setLoadingAI(false);
    } catch (e) {
      setError(e.message.includes("Failed to fetch") ? "Server offline — avvia: cd server && npm start" : e.message);
      setLoadingSearch(false); setLoadingSignals(false);
    }
  };

  const addToWatchlist = async () => {
    if (!results?.query) return;
    try {
      await fetch(`${API_BASE}/watchlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: results.query, threshold: form.threshold ? parseFloat(form.threshold) : null, email: form.email || null, goldArbitrage: form.goldArbitrage, trackSignals: form.trackSignals, userCity: form.userCity || city || null, radiusKm: form.radiusKm }) });
      load("/watchlist", setWatchlist); setTab("watchlist");
    } catch {}
  };

  const arbs = results?.arbitrageOpportunities || [];
  const fbLocal = results?.facebookListings?.filter(f => f.isLocal) || [];
  const hs = signals?.hypeScore;
  const serverOnline = !!status;

  const filteredIndieBrands = indieBrands.filter(b => !indieTierFilter || b.tier === indieTierFilter);

  const TABS = [
    ["search", "Ricerca"],
    ["indie", `🔭 Indie (${indieBrands.length})`],
    ["facebook", `📍 Locale (${fbListings.filter(f => f.is_local).length})`],
    ["arbitrage", `🥇 Oro (${arbitrage.length})`],
    ["vintage", `🕰️ Vintage (${vintage.length})`],
    ["hype", `🔥 Hype (${topHype.length})`],
    ["trends", "📈 Mercato"],
    ["watchlist", `Lista (${watchlist.length})`],
    ["alerts", `Alert (${alerts.length + indieAlerts.length})`],
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#03030C", color: "#D0C8B2", fontFamily: "'Cormorant Garamond',Georgia,serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#C9A84C18}
        .fade{animation:fade 0.4s ease}@keyframes fade{from{opacity:0;transform:translateY(5px)}}
        .pulse{animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .spin{animation:spin 1.2s linear infinite;display:inline-block}@keyframes spin{to{transform:rotate(360deg)}}
        .row:hover{background:#ffffff04!important;transition:background 0.15s}
        .tab{background:none;border:none;font-family:'DM Mono',monospace;font-size:8px;letter-spacing:1px;text-transform:uppercase;padding:10px 12px;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s;white-space:nowrap}
        .on{color:#C9A84C;border-bottom-color:#C9A84C!important}.off{color:#1E1E1E}
        input,button,select{font-family:inherit}a{color:#C9A84C;text-decoration:none}
        .indie-card{transition:border-color 0.2s}.indie-card:hover{border-color:#C9A84C44!important}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#07070F", borderBottom: "1px solid #C9A84C0C", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", letterSpacing: "4px", color: "#C9A84C2A", marginBottom: 2 }}>v6 · PREZZI · ORO · SOCIAL · FB LOCAL · INDIE DISCOVERY</div>
          <div style={{ fontSize: "19px", fontWeight: 300 }}>⌚ PriceRadar <span style={{ color: "#FFD700" }}>Gold</span> <span style={{ color: "#00BCD4", fontSize: 10 }}>+ Indie</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginBottom: 2 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: serverOnline ? "#4CAF50" : "#E53935", display: "inline-block" }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: serverOnline ? "#4CAF50" : "#333" }}>{serverOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>
          {goldPrice && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#FFD700" }}>🥇 €{goldPrice.toFixed(2)}/g</div>}
          {status && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", marginTop: 1 }}>{status.independentBrands} brand indie · {status.mediaArticles} articoli · {status.discoveryAlerts} alert</div>}
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: "#07070F", borderBottom: "1px solid #ffffff04", padding: "0 18px", display: "flex", overflowX: "auto" }}>
        {TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? "on" : "off"}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "18px" }}>

        {/* ══ INDIE DISCOVERY ══ */}
        {tab === "indie" && (
          <div className="fade">

            {/* Alert critici in cima */}
            {indieAlerts.length > 0 && (
              <div style={{ background: "linear-gradient(135deg,#0A1830,#050D20)", border: "1px solid #00BCD433", borderRadius: 2, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#00BCD4", letterSpacing: "3px", marginBottom: 10 }}>🔭 DISCOVERY ALERTS RECENTI</div>
                {indieAlerts.slice(0, 4).map((a, i) => (
                  <div key={i} className="row" style={{ padding: "7px 0", borderBottom: i < 3 ? "1px solid #ffffff05" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, marginBottom: 1, color: "#00BCD4" }}>{a.brand_name}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{a.message}</div>
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A", whiteSpace: "nowrap" }}>{new Date(a.sent_at).toLocaleDateString("it-IT")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Articoli media recenti */}
            {indieArticles.length > 0 && (
              <div style={{ background: "#09090F", border: "1px solid #ffffff06", borderRadius: 2, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#888", letterSpacing: "3px", marginBottom: 10 }}>📰 ULTIMI ARTICOLI SU BRAND INDIE</div>
                {indieArticles.slice(0, 5).map((a, i) => (
                  <div key={i} className="row" style={{ padding: "6px 0", borderBottom: i < 4 ? "1px solid #ffffff04" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        {a.is_first_mention ? <span style={{ background: "#4CAF5018", color: "#4CAF50", padding: "1px 5px", borderRadius: 2, fontSize: "8px", fontFamily: "'DM Mono',monospace", marginRight: 6 }}>PRIMO</span> : null}
                        <span style={{ fontSize: 11 }}>{a.title?.slice(0, 60)}</span>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#333", marginTop: 1 }}>{a.source} · {a.brand_name}</div>
                      </div>
                      {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: "9px", color: "#C9A84C", whiteSpace: "nowrap" }}>→</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Header filtri */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A", letterSpacing: "2px" }}>
                {filteredIndieBrands.length} BRAND · Discovery Score = finestra d'acquisto rimasta
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[0, 1, 2, 3, 4].map(t => (
                  <button key={t} onClick={() => setIndieTierFilter(t)}
                    style={{ padding: "4px 9px", background: indieTierFilter === t ? (TIER_COLORS[t] || "#C9A84C") : "none", color: indieTierFilter === t ? "#03030C" : (TIER_COLORS[t] || "#333"), border: `1px solid ${TIER_COLORS[t] || "#333"}33`, fontSize: "7px", letterSpacing: "1px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>
                    {t === 0 ? "TUTTI" : `T${t}`}
                  </button>
                ))}
                <button onClick={() => { setIndieScanning(true); fetch(`${API_BASE}/indie/scan`).catch(() => {}); setTimeout(() => { load("/indie/opportunities", setIndieOpportunities); load("/indie/alerts", setIndieAlerts); setIndieScanning(false); }, 120000); }} disabled={indieScanning}
                  style={{ padding: "4px 9px", background: indieScanning ? "#080808" : "#0A1830", border: "1px solid #00BCD418", color: indieScanning ? "#111" : "#00BCD4", fontSize: "7px", letterSpacing: "1px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: indieScanning ? "not-allowed" : "pointer" }}>
                  {indieScanning ? <><span className="spin">⌚</span> SCAN...</> : "🔭 SCANSIONA"}
                </button>
              </div>
            </div>

            {/* Griglia brand */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8, marginBottom: 14 }}>
              {filteredIndieBrands.map((brand, i) => {
                const tierColor = TIER_COLORS[brand.tier] || "#555";
                const isSelected = selectedBrand === brand.key;
                return (
                  <div key={brand.key} className="indie-card row" style={{ background: isSelected ? "#0C0C18" : "#09090F", border: `1px solid ${isSelected ? tierColor + "44" : "#ffffff07"}`, borderRadius: 2, padding: "12px", cursor: "pointer" }}
                    onClick={() => isSelected ? setSelectedBrand(null) : analyzeBrand(brand.key)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, marginBottom: 3 }}>{brand.name}</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <TierBadge tier={brand.tier} />
                          {brand.country && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#333" }}>{brand.country} {brand.founded}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, color: brand.trend > 15 ? "#4CAF50" : brand.trend > 5 ? "#FF9800" : "#555", fontFamily: "'DM Mono',monospace" }}>
                          {brand.trend > 0 ? "+" : ""}{brand.trend || 0}%
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#2A2A2A" }}>anno</div>
                      </div>
                    </div>

                    <DiscoveryMeter score={brand.discoveryScore} />

                    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#2A2A2A" }}>
                        {brand.avgPrice > 0 ? `avg ${fmt(brand.avgPrice)}` : "prezzo n/d"}
                      </div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: tierColor }}>
                        {isSelected ? "▲ chiudi" : "▼ analizza"}
                      </span>
                    </div>

                    {/* Panel analisi espanso */}
                    {isSelected && (
                      <div style={{ marginTop: 10, borderTop: "1px solid #ffffff07", paddingTop: 10 }}>
                        {loadingBrand ? (
                          <div className="pulse" style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#1A1A1A" }}>Analisi in corso...</div>
                        ) : brandAnalysis?.brandKey === brand.key && (
                          <div className="fade">
                            {/* Discovery thesis */}
                            <div style={{ background: "#050510", padding: "8px 10px", borderRadius: 2, marginBottom: 8, border: `1px solid ${tierColor}22` }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: tierColor, letterSpacing: "2px", marginBottom: 4 }}>INVESTMENT THESIS</div>
                              <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>{brandAnalysis.discovery?.thesis}</div>
                            </div>

                            {/* Segnali */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
                              {[
                                ["Hodinkee", brandAnalysis.signals?.hodinkee?.mentionCount || 0, "art."],
                                ["Reddit", brandAnalysis.signals?.reddit?.totalPosts || 0, "post"],
                                ["IG followers", fmtK(brandAnalysis.signals?.instagram?.reduce((s, i) => s + (i.followersCount || 0), 0) || 0), ""],
                                ["Aste", (brandAnalysis.signals?.auctions?.phillips?.count || 0) + (brandAnalysis.signals?.auctions?.sothebys?.count || 0), "lotti"],
                              ].map(([label, val, unit]) => (
                                <div key={label} style={{ background: "#08080F", padding: "6px 8px", borderRadius: 2 }}>
                                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A", marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 14, color: "#888" }}>{val} <span style={{ fontSize: "8px", color: "#333" }}>{unit}</span></div>
                                </div>
                              ))}
                            </div>

                            {/* Alert attivi */}
                            {Object.entries(brandAnalysis.alerts || {}).filter(([, v]) => v).map(([k]) => (
                              <div key={k} style={{ background: "#0D2A0D", padding: "5px 8px", borderRadius: 2, marginBottom: 4, fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#4CAF50" }}>
                                ⚡ {k === 'firstHodinkeeArticle' ? 'Prima menzione Hodinkee!' : k === 'firstAuctionAppearance' ? 'Prima apparizione in asta!' : k === 'gphgNomination' ? 'Nominato GPHG!' : 'Reddit in esplosione!'}
                              </div>
                            ))}

                            {/* Buy signal */}
                            {brand.buySignal && (
                              <div style={{ background: "#0A1200", padding: "6px 8px", borderRadius: 2, borderLeft: `2px solid #4CAF50`, fontSize: 10, color: "#4CAF50", fontStyle: "italic" }}>
                                💡 {brand.buySignal}
                              </div>
                            )}

                            {/* Cerca prezzi */}
                            <button onClick={() => { setQuery(brand.name); setTab("search"); }}
                              style={{ marginTop: 8, width: "100%", padding: "6px", background: "none", border: `1px solid ${tierColor}33`, color: tierColor, fontSize: "8px", letterSpacing: "1px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>
                              CERCA PREZZI →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Top opportunità da DB */}
            {indieOpportunities.length > 0 && (
              <div style={{ background: "#09090F", border: "1px solid #ffffff06", borderRadius: 2, padding: "12px 14px" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#888", letterSpacing: "3px", marginBottom: 10 }}>🏆 TOP OPPORTUNITÀ (analisi salvate)</div>
                {indieOpportunities.slice(0, 6).map((opp, i) => (
                  <div key={i} className="row" style={{ padding: "7px 0", borderBottom: i < 5 ? "1px solid #ffffff04" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontSize: 12 }}>{opp.brand_name}</span>
                          {opp.tier && <TierBadge tier={opp.tier} />}
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#2A2A2A" }}>{opp.discovery_urgency} · {new Date(opp.last_scan).toLocaleDateString("it-IT")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "16px", color: TIER_COLORS[opp.tier] || "#888" }}>{opp.discovery_score}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A" }}>discovery</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ SEARCH ══ */}
        {tab === "search" && (
          <div className="fade">
            {!serverOnline && <div style={{ background: "#1A0E0E", border: "1px solid #E5393520", borderRadius: 2, padding: "8px 12px", marginBottom: 10, fontFamily: "'DM Mono',monospace", fontSize: "9px", color: "#E57373" }}>⚠️ Server offline — <code>cd server && npm install && npm start</code></div>}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px", marginBottom: 6 }}>10 PIATTAFORME + SOCIAL + FB LOCAL · DIGITA NOME OROLOGIO O BRAND INDIE</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="es. Simon Brette Trilobe, Czapek Antarctique, Akrivia AK-06..."
                  style={{ flex: "3 1 200px", background: "#09090F", border: "1px solid #C9A84C14", borderRadius: 2, padding: "10px 12px", color: "#D0C8B2", fontSize: "13px" }} />
                <select value={city} onChange={e => setCity(e.target.value)}
                  style={{ flex: "1 1 110px", background: "#09090F", border: "1px solid #2196F318", borderRadius: 2, padding: "10px", color: city ? "#2196F3" : "#222", fontSize: "10px" }}>
                  <option value="">📍 Città</option>
                  {cities.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <button onClick={handleSearch} disabled={loadingSearch || !serverOnline}
                  style={{ flex: "0 0 85px", padding: "10px", background: loadingSearch || !serverOnline ? "#080808" : "#C9A84C", color: loadingSearch || !serverOnline ? "#111" : "#03030C", border: "none", borderRadius: 2, fontSize: "8px", letterSpacing: "2px", fontFamily: "'DM Mono',monospace" }}>
                  {loadingSearch ? <span className="spin">⌚</span> : "ANALIZZA"}
                </button>
              </div>
            </div>

            {error && <div style={{ background: "#1A0E0E", border: "1px solid #E5393520", borderRadius: 2, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#E57373", fontFamily: "'DM Mono',monospace" }}>{error}</div>}

            {(results || loadingSignals) && (
              <div className="fade">
                <div style={{ display: "grid", gridTemplateColumns: signals || loadingSignals ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 8 }}>
                  {/* PREZZI */}
                  {results && (
                    <div>
                      {fbLocal.length > 0 && (
                        <div style={{ background: "linear-gradient(135deg,#0A1525,#050D18)", border: "1px solid #2196F322", borderRadius: 2, padding: "10px 12px", marginBottom: 7 }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#2196F3", letterSpacing: "2px", marginBottom: 7 }}>📍 {fbLocal.length} VICINO A TE{city ? ` (${city})` : ""}</div>
                          {fbLocal.slice(0, 2).map((f, i) => (
                            <div key={i} style={{ marginBottom: 5 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, flex: 1 }}>{f.title?.slice(0, 38)}</span>
                                <span style={{ fontSize: 14, color: "#2196F3" }}>{fmt(f.price)}</span>
                              </div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#2196F344" }}>📍 {f.location} <a href={f.url} target="_blank" rel="noreferrer">→</a></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {arbs.length > 0 && (
                        <div style={{ background: "linear-gradient(135deg,#0D2000,#080F00)", border: "1px solid #4CAF5018", borderRadius: 2, padding: "10px 12px", marginBottom: 7 }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#4CAF50", letterSpacing: "2px", marginBottom: 6 }}>🥇 {arbs.length} ARBITRAGGIO ORO</div>
                          {arbs.slice(0, 2).map((a, i) => (
                            <div key={i} style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 11, flex: 1 }}>{a.title?.slice(0, 38)}</span>
                                <span style={{ fontSize: 13, color: "#4CAF50" }}>{fmt(a.priceEur)}</span>
                              </div>
                              <GoldBar price={a.priceEur} gold={a.goldData?.goldValueEur} />
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#4CAF50" }}>−{Math.abs(a.goldData?.discountPct)}% <a href={a.url} target="_blank" rel="noreferrer">→</a></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {results.lowest && (
                        <div style={{ background: "#09090F", border: "1px solid #C9A84C14", borderRadius: 2, padding: "10px 12px", marginBottom: 7 }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#C9A84C", letterSpacing: "2px", marginBottom: 3 }}>PREZZO PIÙ BASSO — {results.platformsScanned?.length} piattaforme</div>
                          <div style={{ fontSize: 24, fontWeight: 300, color: "#C9A84C" }}>{fmt(results.lowest.priceEur)}</div>
                          <div style={{ fontSize: 10, color: "#2A2A2A", marginTop: 2 }}>{results.lowest.platform} · {results.lowest.title?.slice(0, 40)}</div>
                        </div>
                      )}
                      <div style={{ background: "#09090F", border: "1px solid #ffffff04", borderRadius: 2, overflow: "hidden" }}>
                        {results.results?.slice(0, 5).map((r, i) => (
                          <div key={i} className="row" style={{ display: "grid", gridTemplateColumns: "95px 1fr 72px 14px", padding: "7px 10px", borderBottom: i < results.results.length - 1 ? "1px solid #ffffff03" : "none", alignItems: "center", gap: 5 }}>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: i === 0 ? "#C9A84C" : "#222" }}>{r.platform}</span>
                            <span style={{ fontSize: 10, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title?.slice(0, 26)}</span>
                            <span style={{ textAlign: "right", fontSize: i === 0 ? 13 : 11, color: i === 0 ? "#C9A84C" : "#D0C8B2" }}>{fmt(r.priceEur)}</span>
                            <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, textAlign: "right" }}>→</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEGNALI */}
                  <div>
                    {loadingSignals && !signals && (
                      <div style={{ background: "#09090F", border: "1px solid #ffffff04", borderRadius: 2, padding: "14px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div className="pulse" style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#111", textAlign: "center" }}>⌚ Social in corso...</div>
                      </div>
                    )}
                    {signals && (
                      <div style={{ background: "#09090F", border: "1px solid #ffffff04", borderRadius: 2, padding: "12px" }}>
                        {hs && <HypeGauge score={hs.score} label={hs.label} />}
                        {hs?.breakdown && (
                          <div style={{ marginTop: 10 }}>
                            <Bar label="YouTube" value={hs.breakdown.youtube} color="#FF0000" icon="▶" />
                            <Bar label="Reddit" value={hs.breakdown.reddit} color="#FF4500" icon="📊" />
                            <Bar label="Instagram" value={hs.breakdown.instagram} color="#E1306C" icon="📸" />
                            <Bar label="WatchUSeek" value={hs.breakdown.watchuseek} color="#C9A84C" icon="💬" />
                            <Bar label="Chrono24" value={hs.breakdown.chrono24} color="#4CAF50" icon="📦" />
                            <Bar label="Facebook" value={hs.breakdown.facebook} color="#2196F3" icon="📍" />
                          </div>
                        )}
                        {hs?.signals && (
                          <div style={{ marginTop: 8, fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                            <div>YT: <span style={{ color: "#666" }}>{hs.signals.ytVideosFound} video</span></div>
                            <div>Reddit: <span style={{ color: "#666" }}>{hs.signals.redditPosts} post</span></div>
                            <div>C24: <span style={{ color: "#666" }}>{hs.signals.chrono24Listings}</span></div>
                            <div>FB: <span style={{ color: "#2196F3" }}>{hs.signals.fbLocalListings} loc.</span></div>
                            {hs.signals.ytKnownChannel && <div style={{ gridColumn: "span 2", color: "#FF9800" }}>⭐ {hs.signals.ytTopChannel}</div>}
                          </div>
                        )}
                        {signals.signals?.youtube?.slice(0, 2).map((v, i) => (
                          <div key={i} className="row" style={{ padding: "4px 0", borderTop: "1px solid #ffffff04", marginTop: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 5 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10 }}>{v.title?.slice(0, 40)}</div>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: v.isKnownChannel ? "#FF9800" : "#1A1A1A" }}>{v.channel}{v.isKnownChannel ? " ⭐" : ""}</div>
                              </div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#444", whiteSpace: "nowrap" }}>{v.views?.toLocaleString("it-IT")} <a href={v.url} target="_blank" rel="noreferrer">→</a></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* WATCHLIST */}
                {results && (
                  <div style={{ background: "#09090F", border: "1px solid #ffffff04", borderRadius: 2, padding: "10px", marginBottom: 8 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px", marginBottom: 8 }}>+ MONITORA</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <input value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} placeholder="Soglia €" style={{ flex: "1 1 80px", background: "#03030C", border: "1px solid #C9A84C10", borderRadius: 2, padding: "6px 9px", color: "#D0C8B2", fontSize: 12 }} />
                      <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" style={{ flex: "2 1 140px", background: "#03030C", border: "1px solid #C9A84C10", borderRadius: 2, padding: "6px 9px", color: "#D0C8B2", fontSize: 12 }} />
                      <select value={form.userCity} onChange={e => setForm(f => ({ ...f, userCity: e.target.value }))} style={{ flex: "1 1 90px", background: "#03030C", border: "1px solid #2196F314", borderRadius: 2, padding: "6px 7px", color: form.userCity ? "#2196F3" : "#222", fontSize: 10 }}>
                        <option value="">📍 Città</option>
                        {cities.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                      <label style={{ display: "flex", gap: 3, alignItems: "center", fontSize: 9, color: "#FFD700", cursor: "pointer" }}><input type="checkbox" checked={form.goldArbitrage} onChange={e => setForm(f => ({ ...f, goldArbitrage: e.target.checked }))} />Oro</label>
                      <label style={{ display: "flex", gap: 3, alignItems: "center", fontSize: 9, color: "#FF9800", cursor: "pointer" }}><input type="checkbox" checked={form.trackSignals} onChange={e => setForm(f => ({ ...f, trackSignals: e.target.checked }))} />Social</label>
                      <button onClick={addToWatchlist} style={{ padding: "6px 12px", background: "none", border: "1px solid #C9A84C18", color: "#C9A84C", fontSize: "7px", letterSpacing: "2px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>MONITORA</button>
                    </div>
                  </div>
                )}

                {/* AI */}
                <div style={{ background: "#09090F", border: "1px solid #C9A84C0C", borderRadius: 2, padding: "10px" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#C9A84C", letterSpacing: "3px", marginBottom: 6 }}>⚡ ANALISI AI</div>
                  {loadingAI ? <div className="pulse" style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#0F0F0F" }}>Analisi...</div>
                    : <div style={{ fontSize: 12, lineHeight: 1.8, color: "#555", fontStyle: "italic" }}>{aiInsight}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ FACEBOOK ══ */}
        {tab === "facebook" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px" }}>ANNUNCI FACEBOOK VICINO A TE</div>
              <select value={city} onChange={e => setCity(e.target.value)} style={{ background: "#09090F", border: "1px solid #2196F318", borderRadius: 2, padding: "5px 8px", color: city ? "#2196F3" : "#333", fontSize: 10 }}>
                <option value="">Tutte le città</option>
                {cities.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            {fbListings.length === 0 ? <div style={{ textAlign: "center", padding: "50px 0", color: "#080808" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📍</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px" }}>Cerca un orologio nella tab Ricerca selezionando la città</div></div>
              : fbListings.filter(f => !city || f.location?.toLowerCase().includes(city) || f.is_local).map((f, i) => (
                <div key={i} className="row" style={{ background: "linear-gradient(135deg,#0A1525,#050D18)", border: `1px solid ${f.is_local ? "#2196F322" : "#ffffff06"}`, borderRadius: 2, padding: "10px 12px", marginBottom: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 7, marginBottom: 5 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, marginBottom: 2 }}>{f.title}</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#2196F333" }}>📍 {f.location || "—"}{f.distance_km ? ` · ${f.distance_km}km` : ""} · {f.group_name}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 18, color: "#2196F3" }}>{fmt(f.price)}</div></div>
                  </div>
                  <a href={f.url} target="_blank" rel="noreferrer" style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#2196F3", letterSpacing: "1px" }}>VEDI ANNUNCIO →</a>
                </div>
              ))}
          </div>
        )}

        {/* ══ ARBITRAGGIO ══ */}
        {tab === "arbitrage" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
              <div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px", marginBottom: 2 }}>OROLOGI 18K SOTTO VALORE SPOT ORO</div>{goldPrice && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#FFD700" }}>🥇 €{goldPrice.toFixed(2)}/g</div>}</div>
              <button onClick={() => { setScanning(true); fetch(`${API_BASE}/gold-scan`).catch(() => {}); setTimeout(() => { load("/arbitrage", setArbitrage); setScanning(false); }, 90000); }} disabled={scanning}
                style={{ padding: "4px 10px", background: scanning ? "#050505" : "#0D2000", border: "1px solid #4CAF5012", color: scanning ? "#111" : "#4CAF50", fontSize: "7px", letterSpacing: "1px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: scanning ? "not-allowed" : "pointer" }}>
                {scanning ? <><span className="spin">⌚</span> SCAN</> : "🔍 SCANSIONA"}
              </button>
            </div>
            {arbitrage.length === 0 ? <div style={{ textAlign: "center", padding: "50px 0", color: "#080808" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🥇</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px" }}>Clicca Scansiona</div></div>
              : arbitrage.map((a, i) => (
                <div key={i} className="row" style={{ background: "linear-gradient(135deg,#0D2000,#080F00)", border: "1px solid #4CAF5012", borderRadius: 2, padding: "10px 12px", marginBottom: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 7, marginBottom: 5 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 12, marginBottom: 2 }}>{a.title}</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A" }}>{a.platform}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, color: "#4CAF50" }}>{fmt(a.price)}</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#FFD700" }}>oro {fmt(a.gold_value_eur)}</div></div>
                  </div>
                  <GoldBar price={a.price} gold={a.gold_value_eur} />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                    <span style={{ background: "#4CAF5012", color: "#4CAF50", border: "1px solid #4CAF5018", padding: "1px 6px", borderRadius: 2, fontSize: "7px", fontFamily: "'DM Mono',monospace" }}>−{a.discount_pct}%</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111" }}>{a.gold_weight_grams}g · risparmio {fmt((a.gold_value_eur || 0) - a.price)}</span>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", padding: "3px 8px", background: "#4CAF5010", border: "1px solid #4CAF5018", color: "#4CAF50", fontSize: "7px", fontFamily: "'DM Mono',monospace", borderRadius: 2 }}>VEDI →</a>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ══ VINTAGE ══ */}
        {tab === "vintage" && (
          <div className="fade">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px" }}>VINTAGE SOTTOVALUTATI — HYPE CRESCENTE</div>
              <button onClick={() => { setVintageScanning(true); fetch(`${API_BASE}/vintage-scan${city ? `?city=${city}` : ""}`).catch(() => {}); setTimeout(() => { load("/vintage", setVintage); setVintageScanning(false); }, 120000); }} disabled={vintageScanning}
                style={{ padding: "4px 10px", background: vintageScanning ? "#050505" : "#0D0D20", border: "1px solid #C9A84C12", color: vintageScanning ? "#111" : "#C9A84C", fontSize: "7px", letterSpacing: "1px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: vintageScanning ? "not-allowed" : "pointer" }}>
                {vintageScanning ? <><span className="spin">⌚</span> ANALISI</> : "🕰️ SCANSIONA"}
              </button>
            </div>
            {vintage.length === 0 ? <div style={{ textAlign: "center", padding: "50px 0", color: "#080808" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🕰️</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px" }}>Clicca Scansiona Vintage</div></div>
              : vintage.map((v, i) => (
                <div key={i} className="row" style={{ background: "#09090F", border: `1px solid ${v.hype_score >= 60 ? "#FF980018" : "#ffffff05"}`, borderRadius: 2, padding: "10px 12px", marginBottom: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 7, marginBottom: 7 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, marginBottom: 2 }}>{v.model}</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111" }}>{new Date(v.scanned_at).toLocaleString("it-IT")}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: 18, color: v.hype_score >= 60 ? "#FF9800" : "#444", fontFamily: "'DM Mono',monospace" }}>{v.hype_score}/100</div></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 7 }}>
                    {[["YT", v.yt_videos], ["Reddit", v.reddit_posts], ["FB", v.fb_listings], ["C24", v.chrono24_listings]].map(([l, val]) => (
                      <div key={l} style={{ background: "#050510", padding: "5px 6px", borderRadius: 2 }}><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", marginBottom: 1 }}>{l}</div><div style={{ fontSize: 12, color: "#555" }}>{val || 0}</div></div>
                    ))}
                  </div>
                  <button onClick={() => { setQuery(v.model); setTab("search"); }} style={{ padding: "3px 8px", background: "none", border: "1px solid #C9A84C14", color: "#C9A84C", fontSize: "7px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>ANALIZZA →</button>
                </div>
              ))}
          </div>
        )}

        {/* ══ TOP HYPE ══ */}
        {tab === "hype" && (
          <div className="fade">
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px", marginBottom: 12 }}>HYPE CRESCENTE — ULTIMI 7 GIORNI</div>
            {topHype.length === 0 ? <div style={{ textAlign: "center", padding: "50px 0", color: "#080808" }}><div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px" }}>Analizza orologi per popolare</div></div>
              : topHype.map((item, i) => (
                <div key={i} className="row" style={{ background: "#09090F", border: `1px solid ${item.max_score >= 70 ? "#FF450018" : "#ffffff05"}`, borderRadius: 2, padding: "9px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "#111", width: 16 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, marginBottom: 1 }}>{item.watch_model}</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111" }}>{new Date(item.last_scan).toLocaleString("it-IT")}</div></div>
                  <div style={{ fontSize: 20, color: item.max_score >= 70 ? "#FF4500" : item.max_score >= 50 ? "#FF9800" : "#333", fontFamily: "'DM Mono',monospace" }}>{item.max_score}</div>
                  <button onClick={() => { setQuery(item.watch_model); setTab("search"); }} style={{ padding: "3px 8px", background: "none", border: "1px solid #C9A84C14", color: "#C9A84C", fontSize: "7px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>→</button>
                </div>
              ))}
          </div>
        )}

        {/* ══ MERCATO ══ */}
        {tab === "trends" && (
          <div className="fade">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div style={{ background: "#09090F", border: "1px solid #4CAF5010", borderRadius: 2, padding: "10px" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#4CAF50", letterSpacing: "2px", marginBottom: 8 }}>🚀 TOP RIVALUTAZIONE</div>
                {(trends?.topAppreciation || []).map((m, i) => (
                  <div key={i} className="row" style={{ padding: "5px 0", borderBottom: "1px solid #ffffff03" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ fontSize: 10, flex: 1 }}>{m.model}</span><span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#4CAF50" }}>+{m.trend}%</span></div>
                    <div style={{ height: 2, background: "#0A0A0A", borderRadius: 1 }}><div style={{ height: "100%", width: `${(m.trend / 45) * 100}%`, background: "#4CAF50" }} /></div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "6px", color: "#111", marginTop: 1 }}>{m.note}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#09090F", border: "1px solid #E5393510", borderRadius: 2, padding: "10px" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#E53935", letterSpacing: "2px", marginBottom: 8 }}>📉 TOP SVALUTAZIONE</div>
                {(trends?.topDepreciation || []).map((m, i) => (
                  <div key={i} className="row" style={{ padding: "5px 0", borderBottom: "1px solid #ffffff03" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ fontSize: 10, flex: 1 }}>{m.model}</span><span style={{ fontFamily: "'DM Mono',monospace", fontSize: "10px", color: "#E53935" }}>{m.trend}%</span></div>
                    <div style={{ height: 2, background: "#0A0A0A", borderRadius: 1 }}><div style={{ height: "100%", width: `${(Math.abs(m.trend) / 20) * 100}%`, background: "#E53935" }} /></div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "6px", color: "#111", marginTop: 1 }}>{m.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#09090F", border: "1px solid #FFD70010", borderRadius: 2, padding: "10px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#FFD700", letterSpacing: "2px", marginBottom: 6 }}>📊 STORICO ORO</div>
              {goldHistory.length > 1 ? (() => {
                const prices = goldHistory.map(h => h.price_eur_per_gram).filter(Boolean).reverse();
                const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
                const w = 100, h = 36;
                const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * (h - 5) - 2}`).join(" ");
                return <div><svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 44 }}><polyline points={pts} fill="none" stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round" /></svg><div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#1A1A1A", marginTop: 3 }}><span>€{min.toFixed(2)}</span><span style={{ color: "#FFD700" }}>€{prices.at(-1)?.toFixed(2)}/g</span><span>€{max.toFixed(2)}</span></div></div>;
              })() : <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#080808" }}>Disponibile dopo la prima scansione</div>}
            </div>
          </div>
        )}

        {/* ══ WATCHLIST ══ */}
        {tab === "watchlist" && (
          <div className="fade">
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px", marginBottom: 12 }}>PREZZI 30min · SOCIAL 4h · INDIE RSS 1h · VINTAGE 24h</div>
            {watchlist.length === 0 ? <div style={{ textAlign: "center", padding: "50px 0", color: "#080808" }}><div style={{ fontSize: 30, marginBottom: 8 }}>⌚</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px" }}>Nessun orologio monitorato</div></div>
              : watchlist.map(item => (
                <div key={item.id} style={{ background: "#09090F", border: "1px solid #ffffff04", borderRadius: 2, marginBottom: 6, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, marginBottom: 2 }}>{item.query}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111" }}>
                      {new Date(item.created_at).toLocaleString("it-IT")}
                      {item.threshold && <> · soglia <span style={{ color: "#C9A84C" }}>{fmt(item.threshold)}</span></>}
                      {item.gold_arbitrage ? <span style={{ color: "#FFD700" }}> · 🥇</span> : ""}
                      {item.track_signals ? <span style={{ color: "#FF9800" }}> · 📡</span> : ""}
                      {item.user_city && <span style={{ color: "#2196F3" }}> · 📍{item.user_city}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => { setQuery(item.query); if (item.user_city) setCity(item.user_city); setTab("search"); }} style={{ padding: "3px 7px", background: "none", border: "1px solid #C9A84C12", color: "#C9A84C", fontSize: "7px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>→</button>
                    <button onClick={() => { fetch(`${API_BASE}/watchlist/${item.id}`, { method: "DELETE" }).then(() => load("/watchlist", setWatchlist)); }} style={{ padding: "3px 7px", background: "none", border: "1px solid #E5393512", color: "#E57373", fontSize: "7px", fontFamily: "'DM Mono',monospace", borderRadius: 2, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ══ ALERTS ══ */}
        {tab === "alerts" && (
          <div className="fade">
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111", letterSpacing: "2px", marginBottom: 12 }}>PREZZI · ORO · HYPE · FB LOCALE · INDIE DISCOVERY</div>

            {/* Discovery alerts */}
            {indieAlerts.slice(0, 5).map(a => (
              <div key={a.id} className="row" style={{ background: "linear-gradient(135deg,#0A1830,#050D20)", border: "1px solid #00BCD418", borderRadius: 2, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px", color: "#00BCD4", marginBottom: 2 }}>🔭 {a.brand_name}</div>
                  <div style={{ fontSize: 11 }}>{a.message}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111" }}>{new Date(a.sent_at).toLocaleString("it-IT")}</div>
              </div>
            ))}

            {/* Prezzo alerts */}
            {alerts.map(a => (
              <div key={a.id} className="row" style={{ background: "#09090F", border: `1px solid ${a.discount_pct ? "#4CAF5012" : "#C9A84C0C"}`, borderRadius: 2, padding: "9px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 11, marginBottom: 1 }}>{a.query}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#111" }}>{a.platform} · <span style={{ color: a.discount_pct ? "#4CAF50" : "#C9A84C" }}>{fmt(a.price)}</span></div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "7px", color: "#080808" }}>{new Date(a.sent_at).toLocaleString("it-IT")}</div>
              </div>
            ))}

            {alerts.length === 0 && indieAlerts.length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 0", color: "#080808" }}><div style={{ fontSize: 30, marginBottom: 8 }}>🔔</div><div style={{ fontFamily: "'DM Mono',monospace", fontSize: "8px" }}>Nessun alert ancora</div></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
