# Shadow Intern

**Version:** 0.4.0

Shadow Intern is a Chrome extension that adds AI-powered reply workflows for Twitter/X. Generate contextual replies with customizable tones, lengths, and reply modes directly from the Twitter/X composer.

## Features

### 🎯 Multiple Reply Modes
- **☝️ One-Liner** - Drop one ruthless bar that nails the core of the tweet
- **👍 Agree** - Back the tweet up with extra alpha or a sharp supporting angle
- **👎 Disagree** - Challenge the take with swagger, but keep it platform-safe
- **😏 Funny** - Add a sarcastic or meme-able twist that still reacts to the tweet
- **🤔 Question** - Ask a pointed question that drags more context out of the author
- **😎 Quote** - Make it sound like a legendary CT quote that people will repost
- **🤓 Answer** - Provide the missing insight or alpha the tweet is begging for
- **👏 Congrats** - Hype them up while keeping the CT edge
- **🙏 Thanks** - Show gratitude but keep the tone playful and on-brand

### ⚙️ Customization Options
- **Tone Selection**: Choose from Neutral, Degen, Professional, or Toxic
- **Character Length**: Set max characters (50-500) with quick presets (Short: 80, Medium: 160, Long: 240)
- **Humanized Replies**: Toggle casual, slangy CT vibes on/off
- **Custom Mode Presets**: Enable/disable, rename, and customize prompt templates for each mode
- **Image Support**: Automatically extracts and includes images from tweets in reply generation

### 🎨 User Interface
- **Quick Settings Popup**: Fast access to common settings via extension icon
- **Full Options Page**: Comprehensive settings management
- **Seamless Integration**: Reply buttons appear directly in Twitter/X composer

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the `xallower-extension` folder
5. The extension icon should appear in your Chrome toolbar

## Setup

### License Key
1. Click the extension icon or right-click → "Options"
2. Enter your Shadow Intern license key in the format: `shadow-XXXX-XXXX`
3. Click "Save"

### Quick Settings (Popup)
- Click the extension icon to access quick settings
- Adjust reply length (Short/Medium/Long)
- Change tone (Neutral/Degen/Professional/Toxic)
- Toggle humanized replies
- Open full settings page

### Full Settings (Options Page)
Access via:
- Right-click extension icon → "Options"
- Or click "Open full settings" in the popup

Configure:
- **License Key**: Required for API access
- **Global Settings**:
  - Max characters (50-500)
  - Default tone
  - Humanized replies toggle
- **Mode Presets**: Customize each reply mode:
  - Enable/disable modes
  - Rename mode labels
  - Edit prompt templates

## Usage

1. Navigate to [Twitter](https://twitter.com) or [X](https://x.com)
2. Click the reply button on any tweet (or open the composer)
3. You'll see a panel with reply mode buttons above the composer toolbar
4. Click any mode button to generate a reply
5. The generated reply will be automatically inserted into the composer
6. Edit as needed and post!

### Supported Pages
- `https://twitter.com/*`
- `https://x.com/*`

## Technical Details

### Architecture
- **Manifest V3** Chrome extension
- **Content Script** (`content.js`): Injects UI and handles tweet extraction
- **Background Service Worker** (`background.js`): Handles API communication
- **Popup** (`popup.html/js`): Quick settings interface
- **Options Page** (`options.html/js`): Full settings management

### API Endpoints
- **Reply Generation**: `https://api.shadowintern.xyz/shadow/generate`
- **License Validation**: `https://api.shadowintern.xyz/license/validate`

### Storage
Settings are synced across devices using Chrome's `chrome.storage.sync` API.

### Permissions
- `scripting`: Inject content scripts
- `activeTab`: Access current tab
- `storage`: Save settings
- `https://twitter.com/*`: Access Twitter
- `https://x.com/*`: Access X

## Development

### File Structure
```
xallower-extension/
├── manifest.json       # Extension manifest
├── background.js       # Service worker for API calls
├── content.js          # Content script for UI injection
├── popup.html/js       # Quick settings popup
├── options.html/js     # Full settings page
└── README.md           # This file
```

### Building
No build process required. The extension runs directly from source files.

### Testing
1. Load the extension in developer mode
2. Navigate to Twitter/X
3. Test reply generation on various tweets
4. Verify settings persistence across page reloads

## Troubleshooting

### Extension not working
- Ensure you're on `twitter.com` or `x.com`
- Check that the extension is enabled in `chrome://extensions/`
- Reload the Twitter/X page after installing

### License validation errors
- Verify your license key is correct
- Check your internet connection
- Ensure the license key format is: `shadow-XXXX-XXXX`

### Reply buttons not appearing
- Refresh the Twitter/X page
- Check browser console for errors (F12)
- Ensure at least one mode is enabled in settings

### Images not being extracted
- The extension automatically filters out avatars and emojis
- Only media images from tweets are included
- Check browser console for extraction logs

## License

This extension requires a valid Shadow Intern license key to function. License keys can be obtained from the Shadow Intern service.

## Support

For issues, feature requests, or questions, please refer to the Shadow Intern service documentation or contact support.

---

**Note**: This extension is designed for Twitter/X and requires an active internet connection and valid license key to generate replies.

