const $ = id => document.getElementById(id);
const labels = ["Tất cả","Chính trị","Thể thao","Crypto","Kinh tế","Công nghệ","Văn hóa","Thời tiết","Khác"];
const rules = [
  ["Thể thao", /sport|esport|nfl|nba|nhl|mlb|ncaa|uefa|soccer|basketball|football|tennis|cricket|ufc|spread:|moneyline|over\/under|\bvs\.?\s|league|valorant|counter.strike|dota/],
  ["Thời tiết", /weather|temperature|precipitation|snowfall|hurricane|celsius|highest temperature/],
  ["Crypto", /crypto|bitcoin|ethereum|solana|dogecoin|zcash|hyperliquid|\b(btc|eth|xrp|bnb)\b/],
  ["Kinh tế", /econom|financ|interest rate|inflation|gdp|stock|nasdaq|s&p|federal reserve|bank of|crude oil|\b(gold|silver|cpi|silver futures)\b/],
  ["Chính trị", /politic|election|senate|congress|president|geopolit|ceasefire|parliament|\btrump\b|prime minister/],
  ["Công nghệ", /tech|artificial intelligence|\bai\b|claude|openai|chatgpt|spacex|rocket launch|anthropic|gemini/],
  ["Văn hóa", /culture|entertainment|film|movie|music|rotten tomatoes|box office|billboard|netflix|spotify|celebrity|oscars/],
];
const categories = (tags, text) => {
  for (const source of [tags, text]) {
    const rule = rules.find(([, pattern]) => pattern.test(source.toLowerCase()));
    if (rule) return rule[0];
  }
  return "Khác";
};
const updown = text => /\b(up\s*(?:or|and|\/|[-–])\s*down|updown|higher\s+or\s+lower)\b/i.test(text);
const fmt = new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 2});
const date = new Intl.DateTimeFormat("vi-VN", {timeZone:"Asia/Ho_Chi_Minh", day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
let category = "Tất cả", rows = [], visible = 36, loading = false, loaded = false;
const norm = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function element(tag, name, value) {
  const el = document.createElement(tag);
  if (name) el.className = name;
  if (value !== undefined) el.textContent = value;
  return el;
}
for (const name of labels) {
  const button = element("button", "", name);
  button.addEventListener("click", () => { category = name; reset(); });
  $("categories").append(button);
}
function marketLink(row, text) {
  const link = element("a", "", text);
  link.href = row.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
function media(row, className, lazy) {
  if (!row.image?.startsWith("https://")) return null;
  const frame = element("div", className);
  const image = element("img", "market-image");
  image.alt = "";
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.addEventListener("error", () => { image.hidden = true; });
  image.src = row.image;
  frame.append(image);
  return frame;
}
const rowKey = row => JSON.stringify([row.url, row.outcome]);
const priceText = row => fmt.format(row.ask) + "¢";
const spreadValue = row => row.bid == null ? null : Math.round((row.ask - row.bid) * 1e6) / 1e6;
// Ask - midpoint equals half the spread when both book sides exist.
const askMidGap = row => row.bid == null ? Infinity : Math.abs(spreadValue(row)) / 2;
const metricText = (value, unit) => value == null ? "—" : fmt.format(value) + unit;
function quoteMetrics(row) {
  return [
    ["Bid", metricText(row.bid, "¢")],
    ["Spread", metricText(spreadValue(row), "¢")],
    ["Midpoint", metricText(row.bid == null ? null : (row.bid + row.ask) / 2, "%")],
  ];
}
function quoteDetails(row) {
  const details = element("div", "quote-details");
  for (const [name, value] of quoteMetrics(row)) {
    const metric = element("span", "quote-metric");
    metric.append(element("span", "", name), element("strong", "", value));
    details.append(metric);
  }
  return details;
}
const sharesText = row => fmt.format(row.size) + " shares";
function quote(row) {
  const box = element("div", "quote");
  const price = element("strong", "ask-value", priceText(row));
  price.setAttribute("aria-label", "Best ask " + fmt.format(row.ask) + " cent");
  box.append(element("span", "", row.outcome), price);
  const wrapper = element("div", "quote-block");
  wrapper.append(box, quoteDetails(row));
  return wrapper;
}
const recentGameWindow = 6 * 3600000;
const liveStatusLifetime = 5 * 60000;
const resolvedTokens = new Set();
function endLabel(row) {
  const prefix = row.inPlay ? "Đang diễn ra · "
    : row.endIsGameStart ? "Bắt đầu trận · " : "";
  const time = element("time", "", prefix + date.format(row.end));
  time.dateTime = new Date(row.end).toISOString();
  return time;
}
function card(row) {
  const item = element("article", "card");
  const body = element("div", "card-body");
  const meta = element("div", "meta");
  meta.append(element("span", "category", row.category), endLabel(row));
  const heading = element("h3");
  heading.append(marketLink(row, row.title));
  const foot = element("div", "card-foot");
  foot.append(element("span", "share-value", sharesText(row)), marketLink(row, "Mở market"));
  const title = element("div", "card-title");
  const image = media(row, "card-media", true);
  if (image) title.append(image);
  title.append(heading);
  body.append(meta, title, quote(row), foot);
  item.append(body);
  return item;
}
const cardCache = new Map();
let rankedKeys = [];
function structure(row) {
  return JSON.stringify([row.title, row.category, row.end, row.endIsGameStart ?? false, row.inPlay ?? false, row.confirmedLive ?? false]);
}
function updateQuote(container, row, suffix = "") {
  const price = container.querySelector(".ask-value");
  const shares = container.querySelector(".share-value");
  if (price.textContent !== priceText(row)) {
    price.textContent = priceText(row);
    price.setAttribute("aria-label", "Best ask " + fmt.format(row.ask) + " cent");
  }
  const details = container.querySelector(".quote-details");
  for (const [index, [, value]] of quoteMetrics(row).entries()) {
    const label = details.children[index].lastElementChild;
    if (label.textContent !== value) label.textContent = value;
  }
  const size = sharesText(row) + suffix;
  if (shares.textContent !== size) shares.textContent = size;
}
function render(reorder = false) {
  const query = norm($("query").value.trim());
  const terms = query.split(/[^\p{L}\p{N}]+/u).filter(term => term && term !== "vs");
  const now = Date.now();
  const horizon = now + Number($("hours").value) * 3600000;
  const min = $("ask").valueAsNumber || 0;
  const maxSpread = $("max-spread").valueAsNumber;
  const matches = rows.filter(row => !resolvedTokens.has(row.token) && row.ask != null && row.ask >= min
    && (!Number.isFinite(maxSpread) || (row.bid != null && spreadValue(row) <= maxSpread)) && (row.inPlay ? row.liveCheckedAt > now - liveStatusLifetime && row.end > now - recentGameWindow : row.end > now && row.end <= horizon)
    && (!$("hide").checked || !row.updown) && (category === "Tất cả" || category === row.category)
    && terms.every(term => norm(row.title + " " + row.outcome + " " + (row.eventTitle || "")).includes(term)));
  const order = $("sort").value;
  const rank = new Map(rankedKeys.map((key, index) => [key, index]));
  const compare = (a,b) => (order === "ask" ? a.ask-b.ask : order === "size" ? b.size-a.size : a.end-b.end)
    || a.end-b.end || a.ask-b.ask;
  const relativeRank = (a,b) => (rank.get(rowKey(a)) ?? Infinity) - (rank.get(rowKey(b)) ?? Infinity);
  matches.sort((a,b) => {
    if (order === "closest") return askMidGap(a) - askMidGap(b) || relativeRank(a,b) || compare(a,b);
    return (reorder ? 0 : relativeRank(a,b)) || compare(a,b);
  });
  rankedKeys = matches.map(rowKey);
  $("count").textContent = fmt.format(matches.length);
  for (const button of $("categories").children) button.setAttribute("aria-pressed", button.textContent === category);
  const grid = $("grid");
  const nextCards = new Set();
  for (const [index, row] of matches.slice(0, visible).entries()) {
    const key = rowKey(row);
    nextCards.add(key);
    let entry = cardCache.get(key);
    const shape = structure(row);
    if (!entry || entry.shape !== shape) {
      const node = card(row);
      if (entry) entry.node.replaceWith(node);
      entry = {node, shape};
      cardCache.set(key, entry);
    } else {
      updateQuote(entry.node, row);
    }
    if (grid.children[index] !== entry.node) grid.insertBefore(entry.node, grid.children[index] || null);
  }
  for (const [key, {node}] of cardCache) {
    if (!nextCards.has(key)) {
      node.remove();
      cardCache.delete(key);
    }
  }
  const empty = grid.querySelector(".empty");
  if (!matches.length) {
    const message = loading || !loaded ? "Đang tìm market phù hợp…" :
      Number.isFinite(maxSpread) && !rows.some(row => row.bid != null)
        ? "Cần dữ liệu sổ lệnh mới để lọc spread."
        : "Không có kết quả cho bộ lọc này.";
    if (empty) empty.textContent = message;
    else grid.append(element("p", "empty", message));
  } else {
    empty?.remove();
  }
  $("more").hidden = visible >= matches.length;
  stream.watch(matches.slice(0, Math.min(visible, 72)));
}
function reset() { visible = 36; render(true); }
for (const id of ["query","ask","max-spread","sort"]) $(id).addEventListener("input", reset);
for (const id of ["hours","hide"]) $(id).addEventListener("input", () => {
  reset();
  if (loading) scanController.abort();
  else scheduleRefresh(200);
});
$("more").addEventListener("click", () => { visible += 36; render(); });
function unpack(value) { return typeof value === "string" ? JSON.parse(value) : value || []; }
async function get(url, {signal, ...options} = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeout = AbortSignal.timeout(12000);
    try {
      const response = await fetch(url, {...options, signal:signal ? AbortSignal.any([signal, timeout]) : timeout});
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) throw Object.assign(Error("HTTP " + response.status), {permanent:true});
      throw Error("HTTP " + response.status);
    } catch (error) {
      if (signal?.aborted || error.permanent || attempt === 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
}
function levels(entries = []) {
  const prices = new Map();
  for (const {price, size} of entries) {
    const cents = Number(price) * 100;
    const shares = Number(size);
    if (Number.isFinite(cents) && shares > 0) prices.set(cents, (prices.get(cents) || 0) + shares);
  }
  return prices;
}
function topOfBook(bids, asks) {
  let ask = null, bid = null;
  for (const price of asks.keys()) if (ask === null || price < ask) ask = price;
  for (const price of bids.keys()) if (bid === null || price > bid) bid = price;
  return {ask, bid, size: asks.get(ask) || 0};
}
const stream = (() => {
  const books = new Map();
  let wanted = new Map(), subscribed = new Set();
  let socket, heartbeat, retry, paint, lastMessage;
  function stop() {
    clearTimeout(retry);
    clearInterval(heartbeat);
    const connection = socket;
    socket = undefined;
    subscribed.clear();
    books.clear();
    connection?.close();
  }
  function apply(token, book) {
    const row = wanted.get(token);
    if (!row || book.timestamp < (row.quoteTime || 0)) return;
    const next = topOfBook(book.bids, book.asks);
    const changed = row.ask !== next.ask || row.bid !== next.bid || row.size !== next.size;
    Object.assign(row, next, {quoteTime:book.timestamp});
    if (changed && !paint) paint = requestAnimationFrame(() => { paint = undefined; render(); });
  }
  function connect() {
    if (socket || !wanted.size || document.hidden || typeof WebSocket === "undefined") return;
    const connection = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/market");
    socket = connection;
    connection.onopen = () => {
      if (socket !== connection) return;
      subscribed = new Set(wanted.keys());
      connection.send(JSON.stringify({type:"market", assets_ids:[...subscribed], custom_feature_enabled:true}));
      lastMessage = Date.now();
      heartbeat = setInterval(() => {
        if (Date.now() - lastMessage > 30000) connection.close();
        else if (connection.readyState === WebSocket.OPEN) connection.send("PING");
      }, 10000);
    };
    connection.onmessage = ({data}) => {
      if (socket !== connection) return;
      lastMessage = Date.now();
      if (data === "PONG") return;
      let payload;
      try { payload = JSON.parse(data); } catch { return; }
      for (const message of Array.isArray(payload) ? payload : [payload]) {
        const timestamp = Number(message.timestamp) || Date.now();
        if (message.event_type === "market_resolved") {
          for (const token of message.assets_ids || []) resolvedTokens.add(String(token));
          if (!paint) paint = requestAnimationFrame(() => { paint = undefined; render(); });
        } else if (message.event_type === "book" && wanted.has(message.asset_id)) {
          const token = message.asset_id;
          if (timestamp < (books.get(token)?.timestamp || 0)) continue;
          const book = {bids:levels(message.bids), asks:levels(message.asks), timestamp};
          books.set(token, book);
          apply(token, book);
        } else if (message.event_type === "price_change") {
          const changed = new Set();
          for (const delta of message.price_changes || []) {
            const token = delta.asset_id;
            const book = books.get(token);
            if (!wanted.has(token) || !book || timestamp < book.timestamp) continue;
            const side = delta.side === "BUY" ? book.bids : book.asks;
            const price = Number(delta.price) * 100, size = Number(delta.size);
            if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
            if (size > 0) side.set(price, size);
            else side.delete(price);
            book.timestamp = timestamp;
            changed.add(token);
          }
          for (const token of changed) apply(token, books.get(token));
        }
      }
    };
    connection.onerror = () => connection.close();
    connection.onclose = () => {
      if (socket !== connection) return;
      stop();
      retry = setTimeout(() => { retry = undefined; connect(); }, 5000);
    };
  }
  function watch(watchRows) {
    wanted = new Map(watchRows.map(row => [row.token, row]));
    if (document.hidden || !wanted.size) { stop(); retry = undefined; return; }
    if (!socket) { if (!retry) connect(); return; }
    if (socket.readyState !== WebSocket.OPEN) return;
    const added = [...wanted.keys()].filter(token => !subscribed.has(token));
    const removed = [...subscribed].filter(token => !wanted.has(token));
    if (added.length) socket.send(JSON.stringify({operation:"subscribe", assets_ids:added}));
    if (removed.length) socket.send(JSON.stringify({operation:"unsubscribe", assets_ids:removed}));
    for (const token of removed) books.delete(token);
    subscribed = new Set(wanted.keys());
  }
  return {watch};
})();
const refreshDelay = 180000;
let refreshTimer, scanController, manualQueued = false;
const statusTime = new Intl.DateTimeFormat("vi-VN", {timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit"});
function scheduleRefresh(delay = refreshDelay) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (document.hidden) scheduleRefresh();
    else refresh();
  }, delay);
}
async function refresh(manual = false) {
  if (loading) {
    if (manual) {
      manualQueued = true;
      $("status").textContent = "Đang khởi động lại…";
      scanController.abort();
    }
    return;
  }
  loading = true;
  clearTimeout(refreshTimer);
  const controller = new AbortController();
  scanController = controller;
  const {signal} = controller;
  $("status").textContent = "Đang làm mới…";
  $("refresh").setAttribute("aria-busy", "true");
  const started = Date.now();
  const horizon = started + Number($("hours").value) * 3600000;
  const hideUpDown = $("hide").checked;
  const params = new URLSearchParams({closed:"false",limit:"100",include_tag:"true",
    end_date_min:new Date(started).toISOString(),end_date_max:new Date(horizon).toISOString()});
  const fresh = [];
  const pending = new Map();
  const seen = new Set();
  const failed = new Set();
  let pages = 0, sportsUnavailable = false;
  async function quote(entries) {
    const tokens = new Map(entries);
    const books = await get("https://clob.polymarket.com/books", {method:"POST", signal,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify([...tokens.keys()].map(token_id => ({token_id})))});
    for (const book of books) {
      const row = tokens.get(book.asset_id);
      if (!row) continue;
      const quote = topOfBook(levels(book.bids), levels(book.asks));
      fresh.push({...row,...quote,quoteTime:Number(book.timestamp) || started});
    }
  }
  function publish(partial) {
    const current = new Map(rows.map(row => [rowKey(row), row]));
    const merged = fresh.map(row => {
      const previous = current.get(rowKey(row));
      current.delete(rowKey(row));
      return previous?.quoteTime > row.quoteTime
        ? {...row,ask:previous.ask,bid:previous.bid,size:previous.size,quoteTime:previous.quoteTime}
        : row;
    });
    rows = [...merged, ...[...current.values()].filter(row => partial || failed.has(row.token))];
    loaded = true;
    if (partial) render();
  }
  async function flush() {
    const entries = [...pending];
    pending.clear();
    for (let start = 0; start < entries.length; start += 600) {
      const group = entries.slice(start, start + 600);
      const batches = Array.from({length:Math.ceil(group.length / 100)}, (_, i) => group.slice(i * 100, (i + 1) * 100));
      const results = await Promise.allSettled(batches.map(quote));
      signal.throwIfAborted();
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          for (const [token] of batches[index]) failed.add(token);
        }
      }
    }
  }
  function addMarket(m, event, inPlay = false) {
    const end = Date.parse(m.endDate);
    if (!m.active || m.closed || !m.acceptingOrders || !Number.isFinite(end)) return;
    const gameTime = m.gameStartTime?.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00") || event?.startTime;
    const endIsGameStart = Boolean(gameTime && Date.parse(gameTime) === end);
    if (inPlay ? !(endIsGameStart && end <= started && end > started - recentGameWindow) :
      !(end > started && end <= horizon)) return;
    const eventSlug = event?.slug || m.slug;
    if (!m.slug || !eventSlug) return;
    const slug = encodeURIComponent(eventSlug) + (eventSlug === m.slug ? "" : "/" + encodeURIComponent(m.slug));
    const title = m.question || m.slug;
    const isUpDown = updown(title + " " + m.slug);
    if (hideUpDown && isUpDown) return;
    const tags = (m.tags || []).map(t => t.label || t.slug || "").join(" ");
    const base = {title,end,url:"https://polymarket.com/event/"+slug,
      category:inPlay || m.sportsMarketType ? "Thể thao" : categories(tags,title+" "+m.slug),
      eventTitle:event?.title,updown:isUpDown,endIsGameStart,inPlay,liveCheckedAt:inPlay ? Date.now() : undefined,
      image:m.image || event?.image};
    const outcomes = unpack(m.outcomes);
    unpack(m.clobTokenIds).forEach((asset,i) => {
      const token = String(asset);
      if (!asset || !outcomes[i] || seen.has(token)) return;
      seen.add(token);
      pending.set(token, {...base,token,outcome:outcomes[i]});
    });
  }
  async function recentSports() {
    const query = new URLSearchParams({closed:"false", live:"true", tag_id:"1", limit:"30",
      end_date_min:new Date(started - recentGameWindow).toISOString(),
      end_date_max:new Date(started).toISOString()});
    const events = [];
    const sportsSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
    const cursors = new Set();
    while (true) {
      const page = await get("https://gamma-api.polymarket.com/events/keyset?" + query, {signal:sportsSignal});
      for (const event of page.events) {
        if (event.live === true && event.ended !== true) events.push(event);
      }
      if (!page.next_cursor) return events;
      if (cursors.has(page.next_cursor)) throw Error("Cursor thể thao lặp lại");
      cursors.add(page.next_cursor);
      query.set("after_cursor", page.next_cursor);
    }
  }
  try {
    const sports = recentSports().then(events => ({events}), error => ({error}));
    let cursor;
    const cursors = new Set();
    do {
      const page = await get("https://gamma-api.polymarket.com/markets/keyset?" + params, {signal});
      for (const m of page.markets) addMarket(m, m.events?.[0]);
      if (!pages) {
        const {events, error} = await sports;
        if (signal.aborted) return;
        sportsUnavailable = Boolean(error);
        if (error) console.warn("Chưa tải được danh sách thể thao đã bắt đầu", error);
        for (const event of events || []) {
          for (const m of event.markets || []) addMarket(m, event, true);
        }

      }
      pages++;
      if (manual) $("status").textContent = "Đang quét sổ lệnh · " + pages + " trang";
      if (pending.size >= 600 || (pending.size && !fresh.length)) {
        await flush();
        if (fresh.length && !signal.aborted) publish(true);
      }
      cursor = page.next_cursor;
      if (cursor) {
        if (cursors.has(cursor)) throw Error("Cursor lặp lại");
        cursors.add(cursor);
        params.set("after_cursor", cursor);
      }
    } while(cursor);
    await flush();
    if (!signal.aborted) {
      publish(false);
      $("status").textContent = failed.size || sportsUnavailable ? "Cập nhật một phần · sẽ thử lại" : "Cập nhật " + statusTime.format(Date.now());
    }
  } catch (error) {
    if (!signal.aborted) {
      $("status").textContent = "Chưa tải đủ dữ liệu · đang giữ kết quả đã nhận";
      console.error(error);
    }
  } finally {
    loading = false;
    scanController = undefined;
    $("refresh").removeAttribute("aria-busy");
    render();
    if (manualQueued) {
      manualQueued = false;
      void refresh(true);
    } else {
      scheduleRefresh(signal.aborted ? 200 : failed.size || sportsUnavailable || $("status").textContent.startsWith("Chưa") ? 15000 : refreshDelay);
    }
  }
}
$("refresh").addEventListener("click", () => refresh(true));
render();

// Keep the time window current while the dashboard stays open.
setInterval(render, 5000);
scheduleRefresh(0);
document.addEventListener("visibilitychange", () => {
  render();
  if (!document.hidden && !loading) scheduleRefresh(0);
});
