/* =========================================================
 * app.js (v5)
 * Fixes:
 * 1) Itinerary time from Sheets (fraction/date/string) -> HH:MM
 * 2) Edit Expense modal keeps category/payment (normalize dashes)
 * 3) Expense "Category is number" (column swapped legacy) auto-fix on pull
 * 4) Itinerary cards tinted by category
 * 5) Expense tags per exact category (breakfast/lunch/flight/etc)
 * 6) Pie by EXP_CATEGORIES (each category slice with diverse colors)
 * 7) Analysis budget: remain big, spent small, bar, mom line small; hide "只計算..."
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
const PAY = ["現金","信用卡－國泰","信用卡–永豐","信用卡–元大","信用卡-永豐","信用卡-元大"]; // include legacy hyphen
const IT_CATEGORIES = ["景點","飲食","交通","住宿","其他"];

const LS = {
  itinerary: "tripapp_itinerary_v7",
  expenses:  "tripapp_expenses_v7",
  fx:        "tripapp_fx_global_v1",
  outbox:    "tripapp_outbox_v7",
  ui:        "tripapp_ui_v4"
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
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return fmtDate(new Date(t));
    // also handle M/D/YYYY ...
    const md = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (md){
      const mm = String(md[1]).padStart(2,"0");
      const dd = String(md[2]).padStart(2,"0");
      return `${md[3]}-${mm}-${dd}`;
    }
    return v;
  }
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) return fmtDate(v);
  try{
    const t = Date.parse(String(v));
    if (!Number.isNaN(t)) return fmtDate(new Date(t));
  }catch{}
  return String(v);
}

/* ✅ Fix #1: Time normalization */
function normalizeTime(v){
  if (v === null || v === undefined || v === "") return "";
  // Date object (time-only from Sheets sometimes becomes Date 1899/12/30...)
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
    const hh = String(v.getHours()).padStart(2,"0");
    const mm = String(v.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  // number (fraction of day)
  if (typeof v === "number" && Number.isFinite(v)){
    // typical: 0.0208333 = 00:30
    const totalMin = Math.round(v * 24 * 60);
    const hh = String(Math.floor(totalMin/60) % 24).padStart(2,"0");
    const mm = String(totalMin % 60).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  // string
  const s = String(v).trim();
  if (!s) return "";
  // if looks like "0:30" or "5:15"
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m){
    const hh = String(Number(m[1])).padStart(2,"0");
    const mm = String(Number(m[2])).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  // if it's numeric in string
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

/* ===== Category styling ===== */
function itCardClass(cat){
  return ({
    "景點":"it-sight",
    "飲食":"it-food",
    "交通":"it-traffic",
    "住宿":"it-stay",
    "其他":"it-other",
  })[cat] || "it-other";
}
function itTagClass(cat){
  return ({
    "景點":"tag-it-sight",
    "飲食":"tag-it-food",
    "交通":"tag-it-traffic",
    "住宿":"tag-it-stay",
    "其他":"tag-it-other",
  })[cat] || "tag-it-other";
}

/* ✅ Fix #8: expense tag by exact category (not numbers) */
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

/* ===== FX ===== */
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
  const amt = Number(e.amount || 0);
  const cur = normalizeCurrency(e.currency || "TWD");
  if (cur === "TWD") return Math.round(amt);
  const rate = Number(fx[cur] || 1);
  return Math.round(amt * rate);
}
function sumTwd(items, fx){
  return Math.round(items.reduce((s,e)=>s + toTwd(e, fx), 0));
}

/* ===== DOM ===== */
const elTripDay = $("#tripDayLabel");
const elToday = $("#todayLabel");
const elSync = $("#syncStatus");
const btnForceSync = $("#btnForceSync");

const tabButtons = $$(".tab");
const pageIt = $("#page-itinerary");
const pageEx = $("#page-expenses");
const pageAn = $("#page-analysis");

const dateStrip = $("#dateStrip");
const selectedDateLabel = $("#selectedDateLabel");
const selectedDayIndexLabel = $("#selectedDayIndexLabel");

const itineraryList = $("#itineraryList");
const btnAddItinerary = $("#btnAddItinerary");
const btnAddItineraryBottom = $("#btnAddItineraryBottom");

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

const expWho = $("#expWho");
const expWhere = $("#expWhere");
const expCategory = $("#expCategory");
const expPay = $("#expPay");
const expCurrency = $("#expCurrency");
const expAmount = $("#expAmount");
const expTitle = $("#expTitle");
const expNote = $("#expNote");
const btnAddExpense = $("#btnAddExpense");
const btnSplitAll = $("#btnSplitAll");
const splitChooser = $("#splitChooser");

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
  const box = load(LS.outbox, []);
  const hasPending = box.length > 0;

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

/* ===== Tabs ===== */
function setTab(tab){
  state.tab = tab;
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  pageIt.classList.toggle("hidden", tab !== "itinerary");
  pageEx.classList.toggle("hidden", tab !== "expenses");
  pageAn.classList.toggle("hidden", tab !== "analysis");
  save(LS.ui, { ...(load(LS.ui, {})), tab });
  if (tab === "analysis") renderAnalysis();
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
    maybeAutoSync();
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
  maybeAutoSync();
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
    itineraryList.innerHTML = `<div class="card p-4 text-sm" style="color: rgba(6,16,25,.62);">今天還沒有行程。可以按「新增行程」。</div>`;
    return;
  }

  items.forEach(it => {
    const time = (it.start || it.end) ? `${it.start||""}–${it.end||""}` : "";
    const imgSrc = it.image || it.imageDataUrl || "";
    const pendingOffline = (!navigator.onLine) && state.pending.Itinerary.has(it.id);

    const card = document.createElement("div");
    card.className = `card p-4 it-card ${itCardClass(it.category)}`; // ✅ full tinted
    if (pendingOffline) card.classList.add("pending-card");

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="tag ${itTagClass(it.category)}">${escapeHtml(it.category)}</span>
            <span class="text-xs font-extrabold" style="color: rgba(6,16,25,.66);">${escapeHtml(time)}</span>
            ${pendingOffline ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
          </div>
          <div class="mt-2 text-base font-semibold leading-snug break-words" style="color: rgba(6,16,25,.92);">${it.title || ""}</div>
          ${it.location ? `<div class="mt-2 text-xs break-words" style="color: rgba(6,16,25,.66);">${escapeHtml(it.location)}</div>` : ""}
          ${it.link ? `<div class="mt-2 text-xs"><a href="${escapeHtml(it.link)}" target="_blank" rel="noopener" class="link-soft">開啟連結</a></div>` : ""}
          ${it.note ? `<div class="mt-2 text-sm break-words" style="color: rgba(6,16,25,.78);">${it.note}</div>` : ""}
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

/* ===== Expenses input only ===== */
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

  expWho.addEventListener("change", () => setSplitDefault(expWho.value));
  setSplitDefault(expWho.value || PEOPLE[0]);
}
function setSplitDefault(who){
  $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", b.dataset.value === who));
}
function getSplitSelected(){
  return $$("#splitChooser .tag.active").map(b => b.dataset.value);
}

function toSheetExpense(e){
  return {
    Date: normalizeDateKey(e.date),
    Payer: e.payer,
    Location: e.location,
    Category: e.category,
    Item: e.item,
    Payment: e.payment,
    Currency: normalizeCurrency(e.currency),
    Amount: e.amount,
    Involved: e.involved,
    Note: e.note || "",
    ID: e.id
  };
}

function normalizePayment(p){
  // normalize dash variants so select won't "disappear"
  let s = String(p||"").trim();
  s = s.replaceAll("－","-").replaceAll("–","-");
  // convert back to one of options if possible
  if (s === "信用卡-永豐") return "信用卡–永豐";
  if (s === "信用卡-元大") return "信用卡–元大";
  if (s === "信用卡-國泰") return "信用卡－國泰";
  return p;
}

function addExpense(){
  const who = expWho.value || PEOPLE[0];
  const where = expWhere.value || WHERE[0];
  const category = expCategory.value || EXP_CATEGORIES[0];
  const pay = expPay.value || PAY[0];
  const currency = normalizeCurrency(expCurrency.value || "TWD");
  const amount = Number(expAmount.value);
  const title = (expTitle.value || "").trim();
  const note = (expNote.value || "").trim();
  const split = getSplitSelected();

  if (!title) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!split.length) return alert("請選擇分攤人員");

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
    involved: split.join(","),
    note
  };

  const all = load(LS.expenses, []);
  all.push(row);
  save(LS.expenses, all);

  queueOutbox({ op:"upsert", table:"Expenses", row: toSheetExpense(row) });
  maybeAutoSync();

  expAmount.value = "";
  expTitle.value = "";
  expNote.value = "";
  setSplitDefault(who);

  updateSyncBadge();
}

/* ===== Analysis ===== */
function computePersonShareTwd(person, items, fx){
  let total = 0;
  for (const e of items){
    const twd = toTwd(e, fx);
    const inv = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
    if (!inv.length) continue;
    if (inv.includes(person)) total += twd / inv.length;
  }
  return Math.round(total);
}

/* ✅ Fix #6: pie colors diverse & per EXACT category */
function categoryColorByName(cat){
  const palette = [
    "rgba(74,159,217,.90)","rgba(62,154,114,.90)","rgba(211,154,75,.90)",
    "rgba(111,109,204,.90)","rgba(200,111,134,.90)","rgba(85,103,118,.86)",
    "rgba(120,200,190,.90)","rgba(230,170,110,.90)","rgba(170,190,230,.90)",
    "rgba(170,220,190,.90)","rgba(240,200,210,.90)","rgba(210,210,240,.90)",
    "rgba(190,220,255,.90)"
  ];
  // stable hash
  let h=0;
  for (const ch of String(cat)) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

function renderAnalysis(){
  updateSyncBadge();
  const fx = getFx();
  const all = load(LS.expenses, []).map(x => ({
    ...x,
    date: normalizeDateKey(x.date),
    currency: normalizeCurrency(x.currency),
    payment: normalizePayment(x.payment),
  }));

  const filtered = all.filter(e => {
    const f = state.filter;
    if (f.who.size && !f.who.has(e.payer)) return false;
    if (f.where.size && !f.where.has(e.location)) return false;
    if (f.category.size && !f.category.has(e.category)) return false;
    if (f.pay.size && !f.pay.has(e.payment)) return false;
    return true;
  });

  // ✅ Fix #7: budget readability + hide "只計算..." line
  const jqTy = filtered.filter(e => e.payer === "家齊" || e.payer === "亭穎");
  const jqTyTotal = sumTwd(jqTy, fx);
  const remain = Math.max(0, BUDGET_JQ_TY - jqTyTotal);

  budgetRemain.textContent = `NT$ ${fmtMoney(remain)}`;            // big (already in HTML)
  budgetRemain.style.fontSize = "28px";
  budgetRemain.style.fontWeight = "900";

  budgetSpent.textContent = `NT$ ${fmtMoney(jqTyTotal)}`;          // small
  budgetSpent.parentElement.style.fontSize = "14px";
  budgetSpent.parentElement.style.fontWeight = "800";

  budgetBar.style.width = `${clamp(BUDGET_JQ_TY ? (jqTyTotal/BUDGET_JQ_TY) : 0, 0, 1) * 100}%`;

  const momShare = computePersonShareTwd("媽媽", filtered, fx);
  momLine.textContent = `媽媽支出與分攤：NT$ ${fmtMoney(momShare)}`;
  momLine.style.color = "rgba(6,16,25,.62)";
  momLine.style.fontWeight = "800";

  // hide the "只計算..." text in your HTML (if exists)
  const budgetCard = budgetRemain?.closest(".card");
  if (budgetCard){
    const rightHint = budgetCard.querySelector(".text-right.text-xs");
    if (rightHint) rightHint.style.display = "none";
  }

  // ✅ Pie: each EXP_CATEGORIES slice (not merged buckets)
  const catMap = new Map(EXP_CATEGORIES.map(c=>[c,0]));
  for (const e of filtered){
    const c = EXP_CATEGORIES.includes(e.category) ? e.category : "其他";
    catMap.set(c, (catMap.get(c) || 0) + toTwd(e, fx));
  }
  const labels = Array.from(catMap.entries()).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  const values = labels.map(k => catMap.get(k));
  const colors = labels.map(k => categoryColorByName(k));
  renderPie(labels, values, colors);

  // detail cards
  analysisExpenseList.innerHTML = "";
  const items = filtered.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""));

  if (!items.length){
    analysisExpenseList.innerHTML = `<div class="card p-4 text-sm" style="color: rgba(6,16,25,.62);">此篩選條件下沒有消費。</div>`;
  } else {
    items.forEach(e => {
      const twd = toTwd(e, fx);
      const catLabel = EXP_CATEGORIES.includes(e.category) ? e.category : "其他";
      const pendingOffline = (!navigator.onLine) && state.pending.Expenses.has(e.id);

      const originalLine = (normalizeCurrency(e.currency) !== "TWD")
        ? `<div class="text-xs font-extrabold" style="color: rgba(6,16,25,.56);">${escapeHtml(e.currency)} ${fmtMoney(e.amount)}（原幣）</div>`
        : ``;

      const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean).join("、");

      const card = document.createElement("div");
      card.className = "card p-4";
      if (pendingOffline) card.classList.add("pending-card");

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="tag ${expTagClassExact(catLabel)}">${escapeHtml(catLabel)}</span>
              <div class="text-base font-semibold break-words" style="color: rgba(6,16,25,.92);">${escapeHtml(e.item)}</div>
              ${pendingOffline ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
            </div>

            <div class="mt-1 text-sm font-semibold" style="color: rgba(6,16,25,.62);">
              ${escapeHtml(e.payer)} • ${escapeHtml(e.location)} • ${escapeHtml(e.payment)} • ${escapeHtml(e.date)}
            </div>

            <div class="mt-2 text-2xl font-extrabold" style="color: rgba(6,16,25,.92);">NT$ ${fmtMoney(twd)}</div>
            ${originalLine}

            ${e.note ? `<div class="mt-2 text-sm break-words" style="color: rgba(6,16,25,.78);">${escapeHtml(e.note)}</div>` : ""}
            <div class="mt-2 text-xs font-extrabold" style="color: rgba(6,16,25,.56);">分攤：${escapeHtml(splits)}</div>
          </div>

          <div class="shrink-0 flex flex-col gap-2">
            <button class="btn btn-ghost text-sm" data-act="edit">編輯</button>
            <button class="btn btn-ghost text-sm" data-act="del">刪除</button>
          </div>
        </div>
      `;

      card.querySelector('[data-act="edit"]').addEventListener("click", () => openExpenseEditModal(e.id));
      card.querySelector('[data-act="del"]').addEventListener("click", () => deleteExpense(e.id));

      analysisExpenseList.appendChild(card);
    });
  }

  settlement.textContent = buildSettlement(filtered, fx);
}

/* ===== Pie ===== */
function renderPie(labels, values, colors){
  if (!pieCanvas || !window.Chart) return;
  const ctx = pieCanvas.getContext("2d");
  if (state.pieChart) state.pieChart.destroy();

  state.pieChart = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 1 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (item) => `${item.label}: NT$ ${fmtMoney(item.raw || 0)}` } }
      }
    }
  });
}

/* ===== Settlement ===== */
function buildSettlement(items, fx){
  const paid = new Map(PEOPLE.map(p=>[p,0]));
  const share = new Map(PEOPLE.map(p=>[p,0]));

  for (const e of items){
    const twd = toTwd(e, fx);
    paid.set(e.payer, (paid.get(e.payer)||0) + twd);

    const inv = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
    if (!inv.length) continue;
    const each = twd / inv.length;
    for (const p of inv) share.set(p, (share.get(p)||0) + each);
  }

  const net = new Map();
  for (const p of PEOPLE) net.set(p, (share.get(p)||0) - (paid.get(p)||0));

  const debtors = [];
  const creditors = [];
  for (const [p,n] of net.entries()){
    if (n > 1) debtors.push([p,n]);
    if (n < -1) creditors.push([p,-n]);
  }
  debtors.sort((a,b)=>b[1]-a[1]);
  creditors.sort((a,b)=>b[1]-a[1]);

  const lines = [];
  let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const pay = Math.min(debtors[i][1], creditors[j][1]);
    lines.push(`${debtors[i][0]} → ${creditors[j][0]}：NT$ ${fmtMoney(Math.round(pay))}`);
    debtors[i][1] -= pay;
    creditors[j][1] -= pay;
    if (debtors[i][1] <= 1) i++;
    if (creditors[j][1] <= 1) j++;
  }
  return lines.length ? lines.join("\n") : "目前不需要分帳結算。";
}

/* ===== Filter modal ===== */
function buildFilterModal(){
  buildFilterBox(filterWhoBox, PEOPLE, state.filter.who);
  buildFilterBox(filterWhereBox, WHERE, state.filter.where);
  buildFilterBox(filterCategoryBox, EXP_CATEGORIES, state.filter.category);
  buildFilterBox(filterPayBox, PAY, state.filter.pay);
  renderFilterChips();
}
function buildFilterBox(boxEl, options, setRef){
  if (!boxEl) return;
  boxEl.innerHTML = "";
  options.forEach(v => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = v;
    b.classList.toggle("active", setRef.has(v));
    b.addEventListener("click", () => {
      if (setRef.has(v)) setRef.delete(v); else setRef.add(v);
      b.classList.toggle("active", setRef.has(v));
      renderFilterChips();
    });
    boxEl.appendChild(b);
  });
}
function renderFilterChips(){
  if (!filterChips) return;
  const chips = [];
  for (const v of state.filter.who) chips.push({k:"who", v});
  for (const v of state.filter.where) chips.push({k:"where", v});
  for (const v of state.filter.category) chips.push({k:"category", v});
  for (const v of state.filter.pay) chips.push({k:"pay", v});

  if (!chips.length){
    filterChips.innerHTML = `<span class="text-xs font-extrabold" style="color: rgba(6,16,25,.56);">未套用篩選</span>`;
    return;
  }

  filterChips.innerHTML = "";
  chips.forEach(c => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml(c.v)} <span class="x">×</span>`;
    chip.addEventListener("click", () => {
      state.filter[c.k].delete(c.v);
      buildFilterModal();
      renderAnalysis();
    });
    filterChips.appendChild(chip);
  });
}
function openFilterModal(){ modalFilter.classList.remove("hidden"); }
function closeFilterModal(){ modalFilter.classList.add("hidden"); }
function clearFilters(){
  state.filter.who.clear();
  state.filter.where.clear();
  state.filter.category.clear();
  state.filter.pay.clear();
  buildFilterModal();
}

/* ===== FX modal ===== */
let fxModalEl = null;
function openFxModal(){
  const fx = getFx();
  if (!fxModalEl) fxModalEl = buildFxModal();
  fxModalEl.querySelector("#fxNOK").value = fx.NOK;
  fxModalEl.querySelector("#fxISK").value = fx.ISK;
  fxModalEl.querySelector("#fxEUR").value = fx.EUR;
  fxModalEl.querySelector("#fxGBP").value = fx.GBP;
  fxModalEl.querySelector("#fxAED").value = fx.AED;
  fxModalEl.classList.remove("hidden");
}
function closeFxModal(){ fxModalEl?.classList.add("hidden"); }
function buildFxModal(){
  const wrap = document.createElement("div");
  wrap.id = "modalFx";
  wrap.className = "modal hidden";
  wrap.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="text-base font-extrabold" style="color: rgba(6,16,25,.92);">匯率設定（固定全旅程）</div>
        <button class="btn btn-ghost" id="btnFxClose">關閉</button>
      </div>
      <div class="modal-body">
        <div class="text-xs font-extrabold" style="color: rgba(6,16,25,.56);">輸入「1 外幣 = ? TWD」</div>
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
  wrap.querySelector("#btnFxClose").addEventListener("click", closeFxModal);
  wrap.querySelector("#btnFxCancel").addEventListener("click", closeFxModal);
  wrap.querySelector("#btnFxSave").addEventListener("click", () => {
    const next = {
      NOK: numOr1(wrap.querySelector("#fxNOK").value),
      ISK: numOr1(wrap.querySelector("#fxISK").value),
      EUR: numOr1(wrap.querySelector("#fxEUR").value),
      GBP: numOr1(wrap.querySelector("#fxGBP").value),
      AED: numOr1(wrap.querySelector("#fxAED").value),
    };
    setFx(next);
    closeFxModal();
    if (state.tab === "analysis") renderAnalysis();
  });
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeFxModal(); });
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

/* ===== Expense Edit modal (Fix #5: involved buttons) ===== */
let expEditModalEl = null;
let editingExpenseId = null;

function openExpenseEditModal(id){
  const all = load(LS.expenses, []);
  const e = all.find(x => x.id === id);
  if (!e) return;

  editingExpenseId = id;
  if (!expEditModalEl) expEditModalEl = buildExpenseEditModal();
  fillExpenseEditModal(e);
  expEditModalEl.classList.remove("hidden");
}
function closeExpenseEditModal(){
  expEditModalEl?.classList.add("hidden");
  editingExpenseId = null;
}
function buildExpenseEditModal(){
  const wrap = document.createElement("div");
  wrap.id = "modalExpenseEdit";
  wrap.className = "modal hidden";
  wrap.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="text-base font-extrabold" style="color: rgba(6,16,25,.92);">編輯消費明細</div>
        <button class="btn btn-ghost" id="btnExpEditClose">關閉</button>
      </div>
      <div class="modal-body">
        <div class="grid grid-cols-2 gap-3">
          ${selField("expEWho","你是誰", PEOPLE)}
          ${selField("expEWhere","在哪消費", WHERE)}

          <label class="field col-span-2">
            <div class="field-label">消費類別</div>
            <select id="expECategory" class="field-input">
              ${EXP_CATEGORIES.map(x=>`<option>${escapeHtml(x)}</option>`).join("")}
            </select>
          </label>

          ${selField("expEPay","付款方式", PAY)}

          <label class="field">
            <div class="field-label">幣別</div>
            <select id="expECurrency" class="field-input">
              <option value="TWD">TWD</option>
              <option value="NOK">NOK</option>
              <option value="ISK">ISK</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AED">AED</option>
            </select>
          </label>

          <label class="field">
            <div class="field-label">金額</div>
            <input id="expEAmount" class="field-input" inputmode="decimal" />
          </label>

          <label class="field col-span-2">
            <div class="field-label">消費名稱</div>
            <input id="expEItem" class="field-input" />
          </label>

          <label class="field col-span-2">
            <div class="field-label">備註（選填）</div>
            <input id="expENote" class="field-input" />
          </label>

          <div class="col-span-2">
            <div class="flex items-center justify-between">
              <div class="field-label">分攤（按鈕點選）</div>
              <button class="btn btn-ghost text-sm" id="btnInvAll">全選</button>
            </div>
            <div class="mt-2 flex flex-wrap gap-2" id="invChooser"></div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" id="btnExpEditCancel">取消編輯</button>
        <button class="btn btn-primary" id="btnExpEditSave">儲存變更</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  wrap.querySelector("#btnExpEditClose").addEventListener("click", closeExpenseEditModal);
  wrap.querySelector("#btnExpEditCancel").addEventListener("click", closeExpenseEditModal);

  wrap.querySelector("#btnInvAll").addEventListener("click", () => {
    const tags = $$("#invChooser .tag");
    const activeCount = tags.filter(t=>t.classList.contains("active")).length;
    const makeActive = activeCount !== PEOPLE.length;
    tags.forEach(t=>t.classList.toggle("active", makeActive));
  });

  wrap.querySelector("#btnExpEditSave").addEventListener("click", () => saveExpenseEditFromModal());
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeExpenseEditModal(); });

  // build inv chooser
  const invBox = wrap.querySelector("#invChooser");
  invBox.innerHTML = "";
  PEOPLE.forEach(p => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = p;
    b.dataset.value = p;
    b.addEventListener("click", ()=> b.classList.toggle("active"));
    invBox.appendChild(b);
  });

  return wrap;
}
function selField(id,label,opts){
  return `
    <label class="field">
      <div class="field-label">${escapeHtml(label)}</div>
      <select id="${id}" class="field-input">
        ${opts.map(x=>`<option>${escapeHtml(x)}</option>`).join("")}
      </select>
    </label>
  `;
}
function fillExpenseEditModal(e){
  expEditModalEl.querySelector("#expEWho").value = e.payer;
  expEditModalEl.querySelector("#expEWhere").value = e.location;
  expEditModalEl.querySelector("#expECategory").value = EXP_CATEGORIES.includes(e.category) ? e.category : "其他";
  expEditModalEl.querySelector("#expEPay").value = normalizePayment(e.payment) || PAY[0];
  expEditModalEl.querySelector("#expECurrency").value = normalizeCurrency(e.currency || "TWD");
  expEditModalEl.querySelector("#expEAmount").value = e.amount;
  expEditModalEl.querySelector("#expEItem").value = e.item;
  expEditModalEl.querySelector("#expENote").value = e.note || "";

  // involved buttons
  const invSet = new Set(String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean));
  $$("#invChooser .tag").forEach(t => t.classList.toggle("active", invSet.has(t.dataset.value)));
}
function saveExpenseEditFromModal(){
  const id = editingExpenseId;
  if (!id) return;

  const who = expEditModalEl.querySelector("#expEWho").value;
  const where = expEditModalEl.querySelector("#expEWhere").value;
  const category = expEditModalEl.querySelector("#expECategory").value;
  const pay = expEditModalEl.querySelector("#expEPay").value;
  const currency = normalizeCurrency(expEditModalEl.querySelector("#expECurrency").value);
  const amount = Number(expEditModalEl.querySelector("#expEAmount").value);
  const item = (expEditModalEl.querySelector("#expEItem").value || "").trim();
  const note = (expEditModalEl.querySelector("#expENote").value || "").trim();
  const involved = $$("#invChooser .tag.active").map(t=>t.dataset.value).join(",");

  if (!item) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!involved) return alert("請選擇分攤人員");

  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  all[idx] = {
    ...all[idx],
    payer: who,
    location: where,
    category,
    payment: pay,
    currency,
    amount,
    item,
    note,
    involved
  };
  save(LS.expenses, all);

  queueOutbox({ op:"upsert", table:"Expenses", row: toSheetExpense(all[idx]) });
  maybeAutoSync();

  closeExpenseEditModal();
  renderAnalysis();
}

