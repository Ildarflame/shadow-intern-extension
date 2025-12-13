# Shadow Intern Extension - Developer Documentation

A Chrome extension that injects AI-powered reply buttons into Twitter/X and generates contextual replies using the Shadow Intern server API.

## What the Extension Does

### Core Functionality

1. **Injects Reply Buttons**: Adds a panel of customizable reply mode buttons (One-Liner, Agree, Disagree, Funny, etc.) directly under tweets in the Twitter/X composer interface.

2. **Collects Tweet Context**: Extracts comprehensive data from tweets:
   - **Text content**: Full tweet text from `div[data-testid="tweetText"]` elements
   - **Images**: Media images from tweets (filters out avatars, emojis, and UI elements)
   - **Media short links**: Extracts `pic.x.com` and `pic.twitter.com` URLs from both text and DOM anchor elements
   - **Video presence**: Detects video elements (`video`, `div[data-testid="videoPlayer"]`, etc.)
   - **Metadata**: Tweet ID, tweet URL, author handle

3. **Sends Data to Server**: Makes HTTP POST requests to the Shadow Intern API with:
   - License key in `X-License-Key` header
   - Tweet context (text, images, video hints, media links)
   - User settings (mode, tone, maxChars, humanize flag)
   - Custom persona (if active)
   - General prompt (global style override)

4. **Inserts Generated Reply**: Automatically inserts the AI-generated reply text into the active Twitter/X reply composer textbox using `document.execCommand("insertText")`.

### Additional Features

- **Request Caching**: In-memory cache prevents duplicate API calls for the same tweet/mode/persona combination
- **Reply History**: Stores last 10 generated replies locally for quick access
- **Custom Personas**: Support for up to 3 user-defined personas with custom names and descriptions
- **Theme Detection**: Automatically adapts button styling to Twitter/X dark/light theme
- **Error Handling**: User-friendly toast notifications for license errors, rate limits, and server issues

## Project Structure

```
xallower-extension/
├── manifest.json          # Chrome extension manifest (Manifest V3)
├── background.js          # Service worker - handles API communication
├── content.js            # Content script - injects UI and extracts tweet data
├── popup.html            # Popup UI markup
├── popup.js              # Popup logic - quick settings interface
├── options.html          # Options page UI markup
├── options.js            # Options page logic - full settings management
└── README.md             # This file
```

### File Descriptions

#### `manifest.json`
- Defines extension metadata, permissions, and file structure
- **Permissions**: `scripting`, `activeTab`, `storage`
- **Host permissions**: `https://twitter.com/*`, `https://x.com/*`
- **Content script**: Injected into Twitter/X pages at `document_idle`
- **Background**: Service worker for API calls
- **Action**: Popup interface
- **Options page**: Full settings page

#### `background.js`
- Service worker that handles all API communication
- **Constants**:
  - `API_URL`: Legacy endpoint (not used in current version)
  - `SHADOW_URL`: Main reply generation endpoint (`https://api.shadowintern.xyz/shadow/generate`)
  - `LICENSE_VALIDATE_URL`: License validation endpoint (`https://api.shadowintern.xyz/license/validate`)
- **Functions**:
  - `getSettings()`: Retrieves all user settings from `chrome.storage.sync`
  - `validateLicense()`: Validates license key before making API calls
  - `extractMediaShortLinksFromText()`: Extracts and normalizes pic.x.com links from text
  - `callShadowIntern()`: Makes the actual API request with license key header
- **Message listener**: Handles `GENERATE_REPLY` messages from content script

#### `content.js`
- Content script injected into Twitter/X pages
- **Main responsibilities**:
  - Watches for reply composer boxes using `MutationObserver`
  - Injects button panel above composer toolbar
  - Extracts tweet data when buttons are clicked
  - Handles reply insertion into active textbox
