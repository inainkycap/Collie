import { $, toast, requireTripId, requireMember, renderTripHeader, nav } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const tripId = requireTripId();
  if (!tripId) return;

  const member = requireMember(tripId);
  if (!member) return;

  await renderTripHeader(tripId);

  $("#backBtn").addEventListener("click", () => nav("join.html", tripId));
  $("#voteBtn").addEventListener("click", () => nav("vote.html", tripId));
  $("#itineraryBtn").addEventListener("click", () => nav("itinerary.html", tripId));
  $("#expensesBtn").addEventListener("click", () => nav("expenses.html", tripId));
  $("#settingsBtn").addEventListener("click", () => nav("settings.html", tripId));
});
