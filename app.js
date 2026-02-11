/* =========================================================
 * Travel Web App (Frontend) - Full app.js
 * - Sync/Pull with GAS
 * - Offline outbox
 * - Pending highlight (orange dashed) when offline edits exist
 * - Pull-to-refresh on each page content area
 * - Analysis: pie + list + settlement
 * - Filter modal: multi-select chips
 * - Image viewer: pan/zoom + pinch
 * ========================================================= */

// ====================== CONFIG ======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzfX8f3-CcY6X-nu7Sm545Xk5ysHRrWvwqWxBV0-YGX3Ss3ShJM6r9eDnXcoBNwBULhxw/exec";
const DRIVE_FOLDER_ID = "10ogmnlqLreB_PzSwyuQGtKzO759NVF3M";

const TRIP_NAME = "2026冰島挪威之旅";
const TRIP_RANGE_TEXT = "2026/08/30-09/26";
const TRIP_START = "2026-08-30";
const TRIP_END = "2026-09-26";

const PEOPLE = ["家齊", "亭穎", "媽媽"];
const WHERE = ["臺灣", "挪威", "冰島", "杜拜", "英國"];
const EXP_CATEGORIES = [
  "早餐","午餐","晚餐","零食","住宿",
  "交通（機票）","交通（租車）","交通（停車費）","交通（油錢）","交通（電費）",
  "紀念品","門票","其他"
];
const PAY = ["現金","信用卡－國泰","信用卡–永豐","信用卡–元大"];
const CURRENCIES = ["TWD","NOK","ISK","EUR","GBP","AED"];

const IT_CATEGORIES = ["景點","飲食","交通","住宿","其他"];

// 你要的：主題色改淺一些（主要靠 CSS，這裡提供 category 淺色底）
const IT_CAT_COLORS = {
  "景點": "rgba(191,233,255,0.18)",
  "飲食": "rgba(94,234,212,0.14)",
  "交通": "rgba(255,255,255,0.10)",
  "住宿": "rgba(217,243,255,0.12)",
  "其他": "rgba(255,255,255,0.08)"
};

const BUDGET_JQ_TY = 500000; // NTD

// ====================== STORAGE KEYS ======================
const LS = {
  itinerary: "tripapp_itinerary_v3",
  expenses: "tripapp_expenses_v3",
  fx: "tripapp_fx_v1",
  outbox: "tripapp_outbox_v3",
  ui: "tripapp_ui_v1"
};

// ====================== UTILS ======================
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function uid(prefix="X") {
  const t = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(16).slice(2,8);
  return `${prefix}-${t}-${rand}`;
}

