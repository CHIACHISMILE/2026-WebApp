/* =========================================================
 * 2026 冰島挪威之旅 - app.js (Nordic Apple-like Edition)
 * - Works with your index.html unchanged
 * - Offline outbox + sync/pull to GAS
 * - Date normalization (fix old data not showing)
 * - Analysis: pie by Category (aggregated)
 * - Expenses page: input only, edit/delete ONLY in analysis
 * - Correct currency display: Big = NT$ converted, small = original currency
 * ========================================================= */

// ====================== CONFIG ======================
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
const PAY = ["現金","信用卡－國泰","信用卡–永豐","信用卡–元大"];

const IT_CATEGORIES = ["景點","飲食","交通","住宿","其他"];

// ====================== STORAGE ======================
const LS = {
  itinerary: "tripapp_itinerary_v5",
  expenses:  "tripapp_expenses_v5",
  fx:        "tripapp_fx_v1",
  outbox:    "tripapp_outbox_v5",
  ui:        "tripapp_ui_v2"
};

// ====================== DOM ======================
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const elTripDay = $("#tripDayLabel");
const elToday = $("#todayLabel");
const elSync = $("#syncStatus");
const btnForceSync = $("#btnForceSync");

// Tabs & pages
const tabButtons = $$(".tab");
const pageIt = $("#page-itinerary");
const pageEx = $("#page-expenses");
const pageAn = $("#page-analysis");

// Date strip
const dateStrip = $("#dateStrip");
const selectedDateLabel = $("#selectedDateLabel");
const selectedDayIndexLabel = $("#selectedDayIndexLabel");

// Itinerary list
const itineraryList = $("#itineraryList");
const btnAddItinerary = $("#btnAddItinerary");
const btnAddItineraryBottom = $("#btnAddItineraryBottom");

// Itinerary modal
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

// Expenses input
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

// Analysis
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

// Filter modal
const modalFilter = $("#modalFilter");
const btnCloseFilter = $("#btnCloseFilter");
const btnClearFilter = $("#btnClearFilter");
const btnApplyFilter = $("#btnApplyFilter");
const filterWhoBox = $('[data-filter-group="who"]');
const filterWhereBox = $('[data-filter-group="where"]');
const filterCategoryBox = $('[data-filter-group="category"]');
const filterPayBox = $('[data-filter-group="pay"]');

// Viewer
const modalViewer = $("#modalViewer");
const btnCloseViewer = $("#btnCloseViewer");
const btnResetViewer = $("#btnResetViewer");
const viewerStage = $("#viewerStage");
const viewerImg = $("#viewerImg");

// ====================== UTIL ======================
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
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

/** ✅ normalize anything (Date/ISO/yyyy-mm-dd) into yyyy-mm-dd */
function normalizeDateKey(v){
  if (!v) return "";
  if (typeof v === "string"){
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    // try Date.parse
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return fmtDate(new Date(t));
    return v;
  }
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
    return fmtDate(v);
  }
  // fallback
  try{
    const t = Date.parse(String(v));
    if (!Number.isNaN(t)) return fmtDate(new Date(t));
  }catch{}
  return String(v);
}

// ====================== CATEGORY COLOR TAGS ======================
function itTagClass(cat){
  return ({
    "景點":"tag-it-sight",
    "飲食":"tag-it-food",
    "交通":"tag-it-traffic",
    "住宿":"tag-it-stay",
    "其他":"tag-it-other",
  })[cat] || "tag-it-other";
}

function expBucket(cat){
  if (["早餐","午餐","晚餐","零食"].includes(cat)) return "food";
  if (cat === "住宿") return "stay";
  if (cat.startsWith("交通（")) return "traffic";
  if (["門票"].includes(cat)) return "ticket";
  if (["紀念品"].includes(cat)) return "shop";
  return "other";
}
function expTagClass(cat){
  const b = expBucket(cat);
  return ({
    food:"tag-exp-food",
    stay:"tag-exp-stay",
    traffic:"tag-exp-traffic",
    ticket:"tag-exp-ticket",
    shop:"tag-exp-shop",
    other:"tag-exp-other",
  })[b] || "tag-exp-other";
}

