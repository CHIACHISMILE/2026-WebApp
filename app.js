// ====================== CONFIG ======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzfX8f3-CcY6X-nu7Sm545Xk5ysHRrWvwqWxBV0-YGX3Ss3ShJM6r9eDnXcoBNwBULhxw/exec";
const DRIVE_FOLDER_ID = "10ogmnlqLreB_PzSwyuQGtKzO759NVF3M";
const TRIP_NAME = "2026冰島挪威之旅";
const TRIP_START = "2026-08-30"; // local date
const TRIP_END   = "2026-09-26";
const BUDGET_JQ_TY = 500000; // NTD

// Drive folder (used later when you add GAS upload endpoint)
const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/10ogmnlqLreB_PzSwyuQGtKzO759NVF3M?usp=share_link";

const PEOPLE = ["家齊", "亭穎", "媽媽"];
const WHERE = ["臺灣", "挪威", "冰島", "杜拜", "英國"];
const EXP_CATEGORIES = ["早餐","午餐","晚餐","零食","住宿","交通（機票）","交通（租車）","交通（停車費）","交通（油錢）","交通（電費）","紀念品","門票","其他"];
const PAY = ["現金","信用卡－國泰","信用卡–永豐","信用卡–元大"];
const CURRENCIES = ["TWD","NOK","ISK","EUR","GBP","AED"];

