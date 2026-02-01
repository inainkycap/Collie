import { createTrip } from "./api.js";
import { $, toast, setTripId, nav } from "./common.js";

document.addEventListener("DOMContentLoaded", () => {
  const createBtn = $("#createBtn");
  const tripTitleInput = $("#tripTitle");

  createBtn.addEventListener("click", async () => {
    // Prevent double-clicks
    if (createBtn.disabled) return;

    const title = (tripTitleInput.value || "").trim() || "Weekend Trip";

    // Disable button and show loading state
    createBtn.disabled = true;
    const originalText = createBtn.innerHTML;
    createBtn.innerHTML = `
      <svg class="animate-spin inline-block w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Creating trip...
    `;
    createBtn.classList.add("opacity-75", "cursor-wait");

    try {
      const data = await createTrip(title);

      setTripId(data.trip_id);
      
      // Save title to localStorage as well
      localStorage.setItem(`trip_title_${data.trip_id}`, JSON.stringify(title));

      const link = `${window.location.origin}${window.location.pathname.replace("index.html", "")}join.html?trip=${data.trip_id}`;
      $("#inviteLink").value = link;

      $("#shareCard").classList.remove("hidden");
      toast("Trip created! 🎉");

      // Restore button (for creating another trip)
      createBtn.innerHTML = originalText;
      createBtn.classList.remove("opacity-75", "cursor-wait");
      createBtn.disabled = false;

    } catch (error) {
      console.error("Failed to create trip:", error);

      // Show error state
      createBtn.innerHTML = `
        <svg class="inline-block w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        Failed - Click to retry
      `;
      createBtn.classList.remove("opacity-75", "cursor-wait");
      createBtn.classList.add("bg-red-500", "hover:bg-red-600");
      createBtn.disabled = false;

      // Show user-friendly error message
      if (error.message && error.message.includes("Network error")) {
        toast("Backend is starting up... This can take 30-60 seconds on first load. Please wait and try again.");
      } else if (error.message && error.message.includes("timed out")) {
        toast("Request timed out. Backend might be cold-starting (takes 30-60s). Please try again.");
      } else {
        toast(`Error: ${error.message || "Failed to create trip"}`);
      }

      // Reset button after 3 seconds
      setTimeout(() => {
        createBtn.innerHTML = originalText;
        createBtn.classList.remove("bg-red-500", "hover:bg-red-600");
        createBtn.classList.add("bg-pink-500", "hover:bg-pink-600");
      }, 3000);
    }
  });

  // Allow Enter key to submit
  if (tripTitleInput) {
    tripTitleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        createBtn.click();
      }
    });
  }

  $("#copyBtn")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#inviteLink").value);
    toast("Copied invite link");
  });

  $("#openBtn")?.addEventListener("click", () => {
    const tripId = JSON.parse(localStorage.getItem("trip_id") || "null");
    if (!tripId) return toast("Create a trip first");
    nav("join.html", tripId);
  });
});