// ====================== STATE ======================
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

  filter: {
    who: new Set(),
    where: new Set(),
    category: new Set(),
    pay: new Set()
  },

  pending: { Expenses: new Set(), Itinerary: new Set() },
  pieChart: null,

  viewer: { scale: 1, tx: 0, ty: 0 }
};

// ====================== SYNC BADGE ======================
function setSyncBadge(mode, text){
  const dotClass = { ok:"dot-ok", sync:"dot-sync", offline:"dot-offline", warn:"dot-wait" }[mode] || "dot-ok";
  if (!elSync) return;
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
    if (hasPending) setSyncBadge("warn", "待上傳");
    else setSyncBadge("offline", "離線");
    return;
  }
  setSyncBadge("ok", "已同步");
}

// ====================== HEADER ======================
function renderHeader(){
  const now = new Date();
  if (elToday) elToday.textContent = `${now.getMonth()+1}/${now.getDate()}（${weekdayZh(now)}）`;

  const todayLocal = parseLocalDate(fmtDate(now));
  if (todayLocal < tripStartD) elTripDay.textContent = `倒數 ${daysBetween(todayLocal, tripStartD)} 日`;
  else if (todayLocal > tripEndD) elTripDay.textContent = `旅行已結束`;
  else elTripDay.textContent = `第 ${tripDayIndexFor(todayLocal)} 日`;
}

// ====================== DATE STRIP ======================
function buildDateStrip(){
  if (!dateStrip) return;
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
  if (selectedDateLabel) selectedDateLabel.textContent = `${d.getMonth()+1}/${d.getDate()}（${weekdayZh(d)}）`;
  if (selectedDayIndexLabel) selectedDayIndexLabel.textContent = `Day ${tripDayIndexFor(d)}`;

  if (scroll){
    const active = $(`.date-chip[data-date="${state.selectedDate}"]`);
    active?.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
  }
  renderItinerary();
}

// ====================== TABS ======================
function setTab(tab){
  state.tab = tab;
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  pageIt?.classList.toggle("hidden", tab !== "itinerary");
  pageEx?.classList.toggle("hidden", tab !== "expenses");
  pageAn?.classList.toggle("hidden", tab !== "analysis");

  save(LS.ui, { ...(load(LS.ui, {})), tab });

  if (tab === "analysis") renderAnalysis();
}