- **Key functions**:
  - `getTweetData()`: Unified function that extracts tweet data from timeline or modal views
  - `findComposerWrappers()`: Locates Twitter/X composer elements
  - `createPanel()`: Generates the button panel UI
  - `onModeClick()`: Handles button clicks and triggers API request
  - `insertTextIntoActiveTextbox()`: Inserts generated reply into composer
- **Tweet extraction logic**:
  - Handles both timeline tweets and reply modals
  - Filters images by size (min 40x40px) and source patterns
  - Extracts media short links from text and DOM
  - Detects video elements and creates video hints

#### `popup.html` / `popup.js`
- Quick settings popup (accessed via extension icon)
- **Tabs**: Reply settings, Personas, History
- **Features**:
  - Quick tone/length/humanize toggles
  - Active persona selection
  - Reply history viewer with copy functionality
  - Link to full options page

#### `options.html` / `options.js`
- Full settings management page
- **Sections**:
  - License key entry and validation status
  - General style/persona prompt (global override)
  - Global settings (maxChars, tone, humanize)
  - Mode customization (enable/disable, rename, edit prompts)
  - Custom personas (create/edit up to 3 personas)
- **Storage**: All settings saved to `chrome.storage.sync`

### Configuration Storage

All configuration is stored in Chrome's storage API:

- **`chrome.storage.sync`** (synced across devices):
  - `licenseKey`: User's license key string
  - `globalSettings`: `{ maxChars, tone, humanize }`
  - `modes`: Object mapping mode IDs to `{ enabled, label, promptTemplate }`
  - `generalPrompt`: Global style/persona prompt string
  - `personas`: Array of persona objects `[{ id, name, description }]`
  - `activePersonaId`: Currently selected persona ID (or null)

- **`chrome.storage.local`** (local only):
  - `replyHistory`: Array of last 10 generated replies with metadata

## How to Build & Install

### Dependencies

**No build step required.** The extension runs directly from source files. No npm packages, bundlers, or transpilation needed.

### Installation Steps

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd xallower-extension
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/` in Chrome
   - Or: Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `xallower-extension` folder (the folder containing `manifest.json`)
   - The extension should appear in your extensions list

5. **Verify Installation**
   - Extension icon should appear in Chrome toolbar
   - Navigate to `https://twitter.com` or `https://x.com`
   - Open a reply composer - you should see the Shadow Intern button panel

### Development Workflow

1. Make changes to source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Shadow Intern extension card
4. Reload the Twitter/X page to see changes

**Note**: For content script changes, you may need to reload the page. For background script changes, you may need to reload the extension.

## Configuration

### License Key Entry

Users enter their license key via the options page:

1. Right-click extension icon → "Options"
2. Enter license key in format: `shadow-XXXX-XXXX`
3. Click "Save Settings"
4. License is validated on first API call (not on save)

**Storage location**: `chrome.storage.sync.licenseKey`

### API Endpoint Configuration

API endpoints are hardcoded in `background.js`:

```javascript
const SHADOW_URL = "https://api.shadowintern.xyz/shadow/generate";
const LICENSE_VALIDATE_URL = "https://api.shadowintern.xyz/license/validate";
```

**To change endpoints for dev/prod:**

1. Edit `background.js`
2. Update the `SHADOW_URL` and `LICENSE_VALIDATE_URL` constants
3. Reload the extension

**Alternative approach** (for environment-based config):
- Add environment detection logic
- Use different URLs based on a flag in storage or manifest
- Example:
  ```javascript
  const API_BASE = chrome.storage.sync.get('apiBase') || 'https://api.shadowintern.xyz';
  const SHADOW_URL = `${API_BASE}/shadow/generate`;
  ```

### User Settings

All user-configurable settings are stored in `chrome.storage.sync`:

- **Global Settings**: Max characters (50-500), tone (neutral/degen/professional/toxic), humanize flag
- **Modes**: Each of 9 reply modes can be enabled/disabled, renamed, and have custom prompt templates
- **Personas**: Up to 3 custom personas with name and description
- **General Prompt**: Global style override that applies to all replies

