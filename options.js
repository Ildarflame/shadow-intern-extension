// options.js

const TONE_OPTIONS = ["neutral", "degen", "professional", "toxic"];

const MODE_PRESETS = [
  {
    id: "one-liner",
    label: "☝️ One-Liner",
    promptTemplate: "Drop one ruthless bar that nails the core of the tweet."
  },
  {
    id: "agree",
    label: "👍 Agree",
    promptTemplate: "Back the tweet up with extra alpha or a sharp supporting angle."
  },
  {
    id: "disagree",
    label: "👎 Disagree",
    promptTemplate: "Challenge the take with swagger, but keep it platform-safe."
  },
  {
    id: "funny",
    label: "😏 Funny",
    promptTemplate: "Add a sarcastic or meme-able twist that still reacts to the tweet."
  },
  {
    id: "question",
    label: "🤔 Question",
    promptTemplate: "Ask a pointed question that drags more context out of the author."
  },
  {
    id: "quote",
    label: "😎 Quote",
    promptTemplate: "Make it sound like a legendary CT quote that people will repost."
  },
  {
    id: "answer",
    label: "🤓 Answer",
    promptTemplate: "Provide the missing insight or alpha the tweet is begging for."
  },
  {
    id: "congrats",
    label: "👏 Congrats",
    promptTemplate: "Hype them up while keeping the CT edge."
  },
  {
    id: "thanks",
    label: "🙏 Thanks",
    promptTemplate: "Show gratitude but keep the tone playful and on-brand."
  }
];

const DEFAULT_GLOBAL_SETTINGS = {
  maxChars: 220,
  tone: "neutral",
  humanize: true
};

const DEFAULT_MODES = MODE_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = {
    enabled: true,
    label: preset.label,
    promptTemplate: preset.promptTemplate
  };
  return acc;
}, {});

function cloneDefaults(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sanitizeMaxChars(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_GLOBAL_SETTINGS.maxChars;
  return Math.max(50, Math.min(500, Math.round(num)));
}

function sanitizeHumanize(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return DEFAULT_GLOBAL_SETTINGS.humanize;
}

function normalizeGlobalSettings(raw = {}) {
  return {
    maxChars: sanitizeMaxChars(raw.maxChars ?? DEFAULT_GLOBAL_SETTINGS.maxChars),
    tone: TONE_OPTIONS.includes(raw.tone) ? raw.tone : DEFAULT_GLOBAL_SETTINGS.tone,
    humanize: sanitizeHumanize(raw.humanize)
  };
}

function mergeModes(stored = {}) {
  const merged = cloneDefaults(DEFAULT_MODES);

  Object.entries(stored || {}).forEach(([id, config]) => {
    if (!merged[id]) return;
    merged[id] = {
      enabled:
        typeof config.enabled === "boolean" ? config.enabled : merged[id].enabled,
      label: (config.label || "").trim() || merged[id].label,
      promptTemplate: (config.promptTemplate || "").trim() || merged[id].promptTemplate
    };
  });

  return merged;
}

function renderModes(modes) {
  const container = document.getElementById("modesContainer");
  container.innerHTML = "";

  Object.entries(modes).forEach(([id, config]) => {
    const card = document.createElement("div");
    card.className = "mode-card";
    card.dataset.modeId = id;
    if (!config.enabled) card.classList.add("disabled");

    const header = document.createElement("div");
    header.className = "mode-header";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = config.enabled;
    toggle.addEventListener("change", () => {
      card.classList.toggle("disabled", !toggle.checked);
    });

    const title = document.createElement("span");
    title.textContent = config.label;

    const labelLabel = document.createElement("label");
    labelLabel.textContent = "Label";
    labelLabel.htmlFor = `${id}-label`;

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.id = `${id}-label`;
    labelInput.value = config.label;
    labelInput.addEventListener("input", () => {
      title.textContent = labelInput.value.trim() || DEFAULT_MODES[id].label;
    });

    const promptLabel = document.createElement("label");
    promptLabel.textContent = "Prompt template";
    promptLabel.htmlFor = `${id}-prompt`;

    const promptTextarea = document.createElement("textarea");
    promptTextarea.id = `${id}-prompt`;
    promptTextarea.value = config.promptTemplate;

    header.appendChild(toggle);
    header.appendChild(title);

    card.appendChild(header);
    card.appendChild(labelLabel);
    card.appendChild(labelInput);
    card.appendChild(promptLabel);
    card.appendChild(promptTextarea);

    container.appendChild(card);
  });
}

function generatePersonaId() {
  return `persona-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function renderPersonas(personas) {
  const container = document.getElementById("personasContainer");
  container.innerHTML = "";

  if (!personas || personas.length === 0) {
    return;
  }

  personas.forEach((persona) => {
    const card = document.createElement("div");
    card.className = "persona-card";
    card.dataset.personaId = persona.id;
    card.style.cssText = `
      border: 1px solid #2f3336;
      border-radius: 12px;
      padding: 12px;
      margin-top: 12px;
      background: rgba(255, 255, 255, 0.02);
    `;

    const header = document.createElement("div");
    header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";

    const title = document.createElement("input");
    title.type = "text";
    title.value = persona.name || "";
    title.placeholder = "Persona name";
    title.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #2f3336;
      background: #000;
      color: #e7e9ea;
      font-size: 13px;
      font-weight: 600;
      margin-right: 8px;
    `;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.cssText = `
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid #f4212e;
      background: transparent;
      color: #f4212e;
      font-size: 12px;
      cursor: pointer;
    `;
    deleteBtn.addEventListener("click", () => {
      card.remove();
    });

    header.appendChild(title);
    header.appendChild(deleteBtn);

    const descLabel = document.createElement("label");
    descLabel.textContent = "Description";
    descLabel.style.cssText = "display: block; font-size: 13px; margin-top: 8px; margin-bottom: 4px;";

    const descTextarea = document.createElement("textarea");
    descTextarea.value = persona.description || "";
    descTextarea.placeholder = "How this persona talks (e.g., 'Speaks like a CT degen, uses slang, short replies, casual insults.')";
    descTextarea.style.cssText = `
      width: 100%;
      min-height: 60px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #2f3336;
      background: #000;
      color: #e7e9ea;
      font-size: 13px;
      resize: vertical;
      font-family: inherit;
    `;

    card.appendChild(header);
    card.appendChild(descLabel);
    card.appendChild(descTextarea);

    container.appendChild(card);
  });
}

