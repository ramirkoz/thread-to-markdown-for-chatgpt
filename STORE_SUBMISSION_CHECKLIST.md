# Chrome Web Store submission checklist — ChatExtra Toolkit 2.0.0

## Existing item

- Update the existing Chrome Web Store item, do not create a duplicate listing.
- Extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`.
- Existing item URL: https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb
- Current published version before submission: 1.4.0 under the previous product name.

## Package

- Upload `ChatExtra-Toolkit-2.0.0-chrome-package.zip` from the verified release/development build.
- Confirm `manifest.json` is at the ZIP root.
- Confirm product name `ChatExtra Toolkit`.
- Confirm version `2.0.0` and Manifest V3.
- Confirm required permissions are exactly `activeTab`, `scripting`, `downloads`.
- Confirm optional host access is limited to `https://chatgpt.com/*`.
- Confirm no broad mandatory host permissions are present.

## Store listing

- Language: English first; add Ukrainian localized listing after the English listing is saved.
- Category: Productivity.
- Copy the title, summary, and detailed description from `STORE_LISTING.md`.
- Upload the 128×128 icon from `extension/icons/icon128.png`.
- Replace old screenshots with current 2.0 UI screenshots.
- Include at least:
  - ChatGPT export/search interface;
  - website tools interface;
  - local prompt library;
  - saved-chat workspace with folders/tags/notes;
  - bulk export/backup controls.
- Update the website/support link to the GitHub repository.
- Update privacy policy URL to the current `PRIVACY.md`.
- Keep the independent/unofficial disclaimer visible in the detailed description.

## Privacy practices

- Single purpose: user-triggered local tools for working with ChatGPT content, including selecting, navigating, organizing, copying, exporting, backing up conversations/prompts, and preparing user-selected webpage content for ChatGPT.
- Website content: handled locally for the requested export, page extraction, screenshot, or transcript operation.
- Personal communications: handled locally because ChatGPT conversations may contain them.
- User-generated content: handled locally because conversations, prompts, notes, and selected webpage content may contain it.
- Saved workspace data: stored only in extension-owned browser storage unless the user explicitly downloads a backup/export.
- Data sold: No.
- Data transferred to developer: No.
- Data used for advertising: No.
- Data used for analytics: No.
- Remote code: No.
- Automatic message sending to ChatGPT: No.
- Privacy policy: link to the public `PRIVACY.md` page.

## Functional final review

- Install the exact ZIP intended for submission.
- On ChatGPT, confirm the icon opens the conversation/export interface without refreshing the page.
- On a normal website, confirm the same icon opens website tools.
- Export a short conversation as Markdown.
- Export a long conversation as HTML/PDF/portable ZIP.
- Verify attachment/image handling on a conversation that contains files.
- Verify search, role filters, previous/next navigation, and direct message jump.
- Verify prompt add/edit/search/copy/delete.
- Save two chats into different folders with tags/notes.
- Verify saved-chat search and folder filter.
- Bulk-export at least two saved chats and inspect the ZIP.
- Create a backup JSON and restore it in a test profile if possible.
- Verify selected-text handoff.
- Verify cleaned webpage handoff.
- Verify image-only screenshot handoff.
- Verify YouTube transcript handoff on a video with an available transcript.
- Confirm nothing is sent automatically from the ChatGPT composer.

## Branding review

- Product title: `ChatExtra Toolkit`.
- Use ChatGPT only descriptively in listing copy and functionality descriptions.
- Do not use the OpenAI logo or imply sponsorship/endorsement.
- Keep the statement that ChatExtra Toolkit is independent and unofficial.

## Distribution

- Visibility: Public.
- Regions: all available regions unless a legal restriction is identified.
- Pricing: Free.

## Submission

- Confirm GitHub release assets and SHA-256 checksums match the submitted ZIP.
- Confirm Google Drive archive contains the same release package, source package, checksums, release notes, and user manual.
- Upload the verified ZIP to the existing Chrome Web Store item.
- Update listing metadata and screenshots.
- Review privacy declarations.
- Submit version 2.0.0 for Chrome Web Store review.