const IT_CATEGORIES = ["景點","飲食","交通","住宿","其他"];
const IT_CAT_COLORS = {
  "景點": "rgba(154,215,255,0.20)",
  "飲食": "rgba(45,212,191,0.18)",
  "交通": "rgba(255,255,255,0.10)",
  "住宿": "rgba(191,233,255,0.14)",
  "其他": "rgba(255,255,255,0.08)",
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
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

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
  return new Date(y, m-1, d, 12, 0, 0); // noon to avoid TZ edge
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function fmtZh(d) {
  const m = d.getMonth()+1;
  const day = d.getDate();
  return `${m}/${day}`;
}
function weekdayZh(d) {
  return ["日","一","二","三","四","五","六"][d.getDay()];
}
function daysBetween(a,b) { // b - a (in days)
  const ms = (parseLocalDate(fmtDate(b)).getTime() - parseLocalDate(fmtDate(a)).getTime());
  return Math.round(ms / 86400000);
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

const tripStartD = parseLocalDate(TRIP_START);
const tripEndD = parseLocalDate(TRIP_END);
const tripDays = daysBetween(tripStartD, tripEndD) + 1;

function tripDayIndexFor(dateD){
  // 1-based day index during trip
  const idx = daysBetween(tripStartD, dateD) + 1;
  return idx;
}

// ====================== UI REFS ======================
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

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

const modalViewer = $("#modalViewer");
const btnCloseViewer = $("#btnCloseViewer");
const btnResetViewer = $("#btnResetViewer");
const viewerStage = $("#viewerStage");
const viewerImg = $("#viewerImg");


// ====================== APP STATE ======================
let state = {
  tab: "itinerary",
  selectedDate: fmtDate(tripStartD),
  itDraftCat: "景點",
  itDraftImageDataUrl: "",
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
  // mode: "wait" | "sync" | "offline"
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

// ====================== SERVICE WORKER ======================
function registerSW_(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

// ====================== HEADER ======================
function renderHeader_(){
  const now = new Date();
  const todayStr = `${now.getMonth()+1}/${now.getDate()}（${weekdayZh(now)}）`;
  elToday.textContent = todayStr;

  const start = tripStartD;
  const end = tripEndD;

  const todayLocal = parseLocalDate(fmtDate(now));
  if (todayLocal < start) {
    const d = daysBetween(todayLocal, start);
    elTripDay.textContent = `倒數 ${d} 日`;
  } else if (todayLocal > end) {
    elTripDay.textContent = `旅行已結束`;
  } else {
    const dayX = tripDayIndexFor(todayLocal);
    elTripDay.textContent = `第 ${dayX} 日`;
  }

  // status
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
  IT_CATEGORIES.forEach(cat => {
    const b = document.createElement("button");
    b.className = "tag";
    b.textContent = cat;
    b.addEventListener("click", () => {
      state.itDraftCat = cat;
      $$("#itCatChooser .tag").forEach(x => x.classList.toggle("active", x.textContent === cat));
    });
    itCatChooser.appendChild(b);
  });
  // default
  state.itDraftCat = IT_CATEGORIES[0];
  $$("#itCatChooser .tag")[0]?.classList.add("active");
}

function openItModal_(editId=null){
  state.editingItId = editId;
  modalItinerary.classList.remove("hidden");

  // reset draft
  state.itDraftImageDataUrl = "";
  state.itDraftDriveFileId = it.imageDriveId || "";
  state.itDraftDriveUrl = it.imageDriveUrl || "";
  itImage.value = "";
  itImagePreview.innerHTML = "";

  if (!editId) {
    itStart.value = "09:00";
    itEnd.value = "10:00";
    state.itDraftCat = IT_CATEGORIES[0];
    $$("#itCatChooser .tag").forEach((x,i) => x.classList.toggle("active", i===0));
    itTitle.innerHTML = "";
    itAddress.value = "";
    itNote.innerHTML = "";
    btnSaveIt.textContent = "新增行程";
    $(".modal-head .text-base")?.textContent && ($(".modal-head .text-base").textContent = "新增行程");
    return;
  }

  // load existing
  const all = load(LS.itinerary, []);
  const it = all.find(x => x.id === editId);
  if (!it) return;

  itStart.value = it.start || "";
  itEnd.value = it.end || "";
  state.itDraftCat = it.category || IT_CATEGORIES[0];
  $$("#itCatChooser .tag").forEach(x => x.classList.toggle("active", x.textContent === state.itDraftCat));
  itTitle.innerHTML = it.titleHtml || "";
  itAddress.value = it.address || "";
  itNote.innerHTML = it.noteHtml || "";
  state.itDraftImageDataUrl = it.imageDataUrl || "";
  if (state.itDraftImageDataUrl) {
    itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${state.itDraftImageDataUrl}" alt="preview" />`;
  }

  btnSaveIt.textContent = "儲存變更";
  $(".modal-head .text-base")?.textContent && ($(".modal-head .text-base").textContent = "編輯行程");
}

function closeItModal_(){
  modalItinerary.classList.add("hidden");
}

function saveItinerary_(){
  const start = itStart.value || "";
  const end = itEnd.value || "";
  const category = state.itDraftCat;
  const titleHtml = itTitle.innerHTML.trim();
  const address = itAddress.value.trim();
  const noteHtml = itNote.innerHTML.trim();
  const imageDataUrl = state.itDraftImageDataUrl;
  const driveFileId = state.itDraftDriveFileId || "";
  const driveUrl = state.itDraftDriveUrl || "";

  if (!titleHtml) {
    alert("請輸入標題");
    return;
  }

  const all = load(LS.itinerary, []);
  if (!state.editingItId) {
    all.push({
      id: uid("IT"),
      date: state.selectedDate,
      start, end, category,
      titleHtml, address, noteHtml,
      imageDataUrl,
      imageDriveId: driveFileId,
      imageDriveUrl: driveUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } else {
    const idx = all.findIndex(x => x.id === state.editingItId);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        date: state.selectedDate,
        start, end, category,
        titleHtml, address, noteHtml,
        imageDataUrl,
        updated_at: new Date().toISOString()
      };
    }
  }

  save(LS.itinerary, all);
  queueOutbox_({ op: "upsert", table: "itinerary", row: { /* 初版：先留空，等你GAS加表再開 */ }});
  closeItModal_();
  renderItinerary_();
}

function deleteItinerary_(id){
  if (!confirm("確定刪除這筆行程？")) return;
  const all = load(LS.itinerary, []);
  save(LS.itinerary, all.filter(x => x.id !== id));
  queueOutbox_({ op: "delete", table: "itinerary", key: { id }});
  renderItinerary_();
}

function renderItinerary_(){
  const all = load(LS.itinerary, []);
  const items = all
    .filter(x => x.date === state.selectedDate)
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
    const imgEl = card.querySelector("img[data-view-src]");
    if (imgEl) {
      imgEl.addEventListener("click", () => openViewer_(imgEl.dataset.viewSrc));
    }
    const card = document.createElement("div");
    card.className = "card p-4";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="tag" style="background:${catBg}; border-color: rgba(255,255,255,0.12);">${it.category}</span>
            <span class="text-xs text-slate-300/80">${time}</span>
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

    itineraryList.appendChild(card);
  });
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

  // default: match "who"
  expWho.addEventListener("change", () => {
    setSplitDefault_(expWho.value);
  });
  setSplitDefault_(expWho.value);
}

function setSplitDefault_(who){
  $$("#splitChooser .tag").forEach(b => {
    b.classList.toggle("active", b.dataset.value === who);
  });
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

  // 初版匯率：TWD=1；其他先用本地 fx table 或手填（先簡化為 1，之後接 fx_rates）
  const fx = load(LS.fx, {});
  const key = `${fmtDate(new Date())}:${currency}`;
  const fx_to_twd = currency === "TWD" ? 1 : (Number(fx[key]) || 1);
  const amount_twd = Math.round(amount * fx_to_twd);

  const row = {
    id: uid("E"),
    trip: TRIP_NAME,
    date: state.selectedDate,
    ts: new Date().toISOString(),
    who, where, category, pay,
    currency, amount,
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

  queueOutbox_({
    op: "upsert",
    table: "expenses",
    row: toSheetExpenseRow_(row)
  });

  // reset some fields
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

  // quick edit: reuse form + mark editing
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

  // split
  $$("#splitChooser .tag").forEach(b => {
    b.classList.toggle("active", (e.split||[]).includes(b.dataset.value));
  });

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

  const fx = load(LS.fx, {});
  const key = `${fmtDate(new Date())}:${currency}`;
  const fx_to_twd = currency === "TWD" ? 1 : (Number(fx[key]) || all[idx].fx_to_twd || 1);
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

  // reset editing state
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
  // Map to the sheet header style we discussed earlier.
  // You can adjust columns later to match your final Sheet schema.
  return {
    id: e.id,
    trip: e.trip,
    date: e.date,
    ts: e.ts,
    city: "",          // not in your form yet
    country: "",       // not in your form yet
    category: e.category,
    merchant: e.title, // store as merchant/title
    amount: e.amount,
    currency: e.currency,
    fx_to_twd: e.fx_to_twd,
    amount_twd: e.amount_twd,
    pay_method: e.pay,
    tags: "",          // optional later
    note: e.note,
    receipt_drive_id: "",
    created_at: e.created_at,
    updated_at: e.updated_at,
    deleted: e.deleted ? 1 : 0,

    // extra fields not in sheet can be ignored by GAS (it writes only known headers)
    who: e.who,
    where: e.where,
    split: (e.split||[]).join(",")
  };
}

// ====================== ANALYSIS ======================
function renderAnalysis_(){
  const all = load(LS.expenses, []).filter(x => x.deleted !== 1);

  // Apply filter
  const filtered = all.filter(e => {
    const f = state.filter;
    if (f.who.size && !f.who.has(e.who)) return false;
    if (f.where.size && !f.where.has(e.where)) return false;
    if (f.category.size && !f.category.has(e.category)) return false;
    if (f.pay.size && !f.pay.has(e.pay)) return false;
    return true;
  });

  // Budget for 家齊+亭穎 only (no filter)
  const jqTy = all.filter(e => e.who === "家齊" || e.who === "亭穎");
  const spent = jqTy.reduce((s,e)=> s + Number(e.amount_twd||0), 0);
  const remain = Math.max(0, BUDGET_JQ_TY - spent);
  budgetSpent.textContent = `NT$ ${fmtMoney_(spent)}`;
  budgetRemain.textContent = `NT$ ${fmtMoney_(remain)}`;

  const pct = BUDGET_JQ_TY ? clamp((spent / BUDGET_JQ_TY) * 100, 0, 100) : 0;
  budgetBar.style.width = `${pct}%`;

  // Pie by category (filtered)
  const byCat = {};
  filtered.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_twd||0);
  });
  const labels = Object.keys(byCat);
  const values = labels.map(k => byCat[k]);

  renderPie_(labels, values);

  // Detail list
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
            <div class="mt-1 text-xs text-slate-300/80">${sub}</div>
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
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw || 0;
              return `${ctx.label}: NT$ ${fmtMoney_(v)}`;
            }
          }
        }
      }
    }
  });
}

