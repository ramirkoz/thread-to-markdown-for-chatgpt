# GPT Project & Memory Tools 2.26.0 — Local Test Report

Date: 2026-08-23

## Real export diagnosis (2.25.0)

Input: `2026-08-23_Контрольний чат експорту-package (10).zip`

- Included assets: 8
- Skipped assets: 1
- Missing asset: `Dniprorudne Pryvitannya.mp4`
- The exporter reached valid large-file candidates but rejected them with its own `48 MB per-file archive limit`.
- Other mixed attachments remained successful: PNG, XLSX, DOCX, PDF, PPTX, ZIP and generated PDFs.

## 2.26.0 change

- Non-video per-file limit remains 48 MB.
- Video per-file limit: 512 MB.
- Total archive asset budget: 640 MB.
- Video file budget: 90 seconds.
- Active video transfer timeout: 60 seconds.
- Exact `file_id` resource replay and `Range: bytes=0-` are retained.
- XLSX `(2)` filename handling, alias coalescing and content deduplication are retained.

## Local validation

- Manifest version: PASS (`2.26.0`)
- JavaScript syntax: PASS (49/49 files)
- Manifest JSON parse: PASS
- Video-size regression assertions: PASS
- Exact-resource replay regression: PASS
- Duplicate-name/XLSX logic presence: PASS
- Content-dedupe logic presence: PASS
- Chromium extension pack validation: PASS
- ZIP integrity: PASS

## Status

**LOCAL PASS — REAL CHAT RETEST REQUIRED**

Final acceptance target on the control chat: 9 included / 0 skipped, with `Dniprorudne Pryvitannya.mp4` present once.