/* ===== Delete expense ===== */
function deleteExpense(id){
  const all = load(LS.expenses, []);
  const e = all.find(x => x.id === id);
  if (!e) return;
  if (!confirmDelete(`消費：${e.item}`)) return;

  const idx = all.findIndex(x => x.id === id);
  all.splice(idx, 1);
  save(LS.expenses, all);

  queueOutbox({ op:"delete", table:"Expenses", key:{ ID:id }});
  maybeAutoSync();
  renderAnalysis();
}

/* ===== Outbox / sync / pull ===== */
function queueOutbox(op){
  const box = load(LS.outbox, []);
  box.push(op);
  save(LS.outbox, box);
  updateSyncBadge();
}
async function maybeAutoSync(){
  if (!navigator.onLine) return;
  const box = load(LS.outbox, []);
  if (!box.length) return;

  setSyncBadge("sync", "同步中");
  try { await syncNow(); }
  catch { setSyncBadge("warn", "同步失敗"); }
}
async function syncNow(){
  if (!navigator.onLine){ updateSyncBadge(); return; }
  const box = load(LS.outbox, []);
  if (!box.length){ updateSyncBadge(); return; }

  setSyncBadge("sync", "同步中");
  const payload = { action:"sync", ops: box };
  const res = await postJsonNoPreflight(GAS_URL, payload);
  if (!res?.ok) throw new Error(res?.error || "sync failed");

  await pullAll();
  save(LS.outbox, []);
  updateSyncBadge();
  renderAll();
}
async function pullAll(){
  const url = `${GAS_URL}?action=pull`;
  const res = await fetch(url).then(r => r.json());
  if (!res?.ok || !Array.isArray(res.rows)) throw new Error("pull failed");
  mergePulled(res.rows);
}

