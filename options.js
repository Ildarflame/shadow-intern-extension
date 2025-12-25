// options.js - Modern Options Page with Component Helpers

const LICENSE_VALIDATE_URL = "https://api.shadowintern.xyz/license/validate";
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

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

// ============================================================================
// Utility Functions
// ============================================================================

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

function formatPlanName(planCode) {
  if (!planCode) return "—";
  
  const planMap = {
    "pro_monthly": "Pro",
    "pro_yearly": "Pro",
    "pro": "Pro",
    "max_monthly": "Max",
    "max_yearly": "Max",
    "max": "Max",
    "basic_monthly": "Basic",
    "basic_yearly": "Basic",
    "basic": "Basic",
    "starter_monthly": "Starter",
    "starter_yearly": "Starter",
    "starter": "Starter",
  };

  return planMap[planCode.toLowerCase()] || planCode;
}

function validateLicenseKeyFormat(key) {
  if (!key || !key.trim()) return false;
  const trimmed = key.trim();
  return /^shadow-[a-zA-Z0-9-]+$/i.test(trimmed);
}

// ============================================================================
// Toast Notification System
// ============================================================================

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "toastSlideIn 0.3s ease reverse";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ============================================================================
// Modal System
// ============================================================================

let modalResolve = null;

function showModal(title, message) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    const overlay = document.getElementById("modalOverlay");
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalMessage").textContent = message;
    overlay.classList.add("active");
  });
}

function hideModal() {
  const overlay = document.getElementById("modalOverlay");
  overlay.classList.remove("active");
  modalResolve = null;
}

document.getElementById("modalCancel").addEventListener("click", () => {
  if (modalResolve) modalResolve(false);
  hideModal();
});

document.getElementById("modalConfirm").addEventListener("click", () => {
  if (modalResolve) modalResolve(true);
  hideModal();
});

// ============================================================================
// License Management
// ============================================================================

let cachedLicenseInfo = null;

async function getCachedLicenseInfo() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['cachedLicenseInfo'], (data) => {
      const cached = data?.cachedLicenseInfo;
      if (!cached || !cached.cachedAt) {
        resolve(null);
        return;
      }

      const age = Date.now() - cached.cachedAt;
      if (age > CACHE_TTL_MS) {
        resolve(null);
        return;
      }

      const { cachedAt, ...licenseInfo } = cached;
      resolve(licenseInfo);
    });
  });
}

async function fetchLicenseInfo(licenseKey) {
  if (!licenseKey || !licenseKey.trim()) {
    return { error: "NO_LICENSE_KEY" };
  }

  try {
    const response = await fetch(LICENSE_VALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key: licenseKey }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: "INVALID_LICENSE",
        status: response.status,
        message: errorData.error || "License validation failed"
      };
    }

    const data = await response.json();
    
    if (!data.valid) {
      return {
        error: "INVALID_LICENSE",
        reason: data.reason,
        message: data.error || "License invalid or expired"
      };
    }

    return {
      valid: true,
      licenseKey: data.licenseKey,
      planCode: data.planCode || null,
      expiresAt: data.expiresAt || null,
      limitPerDay: data.limitPerDay || null,
      remainingToday: data.remainingToday !== undefined ? data.remainingToday : null
    };
  } catch (error) {
    console.error("[Options] License fetch error:", error);
    return {
      error: "NETWORK_ERROR",
      message: error.message || "Network request failed"
    };
  }
}

