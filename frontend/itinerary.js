import { getItinerary } from "./api.js";
import { $, toast, requireTripId, requireMember, renderTripHeader, nav } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const tripId = requireTripId();
  if (!tripId) return;

  const member = requireMember(tripId);
  if (!member) return;

  await renderTripHeader(tripId);

  $("#backBtn").addEventListener("click", () => nav("menu.html", tripId));

  async function load() {
    $("#error").textContent = "";
    $("#days").innerHTML = "";
    $("#recs").innerHTML = "";

    try {
      const data = await getItinerary(tripId);

      const days = data.days || {};
      Object.entries(days).forEach(([dayKey, blocks]) => {
        const card = document.createElement("div");
        card.className = "bg-white border border-slate-200 rounded-3xl shadow-sm p-6";
        card.innerHTML = `
          <div class="text-xs font-extrabold text-slate-500 tracking-wider">${dayKey.replace("_", " ").toUpperCase()}</div>
          <div class="mt-4 space-y-3 text-base">
            <div><span class="font-extrabold">Morning:</span> ${blocks.morning}</div>
            <div><span class="font-extrabold">Afternoon:</span> ${blocks.afternoon}</div>
            <div><span class="font-extrabold">Evening:</span> ${blocks.evening}</div>
          </div>
        `;
        $("#days").appendChild(card);
      });

      (data.recommendations || []).slice(0, 6).forEach((p) => {
        const card = document.createElement("div");
        card.className = "p-5 rounded-3xl border border-slate-200 bg-white";
        const badge = p.is_hidden_gem ? "✨ Hidden gem" : "📍 Popular-ish";
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="font-extrabold text-slate-900 text-lg">${p.name}</div>
            <div class="text-sm text-slate-600 font-semibold">${badge}</div>
          </div>
          <div class="text-base text-slate-600 mt-2">${p.category} • ${p.distance_km} km</div>
        `;
        $("#recs").appendChild(card);
      });
    } catch (e) {
      $("#error").textContent = e.message || "Failed to load itinerary (vote for a destination first).";
    }
  }

  $("#refreshBtn").addEventListener("click", async () => {
    await load();
    toast("Updated");
  });

  await load();
});
