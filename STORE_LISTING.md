# Chrome Web Store listing — ChatExtra Toolkit 2.0.0

## Publication status

Current published item: version 1.4.0 under the previous product name.

Planned update: version 2.0.0, rebranded as **ChatExtra Toolkit**, submitted to the same Chrome Web Store item.

Store URL: https://chromewebstore.google.com/detail/thread-to-markdown-for-ch/ingagbhapppiiiccljbhiledobnmhhfb

Extension ID: `ingagbhapppiiiccljbhiledobnmhhfb`

## Title

ChatExtra Toolkit

## Summary

Export and organize ChatGPT conversations locally, keep reusable prompts, and send selected webpage content into ChatGPT.

## Category

Productivity

## Detailed description

ChatExtra Toolkit is a privacy-first browser toolkit for people who use ChatGPT for research, projects, documentation, decisions, and long work sessions.

Its primary workflow remains conversation export: open a ChatGPT conversation, select the messages you need, and save or copy them locally. Additional local tools sit below the export controls so the original export workflow stays first.

MAIN FEATURES

• Select individual ChatGPT messages before export.  
• Search the open conversation and jump directly to matching messages.  
• Filter the thread by user or ChatGPT messages.  
• Export selected messages as Markdown, HTML, PDF, portable ZIP, plain text, or JSON.  
• Copy selected messages locally to the clipboard.  
• Preserve headings, lists, tables, links, quotes, emphasis, inline code, and fenced code blocks.  
• Package reusable images and available attachments into a portable ZIP.  
• Keep a local reusable prompt library with add, edit, search, copy, and delete actions.  
• Save optional local Markdown snapshots of conversations with folders, tags, and notes.  
• Search and filter saved chats locally and reopen the original ChatGPT URL.  
• Bulk-export selected saved chats into one ZIP with Markdown files and library metadata.  
• Back up and restore saved chats together with the local prompt library.  
• On normal websites, send selected text, cleaned page content, or a visible screenshot into a new ChatGPT chat without automatic sending.  
• On YouTube, send an available transcript into a new ChatGPT chat without automatic sending.  
• Use one toolbar icon: ChatGPT tabs open conversation tools; other sites open website tools.  
• Process data locally with no telemetry, advertising, developer server, or extension account.

PRIVACY

Conversation content, saved snapshots, prompts, selected text, page content, YouTube transcript text, screenshots, and generated files are not sent to the extension developer.

The extension contains no telemetry, analytics, advertising, tracking pixels, or remotely hosted executable code.

Content is handed to ChatGPT only after the user explicitly chooses a handoff action. The extension never presses Send automatically.

PERMISSIONS

• activeTab: work only with the tab where the user explicitly invokes the extension.  
• scripting: read the requested conversation/page content, navigate within the open conversation, and insert user-requested content into ChatGPT.  
• downloads: save local export, bulk ZIP, and backup files.  
• Optional access to `https://chatgpt.com/*`: requested only when a handoff action needs to place prepared content into ChatGPT.

No broad mandatory host permission is requested.

HOW TO USE

CHATGPT CONVERSATION

1. Open a conversation on chatgpt.com.  
2. Click the ChatExtra Toolkit icon.  
3. Search/filter the conversation if needed.  
4. Select the messages and output format.  
5. Copy or export the selection.  
6. Optional: use the prompt library or save the chat to the local workspace below the primary export controls.

NORMAL WEBSITE

1. Open the webpage.  
2. Click the same ChatExtra Toolkit icon.  
3. Choose selected text, current page, or visible screenshot.  
4. Review the prepared content in the newly opened ChatGPT chat and send it manually.

YOUTUBE

1. Open a video with an available transcript.  
2. Click ChatExtra Toolkit.  
3. Choose YouTube transcript.  
4. Review the text in ChatGPT before sending.

INDEPENDENT PRODUCT

ChatExtra Toolkit is an independent, unofficial browser extension. It is not created, supported, certified, sponsored, or endorsed by OpenAI. ChatGPT and OpenAI are trademarks of OpenAI.

## Single purpose statement

ChatExtra Toolkit provides user-triggered local tools for working with ChatGPT content: selecting, navigating, organizing, copying, exporting, backing up conversations and reusable prompts, and preparing user-selected webpage content for a new ChatGPT chat.

All features support this one user-controlled ChatGPT content workflow and run only after explicit user action.

## Permission justifications

### activeTab

Required to access only the active page or ChatGPT conversation after the user clicks the extension and requests a specific operation.

### scripting

Required to read the requested conversation/page content, navigate to messages, extract user-selected webpage content or an available YouTube transcript, and insert explicitly requested content into a new ChatGPT chat.

### downloads

Required to save user-requested Markdown, HTML, PDF workflow files, ZIP, TXT, JSON, bulk workspace ZIP, and backup JSON files locally.

### Optional `https://chatgpt.com/*`

Required only when the user explicitly chooses to insert selected text, cleaned webpage content, a YouTube transcript, or attach a visible screenshot in a new ChatGPT chat. The extension does not automatically send the prepared message.

## Remote code

No. All executable code is packaged inside the extension.

## Data usage declarations

The extension locally processes website content, personal communications, and user-generated content only for the user-requested export, local organization, backup, clipboard, or ChatGPT handoff operation.

It does not sell user data, use data for advertising, or transmit data to the developer or an extension-operated service.

## Support URL

https://github.com/ramirkoz/thread-to-markdown-for-chatgpt/issues

## Privacy policy URL

https://github.com/ramirkoz/thread-to-markdown-for-chatgpt/blob/main/PRIVACY.md
