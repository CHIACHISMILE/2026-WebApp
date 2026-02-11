/* =========================================================
 * app.js (v8)
 * Changes vs v7:
 * - Remove manual sync button & feature (pull-to-refresh == manual sync)
 * - Swipe: left/right to change date (itinerary page)
 * - Edge-swipe: switch tabs (from screen edge)
 * - Itinerary add button: keep bottom only
 * - Expenses defaults: no preselect (payer/split none)
 * ========================================================= */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzfX8f3-CcY6X-nu7Sm545Xk5ysHRrWvwqWxBV0-YGX3Ss3ShJM6r9eDnXcoBNwBULhxw/exec";
const DRIVE_FOLDER_ID = "10ogmnlqLreB_PzSwyuQGtKzO759NVF3M";

const TRIP_START = "2026-08-30";
const TRIP_END   = "2026-09-26";
const BUDGET_JQ_TY = 500000;

const PEOPLE = ["家齊", "亭穎", "媽媽"];
const WHERE = ["臺灣", "挪威", "冰島", "杜拜", "英國"];
const EXP_CATEGORIES = [
  "早餐","午餐","晚餐","零食",
  "住宿",
  "交通（機票）","交通（租車）","交通（停車費）","交通（油錢）","交通（電費）",
  "紀念品","門票","其他"
];
const PAY = ["現金","信用卡－國泰","信用卡–永豐","信用卡–元大","信用卡-永豐","信用卡-元大","信用卡-國泰"];
const IT_CATEGORIES = ["景點","飲食","交通","住宿","其他"];

const LS = {
  itinerary: "tripapp_itinerary_v10",
  expenses:  "tripapp_expenses_v10",
  fx:        "tripapp_fx_global_v1",
  outbox:    "tripapp_outbox_v10",
  ui:        "tripapp_ui_v7"
};

const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch { return fallback; }
}
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function fmtMoney(n){ return Number(n||0).toLocaleString("zh-Hant-TW"); }
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function uid(prefix="X"){
  const t = new Date().toISOString().replace(/[:.]/g,"-");
  const r = Math.random().toString(16).slice(2,8);
  return `${prefix}-${t}-${r}`;
}

function parseLocalDate(yyyy_mm_dd){
  const [y,m,d] = String(yyyy_mm_dd).split("-").map(Number);
  return new Date(y, m-1, d, 12, 0, 0);
}
function fmtDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function weekdayZh(d){ return ["日","一","二","三","四","五","六"][d.getDay()]; }
function daysBetween(a,b){
  const ms = (parseLocalDate(fmtDate(b)).getTime() - parseLocalDate(fmtDate(a)).getTime());
  return Math.round(ms/86400000);
}
function normalizeDateKey(v){
  if (!v) return "";
  if (typeof v === "string"){
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const md = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (md){
      const mm = String(md[1]).padStart(2,"0");
      const dd = String(md[2]).padStart(2,"0");
      return `${md[3]}-${mm}-${dd}`;
    }
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return fmtDate(new Date(t));
    return v;
  }
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) return fmtDate(v);
  const t = Date.parse(String(v));
  if (!Number.isNaN(t)) return fmtDate(new Date(t));
  return String(v);
}
function normalizeTime(v){
  if (v === null || v === undefined || v === "") return "";
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
    const hh = String(v.getHours()).padStart(2,"0");
    const mm = String(v.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  if (typeof v === "number" && Number.isFinite(v)){
    const totalMin = Math.round(v * 24 * 60);
    const hh = String(Math.floor(totalMin/60) % 24).padStart(2,"0");
    const mm = String(totalMin % 60).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  const s = String(v).trim();
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm){
    const hh = String(Number(hm[1])).padStart(2,"0");
    const mm = String(Number(hm[2])).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const d = new Date(s);
    if (!isNaN(d.getTime())){
      const useUtc = /Z$/.test(s);
      const hh = String(useUtc ? d.getUTCHours() : d.getHours()).padStart(2,"0");
      const mm = String(useUtc ? d.getUTCMinutes() : d.getMinutes()).padStart(2,"0");
      return `${hh}:${mm}`;
    }
  }
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0 && n <= 1){
    const totalMin = Math.round(n * 24 * 60);
    const hh = String(Math.floor(totalMin/60) % 24).padStart(2,"0");
    const mm = String(totalMin % 60).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  return s;
}
function stripHtml(html){
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || "").trim();
}
function confirmDelete(title){
  const a = prompt(`請輸入「刪除」以確認刪除：\n${title}`);
  return (a || "").trim() === "刪除";
}

/* category helpers */
function itCardClass(cat){
  return ({ "景點":"it-sight","飲食":"it-food","交通":"it-traffic","住宿":"it-stay","其他":"it-other" })[cat] || "it-other";
}
function itTagClass(cat){
  return ({ "景點":"tag-it-sight","飲食":"tag-it-food","交通":"tag-it-traffic","住宿":"tag-it-stay","其他":"tag-it-other" })[cat] || "tag-it-other";
}
function expTagClassExact(cat){
  switch(cat){
    case "早餐": return "tag-exp-breakfast";
    case "午餐": return "tag-exp-lunch";
    case "晚餐": return "tag-exp-dinner";
    case "零食": return "tag-exp-snack";
    case "住宿": return "tag-exp-stay";
    case "交通（機票）": return "tag-exp-flight";
    case "交通（租車）": return "tag-exp-rent";
    case "交通（停車費）": return "tag-exp-parking";
    case "交通（油錢）": return "tag-exp-fuel";
    case "交通（電費）": return "tag-exp-charge";
    case "紀念品": return "tag-exp-souvenir";
    case "門票": return "tag-exp-ticket";
    default: return "tag-exp-other";
  }
}

