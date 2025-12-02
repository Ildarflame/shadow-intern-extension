const TONE_OPTIONS = ["neutral", "degen", "professional", "toxic"];

const DEFAULT_GLOBAL_SETTINGS = {
  maxChars: 220,
  tone: "neutral",
  humanize: true
};

function sanitizeMaxChars(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_GLOBAL_SETTINGS.maxChars;
  return Math.max(50, Math.min(500, Math.round(num)));
}

function sanitizeTone(value) {
  return TONE_OPTIONS.includes(value) ? value : DEFAULT_GLOBAL_SETTINGS.tone;
}

function sanitizeHumanize(value) {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return DEFAULT_GLOBAL_SETTINGS.humanize;
}

function normalizeGlobalSettings(raw = {}) {
  return {
    maxChars: sanitizeMaxChars(raw.maxChars),
    tone: sanitizeTone(raw.tone),
    humanize: sanitizeHumanize(raw.humanize)
  };
}

function saveGlobalSettings(next) {
  chrome.storage.sync.set({ globalSettings: next });
}

function updateLengthHint(maxChars) {
  const hint = document.getElementById("lengthHint");
  hint.textContent = `Current cap: ${maxChars} characters`;
}

function highlightLengthButton(maxChars) {
  const buttons = document.querySelectorAll(".length-btn");
  buttons.forEach((btn) => {
    const len = Number(btn.dataset.length);
    btn.classList.toggle("active", len === maxChars);
  });
}

// Tab Management
let activeTab = "reply";

function switchTab(tabName) {
  activeTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.toggle("active", content.id === `${tabName}Tab`);
  });
  
  // Load data for the active tab
  if (tabName === "personas") {
    loadPersonasTab();
  } else if (tabName === "history") {
    loadHistory();
  }
}

// License Badge
function updateLicenseBadge() {
  chrome.storage.sync.get(['licenseKey'], (data) => {
    const badge = document.getElementById("licenseBadge");
    if (data.licenseKey && data.licenseKey.trim()) {
      // For now, just show ACTIVE if license key exists
      // In a full implementation, you'd validate it
      badge.textContent = "LICENSE: ACTIVE";
      badge.classList.add("active");
    } else {
      badge.textContent = "LICENSE: UNKNOWN";
      badge.classList.remove("active");
    }
  });
}

