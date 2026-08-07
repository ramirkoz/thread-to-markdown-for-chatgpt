# Privacy Policy — Thread to Markdown for ChatGPT

**Effective date:** 7 August 2026  
**Published extension version:** 1.4.0  
**Development version:** 2.0.0

## Summary

Thread to Markdown for ChatGPT exports the conversation currently open in the user's browser to local files, stores reusable prompts and user-saved conversation snapshots locally in the browser profile, and can insert user-requested website content into a new ChatGPT chat. The extension does not send conversation content, saved prompts, saved workspace records, selected text, extracted webpage content, YouTube transcript text, screenshots, browsing history, account information, or generated files to the developer or to an extension-operated service.

## Data handled by the extension

After the user starts an export, navigation, save-to-workspace, selected-text, webpage, screenshot, or YouTube transcript action, the extension reads or captures the active page only as needed for that requested operation. This content may include personal communications, uploaded images, attachment labels, page titles, URLs, visible page pixels, and user-generated content because it comes from the page or conversation chosen by the user.

The extension:

- does not collect data on a developer-controlled remote server;
- does not transmit conversation content, prompts, workspace records, selected text, extracted webpage content, screenshots, or URLs to the developer;
- does not use analytics, telemetry, advertising, tracking pixels, cookies, or fingerprinting;
- does not sell or share user data;
- does not retain temporary handoff content after completing the requested action;
- retains a conversation copy only when the user explicitly chooses **Save current chat** in the local workspace;
- does not run continuously on unrelated websites.

Generated Markdown, HTML, PDF, ZIP, text, JSON, bulk-export, and backup files are saved through browser-local features. The user controls those files and can delete them at any time.

## Local prompt library

The local prompt library stores prompt names and prompt text in storage belonging to the extension inside the current browser profile.

- Prompt data is not sent to the developer or to another service.
- Prompt data is available only to this extension in that browser profile.
- The library does not require a new browser permission.
- The user can edit or delete saved prompts from the extension interface.
- Removing the extension or clearing its data may remove the saved library.

## Local conversation workspace

Development version 2.0.0 adds an optional local workspace for conversations that the user explicitly chooses to save.

A saved workspace record may contain:

- the ChatGPT conversation URL;
- the conversation title;
- a user-defined folder;
- user-defined tags;
- a user-defined note;
- a Markdown snapshot of the conversation at the time it was saved or updated;
- message count and local save/update timestamps.

Workspace records are stored in the extension's IndexedDB database inside the current browser profile. They are not sent to the developer or to an extension-operated service. A saved snapshot is not continuously synchronized with ChatGPT; it changes only when the user explicitly updates the saved chat.

The user can search, filter, reopen, bulk-export, or delete saved records. Removing the extension or clearing its data may remove the local workspace.

## Workspace bulk export and backups

The user can explicitly export selected saved conversations into a local ZIP file. The ZIP contains Markdown snapshots and local metadata such as folders, tags, notes, titles, source URLs, and timestamps.

The user can also create a JSON backup containing the local workspace and the local prompt library.

- Bulk export and backup files are created only after an explicit user action.
- Files are written to the user's local download location and are not uploaded by the extension.
- Restore reads only a backup file explicitly selected by the user.
- Restore replaces the local workspace and prompt library only after user confirmation.
- Backup and restore do not add a browser permission or use a developer server.

## Selected-text handoff

The selected-text feature reads only text explicitly selected by the user on the active page. After the user approves optional access to `https://chatgpt.com/*`, the extension opens a new ChatGPT tab and inserts the selected text into the message field.

- The extension does not automatically send the message.
- The selected text is passed directly between the active page and the ChatGPT tab inside the browser.
- The extension does not store the selected text after insertion.
- The selected text is not sent to the developer or to an extension-operated service.
- Optional ChatGPT access is requested only when the user activates a handoff feature.

## Webpage handoff

The webpage feature reads the current page title, source URL, and visible text only after the user starts the webpage handoff action. Common navigation, forms, scripts, sidebars, advertisements, and other page chrome are removed locally before the prepared text is inserted into a new ChatGPT tab.

- The extension does not automatically send the message.
- Extracted webpage content is processed only in the browser and is not retained after insertion.
- Long page text is shortened locally to keep the handoff within the configured limit.
- Extracted webpage content and the source URL are not sent to the developer or to an extension-operated service.

## YouTube transcript handoff

When the user activates the YouTube transcript action on a supported YouTube page, the extension reads transcript or caption text exposed by the currently open video page and prepares it for insertion into a new ChatGPT tab.

- The extension does not automatically send the message.
- Transcript text is read only after the user requests the action.
- Transcript text is not retained by the extension after the handoff.
- Transcript text is not sent to the developer or to an extension-operated service.

## Screenshot handoff

The screenshot feature captures only the currently visible area of the active browser tab after the user starts the screenshot action. The image is encoded locally and attached to a new ChatGPT message.

- The extension does not automatically send the message.
- The screenshot is not saved by the extension as a local file and is not retained after the handoff completes.
- The screenshot is passed directly from the active tab to the new ChatGPT tab inside the browser.
- Screenshot data is not sent to the developer or to an extension-operated service.
- A size limit is applied before the screenshot is handed off.

## ZIP images and attachments

The ZIP export can capture reusable images and attachments exposed by the currently open ChatGPT conversation. To do this, the page may re-read the file URL already provided by ChatGPT using the user's existing ChatGPT session.

- Captured bytes are written only into the local ZIP package.
- They are not sent to the developer or another extension service.
- Files that cannot be safely re-read are not included; the ZIP manifest records the skipped reason.
- Capture is limited to 40 detected files, 6 MB per file, and 16 MB total.

## Permission use

- **activeTab:** access only to the page or conversation where the user explicitly opens the extension, including a user-requested visible screenshot.
- **scripting:** read selected text, cleaned webpage content, YouTube transcript text, the open conversation, navigation targets, and reusable assets after the user requests an action.
- **downloads:** save generated export files and bulk workspace ZIP files locally.
- **Optional `https://chatgpt.com/*` access:** insert user-requested text or attach a user-requested screenshot in a new ChatGPT message after explicit approval.

No broad mandatory host permission is requested. The local prompt library and 2.0 workspace use browser storage owned by the extension and require no additional browser permission.

## Limited Use

Use of information received from browser permissions is limited to the extension's stated purposes: navigating and exporting the user-selected conversation, maintaining user-controlled local prompts and saved conversation snapshots, and handing user-requested page content to ChatGPT. The information is not transferred to the developer, used for advertising, used for profiling, or made available for human review by the developer.

## Security

Processing, package generation, navigation, local workspace storage, prompt storage, handoff actions, bulk export, and backup generation happen inside the browser. The extension contains no remotely hosted code. ZIP asset capture may re-request a file URL already exposed by the active ChatGPT page, but the extension does not send exported content, workspace records, prompts, selected text, extracted webpage content, transcript text, or screenshots to a developer-controlled server or to an unrelated third party.

## Changes

Chrome Web Store privacy disclosures will be updated before any development behavior is published to store users.

## Contact

For privacy or support questions: **kozyriev@uafree.org**

## Trademark notice

This is an independent, unofficial extension. It is not created, supported, certified, or endorsed by OpenAI. ChatGPT and OpenAI are trademarks of OpenAI.