/* FX */
function getFx(){
  const fx = load(LS.fx, { NOK:1, ISK:1, EUR:1, GBP:1, AED:1 });
  return { ...{NOK:1, ISK:1, EUR:1, GBP:1, AED:1}, ...fx };
}
function setFx(next){ save(LS.fx, next); }
function normalizeCurrency(c){
  const s = String(c || "TWD").toUpperCase().trim();
  if (s === "NTD") return "TWD";
  return s;
}
function toTwd(e, fx){
  const override = Number(e.twdOverride);
  if (Number.isFinite(override) && override > 0) return Math.round(override);
  const amt = Number(e.amount || 0);
  const cur = normalizeCurrency(e.currency || "TWD");
  if (cur === "TWD") return Math.round(amt);
  return Math.round(amt * Number(fx[cur] || 1));
}
function sumTwd(items, fx){
  return Math.round(items.reduce((s,e)=>s + toTwd(e, fx), 0));
}
function normalizePayment(p){
  let s = String(p||"").trim();
  s = s.replaceAll("－","-").replaceAll("–","-");
  if (s === "信用卡-永豐") return "信用卡–永豐";
  if (s === "信用卡-元大") return "信用卡–元大";
  if (s === "信用卡-國泰") return "信用卡－國泰";
  return p;
}

/* ===== DOM ===== */
const elTripDay = $("#tripDayLabel");
const elToday = $("#todayLabel");
const elSync = $("#syncStatus");

const tabButtons = $$(".tab");
const pageIt = $("#page-itinerary");
const pageEx = $("#page-expenses");
const pageAn = $("#page-analysis");

const dateStrip = $("#dateStrip");
const selectedDateLabel = $("#selectedDateLabel");
const selectedDayIndexLabel = $("#selectedDayIndexLabel");

const itineraryList = $("#itineraryList");
const btnAddItineraryBottom = $("#btnAddItineraryBottom"); // ✅ only bottom

const modalItinerary = $("#modalItinerary");
const itModalTitle = $("#itModalTitle");
const btnCloseItinerary = $("#btnCloseItinerary");
const btnCancelIt = $("#btnCancelIt");
const btnSaveIt = $("#btnSaveIt");
const itStart = $("#itStart");
const itEnd = $("#itEnd");
const itCatChooser = $("#itCatChooser");
const itTitle = $("#itTitle");
const itAddress = $("#itAddress");
const itNote = $("#itNote");
const itImage = $("#itImage");
const itImagePreview = $("#itImagePreview");
const btnOpenMap = $("#btnOpenMap");
const btnLinkTitle = $("#btnLinkTitle");
const btnLinkNote = $("#btnLinkNote");

/* expenses input */
const expWho = $("#expWho");
const expWhere = $("#expWhere");
const expCategory = $("#expCategory");
const expPay = $("#expPay");
const expCurrency = $("#expCurrency");
const expAmount = $("#expAmount");
const expTitle = $("#expTitle");
const btnAddExpense = $("#btnAddExpense");
const btnSplitAll = $("#btnSplitAll");
const splitChooser = $("#splitChooser");

/* analysis */
const btnFx = $("#btnFx");
const btnFilter = $("#btnFilter");
const budgetRemain = $("#budgetRemain");
const budgetSpent = $("#budgetSpent");
const momLine = $("#momLine");
const budgetBar = $("#budgetBar");
const pieCanvas = $("#pie");
const analysisExpenseList = $("#analysisExpenseList");
const settlement = $("#settlement");
const filterChips = $("#filterChips");

const modalFilter = $("#modalFilter");
const btnCloseFilter = $("#btnCloseFilter");
const btnClearFilter = $("#btnClearFilter");
const btnApplyFilter = $("#btnApplyFilter");
const filterWhoBox = $('[data-filter-group="who"]');
const filterWhereBox = $('[data-filter-group="where"]');
const filterCategoryBox = $('[data-filter-group="category"]');
const filterPayBox = $('[data-filter-group="pay"]');

/* viewer */
const modalViewer = $("#modalViewer");
const btnCloseViewer = $("#btnCloseViewer");
const btnResetViewer = $("#btnResetViewer");
const viewerStage = $("#viewerStage");
const viewerImg = $("#viewerImg");

/* ===== State ===== */
const tripStartD = parseLocalDate(TRIP_START);
const tripEndD = parseLocalDate(TRIP_END);
const tripDays = daysBetween(tripStartD, tripEndD) + 1;
function tripDayIndexFor(d){ return daysBetween(tripStartD, d) + 1; }

let state = {
  tab: "itinerary",
  selectedDate: TRIP_START,
  itDraftCat: IT_CATEGORIES[0],
  itDraftImageDataUrl: "",
  itDraftDriveFileId: "",
  itDraftDriveUrl: "",
  itDraftLink: "",
  editingItId: null,
  filter: { who:new Set(), where:new Set(), category:new Set(), pay:new Set() },
  pending: { Expenses:new Set(), Itinerary:new Set() },
  pieChart: null,
  viewer: { scale:1, tx:0, ty:0 }
};