async function updateLicenseInfo(licenseKey) {
  const statusPill = document.getElementById("licenseStatusPill");
  const planLabel = document.getElementById("planLabel");
  const remainingToday = document.getElementById("remainingToday");
  const statusInline = document.getElementById("licenseStatusInline");

  if (!licenseKey || !licenseKey.trim()) {
    statusPill.textContent = "INACTIVE";
    statusPill.classList.remove("active");
    planLabel.textContent = "—";
    remainingToday.textContent = "Remaining today: —";
    statusInline.textContent = "";
    statusInline.className = "license-status-inline";
    return;
  }

  // Check cache first
  const cached = await getCachedLicenseInfo();
  if (cached && cached.licenseKey === licenseKey) {
    updateLicenseUI(cached);
  }

  // Fetch fresh data
  statusPill.textContent = "CHECKING...";
  const info = await fetchLicenseInfo(licenseKey);

  if (info.error === "NETWORK_ERROR" && cached && cached.licenseKey === licenseKey) {
    updateLicenseUI(cached);
    showToast("Using cached license info (offline)", "error");
    return;
  }

  if (info.error || !info.valid) {
    statusPill.textContent = "INACTIVE";
    statusPill.classList.remove("active");
    planLabel.textContent = "—";
    remainingToday.textContent = "Remaining today: —";
    
    statusInline.textContent = info.message || "Invalid license key";
    statusInline.className = "license-status-inline invalid";
    
    // Clear cache
    chrome.storage.local.remove(['cachedLicenseInfo']);
    return;
  }

  // Check expiration
  const isExpired = info.expiresAt && new Date(info.expiresAt) < new Date();
  
  if (isExpired) {
    statusPill.textContent = "EXPIRED";
    statusPill.classList.remove("active");
    statusInline.textContent = "License expired";
    statusInline.className = "license-status-inline expired";
  } else {
    statusPill.textContent = "ACTIVE";
    statusPill.classList.add("active");
    statusInline.textContent = "License key saved";
    statusInline.className = "license-status-inline saved";
  }

  // Cache the info
  chrome.storage.local.set({
    cachedLicenseInfo: {
      ...info,
      cachedAt: Date.now()
    }
  });

  updateLicenseUI(info);
}

function updateLicenseUI(info) {
  const planLabel = document.getElementById("planLabel");
  const remainingToday = document.getElementById("remainingToday");

  if (!info || !info.valid) {
    planLabel.textContent = "—";
    remainingToday.textContent = "Remaining today: —";
    return;
  }

  const planName = formatPlanName(info.planCode);
  planLabel.textContent = planName;

  const remaining = info.remainingToday;
  if (remaining !== null && remaining !== undefined) {
    remainingToday.textContent = `Remaining today: ${remaining}`;
  } else {
    remainingToday.textContent = "Remaining today: Unlimited";
  }
}

// ============================================================================
// Tab Navigation
// ============================================================================

function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;

      // Update buttons
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update content
      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.id === `tab-${targetTab}`) {
          content.classList.add("active");
        }
      });
    });
  });
}

// ============================================================================
// Reply Settings
// ============================================================================

function initReplySettings() {
  const toneSelect = document.getElementById("tone");
  const personaDefaultSelect = document.getElementById("personaDefault");
  const humanizeToggle = document.getElementById("humanizeToggle");
  const maxCharsSlider = document.getElementById("maxCharsSlider");
  const maxCharsInput = document.getElementById("maxChars");
  const lengthControl = document.getElementById("lengthControl");

  // Load persona options
  function loadPersonaOptions() {
    chrome.storage.sync.get(['personas', 'activePersonaId'], (data) => {
      const personas = data.personas || [];
      const activePersonaId = data.activePersonaId || null;
      
      personaDefaultSelect.innerHTML = '<option value="">No persona (default)</option>';
      personas.forEach((persona) => {
        const option = document.createElement("option");
        option.value = persona.id;
        option.textContent = persona.name || `Persona ${persona.id.slice(-4)}`;
        if (persona.id === activePersonaId) {
          option.selected = true;
        }
        personaDefaultSelect.appendChild(option);
      });
    });
  }

  // Load settings
  chrome.storage.sync.get(['globalSettings', 'personas', 'activePersonaId'], (data) => {
    const settings = normalizeGlobalSettings(data?.globalSettings);
    
    toneSelect.value = settings.tone;
    humanizeToggle.checked = settings.humanize;
    maxCharsSlider.value = settings.maxChars;
    maxCharsInput.value = settings.maxChars;
    
    // Update length segments
    updateLengthSegments(settings.maxChars);
    loadPersonaOptions();
    updatePreview();
  });

  // Tone change
  toneSelect.addEventListener("change", () => {
    updatePreview();
    markUnsaved();
  });

  // Persona default change
  personaDefaultSelect.addEventListener("change", () => {
    const personaId = personaDefaultSelect.value || null;
    chrome.storage.sync.set({ activePersonaId: personaId });
    markUnsaved();
  });

  // Humanize toggle
  humanizeToggle.addEventListener("change", () => {
    updatePreview();
    markUnsaved();
  });

  // Length segments
  lengthControl.querySelectorAll(".segment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const length = Number(btn.dataset.length);
      maxCharsSlider.value = length;
      maxCharsInput.value = length;
      updateLengthSegments(length);
      updatePreview();
      markUnsaved();
    });
  });

  // Slider sync
  maxCharsSlider.addEventListener("input", () => {
    maxCharsInput.value = maxCharsSlider.value;
    updateLengthSegments(Number(maxCharsSlider.value));
    updatePreview();
    markUnsaved();
  });

  // Input sync
  maxCharsInput.addEventListener("input", () => {
    const value = sanitizeMaxChars(maxCharsInput.value);
    maxCharsSlider.value = value;
    maxCharsInput.value = value;
    updateLengthSegments(value);
    updatePreview();
    markUnsaved();
  });

  // Listen for persona changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.personas || changes.activePersonaId) {
      loadPersonaOptions();
    }
  });
}

