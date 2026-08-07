const STORAGE_KEY = "entertainment-invest-v3";
const LEGACY_KEYS = [
  "entertainment-invest-v2",
  "entertainment-invest-v1"
];

const state = {
  month: new Date(),
  detailType: "expense",
  records: loadRecords(),
  pendingDeleteId: null
};

const el = id => document.getElementById(id);

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function normalizeRecord(record) {
  return {
    id: record.id || makeId(),
    type: record.type === "investment" ? "investment" : "expense",
    date: String(record.date || ""),
    amount: Number(record.amount) || 0,
    note: String(record.note || "")
  };
}

function loadRecords() {
  const keys = [STORAGE_KEY, ...LEGACY_KEYS];
  let firstValidEmpty = null;

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed.records;

      if (!Array.isArray(list)) continue;

      const records = list.map(normalizeRecord);

      // 核心修正：
      // 若新版 key 曾被錯誤寫成 []，不要因此擋住舊版真正的資料。
      if (records.length === 0) {
        if (firstValidEmpty === null) firstValidEmpty = [];
        continue;
      }

      // 找到第一份非空資料後，正式遷移到 V3 key。
      if (key !== STORAGE_KEY) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      }

      return records;
    } catch (error) {
      console.warn("Unable to read stored records:", key, error);
    }
  }

  return firstValidEmpty || [];
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthRecords() {
  const key = monthKey(state.month);
  return state.records.filter(record =>
    typeof record.date === "string" && record.date.startsWith(key)
  );
}

function calculateMonthlyTotals() {
  const list = currentMonthRecords();

  const expense = list
    .filter(record => record.type === "expense")
    .reduce((sum, record) => sum + record.amount, 0);

  const investment = list
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

  const completion = expense === 0
    ? 0
    : Math.min(100, Math.round((investment / expense) * 100));

  return { expense, investment, completion };
}

function render() {
  const monthly = calculateMonthlyTotals();
  const all = calculateAllTotals();

  const monthlyProgress = monthly.expense === 0
    ? 0
    : Math.min(100, Math.round((monthly.investment / monthly.expense) * 100));

  el("monthLabel").textContent =
    `${state.month.getFullYear()} 年 ${state.month.getMonth() + 1} 月`;
  el("monthPicker").value = monthKey(state.month);

  el("expenseTotal").textContent = formatMoney(monthly.expense);
  el("investmentTotal").textContent = formatMoney(monthly.investment);
  el("pendingTotal").textContent = formatMoney(monthly.pending);

  if (el("pendingStatus")) {
    const completed = monthly.expense > 0 && monthly.pending === 0;
    el("pendingStatus").textContent = completed ? "本月已補足" : "尚未補足";
    el("pendingStatus").classList.toggle("complete", completed);
  }

  el("progressBar").style.width = `${monthlyProgress}%`;
  el("progressText").textContent = `本月已完成 ${monthlyProgress}%`;

  el("allExpenseTotal").textContent = formatMoney(all.expense);
  el("allInvestmentTotal").textContent = formatMoney(all.investment);
  el("allCompletionRate").textContent = `${all.completion}%`;

  const list = currentMonthRecords();
  el("expenseCount").textContent =
    list.filter(record => record.type === "expense").length;
  el("investmentCount").textContent =
    list.filter(record => record.type === "investment").length;

  renderRecords();
}

function renderRecords() {
  const records = currentMonthRecords()
    .filter(record => record.type === state.detailType)
    .sort((a, b) => b.date.localeCompare(a.date));

  const container = el("recordList");
  container.innerHTML = "";

  if (!records.length) {
    const typeName =
      state.detailType === "expense" ? "娛樂費" : "股票投入";
    container.innerHTML =
      `<div class="empty-state">這個月份尚無${typeName}紀錄。</div>`;
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
      <span class="record-amount">${formatPlainAmount(record.amount)}</span>
      <span class="record-arrow">›</span>
    `;

    button.addEventListener("click", () => openEditDialog(record.id));
    container.appendChild(button);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function addRecord(type) {
  const prefix = type === "expense" ? "expense" : "investment";
  const dateInput = el(`${prefix}Date`);
  const amountInput = el(`${prefix}Amount`);
  const noteInput = el(`${prefix}Note`);

  const date = dateInput.value;
  const amount = Number(amountInput.value);
  const note = noteInput.value.trim();

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

  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = todayString();

  showMessage(type === "expense" ? "已新增娛樂費。" : "已紀錄股票投入。");
  render();

  setTimeout(() => amountInput.focus(), 80);
}

function setEntryTab(type) {
  const expense = type === "expense";

  el("expenseEntryTab").classList.toggle("active", expense);
  el("investmentEntryTab").classList.toggle("active", !expense);

  el("expensePanel").classList.toggle("hidden", !expense);
  el("investmentPanel").classList.toggle("hidden", expense);
}

function setDetailTab(type) {
  state.detailType = type;

  el("expenseDetailTab").classList.toggle("active", type === "expense");
  el("investmentDetailTab").classList.toggle("active", type === "investment");

  renderRecords();
}

function changeMonth(delta) {
  state.month = new Date(
    state.month.getFullYear(),
    state.month.getMonth() + delta,
    1
  );
  render();
}

function showMessage(text) {
  el("message").textContent = text;
  clearTimeout(showMessage.timer);

  showMessage.timer = setTimeout(() => {
    el("message").textContent = "";
  }, 2400);
}

function openEditDialog(id) {
  const record = state.records.find(item => item.id === id);
  if (!record) return;

  el("editRecordId").value = record.id;
  el("editDate").value = record.date;
  el("editAmount").value = record.amount;
  el("editNote").value = record.note;

  el("editTitle").textContent =
    record.type === "expense" ? "編輯娛樂費" : "編輯股票投入";

  el("editTypeLabel").textContent =
    record.type === "expense" ? "娛樂費紀錄" : "股票投入紀錄";

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

  state.records = state.records.filter(
    record => record.id !== state.pendingDeleteId
  );

  state.pendingDeleteId = null;
  saveRecords();

  el("deleteConfirmDialog").close();
  showMessage("紀錄已刪除。");
  render();
}

function clearCurrentMonth() {
  const key = monthKey(state.month);

  state.records = state.records.filter(
    record => !record.date.startsWith(key)
  );

  saveRecords();

  el("clearMonthConfirmDialog").close();
  showMessage("本月紀錄已清空。");
  render();
}

function exportData() {
  const payload = {
    app: "entertainment-invest",
    version: 3.4,
    exportedAt: new Date().toISOString(),
    records: state.records
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

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

      if (!Array.isArray(records)) {
        throw new Error("invalid backup");
      }

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

el("monthPicker").addEventListener("change", () => {
  const value = el("monthPicker").value;
  if (!value) return;

  state.month = new Date(`${value}-01T00:00:00`);
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

el("importData").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) importData(file);
  event.target.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

render();