Settings are managed through:
- **Popup** (`popup.html/js`): Quick access to common settings
- **Options page** (`options.html/js`): Full settings management

## How It Talks to the Server

### API Request Format

#### Endpoint
```
POST https://api.shadowintern.xyz/shadow/generate
```

#### Headers
```
Content-Type: application/json
X-License-Key: <user's license key>
```

#### Request Body
```json
{
  "mode": "one-liner",
  "tweetText": "Cleaned tweet text (pic.x.com links removed)",
  "imageUrls": ["https://pbs.twimg.com/media/..."],
  "hasVideo": false,
  "videoHints": [],
  "mediaShortLinks": ["https://pic.x.com/..."],
  "settings": {
    "maxChars": 220,
    "tone": "neutral",
    "humanize": true,
    "modeId": "one-liner",
    "modeLabel": "☝️ One-Liner",
    "promptTemplate": "Drop one ruthless bar that nails the core of the tweet."
  },
  "generalPrompt": "Optional global style prompt",
  "persona": {
    "id": "persona-123",
    "name": "CT Degen",
    "description": "Speaks like a crypto degen..."
  }
}
```

#### Response
```json
{
  "reply": "Generated reply text here"
}
```

#### Error Response
```json
{
  "error": "Error message here"
}
```

### License Validation

Before making the main API call, the extension validates the license key:

**Endpoint**: `POST https://api.shadowintern.xyz/license/validate`

**Request**:
```json
{
  "key": "shadow-XXXX-XXXX"
}
```

**Response**: 200 OK if valid, 4xx/5xx if invalid

### Request Flow

1. User clicks a reply mode button in content script
2. Content script extracts tweet data and sends message to background script
3. Background script:
   - Validates license key
   - Extracts media short links from tweet text
   - Builds request body with all context and settings
   - Makes POST request to `SHADOW_URL` with `X-License-Key` header
4. On success: Background script sends reply text back to content script
5. Content script inserts reply into active textbox
6. Reply is cached and stored in history

### Error Handling

The extension handles various error scenarios:

- **License errors**: Shows "License invalid or expired" message
- **Rate limits**: Shows "Daily limit reached" message
- **Server errors**: Shows "Server error. Please try again." message
- **Network errors**: Shows "No response from server" message
- **Missing data**: Shows "Could not find tweet" or "Tweet has no text or images" messages

All errors are displayed as toast notifications in the Twitter/X page.

## Development Notes

### Debugging Tips

#### Content Script Debugging

1. **Open DevTools on Twitter/X page**:
   - Right-click → Inspect
   - Or: F12 / Cmd+Option+I

2. **Console logs**:
   - All logs are prefixed with `[ShadowIntern-CS]` or `[ShadowIntern-BG]`
   - Look for: `"Shadow Intern content script initialized"`
   - Check for: `"Panel attached"` when composer is detected

3. **Check for errors**:
   - Look for red errors in console
   - Common issues: DOM selectors not matching, storage API errors

#### Background Script Debugging

1. **Open Service Worker DevTools**:
   - Go to `chrome://extensions/`
   - Find Shadow Intern extension
   - Click "service worker" link (or "Inspect views: service worker")
   - This opens a separate DevTools window for the background script

2. **Console logs**:
   - Look for: `"[ShadowIntern-BG] loaded"`
   - Check: `"[ShadowIntern-BG] Valid license, sending request:"`
   - Verify: `"[ShadowIntern-BG] Response:"`

3. **Network requests**:
   - Check Network tab in service worker DevTools
   - Verify API requests are being made
   - Check request/response payloads

#### Storage Debugging

1. **Inspect storage**:
   ```javascript
   // In content script or popup console:
   chrome.storage.sync.get(null, console.log);
   chrome.storage.local.get(null, console.log);
   ```

2. **Clear storage** (for testing):
   ```javascript
   chrome.storage.sync.clear();
   chrome.storage.local.clear();
   ```

#### Common Debugging Scenarios

