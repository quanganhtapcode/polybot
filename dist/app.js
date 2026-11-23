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
const sharesText = row => fmt.format(row.size) + " shares";
function quote(row) {
  const box = element("div", "quote");
  const price = element("strong", "ask-value", priceText(row));
  price.setAttribute("aria-label", "Best ask " + fmt.format(row.ask) + " cent");
  box.append(element("span", "", row.outcome), price);
  return box;
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
  const matches = rows.filter(row => row.ask >= min && row.end > now && row.end <= horizon
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
    const message = loading ? "Đang tìm market phù hợp…" : "Không có kết quả cho bộ lọc này.";
    if (empty) empty.textContent = message;
    else grid.append(element("p", "empty", message));
  } else {
    empty?.remove();
  }
  $("more").hidden = visible >= matches.length;
}
function reset() { visible = 36; render(true); }
for (const id of ["query","ask","hours","hide","sort"]) $(id).addEventListener("input", reset);
$("more").addEventListener("click", () => { visible += 36; render(); });
function unpack(value) { return typeof value === "string" ? JSON.parse(value) : value || []; }
async function get(url, options) {
  for (let attempt=0; attempt<3; attempt++) {
    const res = await fetch(url, {...options, signal:AbortSignal.timeout(25000)});
    if (res.ok) return res.json();
    if (attempt === 2 || (res.status !== 429 && res.status < 500)) throw Error("HTTP " + res.status);
    await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
  }
}
const refreshDelay = 60000;
let refreshTimer;
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
  if (manual) $("status").textContent = "Đang làm mới…";
  $("refresh").setAttribute("aria-busy", "true");
  const started = Date.now();
  const params = new URLSearchParams({closed:"false",limit:"100",include_tag:"true",
    end_date_min:new Date(started).toISOString(),end_date_max:new Date(started+86400000).toISOString()});
  const fresh = [];
  const deferred = [];
  const seen = new Set();
  let pages = 0;
  async function quote(tokens) {
    const books = await get("https://clob.polymarket.com/books",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify([...tokens.keys()].map(token_id => ({token_id})))});
    for (const book of books) {
      const row = tokens.get(book.asset_id);
      if (!row) continue;
      let ask = Infinity, size = 0;
      for (const level of book.asks || []) {
        const price = Number(level.price)*100, amount = Number(level.size);
        if (amount <= 0) continue;
        if (price < ask) {ask = price; size = amount;}
        else if (price === ask) size += amount;
      }
      if (Number.isFinite(ask)) fresh.push({...row,ask,size});
    }
  }
  async function quotes(tokens) {
    const entries = [...tokens];
    for (let start=0;start<entries.length;start+=600) {
      const group = entries.slice(start,start+600);
      await Promise.all(Array.from({length:Math.ceil(group.length/100)},(_,i) => quote(new Map(group.slice(i*100,(i+1)*100)))));
    }
  }
  try {
    let cursor;
    do {
      const page = await get("https://gamma-api.polymarket.com/markets/keyset?" + params);
      const batch = new Map();
      for (const m of page.markets) {
        const end = Date.parse(m.endDate);
        if (!m.active || !m.acceptingOrders || !(end > started && end <= started+86400000)) continue;
        const event = m.events?.[0]?.slug || m.slug;
        if (!m.slug || !event) continue;
        const slug = encodeURIComponent(event) + (event === m.slug ? "" : "/" + encodeURIComponent(m.slug));
        const tags = (m.tags || []).map(t => t.label || t.slug || "").join(" ");
        const title = m.question || m.slug;
        const gameStart = m.gameStartTime?.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
        const endIsGameStart = Boolean(gameStart && Date.parse(gameStart) === end);
        const base = {title,end,url:"https://polymarket.com/event/"+slug,category:categories(tags,title+" "+m.slug),
          updown:updown(title+" "+m.slug),endIsGameStart,image:m.image || m.events?.[0]?.image};
        const outcomes = unpack(m.outcomes);
        unpack(m.clobTokenIds).forEach((token,i) => {
          if (!token || !outcomes[i] || seen.has(token)) return;
          seen.add(token);
          const row = {...base,outcome:outcomes[i]};
          if (base.updown) deferred.push([token,row]);
          else batch.set(token,row);
        });
      }
      if (batch.size) await quotes(batch);
      pages++;
      if (manual) $("status").textContent = "Đang quét sổ lệnh · " + pages + " trang";
      if (page.next_cursor && page.next_cursor === cursor) throw Error("Cursor lặp lại");
      cursor = page.next_cursor;
      if (cursor) params.set("after_cursor",cursor);
    } while(cursor);
    if (manual) $("status").textContent = "Đang kiểm tra các kèo Up/Down";
    await quotes(new Map(deferred));
    rows = fresh;
    loaded = true;
    $("status").textContent = "";
  } catch (error) {
    if (manual || !loaded) $("status").textContent = "Chưa làm mới được. Trang sẽ thử lại.";
    console.error(error);
  } finally {
    loading = false;
    $("refresh").removeAttribute("aria-busy");
    render();
    scheduleRefresh();
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
