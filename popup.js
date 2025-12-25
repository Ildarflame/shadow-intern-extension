// popup.js - Refactored with loadState, renderState, bindEvents

const TONE_OPTIONS = ["neutral", "degen", "professional", "toxic"];

const DEFAULT_GLOBAL_SETTINGS = {
  maxChars: 220,
  tone: "neutral",
  humanize: true
};

// API Configuration
const LICENSE_VALIDATE_URL = "https://api.shadowintern.xyz/license/validate";

// Cache TTL: 60 seconds
const CACHE_TTL_MS = 60 * 1000;

// ============================================================================
// Utility Functions
// ============================================================================

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

  const planName = planMap[planCode.toLowerCase()] || planCode;
  return planName;
}

// ============================================================================
// License Management with Caching
// ============================================================================

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
    console.error("[Popup] License fetch error:", error);
    return {
      error: "NETWORK_ERROR",
      message: error.message || "Network request failed"
    };
  }
}

// ============================================================================
// UI State Management
// ============================================================================

function showSkeleton() {
  document.getElementById("skeletonState").style.display = "block";
  document.getElementById("usageCard").classList.add("hidden");
  document.getElementById("emptyState").classList.remove("visible");
  document.getElementById("controlsCard").classList.add("hidden");
}

function hideSkeleton() {
  document.getElementById("skeletonState").style.display = "none";
}

function showEmptyState(title, message, ctaText, ctaAction) {
  hideSkeleton();
  document.getElementById("usageCard").classList.add("hidden");
  document.getElementById("emptyState").classList.add("visible");
  document.getElementById("controlsCard").classList.add("hidden");
  
  document.getElementById("emptyStateTitle").textContent = title;
  document.getElementById("emptyStateMessage").textContent = message;
  const ctaBtn = document.getElementById("emptyStateCta");
  ctaBtn.textContent = ctaText;
  ctaBtn.onclick = ctaAction;
}

function showUsageCard() {
  hideSkeleton();
  document.getElementById("usageCard").classList.remove("hidden");
  document.getElementById("emptyState").classList.remove("visible");
  document.getElementById("controlsCard").classList.remove("hidden");
}

function updateProgressBar(remaining, max) {
  const progressBar = document.getElementById("progressBar");
  if (max === null || max === undefined || max === 0) {
    progressBar.style.width = "100%";
    progressBar.className = "progress-bar";
    return;
  }

  const percentage = Math.max(0, Math.min(100, (remaining / max) * 100));
  progressBar.style.width = `${percentage}%`;

  progressBar.className = "progress-bar";
  if (remaining === 0) {
    progressBar.classList.add("zero");
  } else if (remaining <= max * 0.2) {
    progressBar.classList.add("low");
  }
}

function highlightLengthSegment(maxChars) {
  const segments = document.querySelectorAll(".length-segment");
  segments.forEach((btn) => {
    const len = Number(btn.dataset.length);
    btn.classList.toggle("active", len === maxChars);
  });
}

function updateStatusPill(status, className = "") {
  const statusPill = document.getElementById("statusPill");
  statusPill.textContent = status;
  statusPill.className = `status-pill ${className}`;
}

// ============================================================================
// Render State
// ============================================================================

