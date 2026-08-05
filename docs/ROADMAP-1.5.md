# Thread to Markdown for ChatGPT 1.5.0

Status: in development.

## Module 1: message selection and preview

- Load the open ChatGPT conversation into the extension popup.
- Show a compact preview of every detected message.
- Select or deselect individual messages.
- Select all or clear all.
- Export only the selected messages.
- Keep all processing local and retain the existing minimum permissions.

## Acceptance criteria

- Existing one-click full-thread export remains available.
- No new Chrome permissions are required.
- English and Ukrainian interfaces are supported.
- Empty selection cannot be exported.
- Large conversations remain scrollable inside the popup.
