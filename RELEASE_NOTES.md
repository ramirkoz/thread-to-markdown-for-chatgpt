# ChatExtra Toolkit 2.0.1

Urgent ZIP export safety hotfix.

## Fixed

- ZIP package export no longer activates ChatGPT attachment cards with synthetic clicks.
- ZIP package export no longer calls or proxies `window.open` while trying to resolve attachments.
- ZIP package export no longer opens extra tabs or triggers browser download UI for individual files.
- Attachment collection now uses only already exposed reusable URLs and local `fetch`-based capture.
- If ChatGPT does not expose reusable bytes for an attachment, that asset is safely marked as skipped instead of being activated.
- The final ZIP exporter is loaded after all legacy attachment fallback layers so the safe behavior wins deterministically.

## Unchanged

- Conversation Markdown, HTML, text and JSON remain included in portable ZIP packages.
- Reusable images and attachments can still be embedded when their bytes are directly available.
- Existing `activeTab`, `scripting`, and `downloads` permissions are unchanged.
- No new host permissions, telemetry, analytics, or remote executable code were added.

## Safety contract

During ZIP export the final 2.0.1 code path must not use synthetic `.click()`, `window.open`, `chrome.tabs.create`, `chrome.tabs.update`, the attachment activation fallback, or the main-world attachment activation fallback.

Automated validation checks this contract before release packaging.

## Chrome Web Store

Existing extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

Submit 2.0.1 as an update to the existing ChatExtra Toolkit listing.
