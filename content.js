// content.js — Shadow Intern Twitter Extension (English-only + Media-only images)

const MODE_PRESETS = [
  { id: "one-liner", label: "☝️ One-Liner" },
  { id: "agree", label: "👍 Agree" },
  { id: "disagree", label: "👎 Disagree" },
  { id: "funny", label: "😏 Funny" },
  { id: "question", label: "🤔 Question" },
  { id: "quote", label: "😎 Quote" },
  { id: "answer", label: "🤓 Answer" },
  { id: "congrats", label: "👏 Congrats" },
  { id: "thanks", label: "🙏 Thanks" }
];

function buildDefaultModes() {
  return MODE_PRESETS.reduce((acc, mode) => {
    acc[mode.id] = { ...mode, enabled: true };
    return acc;
  }, {});
}

function mergeModes(stored = {}) {
  const combined = buildDefaultModes();
  Object.entries(stored || {}).forEach(([id, cfg]) => {
    if (!combined[id]) return;
    combined[id] = {
      id,
      label: (cfg.label || "").trim() || combined[id].label,
      enabled:
        typeof cfg.enabled === "boolean" ? cfg.enabled : combined[id].enabled
    };
  });
  return combined;
}

let modeMap = buildDefaultModes();

function log(...args) {
  console.log("[ShadowIntern-CS]", ...args);
}

let lastActiveTextbox = null;
function loadModesFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (data) => {
      modeMap = mergeModes(data?.modes);
      resolve();
    });
  });
}

function getActiveModes() {
  return Object.values(modeMap).filter((mode) => mode.enabled !== false);
}

// Track typing focus
document.addEventListener(
  "focusin",
  (e) => {
    const el = e.target;
    if (!el) return;

    if (el.getAttribute("role") === "textbox" || el.isContentEditable) {
      lastActiveTextbox = el;
      log("Active textbox updated:", el);
    }
  },
  true
);

// --------------- FIND REPLY BOXES --------------------

function findComposerWrappers() {
  const composers = Array.from(
    document.querySelectorAll('div[data-testid="tweetTextarea_0"]')
  );

  const result = [];

  composers.forEach((composer) => {
    let wrapper = composer.parentElement;

    while (wrapper && wrapper !== document.body) {
      const toolbar = wrapper.querySelector('[data-testid="toolBar"]');
      if (toolbar && wrapper.contains(composer)) {
        result.push({ wrapper, toolbar });
        break;
      }
      wrapper = wrapper.parentElement;
    }
  });

  return result;
}

// --------------- CREATE PANEL --------------------

function createPanel() {
  const panel = document.createElement("div");
  panel.className = "xallower-panel";
  panel.style.display = "flex";
  panel.style.flexWrap = "wrap";
  panel.style.gap = "8px";
  panel.style.marginTop = "8px";
  panel.style.marginBottom = "4px";
  panel.style.width = "100%";

  const activeModes = getActiveModes();

  if (!activeModes.length) {
    const notice = document.createElement("div");
    notice.textContent = "Enable at least one mode in the options page.";
    notice.style.fontSize = "12px";
    notice.style.color = "rgb(239,243,244)";
    panel.appendChild(notice);
    return panel;
  }

  activeModes.forEach((mode) => {
    const btn = document.createElement("button");
    btn.textContent = mode.label;
    btn.dataset.mode = mode.id;

    btn.style.border = "1px solid rgb(29,155,240)";
    btn.style.borderRadius = "9999px";
    btn.style.padding = "4px 10px";
    btn.style.background = "transparent";
    btn.style.color = "rgb(239,243,244)";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "13px";
    btn.style.whiteSpace = "nowrap";

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(29,155,240,0.2)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
    });

    btn.addEventListener("click", onModeClick);

    panel.appendChild(btn);
  });

  return panel;
}

// --------------- MODAL DETECTION HELPERS --------------------

function findReplyDialogRoot(buttonEl) {
  const dialog = buttonEl.closest('[role="dialog"]');
  if (dialog) {
    log('[ShadowIntern] Reply modal detected');
  }
  return dialog || null;
}