function extractPersonasFromUI() {
  const cards = Array.from(document.querySelectorAll(".persona-card"));
  return cards.map((card) => {
    const id = card.dataset.personaId;
    const nameInput = card.querySelector('input[type="text"]');
    const descTextarea = card.querySelector("textarea");
    return {
      id,
      name: (nameInput.value || "").trim(),
      description: (descTextarea.value || "").trim()
    };
  }).filter(p => p.name || p.description); // Only include personas with at least name or description
}

function loadSettings() {
  chrome.storage.sync.get(null, (data) => {
    const licenseKey = data?.licenseKey || "";
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    const modes = mergeModes(data?.modes);
    const generalPrompt = data?.generalPrompt || "";
    const personas = data?.personas || [];

    document.getElementById("licenseKey").value = licenseKey;
    document.getElementById("maxChars").value = globalSettings.maxChars;
    document.getElementById("tone").value = globalSettings.tone;
    document.getElementById("humanizeToggle").checked = !!globalSettings.humanize;
    document.getElementById("generalPrompt").value = generalPrompt;

    renderModes(modes);
    renderPersonas(personas);
  });
}

function extractModesFromUI() {
  const cards = Array.from(document.querySelectorAll(".mode-card"));
  const modes = {};

  cards.forEach((card) => {
    const id = card.dataset.modeId;
    const defaultMode = DEFAULT_MODES[id];
    const enabled = card.querySelector('input[type="checkbox"]').checked;
    const labelInput = card.querySelector('input[type="text"]');
    const promptTextarea = card.querySelector("textarea");

    let labelValue = (labelInput.value || "").trim();
    if (!labelValue && defaultMode) {
      labelValue = defaultMode.label;
    }

    modes[id] = {
      enabled,
      label: labelValue,
      promptTemplate: (promptTextarea.value || "").trim()
    };
  });

  return modes;
}

function saveSettings() {
  const licenseKey = document.getElementById("licenseKey").value.trim();
  const maxCharsInput = document.getElementById("maxChars").value;
  const tone = document.getElementById("tone").value;
  const humanize = document.getElementById("humanizeToggle").checked;
  const generalPrompt = (document.getElementById("generalPrompt").value || "").trim();

  const globalSettings = {
    maxChars: sanitizeMaxChars(maxCharsInput),
    tone: TONE_OPTIONS.includes(tone) ? tone : DEFAULT_GLOBAL_SETTINGS.tone,
    humanize
  };

  const modes = extractModesFromUI();
  const personas = extractPersonasFromUI();

  // Enforce max 3 personas
  if (personas.length > 3) {
    const status = document.getElementById("status");
    status.textContent = "Error: Maximum 3 personas allowed";
    status.style.color = "#f4212e";
    setTimeout(() => {
      status.textContent = "";
      status.style.color = "#4caf50";
    }, 2000);
    return;
  }

  chrome.storage.sync.set(
    {
      licenseKey,
      globalSettings,
      modes,
      generalPrompt,
      personas
    },
    () => {
      chrome.storage.sync.remove(["language", "toxicity", "length", "temperature"]);
      const status = document.getElementById("status");
      status.textContent = "Saved ✅";
      setTimeout(() => {
        status.textContent = "";
      }, 1500);
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  document
    .getElementById("saveBtn")
    .addEventListener("click", saveSettings);

  // Add persona button
  document.getElementById("addPersonaBtn").addEventListener("click", () => {
    chrome.storage.sync.get(['personas'], (data) => {
      const personas = data.personas || [];
      if (personas.length >= 3) {
        alert("Maximum 3 personas allowed. Delete one to add a new one.");
        return;
      }
      const newPersona = {
        id: generatePersonaId(),
        name: "",
        description: ""
      };
      personas.push(newPersona);
      renderPersonas(personas);
    });
  });
});