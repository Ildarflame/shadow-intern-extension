// background.js

const API_URL = "https://api.shadowintern.xyz/api/xallower-reply";
const SHADOW_URL = "https://api.shadowintern.xyz/shadow/generate";
const LICENSE_VALIDATE_URL = "https://api.shadowintern.xyz/license/validate";

const TONE_OPTIONS = ["neutral", "degen", "professional", "toxic"];

const MODE_PRESETS = [
  { id: "one-liner", label: "☝️ One-Liner", promptTemplate: "Drop one ruthless bar that nails the core of the tweet." },
  { id: "agree", label: "👍 Agree", promptTemplate: "Back the tweet up with extra alpha or a sharp supporting angle." },
  { id: "disagree", label: "👎 Disagree", promptTemplate: "Challenge the take with swagger, but keep it platform-safe." },
  { id: "funny", label: "😏 Funny", promptTemplate: "Add a sarcastic or meme-able twist that still reacts to the tweet." },
  { id: "question", label: "🤔 Question", promptTemplate: "Ask a pointed question that drags more context out of the author." },
  { id: "quote", label: "😎 Quote", promptTemplate: "Make it sound like a legendary CT quote that people will repost." },
  { id: "answer", label: "🤓 Answer", promptTemplate: "Provide the missing insight or alpha the tweet is begging for." },
  { id: "congrats", label: "👏 Congrats", promptTemplate: "Hype them up while keeping the CT edge." },
  { id: "thanks", label: "🙏 Thanks", promptTemplate: "Show gratitude but keep the tone playful and on-brand." }
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

function sanitizeMaxChars(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_GLOBAL_SETTINGS.maxChars;
  return Math.max(50, Math.min(500, Math.round(num)));
}

function sanitizeTone(tone) {
  return TONE_OPTIONS.includes(tone) ? tone : DEFAULT_GLOBAL_SETTINGS.tone;
}

function sanitizeHumanize(value) {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return DEFAULT_GLOBAL_SETTINGS.humanize;
}

function mergeModes(stored = {}) {
  const merged = { ...DEFAULT_MODES };
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

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (data) => {
      const licenseKey = data?.licenseKey || "";
      const globalRaw = data?.globalSettings || {};
      const globalSettings = {
        maxChars: sanitizeMaxChars(globalRaw.maxChars),
        tone: sanitizeTone(globalRaw.tone),
        humanize: sanitizeHumanize(globalRaw.humanize)
      };
      const modes = mergeModes(data?.modes);
      const generalPrompt = (data?.generalPrompt || "").trim();
      
      // Get active persona
      const activePersonaId = data?.activePersonaId || null;
      let activePersona = null;
      if (activePersonaId && data?.personas) {
        const personas = Array.isArray(data.personas) ? data.personas : [];
        activePersona = personas.find(p => p.id === activePersonaId) || null;
      }

      resolve({
        licenseKey,
        globalSettings,
        modes,
        generalPrompt,
        activePersona
      });
    });
  });
}

async function validateLicense(key) {
  if (!key) {
    throw new Error("Missing Shadow Intern license key");
  }

  const res = await fetch(LICENSE_VALIDATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ key })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Shadow Intern license validation failed");
  }
}

function extractMediaShortLinksFromText(text) {
  if (!text) return { cleanedText: text, links: [] };
  
  // 1) Normalize patterns like "https://\npic.x.com/..." into "https://pic.x.com/..."
  let normalizedText = text.replace(
    /https?:\/\/\s+(pic\.(?:x|twitter)\.com\/\S+)/gi,
    'https://$1'
  );
  
  // 2) Find all pic.x.com / pic.twitter.com links, with or without protocol
  const regex = /(?:https?:\/\/)?pic\.(?:x|twitter)\.com\/\S+/gi;
  const links = [];
  let match;
  while ((match = regex.exec(normalizedText)) !== null) {
    let url = match[0];
    // Normalize: always start with https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    links.push(url);
  }
  
  const uniqueLinks = [...new Set(links)];
  
  // 3) Remove all found links from the text
  let cleanedText = normalizedText;
  uniqueLinks.forEach((link) => {
    // Escape special regex characters in the link
    const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkRegex = new RegExp(escaped, 'gi');
    cleanedText = cleanedText.replace(linkRegex, '');
  });
  
  // Optional: also trim leftover "https://" if it was not fully matched
  cleanedText = cleanedText.replace(/https?:\/\/\s*/gi, '').trim();
  
  return {
    cleanedText,
    links: uniqueLinks,
  };
}

async function callShadowIntern(body, licenseKey) {
  const res = await fetch(SHADOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-License-Key": licenseKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || "Shadow Intern server error");
    error.status = res.status; // Include status code for better error handling
    throw error;
  }

  return res.json();
}

console.log("[ShadowIntern-BG] loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GENERATE_REPLY") return;

  (async () => {
    const stored = await getSettings();
    const modeId = message.mode;
    const fallbackMode =
      DEFAULT_MODES[modeId] || { label: modeId, promptTemplate: "", enabled: true };
    const selectedMode = stored.modes[modeId] || fallbackMode;

    if (selectedMode.enabled === false) {
      sendResponse({ error: "Selected mode is disabled. Update your options page." });
      return;
    }

    const requestSettings = {
      maxChars: stored.globalSettings.maxChars,
      tone: stored.globalSettings.tone,
      humanize: stored.globalSettings.humanize,
      modeId,
      modeLabel: selectedMode.label || fallbackMode.label || modeId,
      promptTemplate: selectedMode.promptTemplate || ""
    };

    // Extract media short links from tweetText and clean the text
    const { cleanedText, links: mediaShortLinks } = extractMediaShortLinksFromText(message.tweetText);

    const body = {
      mode: modeId,
      tweetText: cleanedText,
      imageUrls: message.imageUrls || [],
      hasVideo: !!message.hasVideo,
      videoHints: message.videoHints || [],
      mediaShortLinks: mediaShortLinks,
      settings: requestSettings,
      generalPrompt: stored.generalPrompt || "",
      persona: stored.activePersona || null
    };

    try {
      await validateLicense(stored.licenseKey);
      console.log("[ShadowIntern-BG] Valid license, sending request:", body);
      const json = await callShadowIntern(body, stored.licenseKey);
      console.log("[ShadowIntern-BG] Response:", json);
      sendResponse({ reply: json.reply });
    } catch (err) {
      console.error("[ShadowIntern-BG] Error:", err.message, "Status:", err.status);
      // Include status code in error response for better error handling
      sendResponse({ error: err.message, status: err.status });
    }
  })();

  return true;
});