function escapeHtml_(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fmtMoney_(n){ return Number(n||0).toLocaleString("zh-Hant-TW"); }

function parseLocalDate(yyyy_mm_dd) {
  const [y,m,d] = String(yyyy_mm_dd).split("-").map(Number);
  return new Date(y, m-1, d, 12, 0, 0);
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function weekdayZh(d) { return ["日","一","二","三","四","五","六"][d.getDay()]; }
function daysBetween(a,b) {
  const ms = (parseLocalDate(fmtDate(b)).getTime() - parseLocalDate(fmtDate(a)).getTime());
  return Math.round(ms / 86400000);
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// ====================== DOM REFS (must exist in HTML) ======================
// Header
const elTitle = $("#appTitle");
const elSubtitle = $("#appSubtitle");
const elTripDay = $("#tripDayLabel");
const elToday = $("#todayLabel");
const elSync = $("#syncStatus");
const btnForceSync = $("#btnForceSync");

// Tabs / pages
const tabButtons = $$(".tab");
const pageIt = $("#page-itinerary");
const pageEx = $("#page-expenses");
const pageAn = $("#page-analysis");

// Date strip
const dateStrip = $("#dateStrip");
const selectedDateLabel = $("#selectedDateLabel");
const selectedDayIndexLabel = $("#selectedDayIndexLabel");

// Itinerary
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
const itTitle = $("#itTitle");      // contenteditable
const itAddress = $("#itAddress");  // input
const itNote = $("#itNote");        // contenteditable
const itImage = $("#itImage");      // file input
const itImagePreview = $("#itImagePreview");
const btnOpenMap = $("#btnOpenMap");
const btnLinkTitle = $("#btnLinkTitle");
const btnLinkNote = $("#btnLinkNote");

// Expenses
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
const expenseList = $("#expenseList");

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

// Filter modal
const modalFilter = $("#modalFilter");
const btnCloseFilter = $("#btnCloseFilter");
const btnClearFilter = $("#btnClearFilter");
const btnApplyFilter = $("#btnApplyFilter");
const filterChips = $("#filterChips");
const filterWhoBox = $("#filterWhoBox");
const filterWhereBox = $("#filterWhereBox");
const filterCategoryBox = $("#filterCategoryBox");
const filterPayBox = $("#filterPayBox");

// Viewer
const modalViewer = $("#modalViewer");
const btnCloseViewer = $("#btnCloseViewer");
const btnResetViewer = $("#btnResetViewer");
const viewerStage = $("#viewerStage");
const viewerImg = $("#viewerImg");

// Containers for pull-to-refresh (choose any scrollable content wrapper)
const scrollIt = $("#scroll-itinerary") || pageIt;
const scrollEx = $("#scroll-expenses") || pageEx;
const scrollAn = $("#scroll-analysis") || pageAn;

// ====================== STATE ======================
const tripStartD = parseLocalDate(TRIP_START);
const tripEndD = parseLocalDate(TRIP_END);
const tripDays = daysBetween(tripStartD, tripEndD) + 1;
function tripDayIndexFor(dateD){ return daysBetween(tripStartD, dateD) + 1; }

let state = {
  tab: "itinerary",
  selectedDate: fmtDate(tripStartD),

  // itinerary modal draft
  itDraftCat: IT_CATEGORIES[0],
  itDraftImageDataUrl: "",
  itDraftDriveFileId: "",
  itDraftDriveUrl: "",
  itDraftLink: "",
  editingItId: null,

  // expenses edit
  editingExpenseId: null,

  // filter
  filter: {
    who: new Set(),
    where: new Set(),
    category: new Set(),
    pay: new Set()
  },

  // viewer
  viewer: {
    scale: 1,
    tx: 0,
    ty: 0
  },

  // computed pending ids
  pending: {
    Expenses: new Set(),
    Itinerary: new Set()
  },

  pieChart: null
};

// ====================== INIT ======================
registerSW_();
hydrateUI_();
renderHeader_();
buildDateStrip_();
buildItCatChooser_();
buildSplitChooser_();
buildFilterModal_();
attachEvents_();
setupEdgeGestures_();
setupPullToRefresh_([scrollIt, scrollEx, scrollAn]);
setupViewer_();
updateSyncBadge_();
renderAll_();

if (navigator.onLine) {
  pullAll_().then(() => renderAll_()).catch(()=>{});
}

window.addEventListener("online", () => { updateSyncBadge_(); maybeAutoSync_(); });
window.addEventListener("offline", () => { updateSyncBadge_(); renderAll_(); });
setInterval(renderHeader_, 60*1000);

function registerSW_(){
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

function hydrateUI_(){
  // Header texts
  if (elTitle) elTitle.textContent = TRIP_NAME;
  if (elSubtitle) elSubtitle.textContent = TRIP_RANGE_TEXT;

  // Selects (if HTML not pre-filled)
  fillSelect_(expWho, PEOPLE);
  fillSelect_(expWhere, WHERE);
  fillSelect_(expCategory, EXP_CATEGORIES);
  fillSelect_(expPay, PAY);
  fillSelect_(expCurrency, CURRENCIES);

  // Defaults
  expCurrency.value = "TWD";
  expWho.value = PEOPLE[0];
}

function fillSelect_(selectEl, items){
  if (!selectEl) return;
  if (selectEl.options && selectEl.options.length > 0) return; // assume prefilled
  selectEl.innerHTML = items.map(v => `<option value="${escapeHtml_(v)}">${escapeHtml_(v)}</option>`).join("");
}

// ====================== SYNC BADGE ======================
function setSyncBadge_(mode, text){
  // mode: ok | wait | sync | offline
  const dotClass = {
    ok: "dot-ok",
    wait: "dot-wait",
    sync: "dot-sync",
    offline: "dot-offline"
  }[mode] || "dot-ok";
  if (!elSync) return;
  elSync.innerHTML = `<span class="dot ${dotClass}"></span><span class="text-sm">${escapeHtml_(text)}</span>`;
}

function computePendingFromOutbox_(){
  const box = load(LS.outbox, []);
  const exp = new Set();
  const it = new Set();
  for (const op of box) {
    const table = op.table;
    const verb = String(op.op||"").toLowerCase();
    if (verb === "upsert") {
      const id = String(op?.row?.ID || "").trim();
      if (!id) continue;
      if (table === "Expenses") exp.add(id);
      if (table === "Itinerary") it.add(id);
    }
  }
  state.pending.Expenses = exp;
  state.pending.Itinerary = it;
}

function updateSyncBadge_(){
  computePendingFromOutbox_();
  const box = load(LS.outbox, []);
  const pending = box.length > 0;

  if (!navigator.onLine) {
    // 你要的：離線且有未上傳才顯示 待上傳
    if (pending) setSyncBadge_("wait", "待上傳");
    else setSyncBadge_("offline", "離線");
    return;
  }

  if (pending) setSyncBadge_("wait", "待上傳");
  else setSyncBadge_("ok", "已同步");
}

// ====================== HEADER ======================
function renderHeader_(){
  const now = new Date();
  if (elToday) elToday.textContent = `${now.getMonth()+1}/${now.getDate()}（${weekdayZh(now)}）`;

  const todayLocal = parseLocalDate(fmtDate(now));
  if (todayLocal < tripStartD) {
    if (elTripDay) elTripDay.textContent = `倒數 ${daysBetween(todayLocal, tripStartD)} 日`;
  } else if (todayLocal > tripEndD) {
    if (elTripDay) elTripDay.textContent = `旅行已結束`;
  } else {
    if (elTripDay) elTripDay.textContent = `第 ${tripDayIndexFor(todayLocal)} 日`;
  }
}

// ====================== DATE STRIP ======================
function buildDateStrip_(){
  if (!dateStrip) return;
  dateStrip.innerHTML = "";
  for (let i=0; i<tripDays; i++){
    const d = new Date(tripStartD.getTime() + i*86400000);
    const key = fmtDate(d);
    const btn = document.createElement("button");
    btn.className = "date-chip";
    btn.dataset.date = key;
    btn.textContent = `${d.getMonth()+1}/${d.getDate()} ${weekdayZh(d)}`;
    btn.addEventListener("click", () => setSelectedDate_(key, true));
    dateStrip.appendChild(btn);
  }
  setSelectedDate_(state.selectedDate, true);
}

function setSelectedDate_(yyyy_mm_dd, scrollIntoView){
  state.selectedDate = yyyy_mm_dd;
  $$(".date-chip").forEach(b => b.classList.toggle("active", b.dataset.date === yyyy_mm_dd));

  const d = parseLocalDate(yyyy_mm_dd);
  if (selectedDateLabel) selectedDateLabel.textContent = `${d.getMonth()+1}/${d.getDate()}（${weekdayZh(d)}）`;
  if (selectedDayIndexLabel) selectedDayIndexLabel.textContent = `Day ${tripDayIndexFor(d)}`;

  if (scrollIntoView) {
    const active = $(`.date-chip[data-date="${yyyy_mm_dd}"]`);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
  renderItinerary_();
}

// ====================== TAB/PAGE ======================
function setTab_(tab){
  state.tab = tab;
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  pageIt?.classList.toggle("hidden", tab !== "itinerary");
  pageEx?.classList.toggle("hidden", tab !== "expenses");
  pageAn?.classList.toggle("hidden", tab !== "analysis");

  save(LS.ui, { ...(load(LS.ui, {})), tab });

  if (tab === "analysis") renderAnalysis_();
}

// ====================== ITINERARY ======================
function buildItCatChooser_(){
  if (!itCatChooser) return;
  itCatChooser.innerHTML = "";
  IT_CATEGORIES.forEach((cat, idx) => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = cat;
    b.addEventListener("click", () => {
      state.itDraftCat = cat;
      Array.from(itCatChooser.querySelectorAll(".tag"))
        .forEach(x => x.classList.toggle("active", x.textContent === cat));
    });
    itCatChooser.appendChild(b);
    if (idx === 0) b.classList.add("active");
  });
  state.itDraftCat = IT_CATEGORIES[0];

  // 你提過「開始/結束時間框框會重疊」：這通常是 CSS；但前端也可以避免輸入過長
  // 若你 HTML 是兩個 input 並排，用 CSS 調整寬度最準（你已說要縮短框，建議在 CSS：.time-input{width: 44%}）
}

function openItModal_(editId=null){
  state.editingItId = editId;
  modalItinerary?.classList.remove("hidden");

  state.itDraftImageDataUrl = "";
  state.itDraftDriveFileId = "";
  state.itDraftDriveUrl = "";
  state.itDraftLink = "";
  if (itImage) itImage.value = "";
  if (itImagePreview) itImagePreview.innerHTML = "";

  if (!editId) {
    if (itModalTitle) itModalTitle.textContent = "新增行程";
    if (btnSaveIt) btnSaveIt.textContent = "新增行程";
    if (itStart) itStart.value = "09:00";
    if (itEnd) itEnd.value = "10:00";
    state.itDraftCat = IT_CATEGORIES[0];
    Array.from(itCatChooser?.querySelectorAll(".tag") || [])
      .forEach((x,i) => x.classList.toggle("active", i===0));
    if (itTitle) itTitle.innerHTML = "";
    if (itAddress) itAddress.value = "";
    if (itNote) itNote.innerHTML = "";
    return;
  }

  const all = load(LS.itinerary, []);
  const it = all.find(x => x.id === editId);
  if (!it) return;

  if (itModalTitle) itModalTitle.textContent = "編輯行程";
  if (btnSaveIt) btnSaveIt.textContent = "儲存變更";

  if (itStart) itStart.value = it.start || "";
  if (itEnd) itEnd.value = it.end || "";
  state.itDraftCat = it.category || IT_CATEGORIES[0];
  Array.from(itCatChooser?.querySelectorAll(".tag") || [])
    .forEach(x => x.classList.toggle("active", x.textContent === state.itDraftCat));
  if (itTitle) itTitle.innerHTML = it.title || "";
  if (itAddress) itAddress.value = it.location || "";
  state.itDraftLink = it.link || "";
  if (itNote) itNote.innerHTML = it.note || "";

  state.itDraftDriveFileId = it.imageId || "";
  state.itDraftDriveUrl = it.image || "";
  state.itDraftImageDataUrl = it.imageDataUrl || "";

  const imgSrc = state.itDraftDriveUrl || state.itDraftImageDataUrl;
  if (imgSrc && itImagePreview) itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${imgSrc}" alt="preview" />`;
}

function closeItModal_(){ modalItinerary?.classList.add("hidden"); }

function saveItinerary_(){
  const start = itStart?.value || "";
  const end = itEnd?.value || "";
  const category = state.itDraftCat;

  const titleHtml = (itTitle?.innerHTML || "").trim();
  const location = (itAddress?.value || "").trim();
  const noteHtml = (itNote?.innerHTML || "").trim();

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

  let saved = null;
  if (!state.editingItId) {
    saved = { id: uid("IT"), ...base };
    all.push(saved);
  } else {
    const idx = all.findIndex(x => x.id === state.editingItId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...base };
      saved = all[idx];
    }
  }

  save(LS.itinerary, all);

  if (saved) {
    queueOutbox_({ op: "upsert", table: "Itinerary", row: toSheetItinerary_(saved) });
    maybeAutoSync_();
  }

  closeItModal_();
  renderItinerary_();
}

function deleteItinerary_(id){
  if (!confirm("確定刪除這筆行程？")) return;
  const all = load(LS.itinerary, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;
  all.splice(idx, 1);
  save(LS.itinerary, all);

  queueOutbox_({ op: "delete", table: "Itinerary", key: { ID: id }});
  maybeAutoSync_();
  renderItinerary_();
}

function renderItinerary_(){
  updateSyncBadge_();

  const all = load(LS.itinerary, []);
  const items = all
    .filter(x => x.date === state.selectedDate)
    .sort((a,b) => (a.start||"").localeCompare(b.start||""));

  if (!itineraryList) return;
  itineraryList.innerHTML = "";

  if (!items.length) {
    itineraryList.innerHTML = `<div class="card p-4 text-sm text-slate-200/80">今天還沒有行程。可以按「新增行程」。</div>`;
    return;
  }

  items.forEach(it => {
    const catBg = IT_CAT_COLORS[it.category] || "rgba(255,255,255,0.08)";
    const time = (it.start || it.end) ? `${it.start||""}–${it.end||""}` : "";
    const imgSrc = it.image || it.imageDataUrl || "";

    const isPending = (!navigator.onLine) && state.pending.Itinerary.has(it.id);

    const card = document.createElement("div");
    card.className = "card p-4";
    if (isPending) card.classList.add("pending-card"); // ✅ 橘色虛線（靠 CSS）

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="tag" style="background:${catBg}; border-color: rgba(255,255,255,0.16);">${escapeHtml_(it.category)}</span>
            <span class="text-xs text-slate-300/80">${escapeHtml_(time)}</span>
            ${isPending ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
          </div>
          <div class="mt-2 text-base font-semibold leading-snug break-words">${it.title || ""}</div>
          ${it.location ? `<div class="mt-2 text-xs text-slate-200/80 break-words">${escapeHtml_(it.location)}</div>` : ""}
          ${it.link ? `<div class="mt-2 text-xs">
              <a href="${escapeHtml_(it.link)}" target="_blank" rel="noopener" class="link-soft">開啟連結</a>
            </div>` : ""}
          ${it.note ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${it.note}</div>` : ""}
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

    card.querySelector('[data-act="edit"]').addEventListener("click", () => openItModal_(it.id));
    card.querySelector('[data-act="del"]').addEventListener("click", () => deleteItinerary_(it.id));

    const imgEl = card.querySelector('img[data-view-src]');
    if (imgEl) imgEl.addEventListener("click", () => openViewer_(imgEl.dataset.viewSrc));

    itineraryList.appendChild(card);
  });
}

function toSheetItinerary_(it){
  return {
    Date: it.date,
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

// ====================== EXPENSES ======================
function buildSplitChooser_(){
  if (!splitChooser) return;
  splitChooser.innerHTML = "";
  PEOPLE.forEach(p => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = p;
    b.dataset.value = p;
    b.addEventListener("click", () => b.classList.toggle("active"));
    splitChooser.appendChild(b);
  });

  expWho?.addEventListener("change", () => setSplitDefault_(expWho.value));
  setSplitDefault_(expWho?.value || PEOPLE[0]);
}

function setSplitDefault_(who){
  $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", b.dataset.value === who));
}
function getSplitSelected_(){ return $$("#splitChooser .tag.active").map(b => b.dataset.value); }

function addExpense_(){
  const who = expWho?.value || PEOPLE[0];
  const where = expWhere?.value || WHERE[0];
  const category = expCategory?.value || EXP_CATEGORIES[0];
  const pay = expPay?.value || PAY[0];
  const currency = expCurrency?.value || "TWD";
  const amount = Number(expAmount?.value);
  const title = (expTitle?.value || "").trim();
  const note = (expNote?.value || "").trim();
  const split = getSplitSelected_();

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
    involved: split.join(","), // ✅ 逗號
    note
  };

  const all = load(LS.expenses, []);
  all.push(row);
  save(LS.expenses, all);

  queueOutbox_({ op: "upsert", table: "Expenses", row: toSheetExpense_(row) });

  if (expAmount) expAmount.value = "";
  if (expTitle) expTitle.value = "";
  if (expNote) expNote.value = "";
  setSplitDefault_(who);

  renderExpenses_();
  if (state.tab === "analysis") renderAnalysis_();
  maybeAutoSync_();
}

function editExpense_(id){
  const all = load(LS.expenses, []);
  const e = all.find(x => x.id === id);
  if (!e) return;

  state.editingExpenseId = id;
  setTab_("expenses");

  expWho.value = e.payer;
  expWhere.value = e.location;
  expCategory.value = e.category;
  expPay.value = e.payment;
  expCurrency.value = e.currency;
  expAmount.value = e.amount;
  expTitle.value = e.item;
  expNote.value = e.note || "";

  const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
  $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", splits.includes(b.dataset.value)));
  if (btnAddExpense) btnAddExpense.textContent = "儲存變更";
}

function saveExpenseEdit_(){
  const id = state.editingExpenseId;
  if (!id) return;

  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  const who = expWho?.value || PEOPLE[0];
  const where = expWhere?.value || WHERE[0];
  const category = expCategory?.value || EXP_CATEGORIES[0];
  const pay = expPay?.value || PAY[0];
  const currency = expCurrency?.value || "TWD";
  const amount = Number(expAmount?.value);
  const title = (expTitle?.value || "").trim();
  const note = (expNote?.value || "").trim();
  const split = getSplitSelected_();

  if (!title) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!split.length) return alert("請選擇分攤人員");

  all[idx] = {
    ...all[idx],
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
  save(LS.expenses, all);

  queueOutbox_({ op:"upsert", table:"Expenses", row: toSheetExpense_(all[idx]) });

  state.editingExpenseId = null;
  if (btnAddExpense) btnAddExpense.textContent = "確認記帳";
  if (expAmount) expAmount.value = "";
  if (expTitle) expTitle.value = "";
  if (expNote) expNote.value = "";
  setSplitDefault_(expWho?.value || PEOPLE[0]);

  renderExpenses_();
  if (state.tab === "analysis") renderAnalysis_();
  maybeAutoSync_();
}

function deleteExpense_(id){
  if (!confirm("確定刪除這筆消費？")) return;
  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  all.splice(idx, 1);
  save(LS.expenses, all);

  queueOutbox_({ op:"delete", table:"Expenses", key:{ ID: id } });

  renderExpenses_();
  if (state.tab === "analysis") renderAnalysis_();
  maybeAutoSync_();
}

function renderExpenses_(){
  updateSyncBadge_();

  const all = load(LS.expenses, []);
  const items = all.slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));

  if (!expenseList) return;
  expenseList.innerHTML = "";
  if (!items.length) {
    expenseList.innerHTML = `<div class="card p-4 text-sm text-slate-200/80">尚無消費紀錄。</div>`;
    return;
  }

  const fxMap = getFxMap_();

  items.forEach(e => {
    const twd = toTwd_(e, fxMap);
    const sub = (e.currency === "TWD")
      ? ""
      : `<div class="text-xs text-slate-300/80">${escapeHtml_(e.currency)} ${fmtMoney_(e.amount)}（原幣）</div>`;

    const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean).join("、");
    const isPending = (!navigator.onLine) && state.pending.Expenses.has(e.id);

    const card = document.createElement("div");
    card.className = "card p-4";
    if (isPending) card.classList.add("pending-card");

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <div class="text-base font-semibold break-words">${escapeHtml_(e.item)}</div>
            ${isPending ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
          </div>
          <div class="mt-1 text-sm text-slate-200/90">${escapeHtml_(e.payer)} • ${escapeHtml_(e.location)} • ${escapeHtml_(e.category)} • ${escapeHtml_(e.payment)}</div>
          <div class="mt-2 text-2xl font-semibold">NT$ ${fmtMoney_(twd)}</div>
          ${sub}
          ${e.note ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${escapeHtml_(e.note)}</div>` : ""}
          <div class="mt-2 text-xs text-slate-300/80">分攤：${escapeHtml_(splits)}</div>
        </div>
        <div class="shrink-0 flex flex-col gap-2">
          <button class="btn btn-ghost text-sm" data-act="edit">編輯</button>
          <button class="btn btn-ghost text-sm" data-act="del">刪除</button>
        </div>
      </div>
    `;
    card.querySelector('[data-act="edit"]').addEventListener("click", () => editExpense_(e.id));
    card.querySelector('[data-act="del"]').addEventListener("click", () => deleteExpense_(e.id));
    expenseList.appendChild(card);
  });
}

function toSheetExpense_(e){
  return {
    Date: e.date,
    Payer: e.payer,
    Location: e.location,
    Category: e.category,
    Item: e.item,
    Payment: e.payment,
    Currency: e.currency,
    Amount: e.amount,
    Involved: e.involved, // ✅ 逗號
    Note: e.note || "",
    ID: e.id
  };
}

// ====================== ANALYSIS ======================
function renderAnalysis_(){
  updateSyncBadge_();

  const fxMap = getFxMap_();
  const all = load(LS.expenses, []);

  // Apply filters
  const filtered = all.filter(e => {
    const f = state.filter;
    if (f.who.size && !f.who.has(e.payer)) return false;
    if (f.where.size && !f.where.has(e.location)) return false;
    if (f.category.size && !f.category.has(e.category)) return false;
    if (f.pay.size && !f.pay.has(e.payment)) return false;
    return true;
  });

  // Budget block: only 家齊+亭穎 total (not including mom unless in their name)
  const jqTy = filtered.filter(e => e.payer === "家齊" || e.payer === "亭穎");
  const mom = filtered.filter(e => e.payer === "媽媽");

  const jqTyTotal = sumTwd_(jqTy, fxMap);
  const momTotal = sumTwd_(mom, fxMap);

  // Mom "個人+分攤"：媽媽自己付的 + 任何分攤包含媽媽的 (以 1/人數平均分)
  const momShare = computePersonShareTwd_("媽媽", filtered, fxMap);

  const remain = Math.max(0, BUDGET_JQ_TY - jqTyTotal);

  if (budgetSpent) budgetSpent.textContent = `NT$ ${fmtMoney_(jqTyTotal)}`;
  if (budgetRemain) budgetRemain.textContent = `NT$ ${fmtMoney_(remain)}`;
  if (momLine) momLine.textContent = `＊媽媽的支出與分攤：NT$ ${fmtMoney_(momShare)}（媽媽自付：NT$ ${fmtMoney_(momTotal)}）`;

  // Budget bar
  const pct = clamp(BUDGET_JQ_TY ? (jqTyTotal / BUDGET_JQ_TY) : 0, 0, 1);
  if (budgetBar) budgetBar.style.width = `${Math.round(pct*100)}%`;

  // Pie by category (TWD)
  const catMap = new Map();
  for (const e of filtered) {
    const twd = toTwd_(e, fxMap);
    catMap.set(e.category, (catMap.get(e.category)||0) + twd);
  }
  const labels = Array.from(catMap.keys());
  const values = labels.map(k => catMap.get(k));

  renderPie_(labels, values);

  // Detail list (cards)
  if (analysisExpenseList) {
    analysisExpenseList.innerHTML = "";
    const items = filtered.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""));
    if (!items.length) {
      analysisExpenseList.innerHTML = `<div class="card p-4 text-sm text-slate-200/80">此篩選條件下沒有消費。</div>`;
    } else {
      items.forEach(e => {
        const twd = toTwd_(e, fxMap);
        const sub = (e.currency === "TWD")
          ? ""
          : `<div class="text-xs text-slate-300/80">${escapeHtml_(e.currency)} ${fmtMoney_(e.amount)}（原幣）</div>`;
        const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean).join("、");
        const isPending = (!navigator.onLine) && state.pending.Expenses.has(e.id);

        const card = document.createElement("div");
        card.className = "card p-4";
        if (isPending) card.classList.add("pending-card");

        card.innerHTML = `
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <div class="text-base font-semibold break-words">${escapeHtml_(e.item)}</div>
                ${isPending ? `<span class="text-xs pending-badge">待上傳</span>` : ``}
              </div>
              <div class="mt-1 text-sm text-slate-200/90">${escapeHtml_(e.payer)} • ${escapeHtml_(e.location)} • ${escapeHtml_(e.category)} • ${escapeHtml_(e.payment)}</div>
              <div class="mt-2 text-2xl font-semibold">NT$ ${fmtMoney_(twd)}</div>
              ${sub}
              ${e.note ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${escapeHtml_(e.note)}</div>` : ""}
              <div class="mt-2 text-xs text-slate-300/80">分攤：${escapeHtml_(splits)}</div>
            </div>
            <div class="shrink-0 flex flex-col gap-2">
              <button class="btn btn-ghost text-sm" data-act="edit">編輯</button>
              <button class="btn btn-ghost text-sm" data-act="del">刪除</button>
            </div>
          </div>
        `;
        card.querySelector('[data-act="edit"]').addEventListener("click", () => editExpense_(e.id));
        card.querySelector('[data-act="del"]').addEventListener("click", () => deleteExpense_(e.id));
        analysisExpenseList.appendChild(card);
      });
    }
  }

  // Settlement
  const settleText = buildSettlement_(filtered, fxMap);
  if (settlement) settlement.textContent = settleText;
}

function renderPie_(labels, values){
  if (!pieCanvas) return;

  // If Chart.js exists, render
  if (window.Chart) {
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
              label: (item) => {
                const v = item.raw || 0;
                return `${item.label}: NT$ ${fmtMoney_(v)}`;
              }
            }
          }
        }
      }
    });
    return;
  }

  // Fallback: show text
  const total = values.reduce((a,b)=>a+b,0);
  pieCanvas.replaceWith(Object.assign(document.createElement("div"), {
    className: "card p-4 text-sm text-slate-200/80",
    innerHTML: labels.map((l,i)=> `${escapeHtml_(l)}：NT$ ${fmtMoney_(values[i])}`).join("<br>") + `<div class="mt-2 text-xs text-slate-300/80">Total：NT$ ${fmtMoney_(total)}</div>`
  }));
}

