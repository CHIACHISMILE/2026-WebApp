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
  "景點": "rgba(191,233,255,0.22)",
  "飲食": "rgba(94,234,212,0.18)",
  "交通": "rgba(255,255,255,0.12)",
  "住宿": "rgba(217,243,255,0.14)",
  "其他": "rgba(255,255,255,0.10)"
};

// ====================== STORAGE ======================
const LS = {
  itinerary: "tripapp_itinerary_v2",
  expenses: "tripapp_expenses_v2",
  fx: "tripapp_fx_v1",
  outbox: "tripapp_outbox_v2"
};

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
const momLine = $("#momLine");
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

// ====================== SYNC BADGE ======================
function setSyncBadge_(mode, text){
  const dotClass = {
    ok: "dot-ok",
    wait: "dot-wait",
    sync: "dot-sync",
    offline: "dot-offline"
  }[mode] || "dot-ok";
  elSync.innerHTML = `<span class="dot ${dotClass}"></span><span class="text-sm">${text}</span>`;
}

function updateSyncBadge_(){
  const box = load(LS.outbox, []);
  const pending = box.length > 0;

  if (!navigator.onLine) {
    if (pending) setSyncBadge_("wait", "待同步");
    else setSyncBadge_("offline", "離線");
    return;
  }
  if (pending) setSyncBadge_("wait", "待上傳");
  else setSyncBadge_("ok", "已同步");
}

// ====================== INIT ======================
registerSW_();
renderHeader_();
buildDateStrip_();
buildItCatChooser_();
buildSplitChooser_();
buildFilterModal_();
attachEvents_();
setupGestures_();
updateSyncBadge_();
renderAll_();

// 初次載入：先 pull 一次（線上才做）
if (navigator.onLine) {
  pullAll_().then(() => {
    renderAll_();
  }).catch(()=>{});
}

window.addEventListener("online", () => { updateSyncBadge_(); maybeAutoSync_(); });
window.addEventListener("offline", () => { updateSyncBadge_(); });
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
    $("#itAddress").value = "";
    // Link 欄位我們用 itAddress 當 location，Link 用 prompt 填到 itLinkDraft
    state.itDraftLink = "";
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

function closeItModal_(){ modalItinerary.classList.add("hidden"); }

