// content.js — Shadow Intern Twitter Extension (English-only + Media-only images)

const MODE_PRESETS = [
  { id: "one-liner", label: "☝️ One-Liner", emoji: "☝️" },
  { id: "agree", label: "✅ Agree", emoji: "✅" },
  { id: "disagree", label: "❌ Disagree", emoji: "❌" },
  { id: "funny", label: "😏 Funny", emoji: "😏" },
  { id: "question", label: "❓ Question", emoji: "❓" },
  { id: "quote", label: "💬 Quote", emoji: "💬" },
  { id: "answer", label: "🧠 Answer", emoji: "🧠" },
  { id: "congrats", label: "🎉 Congrats", emoji: "🎉" },
  { id: "thanks", label: "🙏 Thanks", emoji: "🙏" }
];

function buildDefaultModes() {
  return MODE_PRESETS.reduce((acc, mode) => {
    acc[mode.id] = { ...mode, enabled: true, emoji: mode.emoji };
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
        typeof cfg.enabled === "boolean" ? cfg.enabled : combined[id].enabled,
      emoji: combined[id].emoji // Preserve emoji from defaults
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

// --------------- INJECT STYLES --------------------

// --------------- THEME DETECTION --------------------

function isDarkMode() {
  try {
    // Try to infer from actual background color
    const bg = getComputedStyle(document.body).backgroundColor;
    const match = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      // Perceived luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
  } catch (e) {
    // ignore
  }
  // Fallback: system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return true;
  }
  return false;
}

function getShadowInternThemeColors() {
  const dark = isDarkMode();
  if (dark) {
    return {
      buttonBg: 'rgba(255, 255, 255, 0.06)',
      buttonBorder: 'rgba(255, 255, 255, 0.16)',
      buttonText: '#f7f9f9',
      buttonHoverBg: 'rgba(255, 255, 255, 0.12)',
      buttonHoverBorder: 'rgba(255, 255, 255, 0.32)',
      buttonShadow: 'rgba(0, 0, 0, 0.2)',
      buttonHoverShadow: 'rgba(0, 0, 0, 0.3)',
      noticeBg: 'rgba(255, 255, 255, 0.06)',
      noticeBorder: 'rgba(255, 255, 255, 0.16)',
      noticeText: '#f7f9f9',
    };
  }
  // Light theme
  return {
    buttonBg: 'rgba(15, 20, 25, 0.04)',
    buttonBorder: 'rgba(15, 20, 25, 0.12)',
    buttonText: '#0f1419',
    buttonHoverBg: 'rgba(15, 20, 25, 0.08)',
    buttonHoverBorder: 'rgba(15, 20, 25, 0.20)',
    buttonShadow: 'rgba(15, 20, 25, 0.15)',
    buttonHoverShadow: 'rgba(15, 20, 25, 0.2)',
    noticeBg: 'rgba(15, 20, 25, 0.04)',
    noticeBorder: 'rgba(15, 20, 25, 0.12)',
    noticeText: '#0f1419',
  };
}

let styleElement = null;

function injectStyles() {
  const themeColors = getShadowInternThemeColors();
  
  const styleCSS = `
    .xallower-panel {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
      margin-bottom: 4px;
      width: 100%;
    }

    .xallower-btn {
      border-radius: 9999px;
      padding: 6px 18px;
      font-size: 14px;
      line-height: 1;
      font-weight: 500;
      background-color: ${themeColors.buttonBg};
      border: 1px solid ${themeColors.buttonBorder};
      box-shadow: 0 1px 3px ${themeColors.buttonShadow};
      color: ${themeColors.buttonText};
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .xallower-btn:hover {
      background-color: ${themeColors.buttonHoverBg};
      border-color: ${themeColors.buttonHoverBorder};
      box-shadow: 0 2px 6px ${themeColors.buttonHoverShadow};
      transform: translateY(-1px);
    }

    .xallower-btn:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px ${themeColors.buttonShadow};
    }

    .xallower-btn-emoji {
      font-size: 14px;
      line-height: 1;
    }

    .xallower-notice {
      font-size: 12px;
      color: ${themeColors.noticeText};
      padding: 8px 12px;
      background-color: ${themeColors.noticeBg};
      border-radius: 8px;
      border: 1px solid ${themeColors.noticeBorder};
      box-shadow: 0 1px 3px ${themeColors.buttonShadow};
    }
  `;
  
  // Update existing style or create new one
  if (styleElement && styleElement.parentNode) {
    // Update existing style with new theme colors
    styleElement.textContent = styleCSS;
  } else {
    // Create new style element
    const style = document.createElement("style");
    style.id = "xallower-styles";
    style.textContent = styleCSS;
    document.head.appendChild(style);
    styleElement = style;
  }
}

// --------------- CREATE PANEL --------------------

function createPanel() {
  injectStyles();
  
  const panel = document.createElement("div");
  panel.className = "xallower-panel";

  const activeModes = getActiveModes();

  if (!activeModes.length) {
    const notice = document.createElement("div");
    notice.className = "xallower-notice";
    notice.textContent = "Enable at least one mode in the options page.";
    panel.appendChild(notice);
    return panel;
  }

  activeModes.forEach((mode) => {
    const btn = document.createElement("button");
    btn.className = "xallower-btn";
    btn.dataset.mode = mode.id;

    // Use emoji property if available, otherwise extract from label
    const emoji = mode.emoji || "";
    let labelText = mode.label || "";
    
    // If we have a separate emoji, remove it from the label text to avoid duplication
    if (emoji && labelText.startsWith(emoji)) {
      labelText = labelText.substring(emoji.length).trim();
    } else if (!emoji && labelText) {
      // If no emoji property, try to extract emoji from label
      const emojiMatch = labelText.match(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
      if (emojiMatch) {
        labelText = labelText.substring(emojiMatch[0].length).trim();
      }
    }

    if (emoji) {
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "xallower-btn-emoji";
      emojiSpan.textContent = emoji;
      btn.appendChild(emojiSpan);
    }

    const textSpan = document.createElement("span");
    textSpan.textContent = labelText || mode.id;
    btn.appendChild(textSpan);

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

  // Extract pic.x.com / pic.twitter.com URLs from both text and DOM anchor elements
  const mediaShortLinks = [];
  
  // Helper function to create a fresh regex instance
  const createPicUrlRegex = () => /https?:\/\/(?:pic\.x\.com|pic\.twitter\.com)\/\S+/gi;
  
  // Search in text content
  const textMatches = text.match(createPicUrlRegex());
  if (textMatches) {
    textMatches.forEach(url => {
      if (!mediaShortLinks.includes(url)) {
        mediaShortLinks.push(url);
      }
    });
  }
  
  // Search in DOM anchor elements
  const anchorElements = tweetEl.querySelectorAll('a[href*="pic.x.com"], a[href*="pic.twitter.com"]');
  anchorElements.forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (href) {
      // Normalize the URL (might be relative or absolute)
      let normalizedUrl = href;
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = normalizedUrl.startsWith('//') ? `https:${normalizedUrl}` : `https://${normalizedUrl}`;
      }
      // Check if it matches the pattern
      const urlMatch = normalizedUrl.match(createPicUrlRegex());
      if (urlMatch && !mediaShortLinks.includes(normalizedUrl)) {
        mediaShortLinks.push(normalizedUrl);
      }
    }
    // Also check anchor text content
    const anchorText = anchor.textContent || anchor.innerText || '';
    const textMatches = anchorText.match(createPicUrlRegex());
    if (textMatches) {
      textMatches.forEach(url => {
        if (!mediaShortLinks.includes(url)) {
          mediaShortLinks.push(url);
        }
      });
    }
  });

  // Clean text: remove pic.x.com / pic.twitter.com URLs (Option A: remove from cleaned text)
  let cleanText = text;
  if (mediaShortLinks.length > 0) {
    mediaShortLinks.forEach(url => {
      cleanText = cleanText.replace(url, '').trim();
    });
    // Clean up any extra whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
  }

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

  // Detect video elements inside the tweet root
  const videoElements = tweetEl.querySelectorAll(
    'video, div[data-testid="videoPlayer"], div[data-testid="videoComponent"]'
  );
  const hasVideo = videoElements.length > 0;
  
  // Minimal "hints" instead of real URLs (we only need to know that video exists)
  const videoHints = hasVideo
    ? Array.from(videoElements).map((el, idx) => `video_${idx + 1}`)
    : [];

  const result = {
    text: cleanText || "",
    images: images,
    hasVideo: hasVideo,
    videoHints: videoHints,
    mediaShortLinks: mediaShortLinks,
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
        hasVideo: !!tweetData.hasVideo,
        videoHints: tweetData.videoHints || [],
        mediaShortLinks: tweetData.mediaShortLinks || [],
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