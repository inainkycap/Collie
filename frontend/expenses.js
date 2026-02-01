import { addExpense, getExpenses, getSettlement } from "./api.js";
import { $, toast, requireTripId, requireMember, renderTripHeader, nav, renderMemberList } from "./common.js";

function parseCommaNames(s) {
  return (s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function renderExpenses(listEl, items) {
  listEl.innerHTML = "";
  if (!items.length) {
    listEl.innerHTML = `<div class="text-base text-slate-500 mt-2">No expenses yet</div>`;
    return;
  }
  items.slice().reverse().forEach((e) => {
    const row = document.createElement("div");
    row.className = "py-3 border-b border-slate-100";
    row.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-semibold text-slate-900 text-base">${e.description || "Expense"}</div>
        <div class="font-extrabold text-slate-900 text-base">£${Number(e.amount).toFixed(2)}</div>
      </div>
      <div class="text-slate-600 text-sm mt-1">Paid by <span class="font-semibold">${e.paid_by}</span></div>
      <div class="text-slate-600 text-sm">Split: ${e.split_between.join(", ")}</div>
    `;
    listEl.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const tripId = requireTripId();
  if (!tripId) return;

  const member = requireMember(tripId);
  if (!member) return;

  await renderTripHeader(tripId);
  $("#backBtn").addEventListener("click", () => nav("menu.html", tripId));

  // prefill paidBy with member name
  $("#paidBy").value = member.name;

  async function refresh() {
    const data = await getExpenses(tripId);
    $("#total").textContent = `£${Number(data.total_spent || 0).toFixed(2)}`;
    renderExpenses($("#expensesList"), data.expenses || []);
  }

  $("#addBtn").addEventListener("click", async () => {
    const description = ($("#desc").value || "").trim() || "Expense";
    const amount = Number($("#amount").value);
    const paid_by = ($("#paidBy").value || "").trim();
    const split_between = parseCommaNames($("#splitBetween").value);

    if (!amount || amount <= 0) return toast("Enter a valid amount");
    if (!paid_by) return toast("Enter who paid");
    if (!split_between.length) return toast("Enter who the expense is split between");

    await addExpense(tripId, { amount, paid_by, split_between, description });

    $("#desc").value = "";
    $("#amount").value = "";
    $("#splitBetween").value = "";
    toast("Expense added");
    await refresh();
  });

  $("#settleBtn").addEventListener("click", async () => {
    const data = await getSettlement(tripId);
    $("#settleText").textContent = data.summary || "No settlement available";
  });

  await refresh();
});