function updateLengthSegments(maxChars) {
  const segments = document.querySelectorAll(".segment-btn");
  segments.forEach((btn) => {
    const length = Number(btn.dataset.length);
    btn.classList.toggle("active", length === maxChars);
  });
}

function updatePreview() {
  const tone = document.getElementById("tone").value;
  const humanize = document.getElementById("humanizeToggle").checked;
  const maxChars = Number(document.getElementById("maxChars").value);
  const previewBox = document.getElementById("previewBox");

  // Generate preview text (local, no API call)
  const toneText = tone.charAt(0).toUpperCase() + tone.slice(1);
  const humanizeText = humanize ? "humanized" : "neutral";
  const lengthText = maxChars <= 150 ? "short" : maxChars <= 220 ? "medium" : "long";
  
  const previewText = `This is a ${toneText.toLowerCase()}, ${humanizeText}, ${lengthText} reply (max ${maxChars} chars). Example: "GM anon! Ready to alpha?"`;

  previewBox.innerHTML = `<div class="preview-content">${previewText}</div>`;
}

// ============================================================================
// Reply Modes (Accordion)
// ============================================================================

function renderModes(modes) {
  const container = document.getElementById("modesAccordion");
  container.innerHTML = "";

  Object.entries(modes).forEach(([id, config]) => {
    const modeItem = document.createElement("div");
    modeItem.className = `mode-item ${!config.enabled ? "disabled" : ""}`;
    modeItem.dataset.modeId = id;

    const header = document.createElement("div");
    header.className = "mode-header";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "mode-toggle";
    toggle.checked = config.enabled;
    toggle.addEventListener("change", () => {
      modeItem.classList.toggle("disabled", !toggle.checked);
      markUnsaved();
    });

    const name = document.createElement("span");
    name.className = "mode-name";
    name.textContent = config.label;

    const editBtn = document.createElement("button");
    editBtn.className = "mode-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const content = modeItem.querySelector(".mode-content");
      content.classList.toggle("expanded");
      editBtn.textContent = content.classList.contains("expanded") ? "Collapse" : "Edit";
    });

    header.appendChild(toggle);
    header.appendChild(name);
    header.appendChild(editBtn);

    const content = document.createElement("div");
    content.className = "mode-content";

    const labelGroup = document.createElement("div");
    labelGroup.className = "form-group";

    const labelLabel = document.createElement("label");
    labelLabel.textContent = "Label";
    labelLabel.htmlFor = `${id}-label`;

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.id = `${id}-label`;
    labelInput.className = "form-control";
    labelInput.value = config.label;
    labelInput.addEventListener("input", () => {
      name.textContent = labelInput.value.trim() || DEFAULT_MODES[id].label;
      markUnsaved();
    });

    labelGroup.appendChild(labelLabel);
    labelGroup.appendChild(labelInput);

    const promptGroup = document.createElement("div");
    promptGroup.className = "form-group";

    const promptLabel = document.createElement("label");
    promptLabel.textContent = "Prompt Template";
    promptLabel.htmlFor = `${id}-prompt`;

    const promptTextarea = document.createElement("textarea");
    promptTextarea.id = `${id}-prompt`;
    promptTextarea.className = "form-control";
    promptTextarea.value = config.promptTemplate;
    promptTextarea.rows = 3;
    promptTextarea.addEventListener("input", markUnsaved);

    promptGroup.appendChild(promptLabel);
    promptGroup.appendChild(promptTextarea);

    const resetBtn = document.createElement("button");
    resetBtn.className = "mode-reset-btn";
    resetBtn.textContent = "Reset mode to default";
    resetBtn.addEventListener("click", () => {
      const defaultMode = DEFAULT_MODES[id];
      labelInput.value = defaultMode.label;
      promptTextarea.value = defaultMode.promptTemplate;
      name.textContent = defaultMode.label;
      markUnsaved();
    });

    content.appendChild(labelGroup);
    content.appendChild(promptGroup);
    content.appendChild(resetBtn);

    modeItem.appendChild(header);
    modeItem.appendChild(content);

    container.appendChild(modeItem);
  });
}

