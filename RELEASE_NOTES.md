# ChatExtra Toolkit 2.0.0

Major local-workflow release and product rebrand.

## Chrome Web Store

Existing item: https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb

Extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

Version 2.0.0 is intended to be submitted as an update to the existing Chrome Web Store item, preserving the same extension ID, installed user base, and listing history.

## Product name

**ChatExtra Toolkit**

The product remains independent and unofficial. It is not affiliated with or endorsed by OpenAI.

## Highlights

- Keeps ChatGPT conversation export as the primary workflow.
- Moves the local prompt library and saved-chat workspace below the Copy/Export controls.
- Adds deterministic click-time popup routing so ChatGPT tabs reliably open conversation tools and other sites reliably open website tools without requiring a page refresh.
- Adds local folders, tags, and notes for explicitly saved conversation snapshots.
- Adds local search and folder filtering for saved chats.
- Adds reopening of saved ChatGPT URLs.
- Adds bulk ZIP export of selected saved conversations with Markdown files, folder paths, `library.json`, and README metadata.
- Adds JSON backup and restore for saved chats plus the local prompt library.
- Retains selected-text, cleaned-page, visible-screenshot, and YouTube-transcript handoff into a new ChatGPT chat without automatic sending.
- Retains Markdown, HTML, PDF, portable ZIP, TXT, JSON, clipboard copy, search, role filters, navigation, and attachment capture.
- Adds a detailed Ukrainian user manual.
- Keeps the required permission list unchanged: `activeTab`, `scripting`, and `downloads`.
- Keeps optional access limited to `https://chatgpt.com/*` for user-triggered handoff actions.

## Privacy

ChatExtra Toolkit has no telemetry, analytics, advertising, developer server, or remotely hosted executable code.

Conversation content, saved snapshots, prompts, selected text, webpage content, transcript text, screenshots, and generated exports are not sent to the extension developer.

## Local workspace limits

- Maximum saved workspace records: 250.
- Maximum chats in one bulk ZIP operation: 100.
- Maximum stored Markdown in one bulk ZIP operation: 12 MB.
- Portable conversation ZIP asset limits remain 40 detected files, 6 MB per file, 16 MB total.

## Package verification

Automated checks validate:

- Manifest V3 and version 2.0.0;
- product name and popup routing;
- exact browser permissions;
- JavaScript syntax;
- ChatGPT export UI and site-tools UI;
- workspace IndexedDB integration;
- bulk ZIP generation and ZIP integrity;
- prompt library;
- search and navigation;
- selected-text, webpage, screenshot, and YouTube handoff modules;
- attachment and portable ZIP modules;
- final package structure and SHA-256 checksums.

## Installation for testing

1. Extract the source archive.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Select Load unpacked.
5. Choose the `extension` folder.
6. Open a ChatGPT conversation and click ChatExtra Toolkit.
7. Open a normal website and click the same icon to confirm website tools.

## Test status

- Core ChatGPT export: MANUAL PASS.
- Search, filters, and navigation: MANUAL PASS.
- HTML/PDF/portable ZIP: MANUAL PASS.
- Images and reusable attachments: MANUAL PASS.
- Local prompt library: MANUAL PASS.
- Selected text handoff: MANUAL PASS.
- Cleaned webpage handoff: MANUAL PASS.
- Image-only screenshot handoff: MANUAL PASS.
- YouTube transcript handoff: MANUAL PASS.
- 2.0 local workspace: MANUAL PASS.
- Final two-menu interface: MANUAL PASS.
- Automated CI: required before publishing release assets.
- Chrome Web Store 2.0.0 review: PENDING.

## Documentation

- `README.md` — project overview.
- `USER_MANUAL_UK.md` — detailed Ukrainian user guide.
- `PRIVACY.md` — privacy policy.
- `STORE_LISTING.md` — prepared Chrome Web Store listing text.
- `CHANGELOG.md` — version history.

## Support development

PayPal: `kozyriev@uafree.org`  
BTC: `bc1q4dn8e7sz2866g7qp1qtshh98j54tvuau5ghuuk`  
ETH / USDC ERC-20: `0x3aE3b23A7BD94b8a65A7E8Ca205A4e29BEF7c229`  
USDT TRC-20: `TYsGyK7K3XB4NPHprf5w8ZodFafxFfDdbP`

This is an independent, unofficial extension and is not affiliated with or endorsed by OpenAI.