function renderSettlement_(allExpenses){
  // 初版：以「每筆消費均分到 split 人」來算誰該付/該收
  const bal = { "家齊": 0, "亭穎": 0, "媽媽": 0 };

  allExpenses.filter(x => x.deleted !== 1).forEach(e => {
    const total = Number(e.amount_twd||0);
    const payer = e.who;
    const splits = (e.split||[]).filter(x => PEOPLE.includes(x));
    if (!splits.length) return;

    const share = total / splits.length;

    // payer paid total -> +total
    bal[payer] += total;
    // each participant owes share -> -share
    splits.forEach(p => { bal[p] -= share; });
  });

  // Convert balances to transfers (simple greedy)
  const debtors = PEOPLE.map(p => ({ p, v: -bal[p] })).filter(x => x.v > 1);
  const creditors = PEOPLE.map(p => ({ p, v: bal[p] })).filter(x => x.v > 1);
  debtors.sort((a,b)=>b.v-a.v);
  creditors.sort((a,b)=>b.v-a.v);

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

// ====================== FILTER MODAL ======================
function buildFilterModal_(){
  const groups = {
    who: PEOPLE,
    where: WHERE,
    category: EXP_CATEGORIES,
    pay: PAY
  };
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
  // sync UI with state.filter
  ["who","where","category","pay"].forEach(k => {
    const wrap = modalFilter.querySelector(`[data-filter-group="${k}"]`);
    $$(".tag", wrap);
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
  for (const k of ["who","where","category","pay"]) {
    for (const v of state.filter[k]) pairs.push({k,v});
  }
  pairs.slice(0, 6).forEach(({k,v}) => {
    const b = document.createElement("button");
    b.className = "tag active";
    b.textContent = v + " ✕";
    b.addEventListener("click", () => {
      state.filter[k].delete(v);
      renderAnalysis_();
    });
    filterChips.appendChild(b);
  });
}

// ====================== OUTBOX + SYNC (MVP) ======================
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
    // only send tables that GAS supports now: expenses
    const ops = box.filter(o => o.table === "expenses");

    if (ops.length) {
      const payload = { action: "sync", client_id: "iphone-webapp", ops };
      await postJsonNoPreflight_(GAS_URL, payload);
    }

    // after push, pull updates
    const lastPull = localStorage.getItem(LS.lastPull) || "1970-01-01T00:00:00+00:00";
    const pullUrl = `${GAS_URL}?action=pull&trip=${encodeURIComponent(TRIP_NAME)}&updated_after=${encodeURIComponent(lastPull)}`;
    const pulled = await fetch(pullUrl).then(r => r.json());

    if (pulled?.ok && Array.isArray(pulled.rows)) {
      mergePulled_(pulled.rows);
      localStorage.setItem(LS.lastPull, pulled.server_time || new Date().toISOString());
    }

    // clear outbox (we clear all; in production you’d clear only applied ones)
    save(LS.outbox, []);
    setSyncStatus("wait");
    renderExpenses_();
    renderAnalysis_();
  } catch (e) {
    console.warn(e);
    setSyncStatus("wait");
  }
}

async function postJsonNoPreflight_(url, payload){
  // Avoid CORS preflight by using text/plain
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

function mergePulled_(rows){
  // rows: [{table:"expenses", row:{...}}]
  const expenses = load(LS.expenses, []);
  const byId = new Map(expenses.map(x => [x.id, x]));

  rows.forEach(item => {
    if (item.table !== "expenses") return;
    const r = item.row || {};
    const id = String(r.id || "");
    if (!id) return;

    // Map back into local schema
    const local = {
      id,
      trip: r.trip || TRIP_NAME,
      date: r.date || state.selectedDate,
      ts: r.ts || new Date().toISOString(),
      who: r.who || "",
      where: r.where || "",
      category: r.category || "",
      pay: r.pay_method || r.pay || "",
      currency: r.currency || "TWD",
      amount: Number(r.amount || 0),
      fx_to_twd: Number(r.fx_to_twd || 1),
      amount_twd: Number(r.amount_twd || 0),
      title: r.merchant || r.title || "",
      note: r.note || "",
      split: (r.split ? String(r.split).split(",") : []),
      deleted: Number(r.deleted || 0),
      created_at: r.created_at || "",
      updated_at: r.updated_at || ""
    };

    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, local);
    } else {
      // keep newer updated_at
      const prevT = new Date(prev.updated_at || 0).getTime();
      const newT = new Date(local.updated_at || 0).getTime();
      if (newT >= prevT) byId.set(id, local);
    }
  });

  save(LS.expenses, Array.from(byId.values()));
}

