import { getTrip, updateTripTitle } from "./api.js";
import { $, toast, requireTripId, requireMember, renderTripHeader, nav, renderMemberList } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const tripId = requireTripId();
  if (!tripId) return;

  const member = requireMember(tripId);
  if (!member) return;

  await renderTripHeader(tripId);
  $("#backBtn").addEventListener("click", () => nav("menu.html", tripId));

  async function load() {
    const t = await getTrip(tripId);
    $("#titleInput").value = t.title || "";
    await renderMemberList(tripId, "membersList");
  }

  $("#saveBtn").addEventListener("click", async () => {
    const title = ($("#titleInput").value || "").trim();
    if (!title) return toast("Title cannot be empty");
    await updateTripTitle(tripId, title);
    toast("Trip title updated");
    await renderTripHeader(tripId);
  });

  $("#refreshBtn").addEventListener("click", async () => {
    await renderMemberList(tripId, "membersList");
    toast("Refreshed");
  });

  await load();
});
