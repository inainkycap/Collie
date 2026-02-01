window.API_BASE = "https://ichack26-backend.onrender.com";

async function readError(res) {
  try {
    const txt = await res.text();
    if (txt) return txt;
  } catch (e) {
    console.error("Error reading response:", e);
  }
  
  // More helpful error messages
  if (res.status === 404) return "Trip not found. Check your link?";
  if (res.status === 500) return "Server error. Backend might be starting up (Render free tier sleeps after 15min).";
  if (res.status === 0) return "Network error. Check your internet connection.";
  
  return `${res.status} ${res.statusText}`;
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  const headers = {
    ...(options.headers || {}),
    ...(method !== "GET" && method !== "HEAD" ? { "Content-Type": "application/json" } : {}),
  };

  let lastError;
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Progressive timeout: first attempt 15s, retries 45s
      const timeoutMs = attempt === 0 ? 15000 : 45000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const res = await fetch(`${window.API_BASE}${path}`, { 
        ...options, 
        method, 
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(await readError(res));
      return await res.json();
      
    } catch (error) {
      lastError = error;
      
      console.log(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
      
      // Retry on network errors or timeouts
      const isRetriable = 
        error.name === 'AbortError' || 
        error.message.includes("Network error") ||
        error.message.includes("Failed to fetch");
      
      if (attempt < maxRetries && isRetriable) {
        console.log(`Retrying in ${(attempt + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
        continue;
      }
      
      break;
    }
  }
  
  // Add helpful context to error message
  if (lastError.name === 'AbortError') {
    throw new Error(`Request timed out. Backend may be cold-starting (takes 30-60s on Render free tier). Please try again.`);
  }
  
  throw lastError;
}

// Trip
export const createTrip = (title) =>
  apiFetch("/trip", { method: "POST", body: JSON.stringify({ title }) });

export const getTrip = (tripId) => apiFetch(`/trip/${tripId}`);

export const updateTripTitle = (tripId, title) =>
  apiFetch(`/trip/${tripId}`, { method: "PUT", body: JSON.stringify({ title }) });

export const getMembers = (tripId) => apiFetch(`/trip/${tripId}/members`);

// Options / join / vote / results
export const getTripOptions = (tripId) => apiFetch(`/trip/${tripId}/options`);

export const joinTrip = (tripId, name) =>
  apiFetch(`/trip/${tripId}/join`, { method: "POST", body: JSON.stringify({ name }) });

export const castVote = (tripId, memberId, type, option) =>
  apiFetch(`/trip/${tripId}/vote`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId, type, option }),
  });

export const getTripResults = (tripId) => apiFetch(`/trip/${tripId}/results`);

// Recs / itinerary (anti-touristy by default on the backend)
export const getRecommendations = (tripId) =>
  apiFetch(`/trip/${tripId}/recommendations`);

export const getItinerary = (tripId) =>
  apiFetch(`/trip/${tripId}/itinerary`);

// Expenses / settle
export const addExpense = (tripId, expense) =>
  apiFetch(`/trip/${tripId}/expense`, { method: "POST", body: JSON.stringify(expense) });

export const getExpenses = (tripId) => apiFetch(`/trip/${tripId}/expenses`);

export const getSettlement = (tripId) => apiFetch(`/trip/${tripId}/settle`);

// Add option
export const addOption = (tripId, type, label) =>
  apiFetch(`/trip/${tripId}/options`, {
    method: "POST",
    body: JSON.stringify({ type, label }),
  });