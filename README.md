# GPT Project & Memory Tools

Privacy-first Chrome extension for local ChatGPT Project memory and resilient conversation export.

## Current release

**2.26.0** — final tested release candidate for the existing Chrome Web Store item.

Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

## Main functions

- Automatic local memory for ChatGPT Projects.
- Local synchronization of project conversations into extension-owned browser storage.
- Context retrieval from earlier project chats for a new project conversation.
- Markdown, HTML, PDF, ZIP, TXT and JSON conversation export.
- Mixed attachment capture for images, office documents, generated files and video.
- Video attachments up to 512 MB per file.
- Full archive asset budget up to 640 MB.
- Filename alias coalescing and same-message content deduplication.
- Local prompt library, saved-chat workspace, search, folders, tags, notes and backups.
- No developer telemetry or remote executable code.

## 2.26.0 test status

- Local automated validation: PASS.
- Real control export: **9 files added / 0 skipped**.
- Large MP4 capture: PASS.
- ZIP integrity: PASS.

## Install from source

1. Download the release source ZIP or clone the repository.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked**.
5. Select the `extension` folder.

## Privacy

Project memory and saved workspace data are stored locally in the browser profile. Exported archives are created locally. The extension does not operate a developer server for user content.

## License

GPL-2.0-or-later.