function findOriginalTweetInDialog(dialogEl) {
  if (!dialogEl) return null;
  
  log('[ShadowIntern] Searching for original tweet in dialog...');
  
  // Try multiple selectors to find the original tweet
  // The original tweet article is NOT the composer (which has the textarea)
  let originalTweet = 
    dialogEl.querySelector('article div[data-testid="tweet"]')?.closest('article') ||
    dialogEl.querySelector('article[data-testid="tweet"]') ||
    null;
  
  // If that didn't work, find all articles and filter out composer ones
  if (!originalTweet) {
    const articles = Array.from(dialogEl.querySelectorAll('article'));
    log(`[ShadowIntern] Found ${articles.length} articles in dialog`);
    
    // Filter out articles that are part of the composer (they contain textarea)
    const composerArticles = articles.filter(article => 
      article.querySelector('div[data-testid="tweetTextarea_0"]')
    );
    
    log(`[ShadowIntern] Found ${composerArticles.length} composer articles`);
    
    // Find the original tweet - it should NOT be a composer and should have tweet content
    originalTweet = articles.find(article => {
      if (composerArticles.includes(article)) return false;
      // Check if it has tweet content indicators
      return article.querySelector('div[data-testid="tweetText"]') ||
             article.querySelector('div[data-testid="tweetPhoto"]') ||
             article.querySelector('div[data-testid="tweetMedia"]') ||
             article.querySelector('img[src*="twimg.com"]') ||
             article.querySelector('img[src*="pbs.twimg.com"]');
    });
    
    // Fallback: if no specific match, return the first non-composer article
    if (!originalTweet && articles.length > composerArticles.length) {
      originalTweet = articles.find(article => !composerArticles.includes(article)) || null;
    }
  }
  
  if (originalTweet) {
    log('[ShadowIntern] Found original tweet in dialog:', originalTweet);
  } else {
    console.warn('[ShadowIntern] Reply modal detected but original tweet not found');
  }
  
  return originalTweet;
}

// --------------- UNIFIED TWEET DATA EXTRACTION --------------------

/**
 * Extracts all tweet data (text, images, metadata) from a button element.
 * Handles both timeline tweets and modal views.
 * @param {HTMLElement} fromElement - The button or element that triggered the extraction
 * @returns {Object|null} Tweet data object or null if extraction fails
 */
function getTweetData(fromElement) {
  if (!fromElement) {
    log('[ShadowIntern] getTweetData: fromElement is null');
    return null;
  }

  // Check if we're in a reply modal
  const dialog = findReplyDialogRoot(fromElement);
  let tweetEl = null;
  
  if (dialog) {
    // We're in a reply modal - find the original tweet being replied to
    tweetEl = findOriginalTweetInDialog(dialog);
    if (!tweetEl) {
      log('[ShadowIntern] Reply modal detected but original tweet not found');
      return null;
    }
  }
  
  // If not in modal or didn't find tweet in modal, use timeline logic
  if (!tweetEl) {
    tweetEl = fromElement.closest("article");

    if (!tweetEl) {
      // Fallback: find nearest article above the button
      const articles = Array.from(document.querySelectorAll("article"));
      const btnRect = fromElement.getBoundingClientRect();

      let best = null;
      for (const a of articles) {
        const r = a.getBoundingClientRect();
        if (r.bottom <= btnRect.top) {
          if (!best || r.bottom > best.rect.bottom) {
            best = { node: a, rect: r };
          }
        }
      }

      if (best) tweetEl = best.node;
    }
  }

  if (!tweetEl) {
    log('[ShadowIntern] getTweetData: Could not find tweet article element');
    return null;
  }

  // Extract text content
  const textNodes = tweetEl.querySelectorAll('div[data-testid="tweetText"]');
  let text = "";
  textNodes.forEach((node) => {
    const t = node.innerText || node.textContent || "";
    if (t.trim()) text += t.trim() + "\n";
  });
  text = text.trim();

  // Extract images (media only, no avatars)
  const imageEls = Array.from(
    tweetEl.querySelectorAll('img[src*="twimg.com"], img[src*="pbs.twimg.com"]')
  );
  
  const images = imageEls
    .filter((img) => {
      const src = img.src || "";
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;

      // Size filtering - ignore very small images (likely avatars/emojis)
      if (width > 0 && height > 0 && (width < 40 || height < 40)) {
        return false;
      }

      // Avatar filtering
      if (src.includes("profile_images")) return false;
      if (src.includes("_normal")) return false;
      if (src.includes("_bigger")) return false;
      if (src.includes("_400x400")) return false;
      if (src.includes("_200x200")) return false;
      if (src.includes("profile_banners")) return false;

      // Emojis inside tweet text
      if (img.closest('[data-testid="tweetText"]')) return false;

      // UI icons / badges
      if (src.includes("emoji")) return false;
      if (src.includes("verification")) return false;
      if (src.includes("badge")) return false;
      
      // Check for aria-hidden (often used for decorative images)
      if (img.getAttribute("aria-hidden") === "true") {
        if (!src.includes("/media/") && !src.includes("twimg.com")) {
          return false;
        }
      }

      return true;
    })
    .map(img => img.src);

  // Extract tweet URL and ID
  let tweetUrl = null;
  let tweetId = null;
  let authorHandle = null;

  // Try to find tweet link
  const tweetLink = tweetEl.querySelector('a[href*="/status/"]');
  if (tweetLink) {
    const href = tweetLink.getAttribute("href");
    if (href) {
      tweetUrl = href.startsWith("http") ? href : `https://x.com${href}`;
      // Extract tweet ID from URL
      const match = href.match(/\/status\/(\d+)/);
      if (match) {
        tweetId = match[1];
      }
    }
  }

  // Try to extract author handle
  const authorLink = tweetEl.querySelector('a[href^="/"]');
  if (authorLink) {
    const href = authorLink.getAttribute("href");
    if (href && !href.includes("/status/")) {
      authorHandle = `@${href.replace(/^\//, "").split("/")[0]}`;
    }
  }

  // Check for video presence (simple detection)
  const hasVideo = !!tweetEl.querySelector('video, [data-testid="videoComponent"]');

  const result = {
    text: text || "",
    images: images,
    videos: hasVideo ? ["video-detected"] : [], // Placeholder for video detection
    tweetUrl: tweetUrl || "",
    authorHandle: authorHandle || "",
    tweetId: tweetId || ""
  };

  log('[ShadowIntern] getTweetData result:', result);
  return result;
}

