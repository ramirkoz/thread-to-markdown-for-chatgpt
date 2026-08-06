'use strict';

const outputIndexBaseExportThread = self.exportThread;
const outputIndexBaseDescriptors = mainWorldUnresolvedDescriptors;
let outputIndexMap = new Map();

if (
  typeof outputIndexBaseExportThread !== 'function' ||
  typeof outputIndexBaseDescriptors !== 'function' ||
  typeof annotateAssistantOutputCards !== 'function'
) {
  throw new Error('Generated-file index mapping dependencies were not initialized.');
}

self.exportThread = async function exportThreadWithOutputIndexMapping(
  tabId,
  selectedIndices,
  requestedFormat
) {
  outputIndexMap = new Map();

  if (requestedFormat === 'zip') {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: annotateAssistantOutputCards,
      args: [null]
    });

    const runs = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectAssistantOutputMessageIndices
    });
    const entries = Array.isArray(runs?.[0]?.result?.entries)
      ? runs[0].result.entries
      : [];

    for (const entry of entries) {
      const key = normalizeOutputIndexFilename(entry?.filename);
      const messageIndex = Number(entry?.messageIndex);
      if (!key || !Number.isInteger(messageIndex) || outputIndexMap.has(key)) continue;
      outputIndexMap.set(key, messageIndex);
    }
  }

  return outputIndexBaseExportThread(tabId, selectedIndices, requestedFormat);
};

mainWorldUnresolvedDescriptors = function mainWorldDescriptorsWithOutputIndices(assets) {
  return outputIndexBaseDescriptors(assets).map((descriptor) => {
    const keys = [descriptor?.filename, descriptor?.label]
      .map(normalizeOutputIndexFilename)
      .filter(Boolean);
    const mappedIndex = keys
      .map((key) => outputIndexMap.get(key))
      .find(Number.isInteger);

    return Number.isInteger(mappedIndex)
      ? { ...descriptor, messageIndex: mappedIndex }
      : descriptor;
  });
};

function normalizeOutputIndexFilename(value) {
  return String(value || '')
    .replace(/\\([_*`~[\]()])/g, '$1')
    .trim()
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^_+/, '')
    .normalize('NFKC')
    .toLocaleLowerCase();
}

function collectAssistantOutputMessageIndices() {
  const supportedExtension = '(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)';
  const filenamePattern = new RegExp(
    `[^\\n<>:"/\\\\|?*]{1,180}\\.${supportedExtension}`,
    'giu'
  );
  const fullLinePattern = new RegExp(`\\.${supportedExtension}$`, 'iu');
  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  const cleanFilename = (value) => cleanText(value)
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const normalize = (value) => cleanFilename(value)
    .replace(/^_+/, '')
    .normalize('NFKC')
    .toLocaleLowerCase();

  const main = document.querySelector('main') || document.body;
  const roots = [];
  const seenRoots = new Set();

  for (const roleNode of main.querySelectorAll('[data-message-author-role]')) {
    const root = roleNode.closest(
      'article, [data-testid^="conversation-turn-"], [data-message-id], [class*="group/conversation-turn"]'
    ) || roleNode;
    if (seenRoots.has(root)) continue;
    seenRoots.add(root);
    roots.push(root);
  }

  if (!roots.length) {
    for (const root of main.querySelectorAll(
      '[data-testid^="conversation-turn-"], [data-message-id], article, [class*="group/conversation-turn"]'
    )) {
      if (seenRoots.has(root)) continue;
      seenRoots.add(root);
      roots.push(root);
    }
  }

  const entries = [];
  const seen = new Set();

  roots.forEach((root, messageIndex) => {
    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    const candidates = [];
    for (const element of root.querySelectorAll(
      '[data-thread-export-filename], [data-thread-export-file-card], [data-thread-export-filename-label]'
    )) {
      candidates.push(
        element.getAttribute('data-thread-export-filename'),
        element.getAttribute('data-thread-export-file-card'),
        element.getAttribute('data-thread-export-filename-label')
      );
    }

    const raw = String(root.innerText || root.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n');
    for (const sourceLine of raw.split('\n')) {
      const line = cleanText(sourceLine);
      if (!line) continue;
      if (line.length <= 180 && fullLinePattern.test(line)) candidates.push(line);
      for (const match of line.matchAll(filenamePattern)) candidates.push(match[0]);
    }

    for (const candidate of candidates) {
      const filename = cleanFilename(candidate);
      const key = normalize(filename);
      const identity = `${messageIndex}|${key}`;
      if (!filename || !key || seen.has(identity) || !fullLinePattern.test(filename)) continue;
      seen.add(identity);
      entries.push({ filename, messageIndex });
    }
  });

  return { entries };
}
