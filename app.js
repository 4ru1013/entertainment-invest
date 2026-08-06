const STORAGE_KEY = "entertainment-invest-v1";

const state = {
  month: new Date(),
  detailType: "expense",
  records: loadRecords()
};

const el = id => document.getElementById(id);
const formatMoney = n => `NT$ ${Math.round(n).toLocaleString("zh-TW")}`;
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function currentMonthRecords() {
  const key = monthKey(state.month);
  return state.records.filter(r => r.date.startsWith(key));
}

function totals() {
  const list = currentMonthRecords();
  const expense = list.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const investment = list.filter(r => r.type === "investment").reduce((s, r) => s + r.amount, 0);
  return { expense, investment, pending: Math.max(expense - investment, 0) };
}

function render() {
  const { expense, investment, pending } = totals();
  const progress = expense === 0 ? 0 : Math.min(100, Math.round(investment / expense * 100));

  el("monthLabel").textContent = `${state.month.getFullYear()} 年 ${state.month.getMonth() + 1} 月`;
  el("expenseTotal").textContent = formatMoney(expense);
  el("investmentTotal").textContent = formatMoney(investment);
  el("pendingTotal").textContent = formatMoney(pending);
  el("progressBar").style.width = `${progress}%`;
  el("progressText").textContent = `本月已完成 ${progress}%`;
  el("pendingStatus").textContent = pending === 0 && expense > 0 ? "本月已補足" : "尚未補足";

  const list = currentMonthRecords();
  el("expenseCount").textContent = list.filter(r => r.type === "expense").length;
  el("investmentCount").textContent = list.filter(r => r.type === "investment").length;

  renderRecords();
}

function renderRecords() {
  const records = currentMonthRecords()
    .filter(r => r.type === state.detailType)
    .sort((a,b) => b.date.localeCompare(a.date));

  const container = el("recordList");
  container.innerHTML = "";

  if (!records.length) {
    container.innerHTML = `<div class="empty-state">這個月份尚無${state.detailType === "expense" ? "娛樂費" : "股票投入"}紀錄。</div>`;
    return;
  }

  records.forEach(record => {
    const row = document.createElement("div");
    row.className = "record-item";
    row.innerHTML = `
      <div class="record-date">${record.date.slice(5).replace("-", "/")}</div>
      <div class="record-note">${escapeHtml(record.note || "無備註")}</div>
      <div class="record-amount">${state.detailType === "expense" ? "+" : "-"}${formatMoney(record.amount)}</div>
      <button class="delete-record" aria-label="刪除紀錄" data-id="${record.id}">×</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll(".delete-record").forEach(button => {
    button.addEventListener("click", () => {
      state.records = state.records.filter(r => r.id !== button.dataset.id);
      saveRecords();
      render();
    });
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);
}

function addRecord(type) {
  const date = el(type === "expense" ? "expenseDate" : "investmentDate").value;
  const amountInput = el(type === "expense" ? "expenseAmount" : "investmentAmount");
  const noteInput = el(type === "expense" ? "expenseNote" : "investmentNote");
  const amount = Number(amountInput.value);

  if (!date || !Number.isFinite(amount) || amount <= 0) {
    el("message").textContent = "請輸入日期與正確金額。";
    return;
  }

  state.records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    date,
    amount,
    note: noteInput.value.trim()
  });

  state.month = new Date(`${date}T00:00:00`);
  saveRecords();
  amountInput.value = "";
  noteInput.value = "";
  el("message").textContent = type === "expense" ? "已新增娛樂費。" : "已紀錄股票投入。";
  render();
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
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
  render();
}

function exportData() {
  const payload = {
    app: "entertainment-invest",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: state.records
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `娛樂費轉投資_${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!Array.isArray(payload.records)) throw new Error();
      state.records = payload.records;
      saveRecords();
      render();
      el("message").textContent = "備份資料已匯入。";
    } catch {
      el("message").textContent = "備份檔格式不正確。";
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
el("exportData").addEventListener("click", exportData);

el("importData").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) importData(file);
  event.target.value = "";
});

el("deleteAllCurrentMonth").addEventListener("click", () => {
  if (!confirm("確定要清空目前月份的全部紀錄？")) return;
  const key = monthKey(state.month);
  state.records = state.records.filter(r => !r.date.startsWith(key));
  saveRecords();
  render();
});

const dialog = el("monthDialog");
el("monthButton").addEventListener("click", () => {
  el("monthPicker").value = monthKey(state.month);
  dialog.showModal();
});
el("applyMonth").addEventListener("click", event => {
  event.preventDefault();
  const value = el("monthPicker").value;
  if (value) {
    state.month = new Date(`${value}-01T00:00:00`);
    dialog.close();
    render();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

render();