/* ✅ Fix #8: legacy swapped columns repair */
function mergePulled(rows){
  const exp = [];
  const it = [];

  for (const item of rows){
    const table = item.table;
    const r = item.row || {};

    if (table === "Expenses"){
      let category = String(r.Category ?? "").trim();
      let amountRaw = r.Amount;

      // attempt parse amount
      let amount = Number(amountRaw);
      const categoryAsNum = Number(category);

      // If Category is numeric and Amount is missing/non-numeric -> swap fix
      if (Number.isFinite(categoryAsNum) && (!Number.isFinite(amount) || amount === 0)){
        // your example: Category=46725, Item=交通（機票）
        amount = categoryAsNum;
        category = String(r.Item ?? "其他").trim();
      }

      // Also: if currency stored as NTD
      const currency = normalizeCurrency(r.Currency ?? "TWD");

      exp.push({
        id: String(r.ID || ""),
        date: normalizeDateKey(r.Date || ""),
        payer: String(r.Payer || ""),
        location: String(r.Location || ""),
        category: EXP_CATEGORIES.includes(category) ? category : "其他",
        item: String(r.Item || ""),
        payment: normalizePayment(String(r.Payment || "")) || "現金",
        currency,
        amount: Number.isFinite(amount) ? amount : 0,
        involved: String(r.Involved || ""),
        note: String(r.Note || "")
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

/* ===== Viewer ===== */
function setupViewer(){
  if (!viewerStage || !viewerImg) return;

  let pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let lastPan = null;

  const apply = () => {
    viewerImg.style.transform = `translate(${state.viewer.tx}px, ${state.viewer.ty}px) scale(${state.viewer.scale})`;
  };
  const reset = () => {
    state.viewer.scale = 1;
    state.viewer.tx = 0;
    state.viewer.ty = 0;
    apply();
  };

  btnResetViewer?.addEventListener("click", reset);
  btnCloseViewer?.addEventListener("click", closeViewer);

  viewerStage.addEventListener("pointerdown", (e) => {
    viewerStage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1){
      lastPan = { x: e.clientX, y: e.clientY, tx: state.viewer.tx, ty: state.viewer.ty };
    }
    if (pointers.size === 2){
      const pts = Array.from(pointers.values());
      pinchStartDist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      pinchStartScale = state.viewer.scale;
    }
  });

  viewerStage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && lastPan){
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      state.viewer.tx = lastPan.tx + dx;
      state.viewer.ty = lastPan.ty + dy;
      apply();
    }
    if (pointers.size === 2){
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      const ratio = dist / Math.max(1, pinchStartDist);
      state.viewer.scale = clamp(pinchStartScale * ratio, 0.5, 6);
      apply();
    }
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) lastPan = null;
    if (pointers.size === 1){
      const pts = Array.from(pointers.values());
      if (pts.length) lastPan = { x: pts[0].x, y: pts[0].y, tx: state.viewer.tx, ty: state.viewer.ty };
    }
  };
  viewerStage.addEventListener("pointerup", endPointer);
  viewerStage.addEventListener("pointercancel", endPointer);

  reset();
}
function openViewer(src){
  viewerImg.src = src;
  modalViewer.classList.remove("hidden");
  state.viewer.scale = 1;
  state.viewer.tx = 0;
  state.viewer.ty = 0;
  viewerImg.style.transform = `translate(0px,0px) scale(1)`;
}
function closeViewer(){ modalViewer.classList.add("hidden"); }

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

/* ===== Network ===== */
async function postJsonNoPreflight(url, payload){
  const res = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* ===== Pull-to-refresh ===== */
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
    ind.style.color = "rgba(6,16,25,.76)";
    ind.style.background = "rgba(255,255,255,.86)";
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
      ind.textContent = (dist >= THRESH) ? "放開即可重新整理" : "下拉重新整理";
      ind.style.transform = `translateY(${(-120 + pct*120)}%)`;
    }, { passive:false });

    el.addEventListener("touchend", async () => {
      if (!pulling) return;
      pulling = false;

      if (dist >= THRESH){
        ind.textContent = "重新整理中…";
        ind.style.transform = "translateY(0%)";
        try{
          if (!navigator.onLine){
            ind.textContent = "目前離線，無法重新整理";
            setTimeout(()=>ind.style.transform="translateY(-120%)", 800);
            return;
          }
          await pullAll();
          renderAll();
          ind.textContent = "已更新";
          setTimeout(()=>ind.style.transform="translateY(-120%)", 500);
        }catch{
          ind.textContent = "更新失敗";
          setTimeout(()=>ind.style.transform="translateY(-120%)", 800);
        }
      } else {
        ind.style.transform = "translateY(-120%)";
      }
      dist = 0;
    }, { passive:true });
  });
}

