/**
 * Telegram Bot Module v7
 * Notifiche push istantanee su telefono
 * 
 * Setup:
 * 1. Apri Telegram, cerca @BotFather
 * 2. Scrivi /newbot → dai un nome → ottieni token
 * 3. Cerca @userinfobot → ti dà il tuo chat_id
 * 4. Metti TELEGRAM_TOKEN e TELEGRAM_CHAT_ID in .env
 */

const axios = require('axios');
require('dotenv').config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

// ── INVIA MESSAGGIO ───────────────────────────────────────────
async function sendTelegramMessage(chatId, text, options = {}) {
  if (!process.env.TELEGRAM_TOKEN) return null;
  try {
    const r = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId || process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...options,
    }, { timeout: 10000 });
    return r.data;
  } catch (e) {
    console.error('[Telegram]', e.response?.data?.description || e.message);
    return null;
  }
}

// ── TEMPLATE MESSAGGI ─────────────────────────────────────────

function msgPriceAlert({ query, platform, price, priceEur, url, goldData }) {
  const isArb = goldData?.isArbitrage;
  const goldLine = goldData ? `\n💛 Valore oro: <b>€${goldData.goldValueEur?.toLocaleString('it-IT')}</b> (${goldData.goldGrams}g oro puro)` : '';
  const arbLine = isArb ? `\n🥇 <b>ARBITRAGGIO: −${Math.abs(goldData.discountPct)}% sotto valore oro!</b>` : '';
  const trendLine = goldData?.trendLabel ? `\n📈 ${goldData.trendLabel}` : '';
  return `🔔 <b>PRICE ALERT</b>

⌚ <b>${query}</b>
💰 <b>€${priceEur?.toLocaleString('it-IT')}</b> su ${platform}${goldLine}${arbLine}${trendLine}

<a href="${url}">👉 VEDI ANNUNCIO</a>`;
}

function msgGoldArbitrage({ title, platform, priceEur, goldValueEur, goldGrams, discountPct, trendLabel, url }) {
  return `🥇 <b>ARBITRAGGIO ORO</b>

⌚ ${title?.slice(0, 60)}
🏷️ Prezzo: <b>€${priceEur?.toLocaleString('it-IT')}</b> su ${platform}
💛 Valore oro spot: <b>€${goldValueEur?.toLocaleString('it-IT')}</b> (${goldGrams}g)
📉 Sconto: <b>−${Math.abs(discountPct)}% sotto valore oro</b>
📈 ${trendLabel || '—'}
💰 Risparmio: €${((goldValueEur || 0) - priceEur).toLocaleString('it-IT')}

<a href="${url}">👉 ACQUISTA ORA</a>`;
}

function msgHypeAlert({ watchModel, score, label, ytVideos, redditPosts, ytKnownChannel, ytTopChannel, fbLocal }) {
  const ytLine = ytKnownChannel ? `\n⭐ Canale noto: <b>${ytTopChannel}</b>` : '';
  const fbLine = fbLocal > 0 ? `\n📍 ${fbLocal} annunci Facebook vicino a te` : '';
  return `🔥 <b>FOMO ALERT</b>

⌚ <b>${watchModel}</b>
📊 Hype Score: <b>${score}/100</b> — ${label}

▶️ Video YouTube (60gg): ${ytVideos}${ytLine}
📝 Post Reddit: ${redditPosts}${fbLine}

Apri l'app per i dettagli 👆`;
}

function msgDiscoveryAlert({ brandName, tier, alertType, message, discoveryScore, urgency, thesis, buySignal, articleUrl }) {
  const tierEmoji = { 1: '⚪', 2: '🟡', 3: '🟢', 4: '🔵' }[tier] || '⚪';
  return `🔭 <b>DISCOVERY ALERT</b>

${tierEmoji} <b>${brandName}</b> — Tier ${tier}
⚡ <b>${alertType}</b>

📰 ${message?.slice(0, 120)}

🎯 Discovery Score: <b>${discoveryScore}/100</b>
⏳ ${urgency}
💡 ${thesis || ''}
${buySignal ? `\n🟢 <i>${buySignal}</i>` : ''}
${articleUrl ? `\n<a href="${articleUrl}">👉 LEGGI ARTICOLO</a>` : ''}`;
}

function msgFacebookLocal({ title, price, location, distanceKm, url, groupName }) {
  const distLine = distanceKm ? ` (${distanceKm}km da te)` : '';
  return `📍 <b>ANNUNCIO VICINO A TE</b>

⌚ ${title?.slice(0, 60)}
💰 <b>€${price?.toLocaleString('it-IT')}</b>
📍 ${location}${distLine}
${groupName ? `👥 ${groupName}` : ''}

<a href="${url}">👉 VEDI SU FACEBOOK</a>`;
}

function msgPortfolioUpdate({ totalValue, totalCost, totalROI, roiPct, topGainer, topLoser }) {
  const emoji = roiPct >= 0 ? '📈' : '📉';
  return `💼 <b>PORTFOLIO UPDATE</b>

${emoji} ROI totale: <b>${roiPct >= 0 ? '+' : ''}${roiPct?.toFixed(1)}%</b>
💰 Valore attuale: <b>€${totalValue?.toLocaleString('it-IT')}</b>
📥 Costo acquisto: €${totalCost?.toLocaleString('it-IT')}
${roiPct >= 0 ? '🟢' : '🔴'} Guadagno/Perdita: €${(totalValue - totalCost)?.toLocaleString('it-IT')}

🏆 Best: ${topGainer?.name} (+${topGainer?.roiPct?.toFixed(1)}%)
📉 Worst: ${topLoser?.name} (${topLoser?.roiPct?.toFixed(1)}%)`;
}

