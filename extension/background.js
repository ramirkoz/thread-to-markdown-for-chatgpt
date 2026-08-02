'use strict';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'export-thread') return false;

  exportThread(message.tabId)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      console.error('Thread to Markdown:', error);
      sendResponse({ ok: false, error: String(error?.message || error) });
    });

  return true;
});

async function exportThread(tabId) {
  if (!Number.isInteger(tabId)) {
    throw new Error('No active tab was found.');
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(tab.url)) {
    throw new Error('Open a ChatGPT conversation first.');
  }

  const runs = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractThread
  });

  const result = runs?.[0]?.result;
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
    messageCount: result.messageCount,
    downloadId
  };
}

function extractThread() {
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
      ''
    ];

    for (const turn of turns) {
      parts.push(`## ${labels[turn.role] || labels.unknown}`, '', turn.text, '', '---', '');
    }

    const safe = (title || 'chatgpt-thread')
      .normalize('NFKC')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'chatgpt-thread';

    const date = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      filename: `${date}_${safe}.md`,
      markdown: parts.join('\n'),
      messageCount: turns.length
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
