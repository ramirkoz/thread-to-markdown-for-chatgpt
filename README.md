# Thread to Markdown for ChatGPT

A small, privacy-first Chrome extension that searches, navigates, selects, and exports the ChatGPT conversation currently open in your browser to local files or the clipboard. It also keeps a reusable prompt library locally and can insert user-selected text, cleaned webpage content, or a visible screenshot into a new ChatGPT chat.

> Independent and unofficial. Not affiliated with or endorsed by OpenAI.

## Install from Chrome Web Store

[Install Thread to Markdown for ChatGPT](https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb)

Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

The current Chrome Web Store version is 1.4.0. Development continues in this repository; the store package will be updated after the planned feature set is complete and tested.

## What it does

- Loads user and assistant messages from the open conversation.
- Shows a numbered thread contents list with role and text previews.
- Searches the open thread locally by message text or role.
- Filters results to all messages, user messages, or ChatGPT messages.
- Opens a selected message directly in the ChatGPT page and briefly highlights it.
- Cycles through search results with previous and next controls.
- Lets the user select individual messages before export.
- Exports selected messages as Markdown, HTML, PDF, ZIP, plain text, or JSON.
- Copies selected messages to the clipboard locally.
- Stores reusable prompts locally with add, edit, delete, search, and copy actions.
- Reads text explicitly selected by the user on the current page and inserts it into a new ChatGPT chat without sending automatically.
- Reads the current page title, source URL, and cleaned main text and inserts them into a new ChatGPT chat without sending automatically.
- Removes common navigation, forms, sidebars, advertisements, scripts, and page chrome before webpage insertion.
- Captures the currently visible browser area as a JPEG screenshot and attaches it to a new ChatGPT chat without sending automatically.
- Preserves headings, lists, tables, links, emphasis, quotes, inline code, and fenced code blocks in structured exports.
- Creates a self-contained HTML document and detects Ukrainian, Russian, or English content for the document language.
- Opens a local PDF preparation page with clear steps for disabling Chrome Headers and footers before saving.
- Creates a portable ZIP package with HTML, Markdown, text, JSON, a manifest, captured images, and reusable attachments.
- Records skipped assets and the reason they could not be included instead of leaving misleading broken links.
- Adds the conversation title, export time, source URL, and safe filename.
- Works only after an explicit user action.
- Processes exports, prompt storage, selected-text handoff, webpage handoff, and screenshot capture locally. No telemetry, tracking, developer server, or extension account is used.

## Development version 1.9.0

Version 1.8.0 completed the local prompt library with creation, editing, search, copying, deletion, local retention, and a 100-prompt limit.

Version 1.9.0 adds the content handoff layer. The extension can read text selected on the active page, extract the current page title, address, and cleaned main text, or capture the visible browser area as a screenshot. It opens a new ChatGPT chat and inserts or attaches the prepared content. The extension does not press Send. The first use asks for a narrowly scoped optional permission for `https://chatgpt.com/*` so the extension can place the prepared content into ChatGPT.

Webpage extraction is performed locally after the user presses the action. Common page chrome and noise are removed before insertion. Long page text is shortened to keep the prepared handoff within 30,000 characters, and a note is added when shortening occurs.

Screenshot capture is limited to the visible area of the current browser tab. The image is encoded locally as JPEG, passed directly to the new ChatGPT tab, attached through the page's file or paste handling, and is not stored by the extension after the handoff.

The existing ZIP capture limits remain unchanged: up to 40 detected files, 6 MB per file, and 16 MB total. ChatGPT temporary files that do not expose reusable bytes are listed in `manifest.json` with a skipped reason.

## Install from source

1. Download and extract the repository source archive.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `extension` folder.
6. Select text on a page, open a webpage, or open a ChatGPT conversation, then use the extension button.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Read or capture the page or conversation explicitly selected by the user. |
| `scripting` | Read selected text or cleaned webpage content, read and navigate conversations, insert content into ChatGPT, and access reusable assets after the user requests an action. |
| `downloads` | Save generated export files locally. |
| Optional `https://chatgpt.com/*` access | Insert user-selected or webpage-derived text or attach a user-requested screenshot in a new ChatGPT message after explicit approval. |

The prompt library uses storage belonging to the extension popup and does not add a browser permission. The extension requests no broad mandatory host permissions. The optional ChatGPT origin is requested only when a handoff action is used. ZIP asset capture may re-read file URLs already exposed by the currently open ChatGPT page, using that page's existing session. Captured content is written only into the local ZIP and is not sent to the developer or another service.

## Privacy

See [PRIVACY.md](PRIVACY.md). Conversation content, saved prompts, selected text, extracted webpage content, and screenshots stay on the user's device until the user explicitly hands them to ChatGPT; they are not sent to the developer or an extension-operated service.

## Development roadmap

- **1.6.0:** HTML/PDF, images, attachments, ZIP. Completed in development.
- **1.7.0:** Navigation, search, and table of contents. Completed in development.
- **1.8.0:** Local prompt library. Completed in development.
- **1.9.0:** Send selected text, pages, screenshots, and YouTube subtitles into ChatGPT. In progress.
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
