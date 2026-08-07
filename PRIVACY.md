# Privacy Policy — Thread to Markdown for ChatGPT

**Effective date:** 7 August 2026  
**Published extension version:** 1.4.0  
**Development version:** 1.9.0

## Summary

Thread to Markdown for ChatGPT exports the conversation currently open in the user's browser to local files, stores reusable prompts locally in the browser profile, and can insert text explicitly selected by the user, cleaned content from the current webpage, or a user-requested screenshot into a new ChatGPT chat. The extension processes selected content on the user's device and does not send conversation content, saved prompts, selected text, extracted webpage content, screenshots, browsing history, account information, or generated files to the developer or to an extension-operated service.

## Data handled by the extension

After the user starts an export, navigation, selected-text action, webpage action, or screenshot action, the extension temporarily reads or captures the active page so it can perform the requested operation. This content may include personal communications, uploaded images, attachment labels, page titles, URLs, visible page pixels, and user-generated content because it comes from the page or conversation chosen by the user.

The extension:

- does not collect data on a developer-controlled remote server;
- does not transmit conversation content, prompts, selected text, extracted webpage content, screenshots, or URLs to the developer;
- does not use analytics, telemetry, advertising, tracking pixels, cookies, or fingerprinting;
- does not sell or share user data;
- does not retain a copy of exported or handed-off content after completing the requested action;
- does not run continuously on unrelated websites.

Generated Markdown, HTML, PDF, ZIP, text, and JSON files are saved through Chrome's local features. The user controls those files and can delete them at any time.

## Local prompt library

The development prompt library stores prompt names and prompt text in storage belonging to the extension popup inside the current browser profile.

- Prompt data is not sent to the developer or to another service.
- Prompt data is available only to this extension in that browser profile.
- The library does not require a new browser permission.
- The user can edit or delete saved prompts from the popup.
- Removing the extension or clearing its site data may remove the saved library.

## Selected-text handoff

The development selected-text feature reads only text explicitly selected by the user on the active page. After the user approves optional access to `https://chatgpt.com/*`, the extension opens a new ChatGPT tab and inserts the selected text into the message field.

- The extension does not automatically send the message.
- The selected text is passed directly between the active page and the ChatGPT tab inside the browser.
- The extension does not store the selected text after insertion.
- The selected text is not sent to the developer or to an extension-operated service.
- Optional ChatGPT access is requested only when the user activates this feature.

## Webpage handoff

The development webpage feature reads the current page title, source URL, and visible text only after the user presses the webpage handoff action. Common navigation, forms, scripts, sidebars, advertisements, and other page chrome are removed locally before the prepared text is inserted into a new ChatGPT tab.

- The extension does not automatically send the message.
- Extracted webpage content is processed only in the browser and is not stored after insertion.
- Long page text is shortened locally to keep the handoff within 30,000 characters.
- A visible note is added to the inserted text when shortening occurs.
- Extracted webpage content and the source URL are not sent to the developer or to an extension-operated service.
- Optional ChatGPT access is requested only when the user activates a handoff feature.

## Screenshot handoff

The development screenshot feature captures only the currently visible area of the active browser tab after the user presses the screenshot action. The image is encoded locally as JPEG and attached to a new ChatGPT message.

- The extension does not automatically send the message.
- The screenshot is not saved by the extension as a local file and is not retained after the handoff completes.
- The screenshot is passed directly from the active tab to the new ChatGPT tab inside the browser.
- Screenshot data is not sent to the developer or to an extension-operated service.
- A size limit is applied before the screenshot is handed off.
- Optional ChatGPT access is requested only when the user activates a handoff feature.

## ZIP images and attachments

The development ZIP export can capture reusable images and attachments exposed by the currently open ChatGPT conversation. To do this, the page may re-read the file URL already provided by ChatGPT using the user's existing ChatGPT session.

- Captured bytes are written only into the local ZIP package.
- They are not sent to the developer or another extension service.
- Files that cannot be safely re-read are not included; the ZIP manifest records the skipped reason.
- Capture is limited to 40 detected files, 6 MB per file, and 16 MB total.

## Permission use

- **activeTab:** access only to the page or conversation where the user explicitly opens the extension, including a user-requested visible screenshot.
- **scripting:** read selected text or cleaned webpage content, read and navigate the open conversation, insert content into ChatGPT, and access reusable assets after the user requests an action.
- **downloads:** save generated export files locally.
- **Optional `https://chatgpt.com/*` access:** insert user-selected or webpage-derived text or attach a user-requested screenshot in a new ChatGPT message after explicit approval.

No broad mandatory host permission is requested.

## Limited Use

Use of information received from browser permissions is limited to the extension's stated purposes: navigating the user-selected conversation, exporting it to local files, maintaining a user-controlled local prompt library, and inserting user-selected, webpage-derived, or screenshot content into ChatGPT. The information is not transferred to the developer, used for advertising, used for profiling, or made available for human review by the developer.

## Security

Processing, package generation, navigation, prompt storage, selected-text handoff, webpage handoff, and screenshot handoff happen inside the browser. The extension contains no remotely hosted code. ZIP asset capture may re-request a file URL already exposed by the active ChatGPT page, but the extension does not send exported content, prompts, selected text, extracted webpage content, or screenshots to a developer-controlled server or to an unrelated third party.

## Changes

Chrome Web Store privacy disclosures will be updated before any development behavior is published to store users.

## Contact

For privacy or support questions: **kozyriev@uafree.org**

## Trademark notice

This is an independent, unofficial extension. It is not created, supported, certified, or endorsed by OpenAI. ChatGPT and OpenAI are trademarks of OpenAI.