// Personas Tab
function loadPersonasTab() {
  chrome.storage.sync.get(['personas', 'activePersonaId'], (data) => {
    const personas = data.personas || [];
    const activePersonaId = data.activePersonaId || null;
    const container = document.getElementById("personasContainer");
    container.innerHTML = "";

    if (personas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No personas yet.<br>
          Create your first persona in Settings.
        </div>
      `;
      return;
    }

    personas.forEach((persona) => {
      const card = document.createElement("div");
      card.className = "persona-card";
      if (persona.id === activePersonaId) {
        card.classList.add("active");
      }

      const name = document.createElement("div");
      name.className = "persona-name";
      name.textContent = persona.name || `Persona ${persona.id.slice(-4)}`;

      const desc = document.createElement("div");
      desc.className = "persona-desc";
      desc.textContent = persona.description || "No description";

      card.appendChild(name);
      card.appendChild(desc);

      if (persona.id === activePersonaId) {
        const badge = document.createElement("span");
        badge.className = "persona-badge";
        badge.textContent = "ACTIVE";
        card.appendChild(badge);
      }

      container.appendChild(card);
    });
  });
}

// Persona Select (for Reply tab)
function loadPersonas() {
  chrome.storage.sync.get(['personas', 'activePersonaId'], (data) => {
    const personas = data.personas || [];
    const activePersonaId = data.activePersonaId || null;
    const personaSelect = document.getElementById("personaSelect");
    
    // Clear existing options except "No persona"
    personaSelect.innerHTML = '<option value="">No persona (default)</option>';
    
    personas.forEach((persona) => {
      const option = document.createElement("option");
      option.value = persona.id;
      option.textContent = persona.name || `Persona ${persona.id.slice(-4)}`;
      if (persona.id === activePersonaId) {
        option.selected = true;
      }
      personaSelect.appendChild(option);
    });
  });
}

// History Tab
function loadHistory() {
  chrome.storage.local.get(['replyHistory'], (data) => {
    const history = data.replyHistory || [];
    const container = document.getElementById("historyContainer");
    container.innerHTML = "";

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No replies yet.<br>
          Generate some replies on Twitter to see them here.
        </div>
      `;
      return;
    }

    // Show up to 10 items
    const itemsToShow = history.slice(0, 10);

    itemsToShow.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "history-item";

      const header = document.createElement("div");
      header.className = "history-header";

      const left = document.createElement("div");
      left.textContent = `${item.mode || 'unknown'}${item.personaName ? ` • ${item.personaName}` : ''}`;

      const time = document.createElement("div");
      const date = new Date(item.timestamp);
      time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      header.appendChild(left);
      header.appendChild(time);

      const text = document.createElement("div");
      text.className = "history-text";
      text.textContent = item.replyText || "";

      const actions = document.createElement("div");
      actions.className = "history-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(item.replyText || "").then(() => {
          copyBtn.textContent = "Copied!";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "Copy";
            copyBtn.classList.remove("copied");
          }, 2000);
        });
      });

      actions.appendChild(copyBtn);

      itemDiv.appendChild(header);
      itemDiv.appendChild(text);
      itemDiv.appendChild(actions);

      container.appendChild(itemDiv);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Tab switching
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTab(tab.dataset.tab);
    });
  });

  // License badge
  updateLicenseBadge();

  // Reply tab controls
  const toneSelect = document.getElementById("toneSelect");
  const humanizeToggle = document.getElementById("humanizeToggle");
  const lengthButtons = document.querySelectorAll(".length-btn");
  const personaSelect = document.getElementById("personaSelect");

  // Load initial settings
  chrome.storage.sync.get(null, (data) => {
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    highlightLengthButton(globalSettings.maxChars);
    updateLengthHint(globalSettings.maxChars);
    toneSelect.value = globalSettings.tone;
    humanizeToggle.checked = !!globalSettings.humanize;
  });

  loadPersonas();
  loadHistory();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.replyHistory) {
      if (activeTab === "history") {
        loadHistory();
      }
    }
    if (changes.personas || changes.activePersonaId) {
      loadPersonas();
      if (activeTab === "personas") {
        loadPersonasTab();
      }
    }
    if (changes.licenseKey) {
      updateLicenseBadge();
    }
  });

  // Length buttons
  lengthButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = Number(btn.dataset.length);
      highlightLengthButton(selected);
      updateLengthHint(selected);

      chrome.storage.sync.get("globalSettings", (data) => {
        const current = normalizeGlobalSettings(data?.globalSettings);
        saveGlobalSettings({ ...current, maxChars: selected });
      });
    });
  });

  // Tone select
  toneSelect.addEventListener("change", () => {
    const tone = toneSelect.value;
    chrome.storage.sync.get("globalSettings", (data) => {
      const current = normalizeGlobalSettings(data?.globalSettings);
      saveGlobalSettings({ ...current, tone });
    });
  });

  // Humanize toggle
  humanizeToggle.addEventListener("change", () => {
    const humanize = humanizeToggle.checked;
    chrome.storage.sync.get("globalSettings", (data) => {
      const current = normalizeGlobalSettings(data?.globalSettings);
      saveGlobalSettings({ ...current, humanize });
    });
  });

  // Persona select
  personaSelect.addEventListener("change", () => {
    const personaId = personaSelect.value || null;
    chrome.storage.sync.set({ activePersonaId: personaId }, () => {
      // Refresh personas tab if it's active
      if (activeTab === "personas") {
        loadPersonasTab();
      }
    });
  });

  // Open options buttons
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const openOptionsFromPersonas = document.getElementById("openOptionsFromPersonas");
  
  [openOptionsBtn, openOptionsFromPersonas].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("options.html"));
        }
      });
    }
  });
});