// --------------- ERROR HANDLING & UX --------------------

let errorToastElement = null;

function showShadowError(message) {
  if (!message) return;
  
  // Remove existing toast if present
  if (errorToastElement) {
    errorToastElement.remove();
  }

  const toast = document.createElement("div");
  toast.className = "shadow-intern-toast shadow-intern-error";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #f4212e;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
    text-align: center;
  `;

  document.body.appendChild(toast);
  errorToastElement = toast;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

function showShadowSuccess(message) {
  if (!message) return;
  
  // Remove existing toast if present
  if (errorToastElement) {
    errorToastElement.remove();
  }

  const toast = document.createElement("div");
  toast.className = "shadow-intern-toast shadow-intern-success";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #00ba7c;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
    text-align: center;
  `;

  document.body.appendChild(toast);
  errorToastElement = toast;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }
  }, 3000);
}

// --------------- REQUEST CACHING --------------------

// In-memory cache for current page lifetime
const replyCache = new Map();

function getCacheKey(tweetId, mode, personaId) {
  return `${tweetId || 'no-id'}::${mode}::${personaId || 'default'}`;
}

function getCachedReply(tweetId, mode, personaId) {
  const key = getCacheKey(tweetId, mode, personaId);
  return replyCache.get(key) || null;
}

function setCachedReply(tweetId, mode, personaId, reply) {
  const key = getCacheKey(tweetId, mode, personaId);
  replyCache.set(key, reply);
}

// --------------- BUTTON CLICK --------------------

