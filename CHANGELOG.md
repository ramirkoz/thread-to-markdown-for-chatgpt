# Changelog

## 1.5.0 — Unreleased

- Added compact previews for detected ChatGPT messages.
- Added individual message selection before export.
- Added Select all and Clear controls.
- Added selected-message counts and empty-selection protection.
- Added Markdown, plain-text, and JSON output formats.
- Added local clipboard copying for the selected messages.
- Preserved headings, links, emphasis, blockquotes, ordered and unordered lists, nested lists, tables, inline code, and fenced code blocks in Markdown exports.
- Added the structured Markdown representation to JSON exports while keeping plain text for compatibility.
- Preserved attachment and download labels instead of dropping button-based links.
- Added spacing between adjacent source badges and citation labels.
- Removed empty list markers created by unsupported or control-only elements.
- Removed ChatGPT service labels such as quote and code-copy controls from Markdown and JSON exports.
- Kept local processing and the existing minimum permissions.
- Added automated validation for JavaScript, localization, permissions, and package structure.
- Changed release publishing so it runs only from version tags.

## 1.4.0 — 2026-08-02

- Published in the Chrome Web Store.
- Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`.
- Added a user-facing export confirmation popup and privacy disclosure.
- Added English and Ukrainian localization.
- Removed unnecessary host permissions.
- Prepared a Chrome Web Store package with the manifest at ZIP root.
- Added privacy policy and store submission documentation.

## 1.3.0 — 2026-07-24

- Exported the open ChatGPT conversation to Markdown from the extension action.
- Added title, timestamp, source URL, role labels, and safe filenames.