function buildSettlement_(items, fxMap){
  // Simplified fair split by Involved (equal split), compute net for each person:
  // net(person) = share - paid
  const paid = new Map(PEOPLE.map(p=>[p,0]));
  const share = new Map(PEOPLE.map(p=>[p,0]));

  for (const e of items) {
    const twd = toTwd_(e, fxMap);
    paid.set(e.payer, (paid.get(e.payer)||0) + twd);

    const inv = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
    if (!inv.length) continue;
    const each = twd / inv.length;
    for (const p of inv) {
      if (!share.has(p)) share.set(p, 0);
      share.set(p, share.get(p) + each);
    }
  }

  const net = new Map();
  for (const p of PEOPLE) {
    const n = (share.get(p)||0) - (paid.get(p)||0); // positive means should pay, negative means should receive
    net.set(p, n);
  }

  // Greedy settle
  const debtors = [];
  const creditors = [];
  for (const [p,n] of net.entries()) {
    if (n > 1) debtors.push([p,n]);
    if (n < -1) creditors.push([p,-n]);
  }
  debtors.sort((a,b)=>b[1]-a[1]);
  creditors.sort((a,b)=>b[1]-a[1]);

  const lines = [];
  let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const [dp, dn] = debtors[i];
    const [cp, cn] = creditors[j];
    const pay = Math.min(dn, cn);
    lines.push(`${dp} → ${cp}：NT$ ${fmtMoney_(Math.round(pay))}`);
    debtors[i][1] -= pay;
    creditors[j][1] -= pay;
    if (debtors[i][1] <= 1) i++;
    if (creditors[j][1] <= 1) j++;
  }

  if (!lines.length) return "目前不需要分帳結算。";
  return lines.join("\n");
}