// ====================== ITINERARY ======================
function buildItCatChooser(){
  if (!itCatChooser) return;
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
  modalItinerary?.classList.remove("hidden");

  state.itDraftImageDataUrl = "";
  state.itDraftDriveFileId = "";
  state.itDraftDriveUrl = "";
  state.itDraftLink = "";
  if (itImage) itImage.value = "";
  if (itImagePreview) itImagePreview.innerHTML = "";

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

function closeItModal(){ modalItinerary?.classList.add("hidden"); }

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
  const start = itStart.value || "";
  const end = itEnd.value || "";
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
  if (!confirm("確定刪除這筆行程？")) return;
  const all = load(LS.itinerary, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;
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
    .map(x => ({...x, date: normalizeDateKey(x.date)}))
    .filter(x => x.date === state.selectedDate)
    .sort((a,b) => (a.start||"").localeCompare(b.start||""));

  itineraryList.innerHTML = "";

  if (!items.length){
    itineraryList.innerHTML = `<div class="card p-4 text-sm" style="color: rgba(11,18,32,.62);">今天還沒有行程。可以按「新增行程」。</div>`;
    return;
  }

  items.forEach(it => {
    const time = (it.start || it.end) ? `${it.start||""}–${it.end||""}` : "";
    const imgSrc = it.image || it.imageDataUrl || "";
    const pendingOffline = (!navigator.onLine) && state.pending.Itinerary.has(it.id);

    const card = document.createElement("div");
    card.className = "card p-4";
    if (pendingOffline) card.classList.add("pending-card");

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="tag ${itTagClass(it.category)}">${escapeHtml(it.category)}</span>
            <span class="text-xs" style="color: rgba(11,18,32,.52);">${escapeHtml(time)}</span>
            ${pendingOffline ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
          </div>
          <div class="mt-2 text-base font-semibold leading-snug break-words" style="color: rgba(11,18,32,.92);">${it.title || ""}</div>
          ${it.location ? `<div class="mt-2 text-xs break-words" style="color: rgba(11,18,32,.56);">${escapeHtml(it.location)}</div>` : ""}
          ${it.link ? `<div class="mt-2 text-xs">
              <a href="${escapeHtml(it.link)}" target="_blank" rel="noopener" class="link-soft">開啟連結</a>
            </div>` : ""}
          ${it.note ? `<div class="mt-2 text-sm break-words" style="color: rgba(11,18,32,.78);">${it.note}</div>` : ""}
          ${imgSrc ? `<div class="mt-3">
              <img class="rounded-2xl border border-white/10 cursor-pointer"
                   data-view-src="${imgSrc}"
                   src="${imgSrc}" alt="img"/>
            </div>` : ""}
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

// ====================== EXPENSE INPUT ONLY ======================
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
    Currency: e.currency,
    Amount: e.amount,
    Involved: e.involved, // comma-separated
    Note: e.note || "",
    ID: e.id
  };
}

function addExpense(){
  const who = expWho.value || PEOPLE[0];
  const where = expWhere.value || WHERE[0];
  const category = expCategory.value || EXP_CATEGORIES[0];
  const pay = expPay.value || PAY[0];
  const currency = expCurrency.value || "TWD";
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

  // analysis page will show details
  if (state.tab === "analysis") renderAnalysis();
  updateSyncBadge();
}

// ====================== FX (TWD conversion) ======================
function getFxMap(){ return load(LS.fx, {}); }

/** Convert expense row to TWD (rounded), using fxMap (key like "YYYY-MM-DD:NOK") */
function toTwd(e, fxMap){
  const amt = Number(e.amount || 0);
  if (!e.currency || e.currency === "TWD") return Math.round(amt);

  const dateKey = normalizeDateKey(e.date);
  const exactKey = `${dateKey}:${e.currency}`;
  let fx = Number(fxMap[exactKey] || 0);

  if (!fx){
    const candidates = Object.keys(fxMap).filter(k => k.endsWith(`:${e.currency}`));
    if (candidates.length){
      candidates.sort();
      fx = Number(fxMap[candidates[candidates.length-1]] || 0);
    }
  }
  if (!fx) fx = 1; // fallback
  return Math.round(amt * fx);
}
function sumTwd(items, fxMap){
  return Math.round(items.reduce((s,e)=>s + toTwd(e, fxMap), 0));
}

// ====================== ANALYSIS ======================
function renderAnalysis(){
  updateSyncBadge();
  const fxMap = getFxMap();
  const all = load(LS.expenses, []).map(x => ({...x, date: normalizeDateKey(x.date)}));

  const filtered = all.filter(e => {
    const f = state.filter;
    if (f.who.size && !f.who.has(e.payer)) return false;
    if (f.where.size && !f.where.has(e.location)) return false;
    if (f.category.size && !f.category.has(e.category)) return false;
    if (f.pay.size && !f.pay.has(e.payment)) return false;
    return true;
  });

  // Budget (only JQ+TY total paid)
  const jqTy = filtered.filter(e => e.payer === "家齊" || e.payer === "亭穎");
  const jqTyTotal = sumTwd(jqTy, fxMap);
  const remain = Math.max(0, BUDGET_JQ_TY - jqTyTotal);

  budgetSpent.textContent = `NT$ ${fmtMoney(jqTyTotal)}`;
  budgetRemain.textContent = `NT$ ${fmtMoney(remain)}`;
  budgetBar.style.width = `${clamp(BUDGET_JQ_TY ? (jqTyTotal/BUDGET_JQ_TY) : 0, 0, 1) * 100}%`;

  // Mom line: mom share (split) + mom paid
  const momPaid = filtered.filter(e => e.payer === "媽媽");
  const momPaidTotal = sumTwd(momPaid, fxMap);
  const momShare = computePersonShareTwd("媽媽", filtered, fxMap);
  momLine.textContent = `＊媽媽的支出與分攤：NT$ ${fmtMoney(momShare)}（媽媽自付：NT$ ${fmtMoney(momPaidTotal)}）`;

  // ✅ Pie: aggregate by Category (NOT by item)
  const catMap = new Map();
  for (const e of filtered){
    const twd = toTwd(e, fxMap);
    catMap.set(e.category, (catMap.get(e.category) || 0) + twd);
  }
  const labels = Array.from(catMap.keys());
  const values = labels.map(k => catMap.get(k));
  renderPie(labels, values);

  // Detail list (edit/delete here only)
  analysisExpenseList.innerHTML = "";
  const items = filtered.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""));

  if (!items.length){
    analysisExpenseList.innerHTML = `<div class="card p-4 text-sm" style="color: rgba(11,18,32,.62);">此篩選條件下沒有消費。</div>`;
  } else {
    items.forEach(e => {
      const twd = toTwd(e, fxMap);

      // ✅ Correct display:
      // Big: NT$ converted
      // Small: original currency (if not TWD)
      const originalLine = (e.currency && e.currency !== "TWD")
        ? `<div class="text-xs" style="color: rgba(11,18,32,.52);">${escapeHtml(e.currency)} ${fmtMoney(e.amount)}（原幣）</div>`
        : ``;

      const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean).join("、");
      const pendingOffline = (!navigator.onLine) && state.pending.Expenses.has(e.id);

      const card = document.createElement("div");
      card.className = "card p-4";
      if (pendingOffline) card.classList.add("pending-card");

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="tag ${expTagClass(e.category)}">${escapeHtml(e.category)}</span>
              <div class="text-base font-semibold break-words" style="color: rgba(11,18,32,.92);">${escapeHtml(e.item)}</div>
              ${pendingOffline ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
            </div>

            <div class="mt-1 text-sm" style="color: rgba(11,18,32,.56);">
              ${escapeHtml(e.payer)} • ${escapeHtml(e.location)} • ${escapeHtml(e.payment)} • ${escapeHtml(e.date)}
            </div>

            <div class="mt-2 text-2xl font-semibold" style="color: rgba(11,18,32,.92);">NT$ ${fmtMoney(twd)}</div>
            ${originalLine}

            ${e.note ? `<div class="mt-2 text-sm break-words" style="color: rgba(11,18,32,.72);">${escapeHtml(e.note)}</div>` : ""}
            <div class="mt-2 text-xs" style="color: rgba(11,18,32,.52);">分攤：${escapeHtml(splits)}</div>
          </div>

          <div class="shrink-0 flex flex-col gap-2">
            <button class="btn btn-ghost text-sm" data-act="edit">編輯</button>
            <button class="btn btn-ghost text-sm" data-act="del">刪除</button>
          </div>
        </div>
      `;

      card.querySelector('[data-act="edit"]').addEventListener("click", () => editExpenseInModal(e.id));
      card.querySelector('[data-act="del"]').addEventListener("click", () => deleteExpense(e.id));

      analysisExpenseList.appendChild(card);
    });
  }

  settlement.textContent = buildSettlement(filtered, fxMap);
}

function computePersonShareTwd(person, items, fxMap){
  let total = 0;
  for (const e of items){
    const twd = toTwd(e, fxMap);
    const inv = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
    if (!inv.length) continue;
    if (inv.includes(person)) total += twd / inv.length;
  }
  return Math.round(total);
}

function buildSettlement(items, fxMap){
  const paid = new Map(PEOPLE.map(p=>[p,0]));
  const share = new Map(PEOPLE.map(p=>[p,0]));

  for (const e of items){
    const twd = toTwd(e, fxMap);
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

function renderPie(labels, values){
  if (!pieCanvas || !window.Chart) return;
  const ctx = pieCanvas.getContext("2d");
  if (state.pieChart) state.pieChart.destroy();

  state.pieChart = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data: values }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (item) => `${item.label}: NT$ ${fmtMoney(item.raw || 0)}`
          }
        }
      }
    }
  });
}

// ====================== EDIT EXPENSE (analysis-only) ======================
/* We reuse the expenses input form as an editor:
   - jump to Expenses tab, fill values, and "確認記帳" temporarily becomes "儲存變更"
   - but per your rule: editing should be initiated only from analysis (buttons only exist there)
*/
let editingExpenseId = null;

function editExpenseInModal(id){
  const all = load(LS.expenses, []);
  const e = all.find(x => x.id === id);
  if (!e) return;

  editingExpenseId = id;
  setTab("expenses");

  expWho.value = e.payer;
  expWhere.value = e.location;
  expCategory.value = e.category;
  expPay.value = e.payment;
  expCurrency.value = e.currency || "TWD";
  expAmount.value = e.amount;
  expTitle.value = e.item;
  expNote.value = e.note || "";

  const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
  $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", splits.includes(b.dataset.value)));

  btnAddExpense.textContent = "儲存變更";
}

function saveExpenseEdit(){
  const id = editingExpenseId;
  if (!id) return;

  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  const who = expWho.value || PEOPLE[0];
  const where = expWhere.value || WHERE[0];
  const category = expCategory.value || EXP_CATEGORIES[0];
  const pay = expPay.value || PAY[0];
  const currency = expCurrency.value || "TWD";
  const amount = Number(expAmount.value);
  const title = (expTitle.value || "").trim();
  const note = (expNote.value || "").trim();
  const split = getSplitSelected();

  if (!title) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!split.length) return alert("請選擇分攤人員");

  all[idx] = {
    ...all[idx],
    date: normalizeDateKey(state.selectedDate),
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
  save(LS.expenses, all);

  queueOutbox({ op:"upsert", table:"Expenses", row: toSheetExpense(all[idx]) });
  maybeAutoSync();

  editingExpenseId = null;
  btnAddExpense.textContent = "確認記帳";
  expAmount.value = "";
  expTitle.value = "";
  expNote.value = "";
  setSplitDefault(expWho.value || PEOPLE[0]);

  setTab("analysis");
  renderAnalysis();
}

function deleteExpense(id){
  if (!confirm("確定刪除這筆消費？")) return;
  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  all.splice(idx, 1);
  save(LS.expenses, all);

  queueOutbox({ op:"delete", table:"Expenses", key:{ ID:id }});
  maybeAutoSync();
  renderAnalysis();
}

// ====================== FILTER MODAL ======================
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
      if (setRef.has(v)) setRef.delete(v);
      else setRef.add(v);
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
    filterChips.innerHTML = `<span class="text-xs" style="color: rgba(11,18,32,.52);">未套用篩選</span>`;
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

function openFilterModal(){ modalFilter?.classList.remove("hidden"); }
function closeFilterModal(){ modalFilter?.classList.add("hidden"); }
function clearFilters(){
  state.filter.who.clear();
  state.filter.where.clear();
  state.filter.category.clear();
  state.filter.pay.clear();
  buildFilterModal();
}

// ====================== OUTBOX / SYNC / PULL ======================
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

function mergePulled(rows){
  const exp = [];
  const it = [];

  for (const item of rows){
    const table = item.table;
    const r = item.row || {};

    if (table === "Expenses"){
      exp.push({
        id: String(r.ID || ""),
        date: normalizeDateKey(r.Date || ""),
        payer: String(r.Payer || ""),
        location: String(r.Location || ""),
        category: String(r.Category || ""),
        item: String(r.Item || ""),
        payment: String(r.Payment || ""),
        currency: String(r.Currency || "TWD"),
        amount: Number(r.Amount || 0),
        involved: String(r.Involved || ""),
        note: String(r.Note || "")
      });
    }

    if (table === "Itinerary"){
      it.push({
        id: String(r.ID || ""),
        date: normalizeDateKey(r.Date || ""),
        start: String(r.StatTime || ""),
        end: String(r.EndTime || ""),
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

// ====================== IMAGE UPLOAD ======================
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

// ====================== VIEWER ======================
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

  // swipe down to close
  let startY = 0;
  viewerStage.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) startY = e.touches[0].clientY;
  }, { passive:true });
  viewerStage.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 120 && state.viewer.scale <= 1.05) closeViewer();
  }, { passive:true });

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

// ====================== LINK INSERT ======================
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

// ====================== NETWORK HELPERS ======================
async function postJsonNoPreflight(url, payload){
  const res = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ====================== GESTURES ======================
function setupEdgeGestures(){
  let startX=0, startY=0, startAtEdge=false;

  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startAtEdge = (startX <= 18 || startX >= (window.innerWidth - 18));
  }, { passive:true });

  document.addEventListener("touchend", (e) => {
    if (!startX) return;
    const endX = e.changedTouches?.[0]?.clientX ?? startX;
    const endY = e.changedTouches?.[0]?.clientY ?? startY;
    const dx = endX - startX;
    const dy = endY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    if (startAtEdge){
      const order = ["itinerary","expenses","analysis"];
      const idx = order.indexOf(state.tab);
      const next = dx < 0 ? clamp(idx+1,0,order.length-1) : clamp(idx-1,0,order.length-1);
      setTab(order[next]);
      return;
    }

    if (state.tab === "itinerary"){
      const chips = $$(".date-chip");
      const curIdx = chips.findIndex(c => c.dataset.date === state.selectedDate);
      const nextIdx = dx < 0 ? clamp(curIdx+1,0,chips.length-1) : clamp(curIdx-1,0,chips.length-1);
      const nextDate = chips[nextIdx]?.dataset.date;
      if (nextDate) setSelectedDate(nextDate, true);
    }
  }, { passive:true });
}

// ====================== PULL TO REFRESH ======================
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
    ind.style.color = "rgba(11,18,32,.72)";
    ind.style.background = "rgba(255,255,255,.72)";
    ind.style.backdropFilter = "blur(14px)";
    ind.style.webkitBackdropFilter = "blur(14px)";
    ind.style.borderBottom = "1px solid rgba(20,35,60,.10)";
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

    el.addEventListener("touchcancel", () => {
      pulling=false; dist=0;
      ind.style.transform="translateY(-120%)";
    }, { passive:true });
  });
}

// ====================== EVENTS ======================
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

  btnAddExpense?.addEventListener("click", () => {
    if (editingExpenseId) saveExpenseEdit();
    else addExpense();
  });

  btnForceSync?.addEventListener("click", async () => {
    try { await syncNow(); }
    catch(e){ alert("同步失敗：請稍後再試。"); }
  });

  btnFilter?.addEventListener("click", openFilterModal);
  btnCloseFilter?.addEventListener("click", closeFilterModal);
  btnClearFilter?.addEventListener("click", () => { clearFilters(); renderAnalysis(); });
  btnApplyFilter?.addEventListener("click", () => { closeFilterModal(); renderAnalysis(); });

  btnFx?.addEventListener("click", () => {
    alert("匯率設定 UI 我可以下一步做成完整 modal（輸入 NOK/ISK/EUR/GBP/AED→TWD）。目前若未設定匯率，會以 1 計算。");
  });

  window.addEventListener("online", () => { updateSyncBadge(); maybeAutoSync(); });
  window.addEventListener("offline", () => { updateSyncBadge(); renderAll(); });
}

// ====================== INIT ======================
(function init(){
  // restore tab
  const ui = load(LS.ui, {});
  if (ui.tab && ["itinerary","expenses","analysis"].includes(ui.tab)) state.tab = ui.tab;

  // defaults
  expCurrency.value = "TWD";

  buildDateStrip();
  buildItCatChooser();
  buildSplitChooser();
  buildFilterModal();
  attachEvents();
  setupEdgeGestures();
  setupPullToRefresh([pageIt, pageEx, pageAn]);
  setupViewer();

  renderHeader();
  setInterval(renderHeader, 60*1000);

  setTab(state.tab);
  updateSyncBadge();

  // initial pull if online
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
  // expenses page is input-only, no list rendering
}

// ====================== MODALS ======================
function openFilterModal(){ modalFilter.classList.remove("hidden"); }
function closeFilterModal(){ modalFilter.classList.add("hidden"); }

// ====================== Itinerary modal close helper ======================
function closeItModal(){ modalItinerary.classList.add("hidden"); }

// ====================== Viewer hooks from itinerary cards ======================
function openViewer(src){
  viewerImg.src = src;
  modalViewer.classList.remove("hidden");
  state.viewer.scale = 1;
  state.viewer.tx = 0;
  state.viewer.ty = 0;
  viewerImg.style.transform = `translate(0px,0px) scale(1)`;
}
function closeViewer(){ modalViewer.classList.add("hidden"); }
