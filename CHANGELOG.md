# Changelog

## 1.6.0 — Unreleased

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
- Added ZIP structure and CRC validation to CI.
- Added HTML, PDF, and ZIP localization.
- Kept local processing and the existing minimum permissions.
- Manual image capture and Unicode filename detection passed; assistant-output download-button byte capture remains under manual validation.

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
- Added title, timestamp, source URL, role labels, and safe filenames.
