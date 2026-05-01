# HSI Verified Human — Browser Extension

Chrome/Firefox extension that shows a **✦ Human** badge on any website where you have a valid HumanCredential from [homosapience.org](https://homosapience.org).

## How It Works

1. You verify your humanity at [homosapience.org/verify](https://homosapience.org/verify) (takes ~10 seconds)
2. The extension reads your HumanCredential from extension storage
3. On any supported website, a `✦ Human` badge appears next to your username
4. Click the badge to see your DID, confidence score, and expiry date

## Supported Sites

| Site | Location |
|------|----------|
| GitHub | Profile name, issue/PR authors, comments |
| Reddit | Post and comment authors |
| Twitter / X | User display names |
| Hacker News | Username links |
| Discord Web | Username in chat |
| Telegram Web | Peer title |

More sites coming via community contributions.

## Installation (Developer Mode)

1. Clone/download this folder
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select this `browser-extension` folder
5. The ✦ icon appears in your toolbar

## Install in Firefox

1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** → select `manifest.json`

> Note: Firefox uses Manifest V2 for permanent installs. MV3 works temporarily.

## Privacy

- Your HumanCredential stays in browser storage — never sent to any server by the extension
- The badge is injected client-side; no data is shared with websites
- Credential contains only your DID (anonymous key), confidence score, and expiry

## Credential Sync

The extension automatically syncs your credential when you visit `homosapience.org` or `localhost:3000` (dev). No manual action needed.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata (Manifest V3) |
| `background.js` | Service worker: credential storage & sync |
| `content.js` | Badge injection into web pages |
| `popup.html/js` | Extension popup UI |
| `badge.svg` | Badge SVG asset |
| `icons/` | Extension icons (16/48/128px) |

## Roadmap

- [ ] Firefox MV2 compatibility (`browser.storage` polyfill)
- [ ] More site selectors (LinkedIn, Mastodon, Farcaster)
- [ ] On-chain verification check in popup
- [ ] HSI Bond display (how many people vouched for this DID)
- [ ] Export credential as QR code
- [ ] Dark mode for popup
