# Privacy Policy — Thread to Markdown for ChatGPT

**Effective date:** 6 August 2026  
**Published extension version:** 1.4.0  
**Development version:** 1.6.0

## Summary

Thread to Markdown for ChatGPT exports the conversation currently open in the user's browser to local files. The extension processes the selected conversation on the user's device and does not send conversation content, browsing history, account information, or generated files to the developer or to an extension-operated service.

## Data handled by the extension

After the user starts an export, the extension temporarily reads the visible content and URL of the active ChatGPT conversation so it can build the requested local file. This content may include personal communications, uploaded images, attachment labels, and user-generated content because it comes from the conversation selected by the user.

The extension:

- does not collect data on a developer-controlled remote server;
- does not transmit conversation content or URLs to the developer;
- does not use analytics, telemetry, advertising, tracking pixels, cookies, or fingerprinting;
- does not sell or share user data;
- does not retain a copy of exported content after creating the local download;
- does not run on unrelated websites.

Generated Markdown, HTML, PDF, ZIP, text, and JSON files are saved through Chrome's local features. The user controls those files and can delete them at any time.

## ZIP images and attachments

The development ZIP export can capture reusable images and attachments exposed by the currently open ChatGPT conversation. To do this, the page may re-read the file URL already provided by ChatGPT using the user's existing ChatGPT session.

- Captured bytes are written only into the local ZIP package.
- They are not sent to the developer or another extension service.
- Files that cannot be safely re-read are not included; the ZIP manifest records the skipped reason.
- Capture is limited to 40 detected files, 6 MB per file, and 16 MB total.

## Permission use

- **activeTab:** access only to the tab where the user explicitly opens the extension.
- **scripting:** read the open conversation and reusable assets after the user starts an export.
- **downloads:** save the generated local export to the user's device.

No broader host permission is requested.

## Limited Use

Use of information received from browser permissions is limited to the extension's single purpose: exporting the user-selected conversation to local files. The information is not transferred to the developer, used for advertising, used for profiling, or made available for human review by the developer.

## Security

Processing and package generation happen inside the browser. The extension contains no remotely hosted code. ZIP asset capture may re-request a file URL already exposed by the active ChatGPT page, but the extension does not send exported content to a developer-controlled server or to an unrelated third party.

## Changes

Chrome Web Store privacy disclosures will be updated before any development behavior is published to store users.

## Contact

For privacy or support questions: **kozyriev@uafree.org**

## Trademark notice

This is an independent, unofficial extension. It is not created, supported, certified, or endorsed by OpenAI. ChatGPT and OpenAI are trademarks of OpenAI.