- **Buttons not appearing**: Check that `findComposerWrappers()` is finding elements, verify `data-testid="tweetTextarea_0"` still exists
- **Tweet extraction failing**: Verify `getTweetData()` is finding the tweet article, check console for extraction logs
- **API errors**: Check service worker console for network errors, verify license key is set
- **Reply not inserting**: Check `lastActiveTextbox` is set, verify textbox is focusable

### Known Limitations

1. **Twitter/X DOM Changes**: 
   - Twitter/X frequently updates their DOM structure
   - Selectors like `div[data-testid="tweetTextarea_0"]` may break
   - **Mitigation**: The extension uses multiple fallback strategies and watches for DOM changes with `MutationObserver`

2. **Image Extraction**:
   - Only extracts images that are already loaded in the DOM
   - May miss images in lazy-loaded tweets
   - Filters may exclude some valid images if they match avatar patterns

3. **Video Handling**:
   - Only detects video presence, doesn't extract video URLs
   - Sends generic "video hints" instead of actual video data
   - Limited by Twitter/X's video embedding structure

4. **Media Short Links**:
   - Extracts links from text and DOM, but doesn't resolve them
   - Server must handle link resolution if needed
   - May miss links in certain edge cases (e.g., link previews)

5. **Cache Limitations**:
   - Cache is in-memory only (lost on page reload)
   - Cache key uses tweet ID, which may be missing for some tweets
   - No persistent cache across sessions

6. **Storage Limits**:
   - `chrome.storage.sync` has a quota limit (~100KB)
   - Large persona descriptions or many modes could hit limits
   - `chrome.storage.local` has higher limits but isn't synced

7. **Manifest V3 Constraints**:
   - Service worker may be terminated when idle
   - Long-running operations should be avoided in background script
   - Message passing is asynchronous

8. **Cross-Origin Issues**:
   - Extension can only make requests to declared host permissions
   - CORS is handled by the server
   - License key is sent in custom header (not standard auth header)

### Testing Checklist

When modifying the extension, test:

- [ ] Buttons appear in reply composer
- [ ] Buttons appear in reply modal
- [ ] Tweet text extraction works
- [ ] Image extraction works (with and without images)
- [ ] Media short links are extracted
- [ ] Video detection works
- [ ] License validation works
- [ ] API request is sent correctly
- [ ] Reply is inserted into textbox
- [ ] Error messages display correctly
- [ ] Settings persist across page reloads
- [ ] Cache prevents duplicate requests
- [ ] History stores replies correctly
- [ ] Personas work correctly
- [ ] Theme detection works (dark/light)

### Modifying the Extension

#### Adding a New Reply Mode

1. **Update `background.js`**:
   - Add mode to `MODE_PRESETS` array
   - Add to `DEFAULT_MODES` object

2. **Update `content.js`**:
   - Add mode to `MODE_PRESETS` array (for UI display)

3. **Update `options.js`**:
   - Add mode to `MODE_PRESETS` array (for settings page)

4. **Test**: Mode should appear in button panel and options page

#### Changing API Endpoints

1. Edit `background.js`
2. Update `SHADOW_URL` and/or `LICENSE_VALIDATE_URL` constants
3. Reload extension

#### Modifying Tweet Extraction

1. Edit `getTweetData()` function in `content.js`
2. Add new extraction logic (e.g., extract hashtags, mentions)
3. Update request body in `background.js` to include new data
4. Test with various tweet types

#### Customizing UI Styles

1. Edit `injectStyles()` function in `content.js`
2. Modify CSS in the `styleCSS` template string
3. Update `getShadowInternThemeColors()` for theme colors
4. Test in both dark and light Twitter/X themes

### Version History

- **v1.0.0**: Initial release with full feature set
  - Multiple reply modes
  - Image and video detection
  - Media short link extraction
  - Custom personas
  - Reply history
  - Request caching
  - Error handling

---

For questions or contributions, refer to the main project repository or contact the maintainers.