function renderLicenseUI(licenseInfo, isOffline = false) {
  const statusPill = document.getElementById("statusPill");
  const planValue = document.getElementById("planValue");
  const remainingValue = document.getElementById("remainingValue");

  // Handle no license key
  if (!licenseInfo || licenseInfo.error === "NO_LICENSE_KEY") {
    updateStatusPill("NO LICENSE", "no-license");
    showEmptyState(
      "Set up in 30 seconds",
      "We send the tweet text to Shadow Intern API to generate your reply.",
      "Set up",
      () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("options.html"));
        }
      }
    );
    return;
  }

  // Handle network errors - show offline status and use cached data
  if (licenseInfo.error === "NETWORK_ERROR") {
    if (isOffline && licenseInfo) {
      // Use cached data if available
      const planName = formatPlanName(licenseInfo.planCode);
      planValue.textContent = planName;
      
      const remaining = licenseInfo.remainingToday;
      if (remaining !== null && remaining !== undefined) {
        remainingValue.textContent = remaining.toString();
        remainingValue.className = "remaining-value";
        if (remaining === 0) {
          remainingValue.classList.add("zero");
        } else if (licenseInfo.limitPerDay && remaining <= licenseInfo.limitPerDay * 0.2) {
          remainingValue.classList.add("low");
        }
        updateProgressBar(remaining, licenseInfo.limitPerDay);
      } else {
        remainingValue.textContent = "Unlimited";
        remainingValue.className = "remaining-value";
        updateProgressBar(null, null);
      }
      
      showUsageCard();
      
      // Show offline status
      const isExpired = licenseInfo.expiresAt && new Date(licenseInfo.expiresAt) < new Date();
      if (isExpired) {
        updateStatusPill("EXPIRED", "expired");
      } else {
        updateStatusPill("ACTIVE", "active");
      }
    } else {
      updateStatusPill("STATUS UNAVAILABLE", "expired");
      showEmptyState(
        "Connection error",
        "Unable to validate license. Please check your connection.",
        "Retry",
        () => {
          chrome.storage.sync.get(['licenseKey'], async (data) => {
            const licenseKey = data?.licenseKey;
            if (licenseKey) {
              loadState();
            }
          });
        }
      );
    }
    return;
  }

  // Handle invalid/expired license
  if (licenseInfo.error === "INVALID_LICENSE" || !licenseInfo.valid) {
    updateStatusPill("EXPIRED", "expired");
    showEmptyState(
      "License invalid or expired",
      "Please update your license key in settings or upgrade your plan.",
      "Fix license",
      () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("options.html"));
        }
      }
    );
    return;
  }

  // Valid license - check if expired
  const isExpired = licenseInfo.expiresAt && new Date(licenseInfo.expiresAt) < new Date();
  
  if (isExpired) {
    updateStatusPill("EXPIRED", "expired");
    showEmptyState(
      "License expired",
      "Your license has expired. Please renew or upgrade your plan.",
      "Upgrade plan",
      () => {
        chrome.tabs.create({ url: "https://shadowintern.xyz/pricing" });
      }
    );
    return;
  }

  // Active license
  updateStatusPill("ACTIVE", "active");
  showUsageCard();
  
  // Format plan display
  const planName = formatPlanName(licenseInfo.planCode);
  planValue.textContent = planName;
  
  // Show remaining today
  const remaining = licenseInfo.remainingToday;
  if (remaining !== null && remaining !== undefined) {
    remainingValue.textContent = remaining.toString();
    remainingValue.className = "remaining-value";
    if (remaining === 0) {
      remainingValue.classList.add("zero");
    } else if (licenseInfo.limitPerDay && remaining <= licenseInfo.limitPerDay * 0.2) {
      remainingValue.classList.add("low");
    }
    updateProgressBar(remaining, licenseInfo.limitPerDay);
  } else {
    remainingValue.textContent = "Unlimited";
    remainingValue.className = "remaining-value";
    updateProgressBar(null, null);
  }
}

function renderControls(globalSettings, personas, activePersonaId) {
  // Tone
  const toneSelect = document.getElementById("toneSelect");
  toneSelect.value = globalSettings.tone;

  // Humanize toggle
  const humanizeToggle = document.getElementById("humanizeToggle");
  humanizeToggle.checked = !!globalSettings.humanize;

  // Length segments
  highlightLengthSegment(globalSettings.maxChars);

  // Persona select
  const personaSelect = document.getElementById("personaSelect");
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
}

// ============================================================================
// Load State
// ============================================================================

