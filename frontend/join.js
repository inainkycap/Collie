import { joinTrip } from "./api.js";
import { $, toast, requireTripId, renderTripHeader, setMember, nav, getMember } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  const tripId = requireTripId();
  if (!tripId) return;

  await renderTripHeader(tripId);

  // If already joined on this device, send to menu
  const existing = getMember(tripId);
  if (existing?.id) {
    nav("menu.html", tripId);
    return;
  }

  $("#backHome").addEventListener("click", () => (window.location.href = "index.html"));

  $("#joinBtn").addEventListener("click", async () => {
    const name = ($("#nameInput").value || "").trim();
    if (!name) return toast("Please enter your name");

    const data = await joinTrip(tripId, name);
    setMember(tripId, { id: data.member_id, name });

    toast(`Joined as ${name}`);
    nav("menu.html", tripId);
  });

  $("#nameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#joinBtn").click();
    }
  });
});
