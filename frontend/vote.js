import {
  getTripOptions,
  castVote,
  getTripResults,
  getRecommendations,
} from "./api.js";

import {
  $,
  toast,
  requireTripId,
  requireMember,
  renderTripHeader,
  nav,
  prettyRange,
} from "./common.js";

function renderPills(container, options, onPick) {
  container.innerHTML = "";
  options.forEach((opt) => {
    const b = document.createElement("button");
    b.className =
      "pill px-4 py-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition text-base font-semibold";
    b.textContent = opt;
    b.addEventListener("click", () => onPick(opt, b));
    container.appendChild(b);
  });
}

function selectPill(container, btn) {
  [...container.querySelectorAll(".pill")].forEach((b) => {
    b.className =
      "pill px-4 py-3 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition text-base font-semibold";
  });
  btn.className =
    "pill px-4 py-3 rounded-full border border-pink-200 bg-pink-500 text-white shadow-sm transition text-base font-extrabold";
}

function renderList(el, items) {
  el.innerHTML = "";
  const filtered = (items || []).filter((it) => (it.votes || 0) > 0);

  if (!filtered.length) {
    el.innerHTML = `<div class="text-base text-slate-500">No votes yet</div>`;
    return;
  }

  filtered.forEach((it) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between text-base py-2";
    row.innerHTML = `<span class="text-slate-800 font-semibold">${it.option}</span>
                     <span class="font-extrabold text-slate-900">${it.votes}</span>`;
    el.appendChild(row);
  });
}

const REGIONS = {
  europe: ["London", "Paris", "Barcelona", "Amsterdam", "Rome", "Berlin", "Vienna", "Prague", "Lisbon", "Zurich"],
  asia: ["Tokyo", "Seoul", "Bangkok", "Singapore", "Hong Kong", "Taipei", "Kuala Lumpur", "Osaka", "Hanoi"],
  americas: ["New York", "Toronto", "Mexico City", "Miami", "Los Angeles", "Vancouver", "Buenos Aires", "Lima"],
  africa: ["Cape Town", "Marrakesh", "Cairo", "Nairobi", "Zanzibar", "Accra"],
  oceania: ["Sydney", "Melbourne", "Auckland", "Brisbane", "Perth", "Wellington"],
};

document.addEventListener("DOMContentLoaded", async () => {
  const tripId = requireTripId();
  if (!tripId) return;

  const member = requireMember(tripId);
  if (!member) return;

  await renderTripHeader(tripId);
  $("#backBtn").addEventListener("click", () => nav("menu.html", tripId));

  const opt = await getTripOptions(tripId);

  const destWrap = $("#destOptions");
  const dateWrap = $("#dateOptions");
  const regionSelect = $("#regionSelect");

  // ✅ Local mutable state (fixes Add Date Range bug)
  let destinationOptions = [];
  let dateOptions = [];

  function renderDestinations() {
    renderPills(destWrap, destinationOptions, async (choice, btn) => {
      await castVote(tripId, member.id, "destination", choice);
      selectPill(destWrap, btn);
      toast(`Voted: ${choice}`);
      await refresh();
      await refreshRecs();
    });
  }

  function renderDates() {
    renderPills(dateWrap, dateOptions, async (choice, btn) => {
      await castVote(tripId, member.id, "dates", choice);
      selectPill(dateWrap, btn);
      toast(`Voted: ${choice}`);
      await refresh();
      await refreshRecs();
    });
  }

  function buildDestinationOptions() {
    const region = regionSelect.value;
    const regionCities = REGIONS[region] || [];
    const base = opt.options?.destination || [];
    destinationOptions = [...new Set([...base, ...regionCities])].filter(Boolean);
    renderDestinations();
  }

  function buildDateOptions() {
    const baseDates = opt.options?.dates || [];
    dateOptions = [...new Set(baseDates)].filter(Boolean);
    renderDates();
  }

  regionSelect.addEventListener("change", buildDestinationOptions);

  $("#addDestBtn").addEventListener("click", () => {
    const v = ($("#destInput").value || "").trim();
    if (!v) return toast("Type a destination first");

    if (!destinationOptions.includes(v)) {
      destinationOptions.unshift(v);
      renderDestinations();
      toast("Destination added");
    } else {
      toast("Already in list");
    }
    $("#destInput").value = "";
  });

  $("#destInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#addDestBtn").click();
    }
  });

  $("#addDateBtn").addEventListener("click", () => {
    const start = $("#startDate").value;
    const end = $("#endDate").value;

    if (!start || !end) return toast("Pick start and end dates");
    if (end < start) return toast("End must be after start");

    const label = prettyRange(start, end);

    if (!dateOptions.includes(label)) {
      dateOptions.unshift(label);
      renderDates();
      toast(`Added: ${label}`);
    } else {
      toast("That date range already exists");
    }
  });

  async function refresh() {
    const data = await getTripResults(tripId);
    $("#winnerDest").textContent = data.winner.destination ?? "—";
    $("#winnerDate").textContent = data.winner.dates ?? "—";
    renderList($("#destResults"), data.destinations);
    renderList($("#dateResults"), data.dates);
  }

  async function refreshRecs() {
    const data = await getRecommendations(tripId);
    const el = $("#recsList");
    el.innerHTML = "";
    (data.suggestions || []).slice(0, 3).forEach((s) => {
      const card = document.createElement("div");
      card.className = "p-5 rounded-3xl border border-slate-200 bg-white";
      card.innerHTML = `
        <div class="font-extrabold text-slate-900 text-lg">${s.destination}</div>
        <div class="text-base text-slate-600 mt-2">${s.reason}</div>
      `;
      el.appendChild(card);
    });
  }

  $("#recsBtn").addEventListener("click", async () => {
    await refreshRecs();
    toast("Updated recommendations");
  });

  buildDestinationOptions();
  buildDateOptions();
  await refresh();
  await refreshRecs();
});
