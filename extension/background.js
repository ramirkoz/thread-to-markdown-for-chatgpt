'use strict';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (!['inspect-thread', 'export-thread', 'prepare-thread'].includes(type)) return false;

  let task;
  if (type === 'inspect-thread') {
    task = inspectThread(message.tabId);
  } else if (type === 'export-thread') {
    task = exportThread(message.tabId, message.selectedIndices, message.format);
  } else {
    task = prepareThread(message.tabId, message.selectedIndices, message.format);
  }

  task
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      console.error('Thread to Markdown:', error);
      sendResponse({ ok: false, error: String(error?.message || error) });
    });

  return true;
});

async function inspectThread(tabId) {
  await validateChatGptTab(tabId);
  const result = await readThread(tabId, { includeContent: false });

  if (!result?.ok || !Array.isArray(result.messages) || !result.messages.length) {
    throw new Error(result?.error || 'The conversation could not be read.');
  }

  return {
    title: result.title,
    messageCount: result.messageCount,
    messages: result.messages
  };
}

async function exportThread(tabId, selectedIndices, requestedFormat) {
  const result = await prepareThread(tabId, selectedIndices, requestedFormat);

  const downloadId = await chrome.downloads.download({
    url: toDataUrl(result.content, result.mimeType),
    filename: result.filename,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#166534' });
  await chrome.action.setBadgeText({ tabId, text: '✓' });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2500);

  return {
    filename: result.filename,
    messageCount: result.messageCount,
    format: result.format,
    downloadId
  };
}

async function prepareThread(tabId, selectedIndices, requestedFormat) {
  await validateChatGptTab(tabId);

  const normalizedSelection = Array.isArray(selectedIndices)
    ? [...new Set(selectedIndices.filter(Number.isInteger))]
    : null;

  if (normalizedSelection && normalizedSelection.length === 0) {
    throw new Error('Select at least one message.');
  }

  const format = normalizeFormat(requestedFormat);
  const result = await readThread(tabId, {
    includeContent: true,
    selectedIndices: normalizedSelection,
    format
  });

  if (!result?.ok || !result.content || !result.filename || !result.mimeType) {
    throw new Error(result?.error || 'The conversation could not be read.');
  }

  return {
    content: result.content,
    filename: result.filename,
    mimeType: result.mimeType,
    messageCount: result.selectedCount,
    format: result.format
  };
}

function normalizeFormat(value) {
  return ['markdown', 'text', 'json'].includes(value) ? value : 'markdown';
}

async function validateChatGptTab(tabId) {
  if (!Number.isInteger(tabId)) {
    throw new Error('No active tab was found.');
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(tab.url)) {
    throw new Error('Open a ChatGPT conversation first.');
  }
}

async function readThread(tabId, options) {
  const runs = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractThread,
    args: [options]
  });

  return runs?.[0]?.result;
}

function extractThread(options = {}) {
  try {
    const cleanText = (value) => String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const title = cleanText(
      document.querySelector('main h1')?.innerText ||
      document.querySelector('h1')?.innerText ||
      document.title.replace(/\s*[-–|]\s*ChatGPT.*$/i, '') ||
      'ChatGPT conversation'
    );

    const main = document.querySelector('main') || document.body;
    const turns = [];
    const seen = new Set();

    const roleNodes = [...main.querySelectorAll('[data-message-author-role]')];
    for (const roleNode of roleNodes) {
      const root = roleNode.closest(
        'article, [data-testid^="conversation-turn-"], [data-message-id], [class*="group/conversation-turn"]'
      ) || roleNode;
      if (seen.has(root)) continue;
      seen.add(root);

      const role = roleNode.getAttribute('data-message-author-role') || 'unknown';
      const body = root.querySelector('.markdown, [class*="markdown"], [class*="prose"], [class*="whitespace-pre-wrap"]') || root;
      const text = cleanText(body.innerText || body.textContent);
      if (text) turns.push({ role, text });
    }

    if (!turns.length) {
      const candidates = [...main.querySelectorAll(
        '[data-testid^="conversation-turn-"], [data-message-id], article, [class*="group/conversation-turn"]'
      )];
      candidates.forEach((root, index) => {
        if (seen.has(root)) return;
        const text = cleanText(root.innerText || root.textContent);
        if (!text) return;
        seen.add(root);
        turns.push({ role: index % 2 === 0 ? 'user' : 'assistant', text });
      });
    }

    if (!turns.length) {
      const text = cleanText(main.innerText || main.textContent);
      if (!text) return { ok: false, error: 'No text was found on this page.' };
      turns.push({ role: 'conversation', text });
    }

    const records = turns.map((turn, index) => ({ index, role: turn.role, text: turn.text }));
    const messages = records.map((record) => ({
      index: record.index,
      role: record.role,
      preview: record.text.length > 180 ? `${record.text.slice(0, 177)}…` : record.text
    }));

    const requested = Array.isArray(options.selectedIndices)
      ? new Set(options.selectedIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < records.length))
      : null;
    const selectedRecords = requested
      ? records.filter((record) => requested.has(record.index))
      : records;

    if (!selectedRecords.length) {
      return { ok: false, error: 'Select at least one message.' };
    }

    const response = {
      ok: true,
      title,
      messages,
      messageCount: records.length,
      selectedCount: selectedRecords.length
    };

    if (!options.includeContent) return response;

    const labels = {
      user: 'User',
      assistant: 'ChatGPT',
      system: 'System',
      tool: 'Tool',
      conversation: 'Conversation',
      unknown: 'Message'
    };
    const format = ['markdown', 'text', 'json'].includes(options.format) ? options.format : 'markdown';
    const exportedAt = new Date().toISOString();
    const source = location.href;
    let content;
    let extension;
    let mimeType;

    if (format === 'json') {
      content = JSON.stringify({
        title,
        exportedAt,
        source,
        messageCount: records.length,
        selectedCount: selectedRecords.length,
        messages: selectedRecords
      }, null, 2);
      extension = 'json';
      mimeType = 'application/json';
    } else if (format === 'text') {
      const parts = [
        title,
        '',
        `Exported: ${exportedAt}`,
        `Source: ${source}`,
        `Messages: ${selectedRecords.length} of ${records.length}`,
        ''
      ];
      for (const record of selectedRecords) {
        parts.push(`[${labels[record.role] || labels.unknown}]`, record.text, '', '---', '');
      }
      content = parts.join('\n');
      extension = 'txt';
      mimeType = 'text/plain';
    } else {
      const parts = [
        `# ${title}`,
        '',
        `> Exported: ${exportedAt}`,
        `> Source: ${source}`,
        `> Messages: ${selectedRecords.length} of ${records.length}`,
        ''
      ];
      for (const record of selectedRecords) {
        parts.push(`## ${labels[record.role] || labels.unknown}`, '', record.text, '', '---', '');
      }
      content = parts.join('\n');
      extension = 'md';
      mimeType = 'text/markdown';
    }

    const safe = (title || 'chatgpt-thread')
      .normalize('NFKC')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'chatgpt-thread';

    const date = new Date().toISOString().slice(0, 10);
    const selectionSuffix = selectedRecords.length === records.length ? '' : '_selection';
    return {
      ...response,
      format,
      filename: `${date}_${safe}${selectionSuffix}.${extension}`,
      mimeType,
      content
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function toDataUrl(text, mimeType) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return `data:${mimeType};charset=utf-8;base64,${btoa(binary)}`;
}
