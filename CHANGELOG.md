# Changelog

## 2.0.0 — 2026-08-07

- Rebranded the extension as **ChatExtra Toolkit** while keeping the existing extension ID and repository for continuity.
- Kept the original ChatGPT conversation export workflow visually primary by moving the prompt library and saved-chat workspace below the Copy/Export controls.
- Replaced background per-tab popup state with click-time routing through `popup-entry.html`, eliminating the stale-menu issue that could show website tools on a ChatGPT tab until the page was refreshed.
- Added a local conversation workspace backed by extension-owned IndexedDB storage.
- Added explicit saving and updating of the current ChatGPT conversation as a Markdown snapshot with source URL, title, message count, and timestamps.
- Added user-defined folders, tags, and local notes for saved conversations.
- Added local search across saved titles, folders, tags, and notes plus folder filtering.
- Added reopening of saved conversations in ChatGPT from the workspace.
- Added bulk selection and ZIP export of up to 100 saved conversation snapshots, organized under folder paths with `library.json` metadata and a README.
- Added a 12 MB stored-Markdown limit per bulk-export operation to keep browser memory and downloads predictable.
- Added JSON backup and restore for the complete local workspace plus the existing local prompt library.
- Added confirmation before destructive restore or bulk deletion.
- Added a maximum of 250 saved workspace records.
- Added a detailed Ukrainian user manual covering all primary and secondary workflows.
- Prepared updated privacy and Chrome Web Store listing documentation for the 2.0 product scope.
- Kept the existing `activeTab`, `scripting`, and `downloads` permissions with no new broad host permission.
- Manual browser validation passed for the 2.0 workspace and the final context-aware interface behavior.

## 1.9.0 — 2026-08-07

- Added a context-aware toolbar interface: ChatGPT pages open the conversation/export tools while other websites open a separate site-tools popup.
- Added selected-text handoff into a new ChatGPT chat without automatic sending.
- Added cleaned webpage handoff with title, source URL, and main text.
- Added visible-area screenshot attachment without automatic sending and enforced image-only composer cleanup.
- Added YouTube transcript handoff and fallbacks for visible transcript rows, caption data, and transcript UI.
- Added a narrowly scoped optional permission for `https://chatgpt.com/*`, requested only when a handoff action is used.
- Added 30,000-character handoff limits, load timeout handling, and clear permission or composer errors.
- Kept the ChatGPT export/search/navigation/prompt interface separate from website handoff tools.
- Manual browser validation passed for selected text, webpage content, image-only screenshots, context-aware toolbar switching, and YouTube transcript insertion without automatic sending.

## 1.8.0 — 2026-08-06

- Started the 1.8.0 development cycle without submitting an intermediate Chrome Web Store update.
- Added a collapsible local prompt library to the extension popup.
- Added creation, editing, deletion, search, and clipboard copying for reusable prompts.
- Stored prompt data only in the current browser profile with no developer server and no new browser permission.
- Added input limits and a maximum of 100 saved prompts to keep local storage predictable.
- Added English and Ukrainian localization for the prompt library.
- Manual browser validation passed for creating, editing, searching, copying, deleting, and retaining local prompts.

## 1.7.0 — 2026-08-06

- Started the 1.7.0 development cycle without submitting an intermediate Chrome Web Store update.
- Added a searchable thread contents panel to the extension popup.
- Added numbered message entries with role and text previews.
- Added one-click navigation from the popup to the matching message in the open ChatGPT conversation.
- Added temporary visual highlighting for the opened message.
- Added previous and next controls for cycling through filtered search results, including Enter and Shift+Enter shortcuts.
- Kept only one active ChatGPT message highlight by clearing the previous marker before each navigation step.
- Added role filters for all messages, user messages, or ChatGPT messages while preserving text search and result navigation.
- Added English and Ukrainian localization for search, role filters, contents, result position, navigation, empty results, and navigation errors.
- Kept local processing and the existing minimum permissions.
- Manual browser validation passed for search, role filters, direct message opening, previous and next navigation, virtualized long-thread navigation, and single active highlighting.

## 1.6.0 — 2026-08-06

