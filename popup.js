const TONE_OPTIONS = ["neutral", "degen", "professional", "toxic"];

const DEFAULT_GLOBAL_SETTINGS = {
  maxChars: 220,
  tone: "neutral",
  humanize: true
};

// API Configuration
// The API base URL is configured here. To change it, update LICENSE_VALIDATE_URL below.
const LICENSE_VALIDATE_URL = "https://api.shadowintern.xyz/license/validate";

// Cache TTL: 60 seconds
const CACHE_TTL_MS = 60 * 1000;

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

function highlightLengthSegment(maxChars) {
  const segments = document.querySelectorAll(".length-segment");
  segments.forEach((btn) => {
    const len = Number(btn.dataset.length);
    btn.classList.toggle("active", len === maxChars);
  });
}

// License Management with Caching
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
        resolve(null); // Cache expired
        return;
      }

      // Return cached data without the cachedAt timestamp
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
    // Network error - return special error type
    return {
      error: "NETWORK_ERROR",
      message: error.message || "Network request failed"
    };
  }
}

function formatPlanName(planCode) {
  if (!planCode) return "—";
  
  // Convert plan codes to readable names
  const planMap = {
    "pro_monthly": "Pro",
    "pro_yearly": "Pro",
    "pro": "Pro",
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

  // Update color based on remaining
  progressBar.className = "progress-bar";
  if (remaining === 0) {
    progressBar.classList.add("zero");
  } else if (remaining <= max * 0.2) {
    progressBar.classList.add("low");
  }
}

function updateLicenseUI(licenseInfo, isOffline = false) {
  const statusPill = document.getElementById("statusPill");
  const usageCard = document.getElementById("usageCard");
  const planValue = document.getElementById("planValue");
  const remainingValue = document.getElementById("remainingValue");
  const offlineIndicator = document.getElementById("offlineIndicator");
  const upgradeBtn = document.getElementById("upgradeBtn");

  // Hide offline indicator by default
  offlineIndicator.classList.add("hidden");

  // Handle no license key
  if (!licenseInfo || licenseInfo.error === "NO_LICENSE_KEY") {
    statusPill.textContent = "EXPIRED";
    statusPill.className = "status-pill expired";
    showEmptyState(
      "Enter license key",
      "Get started by entering your license key in settings.",
      "Enter license key",
      () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("options.html"));
        }
      }
    );
    upgradeBtn.classList.add("hidden");
    return;
  }

  // Handle network errors - show offline status and use cached data
  if (licenseInfo.error === "NETWORK_ERROR") {
    if (isOffline && licenseInfo) {
      // Use cached data if available
      const planName = formatPlanName(licenseInfo.planCode);
      const limitPerDay = licenseInfo.limitPerDay;
      const planDisplay = limitPerDay ? `${planName} — ${limitPerDay}/day` : planName;
      planValue.textContent = planDisplay;
      
      const remaining = licenseInfo.remainingToday;
      if (remaining !== null && remaining !== undefined) {
        remainingValue.textContent = remaining.toString();
        remainingValue.className = "remaining-value";
        if (remaining === 0) {
          remainingValue.classList.add("zero");
        } else if (limitPerDay && remaining <= limitPerDay * 0.2) {
          remainingValue.classList.add("low");
        }
        updateProgressBar(remaining, limitPerDay);
      } else {
        remainingValue.textContent = "Unlimited";
        remainingValue.className = "remaining-value";
        updateProgressBar(null, null);
      }
      
      showUsageCard();
      
      // Show offline indicator
      offlineIndicator.classList.remove("hidden");
      offlineIndicator.textContent = "Offline";
      
      // Keep last known badge state
      if (licenseInfo.valid) {
        const isExpired = licenseInfo.expiresAt && new Date(licenseInfo.expiresAt) < new Date();
        if (isExpired) {
          statusPill.textContent = "EXPIRED";
          statusPill.className = "status-pill expired";
        } else {
          statusPill.textContent = "ACTIVE";
          statusPill.className = "status-pill active";
        }
      }
    } else {
      statusPill.textContent = "EXPIRED";
      statusPill.className = "status-pill expired";
      showEmptyState(
        "Connection error",
        "Unable to validate license. Please check your connection.",
        "Retry",
        () => {
          chrome.storage.sync.get(['licenseKey'], async (data) => {
            const licenseKey = data?.licenseKey;
            if (licenseKey) {
              updateLicenseInfo();
            }
          });
        }
      );
    }
    upgradeBtn.classList.add("hidden");
    return;
  }

  // Handle invalid/expired license
  if (licenseInfo.error === "INVALID_LICENSE" || !licenseInfo.valid) {
    statusPill.textContent = "EXPIRED";
    statusPill.className = "status-pill expired";
    showEmptyState(
      "Fix license",
      "Your license key is invalid or expired. Please update it in settings.",
      "Fix license",
      () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("options.html"));
        }
      }
    );
    upgradeBtn.classList.remove("hidden");
    return;
  }

  // Valid license - check if expired
  const isExpired = licenseInfo.expiresAt && new Date(licenseInfo.expiresAt) < new Date();
  
  if (isExpired) {
    statusPill.textContent = "EXPIRED";
    statusPill.className = "status-pill expired";
    showEmptyState(
      "License expired",
      "Your license has expired. Please renew or upgrade your plan.",
      "Fix license",
      () => {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("options.html"));
        }
      }
    );
    upgradeBtn.classList.remove("hidden");
    return;
  }

  // Active license
  statusPill.textContent = "ACTIVE";
  statusPill.className = "status-pill active";
  
  // Show plan info
  showUsageCard();
  
  // Format plan display
  const planName = formatPlanName(licenseInfo.planCode);
  const limitPerDay = licenseInfo.limitPerDay;
  const planDisplay = limitPerDay ? `${planName} — ${limitPerDay}/day` : planName;
  planValue.textContent = planDisplay;
  
  // Show remaining today
  const remaining = licenseInfo.remainingToday;
  if (remaining !== null && remaining !== undefined) {
    remainingValue.textContent = remaining.toString();
    remainingValue.className = "remaining-value";
    if (remaining === 0) {
      remainingValue.classList.add("zero");
    } else if (limitPerDay && remaining <= limitPerDay * 0.2) {
      remainingValue.classList.add("low");
    }
    updateProgressBar(remaining, limitPerDay);
  } else {
    remainingValue.textContent = "Unlimited";
    remainingValue.className = "remaining-value";
    updateProgressBar(null, null);
  }

  // Show upgrade button conditionally
  // Show when: plan is Starter OR remaining is 0 or low (<= 20% of limit)
  const isLow = remaining !== null && remaining !== undefined && limitPerDay && 
                remaining > 0 && remaining <= limitPerDay * 0.2;
  const isZero = remaining !== null && remaining !== undefined && remaining === 0;
  const isStarter = planName.toLowerCase() === "starter";
  
  const shouldShowUpgrade = isStarter || isZero || isLow;

  if (shouldShowUpgrade) {
    upgradeBtn.classList.remove("hidden");
  } else {
    upgradeBtn.classList.add("hidden");
  }
}