function computePersonShareTwd_(person, items, fxMap){
  let total = 0;
  for (const e of items) {
    const twd = toTwd_(e, fxMap);
    const inv = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean);
    if (!inv.length) continue;
    if (inv.includes(person)) total += twd / inv.length;
  }
  return Math.round(total);
}

function getFxMap_(){
  // key format: `${date}:${currency}` but if you haven't built FX UI yet, default 1
  return load(LS.fx, {});
}
function toTwd_(e, fxMap){
  const amt = Number(e.amount||0);
  if (e.currency === "TWD") return Math.round(amt);
  // default 1 if missing
  // Use latest stored key for that currency (any date) if exact date not found
  const exactKey = `${e.date}:${e.currency}`;
  let fx = Number(fxMap[exactKey] || 0);

  if (!fx) {
    const candidates = Object.keys(fxMap).filter(k => k.endsWith(`:${e.currency}`));
    if (candidates.length) fx = Number(fxMap[candidates.sort().pop()] || 0);
  }
  if (!fx) fx = 1;
  return Math.round(amt * fx);
}
function sumTwd_(items, fxMap){
  return Math.round(items.reduce((s,e)=> s + toTwd_(e, fxMap), 0));
}

// ====================== FILTER MODAL ======================
function buildFilterModal_(){
  // Build option buttons
  buildFilterBox_(filterWhoBox, PEOPLE, state.filter.who);
  buildFilterBox_(filterWhereBox, WHERE, state.filter.where);
  buildFilterBox_(filterCategoryBox, EXP_CATEGORIES, state.filter.category);
  buildFilterBox_(filterPayBox, PAY, state.filter.pay);

  renderFilterChips_();
}

