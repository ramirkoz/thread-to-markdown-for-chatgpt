# Thread to Markdown for ChatGPT

A small, privacy-first Chrome extension that exports the ChatGPT conversation currently open in your browser to local files or the clipboard.

> Independent and unofficial. Not affiliated with or endorsed by OpenAI.

## Install from Chrome Web Store

[Install Thread to Markdown for ChatGPT](https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb)

Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

The current Chrome Web Store version is 1.4.0. Development continues in this repository; the store package will be updated after the planned feature set is complete and tested.

## What it does

- Loads user and assistant messages from the open conversation.
- Lets the user select individual messages before export.
- Exports selected messages as Markdown, HTML, plain text, or JSON.
- Copies selected messages to the clipboard locally.
- Preserves headings, lists, tables, links, emphasis, quotes, inline code, and fenced code blocks in structured exports.
- Creates a self-contained, print-friendly HTML document without external scripts or styles.
- Adds the conversation title, export time, source URL, and safe filename.
- Works only after an explicit user action.
- Processes everything locally. No telemetry, tracking, server, or account is used.

## Development version 1.6.0

Version 1.5.0 completed message selection, Markdown/TXT/JSON export, clipboard copying, structured formatting, link cleanup, and removal of ChatGPT interface labels.

Version 1.6.0 development has started with self-contained HTML export. PDF, embedded images, attachments, and ZIP packaging remain in the 1.6.0 roadmap.

## Install from source

1. Download and extract the repository source archive.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `extension` folder.
6. Open a ChatGPT conversation and use the extension button.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Access the tab explicitly selected by the user. |
| `scripting` | Read the open conversation after the user requests it. |
| `downloads` | Save the generated export file locally. |

The extension requests no broad host permissions and performs no network requests.

## Privacy

See [PRIVACY.md](PRIVACY.md). Conversation content stays on the user's device and is not sent to the developer or third parties.

## Development roadmap

- **1.6.0:** HTML/PDF, images, attachments, ZIP.
- **1.7.0:** Navigation, search, and table of contents.
- **1.8.0:** Local prompt library.
- **1.9.0:** Send selected text, pages, screenshots, and YouTube subtitles into ChatGPT.
- **2.0.0:** Folders, tags, notes, bulk export, and backups.

## Support development

Development donations are separate from donations to the UA FREE charitable foundation.

- **PayPal:** `kozyriev@uafree.org`
- **BTC:** `bc1q4dn8e7sz2866g7qp1qtshh98j54tvuau5ghuuk`
- **ETH / USDC ERC-20:** `0x3aE3b23A7BD94b8a65A7E8Ca205A4e29BEF7c229`
- **USDT TRC-20:** `TYsGyK7K3XB4NPHprf5w8ZodFafxFfDdbP`

Use only the network shown next to each crypto address.

## License

GPL-2.0-or-later.
