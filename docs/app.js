const people = {
  Asuka: { color: "#e8729a" },
  Kirill: { color: "#4a86c8" }
};

const storageKeys = {
  chores: "rekindle-home-chores",
  apiUrl: "rekindle-home-chores-api-url"
};

const state = {
  chores: [],
  selectedPerson: "Asuka",
  selectedChore: "",
  viewDate: new Date()
};

const els = {
  form: document.querySelector("#choreForm"),
  personToggle: document.querySelector("#personToggle"),
  dateInput: document.querySelector("#dateInput"),
  choreGrid: document.querySelector("#choreGrid"),
  customChoreInput: document.querySelector("#customChoreInput"),
  formStatus: document.querySelector("#formStatus"),
  asukaCount: document.querySelector("#asukaCount"),
  kirillCount: document.querySelector("#kirillCount"),
  recentList: document.querySelector("#recentList"),
  calendarGrid: document.querySelector("#calendarGrid"),
  monthLabel: document.querySelector("#monthLabel"),
  previousMonthButton: document.querySelector("#previousMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  apiUrlInput: document.querySelector("#apiUrlInput"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  clearLocalButton: document.querySelector("#clearLocalButton"),
  dayDialog: document.querySelector("#dayDialog"),
  dayDialogTitle: document.querySelector("#dayDialogTitle"),
  dayDialogList: document.querySelector("#dayDialogList"),
  dayDialogCloseButton: document.querySelector("#dayDialogCloseButton"),
  dayDialogUseDateButton: document.querySelector("#dayDialogUseDateButton")
};

const dayDialogState = { date: null };

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getConfiguredApiUrl() {
  return (localStorage.getItem(storageKeys.apiUrl) || window.CHORE_API_URL || "").trim().replace(/\/$/, "");
}

function setStatus(message, type = "") {
  els.formStatus.textContent = message;
  els.formStatus.className = `status ${type}`.trim();
}

function getLocalChores() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.chores) || "[]");
  } catch {
    return [];
  }
}

function setLocalChores(chores) {
  localStorage.setItem(storageKeys.chores, JSON.stringify(chores));
}

async function apiRequest(path, options = {}) {
  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    throw new Error("No Worker API URL configured.");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

async function loadChores() {
  const apiUrl = getConfiguredApiUrl();
  els.apiUrlInput.value = apiUrl;

  if (!apiUrl) {
    state.chores = getLocalChores();
    setStatus("Local-only mode. Add the Worker URL in settings to sync.", "");
    render();
    return;
  }

  try {
    const payload = await apiRequest("/api/chores");
    const remoteChores = payload.chores || [];
    const migratedChores = await migrateLocalChores(remoteChores);
    state.chores = migratedChores;
    setStatus(
      migratedChores.length > remoteChores.length
        ? "Synced local entries to the shared database."
        : "Synced with shared database.",
      "success"
    );
  } catch (error) {
    state.chores = getLocalChores();
    setStatus(`Sync unavailable: ${error.message}. Showing local data.`, "error");
  }
  render();
}

async function migrateLocalChores(remoteChores) {
  const localChores = getLocalChores();
  if (!localChores.length) {
    return remoteChores;
  }

  const remoteIds = new Set(remoteChores.map((chore) => chore.id));
  const unsynced = localChores.filter((chore) => chore.id && !remoteIds.has(chore.id));
  if (!unsynced.length) {
    localStorage.removeItem(storageKeys.chores);
    return remoteChores;
  }

  const migrated = [];
  for (const chore of unsynced) {
    const payload = await apiRequest("/api/chores", {
      method: "POST",
      body: JSON.stringify(chore)
    });
    migrated.push(payload.chore);
  }

  localStorage.removeItem(storageKeys.chores);
  return [...migrated, ...remoteChores];
}

async function addChore(chore) {
  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    const saved = [chore, ...getLocalChores()];
    setLocalChores(saved);
    state.chores = saved;
    setStatus("Saved locally in this browser.", "success");
    render();
    return;
  }

  const payload = await apiRequest("/api/chores", {
    method: "POST",
    body: JSON.stringify(chore)
  });
  state.chores = [payload.chore, ...state.chores];
  setStatus("Saved to shared database.", "success");
  render();
}