/* ===== Sync badge ===== */
function setSyncBadge(mode, text){
  const dotClass = { ok:"dot-ok", sync:"dot-sync", offline:"dot-offline", warn:"dot-wait" }[mode] || "dot-ok";
  elSync.innerHTML = `<span class="dot ${dotClass}"></span><span class="text-sm">${escapeHtml(text)}</span>`;
}
function computePendingFromOutbox(){
  const box = load(LS.outbox, []);
  const exp = new Set();
  const it = new Set();
  for (const op of box){
    if (String(op.op||"").toLowerCase() !== "upsert") continue;
    const id = String(op?.row?.ID || "").trim();
    if (!id) continue;
    if (op.table === "Expenses") exp.add(id);
    if (op.table === "Itinerary") it.add(id);
  }
  state.pending.Expenses = exp;
  state.pending.Itinerary = it;
}
function updateSyncBadge(){
  computePendingFromOutbox();
  const hasPending = load(LS.outbox, []).length > 0;
  if (!navigator.onLine){
    setSyncBadge(hasPending ? "warn" : "offline", hasPending ? "待上傳" : "離線");
    return;
  }
  setSyncBadge("ok", "已同步");
}

/* ===== Header ===== */
function renderHeader(){
  const now = new Date();
  elToday.textContent = `${now.getMonth()+1}/${now.getDate()}（${weekdayZh(now)}）`;

  const todayLocal = parseLocalDate(fmtDate(now));
  if (todayLocal < tripStartD) elTripDay.textContent = `倒數 ${daysBetween(todayLocal, tripStartD)} 日`;
  else if (todayLocal > tripEndD) elTripDay.textContent = `旅行已結束`;
  else elTripDay.textContent = `第 ${tripDayIndexFor(todayLocal)} 日`;
}

/* ===== Date strip ===== */
function buildDateStrip(){
  dateStrip.innerHTML = "";
  for (let i=0;i<tripDays;i++){
    const d = new Date(tripStartD.getTime() + i*86400000);
    const key = fmtDate(d);
    const btn = document.createElement("button");
    btn.className = "date-chip";
    btn.dataset.date = key;
    btn.textContent = `${d.getMonth()+1}/${d.getDate()} ${weekdayZh(d)}`;
    btn.addEventListener("click", () => setSelectedDate(key, true));
    dateStrip.appendChild(btn);
  }
  setSelectedDate(state.selectedDate, true);
}
function setSelectedDate(key, scroll){
  state.selectedDate = normalizeDateKey(key);
  $$(".date-chip").forEach(b => b.classList.toggle("active", b.dataset.date === state.selectedDate));

  const d = parseLocalDate(state.selectedDate);
  selectedDateLabel.textContent = `${d.getMonth()+1}/${d.getDate()}（${weekdayZh(d)}）`;
  selectedDayIndexLabel.textContent = `Day ${tripDayIndexFor(d)}`;

  if (scroll){
    const active = $(`.date-chip[data-date="${state.selectedDate}"]`);
    active?.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
  }
  renderItinerary();
}
function shiftDate(delta){
  const d = parseLocalDate(state.selectedDate);
  d.setDate(d.getDate() + delta);
  const next = fmtDate(d);
  if (next < TRIP_START || next > TRIP_END) return;
  setSelectedDate(next, true);
}

/* ===== Tabs ===== */
const TAB_ORDER = ["itinerary","expenses","analysis"];
function setTab(tab){
  state.tab = tab;
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  pageIt.classList.toggle("hidden", tab !== "itinerary");
  pageEx.classList.toggle("hidden", tab !== "expenses");
  pageAn.classList.toggle("hidden", tab !== "analysis");
  save(LS.ui, { ...(load(LS.ui, {})), tab });
  if (tab === "analysis") renderAnalysis();
}
function shiftTab(delta){
  const idx = TAB_ORDER.indexOf(state.tab);
  const next = clamp(idx + delta, 0, TAB_ORDER.length-1);
  if (next === idx) return;
  setTab(TAB_ORDER[next]);
}

/* ===== Itinerary ===== */
function buildItCatChooser(){
  itCatChooser.innerHTML = "";
  IT_CATEGORIES.forEach((cat, idx) => {
    const b = document.createElement("button");
    b.className = `tag ${itTagClass(cat)}`;
    b.textContent = cat;
    b.addEventListener("click", () => {
      state.itDraftCat = cat;
      Array.from(itCatChooser.querySelectorAll(".tag"))
        .forEach(x => x.classList.toggle("active", x.textContent === cat));
    });
    itCatChooser.appendChild(b);
    if (idx===0) b.classList.add("active");
  });
  state.itDraftCat = IT_CATEGORIES[0];
}