function buildFilterBox_(boxEl, options, setRef){
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
      renderFilterChips_();
    });
    boxEl.appendChild(b);
  });
}

function renderFilterChips_(){
  if (!filterChips) return;
  const chips = [];

  for (const v of state.filter.who) chips.push({ k:"who", v });
  for (const v of state.filter.where) chips.push({ k:"where", v });
  for (const v of state.filter.category) chips.push({ k:"category", v });
  for (const v of state.filter.pay) chips.push({ k:"pay", v });

  if (!chips.length) {
    filterChips.innerHTML = `<span class="text-xs text-slate-300/80">未套用篩選</span>`;
    return;
  }

  filterChips.innerHTML = "";
  chips.forEach(c => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml_(c.v)} <span class="x">×</span>`;
    chip.addEventListener("click", () => {
      state.filter[c.k].delete(c.v);
      buildFilterModal_();
    });
    filterChips.appendChild(chip);
  });
}

function openFilterModal_(){ modalFilter?.classList.remove("hidden"); }
function closeFilterModal_(){ modalFilter?.classList.add("hidden"); }
function clearFilters_(){
  state.filter.who.clear();
  state.filter.where.clear();
  state.filter.category.clear();
  state.filter.pay.clear();
  buildFilterModal_();
}

// ====================== VIEWER (pan/zoom + pinch) ======================
function setupViewer_(){
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
  btnCloseViewer?.addEventListener("click", closeViewer_);

  viewerStage.addEventListener("pointerdown", (e) => {
    viewerStage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      lastPan = { x: e.clientX, y: e.clientY, tx: state.viewer.tx, ty: state.viewer.ty };
    }
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStartDist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      pinchStartScale = state.viewer.scale;
    }
  });

  viewerStage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && lastPan) {
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      state.viewer.tx = lastPan.tx + dx;
      state.viewer.ty = lastPan.ty + dy;
      apply();
    }

    if (pointers.size === 2) {
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
    if (pointers.size === 1) {
      // re-init pan baseline
      const pts = Array.from(pointers.values());
      if (pts.length) lastPan = { x: pts[0].x, y: pts[0].y, tx: state.viewer.tx, ty: state.viewer.ty };
    }
  };

  viewerStage.addEventListener("pointerup", endPointer);
  viewerStage.addEventListener("pointercancel", endPointer);

  // One-finger swipe down to close (only when scale ~ 1)
  let startY = 0;
  viewerStage.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) startY = e.touches[0].clientY;
  }, { passive: true });

  viewerStage.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 120 && state.viewer.scale <= 1.05) closeViewer_();
  }, { passive: true });

  // Wheel zoom (desktop)
  viewerStage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const next = state.viewer.scale * (delta > 0 ? 0.92 : 1.08);
    state.viewer.scale = clamp(next, 0.5, 6);
    apply();
  }, { passive: false });

  reset();
}

function openViewer_(src){
  if (!modalViewer || !viewerImg) return;
  viewerImg.src = src;
  modalViewer.classList.remove("hidden");
  // reset transform
  state.viewer.scale = 1;
  state.viewer.tx = 0;
  state.viewer.ty = 0;
  viewerImg.style.transform = `translate(0px,0px) scale(1)`;
}
function closeViewer_(){ modalViewer?.classList.add("hidden"); }

// ====================== LINK INSERT ======================
function insertLinkFromSelection_(editableEl){
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
  a.style.textDecoration = "underline";
  a.style.color = "rgba(191,233,255,0.98)";
  a.appendChild(range.extractContents());
  range.insertNode(a);

  range.setStartAfter(a);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ====================== EVENTS ======================
function attachEvents_(){
  tabButtons.forEach(b => b.addEventListener("click", () => setTab_(b.dataset.tab)));

  btnAddItinerary?.addEventListener("click", () => openItModal_());
  btnAddItineraryBottom?.addEventListener("click", () => openItModal_());
  btnCloseItinerary?.addEventListener("click", closeItModal_);
  btnCancelIt?.addEventListener("click", closeItModal_);
  btnSaveIt?.addEventListener("click", saveItinerary_);

  btnOpenMap?.addEventListener("click", () => {
    const v = (itAddress?.value || "").trim();
    if (!v) return;
    const isUrl = /^https?:\/\//i.test(v);
    const target = isUrl ? v : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    window.open(target, "_blank");
  });

  btnLinkTitle?.addEventListener("click", () => insertLinkFromSelection_(itTitle));
  btnLinkNote?.addEventListener("click", () => insertLinkFromSelection_(itNote));

  // 長按（右鍵）設定 Itinerary 的 Link 欄位
  btnLinkTitle?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const u = prompt("設定此行程的 Link 欄位（可空白）", state.itDraftLink || "");
    if (u !== null) state.itDraftLink = u.trim();
  });

  itImage?.addEventListener("change", async () => {
    const f = itImage.files?.[0];
    if (!f) return;

    const dataUrl = await fileToDataUrl_(f);
    state.itDraftImageDataUrl = dataUrl;
    if (itImagePreview) itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${dataUrl}" alt="preview" />`;

    if (!navigator.onLine) {
      updateSyncBadge_();
      alert("目前離線：已先本地預覽。連線後可再次選取圖片上傳同步。");
      return;
    }

    setSyncBadge_("sync", "同步中");
    try {
      const res = await uploadImageToDrive_(f, dataUrl);
      state.itDraftDriveFileId = res.file_id;
      state.itDraftDriveUrl = res.direct_view_url;
      updateSyncBadge_();
    } catch (e) {
      console.warn(e);
      updateSyncBadge_();
      alert("圖片上傳失敗：已保留本地預覽。可稍後再試。");
    }
  });

  btnSplitAll?.addEventListener("click", () => {
    const activeCount = $$("#splitChooser .tag.active").length;
    const makeActive = activeCount !== PEOPLE.length;
    $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", makeActive));
  });

  btnAddExpense?.addEventListener("click", () => {
    if (state.editingExpenseId) saveExpenseEdit_();
    else addExpense_();
  });

  btnForceSync?.addEventListener("click", syncNow_);

  btnFilter?.addEventListener("click", openFilterModal_);
  btnCloseFilter?.addEventListener("click", closeFilterModal_);
  btnClearFilter?.addEventListener("click", () => { clearFilters_(); renderAnalysis_(); });
  btnApplyFilter?.addEventListener("click", () => { closeFilterModal_(); renderAnalysis_(); });

  btnFx?.addEventListener("click", () => {
    alert("匯率設定 UI 若你要我做，我可以把它做成小 modal（可輸入 NOK/ISK/EUR/GBP/AED → TWD）。目前若 LS.fx 沒值會以 1 計算。");
  });
}