- Started the 1.6.0 development cycle without submitting an intermediate Chrome Web Store update.
- Added self-contained HTML export for selected messages.
- Added automatic HTML document-language detection for Ukrainian, Russian, and English content.
- Added a local PDF workflow that opens a print-ready document with no new permissions.
- Added a guided PDF preparation page instead of opening the print dialog automatically.
- Added explicit steps to disable Chrome Headers and footers before saving, removing the date, extension URL, and page counters from clean PDFs.
- Kept the PDF instruction panel hidden from the printed document and allowed reopening the print dialog if settings need correction.
- Added print styling for long messages, tables, code blocks, links, and images.
- Added a portable ZIP package containing HTML, Markdown, text, JSON, a manifest, captured images, and reusable attachments.
- Added local asset capture with per-file and total package limits, duplicate filtering, and clear skipped-file reasons.
- Added relative image and attachment links inside packaged HTML and Markdown.
- Added supplemental detection for ChatGPT file cards rendered as buttons or containers without a normal download link.
- Added manifest reporting when a visible file card exists but ChatGPT does not expose reusable file bytes.
- Added lazy attachment resolution that activates unresolved file cards, observes newly loaded file resources, follows metadata URLs, and captures validated bytes locally.
- Added a main-page-context fallback that observes ChatGPT fetches, object URLs, opened links, and signed attachment responses after activation.
- Added Unicode-safe detection for assistant-generated output filenames, including Ukrainian filenames and names containing spaces.
- Added an assistant-output proxy that activates hidden, delegated, or nearby download controls when a generated filename is rendered as plain text.
- Added direct binding between assistant-generated filenames and the compact file-card download icon rendered beside the filename.
- Added detection for icon-only download controls implemented as tabindex, delegated, or cursor-pointer elements rather than normal buttons.
- Added geometric matching between a generated filename and the adjacent ChatGPT download control.
- Added clean generated-file bridges that do not inflate attachment-card counts or create false package-limit notices.
- Preserved full Unicode attachment filenames from ChatGPT labels instead of saving truncated names that begin with an underscore.
- Added click-safe relative links for attachment filenames containing spaces or Unicode characters in packaged HTML.
- Added ZIP structure and CRC validation to CI.
- Added HTML, PDF, and ZIP localization.
- Kept local processing and the existing minimum permissions.
- Manual browser validation passed for HTML, PDF print output, image capture, ZIP integrity, Unicode filenames, clickable attachment links, ordinary PDF attachments, and assistant-generated downloadable PDFs.

## 1.5.0 — 2026-08-06

- Added compact previews for detected ChatGPT messages.
- Added individual message selection before export.
- Added Select all and Clear controls.
- Added selected-message counts and empty-selection protection.
- Added Markdown, plain-text, and JSON output formats.
- Added local clipboard copying for the selected messages.
- Preserved headings, links, emphasis, blockquotes, ordered and unordered lists, nested lists, tables, inline code, and fenced code blocks in Markdown exports.
- Added the structured Markdown representation to JSON exports while keeping plain text for compatibility.
- Preserved attachment and download labels while avoiding unusable temporary links.
- Added spacing between adjacent source badges and citation labels.
- Removed empty list markers created by unsupported or control-only elements.
- Removed ChatGPT service labels such as quote and code-copy controls from Markdown and JSON exports.
- Kept local processing and the existing minimum permissions.
- Added automated validation for JavaScript, localization, permissions, package structure, and the background service-worker entry point.
- Added automatic development package generation with Chrome package, source ZIP, and SHA-256 checksums.
- Kept Chrome Web Store publication deferred until the planned feature set is complete.

## 1.4.0 — 2026-08-02

- Published in the Chrome Web Store.
- Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`.
- Added a user-facing export confirmation popup and privacy disclosure.
- Added English and Ukrainian localization.
- Removed unnecessary host permissions.
- Prepared a Chrome Web Store package with the manifest at ZIP root.
- Added public privacy, store-listing, and submission documentation.

## 1.3.0 — 2026-07-24

- Exported the open ChatGPT conversation to Markdown from the extension action.
