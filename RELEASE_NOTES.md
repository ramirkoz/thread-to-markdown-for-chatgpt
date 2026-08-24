# GPT Project & Memory Tools 2.32.1

Current tested release for local ChatGPT Project memory and resilient conversation export.

## Release scope

Version 2.32.1 keeps the final 2.32.0 export behavior unchanged and updates the Chrome Web Store manifest description to meet the store length requirement.

The 2.27.0–2.32.0 hardening cycle improved attachment naming and deduplication, large-file handling, timeout behavior, exact resource matching, and legacy-file failure reporting.

## Verified behavior

- Local project memory remains browser-local.
- Current mixed-attachment control export: **9 added / 0 skipped**.
- Large MP4 capture (~104.8 MB): PASS.
- Large PPTX capture (~17.9 MB): PASS.
- Duplicate file content is stored once and referenced consistently.
- Expired or inaccessible legacy ChatGPT attachments are not replaced with guessed files; they are reported in `MISSING_FILES.txt`.
- Chrome Web Store manifest description length: PASS.

## Test status

- LIVE functional baseline: PASS.
- Local automated validation: PASS.
- JavaScript syntax: 49/49 PASS.
- ZIP integrity: PASS.

## Chrome Web Store

Existing extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`.

Version 2.32.1 is the current package prepared for the existing listing.