// ====================== EDGE GESTURES (page swipe + date swipe) ======================
function setupEdgeGestures_(){
  // 你原本需求：邊緣左右滑動切換頁面、一般左右滑動切換日期
  // 這裡做簡化：偵測觸控開始位置是否在左右 18px 內
  let startX = 0, startY = 0, startAtEdge = false;

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startAtEdge = (startX <= 18 || startX >= (window.innerWidth - 18));
  };

  const onTouchEnd = (e) => {
    if (!startX) return;
    const endX = e.changedTouches?.[0]?.clientX ?? startX;
    const endY = e.changedTouches?.[0]?.clientY ?? startY;
    const dx = endX - startX;
    const dy = endY - startY;

    // avoid vertical scroll gestures
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    if (startAtEdge) {
      // switch tab
      const order = ["itinerary","expenses","analysis"];
      const idx = order.indexOf(state.tab);
      const next = dx < 0 ? clamp(idx+1, 0, order.length-1) : clamp(idx-1, 0, order.length-1);
      setTab_(order[next]);
      return;
    }

    // switch date (only in itinerary page)
    if (state.tab === "itinerary") {
      const chips = $$(".date-chip");
      const curIdx = chips.findIndex(c => c.dataset.date === state.selectedDate);
      const nextIdx = dx < 0 ? clamp(curIdx+1, 0, chips.length-1) : clamp(curIdx-1, 0, chips.length-1);
      const nextDate = chips[nextIdx]?.dataset.date;
      if (nextDate) setSelectedDate_(nextDate, true);
    }
  };

  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchend", onTouchEnd, { passive: true });
}