function extractModesFromUI() {
  const items = Array.from(document.querySelectorAll(".mode-item"));
  const modes = {};

  items.forEach((item) => {
    const id = item.dataset.modeId;
    const defaultMode = DEFAULT_MODES[id];
    const enabled = item.querySelector(".mode-toggle").checked;
    const labelInput = item.querySelector('input[type="text"]');
    const promptTextarea = item.querySelector("textarea");

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

// ============================================================================
// Personas
// ============================================================================

function generatePersonaId() {
  return `persona-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function renderPersonas(personas) {
  const container = document.getElementById("personasGrid");
  const addBtn = document.getElementById("addPersonaBtn");
  container.innerHTML = "";

  if (!personas || personas.length === 0) {
    addBtn.disabled = false;
    return;
  }

  personas.forEach((persona) => {
    const card = document.createElement("div");
    card.className = "persona-card";
    card.dataset.personaId = persona.id;

    const header = document.createElement("div");
    header.className = "persona-header";

    const name = document.createElement("div");
    name.className = "persona-name";
    name.textContent = persona.name || "Unnamed Persona";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "var(--spacing-xs)";

    const editBtn = document.createElement("button");
    editBtn.className = "persona-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      const form = card.querySelector(".persona-form");
      form.classList.toggle("editing");
      if (form.classList.contains("editing")) {
        editBtn.textContent = "Cancel";
        form.querySelector('input[type="text"]').value = persona.name || "";
        form.querySelector("textarea").value = persona.description || "";
      } else {
        editBtn.textContent = "Edit";
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "persona-delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await showModal(
        "Delete Persona",
        `Are you sure you want to delete "${persona.name || "this persona"}"? This action cannot be undone.`
      );
      if (confirmed) {
        card.remove();
        updateAddPersonaButton();
        markUnsaved();
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(name);
    header.appendChild(actions);

    const description = document.createElement("div");
    description.className = "persona-description";
    description.textContent = persona.description || "No description";

    const form = document.createElement("div");
    form.className = "persona-form";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "form-control";
    nameInput.placeholder = "Persona name";
    nameInput.value = persona.name || "";

    const descTextarea = document.createElement("textarea");
    descTextarea.className = "form-control";
    descTextarea.placeholder = "How this persona talks (e.g., 'Heavy CT slang, punchy, meme-driven, informal tone.')";
    descTextarea.rows = 3;
    descTextarea.value = persona.description || "";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "Save";
    saveBtn.style.marginTop = "var(--spacing-md)";
    saveBtn.addEventListener("click", () => {
      const newName = nameInput.value.trim();
      const newDesc = descTextarea.value.trim();
      if (newName) {
        name.textContent = newName;
        description.textContent = newDesc || "No description";
        form.classList.remove("editing");
        editBtn.textContent = "Edit";
        markUnsaved();
        updateAddPersonaButton();
      } else {
        showToast("Persona name is required", "error");
      }
    });

    form.appendChild(nameInput);
    form.appendChild(descTextarea);
    form.appendChild(saveBtn);

    card.appendChild(header);
    card.appendChild(description);
    card.appendChild(form);

    container.appendChild(card);
  });

  updateAddPersonaButton();
}

function updateAddPersonaButton() {
  const personas = extractPersonasFromUI();
  const addBtn = document.getElementById("addPersonaBtn");
  if (addBtn) {
    addBtn.disabled = personas.length >= 3;
  }
}

function extractPersonasFromUI() {
  const cards = Array.from(document.querySelectorAll(".persona-card"));
  return cards.map((card) => {
    const id = card.dataset.personaId;
    // Check if in edit mode, use form inputs; otherwise use display elements
    const form = card.querySelector(".persona-form");
    const isEditing = form?.classList.contains("editing");
    
    let name, description;
    if (isEditing) {
      const nameInput = form.querySelector('input[type="text"]');
      const descTextarea = form.querySelector("textarea");
      name = (nameInput?.value || "").trim();
      description = (descTextarea?.value || "").trim();
    } else {
      const nameEl = card.querySelector(".persona-name");
      const descEl = card.querySelector(".persona-description");
      name = (nameEl?.textContent || "").trim();
      description = (descEl?.textContent || "").trim();
    }
    
    return {
      id,
      name,
      description
    };
  }).filter(p => p.name || p.description);
}

// ============================================================================
// Settings Management
// ============================================================================

function exportSettings() {
  chrome.storage.sync.get(null, (data) => {
    const exportData = {
      licenseKey: data.licenseKey || "",
      globalSettings: data.globalSettings || {},
      modes: data.modes || {},
      generalPrompt: data.generalPrompt || "",
      personas: data.personas || []
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shadow-intern-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast("Settings exported successfully");
  });
}

function importSettings() {
  const fileInput = document.getElementById("importFile");
  fileInput.click();
  
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Validate structure
        if (typeof data !== "object") {
          throw new Error("Invalid file format");
        }

        // Import settings
        const importData = {};
        if (data.licenseKey !== undefined) importData.licenseKey = String(data.licenseKey);
        if (data.globalSettings) importData.globalSettings = data.globalSettings;
        if (data.modes) importData.modes = data.modes;
        if (data.generalPrompt !== undefined) importData.generalPrompt = String(data.generalPrompt);
        if (Array.isArray(data.personas)) importData.personas = data.personas.slice(0, 3);

        chrome.storage.sync.set(importData, () => {
          showToast("Settings imported successfully");
          setTimeout(() => {
            location.reload();
          }, 1000);
        });
      } catch (error) {
        showToast("Failed to import settings: " + error.message, "error");
      }
    };
    reader.readAsText(file);
    fileInput.value = ""; // Reset
  }, { once: true });
}

async function resetAllSettings() {
  const confirmed = await showModal(
    "Reset All Settings",
    "Are you sure you want to reset all settings to defaults? This action cannot be undone."
  );
  
  if (!confirmed) return;

  chrome.storage.sync.clear(() => {
    showToast("All settings reset to defaults");
    setTimeout(() => {
      location.reload();
    }, 1000);
  });
}

// ============================================================================
// Unsaved Changes Indicator
// ============================================================================

function markUnsaved() {
  const savedIndicator = document.getElementById("savedIndicator");
  savedIndicator.textContent = "Unsaved changes";
  savedIndicator.style.color = "var(--warning)";
}

// ============================================================================
// Save Settings
// ============================================================================

function saveSettings() {
  const licenseKey = document.getElementById("licenseKey").value.trim();
  const maxCharsInput = document.getElementById("maxChars").value;
  const tone = document.getElementById("tone").value;
  const humanize = document.getElementById("humanizeToggle").checked;
  const generalPrompt = (document.getElementById("generalPrompt").value || "").trim();

  // Validate license key format
  if (licenseKey && !validateLicenseKeyFormat(licenseKey)) {
    showToast("Invalid license key format. Expected: shadow-XXXX-XXXX", "error");
    return;
  }

  const globalSettings = {
    maxChars: sanitizeMaxChars(maxCharsInput),
    tone: TONE_OPTIONS.includes(tone) ? tone : DEFAULT_GLOBAL_SETTINGS.tone,
    humanize
  };

  const modes = extractModesFromUI();
  const personas = extractPersonasFromUI();

  // Enforce max 3 personas
  if (personas.length > 3) {
    showToast("Maximum 3 personas allowed", "error");
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
      const savedIndicator = document.getElementById("savedIndicator");
      savedIndicator.textContent = "Saved";
      savedIndicator.style.color = "var(--emerald)";
      showToast("Settings saved successfully");
      
      // Update license info if key changed
      if (licenseKey) {
        updateLicenseInfo(licenseKey);
      }
      
      setTimeout(() => {
        savedIndicator.textContent = "";
      }, 2000);
    }
  );
}

// ============================================================================
// Load Settings
// ============================================================================

function loadSettings() {
  chrome.storage.sync.get(null, (data) => {
    const licenseKey = data?.licenseKey || "";
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    const modes = mergeModes(data?.modes);
    const generalPrompt = data?.generalPrompt || "";
    const personas = data?.personas || [];
    const activePersonaId = data?.activePersonaId || null;

    // License
    document.getElementById("licenseKey").value = licenseKey;
    if (licenseKey) {
      updateLicenseInfo(licenseKey);
    }

    // Reply settings
    document.getElementById("tone").value = globalSettings.tone;
    document.getElementById("humanizeToggle").checked = !!globalSettings.humanize;
    document.getElementById("maxCharsSlider").value = globalSettings.maxChars;
    document.getElementById("maxChars").value = globalSettings.maxChars;
    updateLengthSegments(globalSettings.maxChars);

    // Persona default
    const personaDefaultSelect = document.getElementById("personaDefault");
    personaDefaultSelect.innerHTML = '<option value="">No persona (default)</option>';
    personas.forEach((persona) => {
      const option = document.createElement("option");
      option.value = persona.id;
      option.textContent = persona.name || `Persona ${persona.id.slice(-4)}`;
      if (persona.id === activePersonaId) {
        option.selected = true;
      }
      personaDefaultSelect.appendChild(option);
    });

    // General prompt
    document.getElementById("generalPrompt").value = generalPrompt;

    // Modes
    renderModes(modes);

    // Personas
    renderPersonas(personas);

    // Update preview
    updatePreview();
  });
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Initialize tabs
  initTabs();

  // Initialize reply settings
  initReplySettings();

  // Load settings
  loadSettings();

  // License key input
  document.getElementById("licenseKey").addEventListener("input", markUnsaved);
  
  // License check button
  document.getElementById("checkLicenseBtn").addEventListener("click", () => {
    const licenseKey = document.getElementById("licenseKey").value.trim();
    if (!licenseKey) {
      showToast("Please enter a license key", "error");
      return;
    }
    if (!validateLicenseKeyFormat(licenseKey)) {
      showToast("Invalid license key format. Expected: shadow-XXXX-XXXX", "error");
      return;
    }
    updateLicenseInfo(licenseKey);
  });
  
  // General prompt input
  document.getElementById("generalPrompt").addEventListener("input", markUnsaved);

  // Add persona button
  const addPersonaBtn = document.getElementById("addPersonaBtn");
  if (addPersonaBtn) {
    addPersonaBtn.addEventListener("click", () => {
      const personas = extractPersonasFromUI();
      if (personas.length >= 3) {
        showToast("Maximum 3 personas allowed", "error");
        return;
      }
      
      const newPersona = {
        id: generatePersonaId(),
        name: "",
        description: ""
      };
      
      const updatedPersonas = [...personas, newPersona];
      renderPersonas(updatedPersonas);
      markUnsaved();
      
      // Auto-open edit mode for new persona
      setTimeout(() => {
        const newCard = document.querySelector(`[data-persona-id="${newPersona.id}"]`);
        if (newCard) {
          const editBtn = newCard.querySelector(".persona-edit-btn");
          if (editBtn) editBtn.click();
        }
      }, 100);
    });
  }

  // Export/Import/Reset buttons
  document.getElementById("exportBtn").addEventListener("click", exportSettings);
  document.getElementById("importBtn").addEventListener("click", importSettings);
  document.getElementById("resetAllBtn").addEventListener("click", resetAllSettings);

  // Save button
  document.getElementById("saveBtn").addEventListener("click", saveSettings);
});