async function deleteChore(id) {
  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    const saved = getLocalChores().filter((chore) => chore.id !== id);
    setLocalChores(saved);
    state.chores = saved;
    setStatus("Entry removed.", "success");
    render();
    return;
  }

  await apiRequest(`/api/chores/${encodeURIComponent(id)}`, { method: "DELETE" });
  state.chores = state.chores.filter((chore) => chore.id !== id);
  setStatus("Entry removed.", "success");
  render();
}

function renderPersonButtons() {
  els.personToggle.querySelectorAll("button").forEach((button) => {
    const selected = button.dataset.person === state.selectedPerson;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function renderChoreButtons() {
  els.choreGrid.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.chore === state.selectedChore);
  });
}

function renderStats() {
  const selectedMonth = monthKey(state.viewDate);
  const monthChores = state.chores.filter((chore) => chore.date.startsWith(selectedMonth));
  els.asukaCount.textContent = monthChores.filter((chore) => chore.person === "Asuka").length;
  els.kirillCount.textContent = monthChores.filter((chore) => chore.person === "Kirill").length;
}

function renderRecent() {
  const recent = [...state.chores]
    .sort((a, b) => `${b.date}${b.createdAt || ""}`.localeCompare(`${a.date}${a.createdAt || ""}`))
    .slice(0, 8);

  if (!recent.length) {
    els.recentList.innerHTML = '<p class="empty">No chores logged yet.</p>';
    return;
  }

  els.recentList.innerHTML = recent.map((chore) => `
    <article class="recent-entry">
      <span class="dot" style="background:${people[chore.person]?.color || "#b96f3e"}"></span>
      <div>
        <strong>${escapeHtml(chore.chore)}</strong>
        <span>${escapeHtml(chore.person)} · ${formatReadableDate(chore.date)}</span>
      </div>
      <button class="delete-button" type="button" data-delete-id="${escapeHtml(chore.id)}" aria-label="Delete ${escapeHtml(chore.chore)}">×</button>
    </article>
  `).join("");
}