// ====================== PULL TO REFRESH ======================
function setupPullToRefresh_(containers){
  // Create indicator
  let ind = $("#ptrIndicator");
  if (!ind) {
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
    ind.style.color = "rgba(226,232,240,0.9)";
    ind.style.background = "rgba(15,23,42,0.72)";
    ind.style.backdropFilter = "blur(10px)";
    ind.style.transform = "translateY(-120%)";
    ind.style.transition = "transform 180ms ease";
    ind.textContent = "下拉重新整理";
    document.body.appendChild(ind);
  }

  const THRESH = 70;

  containers.forEach((el) => {
    if (!el) return;

    let pulling = false;
    let startY = 0;
    let dist = 0;

    const isAtTop = () => {
      // if element is page container, check window scroll too
      if (el === pageIt || el === pageEx || el === pageAn) return (window.scrollY <= 0);
      return (el.scrollTop <= 0);
    };

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      if (!isAtTop()) return;
      pulling = true;
      startY = e.touches[0].clientY;
      dist = 0;
    };

    const onMove = (e) => {
      if (!pulling) return;
      const y = e.touches[0].clientY;
      dist = Math.max(0, y - startY);
      if (dist > 8) e.preventDefault();
      const pct = clamp(dist / THRESH, 0, 1);
      ind.textContent = (dist >= THRESH) ? "放開即可重新整理" : "下拉重新整理";
      ind.style.transform = `translateY(${(-120 + pct*120)}%)`;
    };

    const onEnd = async () => {
      if (!pulling) return;
      pulling = false;

      if (dist >= THRESH) {
        ind.textContent = "重新整理中…";
        ind.style.transform = "translateY(0%)";
        try {
          if (!navigator.onLine) {
            ind.textContent = "目前離線，無法重新整理";
            setTimeout(() => ind.style.transform = "translateY(-120%)", 800);
            return;
          }
          await pullAll_();
          renderAll_();
          ind.textContent = "已更新";
          setTimeout(() => ind.style.transform = "translateY(-120%)", 500);
        } catch (e) {
          ind.textContent = "更新失敗";
          setTimeout(() => ind.style.transform = "translateY(-120%)", 800);
        }
      } else {
        ind.style.transform = "translateY(-120%)";
      }
      dist = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
  });
}