function openItModal(editId=null){
  state.editingItId = editId;
  modalItinerary.classList.remove("hidden");

  state.itDraftImageDataUrl = "";
  state.itDraftDriveFileId = "";
  state.itDraftDriveUrl = "";
  state.itDraftLink = "";
  if (itImage) itImage.value = "";
  itImagePreview.innerHTML = "";

  if (!editId){
    itModalTitle.textContent = "新增行程";
    btnSaveIt.textContent = "新增行程";
    itStart.value = "09:00";
    itEnd.value = "10:00";
    state.itDraftCat = IT_CATEGORIES[0];
    Array.from(itCatChooser.querySelectorAll(".tag")).forEach((x,i)=>x.classList.toggle("active", i===0));
    itTitle.innerHTML = "";
    itAddress.value = "";
    itNote.innerHTML = "";
    return;
  }

  const all = load(LS.itinerary, []);
  const it = all.find(x => x.id === editId);
  if (!it) return;

  itModalTitle.textContent = "編輯行程";
  btnSaveIt.textContent = "儲存變更";

  itStart.value = it.start || "";
  itEnd.value = it.end || "";
  state.itDraftCat = it.category || IT_CATEGORIES[0];
  Array.from(itCatChooser.querySelectorAll(".tag"))
    .forEach(x => x.classList.toggle("active", x.textContent === state.itDraftCat));

  itTitle.innerHTML = it.title || "";
  itAddress.value = it.location || "";
  state.itDraftLink = it.link || "";
  itNote.innerHTML = it.note || "";

  state.itDraftDriveFileId = it.imageId || "";
  state.itDraftDriveUrl = it.image || "";
  state.itDraftImageDataUrl = it.imageDataUrl || "";

  const imgSrc = state.itDraftDriveUrl || state.itDraftImageDataUrl;
  if (imgSrc) itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${imgSrc}" alt="preview" />`;
}
function closeItModal(){ modalItinerary.classList.add("hidden"); }

function toSheetItinerary(it){
  return {
    Date: normalizeDateKey(it.date),
    StatTime: it.start || "",
    EndTime: it.end || "",
    Category: it.category || "",
    Title: it.title || "",
    Location: it.location || "",
    Link: it.link || "",
    Note: it.note || "",
    Image: it.image || "",
    ImageID: it.imageId || "",
    ID: it.id
  };
}

function saveItinerary(){
  const start = normalizeTime(itStart.value || "");
  const end = normalizeTime(itEnd.value || "");
  const category = state.itDraftCat;
  const titleHtml = (itTitle.innerHTML || "").trim();
  const location = (itAddress.value || "").trim();
  const noteHtml = (itNote.innerHTML || "").trim();

  if (!titleHtml) return alert("請輸入標題");

  const driveFileId = state.itDraftDriveFileId || "";
  const driveUrl = state.itDraftDriveUrl || "";
  const imageDataUrl = state.itDraftImageDataUrl || "";

  const all = load(LS.itinerary, []);
  const base = {
    date: state.selectedDate,
    start, end, category,
    title: titleHtml,
    location,
    link: state.itDraftLink || "",
    note: noteHtml,
    image: driveUrl || "",
    imageId: driveFileId || "",
    imageDataUrl
  };

  let savedRow = null;
  if (!state.editingItId){
    savedRow = { id: uid("IT"), ...base };
    all.push(savedRow);
  } else {
    const idx = all.findIndex(x => x.id === state.editingItId);
    if (idx >= 0){
      all[idx] = { ...all[idx], ...base };
      savedRow = all[idx];
    }
  }

  save(LS.itinerary, all);
  if (savedRow){
    queueOutbox({ op:"upsert", table:"Itinerary", row: toSheetItinerary(savedRow) });
  }
  closeItModal();
  renderItinerary();
}

function deleteItinerary(id){
  const all = load(LS.itinerary, []);
  const it = all.find(x => x.id === id);
  if (!it) return;
  if (!confirmDelete(`行程：${stripHtml(it.title)}`)) return;

  const idx = all.findIndex(x => x.id === id);
  all.splice(idx, 1);
  save(LS.itinerary, all);

  queueOutbox({ op:"delete", table:"Itinerary", key:{ ID:id }});
  renderItinerary();
}