function renderCalendar() {
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  const today = formatDate(new Date());

  els.monthLabel.textContent = state.viewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + index);
    const dateValue = formatDate(cellDate);
    const choresForDay = state.chores.filter((chore) => chore.date === dateValue);
    const outside = cellDate.getMonth() !== month;
    const isToday = dateValue === today;

    cells.push(`
      <div class="day-cell ${outside ? "outside" : ""} ${isToday ? "today" : ""}" data-date="${dateValue}" role="button" tabindex="0" aria-label="View chores for ${formatReadableDate(dateValue)}">
        <span class="day-number">${cellDate.getDate()}</span>
        <div class="day-entries">
          ${choresForDay.map((chore) => `
            <div class="chore-pill" title="${escapeHtml(chore.person)}: ${escapeHtml(chore.chore)}">
              <span class="pill-dot" style="background:${people[chore.person]?.color || "#b96f3e"}"></span>
              <span class="pill-label">${escapeHtml(chore.chore)}</span>
              <button class="pill-delete-button" type="button" data-delete-id="${escapeHtml(chore.id)}" aria-label="Delete ${escapeHtml(chore.chore)}">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    `);
  }

  els.calendarGrid.innerHTML = cells.join("");
}

function renderDayDialog() {
  if (!dayDialogState.date || !els.dayDialog.open) return;
  const date = dayDialogState.date;
  els.dayDialogTitle.textContent = formatReadableDate(date);
  const choresForDay = state.chores.filter((chore) => chore.date === date);

  if (!choresForDay.length) {
    els.dayDialogList.innerHTML = '<p class="empty">No chores logged for this date.</p>';
    return;
  }

  els.dayDialogList.innerHTML = choresForDay.map((chore) => `
    <article class="day-dialog-entry">
      <span class="dot" style="background:${people[chore.person]?.color || "#b96f3e"}"></span>
      <div>
        <strong>${escapeHtml(chore.chore)}</strong>
        <span>${escapeHtml(chore.person)}</span>
      </div>
      <button class="delete-button" type="button" data-delete-id="${escapeHtml(chore.id)}" aria-label="Delete ${escapeHtml(chore.chore)}">×</button>
    </article>
  `).join("");
}

function openDayDialog(date) {
  dayDialogState.date = date;
  if (!els.dayDialog.open) els.dayDialog.showModal();
  renderDayDialog();
}

function render() {
  renderPersonButtons();
  renderChoreButtons();
  renderStats();
  renderRecent();
  renderCalendar();
  renderDayDialog();
}

function formatReadableDate(value) {
  return parseDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  els.personToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-person]");
    if (!button) return;
    state.selectedPerson = button.dataset.person;
    renderPersonButtons();
  });

  els.choreGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chore]");
    if (!button) return;
    state.selectedChore = button.dataset.chore;
    els.customChoreInput.value = "";
    renderChoreButtons();
  });

  els.customChoreInput.addEventListener("input", () => {
    if (els.customChoreInput.value.trim()) {
      state.selectedChore = "";
      renderChoreButtons();
    }
  });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const choreName = els.customChoreInput.value.trim() || state.selectedChore;
    if (!choreName) {
      setStatus("Choose a chore or type a custom one.", "error");
      return;
    }

    const chore = {
      id: crypto.randomUUID(),
      person: state.selectedPerson,
      chore: choreName,
      date: els.dateInput.value,
      createdAt: new Date().toISOString()
    };

    try {
      await addChore(chore);
      state.selectedChore = "";
      els.customChoreInput.value = "";
      renderChoreButtons();
    } catch (error) {
      setStatus(`Could not save: ${error.message}`, "error");
    }
  });

  els.recentList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;
    try {
      await deleteChore(button.dataset.deleteId);
    } catch (error) {
      setStatus(`Could not delete: ${error.message}`, "error");
    }
  });

  els.calendarGrid.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) {
      try {
        await deleteChore(deleteButton.dataset.deleteId);
      } catch (error) {
        setStatus(`Could not delete: ${error.message}`, "error");
      }
      return;
    }

    const cell = event.target.closest("[data-date]");
    if (!cell) return;
    openDayDialog(cell.dataset.date);
  });

  els.dayDialogList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;
    try {
      await deleteChore(button.dataset.deleteId);
    } catch (error) {
      setStatus(`Could not delete: ${error.message}`, "error");
    }
  });

  els.dayDialogCloseButton.addEventListener("click", () => {
    els.dayDialog.close();
  });

  els.dayDialog.addEventListener("close", () => {
    dayDialogState.date = null;
  });

  els.dayDialogUseDateButton.addEventListener("click", () => {
    if (dayDialogState.date) {
      els.dateInput.value = dayDialogState.date;
    }
    els.dayDialog.close();
  });

  els.previousMonthButton.addEventListener("click", () => {
    state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - 1, 1);
    render();
  });

  els.nextMonthButton.addEventListener("click", () => {
    state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
    render();
  });

  els.settingsButton.addEventListener("click", () => {
    els.apiUrlInput.value = getConfiguredApiUrl();
    els.settingsDialog.showModal();
  });

  els.saveSettingsButton.addEventListener("click", async () => {
    localStorage.setItem(storageKeys.apiUrl, els.apiUrlInput.value.trim().replace(/\/$/, ""));
    els.settingsDialog.close();
    await loadChores();
  });

  els.clearLocalButton.addEventListener("click", () => {
    localStorage.removeItem(storageKeys.chores);
    if (!getConfiguredApiUrl()) {
      state.chores = [];
      render();
    }
  });
}

function init() {
  els.dateInput.value = formatDate(new Date());
  bindEvents();
  loadChores();
}

init();
