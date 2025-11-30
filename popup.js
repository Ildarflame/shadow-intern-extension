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

function loadHistory() {
  chrome.storage.local.get(['replyHistory'], (data) => {
    const history = data.replyHistory || [];
    const container = document.getElementById("historyContainer");
    container.innerHTML = "";

    if (history.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: #7a7f87; padding: 8px;">No recent replies</div>';
      return;
    }

    history.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.style.cssText = `
        border: 1px solid #2f3336;
        border-radius: 8px;
        padding: 8px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.02);
      `;

      const header = document.createElement("div");
      header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 11px; color: #8b98a5;";

      const left = document.createElement("div");
      left.textContent = `${item.mode || 'unknown'}${item.personaName ? ` • ${item.personaName}` : ''}`;

      const time = document.createElement("div");
      const date = new Date(item.timestamp);
      time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      header.appendChild(left);
      header.appendChild(time);

      const text = document.createElement("div");
      text.textContent = item.replyText || "";
      text.style.cssText = "font-size: 12px; color: #e7e9ea; margin-bottom: 6px; max-height: 60px; overflow: hidden; text-overflow: ellipsis;";

      const actions = document.createElement("div");
      actions.style.cssText = "display: flex; gap: 8px;";

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.style.cssText = `
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid #2f3336;
        background: transparent;
        color: rgb(29,155,240);
        font-size: 11px;
        cursor: pointer;
      `;
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(item.replyText || "").then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1000);
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
  const toneSelect = document.getElementById("toneSelect");
  const humanizeToggle = document.getElementById("humanizeToggle");
  const lengthButtons = document.querySelectorAll(".length-btn");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const personaSelect = document.getElementById("personaSelect");

  chrome.storage.sync.get(null, (data) => {
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    highlightLengthButton(globalSettings.maxChars);
    updateLengthHint(globalSettings.maxChars);
    toneSelect.value = globalSettings.tone;
    humanizeToggle.checked = !!globalSettings.humanize;
  });

  loadPersonas();
  loadHistory();

  // Refresh history when popup opens
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.replyHistory) {
      loadHistory();
    }
    if (changes.personas || changes.activePersonaId) {
      loadPersonas();
    }
  });

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

  toneSelect.addEventListener("change", () => {
    const tone = toneSelect.value;
    chrome.storage.sync.get("globalSettings", (data) => {
      const current = normalizeGlobalSettings(data?.globalSettings);
      saveGlobalSettings({ ...current, tone });
    });
  });

  humanizeToggle.addEventListener("change", () => {
    const humanize = humanizeToggle.checked;
    chrome.storage.sync.get("globalSettings", (data) => {
      const current = normalizeGlobalSettings(data?.globalSettings);
      saveGlobalSettings({ ...current, humanize });
    });
  });

  personaSelect.addEventListener("change", () => {
    const personaId = personaSelect.value || null;
    chrome.storage.sync.set({ activePersonaId: personaId });
  });

  openOptionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });
});

