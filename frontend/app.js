const $ = (selector) => document.querySelector(selector);
const state = { deadLetters: [] };
const configuredApi = new URLSearchParams(window.location.search).get("api") || localStorage.getItem("relay-api-url");
const apiBase = (configuredApi || window.location.origin).replace(/\/$/, "");

function setFeedback(element, message, type = "error") {
  element.textContent = message;
  element.className = `feedback ${type}`;
  element.hidden = false;
}

function hide(element) {
  element.hidden = true;
  element.textContent = "";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
}

async function request(path, options = {}) {
  const token = sessionStorage.getItem("relayAdminToken");
  const headers = { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  let body;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw new Error(body?.message || `The request failed (${response.status})`);
  return body;
}

function renderDeadLetters() {
  const rows = $("#dead-letter-rows");
  const empty = $("#empty-state");
  const table = $("#dead-letter-table");
  $("#dead-letter-count").textContent = state.deadLetters.length;
  rows.replaceChildren();
  if (!state.deadLetters.length) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  table.hidden = false;
  state.deadLetters.forEach((deadLetter) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(deadLetter.source)}</td><td><code>${escapeHtml(deadLetter.eventId)}</code></td><td>${escapeHtml(deadLetter.reason)}</td><td class="action-cell"></td>`;
    const button = document.createElement("button");
    button.className = "button small";
    button.textContent = "Retry";
    button.addEventListener("click", () => retryEvent(deadLetter.source, deadLetter.eventId, button));
    row.querySelector(".action-cell").append(button);
    rows.append(row);
  });
}

async function loadDeadLetters() {
  const loading = $("#loading");
  const feedback = $("#feedback");
  loading.hidden = false;
  hide(feedback);
  try {
    const result = await request("/dead-letters");
    if (!Array.isArray(result)) throw new Error("Unexpected response from /dead-letters");
    state.deadLetters = result;
    renderDeadLetters();
  } catch (error) {
    state.deadLetters = [];
    renderDeadLetters();
    setFeedback(feedback, error.message);
  } finally {
    loading.hidden = true;
  }
}

async function retryEvent(source, eventId, button) {
  button.disabled = true;
  button.textContent = "Retrying...";
  try {
    await request(`/events/${encodeURIComponent(source)}/${encodeURIComponent(eventId)}/retry`, { method: "POST" });
    setFeedback($("#feedback"), `Event ${eventId} has been queued for retry.`, "success");
    await loadDeadLetters();
  } catch (error) {
    setFeedback($("#feedback"), error.message);
    button.disabled = false;
    button.textContent = "Retry";
  }
}

async function loadAttempts(event) {
  event.preventDefault();
  const eventId = $("#event-id").value.trim();
  const feedback = $("#attempts-feedback");
  const table = $("#attempts-table");
  if (!eventId) return;
  hide(feedback);
  try {
    const source = $("#event-source").value.trim();
    const path = source
      ? `/events/${encodeURIComponent(source)}/${encodeURIComponent(eventId)}/attempts`
      : `/events/${encodeURIComponent(eventId)}/attempts`;
    const attempts = await request(path);
    if (!Array.isArray(attempts)) throw new Error("Unexpected response from the API");
    const rows = $("#attempt-rows");
    rows.replaceChildren();
    attempts.forEach((attempt) => {
      const row = document.createElement("tr");
      const status = attempt.status === "delivered" ? "delivered" : "failed";
      row.innerHTML = `<td>${formatDate(attempt.createdAt)}</td><td>#${attempt.attemptNumber}</td><td><span class="status ${status}">${escapeHtml(attempt.status)}</span></td><td>${attempt.httpStatus ?? "—"}</td><td>${attempt.durationMs} ms</td><td>${escapeHtml(attempt.error || "—")}</td>`;
      rows.append(row);
    });
    table.hidden = false;
    if (!attempts.length) setFeedback(feedback, "No attempts recorded for this event.", "notice");
  } catch (error) {
    table.hidden = true;
    setFeedback(feedback, error.message);
  }
}

async function checkHealth() {
  try {
    await request("/health");
    $("#health-label").textContent = "operational";
    $("#health-message").textContent = "API operational";
    $("#health-card").classList.add("online");
  } catch {
    $("#health-label").textContent = "unavailable";
    $("#health-message").textContent = "API unavailable";
    $("#health-card").classList.remove("online");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

$("#attempt-form").addEventListener("submit", loadAttempts);
$("#refresh-button").addEventListener("click", () => { checkHealth(); loadDeadLetters(); });
$("#admin-token").value = sessionStorage.getItem("relayAdminToken") || "";
$("#token-form").addEventListener("submit", (event) => {
  event.preventDefault();
  sessionStorage.setItem("relayAdminToken", $("#admin-token").value.trim());
  loadDeadLetters();
});
$("#reload-button").addEventListener("click", loadDeadLetters);
$("#api-url").textContent = apiBase;
checkHealth();
loadDeadLetters();
