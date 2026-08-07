const STORAGE_KEY = "entertainment-invest-v2";
const LEGACY_STORAGE_KEY = "entertainment-invest-v1";

const state = {
  month: new Date(),
  detailType: "expense",
  records: loadRecords(),
  pendingDeleteId: null
};

const el = id => document.getElementById(id);

function loadRecords() {
  const candidates = [STORAGE_KEY, LEGACY_STORAGE_KEY];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeRecord);
      }
    } catch {}
  }
  return [];
}

function normalizeRecord(record) {
  return {
    id: record.id || makeId(),
    type: record.type === "investment" ? "investment" : "expense",
    date: record.date,
    amount: Number(record.amount) || 0,
    note: String(record.note || "")
  };
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function formatMoney(value) {
  return `NT$ ${Math.round(value).toLocaleString("zh-TW")}`;
}

function formatPlainAmount(value) {
  return Math.round(value).toLocaleString("zh-TW");
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function currentMonthRecords() {
  const key = monthKey(state.month);
  return state.records.filter(record => record.date?.startsWith(key));
}

function calculateTotals() {
  const records = currentMonthRecords();
  const expense = records
    .filter(record => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);
  const investment = records
    .filter(record => record.type === "investment")
    .reduce((sum, record) => sum + record.amount, 0);

  return {
    expense,
    investment,
    pending: Math.max(expense - investment, 0)
  };
}

function calculateAllTotals() {
  const expense = state.records
    .filter(record => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);
  const investment = state.records
    .filter(record => record.type === "investment")
    .reduce((sum, record) => sum + record.amount, 0);
  const completion = expense === 0 ? 0 : Math.min(100, Math.round((investment / expense) * 100));
  return { expense, investment, completion };
}

function render() {
  const totals = calculateTotals();
  const allTotals = calculateAllTotals();
  const progress = totals.expense === 0
    ? 0
    : Math.min(100, Math.round((totals.investment / totals.expense) * 100));

  el("monthLabel").textContent = `${state.month.getFullYear()} 年 ${state.month.getMonth() + 1} 月`;
  el("expenseTotal").textContent = formatMoney(totals.expense);
  el("investmentTotal").textContent = formatMoney(totals.investment);
  el("pendingTotal").textContent = formatMoney(totals.pending);
  el("progressBar").style.width = `${progress}%`;
  el("progressText").textContent = `本月已完成 ${progress}%`;
  el("allExpenseTotal").textContent = formatMoney(allTotals.expense);
  el("allInvestmentTotal").textContent = formatMoney(allTotals.investment);
  el("allCompletionRate").textContent = `${allTotals.completion}%`;

  const completed = totals.expense > 0 && totals.pending === 0;
  el("pendingStatus").textContent = completed ? "本月已補足" : "尚未補足";
  el("pendingStatus").classList.toggle("complete", completed);

  const records = currentMonthRecords();
  el("expenseCount").textContent = records.filter(record => record.type === "expense").length;
  el("investmentCount").textContent = records.filter(record => record.type === "investment").length;

  renderRecords();
}

function renderRecords() {
  const records = currentMonthRecords()
    .filter(record => record.type === state.detailType)
    .sort((a, b) => b.date.localeCompare(a.date));

  const container = el("recordList");
  container.innerHTML = "";

  if (!records.length) {
    const typeName = state.detailType === "expense" ? "娛樂費" : "股票投入";
    container.innerHTML = `<div class="empty-state">這個月份尚無${typeName}紀錄。</div>`;
    return;
  }

  records.forEach(record => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "record-item";
    button.dataset.id = record.id;
    button.innerHTML = `
      <span class="record-date">${record.date.slice(5).replace("-", "/")}</span>
      <span class="record-note">${escapeHtml(record.note || "無備註")}</span>
      <span class="record-amount">${record.type === "expense" ? "+" : "-"}${formatMoney(record.amount)}</span>
      <span class="record-arrow">›</span>
    `;
    button.addEventListener("click", () => openEditDialog(record.id));
    container.appendChild(button);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  })[character]);
}

function addRecord(type) {
  const prefix = type === "expense" ? "expense" : "investment";
  const date = el(`${prefix}Date`).value;
  const amount = Number(el(`${prefix}Amount`).value);
  const note = el(`${prefix}Note`).value.trim();

  if (!date || !Number.isFinite(amount) || amount <= 0) {
    showMessage("請輸入日期與正確金額。");
    return;
  }

  state.records.push({
    id: makeId(),
    type,
    date,
    amount,
    note
  });

  state.month = new Date(`${date}T00:00:00`);
  saveRecords();

  el(`${prefix}Amount`).value = "";
  el(`${prefix}Note`).value = "";
  el(`${prefix}Date`).value = todayString();

  showMessage(type === "expense" ? "已新增娛樂費。" : "已紀錄股票投入。");
  render();
  window.setTimeout(() => el(`${prefix}Amount`).focus(), 80);
}

function setEntryTab(type) {
  const isExpense = type === "expense";
  el("expenseEntryTab").classList.toggle("active", isExpense);
  el("investmentEntryTab").classList.toggle("active", !isExpense);
  el("expensePanel").classList.toggle("hidden", !isExpense);
  el("investmentPanel").classList.toggle("hidden", isExpense);
}

