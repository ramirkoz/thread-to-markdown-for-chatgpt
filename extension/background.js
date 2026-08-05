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

    const escapeInline = (value) => String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/([*_\[\]<>])/g, '\\$1');

    const escapeMultiline = (value) => cleanText(value)
      .split('\n')
      .map((line) => escapeInline(line))
      .join('\n');

    const normalizeMarkdown = (value) => String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const inlineCode = (value) => {
      const text = String(value || '').replace(/\n+/g, ' ').trim();
      if (!text) return '';
      const runs = text.match(/`+/g) || [];
      const fence = '`'.repeat(Math.max(1, ...runs.map((run) => run.length + 1)));
      const padded = text.startsWith('`') || text.endsWith('`') ? ` ${text} ` : text;
      return `${fence}${padded}${fence}`;
    };

    const codeFence = (value, language = '') => {
      const code = String(value || '').replace(/\r\n?/g, '\n').replace(/\n+$/g, '');
      const runs = code.match(/`{3,}/g) || [];
      const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
      return `${fence}${language}\n${code}\n${fence}\n\n`;
    };

    const detectLanguage = (pre) => {
      const code = pre.querySelector('code');
      const candidates = [
        code?.dataset?.language,
        pre.dataset?.language,
        code?.className,
        pre.className
      ].filter(Boolean).join(' ');
      const match = candidates.match(/(?:language-|lang-)([a-z0-9_+.-]+)/i);
      return match ? match[1].toLowerCase() : '';
    };

    const directChildren = (element, tagName) => [...element.children]
      .filter((child) => child.tagName === tagName);

    const accessibleLabel = (element) => cleanText(
      element.innerText ||
      element.textContent ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.getAttribute('download') ||
      ''
    );

    const safeHref = (element) => {
      const href = element.href ||
        element.getAttribute('href') ||
        element.getAttribute('data-href') ||
        element.getAttribute('data-url') ||
        '';
      return /^(javascript|data):/i.test(href) ? '' : href;
    };

    const isUiControl = (element) => {
      const descriptor = cleanText([
        element.getAttribute('data-testid'),
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent
      ].filter(Boolean).join(' ')).toLowerCase();

      if (!descriptor) return false;
      if (/(download|attachment|file|source|завантаж|вкладенн|файл|джерел)/i.test(descriptor)) return false;
      return /(copy|copied|read aloud|good response|bad response|regenerate|retry|more actions|share|edit message|stop generating|копіювати|скопійовано|озвучити|подобається|не подобається|перегенерувати|повторити|інші дії|поділитися|редагувати|зупинити)/i.test(descriptor);
    };

    const tableToMarkdown = (table, nodeToMarkdown) => {
      const rowNodes = [...table.querySelectorAll('tr')];
      const rows = rowNodes.map((row) => [...row.children]
        .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
        .map((cell) => normalizeMarkdown(nodeToMarkdown(cell, { inline: true }))
          .replace(/\n+/g, '<br>')
          .replace(/\|/g, '\\|')
          .trim()));

      const validRows = rows.filter((row) => row.length);
      if (!validRows.length) return '';

      const columnCount = Math.max(...validRows.map((row) => row.length));
      const padded = validRows.map((row) => [
        ...row,
        ...Array(Math.max(0, columnCount - row.length)).fill('')
      ]);
      const header = padded[0];
      const body = padded.slice(1);
      const lines = [
        `| ${header.join(' | ')} |`,
        `| ${Array(columnCount).fill('---').join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`)
      ];
      return `${lines.join('\n')}\n\n`;
    };

    let nodeToMarkdown;

    const listToMarkdown = (list, depth = 0) => {
      const ordered = list.tagName === 'OL';
      const start = ordered ? Number.parseInt(list.getAttribute('start') || '1', 10) || 1 : 1;
      const items = directChildren(list, 'LI');
      const lines = [];
      let visibleIndex = 0;

      items.forEach((item) => {
        const nestedLists = [...item.children]
          .filter((child) => child.tagName === 'UL' || child.tagName === 'OL');
        const clone = item.cloneNode(true);
        [...clone.querySelectorAll('ul, ol')].forEach((nested) => nested.remove());

        const raw = normalizeMarkdown(nodeToMarkdown(clone, { inline: true }))
          .replace(/\n{2,}/g, '\n')
          .trim();
        const indent = '  '.repeat(depth);

        if (raw) {
          const marker = ordered ? `${start + visibleIndex}.` : '-';
          const continuation = `${indent}  `;
          const content = raw
            .split('\n')
            .map((line, lineIndex) => lineIndex === 0 ? line : `${continuation}${line}`)
            .join('\n');
          lines.push(`${indent}${marker} ${content}`.trimEnd());
          visibleIndex += 1;
        }

        nestedLists.forEach((nested) => {
          const nestedDepth = raw ? depth + 1 : depth;
          const nestedMarkdown = listToMarkdown(nested, nestedDepth).trimEnd();
          if (nestedMarkdown) lines.push(nestedMarkdown);
        });
      });

      return lines.length ? `${lines.join('\n')}\n\n` : '';
    };

    const inlineTags = new Set([
      'A', 'ABBR', 'B', 'BUTTON', 'CITE', 'CODE', 'DEL', 'EM', 'I', 'KBD',
      'LABEL', 'MARK', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME'
    ]);

    const shouldInsertSpace = (previousValue, nextValue, previousNode, nextNode) => {
      if (!previousValue || !nextValue) return false;
      if (/\s$/.test(previousValue) || /^\s/.test(nextValue)) return false;
      if (/^[,.;:!?%)\]}]/.test(nextValue) || /[(\[{]$/.test(previousValue)) return false;
      if (previousNode?.nodeType !== Node.ELEMENT_NODE || nextNode?.nodeType !== Node.ELEMENT_NODE) return false;
      return inlineTags.has(previousNode.tagName) && inlineTags.has(nextNode.tagName);
    };

    const childMarkdown = (element, context) => {
      const parts = [];
      let previousNode = null;
      let previousValue = '';

      for (const child of element.childNodes) {
        const value = nodeToMarkdown(child, context);
        if (!value) continue;
        if (shouldInsertSpace(previousValue, value, previousNode, child)) parts.push(' ');
        parts.push(value);
        previousNode = child;
        previousValue = value;
      }

      return parts.join('');
    };

    nodeToMarkdown = (node, context = {}) => {
      if (!node) return '';

      if (node.nodeType === Node.TEXT_NODE) {
        const text = String(node.nodeValue || '');
        if (!text.trim()) return /\s/.test(text) ? ' ' : '';
        return escapeInline(text.replace(/\s+/g, ' '));
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const element = node;
      const tag = element.tagName;
      const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT']);
      if (skipTags.has(tag) || element.getAttribute('aria-hidden') === 'true') return '';
      if (tag === 'SVG') return '';

      if (
        element.classList?.contains('whitespace-pre-wrap') &&
        !element.querySelector('pre, table, ul, ol')
      ) {
        return `${escapeMultiline(element.innerText || element.textContent)}\n\n`;
      }

      const children = () => childMarkdown(element, context);

      if (tag === 'BR') return '\n';
      if (tag === 'HR') return '\n\n---\n\n';
      if (tag === 'PRE') {
        const code = element.querySelector('code');
        return codeFence(code?.textContent || element.textContent || '', detectLanguage(element));
      }
      if (tag === 'CODE') return inlineCode(element.textContent || '');
      if (tag === 'TABLE') return tableToMarkdown(element, nodeToMarkdown);
      if (tag === 'UL' || tag === 'OL') return listToMarkdown(element, context.listDepth || 0);
      if (tag === 'LI') return children();

      if (/^H[1-6]$/.test(tag)) {
        const level = Number(tag.slice(1));
        const value = normalizeMarkdown(children());
        return value ? `${'#'.repeat(level)} ${value}\n\n` : '';
      }

      if (tag === 'BLOCKQUOTE') {
        const value = normalizeMarkdown(children());
        if (!value) return '';
        const quoted = value
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
        return `${quoted}\n\n`;
      }

      if (tag === 'STRONG' || tag === 'B') {
        const value = normalizeMarkdown(children());
        return value ? `**${value}**` : '';
      }
      if (tag === 'EM' || tag === 'I') {
        const value = normalizeMarkdown(children());
        return value ? `_${value}_` : '';
      }
      if (tag === 'DEL' || tag === 'S') {
        const value = normalizeMarkdown(children());
        return value ? `~~${value}~~` : '';
      }
      if (tag === 'A') {
        const href = safeHref(element);
        const label = normalizeMarkdown(children()) || escapeInline(accessibleLabel(element));
        if (!href) return label;
        const fallbackLabel = label || escapeInline(element.getAttribute('download') || href);
        return `[${fallbackLabel}](${href.replace(/\)/g, '%29')})`;
      }
      if (tag === 'BUTTON') {
        if (isUiControl(element)) return '';
        const nestedLink = element.querySelector('a[href], a[data-href], a[data-url]');
        if (nestedLink) return nodeToMarkdown(nestedLink, context);
        const label = normalizeMarkdown(children()) || escapeInline(accessibleLabel(element));
        const href = safeHref(element);
        return href && label ? `[${label}](${href.replace(/\)/g, '%29')})` : label;
      }
      if (tag === 'IMG') {
        const alt = cleanText(element.getAttribute('alt') || '');
        const src = element.currentSrc || element.src || '';
        return alt && src ? `![${escapeInline(alt)}](${src.replace(/\)/g, '%29')})` : '';
      }

      const value = children();
      const role = element.getAttribute('role');
      if (!value && (role === 'button' || role === 'link') && !isUiControl(element)) {
        const label = escapeInline(accessibleLabel(element));
        const href = safeHref(element);
        return href && label ? `[${label}](${href.replace(/\)/g, '%29')})` : label;
      }

      const blockTags = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'ASIDE', 'FIGURE', 'FIGCAPTION']);
      if (blockTags.has(tag) && !context.inline) {
        const normalized = normalizeMarkdown(value);
        return normalized ? `${normalized}\n\n` : '';
      }
      return value;
    };

    const title = cleanText(
      document.querySelector('main h1')?.innerText ||
      document.querySelector('h1')?.innerText ||
      document.title.replace(/\s*[-–|]\s*ChatGPT.*$/i, '') ||
      'ChatGPT conversation'
    );

    const main = document.querySelector('main') || document.body;
    const turns = [];
    const seen = new Set();

    const addTurn = (root, role) => {
      const body = root.querySelector(
        '.markdown, [class*="markdown"], [class*="prose"], [class*="whitespace-pre-wrap"]'
      ) || root;
      const text = cleanText(body.innerText || body.textContent);
      if (!text) return;
      const markdown = normalizeMarkdown(nodeToMarkdown(body)) || escapeMultiline(text);
      turns.push({ role, text, markdown });
    };

    const roleNodes = [...main.querySelectorAll('[data-message-author-role]')];
    for (const roleNode of roleNodes) {
      const root = roleNode.closest(
        'article, [data-testid^="conversation-turn-"], [data-message-id], [class*="group/conversation-turn"]'
      ) || roleNode;
      if (seen.has(root)) continue;
      seen.add(root);
      addTurn(root, roleNode.getAttribute('data-message-author-role') || 'unknown');
    }

    if (!turns.length) {
      const candidates = [...main.querySelectorAll(
        '[data-testid^="conversation-turn-"], [data-message-id], article, [class*="group/conversation-turn"]'
      )];
      candidates.forEach((root, index) => {
        if (seen.has(root)) return;
        seen.add(root);
        addTurn(root, index % 2 === 0 ? 'user' : 'assistant');
      });
    }

    if (!turns.length) {
      const text = cleanText(main.innerText || main.textContent);
      if (!text) return { ok: false, error: 'No text was found on this page.' };
      turns.push({ role: 'conversation', text, markdown: escapeMultiline(text) });
    }

    const records = turns.map((turn, index) => ({
      index,
      role: turn.role,
      text: turn.text,
      markdown: turn.markdown
    }));
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
        parts.push(`## ${labels[record.role] || labels.unknown}`, '', record.markdown, '', '---', '');
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