function saveItinerary_(){
  const start = itStart.value || "";
  const end = itEnd.value || "";
  const category = state.itDraftCat;

  const titleHtml = itTitle.innerHTML.trim();
  const location = itAddress.value.trim();
  const noteHtml = itNote.innerHTML.trim();

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
    const catBg = IT_CAT_COLORS[it.category] || "rgba(255,255,255,0.10)";
    const time = (it.start || it.end) ? `${it.start||""}–${it.end||""}` : "";
    const loc = it.location ? `<div class="mt-2 text-xs text-slate-200/80 break-words">${escapeHtml_(it.location)}</div>` : "";
    const linkLine = it.link ? `<div class="mt-2 text-xs"><a href="${escapeHtml_(it.link)}" target="_blank" rel="noopener" style="text-decoration:underline;color:rgba(191,233,255,0.98);">開啟連結</a></div>` : "";

    const imgSrc = it.image || it.imageDataUrl || "";
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
            <span class="tag" style="background:${catBg}; border-color: rgba(255,255,255,0.16);">${escapeHtml_(it.category)}</span>
            <span class="text-xs text-slate-300/80">${escapeHtml_(time)}</span>
          </div>
          <div class="mt-2 text-base font-semibold leading-snug break-words">${it.title}</div>
          ${loc}
          ${linkLine}
          ${it.note ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${it.note}</div>` : ""}
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
function getSplitSelected_(){ return $$("#splitChooser .tag.active").map(b => b.dataset.value); }

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
    involved: split.join(","), // ✅ 逗號分隔
    note
  };

  const all = load(LS.expenses, []);
  all.push(row);
  save(LS.expenses, all);

  queueOutbox_({ op: "upsert", table: "Expenses", row: toSheetExpense_(row) });

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

  all.splice(idx, 1);
  save(LS.expenses, all);

  queueOutbox_({ op:"delete", table:"Expenses", key:{ ID: id } });

  renderExpenses_();
  renderAnalysis_();
  maybeAutoSync_();
}

function renderExpenses_(){
  const all = load(LS.expenses, []);
  const items = all.slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));

  expenseList.innerHTML = "";
  if (!items.length) {
    expenseList.innerHTML = `<div class="card p-4 text-sm text-slate-200/80">尚無消費紀錄。</div>`;
    return;
  }

  items.forEach(e => {
    const fxStore = load(LS.fx, {});
    const fxKey = `${fmtDate(new Date())}:${e.currency}`;
    const fx = (e.currency === "TWD") ? 1 : (Number(fxStore[fxKey]) || 1);
    const twd = Math.round(Number(e.amount||0) * fx);

    const sub = (e.currency === "TWD")
      ? ""
      : `<div class="text-xs text-slate-300/80">${e.currency} ${fmtMoney_(e.amount)} @ ${fx}</div>`;

    const splits = String(e.involved||"").split(",").map(s=>s.trim()).filter(Boolean).join("、");

    const card = document.createElement("div");
    card.className = "card p-4";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-base font-semibold break-words">${escapeHtml_(e.item)}</div>
          <div class="mt-1 text-sm text-slate-200/90">${escapeHtml_(e.payer)} • ${escapeHtml_(e.location)} • ${escapeHtml_(e.category)} • ${escapeHtml_(e.payment)}</div>
          <div class="mt-2 text-2xl font-semibold">NT$ ${fmtMoney_(twd)}</div>
          ${sub}
          ${e.note ? `<div class="mt-2 text-sm text-slate-100/90 break-words">${escapeHtml_(e.note)}</div>` : ""}
          <div class="mt-2 text-xs text-slate-300/80">分攤：${splits}</div>
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
    Involved: e.involved, // ✅ 逗號分隔
    Note: e.note || "",
    ID: e.id
  };
}

// ====================== ANALYSIS / FILTER / VIEWER ======================
// （以下分析/濾鏡/Viewer 邏輯可沿用你上一版；我保留核心函式，不再重貼過長）
// 你若要我把 analysis/filter/viewer 也完整整合成一支最終版 app.js，我可以下一則直接給「完整版」。
// 這裡先確保：後端兩表套用 + CRUD + sync/pull 已完全對上。

// ---- 最小必要的 placeholders（避免你直接貼上後報錯） ----
function buildFilterModal_(){}
function setupGestures_(){}
function renderAnalysis_(){}
function renderAll_(){ setTab_(state.tab); renderItinerary_(); renderExpenses_(); }

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

  // 插入連結：Title/Note
  btnLinkTitle.addEventListener("click", () => insertLinkFromSelection_(itTitle));
  btnLinkNote.addEventListener("click", () => insertLinkFromSelection_(itNote));

  // 額外：設定 Itinerary 的 Link 欄位（用 prompt，寫回 Sheet 的 Link）
  btnLinkTitle.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const u = prompt("設定此行程的 Link 欄位（可空白）", state.itDraftLink || "");
    if (u !== null) state.itDraftLink = u.trim();
  });

  itImage.addEventListener("change", async () => {
    const f = itImage.files?.[0];
    if (!f) return;

    const dataUrl = await fileToDataUrl_(f);
    state.itDraftImageDataUrl = dataUrl;
    itImagePreview.innerHTML = `<img class="rounded-2xl border border-white/10" src="${dataUrl}" alt="preview" />`;

    if (!navigator.onLine) {
      updateSyncBadge_();
      alert("目前離線：已先本地預覽。連線後重新選取圖片即可上傳同步。");
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
      alert("圖片上傳失敗：已保留本地預覽。你可以稍後重試。");
    }
  });

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
  btnExpFilterQuick?.addEventListener("click", () => setTab_("analysis"));
}

// ====================== OUTBOX + SYNC + PULL ======================
function queueOutbox_(op){
  const box = load(LS.outbox, []);
  box.push(op);
  save(LS.outbox, box);
  updateSyncBadge_();
}

async function maybeAutoSync_(){
  if (!navigator.onLine) return;
  const box = load(LS.outbox, []);
  if (!box.length) { updateSyncBadge_(); return; }
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

    // sync 完後 pull 全量（旅遊資料量不大，最穩）
    await pullAll_();

    save(LS.outbox, []);
    updateSyncBadge_();

    renderAll_();
  } catch (e) {
    console.warn(e);
    updateSyncBadge_();
  }
}

async function pullAll_(){
  const url = `${GAS_URL}?action=pull`;
  const res = await fetch(url).then(r => r.json());
  if (!res?.ok || !Array.isArray(res.rows)) return;

  mergePulled_(res.rows);
}

function mergePulled_(rows){
  const exp = [];
  const it  = [];

  for (const item of rows) {
    const table = item.table;
    const r = item.row || {};

    if (table === "Expenses") {
      // Sheet → App internal
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

  // 直接用 pull 覆蓋本地（最不會 merge 錯）
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

// ====================== VIEWER placeholders (keep your old viewer if you had it) ======================
function openViewer_() {}
