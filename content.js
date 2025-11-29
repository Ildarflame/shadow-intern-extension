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

function extractImagesFromTweetEl(tweetEl) {
  if (!tweetEl) return [];
  
  log('[ShadowIntern] Extracting images from tweet element...');
  
  // Direct query for all twimg.com images (most reliable)
  let imageEls = Array.from(
    tweetEl.querySelectorAll('img[src*="twimg.com"], img[src*="pbs.twimg.com"]')
  );
  
  log(`[ShadowIntern] Found ${imageEls.length} potential images before filtering`);
  
  // Filter out avatars, emojis, badges, and other non-media images
  imageEls = imageEls.filter((img) => {
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

    // Profile banners
    if (src.includes("profile_banners")) return false;

    // Emojis inside tweet text
    if (img.closest('[data-testid="tweetText"]')) return false;

    // UI icons / badges
    if (src.includes("emoji")) return false;
    if (src.includes("verification")) return false;
    if (src.includes("badge")) return false;
    
    // Check for aria-hidden (often used for decorative images)
    // But allow media images even if aria-hidden
    if (img.getAttribute("aria-hidden") === "true") {
      // Only exclude if it's clearly not a media image
      if (!src.includes("/media/") && !src.includes("twimg.com")) {
        return false;
      }
    }

    return true;
  });
  
  const urls = imageEls.map(img => img.src);
  log(`[ShadowIntern] Extracted ${urls.length} media images:`, urls);
  
  return urls;
}

// --------------- EXTRACT IMAGES (MEDIA ONLY, NO AVATAR) --------------------

function extractTweetImagesFromButton(button) {
  // Check if we're in a reply modal
  const dialog = findReplyDialogRoot(button);
  let tweetEl = null;
  let isModal = false;
  
  if (dialog) {
    // We're in a reply modal - find the original tweet being replied to
    isModal = true;
    tweetEl = findOriginalTweetInDialog(dialog);
    
    if (tweetEl) {
      const images = extractImagesFromTweetEl(tweetEl);
      log('[ShadowIntern] Extracting images from reply modal:', images);
      return images;
    } else {
      console.warn('[ShadowIntern] Reply modal detected but original tweet not found');
    }
  }
  
  // If not in modal or didn't find tweet in modal, use existing timeline logic
  if (!tweetEl) {
    tweetEl = button.closest("article");

    if (!tweetEl) {
      const articles = Array.from(document.querySelectorAll("article"));
      const btnRect = button.getBoundingClientRect();

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
    
    if (tweetEl) {
      const images = extractImagesFromTweetEl(tweetEl);
      log('[ShadowIntern] Extracting images from timeline tweet:', images);
      return images;
    }
  }

  return [];
}

// --------------- EXTRACT TEXT --------------------

function extractTweetTextFromButton(button) {
  // Check if we're in a reply modal
  const dialog = findReplyDialogRoot(button);
  let tweetEl = null;
  
  if (dialog) {
    // We're in a reply modal - find the original tweet being replied to
    tweetEl = findOriginalTweetInDialog(dialog);
  }
  
  // If not in modal or didn't find tweet in modal, use existing timeline logic
  if (!tweetEl) {
    tweetEl = button.closest("article");

    if (!tweetEl) {
      const articles = Array.from(document.querySelectorAll("article"));
      const btnRect = button.getBoundingClientRect();

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

  if (!tweetEl) return "";

  const nodes = tweetEl.querySelectorAll('div[data-testid="tweetText"]');

  let text = "";
  nodes.forEach((node) => {
    const t = node.innerText || node.textContent || "";
    if (t.trim()) text += t.trim() + "\n";
  });

  text = text.trim();
  log("Extracted text:", text);

  // Note: We intentionally keep pic.twitter.com links in the text
  // as a fallback hint for the backend if image extraction fails
  return text;
}

// --------------- BUTTON CLICK --------------------

function onModeClick(event) {
  const mode = event.currentTarget.dataset.mode;

  const tweetText = extractTweetTextFromButton(event.currentTarget);
  const imageUrls = extractTweetImagesFromButton(event.currentTarget);
  
  // Fallback logging if no images found but text contains pic.twitter.com
  if (imageUrls.length === 0 && (tweetText.includes('pic.twitter.com') || tweetText.includes('pic.x.com'))) {
    console.log('[ShadowIntern] No images found in DOM but tweet text contains pic.twitter.com link');
  }
  
  log('[ShadowIntern] Sending request with', imageUrls.length, 'images');

  chrome.runtime.sendMessage(
    {
      type: "GENERATE_REPLY",
      mode,
      tweetText,
      imageUrls
    },
    (res) => {
      if (!res || !res.reply) {
        log("No reply received from background");
        return;
      }
      insertTextIntoActiveTextbox(res.reply);
    }
  );
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