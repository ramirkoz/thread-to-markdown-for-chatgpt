'use strict';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type !== 'inspect-thread' && type !== 'export-thread') return false;

  const task = type === 'inspect-thread'
    ? inspectThread(message.tabId)
    : exportThread(message.tabId, message.selectedIndices);

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
  const result = await readThread(tabId, { includeMarkdown: false });

  if (!result?.ok || !Array.isArray(result.messages) || !result.messages.length) {
    throw new Error(result?.error || 'The conversation could not be read.');
  }

  return {
    title: result.title,
    messageCount: result.messageCount,
    messages: result.messages
  };
}

async function exportThread(tabId, selectedIndices) {
  await validateChatGptTab(tabId);

  const normalizedSelection = Array.isArray(selectedIndices)
    ? [...new Set(selectedIndices.filter(Number.isInteger))]
    : null;

  if (normalizedSelection && normalizedSelection.length === 0) {
    throw new Error('Select at least one message.');
  }

  const result = await readThread(tabId, {
    includeMarkdown: true,
    selectedIndices: normalizedSelection
  });

  if (!result?.ok || !result.markdown || !result.filename) {
    throw new Error(result?.error || 'The conversation could not be read.');
  }

  const downloadId = await chrome.downloads.download({
    url: toDataUrl(result.markdown),
    filename: result.filename,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#166534' });
  await chrome.action.setBadgeText({ tabId, text: '✓' });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2500);

  return {
    filename: result.filename,
    messageCount: result.selectedCount,
    downloadId
  };
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

    const messages = turns.map((turn, index) => ({
      index,
      role: turn.role,
      preview: turn.text.length > 180 ? `${turn.text.slice(0, 177)}…` : turn.text
    }));

    const requested = Array.isArray(options.selectedIndices)
      ? new Set(options.selectedIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < turns.length))
      : null;
    const selectedTurns = requested
      ? turns.filter((turn, index) => requested.has(index))
      : turns;

    if (!selectedTurns.length) {
      return { ok: false, error: 'Select at least one message.' };
    }

    const response = {
      ok: true,
      title,
      messages,
      messageCount: turns.length,
      selectedCount: selectedTurns.length
    };

    if (!options.includeMarkdown) return response;

    const labels = {
      user: 'User',
      assistant: 'ChatGPT',
      system: 'System',
      tool: 'Tool',
      conversation: 'Conversation',
      unknown: 'Message'
    };

    const exportedAt = new Date().toISOString();
    const source = location.href;
    const parts = [
      `# ${title}`,
      '',
      `> Exported: ${exportedAt}`,
      `> Source: ${source}`,
      `> Messages: ${selectedTurns.length} of ${turns.length}`,
      ''
    ];

    for (const turn of selectedTurns) {
      parts.push(`## ${labels[turn.role] || labels.unknown}`, '', turn.text, '', '---', '');
    }

    const safe = (title || 'chatgpt-thread')
      .normalize('NFKC')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'chatgpt-thread';

    const date = new Date().toISOString().slice(0, 10);
    const selectionSuffix = selectedTurns.length === turns.length ? '' : '_selection';
    return {
      ...response,
      filename: `${date}_${safe}${selectionSuffix}.md`,
      markdown: parts.join('\n')
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function toDataUrl(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return `data:text/markdown;charset=utf-8;base64,${btoa(binary)}`;
}