// ====================== GESTURES ======================
function setupGestures_(){
  // Edge-swipe: change tabs (left/right 18px)
  // Swipe in content (not on date strip) to change date
  let sx=0, sy=0, st=0, started=false, edgeMode=false, dateMode=false;
  const EDGE = 18;
  const TH = 55;

  pages.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
    started = true;

    const w = window.innerWidth;
    edgeMode = (sx <= EDGE || sx >= (w-EDGE));
    dateMode = !edgeMode && state.tab === "itinerary";

    // if in date strip, ignore date swipe
    if (e.target.closest("#dateStrip")) dateMode = false;
  }, { passive:true });

  pages.addEventListener("touchend", (e) => {
    if (!started) return;
    started = false;

    // read last changed by touchend changedTouches if present
    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    if (!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    // horizontal dominant
    if (Math.abs(dx) < TH || Math.abs(dx) < Math.abs(dy)) return;

    if (edgeMode) {
      // change tab
      const order = ["itinerary","expenses","analysis"];
      const idx = order.indexOf(state.tab);
      const next = dx < 0 ? idx+1 : idx-1;
      if (next >=0 && next < order.length) setTab_(order[next]);
      return;
    }

    if (dateMode) {
      // change date
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
    // If it's not a URL, open as maps query
    const isUrl = /^https?:\/\//i.test(url);
    const target = isUrl ? url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(url)}`;
    window.open(target, "_blank");
  });

  itImage.addEventListener("change", async () => {
    const f = itImage.files?.[0];
    if (!f) return;
  
    // 先本地預覽（離線也有圖）
    const dataUrl = await fileToDataUrl_(f);
    state.itDraftImageDataUrl = dataUrl;
    itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${dataUrl}" alt="preview" />`;
  
    // 再嘗試上傳到 Drive（需要在線上）
    if (!navigator.onLine) {
      alert("目前離線：已先本地預覽。連線後再重新選取圖片即可上傳同步。");
      return;
    }
  
    setSyncStatus("sync");
    try {
      const payload = {
        action: "uploadImage",
        folder_id: DRIVE_FOLDER_ID,
        filename: f.name || `it_${Date.now()}.jpg`,
        mime_type: f.type || "image/jpeg",
        data_url: dataUrl
      };
  
      const res = await postJsonNoPreflight_(GAS_URL, payload);
      if (!res?.ok) throw new Error(res?.error || "uploadImage failed");
  
      // 把 Drive 圖片資訊暫存到 draft（保存行程時會寫入）
      state.itDraftDriveFileId = res.file_id;
      state.itDraftDriveUrl = res.direct_view_url; // 可直接用在 <img src="">
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

  // Optional shortcuts
  btnFx.addEventListener("click", () => {
    alert("初版匯率：目前非TWD預設用 1。下一步我會幫你做匯率設定面板，並寫入 fx_rates / localStorage。");
  });

  btnExpFilterQuick.addEventListener("click", () => {
    setTab_("analysis");
    openFilterModal_();
  });
}

// ====================== RENDER ALL ======================
function renderAll_(){
  setTab_(state.tab);
  renderItinerary_();
  renderExpenses_();
  renderAnalysis_();
}

// ====================== UTILS ======================
function fmtMoney_(n){
  const x = Number(n||0);
  return x.toLocaleString("zh-Hant-TW");
}
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
    // Move cursor after link
    range.setStartAfter(a);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    alert("插入連結失敗，請重試");
  }
}
