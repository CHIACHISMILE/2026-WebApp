// ====================== CONFIG ======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzfX8f3-CcY6X-nu7Sm545Xk5ysHRrWvwqWxBV0-YGX3Ss3ShJM6r9eDnXcoBNwBULhxw/exec";
const DRIVE_FOLDER_ID = "10ogmnlqLreB_PzSwyuQGtKzO759NVF3M";

const TRIP_NAME = "2026冰島挪威之旅";
const TRIP_START = "2026-08-30";
const TRIP_END   = "2026-09-26";
const BUDGET_JQ_TY = 500000; // NTD

const PEOPLE = ["家齊", "亭穎", "媽媽"];
const WHERE = ["臺灣", "挪威", "冰島", "杜拜", "英國"];
const EXP_CATEGORIES = ["早餐","午餐","晚餐","零食","住宿","交通（機票）","交通（租車）","交通（停車費）","交通（油錢）","交通（電費）","紀念品","門票","其他"];
const PAY = ["現金","信用卡－國泰","信用卡–永豐","信用卡–元大"];

const IT_CATEGORIES = ["景點","飲食","交通","住宿","其他"];
const IT_CAT_COLORS = {
  "景點": "rgba(154,215,255,0.20)",
  "飲食": "rgba(45,212,191,0.18)",
  "交通": "rgba(255,255,255,0.10)",
  "住宿": "rgba(191,233,255,0.14)",
  "其他": "rgba(255,255,255,0.08)"
};

// ====================== STORAGE ======================
const LS = {
  itinerary: "tripapp_itinerary_v1",
  expenses: "tripapp_expenses_v1",
  fx: "tripapp_fx_v1",
  outbox: "tripapp_outbox_v1",
  lastPull: "tripapp_lastpull_v1"
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function uid(prefix="X") {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth()+1).padStart(2,"0");
  const d = String(t.getDate()).padStart(2,"0");
  const rand = Math.random().toString(16).slice(2,8);
  return `${prefix}${y}${m}${d}-${rand}`;
}

