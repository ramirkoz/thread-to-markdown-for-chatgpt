# Thread to Markdown for ChatGPT

A small, privacy-first Chrome extension that exports the ChatGPT conversation currently open in your browser to a clean Markdown file.

> Independent and unofficial. Not affiliated with or endorsed by OpenAI.

## Install from Chrome Web Store

[Install Thread to Markdown for ChatGPT](https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb)

Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

## What it does

- Exports user and assistant messages from the open conversation.
- Adds the conversation title, export time, and source URL.
- Creates a readable `.md` file in the standard Downloads folder.
- Works only after the user presses the export button.
- Processes everything locally. No telemetry, tracking, server, or account is used.

## Development version 1.5.0

The repository version is currently in development and adds a compact message preview with individual message selection before export. The Chrome Web Store version remains 1.4.0 until browser testing and release review are complete.

## Install from source

1. Download and extract the release ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `extension` folder.
6. Open a ChatGPT conversation and use the extension button.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Access the tab explicitly selected by the user. |
| `scripting` | Read the open conversation when Export is pressed. |
| `downloads` | Save the generated Markdown file locally. |

The extension requests no broad host permissions and performs no network requests.

## Privacy

See [PRIVACY.md](PRIVACY.md). Conversation content stays on the user's device and is not sent to the developer or third parties.

## Version 1.4.0

- Published in the Chrome Web Store.
- Added a clear export popup with local-processing disclosure.
- Added English and Ukrainian localization.
- Removed unnecessary host permissions.
- Rebuilt the package with `manifest.json` at the ZIP root for Chrome Web Store submission.
- Added public privacy, store-listing, and submission documentation.

## Support development

Development donations are separate from donations to the UA FREE charitable foundation.

- **PayPal:** `kozyriev@uafree.org`
- **BTC:** `bc1q4dn8e7sz2866g7qp1qtshh98j54tvuau5ghuuk`
- **ETH / USDC ERC-20:** `0x3aE3b23A7BD94b8a65A7E8Ca205A4e29BEF7c229`
- **USDT TRC-20:** `TYsGyK7K3XB4NPHprf5w8ZodFafxFfDdbP`

Use only the network shown next to each crypto address.

## License

GPL-2.0-or-later.
