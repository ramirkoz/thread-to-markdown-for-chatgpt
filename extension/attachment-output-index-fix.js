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

    await chrome.scripting.executeScript({
      target: { tabId },
      func: bridgeAssistantOutputControls,
      args: [selectedIndices]
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
      ? { ...descriptor, targetMessageIndex: mappedIndex }
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

function bridgeAssistantOutputControls(selectedIndices) {
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const supportedFile = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)$/iu;
  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanFilename = (value) => cleanText(value)
    .replace(/\\([_*`~[\]()])/g, '$1')
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

  const targetSelector = [
    '[data-thread-export-download-button="true"]',
    '[data-thread-export-exact-proxy="true"]',
    '[data-thread-export-proxy="true"]',
    '[data-thread-export-filename]'
  ].join(',');
  const targets = [];
  const seenTargets = new Set();

  for (const element of main.querySelectorAll(targetSelector)) {
    const filename = cleanFilename(
      element.getAttribute('data-thread-export-filename') ||
      element.getAttribute('data-thread-export-file-card') ||
      element.getAttribute('data-thread-export-filename-label') ||
      ''
    );
    const key = normalize(filename);
    if (!filename || !key || !supportedFile.test(filename) || seenTargets.has(key)) continue;
    seenTargets.add(key);
    targets.push({ filename, key, element });
  }

  const destinationRoots = roots.filter((root, index) => !selected || selected.has(index));
  let bridges = 0;

  for (const target of targets) {
    const stem = cleanFilename(target.filename.replace(/\.[^.]+$/u, '')) || target.filename;
    for (const root of destinationRoots) {
      const existing = [...root.querySelectorAll('[data-thread-export-index-bridge="true"]')]
        .find((element) => normalize(element.getAttribute('data-thread-export-filename')) === target.key);
      if (existing) continue;

      const bridge = document.createElement('button');
      bridge.type = 'button';
      bridge.setAttribute('aria-label', stem);
      bridge.setAttribute('data-thread-export-filename', target.filename);
      bridge.setAttribute('data-thread-export-index-bridge', 'true');
      bridge.style.cssText = [
        'position:absolute', 'width:1px', 'height:1px', 'padding:0', 'margin:0',
        'opacity:0', 'overflow:hidden', 'pointer-events:none', 'clip-path:inset(50%)'
      ].join(';');
      bridge.addEventListener('click', () => {
        if (!target.element?.isConnected) return;
        try {
          target.element.scrollIntoView?.({ block: 'center', behavior: 'auto' });
          target.element.click?.();
        } catch (_) {
          try {
            target.element.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window
            }));
          } catch (_) {}
        }
      });
      root.appendChild(bridge);
      bridges += 1;
    }
  }

  return { bridges, targets: targets.length };
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
      '[data-thread-export-filename]:not([data-thread-export-index-bridge="true"]), [data-thread-export-file-card], [data-thread-export-filename-label]'
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