function setDetailTab(type) {
  state.detailType = type;
  el("expenseDetailTab").classList.toggle("active", type === "expense");
  el("investmentDetailTab").classList.toggle("active", type === "investment");
  renderRecords();
}

function changeMonth(delta) {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
  render();
}

function showMessage(text) {
  el("message").textContent = text;
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => {
    el("message").textContent = "";
  }, 2600);
}

function openEditDialog(id) {
  const record = state.records.find(item => item.id === id);
  if (!record) return;

  el("editRecordId").value = record.id;
  el("editDate").value = record.date;
  el("editAmount").value = record.amount;
  el("editNote").value = record.note;
  el("editTitle").textContent = record.type === "expense" ? "編輯娛樂費" : "編輯股票投入";
  el("editTypeLabel").textContent = record.type === "expense" ? "娛樂費紀錄" : "股票投入紀錄";
  el("editDialog").showModal();
}

function saveEdit() {
  const id = el("editRecordId").value;
  const record = state.records.find(item => item.id === id);
  if (!record) return;

  const date = el("editDate").value;
  const amount = Number(el("editAmount").value);
  const note = el("editNote").value.trim();

  if (!date || !Number.isFinite(amount) || amount <= 0) {
    alert("請輸入日期與正確金額。");
    return;
  }

  record.date = date;
  record.amount = amount;
  record.note = note;
  state.month = new Date(`${date}T00:00:00`);

  saveRecords();
  el("editDialog").close();
  showMessage("紀錄已修改。");
  render();
}

function requestDeleteRecord() {
  state.pendingDeleteId = el("editRecordId").value;
  el("editDialog").close();
  el("deleteConfirmDialog").showModal();
}

function confirmDeleteRecord() {
  if (!state.pendingDeleteId) return;
  state.records = state.records.filter(record => record.id !== state.pendingDeleteId);
  state.pendingDeleteId = null;
  saveRecords();
  el("deleteConfirmDialog").close();
  showMessage("紀錄已刪除。");
  render();
}

function clearCurrentMonth() {
  const key = monthKey(state.month);
  state.records = state.records.filter(record => !record.date.startsWith(key));
  saveRecords();
  el("clearMonthConfirmDialog").close();
  showMessage("本月紀錄已清空。");
  render();
}

function exportData() {
  const payload = {
    app: "entertainment-invest",
    version: 3,
    exportedAt: new Date().toISOString(),
    records: state.records
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `娛樂費轉投資_${todayString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const records = Array.isArray(payload) ? payload : payload.records;
      if (!Array.isArray(records)) throw new Error("invalid");

      state.records = records.map(normalizeRecord);
      saveRecords();
      render();
      showMessage("備份資料已匯入。");
    } catch {
      showMessage("備份檔格式不正確。");
    }
  };

  reader.readAsText(file);
}

el("expenseDate").value = todayString();
el("investmentDate").value = todayString();

el("prevMonth").addEventListener("click", () => changeMonth(-1));
el("nextMonth").addEventListener("click", () => changeMonth(1));

el("expenseEntryTab").addEventListener("click", () => setEntryTab("expense"));
el("investmentEntryTab").addEventListener("click", () => setEntryTab("investment"));

el("expenseDetailTab").addEventListener("click", () => setDetailTab("expense"));
el("investmentDetailTab").addEventListener("click", () => setDetailTab("investment"));

el("addExpense").addEventListener("click", () => addRecord("expense"));
el("addInvestment").addEventListener("click", () => addRecord("investment"));

el("monthButton").addEventListener("click", () => {
  el("monthPicker").value = monthKey(state.month);
  el("monthDialog").showModal();
});

el("applyMonth").addEventListener("click", event => {
  event.preventDefault();
  const value = el("monthPicker").value;
  if (!value) return;
  state.month = new Date(`${value}-01T00:00:00`);
  el("monthDialog").close();
  render();
});

el("saveEdit").addEventListener("click", saveEdit);
el("deleteRecord").addEventListener("click", requestDeleteRecord);
el("confirmDeleteRecord").addEventListener("click", event => {
  event.preventDefault();
  confirmDeleteRecord();
});

el("openMonthActions").addEventListener("click", () => {
  el("monthActionsDialog").showModal();
});

el("clearCurrentMonth").addEventListener("click", () => {
  el("monthActionsDialog").close();
  el("clearMonthConfirmDialog").showModal();
});

el("confirmClearMonth").addEventListener("click", event => {
  event.preventDefault();
  clearCurrentMonth();
});

el("importData").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) importData(file);
  event.target.value = "";
});


el("openMainMenu").addEventListener("click", () => {
  el("mainMenuDialog").showModal();
});

el("menuExportData").addEventListener("click", () => {
  el("mainMenuDialog").close();
  exportData();
});

el("menuImportData").addEventListener("click", () => {
  el("mainMenuDialog").close();
  el("importData").click();
});


el("menuClearMonth").addEventListener("click", () => {
  el("mainMenuDialog").close();
  el("clearMonthConfirmDialog").showModal();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

render();
