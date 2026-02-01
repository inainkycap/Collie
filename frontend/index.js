import { createTrip } from "./api.js";
import { $, toast, setTripId, nav } from "./common.js";

document.addEventListener("DOMContentLoaded", () => {
  $("#createBtn").addEventListener("click", async () => {
    const title = ($("#tripTitle").value || "").trim() || "Weekend Trip";
    const data = await createTrip(title);

    setTripId(data.trip_id);

    const link = `${window.location.origin}${window.location.pathname.replace("index.html", "")}join.html?trip=${data.trip_id}`;
    $("#inviteLink").value = link;

    $("#shareCard").classList.remove("hidden");
    toast("Trip created!");
  });

  $("#copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#inviteLink").value);
    toast("Copied invite link");
  });

  $("#openBtn").addEventListener("click", () => {
    const tripId = JSON.parse(localStorage.getItem("trip_id") || "null");
    if (!tripId) return toast("Create a trip first");
    nav("join.html", tripId);
  });
});
