# GPT Project & Memory Tools

Privacy-first Chrome extension for local ChatGPT Project memory, conversation export, reusable prompts, and attachment handling.

## Current release

**2.32.1** — current tested release for the existing Chrome Web Store item.

Chrome Web Store extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

## Main functions

- Automatic local memory for ChatGPT Projects.
- Local synchronization of project conversations into extension-owned browser storage.
- Context retrieval from earlier project chats for a new project conversation.
- Conversation export with available attachments.
- Large-file export support, including tested video and presentation attachments.
- Content deduplication and filename preservation inside portable archives.
- Honest reporting of expired or unavailable legacy attachments in `MISSING_FILES.txt`.
- Local prompt library, saved-chat workspace, search, folders, tags, notes, and backups.
- No developer telemetry or remote executable code.

## 2.32.1 test status

- Local automated validation: PASS.
- JavaScript syntax: **49/49 PASS**.
- Real control export: **9 files added / 0 skipped**.
- Large MP4 capture (~104.8 MB): PASS.
- Large PPTX capture (~17.9 MB): PASS.
- Content deduplication: PASS.
- ZIP integrity: PASS.
- Chrome Web Store manifest description compliance: PASS.

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
