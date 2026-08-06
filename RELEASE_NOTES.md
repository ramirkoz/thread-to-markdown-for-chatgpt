# Thread to Markdown for ChatGPT 1.5.0

Message selection and structured export release.

## Chrome Web Store

[Install Thread to Markdown for ChatGPT](https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb)

Extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

The Chrome Web Store currently serves version 1.4.0. Version 1.5.0 is prepared for submission after final package review.

## Highlights

- Compact preview of messages detected in the open ChatGPT conversation.
- Individual message selection before export.
- Select all, Clear, live selection count, and empty-selection protection.
- Markdown, plain-text, and JSON export formats.
- Local clipboard copying for selected messages.
- Structured Markdown preservation for headings, links, emphasis, blockquotes, ordered and unordered lists, nested lists, tables, inline code, and fenced code blocks.
- JSON includes both plain text and structured Markdown for each selected message.
- Cleanup of empty list markers, interface-only controls, code-copy labels, citation labels, and temporary attachment links.
- English and Ukrainian interface localization.
- Local processing only with the same minimum permissions: `activeTab`, `scripting`, and `downloads`.

## Privacy

The extension does not upload conversation content or generated files. It uses no telemetry, analytics, tracking, advertising, remote code, or custom server.

## Package verification

The release workflow validates JavaScript syntax, Manifest V3, the exact permission list, localization files, required package files, the service-worker entry point, and `manifest.json` at the Chrome Web Store ZIP root.

Compare downloaded ZIP files with `SHA256SUMS.txt`.

## Installation for testing

1. Extract the source archive.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Select Load unpacked.
5. Choose the `extension` folder.

## Test status

- Automated package validation: PASS.
- Message loading and selection: PASS.
- Selected-message Markdown export: PASS.
- TXT export: PASS.
- JSON export: PASS.
- Clipboard copying: PASS.
- Structured tables, lists, links, and code: PASS.
- ChatGPT interface-label cleanup: PASS.
- Chrome Web Store review for 1.5.0: PENDING.

## Support development

PayPal: `kozyriev@uafree.org`  
BTC: `bc1q4dn8e7sz2866g7qp1qtshh98j54tvuau5ghuuk`  
ETH / USDC ERC-20: `0x3aE3b23A7BD94b8a65A7E8Ca205A4e29BEF7c229`  
USDT TRC-20: `TYsGyK7K3XB4NPHprf5w8ZodFafxFfDdbP`

This is an independent, unofficial extension and is not affiliated with or endorsed by OpenAI.