function msgWatchChartsUpdate({ model, currentPrice, priceChange1m, priceChange3m, priceChange1y, marketTrend }) {
  const arrow1m = priceChange1m >= 0 ? '↑' : '↓';
  const arrow3m = priceChange3m >= 0 ? '↑' : '↓';
  const arrow1y = priceChange1y >= 0 ? '↑' : '↓';
  return `📊 <b>WATCHCHARTS UPDATE</b>

⌚ <b>${model}</b>
💰 Prezzo mercato: <b>€${currentPrice?.toLocaleString('it-IT')}</b>

${arrow1m} 1 mese: ${priceChange1m >= 0 ? '+' : ''}${priceChange1m?.toFixed(1)}%
${arrow3m} 3 mesi: ${priceChange3m >= 0 ? '+' : ''}${priceChange3m?.toFixed(1)}%
${arrow1y} 1 anno: ${priceChange1y >= 0 ? '+' : ''}${priceChange1y?.toFixed(1)}%
📈 Trend: ${marketTrend}`;
}

// ── BROADCAST A TUTTI GLI UTENTI ─────────────────────────────
async function broadcast(db, message) {
  if (!process.env.TELEGRAM_TOKEN) return;
  const users = db.prepare('SELECT DISTINCT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL AND active=1').all();
  for (const user of users) {
    await sendTelegramMessage(user.telegram_chat_id, message);
    await new Promise(r => setTimeout(r, 50)); // rate limit
  }
}

// ── SETUP WEBHOOK (opzionale, per comandi interattivi) ────────
async function setupWebhook(webhookUrl) {
  if (!process.env.TELEGRAM_TOKEN || !webhookUrl) return;
  try {
    await axios.post(`${TELEGRAM_API}/setWebhook`, { url: `${webhookUrl}/telegram/webhook` });
    console.log('[Telegram] Webhook configurato:', webhookUrl);
  } catch (e) {
    console.error('[Telegram] Webhook error:', e.message);
  }
}

// ── BOT COMANDI (risponde ai messaggi degli utenti) ───────────
function handleTelegramCommand(body, db, searchAllPlatforms) {
  const message = body.message || body.edited_message;
  if (!message) return null;
  const chatId = message.chat.id;
  const text = message.text || '';
  const cmd = text.split(' ')[0].toLowerCase();
  const args = text.slice(cmd.length).trim();

  switch (cmd) {
    case '/start':
      return sendTelegramMessage(chatId, `⌚ <b>PriceRadar v7</b> attivo!

Comandi disponibili:
/cerca [orologio] — cerca prezzi
/portfolio — vedi il tuo portfolio
/arbitrage — ultimi arbitraggi oro
/indie — brand indipendenti hot
/alerts — ultimi alert
/status — stato del server`);

    case '/cerca':
      if (!args) return sendTelegramMessage(chatId, 'Uso: /cerca Rolex Submariner');
      return searchAllPlatforms(args).then(data => {
        const msg = data.lowest
          ? `⌚ <b>${args}</b>\n💰 Miglior prezzo: <b>€${data.lowest.priceEur?.toLocaleString('it-IT')}</b> su ${data.lowest.platform}\n<a href="${data.lowest.url}">👉 VEDI</a>`
          : `Nessun risultato per "${args}"`;
        return sendTelegramMessage(chatId, msg);
      });

    case '/status':
      const status = db.prepare('SELECT COUNT(*) as n FROM watchlist WHERE active=1').get();
      const arbs = db.prepare('SELECT COUNT(*) as n FROM arbitrage_opportunities WHERE active=1').get();
      return sendTelegramMessage(chatId, `✅ <b>PriceRadar v7 — ONLINE</b>\n📋 Watchlist: ${status.n}\n🥇 Arbitraggi attivi: ${arbs.n}`);

    case '/arbitrage':
      const topArbs = db.prepare('SELECT * FROM arbitrage_opportunities WHERE active=1 ORDER BY discount_pct DESC LIMIT 3').all();
      if (!topArbs.length) return sendTelegramMessage(chatId, 'Nessun arbitraggio attivo');
      return sendTelegramMessage(chatId, topArbs.map(a =>
        `🥇 <b>${a.title?.slice(0, 40)}</b>\n€${a.price?.toLocaleString('it-IT')} vs oro €${a.gold_value_eur?.toLocaleString('it-IT')} (−${a.discount_pct}%)\n<a href="${a.url}">→</a>`
      ).join('\n\n'));

    case '/indie':
      const topIndie = db.prepare('SELECT * FROM independent_analyses GROUP BY brand_key ORDER BY discovery_score DESC LIMIT 3').all();
      if (!topIndie.length) return sendTelegramMessage(chatId, 'Nessuna analisi indie disponibile. Avvia /indie/scan');
      return sendTelegramMessage(chatId, topIndie.map(b =>
        `🔭 <b>${b.brand_name}</b>\n🎯 Discovery: ${b.discovery_score}/100\n⏳ ${b.discovery_urgency}`
      ).join('\n\n'));

    default:
      return null;
  }
}

module.exports = {
  sendTelegramMessage,
  msgPriceAlert,
  msgGoldArbitrage,
  msgHypeAlert,
  msgDiscoveryAlert,
  msgFacebookLocal,
  msgPortfolioUpdate,
  msgWatchChartsUpdate,
  broadcast,
  setupWebhook,
  handleTelegramCommand,
};