// ====================== OUTBOX / SYNC / PULL ======================
function queueOutbox_(op){
  const box = load(LS.outbox, []);
  box.push(op);
  save(LS.outbox, box);
  updateSyncBadge_();
}

async function maybeAutoSync_(){
  updateSyncBadge_();
  if (!navigator.onLine) return;
  const box = load(LS.outbox, []);
  if (!box.length) return;
  await syncNow_();
}

async function syncNow_(){
  if (!navigator.onLine) { updateSyncBadge_(); return; }

  const box = load(LS.outbox, []);
  if (!box.length) { updateSyncBadge_(); return; }

  setSyncBadge_("sync", "同步中");
  try {
    const payload = { action: "sync", ops: box };
    await postJsonNoPreflight_(GAS_URL, payload);

    await pullAll_();

    save(LS.outbox, []);
    updateSyncBadge_();
    renderAll_();
  } catch (e) {
    console.warn(e);
    updateSyncBadge_();
    alert("同步失敗：你可以稍後再試，或保持離線繼續記錄（會保留待上傳）。");
  }
}

async function pullAll_(){
  const url = `${GAS_URL}?action=pull`;
  const res = await fetch(url).then(r => r.json());
  if (!res?.ok || !Array.isArray(res.rows)) throw new Error("pull failed");
  mergePulled_(res.rows);
}

function mergePulled_(rows){
  const exp = [];
  const it  = [];

  for (const item of rows) {
    const table = item.table;
    const r = item.row || {};

    if (table === "Expenses") {
      exp.push({
        id: String(r.ID || ""),
        date: String(r.Date || ""),
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

    if (table === "Itinerary") {
      it.push({
        id: String(r.ID || ""),
        date: String(r.Date || ""),
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

async function postJsonNoPreflight_(url, payload){
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ====================== IMAGE UPLOAD ======================
async function uploadImageToDrive_(file, dataUrl){
  const payload = {
    action: "uploadImage",
    folder_id: DRIVE_FOLDER_ID,
    filename: file.name || `it_${Date.now()}.jpg`,
    mime_type: file.type || "image/jpeg",
    data_url: dataUrl
  };
  const res = await postJsonNoPreflight_(GAS_URL, payload);
  if (!res?.ok) throw new Error(res?.error || "uploadImage failed");
  return res;
}

function fileToDataUrl_(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ====================== RENDER ALL ======================
function renderAll_(){
  updateSyncBadge_();

  // restore tab if stored
  const ui = load(LS.ui, {});
  if (ui.tab && ["itinerary","expenses","analysis"].includes(ui.tab)) state.tab = ui.tab;

  setTab_(state.tab);
  renderItinerary_();
  renderExpenses_();
  if (state.tab === "analysis") renderAnalysis_();
}

/* =========================================================
 * ✅ 你需要加的一小段 CSS（放到 styles.css）
 * ---------------------------------------------------------
 * .pending-card { border: 2px dashed rgba(251,146,60,.95) !important; }
 * .pending-badge { padding: 2px 8px; border-radius: 999px; border: 1px dashed rgba(251,146,60,.95); color: rgba(251,146,60,.95); }
 * .link-soft { text-decoration: underline; color: rgba(191,233,255,0.98); }
 * ========================================================= */
