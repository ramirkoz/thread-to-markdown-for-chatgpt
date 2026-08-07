# Thread to Markdown for ChatGPT

A privacy-first Chrome extension that searches, navigates, organizes, and exports ChatGPT conversations locally. It also keeps reusable prompts, can hand selected website content to ChatGPT, and stores optional local conversation snapshots with folders, tags, notes, bulk export, and backups.

> Independent and unofficial. Not affiliated with or endorsed by OpenAI.

## Install from Chrome Web Store

[Install Thread to Markdown for ChatGPT](https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb)

Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

The current Chrome Web Store version is 1.4.0. Development continues in this repository; the store package will be updated after the planned feature set is complete and tested.

## What it does

- Loads user and assistant messages from the open ChatGPT conversation.
- Shows a numbered thread contents list with role and text previews.
- Searches the open thread locally by message text or role.
- Filters results to all messages, user messages, or ChatGPT messages.
- Opens a selected message directly in the ChatGPT page and briefly highlights it.
- Cycles through search results with previous and next controls.
- Lets the user select individual messages before export.
- Exports selected messages as Markdown, HTML, PDF, ZIP, plain text, or JSON.
- Copies selected messages to the clipboard locally.
- Stores reusable prompts locally with add, edit, delete, search, and copy actions.
- Stores optional local conversation snapshots in IndexedDB with folders, tags, and notes.
- Searches and filters saved conversations by title, folder, tag, or note.
- Opens saved ChatGPT conversations from the local workspace.
- Bulk-exports selected saved conversations to a ZIP containing Markdown files and `library.json` metadata.
- Creates and restores a JSON backup containing saved conversations plus the local prompt library.
- Reads text explicitly selected by the user on a normal webpage and inserts it into a new ChatGPT chat without sending automatically.
- Reads the current page title, source URL, and cleaned main text and inserts them into a new ChatGPT chat without sending automatically.
- Captures the visible browser area as a JPEG screenshot and attaches it to a new ChatGPT chat without sending automatically.
- Reads an available YouTube transcript and inserts it into a new ChatGPT chat without sending automatically.
- Preserves headings, lists, tables, links, emphasis, quotes, inline code, and fenced code blocks in structured exports.
- Creates a self-contained HTML document and detects Ukrainian, Russian, or English content for the document language.
- Opens a local PDF preparation page with clear steps for disabling Chrome Headers and footers before saving.
- Creates a portable ZIP package with HTML, Markdown, text, JSON, a manifest, captured images, and reusable attachments.
- Works only after an explicit user action.
- Uses no telemetry, tracking, developer server, or extension account.

## Development version 2.0.0

Version 2.0.0 adds a local workspace for saved ChatGPT conversations. Saving a conversation stores its current Markdown snapshot together with its ChatGPT URL, title, folder, tags, note, message count, and timestamps in the extension's IndexedDB database. Saved chats can be searched and filtered locally and reopened in ChatGPT.

Multiple saved chats can be selected and exported as one ZIP. The ZIP contains one Markdown file per saved conversation plus `library.json` metadata. Bulk export is capped at 100 selected chats and 12 MB of stored Markdown per operation to keep browser memory and data-URL downloads predictable.

The backup action exports all saved workspace records plus the existing local prompt library to a JSON file. Restore replaces the local workspace and prompt library only after explicit confirmation. No new browser permission is required for the 2.0 workspace.

The toolbar remains context-aware: on ChatGPT it opens the conversation/export interface; on other sites it opens the website tools interface. Website tools include selected text, cleaned page content, visible screenshots, and YouTube transcripts where available.

## Install from source

1. Download and extract the repository source archive.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `extension` folder.
6. Open a ChatGPT conversation or another webpage and use the extension button.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Read or capture the page or conversation explicitly selected by the user. |
| `scripting` | Read selected text, page content, YouTube transcript text, conversations, and reusable assets after a user action. |
| `downloads` | Save generated export files and bulk workspace ZIP files locally. |
| Optional `https://chatgpt.com/*` access | Insert user-selected or webpage-derived content or attach a user-requested screenshot in a new ChatGPT message after explicit approval. |

The prompt library and 2.0 local workspace use extension-owned browser storage and do not add browser permissions. The extension requests no broad mandatory host permissions.

## Privacy

See [PRIVACY.md](PRIVACY.md). Conversation content, saved conversation snapshots, saved prompts, selected text, extracted webpage content, YouTube transcript text, and screenshots stay on the user's device until the user explicitly exports them or hands content to ChatGPT. They are not sent to the developer or an extension-operated service.

## Development roadmap

- **1.6.0:** HTML/PDF, images, attachments, ZIP. Completed in development.
- **1.7.0:** Navigation, search, and table of contents. Completed in development.
- **1.8.0:** Local prompt library. Completed in development.
- **1.9.0:** Context-aware website tools for selected text, pages, screenshots, and YouTube transcripts. Completed in development.
- **2.0.0:** Folders, tags, notes, saved Markdown snapshots, bulk export, and backups. In development testing.

## Support development

Development donations are separate from donations to the UA FREE charitable foundation.

- **PayPal:** `kozyriev@uafree.org`
- **BTC:** `bc1q4dn8e7sz2866g7qp1qtshh98j54tvuau5ghuuk`
- **ETH / USDC ERC-20:** `0x3aE3b23A7BD94b8a65A7E8Ca205A4e29BEF7c229`
- **USDT TRC-20:** `TYsGyK7K3XB4NPHprf5w8ZodFafxFfDdbP`

Use only the network shown next to each crypto address.

## License

GPL-2.0-or-later.