async function loadState() {
  // Show skeleton while loading
  showSkeleton();
  updateStatusPill("LOADING", "loading");

  // Read licenseKey from chrome.storage
  chrome.storage.sync.get(['licenseKey', 'globalSettings', 'personas', 'activePersonaId'], async (data) => {
    const licenseKey = data?.licenseKey;
    
    // Load and render controls
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    const personas = data?.personas || [];
    const activePersonaId = data?.activePersonaId || null;
    renderControls(globalSettings, personas, activePersonaId);
    
    if (!licenseKey || !licenseKey.trim()) {
      renderLicenseUI(null);
      return;
    }

    // Check cache first
    const cachedInfo = await getCachedLicenseInfo();
    
    // If cache is valid, show cached data immediately
    if (cachedInfo) {
      renderLicenseUI(cachedInfo, false);
    }

    // Always try to fetch fresh data (but don't block UI)
    const freshInfo = await fetchLicenseInfo(licenseKey);
    
    // If we got fresh data, update UI and cache
    if (freshInfo && !freshInfo.error) {
      renderLicenseUI(freshInfo, false);
      
      // Cache the fresh data
      chrome.storage.local.set({
        cachedLicenseInfo: {
          ...freshInfo,
          cachedAt: Date.now()
        }
      });
    } else if (freshInfo && freshInfo.error === "NETWORK_ERROR") {
      // Network error - use cached data if available
      if (cachedInfo) {
        renderLicenseUI(cachedInfo, true); // isOffline = true
      } else {
        renderLicenseUI(freshInfo, false);
      }
    } else {
      // Invalid/expired license - update UI and clear cache
      renderLicenseUI(freshInfo, false);
      chrome.storage.local.remove(['cachedLicenseInfo']);
    }
  });
}

// ============================================================================
// Bind Events
// ============================================================================

function bindEvents() {
  // Save global settings
  function saveGlobalSettings(next) {
    chrome.storage.sync.set({ globalSettings: next });
  }

  // Length segments
  document.querySelectorAll(".length-segment").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = Number(btn.dataset.length);
      highlightLengthSegment(selected);

      chrome.storage.sync.get("globalSettings", (data) => {
        const current = normalizeGlobalSettings(data?.globalSettings);
        saveGlobalSettings({ ...current, maxChars: selected });
      });
    });
  });

  // Tone select
  const toneSelect = document.getElementById("toneSelect");
  toneSelect.addEventListener("change", () => {
    const tone = toneSelect.value;
    chrome.storage.sync.get("globalSettings", (data) => {
      const current = normalizeGlobalSettings(data?.globalSettings);
      saveGlobalSettings({ ...current, tone });
    });
  });

  // Humanize toggle
  const humanizeToggle = document.getElementById("humanizeToggle");
  humanizeToggle.addEventListener("change", () => {
    const humanize = humanizeToggle.checked;
    chrome.storage.sync.get("globalSettings", (data) => {
      const current = normalizeGlobalSettings(data?.globalSettings);
      saveGlobalSettings({ ...current, humanize });
    });
  });

  // Persona select
  const personaSelect = document.getElementById("personaSelect");
  personaSelect.addEventListener("change", () => {
    const personaId = personaSelect.value || null;
    chrome.storage.sync.set({ activePersonaId: personaId });
  });

  // Open X button
  const openXBtn = document.getElementById("openXBtn");
  if (openXBtn) {
    openXBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://x.com" });
    });
  }

  // Open settings button
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL("options.html"));
      }
    });
  }

  // Help button
  const helpBtn = document.getElementById("helpBtn");
  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("help.html") });
    });
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.personas || changes.activePersonaId) {
      chrome.storage.sync.get(['personas', 'activePersonaId'], (data) => {
        const personas = data.personas || [];
        const activePersonaId = data.activePersonaId || null;
        chrome.storage.sync.get(['globalSettings'], (data2) => {
          const globalSettings = normalizeGlobalSettings(data2?.globalSettings);
          renderControls(globalSettings, personas, activePersonaId);
        });
      });
    }
    if (changes.licenseKey) {
      // License key changed - clear cache and refresh
      chrome.storage.local.remove(['cachedLicenseInfo'], () => {
        loadState();
      });
    }
    if (changes.globalSettings) {
      chrome.storage.sync.get(['globalSettings', 'personas', 'activePersonaId'], (data) => {
        const globalSettings = normalizeGlobalSettings(data?.globalSettings);
        const personas = data.personas || [];
        const activePersonaId = data.activePersonaId || null;
        renderControls(globalSettings, personas, activePersonaId);
      });
    }
  });
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  bindEvents();
});
