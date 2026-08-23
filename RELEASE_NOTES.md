# GPT Project & Memory Tools 2.26.0

Stable control release for local ChatGPT Project memory and mixed-attachment export.

## Final fixes

- Video attachments can use up to 512 MB per file while non-video files retain the 48 MB limit.
- Full ZIP asset budget increased to 640 MB.
- Video transfer budget increased to 90 seconds with a 60-second active request window.
- Preserved exact `file_id` matching, signed media replay, XLSX duplicate-name handling, generated-file capture, filename alias coalescing and PDF/content deduplication.
- Preserved progress UI, cancellation and fail-open ZIP behavior.

## Test status

- LOCAL PASS.
- JavaScript validation PASS.
- ZIP integrity PASS.
- Real control export PASS: **9 added / 0 skipped**.
- `Dniprorudne Pryvitannya.mp4` captured successfully as one file.

## Chrome Web Store

Existing extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`.

Version 2.26.0 is prepared as the next update for the existing listing.