function onModeClick(event) {
  const mode = event.currentTarget.dataset.mode;

  // Extract tweet data using unified function
  const tweetData = getTweetData(event.currentTarget);
  
  if (!tweetData) {
    showShadowError("Could not find tweet. Please try clicking the button again.");
    return;
  }

  if (!tweetData.text && tweetData.images.length === 0) {
    showShadowError("Tweet has no text or images to reply to.");
    return;
  }

  // Get active persona ID from storage (will be implemented in persona feature)
  chrome.storage.sync.get(['activePersonaId'], (data) => {
    const personaId = data.activePersonaId || null;

    // Check cache first
    const cachedReply = getCachedReply(tweetData.tweetId, mode, personaId);
    if (cachedReply) {
      log('[ShadowIntern] Using cached reply');
      showShadowSuccess("Used cached reply");
      insertTextIntoActiveTextbox(cachedReply);
      return;
    }

    // Fallback logging if no images found but text contains pic.twitter.com
    if (tweetData.images.length === 0 && (tweetData.text.includes('pic.twitter.com') || tweetData.text.includes('pic.x.com'))) {
      log('[ShadowIntern] No images found in DOM but tweet text contains pic.twitter.com link');
    }
    
    log('[ShadowIntern] Sending request with', tweetData.images.length, 'images');

    chrome.runtime.sendMessage(
      {
        type: "GENERATE_REPLY",
        mode,
        tweetText: tweetData.text,
        imageUrls: tweetData.images,
        tweetId: tweetData.tweetId,
        tweetUrl: tweetData.tweetUrl,
        authorHandle: tweetData.authorHandle
      },
      (res) => {
        if (chrome.runtime.lastError) {
          log("Runtime error:", chrome.runtime.lastError.message);
          showShadowError("Extension error. Please try again.");
          return;
        }

        if (!res) {
          log("No response from background");
          showShadowError("No response from server. Please check your connection.");
          return;
        }

        if (res.error) {
          log("Error from background:", res.error);
          // Map error messages to user-friendly text
          let errorMsg = res.error;
          if (res.error.includes("license") || res.error.includes("License")) {
            errorMsg = "License invalid or expired. Check your key in Shadow Intern settings.";
          } else if (res.error.includes("limit") || res.error.includes("Limit")) {
            errorMsg = "Daily limit reached. Try again later.";
          } else if (res.error.includes("server") || res.error.includes("Server")) {
            errorMsg = "Server error. Please try again.";
          }
          showShadowError(errorMsg);
          return;
        }

        if (!res.reply) {
          log("No reply in response");
          showShadowError("No reply generated. Please try again.");
          return;
        }

        // Cache the reply
        setCachedReply(tweetData.tweetId, mode, personaId, res.reply);

        // Store in history (will be implemented in history feature)
        storeReplyInHistory({
          tweetUrl: tweetData.tweetUrl,
          mode: mode,
          replyText: res.reply
        });

        insertTextIntoActiveTextbox(res.reply);
      }
    );
  });
}

// --------------- REPLY HISTORY --------------------

function storeReplyInHistory(item) {
  chrome.storage.sync.get(['activePersonaId', 'personas'], (data) => {
    let personaName = null;
    if (data.activePersonaId && data.personas) {
      const personas = Array.isArray(data.personas) ? data.personas : [];
      const persona = personas.find(p => p.id === data.activePersonaId);
      if (persona) {
        personaName = persona.name;
      }
    }

    chrome.storage.local.get(['replyHistory'], (localData) => {
      const history = localData.replyHistory || [];
      const newItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        personaName: personaName,
        ...item
      };
      history.unshift(newItem);
      // Keep only last 10
      const trimmed = history.slice(0, 10);
      chrome.storage.local.set({ replyHistory: trimmed });
    });
  });
}

// --------------- INSERT REPLY --------------------

function insertTextIntoActiveTextbox(text) {
  const textbox = lastActiveTextbox;

  if (!textbox) {
    log("NO ACTIVE TEXTBOX!");
    return;
  }

  textbox.focus();

  const current = (textbox.innerText || textbox.textContent || "").trim();
  const toInsert = current.length ? " " + text : text;

  document.execCommand("insertText", false, toInsert);
}

// --------------- WATCH FOR REPLY BOXES --------------------

function watchForComposer() {
  const attach = () => {
    const wrappers = findComposerWrappers();

    wrappers.forEach(({ wrapper, toolbar }) => {
      if (wrapper.dataset.xallowerWrapper === "1") return;

      wrapper.dataset.xallowerWrapper = "1";

      const panel = createPanel();
      toolbar.insertAdjacentElement("beforebegin", panel);

      log("Panel attached");
    });
  };

  attach();

  const observer = new MutationObserver(() => attach());

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  log("Observer started");
}

// --------------- INIT --------------------

(async function init() {
  log("Shadow Intern content script initialized");
  await loadModesFromStorage();
  watchForComposer();
})();