/* ===== Events ===== */
function attachEvents(){
  tabButtons.forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

  btnAddItinerary?.addEventListener("click", () => openItModal());
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
    const activeCount = $$("#splitChooser .tag.active").length;
    const makeActive = activeCount !== PEOPLE.length;
    $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", makeActive));
  });

  btnAddExpense?.addEventListener("click", addExpense);

  btnForceSync?.addEventListener("click", async () => {
    try { await syncNow(); }
    catch(e){ alert("同步失敗：請稍後再試。"); }
  });

  btnFilter?.addEventListener("click", openFilterModal);
  btnCloseFilter?.addEventListener("click", closeFilterModal);
  btnClearFilter?.addEventListener("click", () => { clearFilters(); renderAnalysis(); });
  btnApplyFilter?.addEventListener("click", () => { closeFilterModal(); renderAnalysis(); });

  btnFx?.addEventListener("click", openFxModal);

  window.addEventListener("online", () => { updateSyncBadge(); maybeAutoSync(); });
  window.addEventListener("offline", () => { updateSyncBadge(); renderAll(); });
}

/* ===== Init ===== */
(function init(){
  const ui = load(LS.ui, {});
  if (ui.tab && ["itinerary","expenses","analysis"].includes(ui.tab)) state.tab = ui.tab;

  buildDateStrip();
  buildItCatChooser();
  buildSplitChooser();
  buildFilterModal();
  attachEvents();
  setupPullToRefresh([pageIt, pageEx, pageAn]);
  setupViewer();

  renderHeader();
  setInterval(renderHeader, 60*1000);

  setTab(state.tab);
  updateSyncBadge();

  if (navigator.onLine){
    pullAll().then(() => renderAll()).catch(() => renderAll());
  } else {
    renderAll();
  }
})();

function renderAll(){
  updateSyncBadge();
  if (state.tab === "itinerary") renderItinerary();
  if (state.tab === "analysis") renderAnalysis();
}