async function updateLicenseInfo() {
  // Show skeleton while loading
  showSkeleton();
  const statusPill = document.getElementById("statusPill");
  statusPill.textContent = "LOADING";
  statusPill.className = "status-pill loading";

  // Read licenseKey from chrome.storage
  chrome.storage.sync.get(['licenseKey'], async (data) => {
    const licenseKey = data?.licenseKey;
    
    if (!licenseKey || !licenseKey.trim()) {
      updateLicenseUI(null);
      return;
    }

    // Check cache first
    const cachedInfo = await getCachedLicenseInfo();
    
    // If cache is valid, show cached data immediately
    if (cachedInfo) {
      updateLicenseUI(cachedInfo, false);
    }

    // Always try to fetch fresh data (but don't block UI)
    const freshInfo = await fetchLicenseInfo(licenseKey);
    
    // If we got fresh data, update UI and cache
    if (freshInfo && !freshInfo.error) {
      updateLicenseUI(freshInfo, false);
      
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
        updateLicenseUI(cachedInfo, true); // isOffline = true
      } else {
        updateLicenseUI(freshInfo, false);
      }
    } else {
      // Invalid/expired license - update UI and clear cache
      updateLicenseUI(freshInfo, false);
      chrome.storage.local.remove(['cachedLicenseInfo']);
    }
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

document.addEventListener("DOMContentLoaded", () => {
  // License badge and info - refresh on popup open
  updateLicenseInfo();

  // Reply tab controls
  const toneSelect = document.getElementById("toneSelect");
  const humanizeToggle = document.getElementById("humanizeToggle");
  const lengthSegments = document.querySelectorAll(".length-segment");
  const personaSelect = document.getElementById("personaSelect");

  // Load initial settings
  chrome.storage.sync.get(null, (data) => {
    const globalSettings = normalizeGlobalSettings(data?.globalSettings);
    highlightLengthSegment(globalSettings.maxChars);
    toneSelect.value = globalSettings.tone;
    humanizeToggle.checked = !!globalSettings.humanize;
  });

  loadPersonas();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.personas || changes.activePersonaId) {
      loadPersonas();
    }
    if (changes.licenseKey) {
      // License key changed - clear cache and refresh
      chrome.storage.local.remove(['cachedLicenseInfo'], () => {
        updateLicenseInfo();
      });
    }
  });

  // Length segments
  lengthSegments.forEach((btn) => {
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

  // Upgrade button
  const upgradeBtn = document.getElementById("upgradeBtn");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://shadowintern.xyz/pricing" });
    });
  }
});