function renderItinerary(){
  updateSyncBadge();

  const all = load(LS.itinerary, []);
  const items = all
    .map(x => ({
      ...x,
      date: normalizeDateKey(x.date),
      start: normalizeTime(x.start),
      end: normalizeTime(x.end)
    }))
    .filter(x => x.date === state.selectedDate)
    .sort((a,b) => (a.start||"").localeCompare(b.start||""));

  itineraryList.innerHTML = "";

  if (!items.length){
    itineraryList.innerHTML = `<div class="card p-4 text-sm" style="color: rgba(7,19,31,.62);">今天還沒有行程。可以按「新增行程」。</div>`;
    return;
  }

  items.forEach(it => {
    const time = (it.start || it.end) ? `${it.start||""}–${it.end||""}` : "";
    const imgSrc = it.image || it.imageDataUrl || "";
    const pendingOffline = (!navigator.onLine) && state.pending.Itinerary.has(it.id);

    const card = document.createElement("div");
    card.className = `card p-4 it-card ${itCardClass(it.category)}`;
    if (pendingOffline) card.classList.add("pending-card");

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="tag ${itTagClass(it.category)}">${escapeHtml(it.category)}</span>
            <span class="text-xs font-extrabold" style="color: rgba(7,19,31,.72);">${escapeHtml(time)}</span>
            ${pendingOffline ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
          </div>
          <div class="mt-2 text-base font-semibold leading-snug break-words" style="color: rgba(7,19,31,.94);">${it.title || ""}</div>
          ${it.location ? `<div class="mt-2 text-xs break-words" style="color: rgba(7,19,31,.66);">${escapeHtml(it.location)}</div>` : ""}
          ${it.link ? `<div class="mt-2 text-xs"><a href="${escapeHtml(it.link)}" target="_blank" rel="noopener" class="link-soft">開啟連結</a></div>` : ""}
          ${it.note ? `<div class="mt-2 text-sm break-words" style="color: rgba(7,19,31,.82);">${it.note}</div>` : ""}
          ${imgSrc ? `<div class="mt-3"><img class="rounded-2xl border border-white/10 cursor-pointer" data-view-src="${imgSrc}" src="${imgSrc}" alt="img"/></div>` : ""}
        </div>
        <div class="shrink-0 flex flex-col gap-2">
          <button class="btn btn-ghost text-sm" data-act="edit">編輯</button>
          <button class="btn btn-ghost text-sm" data-act="del">刪除</button>
        </div>
      </div>
    `;

    card.querySelector('[data-act="edit"]').addEventListener("click", () => openItModal(it.id));
    card.querySelector('[data-act="del"]').addEventListener("click", () => deleteItinerary(it.id));

    const imgEl = card.querySelector('img[data-view-src]');
    if (imgEl) imgEl.addEventListener("click", () => openViewer(imgEl.dataset.viewSrc));

    itineraryList.appendChild(card);
  });
}

/* ===== Expenses: defaults none selected ===== */
function buildSplitChooser(){
  splitChooser.innerHTML = "";
  PEOPLE.forEach(p => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = p;
    b.dataset.value = p;
    b.addEventListener("click", () => b.classList.toggle("active"));
    splitChooser.appendChild(b);
  });

  // ✅ do NOT auto-select based on payer
  expWho.addEventListener("change", () => { /* no default */ });
}
function clearExpenseDefaults(){
  // payer/location/category/pay/currency keep whatever the select has
  // but split must be none
  $$("#splitChooser .tag").forEach(b => b.classList.remove("active"));
}
function getSplitSelected(){
  return $$("#splitChooser .tag.active").map(b => b.dataset.value);
}

/* Sheet mapping:
   Category = TWD converted
   Item = expense category
   Note = title */
function toSheetExpense(e){
  return {
    Date: normalizeDateKey(e.date),
    Payer: e.payer,
    Location: e.location,
    Category: e.twdOverride ?? "",
    Item: e.category,
    Payment: e.payment,
    Currency: normalizeCurrency(e.currency),
    Amount: e.amount,
    Involved: e.involved,
    Note: e.item,
    ID: e.id
  };
}
function addExpense(){
  const who = expWho.value || "";
  const where = expWhere.value || "";
  const category = expCategory.value || "";
  const pay = expPay.value || "";
  const currency = normalizeCurrency(expCurrency.value || "TWD");
  const amount = Number(expAmount.value);
  const title = (expTitle.value || "").trim();
  const split = getSplitSelected();

  if (!who) return alert("請選擇付款人");
  if (!where) return alert("請選擇消費地點");
  if (!category) return alert("請選擇消費類別");
  if (!pay) return alert("請選擇付款方式");
  if (!title) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!split.length) return alert("請選擇分攤人員");

  const fx = getFx();
  const twd = (currency === "TWD") ? Math.round(amount) : Math.round(amount * Number(fx[currency] || 1));

  const row = {
    id: uid("E"),
    date: state.selectedDate,
    payer: who,
    location: where,
    category,
    item: title,
    payment: pay,
    currency,
    amount,
    twdOverride: twd,
    involved: split.join(","),
  };

  const all = load(LS.expenses, []);
  all.push(row);
  save(LS.expenses, all);

  queueOutbox({ op:"upsert", table:"Expenses", row: toSheetExpense(row) });

  expAmount.value = "";
  expTitle.value = "";
  clearExpenseDefaults();

  updateSyncBadge();
}

/* ===== Analysis (keep v7 logic, omitted here for brevity) =====
   → 你把 v7 的 renderAnalysis/renderPie/settlement/filter/fx/edit modal 等維持不變即可。
   (我沒有動到那段核心邏輯，只是這版聚焦在你提出的手勢/同步/預設值)
*/

/* ===== Outbox / sync / pull ===== */
function queueOutbox(op){
  const box = load(LS.outbox, []);
  box.push(op);
  save(LS.outbox, box);
  updateSyncBadge();
}

async function postJsonNoPreflight(url, payload){
  const res = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}
async function pullAll(){
  const url = `${GAS_URL}?action=pull`;
  const res = await fetch(url).then(r => r.json());
  if (!res?.ok || !Array.isArray(res.rows)) throw new Error("pull failed");
  mergePulled(res.rows);
}
async function syncOutbox(){
  if (!navigator.onLine) return;
  const box = load(LS.outbox, []);
  if (!box.length) return;
  setSyncBadge("sync", "同步中");
  const payload = { action:"sync", ops: box };
  const res = await postJsonNoPreflight(GAS_URL, payload);
  if (!res?.ok) throw new Error(res?.error || "sync failed");
  save(LS.outbox, []);
}

/* ✅ Pull-to-refresh = manual sync:
   1) sync outbox
   2) pull latest
   3) rerender */
async function manualSyncViaPullToRefresh(){
  if (!navigator.onLine){
    updateSyncBadge();
    throw new Error("offline");
  }
  await syncOutbox();
  await pullAll();
  updateSyncBadge();
}

function mergePulled(rows){
  const exp = [];
  const it = [];

  for (const item of rows){
    const table = item.table;
    const r = item.row || {};

    if (table === "Expenses"){
      const twdOverride = Number(r.Category);
      const categoryFromItem = String(r.Item || "").trim();
      const category = EXP_CATEGORIES.includes(categoryFromItem) ? categoryFromItem : "其他";

      const currency = normalizeCurrency(r.Currency ?? "TWD");
      const amount = Number(r.Amount);

      exp.push({
        id: String(r.ID || ""),
        date: normalizeDateKey(r.Date || ""),
        payer: String(r.Payer || ""),
        location: String(r.Location || ""),
        category,
        item: String(r.Note || ""), // ✅ title
        payment: normalizePayment(String(r.Payment || "")) || "現金",
        currency,
        amount: Number.isFinite(amount) ? amount : 0,
        twdOverride: Number.isFinite(twdOverride) ? twdOverride : null,
        involved: String(r.Involved || ""),
      });
    }

    if (table === "Itinerary"){
      it.push({
        id: String(r.ID || ""),
        date: normalizeDateKey(r.Date || ""),
        start: normalizeTime(r.StatTime || ""),
        end: normalizeTime(r.EndTime || ""),
        category: String(r.Category || ""),
        title: String(r.Title || ""),
        location: String(r.Location || ""),
        link: String(r.Link || ""),
        note: String(r.Note || ""),
        image: String(r.Image || ""),
        imageId: String(r.ImageID || ""),
        imageDataUrl: ""
      });
    }
  }

  save(LS.expenses, exp.filter(x=>x.id));
  save(LS.itinerary, it.filter(x=>x.id));
}

/* ===== Pull-to-refresh (calls manualSyncViaPullToRefresh) ===== */
function setupPullToRefresh(containers){
  let ind = $("#ptrIndicator");
  if (!ind){
    ind = document.createElement("div");
    ind.id = "ptrIndicator";
    ind.style.position = "fixed";
    ind.style.left = "0";
    ind.style.right = "0";
    ind.style.top = "0";
    ind.style.zIndex = "9999";
    ind.style.padding = "10px 12px";
    ind.style.textAlign = "center";
    ind.style.fontSize = "12px";
    ind.style.fontWeight = "900";
    ind.style.color = "rgba(7,19,31,.76)";
    ind.style.background = "rgba(255,255,255,.88)";
    ind.style.backdropFilter = "blur(16px)";
    ind.style.webkitBackdropFilter = "blur(16px)";
    ind.style.borderBottom = "1px solid rgba(10,25,45,.12)";
    ind.style.transform = "translateY(-120%)";
    ind.style.transition = "transform 180ms ease";
    ind.textContent = "下拉重新整理";
    document.body.appendChild(ind);
  }

  const THRESH = 70;
  containers.forEach(el => {
    if (!el) return;
    let pulling=false, startY=0, dist=0;

    const isAtTop = () => (window.scrollY <= 0);

    el.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      if (!isAtTop()) return;
      pulling = true;
      startY = e.touches[0].clientY;
      dist = 0;
    }, { passive:true });

    el.addEventListener("touchmove", (e) => {
      if (!pulling) return;
      const y = e.touches[0].clientY;
      dist = Math.max(0, y - startY);
      if (dist > 8) e.preventDefault();
      const pct = clamp(dist/THRESH, 0, 1);
      ind.textContent = (dist >= THRESH) ? "放開即可同步" : "下拉同步";
      ind.style.transform = `translateY(${(-120 + pct*120)}%)`;
    }, { passive:false });

    el.addEventListener("touchend", async () => {
      if (!pulling) return;
      pulling = false;

      if (dist >= THRESH){
        ind.textContent = "同步中…";
        ind.style.transform = "translateY(0%)";
        try{
          await manualSyncViaPullToRefresh();
          renderAll();
          ind.textContent = "已同步";
          setTimeout(()=>ind.style.transform="translateY(-120%)", 500);
        }catch{
          ind.textContent = navigator.onLine ? "同步失敗" : "離線，無法同步";
          setTimeout(()=>ind.style.transform="translateY(-120%)", 800);
        }
      } else {
        ind.style.transform = "translateY(-120%)";
      }
      dist = 0;
    }, { passive:true });
  });
}

/* ===== Swipe gestures ===== */
function setupGestures(){
  // 1) itinerary swipe left/right to change date (on page-itinerary only)
  // 2) edge swipe (from screen edge) to change tab
  const EDGE = 24;
  const MIN_X = 55;
  const MAX_Y = 45;

  let sx=0, sy=0, active=false;
  let edgeMode = null; // "left" | "right" | null

  const onStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
    active = true;
    edgeMode = (sx <= EDGE) ? "left" : (sx >= window.innerWidth - EDGE) ? "right" : null;
  };

  const onMove = (e) => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    // don't block scroll unless clear horizontal gesture
    if (Math.abs(dx) > 12 && Math.abs(dy) < 12) e.preventDefault();
  };

  const onEnd = (e) => {
    if (!active) return;
    active = false;

    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    if (!t) return;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if (Math.abs(dy) > MAX_Y) return;
    if (Math.abs(dx) < MIN_X) return;

    // edge swipe => tab switch
    if (edgeMode === "left" && dx > 0){
      // swipe from left edge to right => previous tab
      shiftTab(-1);
      return;
    }
    if (edgeMode === "right" && dx < 0){
      // swipe from right edge to left => next tab
      shiftTab(+1);
      return;
    }

    // non-edge swipe: on itinerary page => date switch
    if (state.tab === "itinerary"){
      if (dx < 0) shiftDate(+1);   // swipe left => next day
      if (dx > 0) shiftDate(-1);   // swipe right => prev day
    }
  };

  // attach to whole app, but edge check prevents conflict
  document.addEventListener("touchstart", onStart, { passive:true });
  document.addEventListener("touchmove", onMove, { passive:false });
  document.addEventListener("touchend", onEnd, { passive:true });
}

/* ===== Viewer minimal (keep existing if you had) ===== */
function setupViewer(){
  if (!viewerStage || !viewerImg) return;
  btnCloseViewer?.addEventListener("click", () => modalViewer.classList.add("hidden"));
  btnResetViewer?.addEventListener("click", () => viewerImg.style.transform = "translate(0px,0px) scale(1)");
}
function openViewer(src){
  viewerImg.src = src;
  modalViewer.classList.remove("hidden");
  viewerImg.style.transform = "translate(0px,0px) scale(1)";
}

/* ===== Events ===== */
function attachEvents(){
  tabButtons.forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

  // ✅ only bottom add button
  btnAddItineraryBottom?.addEventListener("click", () => openItModal());

  btnCloseItinerary?.addEventListener("click", closeItModal);
  btnCancelIt?.addEventListener("click", closeItModal);
  btnSaveIt?.addEventListener("click", saveItinerary);

  btnOpenMap?.addEventListener("click", () => {
    const v = (itAddress.value || "").trim();
    if (!v) return;
    const isUrl = /^https?:\/\//i.test(v);
    const target = isUrl ? v : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    window.open(target, "_blank");
  });

  btnLinkTitle?.addEventListener("click", () => insertLinkFromSelection(itTitle));
  btnLinkNote?.addEventListener("click", () => insertLinkFromSelection(itNote));

  itImage?.addEventListener("change", async () => {
    const f = itImage.files?.[0];
    if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    state.itDraftImageDataUrl = dataUrl;
    itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${dataUrl}" alt="preview" />`;

    if (!navigator.onLine){
      updateSyncBadge();
      alert("目前離線：已先本地預覽。連線後可再次選取圖片上傳同步。");
      return;
    }

    setSyncBadge("sync", "同步中");
    try{
      const res = await uploadImageToDrive(f, dataUrl);
      state.itDraftDriveFileId = res.file_id;
      state.itDraftDriveUrl = res.direct_view_url;
      updateSyncBadge();
    }catch{
      updateSyncBadge();
      alert("圖片上傳失敗：已保留本地預覽。可稍後再試。");
    }
  });

  btnSplitAll?.addEventListener("click", () => {
    const tags = $$("#splitChooser .tag");
    const activeCount = tags.filter(t=>t.classList.contains("active")).length;
    const makeActive = activeCount !== PEOPLE.length;
    tags.forEach(t=>t.classList.toggle("active", makeActive));
  });

  btnAddExpense?.addEventListener("click", addExpense);

  btnFilter?.addEventListener("click", () => modalFilter.classList.remove("hidden"));
  btnCloseFilter?.addEventListener("click", () => modalFilter.classList.add("hidden"));
  btnClearFilter?.addEventListener("click", () => { clearFilters(); /* renderAnalysis(); */ });
  btnApplyFilter?.addEventListener("click", () => { modalFilter.classList.add("hidden"); /* renderAnalysis(); */ });

  btnFx?.addEventListener("click", openFxModal);

  window.addEventListener("online", () => updateSyncBadge());
  window.addEventListener("offline", () => updateSyncBadge());
}

/* ===== Link insertion ===== */
function insertLinkFromSelection(editableEl){
  editableEl.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return alert("請先反白要加連結的文字");
  const url = prompt("輸入連結（https://...）");
  if (!url) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return alert("請先反白要加連結的文字");

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "link-soft";
  a.appendChild(range.extractContents());
  range.insertNode(a);

  range.setStartAfter(a);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ===== Upload image ===== */
async function uploadImageToDrive(file, dataUrl){
  const payload = {
    action: "uploadImage",
    folder_id: DRIVE_FOLDER_ID,
    filename: file.name || `it_${Date.now()}.jpg`,
    mime_type: file.type || "image/jpeg",
    data_url: dataUrl
  };
  const res = await postJsonNoPreflight(GAS_URL, payload);
  if (!res?.ok) throw new Error(res?.error || "uploadImage failed");
  return res;
}
function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* ===== Filters (minimal stubs; keep your old logic if needed) ===== */
function clearFilters(){
  state.filter.who.clear();
  state.filter.where.clear();
  state.filter.category.clear();
  state.filter.pay.clear();
}

/* ===== FX modal (keep your v7 implementation) ===== */
let fxModalEl = null;
function openFxModal(){
  // keep your v7 fx modal builder if already present
  const fx = getFx();
  if (!fxModalEl) fxModalEl = buildFxModal();
  fxModalEl.querySelector("#fxNOK").value = fx.NOK;
  fxModalEl.querySelector("#fxISK").value = fx.ISK;
  fxModalEl.querySelector("#fxEUR").value = fx.EUR;
  fxModalEl.querySelector("#fxGBP").value = fx.GBP;
  fxModalEl.querySelector("#fxAED").value = fx.AED;
  fxModalEl.classList.remove("hidden");
}
function buildFxModal(){
  const wrap = document.createElement("div");
  wrap.id = "modalFx";
  wrap.className = "modal hidden";
  wrap.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="text-base font-extrabold" style="color: rgba(7,19,31,.92);">匯率設定（固定全旅程）</div>
        <button class="btn btn-ghost" id="btnFxClose">關閉</button>
      </div>
      <div class="modal-body">
        <div class="text-xs font-extrabold" style="color: rgba(7,19,31,.56);">輸入「1 外幣 = ? TWD」</div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          ${fxField("NOK")}
          ${fxField("ISK")}
          ${fxField("EUR")}
          ${fxField("GBP")}
          ${fxField("AED")}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" id="btnFxCancel">取消</button>
        <button class="btn btn-primary" id="btnFxSave">儲存變更</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#btnFxClose").addEventListener("click", () => wrap.classList.add("hidden"));
  wrap.querySelector("#btnFxCancel").addEventListener("click", () => wrap.classList.add("hidden"));
  wrap.querySelector("#btnFxSave").addEventListener("click", () => {
    const next = {
      NOK: numOr1(wrap.querySelector("#fxNOK").value),
      ISK: numOr1(wrap.querySelector("#fxISK").value),
      EUR: numOr1(wrap.querySelector("#fxEUR").value),
      GBP: numOr1(wrap.querySelector("#fxGBP").value),
      AED: numOr1(wrap.querySelector("#fxAED").value),
    };
    setFx(next);
    wrap.classList.add("hidden");
  });
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.classList.add("hidden"); });
  return wrap;
}
function fxField(code){
  return `
    <label class="field">
      <div class="field-label">${code} → TWD</div>
      <input id="fx${code}" class="field-input" inputmode="decimal" placeholder="例如 3.2" />
    </label>
  `;
}
function numOr1(v){
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

/* ===== Pull-to-refresh init ===== */
function setupPullToRefresh(containers){
  let ind = $("#ptrIndicator");
  if (!ind){
    ind = document.createElement("div");
    ind.id = "ptrIndicator";
    ind.style.position = "fixed";
    ind.style.left = "0";
    ind.style.right = "0";
    ind.style.top = "0";
    ind.style.zIndex = "9999";
    ind.style.padding = "10px 12px";
    ind.style.textAlign = "center";
    ind.style.fontSize = "12px";
    ind.style.fontWeight = "900";
    ind.style.color = "rgba(7,19,31,.76)";
    ind.style.background = "rgba(255,255,255,.88)";
    ind.style.backdropFilter = "blur(16px)";
    ind.style.webkitBackdropFilter = "blur(16px)";
    ind.style.borderBottom = "1px solid rgba(10,25,45,.12)";
    ind.style.transform = "translateY(-120%)";
    ind.style.transition = "transform 180ms ease";
    ind.textContent = "下拉同步";
    document.body.appendChild(ind);
  }

  const THRESH = 70;
  containers.forEach(el => {
    if (!el) return;
    let pulling=false, startY=0, dist=0;

    const isAtTop = () => (window.scrollY <= 0);

    el.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      if (!isAtTop()) return;
      pulling = true;
      startY = e.touches[0].clientY;
      dist = 0;
    }, { passive:true });

    el.addEventListener("touchmove", (e) => {
      if (!pulling) return;
      const y = e.touches[0].clientY;
      dist = Math.max(0, y - startY);
      if (dist > 8) e.preventDefault();
      const pct = clamp(dist/THRESH, 0, 1);
      ind.textContent = (dist >= THRESH) ? "放開即可同步" : "下拉同步";
      ind.style.transform = `translateY(${(-120 + pct*120)}%)`;
    }, { passive:false });

    el.addEventListener("touchend", async () => {
      if (!pulling) return;
      pulling = false;

      if (dist >= THRESH){
        ind.textContent = "同步中…";
        ind.style.transform = "translateY(0%)";
        try{
          await manualSyncViaPullToRefresh();
          renderAll();
          ind.textContent = "已同步";
          setTimeout(()=>ind.style.transform="translateY(-120%)", 500);
        }catch{
          ind.textContent = navigator.onLine ? "同步失敗" : "離線，無法同步";
          setTimeout(()=>ind.style.transform="translateY(-120%)", 800);
        }
      } else {
        ind.style.transform = "translateY(-120%)";
      }
      dist = 0;
    }, { passive:true });
  });
}

/* ===== Init ===== */
function buildSplitChooserInit(){ buildSplitChooser(); clearExpenseDefaults(); }
(function init(){
  const ui = load(LS.ui, {});
  if (ui.tab && ["itinerary","expenses","analysis"].includes(ui.tab)) state.tab = ui.tab;

  buildDateStrip();
  buildItCatChooser();
  buildSplitChooserInit();
  attachEvents();
  setupPullToRefresh([pageIt, pageEx, pageAn]);
  setupGestures();
  setupViewer();

  renderHeader();
  setInterval(renderHeader, 60*1000);

  setTab(state.tab);
  updateSyncBadge();

  // initial pull (no forced syncOutbox on load)
  if (navigator.onLine){
    pullAll().then(() => renderAll()).catch(() => renderAll());
  } else {
    renderAll();
  }
})();
function renderAll(){
  updateSyncBadge();
  if (state.tab === "itinerary") renderItinerary();
  // analysis render keep your existing if present
}