// ====================== DATE HELPERS ======================
function parseLocalDate(yyyy_mm_dd) {
  const [y,m,d] = yyyy_mm_dd.split("-").map(Number);
  return new Date(y, m-1, d, 12, 0, 0);
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function fmtZh(d) { return `${d.getMonth()+1}/${d.getDate()}`; }
function weekdayZh(d) { return ["日","一","二","三","四","五","六"][d.getDay()]; }
function daysBetween(a,b) {
  const ms = (parseLocalDate(fmtDate(b)).getTime() - parseLocalDate(fmtDate(a)).getTime());
  return Math.round(ms / 86400000);
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

const tripStartD = parseLocalDate(TRIP_START);
const tripEndD = parseLocalDate(TRIP_END);
const tripDays = daysBetween(tripStartD, tripEndD) + 1;

function tripDayIndexFor(dateD){ return daysBetween(tripStartD, dateD) + 1; }

// ====================== DOM HELPERS ======================
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

// ====================== UI REFS ======================
const elTripDay = $("#tripDayLabel");
const elToday = $("#todayLabel");
const elSync = $("#syncStatus");
const btnForceSync = $("#btnForceSync");

const tabButtons = $$(".tab");
const pages = $("#pages");
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
const expenseList = $("#expenseList");
const btnExpFilterQuick = $("#btnExpFilterQuick");

const budgetRemain = $("#budgetRemain");
const budgetSpent = $("#budgetSpent");
const budgetBar = $("#budgetBar");
const pieCanvas = $("#pie");
const analysisExpenseList = $("#analysisExpenseList");
const settlement = $("#settlement");
const btnFx = $("#btnFx");
const btnFilter = $("#btnFilter");
const modalFilter = $("#modalFilter");
const btnCloseFilter = $("#btnCloseFilter");
const btnClearFilter = $("#btnClearFilter");
const btnApplyFilter = $("#btnApplyFilter");
const filterChips = $("#filterChips");

// Viewer
const modalViewer = $("#modalViewer");
const btnCloseViewer = $("#btnCloseViewer");
const btnResetViewer = $("#btnResetViewer");
const viewerStage = $("#viewerStage");
const viewerImg = $("#viewerImg");

// ====================== STATE ======================
let state = {
  tab: "itinerary",
  selectedDate: fmtDate(tripStartD),

  itDraftCat: "景點",
  itDraftImageDataUrl: "",
  itDraftDriveFileId: "",
  itDraftDriveUrl: "",
  editingItId: null,

  editingExpenseId: null,

  filter: {
    who: new Set(),
    where: new Set(),
    category: new Set(),
    pay: new Set()
  },

  pieChart: null
};

function setSyncStatus(mode) {
  const map = {
    wait: { dot: "dot-wait", text: "待同步" },
    sync: { dot: "dot-sync", text: "同步中" },
    offline: { dot: "dot-offline", text: "離線" }
  };
  const v = map[mode] || map.wait;
  elSync.innerHTML = `<span class="dot ${v.dot}"></span><span class="text-sm">${v.text}</span>`;
}

// ====================== INIT ======================
registerSW_();
renderHeader_();
buildDateStrip_();
buildItCatChooser_();
buildSplitChooser_();
buildFilterModal_();
renderAll_();
attachEvents_();
setupGestures_();

window.addEventListener("online", () => { setSyncStatus("wait"); maybeAutoSync_(); });
window.addEventListener("offline", () => { setSyncStatus("offline"); });
setInterval(renderHeader_, 60 * 1000);

function registerSW_(){
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

// ====================== HEADER ======================
function renderHeader_(){
  const now = new Date();
  elToday.textContent = `${now.getMonth()+1}/${now.getDate()}（${weekdayZh(now)}）`;

  const todayLocal = parseLocalDate(fmtDate(now));
  if (todayLocal < tripStartD) {
    elTripDay.textContent = `倒數 ${daysBetween(todayLocal, tripStartD)} 日`;
  } else if (todayLocal > tripEndD) {
    elTripDay.textContent = `旅行已結束`;
  } else {
    elTripDay.textContent = `第 ${tripDayIndexFor(todayLocal)} 日`;
  }

  if (!navigator.onLine) setSyncStatus("offline");
}

// ====================== DATE STRIP ======================
function buildDateStrip_(){
  dateStrip.innerHTML = "";
  for(let i=0;i<tripDays;i++){
    const d = new Date(tripStartD.getTime() + i*86400000);
    const key = fmtDate(d);
    const btn = document.createElement("button");
    btn.className = "date-chip";
    btn.dataset.date = key;
    btn.textContent = `${fmtZh(d)} ${weekdayZh(d)}`;
    btn.addEventListener("click", () => setSelectedDate_(key, true));
    dateStrip.appendChild(btn);
  }
  setSelectedDate_(state.selectedDate, true);
}

function setSelectedDate_(yyyy_mm_dd, scrollIntoView){
  state.selectedDate = yyyy_mm_dd;
  $$(".date-chip").forEach(b => b.classList.toggle("active", b.dataset.date === yyyy_mm_dd));

  const d = parseLocalDate(yyyy_mm_dd);
  selectedDateLabel.textContent = `${d.getMonth()+1}/${d.getDate()}（${weekdayZh(d)}）`;
  selectedDayIndexLabel.textContent = `Day ${tripDayIndexFor(d)}`;

  if (scrollIntoView) {
    const active = $(`.date-chip[data-date="${yyyy_mm_dd}"]`);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  renderItinerary_();
}

// ====================== TAB / PAGE ======================
function setTab_(tab){
  state.tab = tab;
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

  pageIt.classList.toggle("hidden", tab !== "itinerary");
  pageEx.classList.toggle("hidden", tab !== "expenses");
  pageAn.classList.toggle("hidden", tab !== "analysis");

  if (tab === "analysis") renderAnalysis_();
}

// ====================== ITINERARY ======================
function buildItCatChooser_(){
  itCatChooser.innerHTML = "";
  IT_CATEGORIES.forEach((cat, idx) => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = cat;
    b.addEventListener("click", () => {
      state.itDraftCat = cat;
      Array.from(itCatChooser.querySelectorAll(".tag")).forEach(x => x.classList.toggle("active", x.textContent === cat));
    });
    itCatChooser.appendChild(b);
    if (idx === 0) b.classList.add("active");
  });
  state.itDraftCat = IT_CATEGORIES[0];
}

function openItModal_(editId=null){
  state.editingItId = editId;
  modalItinerary.classList.remove("hidden");

  state.itDraftImageDataUrl = "";
  state.itDraftDriveFileId = "";
  state.itDraftDriveUrl = "";
  itImage.value = "";
  itImagePreview.innerHTML = "";

  if (!editId) {
    itModalTitle.textContent = "新增行程";
    btnSaveIt.textContent = "新增行程";
    itStart.value = "09:00";
    itEnd.value = "10:00";
    state.itDraftCat = IT_CATEGORIES[0];
    Array.from(itCatChooser.querySelectorAll(".tag")).forEach((x,i) => x.classList.toggle("active", i===0));
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
  Array.from(itCatChooser.querySelectorAll(".tag")).forEach(x => x.classList.toggle("active", x.textContent === state.itDraftCat));
  itTitle.innerHTML = it.titleHtml || "";
  itAddress.value = it.address || "";
  itNote.innerHTML = it.noteHtml || "";

  state.itDraftDriveFileId = it.imageDriveId || "";
  state.itDraftDriveUrl = it.imageDriveUrl || "";
  state.itDraftImageDataUrl = it.imageDataUrl || "";

  const imgSrc = state.itDraftDriveUrl || state.itDraftImageDataUrl;
  if (imgSrc) {
    itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${imgSrc}" alt="preview" />`;
  }
}

function closeItModal_(){ modalItinerary.classList.add("hidden"); }

function saveItinerary_(){
  const start = itStart.value || "";
  const end = itEnd.value || "";
  const category = state.itDraftCat;
  const titleHtml = itTitle.innerHTML.trim();
  const address = itAddress.value.trim();
  const noteHtml = itNote.innerHTML.trim();

  if (!titleHtml) return alert("請輸入標題");

  const driveFileId = state.itDraftDriveFileId || "";
  const driveUrl = state.itDraftDriveUrl || "";
  const imageDataUrl = state.itDraftImageDataUrl || "";

  const all = load(LS.itinerary, []);

  const baseRow = {
    trip: TRIP_NAME,
    date: state.selectedDate,
    start, end, category,
    titleHtml, address, noteHtml,
    imageDataUrl,
    imageDriveId: driveFileId,
    imageDriveUrl: driveUrl,
    deleted: 0,
    updated_at: new Date().toISOString()
  };

  let savedRow = null;

  if (!state.editingItId) {
    savedRow = {
      id: uid("IT"),
      created_at: new Date().toISOString(),
      ...baseRow
    };
    all.push(savedRow);
  } else {
    const idx = all.findIndex(x => x.id === state.editingItId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...baseRow };
      savedRow = all[idx];
    }
  }

  save(LS.itinerary, all);

  if (savedRow) {
    queueOutbox_({ op: "upsert", table: "itinerary", row: toSheetItineraryRow_(savedRow) });
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

  all[idx].deleted = 1;
  all[idx].updated_at = new Date().toISOString();
  save(LS.itinerary, all);

  queueOutbox_({ op: "delete", table: "itinerary", key: { id }});
  renderItinerary_();
  maybeAutoSync_();
}

function renderItinerary_(){
  const all = load(LS.itinerary, []);
  const items = all
    .filter(x => x.deleted !== 1 && x.date === state.selectedDate)
    .sort((a,b) => (a.start||"").localeCompare(b.start||""));

  itineraryList.innerHTML = "";

  if (!items.length) {
    itineraryList.innerHTML = `
      <div class="card p-4 text-sm text-slate-200/80">
        今天還沒有行程。可以按上方或下方的「新增行程」開始建立。
      </div>`;
    return;
  }

  items.forEach(it => {
    const catBg = IT_CAT_COLORS[it.category] || "rgba(255,255,255,0.08)";
    const time = (it.start || it.end) ? `${it.start||""}–${it.end||""}` : "";
    const addr = it.address ? `<div class="mt-2 text-xs text-slate-200/80 break-words">${escapeHtml_(it.address)}</div>` : "";

    const imgSrc = it.imageDriveUrl || it.imageDataUrl || "";
    const img = imgSrc
      ? `<div class="mt-3">
           <img class="rounded-2xl border border-white/10 cursor-pointer"
                data-view-src="${imgSrc}"
                src="${imgSrc}" alt="img"/>
         </div>`
      : "";

    const card = document.createElement("div");
    card.className = "card p-4";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="tag" style="background:${catBg}; border-color: rgba(255,255,255,0.12);">${escapeHtml_(it.category)}</span>
            <span class="text-xs text-slate-300/80">${escapeHtml_(time)}</span>
          </div>
          <div class="mt-2 text-base font-semibold leading-snug break-words">${it.titleHtml}</div>
          ${addr}
          ${it.noteHtml ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${it.noteHtml}</div>` : ""}
          ${img}
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

function toSheetItineraryRow_(it){
  return {
    id: it.id,
    trip: it.trip || TRIP_NAME,
    date: it.date,
    start: it.start || "",
    end: it.end || "",
    category: it.category || "",
    title_html: it.titleHtml || "",
    address: it.address || "",
    note_html: it.noteHtml || "",
    image_drive_id: it.imageDriveId || "",
    image_drive_url: it.imageDriveUrl || "",
    created_at: it.created_at || new Date().toISOString(),
    updated_at: it.updated_at || new Date().toISOString(),
    deleted: it.deleted ? 1 : 0
  };
}

// ====================== EXPENSES ======================
function buildSplitChooser_(){
  splitChooser.innerHTML = "";
  PEOPLE.forEach(p => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = p;
    b.dataset.value = p;
    b.addEventListener("click", () => b.classList.toggle("active"));
    splitChooser.appendChild(b);
  });

  expWho.addEventListener("change", () => setSplitDefault_(expWho.value));
  setSplitDefault_(expWho.value);
}

function setSplitDefault_(who){
  $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", b.dataset.value === who));
}

function getSplitSelected_(){
  return $$("#splitChooser .tag.active").map(b => b.dataset.value);
}

function addExpense_(){
  const who = expWho.value;
  const where = expWhere.value;
  const category = expCategory.value;
  const pay = expPay.value;
  const currency = expCurrency.value;
  const amount = Number(expAmount.value);
  const title = expTitle.value.trim();
  const note = expNote.value.trim();
  const split = getSplitSelected_();

  if (!title) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!split.length) return alert("請選擇分攤人員");

  // MVP FX: TWD=1 else use local fx store (if exists) else 1
  const fxStore = load(LS.fx, {});
  const fxKey = `${fmtDate(new Date())}:${currency}`;
  const fx_to_twd = currency === "TWD" ? 1 : (Number(fxStore[fxKey]) || 1);
  const amount_twd = Math.round(amount * fx_to_twd);

  const row = {
    id: uid("E"),
    trip: TRIP_NAME,
    date: state.selectedDate,
    ts: new Date().toISOString(),

    who, where,
    category,
    pay,
    currency,
    amount,
    fx_to_twd,
    amount_twd,

    title,
    note,
    split,

    deleted: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const all = load(LS.expenses, []);
  all.push(row);
  save(LS.expenses, all);

  queueOutbox_({ op: "upsert", table: "expenses", row: toSheetExpenseRow_(row) });

  expAmount.value = "";
  expTitle.value = "";
  expNote.value = "";
  setSplitDefault_(who);

  renderExpenses_();
  renderAnalysis_();
  maybeAutoSync_();
}

function editExpense_(id){
  const all = load(LS.expenses, []);
  const e = all.find(x => x.id === id);
  if (!e) return;

  state.editingExpenseId = id;
  setTab_("expenses");

  expWho.value = e.who;
  expWhere.value = e.where;
  expCategory.value = e.category;
  expPay.value = e.pay;
  expCurrency.value = e.currency;
  expAmount.value = e.amount;
  expTitle.value = e.title;
  expNote.value = e.note || "";

  $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", (e.split||[]).includes(b.dataset.value)));

  btnAddExpense.textContent = "儲存變更";
}

function saveExpenseEdit_(){
  const id = state.editingExpenseId;
  if (!id) return;

  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  const who = expWho.value;
  const where = expWhere.value;
  const category = expCategory.value;
  const pay = expPay.value;
  const currency = expCurrency.value;
  const amount = Number(expAmount.value);
  const title = expTitle.value.trim();
  const note = expNote.value.trim();
  const split = getSplitSelected_();

  if (!title) return alert("請輸入消費名稱");
  if (!Number.isFinite(amount) || amount <= 0) return alert("請輸入正確金額");
  if (!split.length) return alert("請選擇分攤人員");

  const fxStore = load(LS.fx, {});
  const fxKey = `${fmtDate(new Date())}:${currency}`;
  const fx_to_twd = currency === "TWD" ? 1 : (Number(fxStore[fxKey]) || all[idx].fx_to_twd || 1);
  const amount_twd = Math.round(amount * fx_to_twd);

  all[idx] = {
    ...all[idx],
    who, where, category, pay,
    currency, amount,
    fx_to_twd, amount_twd,
    title, note, split,
    updated_at: new Date().toISOString()
  };
  save(LS.expenses, all);

  queueOutbox_({ op:"upsert", table:"expenses", row: toSheetExpenseRow_(all[idx]) });

  state.editingExpenseId = null;
  btnAddExpense.textContent = "確認記帳";
  expAmount.value = ""; expTitle.value = ""; expNote.value = "";
  setSplitDefault_(expWho.value);

  renderExpenses_();
  renderAnalysis_();
  maybeAutoSync_();
}

function deleteExpense_(id){
  if (!confirm("確定刪除這筆消費？")) return;
  const all = load(LS.expenses, []);
  const idx = all.findIndex(x => x.id === id);
  if (idx < 0) return;

  all[idx].deleted = 1;
  all[idx].updated_at = new Date().toISOString();
  save(LS.expenses, all);

  queueOutbox_({ op:"delete", table:"expenses", key:{ id } });

  renderExpenses_();
  renderAnalysis_();
  maybeAutoSync_();
}

function renderExpenses_(){
  const all = load(LS.expenses, []).filter(x => x.deleted !== 1);
  const items = all.slice().sort((a,b) => (b.ts||"").localeCompare(a.ts||""));

  expenseList.innerHTML = "";
  if (!items.length) {
    expenseList.innerHTML = `<div class="card p-4 text-sm text-slate-200/80">尚無消費紀錄。</div>`;
    return;
  }

  items.forEach(e => {
    const sub = (e.currency === "TWD")
      ? ""
      : `<div class="text-xs text-slate-300/80">${e.currency} ${fmtMoney_(e.amount)} @ ${e.fx_to_twd}</div>`;

    const card = document.createElement("div");
    card.className = "card p-4";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-base font-semibold break-words">${escapeHtml_(e.title)}</div>
          <div class="mt-1 text-sm text-slate-200/90">${escapeHtml_(e.who)} • ${escapeHtml_(e.where)} • ${escapeHtml_(e.category)} • ${escapeHtml_(e.pay)}</div>
          <div class="mt-2 text-2xl font-semibold">NT$ ${fmtMoney_(e.amount_twd)}</div>
          ${sub}
          ${e.note ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${escapeHtml_(e.note)}</div>` : ""}
          <div class="mt-2 text-xs text-slate-300/80">分攤：${(e.split||[]).join("、")}</div>
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

function toSheetExpenseRow_(e){
  return {
    id: e.id,
    trip: e.trip,
    date: e.date,
    ts: e.ts,
    city: "",
    country: "",
    category: e.category,
    merchant: e.title,
    amount: e.amount,
    currency: e.currency,
    fx_to_twd: e.fx_to_twd,
    amount_twd: e.amount_twd,
    pay_method: e.pay,
    tags: "",
    note: e.note,
    receipt_drive_id: "",
    created_at: e.created_at,
    updated_at: e.updated_at,
    deleted: e.deleted ? 1 : 0,
    who: e.who,
    where: e.where,
    split: (e.split||[]).join(",")
  };
}

// ====================== ANALYSIS ======================
function renderAnalysis_(){
  const all = load(LS.expenses, []).filter(x => x.deleted !== 1);

  const filtered = all.filter(e => {
    const f = state.filter;
    if (f.who.size && !f.who.has(e.who)) return false;
    if (f.where.size && !f.where.has(e.where)) return false;
    if (f.category.size && !f.category.has(e.category)) return false;
    if (f.pay.size && !f.pay.has(e.pay)) return false;
    return true;
  });

  const jqTy = all.filter(e => e.who === "家齊" || e.who === "亭穎");
  const spent = jqTy.reduce((s,e)=> s + Number(e.amount_twd||0), 0);
  const remain = Math.max(0, BUDGET_JQ_TY - spent);
  budgetSpent.textContent = `NT$ ${fmtMoney_(spent)}`;
  budgetRemain.textContent = `NT$ ${fmtMoney_(remain)}`;
  budgetBar.style.width = `${clamp((spent / BUDGET_JQ_TY) * 100, 0, 100)}%`;

  const byCat = {};
  filtered.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_twd||0); });
  const labels = Object.keys(byCat);
  const values = labels.map(k => byCat[k]);
  renderPie_(labels, values);

  analysisExpenseList.innerHTML = "";
  const items = filtered.slice().sort((a,b)=> (b.ts||"").localeCompare(a.ts||""));
  if (!items.length) {
    analysisExpenseList.innerHTML = `<div class="card p-4 text-sm text-slate-200/80">沒有符合條件的消費。</div>`;
  } else {
    items.forEach(e => {
      const sub = (e.currency === "TWD") ? "" : `${e.currency} ${fmtMoney_(e.amount)} @ ${e.fx_to_twd}`;
      const card = document.createElement("div");
      card.className = "card p-4";
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="text-base font-semibold break-words">${escapeHtml_(e.title)}</div>
              <div class="text-lg font-semibold">NT$ ${fmtMoney_(e.amount_twd)}</div>
            </div>
            <div class="mt-1 text-sm text-slate-200/90">${escapeHtml_(e.who)} • ${escapeHtml_(e.where)} • ${escapeHtml_(e.category)} • ${escapeHtml_(e.pay)}</div>
            <div class="mt-1 text-xs text-slate-300/80">${escapeHtml_(sub)}</div>
            <div class="mt-2 text-xs text-slate-300/80">分攤：${(e.split||[]).join("、")}</div>
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

  renderFilterChips_();
  renderSettlement_(all);
}

function renderPie_(labels, values){
  if (!pieCanvas) return;
  if (state.pieChart) state.pieChart.destroy();

  state.pieChart = new Chart(pieCanvas, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values }] },
    options: {
      plugins: {
        legend: { labels: { color: "rgba(255,255,255,0.85)" } },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: NT$ ${fmtMoney_(ctx.raw || 0)}` }
        }
      }
    }
  });
}

function renderSettlement_(allExpenses){
  const bal = { "家齊": 0, "亭穎": 0, "媽媽": 0 };

  allExpenses.forEach(e => {
    const total = Number(e.amount_twd||0);
    const payer = e.who;
    const splits = (e.split||[]).filter(x => PEOPLE.includes(x));
    if (!splits.length) return;

    const share = total / splits.length;
    bal[payer] += total;
    splits.forEach(p => { bal[p] -= share; });
  });

  const debtors = PEOPLE.map(p => ({ p, v: -bal[p] })).filter(x => x.v > 1).sort((a,b)=>b.v-a.v);
  const creditors = PEOPLE.map(p => ({ p, v: bal[p] })).filter(x => x.v > 1).sort((a,b)=>b.v-a.v);

  const transfers = [];
  let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const d = debtors[i], c = creditors[j];
    const amt = Math.min(d.v, c.v);
    transfers.push(`${d.p} → ${c.p}：NT$ ${fmtMoney_(Math.round(amt))}`);
    d.v -= amt; c.v -= amt;
    if (d.v <= 1) i++;
    if (c.v <= 1) j++;
  }

  settlement.textContent = transfers.length ? transfers.join("； ") : "目前不需要轉帳。";
}

// ====================== FILTER ======================
function buildFilterModal_(){
  const groups = { who: PEOPLE, where: WHERE, category: EXP_CATEGORIES, pay: PAY };
  Object.entries(groups).forEach(([k, arr]) => {
    const wrap = modalFilter.querySelector(`[data-filter-group="${k}"]`);
    wrap.innerHTML = "";
    arr.forEach(val => {
      const b = document.createElement("button");
      b.className = "tag";
      b.textContent = val;
      b.addEventListener("click", () => b.classList.toggle("active"));
      wrap.appendChild(b);
    });
  });
}

function openFilterModal_(){
  ["who","where","category","pay"].forEach(k => {
    const wrap = modalFilter.querySelector(`[data-filter-group="${k}"]`);
    Array.from(wrap.querySelectorAll(".tag")).forEach(btn => {
      btn.classList.toggle("active", state.filter[k].has(btn.textContent));
    });
  });
  modalFilter.classList.remove("hidden");
}
function closeFilterModal_(){ modalFilter.classList.add("hidden"); }

function applyFilter_(){
  ["who","where","category","pay"].forEach(k => {
    const wrap = modalFilter.querySelector(`[data-filter-group="${k}"]`);
    const active = Array.from(wrap.querySelectorAll(".tag.active")).map(b => b.textContent);
    state.filter[k] = new Set(active);
  });
  closeFilterModal_();
  renderAnalysis_();
}

function clearFilter_(){
  state.filter = { who:new Set(), where:new Set(), category:new Set(), pay:new Set() };
  closeFilterModal_();
  renderAnalysis_();
}

function renderFilterChips_(){
  filterChips.innerHTML = "";
  const pairs = [];
  for (const k of ["who","where","category","pay"]) for (const v of state.filter[k]) pairs.push({k,v});
  pairs.slice(0, 8).forEach(({k,v}) => {
    const b = document.createElement("button");
    b.className = "tag active";
    b.textContent = v + " ✕";
    b.addEventListener("click", () => { state.filter[k].delete(v); renderAnalysis_(); });
    filterChips.appendChild(b);
  });
}

// ====================== OUTBOX + SYNC ======================
function queueOutbox_(op){
  const box = load(LS.outbox, []);
  box.push(op);
  save(LS.outbox, box);
  if (navigator.onLine) setSyncStatus("wait");
}

async function maybeAutoSync_(){
  if (!navigator.onLine) return;
  const box = load(LS.outbox, []);
  if (!box.length) return;
  await syncNow_();
}

async function syncNow_(){
  if (!navigator.onLine) { setSyncStatus("offline"); return; }

  const box = load(LS.outbox, []);
  if (!box.length) { setSyncStatus("wait"); return; }

  setSyncStatus("sync");
  try {
    const ops = box.filter(o => (o.table === "expenses" || o.table === "itinerary" || o.table === "fx_rates"));
    if (ops.length) {
      const payload = { action: "sync", client_id: "iphone-webapp", ops };
      await postJsonNoPreflight_(GAS_URL, payload);
    }

    const lastPull = localStorage.getItem(LS.lastPull) || "1970-01-01T00:00:00+00:00";
    const pullUrl = `${GAS_URL}?action=pull&trip=${encodeURIComponent(TRIP_NAME)}&updated_after=${encodeURIComponent(lastPull)}`;
    const pulled = await fetch(pullUrl).then(r => r.json());

    if (pulled?.ok && Array.isArray(pulled.rows)) {
      mergePulled_(pulled.rows);
      localStorage.setItem(LS.lastPull, pulled.server_time || new Date().toISOString());
    }

    save(LS.outbox, []);
    setSyncStatus("wait");

    renderItinerary_();
    renderExpenses_();
    renderAnalysis_();
  } catch (e) {
    console.warn(e);
    setSyncStatus("wait");
  }
}

async function postJsonNoPreflight_(url, payload){
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

function mergePulled_(rows){
  const expenses = load(LS.expenses, []);
  const expById = new Map(expenses.map(x => [x.id, x]));

  const itinerary = load(LS.itinerary, []);
  const itById = new Map(itinerary.map(x => [x.id, x]));

  rows.forEach(item => {
    const r = item.row || {};
    const table = item.table;

    if (table === "expenses") {
      const id = String(r.id || "");
      if (!id) return;

      const local = {
        id,
        trip: r.trip || TRIP_NAME,
        date: r.date || state.selectedDate,
        ts: r.ts || new Date().toISOString(),
        who: r.who || "",
        where: r.where || "",
        category: r.category || "",
        pay: r.pay_method || "",
        currency: r.currency || "TWD",
        amount: Number(r.amount || 0),
        fx_to_twd: Number(r.fx_to_twd || 1),
        amount_twd: Number(r.amount_twd || 0),
        title: r.merchant || "",
        note: r.note || "",
        split: (r.split ? String(r.split).split(",") : []),
        deleted: Number(r.deleted || 0),
        created_at: r.created_at || "",
        updated_at: r.updated_at || ""
      };

      const prev = expById.get(id);
      const prevT = new Date(prev?.updated_at || 0).getTime();
      const newT = new Date(local.updated_at || 0).getTime();
      if (!prev || newT >= prevT) expById.set(id, local);
      return;
    }

    if (table === "itinerary") {
      const id = String(r.id || "");
      if (!id) return;

      const local = {
        id,
        trip: r.trip || TRIP_NAME,
        date: r.date || state.selectedDate,
        start: r.start || "",
        end: r.end || "",
        category: r.category || "",
        titleHtml: r.title_html || "",
        address: r.address || "",
        noteHtml: r.note_html || "",
        imageDriveId: r.image_drive_id || "",
        imageDriveUrl: r.image_drive_url || "",
        imageDataUrl: "",
        deleted: Number(r.deleted || 0),
        created_at: r.created_at || "",
        updated_at: r.updated_at || ""
      };

      const prev = itById.get(id);
      const prevT = new Date(prev?.updated_at || 0).getTime();
      const newT = new Date(local.updated_at || 0).getTime();
      if (!prev || newT >= prevT) itById.set(id, local);
      return;
    }

    if (table === "fx_rates") {
      // MVP: 可先忽略或之後再加 UI（你要我再做匯率設定面板我可以直接補）
      return;
    }
  });

  save(LS.expenses, Array.from(expById.values()));
  save(LS.itinerary, Array.from(itById.values()));
}

// ====================== IMAGE UPLOAD + VIEWER ======================
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

function openViewer_(src){
  viewerImg.src = src;
  modalViewer.classList.remove("hidden");
  resetViewer_();
}
function closeViewer_(){
  modalViewer.classList.add("hidden");
  viewerImg.src = "";
}
btnCloseViewer.addEventListener("click", closeViewer_);
btnResetViewer.addEventListener("click", resetViewer_);

// pan/zoom with pointer events
let v = { scale: 1, x: 0, y: 0, startX: 0, startY: 0, panning: false, lastY: 0 };
let pointers = new Map();
let pinchStart = { dist: 0, scale: 1 };

function applyViewerTransform_(){
  viewerImg.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
}
function resetViewer_(){
  v.scale = 1; v.x = 0; v.y = 0;
  applyViewerTransform_();
}

viewerStage.addEventListener("pointerdown", (e) => {
  viewerStage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  v.startX = e.clientX - v.x;
  v.startY = e.clientY - v.y;
  v.lastY = e.clientY;
  v.panning = true;

  if (pointers.size === 2) {
    const pts = Array.from(pointers.values());
    pinchStart.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    pinchStart.scale = v.scale;
  }
});

viewerStage.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    const pts = Array.from(pointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const ratio = dist / (pinchStart.dist || dist);
    v.scale = clamp(pinchStart.scale * ratio, 1, 4);
    applyViewerTransform_();
    return;
  }

  if (v.panning && pointers.size === 1) {
    const dx = e.clientX - v.startX;
    const dy = e.clientY - v.startY;

    const pullDown = (v.scale <= 1.02) && (dy > 120);
    v.x = dx;
    v.y = dy;
    applyViewerTransform_();

    if (pullDown) closeViewer_();
  }
});

viewerStage.addEventListener("pointerup", (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart.dist = 0;
  v.panning = false;
});
viewerStage.addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
  v.panning = false;
});

// ====================== GESTURES ======================
function setupGestures_(){
  let sx=0, sy=0, started=false, edgeMode=false, dateMode=false;
  const EDGE = 18;
  const TH = 55;

  pages.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    started = true;

    const w = window.innerWidth;
    edgeMode = (sx <= EDGE || sx >= (w-EDGE));
    dateMode = !edgeMode && state.tab === "itinerary";
    if (e.target.closest("#dateStrip")) dateMode = false;
  }, { passive:true });

  pages.addEventListener("touchend", (e) => {
    if (!started) return;
    started = false;

    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    if (!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if (Math.abs(dx) < TH || Math.abs(dx) < Math.abs(dy)) return;

    if (edgeMode) {
      const order = ["itinerary","expenses","analysis"];
      const idx = order.indexOf(state.tab);
      const next = dx < 0 ? idx+1 : idx-1;
      if (next >=0 && next < order.length) setTab_(order[next]);
      return;
    }

    if (dateMode) {
      const cur = parseLocalDate(state.selectedDate);
      const curIdx = daysBetween(tripStartD, cur);
      const nextIdx = dx < 0 ? curIdx+1 : curIdx-1;
      if (nextIdx >= 0 && nextIdx < tripDays) {
        const d = new Date(tripStartD.getTime() + nextIdx*86400000);
        setSelectedDate_(fmtDate(d), true);
      }
      return;
    }
  }, { passive:true });
}

// ====================== EVENTS ======================
function attachEvents_(){
  tabButtons.forEach(b => b.addEventListener("click", () => setTab_(b.dataset.tab)));

  btnAddItinerary.addEventListener("click", () => openItModal_());
  btnAddItineraryBottom.addEventListener("click", () => openItModal_());
  btnCloseItinerary.addEventListener("click", closeItModal_);
  btnCancelIt.addEventListener("click", closeItModal_);
  btnSaveIt.addEventListener("click", saveItinerary_);

  btnOpenMap.addEventListener("click", () => {
    const url = itAddress.value.trim();
    if (!url) return;
    const isUrl = /^https?:\/\//i.test(url);
    const target = isUrl ? url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(url)}`;
    window.open(target, "_blank");
  });

  itImage.addEventListener("change", async () => {
    const f = itImage.files?.[0];
    if (!f) return;

    // local preview
    const dataUrl = await fileToDataUrl_(f);
    state.itDraftImageDataUrl = dataUrl;
    itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${dataUrl}" alt="preview" />`;

    if (!navigator.onLine) {
      alert("目前離線：已先本地預覽。連線後重新選取圖片即可上傳同步。");
      return;
    }

    setSyncStatus("sync");
    try {
      const res = await uploadImageToDrive_(f, dataUrl);
      state.itDraftDriveFileId = res.file_id;
      state.itDraftDriveUrl = res.direct_view_url;
      setSyncStatus("wait");
    } catch (e) {
      console.warn(e);
      setSyncStatus("wait");
      alert("圖片上傳失敗：已保留本地預覽。你可以稍後重試。");
    }
  });

  btnLinkTitle.addEventListener("click", () => insertLinkFromSelection_(itTitle));
  btnLinkNote.addEventListener("click", () => insertLinkFromSelection_(itNote));

  btnSplitAll.addEventListener("click", () => {
    const activeCount = $$("#splitChooser .tag.active").length;
    const makeActive = activeCount !== PEOPLE.length;
    $$("#splitChooser .tag").forEach(b => b.classList.toggle("active", makeActive));
  });

  btnAddExpense.addEventListener("click", () => {
    if (state.editingExpenseId) saveExpenseEdit_();
    else addExpense_();
  });

  btnForceSync.addEventListener("click", syncNow_);

  btnFilter.addEventListener("click", openFilterModal_);
  btnCloseFilter.addEventListener("click", closeFilterModal_);
  btnClearFilter.addEventListener("click", clearFilter_);
  btnApplyFilter.addEventListener("click", applyFilter_);

  btnFx.addEventListener("click", () => {
    alert("匯率設定面板（下一版）：會把匯率寫入 fx_rates 並自動套用到記帳。");
  });

  btnExpFilterQuick.addEventListener("click", () => { setTab_("analysis"); openFilterModal_(); });
}

// ====================== RENDER ALL ======================
function renderAll_(){
  setTab_(state.tab);
  renderItinerary_();
  renderExpenses_();
  renderAnalysis_();
}

// ====================== UTILS ======================
function fmtMoney_(n){ return Number(n||0).toLocaleString("zh-Hant-TW"); }

function escapeHtml_(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fileToDataUrl_(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

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
  a.style.color = "rgba(154,215,255,0.95)";

  try {
    a.appendChild(range.extractContents());
    range.insertNode(a);
    range.setStartAfter(a);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    alert("插入連結失敗，請重試");
  }
}
