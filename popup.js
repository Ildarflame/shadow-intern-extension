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

document.addEventListener("DOMContentLoaded", () => {
  const toneSelect = document.getElementById("toneSelect");
  const humanizeToggle = document.getElementById("humanizeToggle");
  const lengthButtons = document.querySelectorAll(".length-btn");
  const openOptionsBtn = document.getElementById("openOptionsBtn");

  chrome.storage.sync.get(null, (data) => {
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    highlightLengthButton(globalSettings.maxChars);
    updateLengthHint(globalSettings.maxChars);
    toneSelect.value = globalSettings.tone;
    humanizeToggle.checked = !!globalSettings.humanize;
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

  openOptionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });
});

