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
const metricText = (value, unit) => value == null ? "—" : fmt.format(value) + unit;
function quoteDetails(row) {
  const details = element("div", "quote-details");
  for (const [name, value] of [
    ["Bid", metricText(row.bid, "¢")],
    ["Spread", metricText(spreadValue(row), "¢")],
    ["Midpoint", metricText(row.bid == null ? null : (row.bid + row.ask) / 2, "%")],
  ]) {
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
function endLabel(row) {
  const prefix = row.endIsGameStart ? "Bắt đầu trận · " : "";
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
let featuredRow;
const cardCache = new Map();
let rankedKeys = [];
function structure(row) {
  return JSON.stringify([row.title, row.category, row.end, row.endIsGameStart ?? false]);
}
function updateQuote(container, row, suffix = "") {
  const price = container.querySelector(".ask-value");
  const shares = container.querySelector(".share-value");
  if (price.textContent !== priceText(row)) {
    price.textContent = priceText(row);
    price.setAttribute("aria-label", "Best ask " + fmt.format(row.ask) + " cent");
  }
  const details = container.querySelector(".quote-details");
  const updated = quoteDetails(row);
  if (details.textContent !== updated.textContent) details.replaceWith(updated);
  const size = sharesText(row) + suffix;
  if (shares.textContent !== size) shares.textContent = size;
}
function renderFeatured(row) {
  if (!row && !featuredRow) return;
  if (row && featuredRow && rowKey(row) === rowKey(featuredRow) && structure(row) === structure(featuredRow)) {
    updateQuote($("featured"), row, " tại best ask");
    featuredRow = row;
    return;
  }
  featuredRow = row;
  const section = $("featured");
  section.hidden = !row;
  section.replaceChildren();
  if (!row) return;
  const panel = element("article", "feature-panel");
  const body = element("div", "feature-body");
  const title = element("h2");
  title.append(marketLink(row, row.title));
  const foot = element("div", "card-foot");
  foot.append(element("span", "share-value", sharesText(row) + " tại best ask"), endLabel(row), marketLink(row, "Mở market"));
  body.append(element("div", "feature-label", "Nổi bật · " + row.category), title, quote(row), foot);
  panel.append(body, media(row, "feature-media", false));
  section.append(panel);
}
function render(reorder = false) {
  const query = norm($("query").value.trim());
  const now = Date.now();
  const horizon = now + Number($("hours").value) * 3600000;
  const min = $("ask").valueAsNumber || 0;
  const maxSpread = $("max-spread").valueAsNumber;
  const matches = rows.filter(row => row.ask != null && row.ask >= min
    && (!Number.isFinite(maxSpread) || (row.bid != null && spreadValue(row) <= maxSpread)) && row.end > now && row.end <= horizon
    && (!$("hide").checked || !row.updown) && (category === "Tất cả" || category === row.category)
    && norm(row.title + " " + row.outcome).includes(query));
  const order = $("sort").value;
  const rank = new Map(rankedKeys.map((key, index) => [key, index]));
  const compare = (a,b) => (order === "ask" ? a.ask-b.ask : order === "size" ? b.size-a.size : a.end-b.end)
    || a.end-b.end || a.ask-b.ask;
  matches.sort((a,b) => (reorder ? 0 : (rank.get(rowKey(a)) ?? Infinity) - (rank.get(rowKey(b)) ?? Infinity)) || compare(a,b));
  rankedKeys = matches.map(rowKey);
  const candidates = !query && category === "Tất cả" ? matches.filter(row => row.image && !row.updown) : [];
  renderFeatured((!reorder && featuredRow ? candidates.find(row => rowKey(row) === rowKey(featuredRow)) : undefined)
    || candidates.find(row => row.category !== "Thể thao" && row.category !== "Khác" && row.size >= 25)
    || candidates[0]);
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
    const message = loading ? "Đang tìm market phù hợp…" :
      Number.isFinite(maxSpread) && !rows.some(row => row.bid != null)
        ? "Cần dữ liệu sổ lệnh mới để lọc spread."
        : "Không có kết quả cho bộ lọc này.";
    if (empty) empty.textContent = message;
    else grid.append(element("p", "empty", message));
  } else {
    empty?.remove();
  }
  $("more").hidden = visible >= matches.length;
  stream.watch([featuredRow, ...matches.slice(0, Math.min(visible, 72))].filter(row => row?.token));
}
function reset() { visible = 36; render(true); }
for (const id of ["query","ask","max-spread","sort"]) $(id).addEventListener("input", reset);
for (const id of ["hours","hide"]) $(id).addEventListener("input", () => {
  reset();
  scanController?.abort();
  scheduleRefresh(200);
});
$("more").addEventListener("click", () => { visible += 36; render(); });
function unpack(value) { return typeof value === "string" ? JSON.parse(value) : value || []; }
async function get(url, options) {
  for (let attempt=0; attempt<3; attempt++) {
    const res = await fetch(url, {...options, signal:options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000)});
    if (res.ok) return res.json();
    if (attempt === 2 || (res.status !== 429 && res.status < 500)) throw Error("HTTP " + res.status);
    await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
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
  let wanted = new Set(), subscribed = new Set();
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
    const row = rows.find(row => row.token === token);
    if (!row || book.timestamp < (row.quoteTime || 0)) return;
    const next = topOfBook(book.bids, book.asks);
    const changed = row.ask !== next.ask || row.bid !== next.bid || row.size !== next.size;
    Object.assign(row, next, {quoteTime:book.timestamp});
    if (changed && !paint) paint = setTimeout(() => { paint = undefined; render(); }, 1000);
  }
  function connect() {
    if (socket || !wanted.size || document.hidden || typeof WebSocket === "undefined") return;
    const connection = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/market");
    socket = connection;
    connection.onopen = () => {
      if (socket !== connection) return;
      subscribed = new Set(wanted);
      connection.send(JSON.stringify({type:"market", assets_ids:[...subscribed]}));
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
        if (message.event_type === "book" && wanted.has(message.asset_id)) {
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
    wanted = new Set(watchRows.map(row => row.token));
    if (document.hidden || !wanted.size) { stop(); retry = undefined; return; }
    if (!socket) { if (!retry) connect(); return; }
    if (socket.readyState !== WebSocket.OPEN) return;
    const added = [...wanted].filter(token => !subscribed.has(token));
    const removed = [...subscribed].filter(token => !wanted.has(token));
    if (added.length) socket.send(JSON.stringify({operation:"subscribe", assets_ids:added}));
    if (removed.length) socket.send(JSON.stringify({operation:"unsubscribe", assets_ids:removed}));
    for (const token of removed) books.delete(token);
    subscribed = new Set(wanted);
  }
  return {watch};
})();
const refreshDelay = 180000;
let refreshTimer, scanController;
function scheduleRefresh(delay = refreshDelay) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (document.hidden) scheduleRefresh();
    else refresh();
  }, delay);
}
async function refresh(manual = false) {
  if (loading) return;
  loading = true;
  clearTimeout(refreshTimer);
  const controller = new AbortController();
  scanController = controller;
  const {signal} = controller;
  if (manual) $("status").textContent = "Đang làm mới…";
  $("refresh").setAttribute("aria-busy", "true");
  const started = Date.now();
  const horizon = started + Number($("hours").value) * 3600000;
  const hideUpDown = $("hide").checked;
  const params = new URLSearchParams({closed:"false",limit:"100",include_tag:"true",
    end_date_min:new Date(started).toISOString(),end_date_max:new Date(horizon).toISOString()});
  const fresh = [];
  const pending = new Map();
  const seen = new Set();
  let pages = 0;
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
    rows = partial ? [...merged, ...current.values()] : merged;
    loaded = true;
    if (partial) render();
  }
  async function flush() {
    const entries = [...pending];
    pending.clear();
    for (let start = 0; start < entries.length; start += 600) {
      const group = entries.slice(start, start + 600);
      await Promise.all(Array.from({length:Math.ceil(group.length / 100)}, (_, i) => quote(group.slice(i * 100, (i + 1) * 100))));
    }
  }
  try {
    let cursor;
    do {
      const page = await get("https://gamma-api.polymarket.com/markets/keyset?" + params, {signal});
      for (const m of page.markets) {
        const end = Date.parse(m.endDate);
        if (!m.active || !m.acceptingOrders || !(end > started && end <= horizon)) continue;
        const event = m.events?.[0]?.slug || m.slug;
        if (!m.slug || !event) continue;
        const slug = encodeURIComponent(event) + (event === m.slug ? "" : "/" + encodeURIComponent(m.slug));
        const title = m.question || m.slug;
        const isUpDown = updown(title + " " + m.slug);
        if (hideUpDown && isUpDown) continue;
        const tags = (m.tags || []).map(t => t.label || t.slug || "").join(" ");
        const gameStart = m.gameStartTime?.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
        const endIsGameStart = Boolean(gameStart && Date.parse(gameStart) === end);
        const base = {title,end,url:"https://polymarket.com/event/"+slug,category:categories(tags,title+" "+m.slug),
          updown:isUpDown,endIsGameStart,image:m.image || m.events?.[0]?.image};
        const outcomes = unpack(m.outcomes);
        unpack(m.clobTokenIds).forEach((asset,i) => {
          if (!asset || !outcomes[i] || seen.has(asset)) return;
          seen.add(asset);
          const token = String(asset);
          pending.set(token, {...base,token,outcome:outcomes[i]});
        });
      }
      pages++;
      if (manual) $("status").textContent = "Đang quét sổ lệnh · " + pages + " trang";
      if (pending.size >= 600 || (pending.size && !fresh.length)) {
        await flush();
        if (fresh.length && !rows.some(row => row.token) && !signal.aborted) publish(true);
      }
      if (page.next_cursor && page.next_cursor === cursor) throw Error("Cursor lặp lại");
      cursor = page.next_cursor;
      if (cursor) params.set("after_cursor",cursor);
    } while(cursor);
    await flush();
    if (!signal.aborted) {
      publish(false);
      $("status").textContent = "";
    }
  } catch (error) {
    if (!signal.aborted) {
      if (manual || !loaded) $("status").textContent = "Chưa làm mới được. Trang sẽ thử lại.";
      console.error(error);
    }
  } finally {
    loading = false;
    scanController = undefined;
    $("refresh").removeAttribute("aria-busy");
    render();
    scheduleRefresh(signal.aborted ? 200 : refreshDelay);
  }
}
$("refresh").addEventListener("click", () => refresh(true));
try {
  const data = await get(new URL("snapshot.json", import.meta.url));
  rows = data.map(([title,outcome,ask,size,end,url,scan,image]) => ({title,outcome,ask,size,end,url,scan,image,
    category:categories("",title+" "+url),updown:updown(title+" "+url)}));
  loaded = true;
} catch {}
render();

// Keep the time window current while the dashboard stays open.
setInterval(render, 30000);
scheduleRefresh(0);
document.addEventListener("visibilitychange", () => {
  render();
  if (!document.hidden && !loading) scheduleRefresh(0);
});
