'use strict';

const unicodeOutputBaseReadThread = self.readThread;
const unicodeOutputBaseDescriptors = mainWorldUnresolvedDescriptors;
let unicodeOutputPayload = null;

if (
  typeof unicodeOutputBaseReadThread !== 'function' ||
  typeof unicodeOutputBaseDescriptors !== 'function'
) {
  throw new Error('Unicode output attachment dependencies were not initialized.');
}

self.readThread = async function readThreadWithUnicodeOutputCapture(tabId, options = {}) {
  const result = await unicodeOutputBaseReadThread(tabId, options);

  if (
    result?.ok &&
    options?.includeContent &&
    options?.format === 'json' &&
    typeof result.content === 'string'
  ) {
    try {
      unicodeOutputPayload = JSON.parse(result.content);
    } catch (_) {
      unicodeOutputPayload = null;
    }
  }

  return result;
};

mainWorldUnresolvedDescriptors = function mainWorldDescriptorsWithAssistantOutputs(assets) {
  const descriptors = unicodeOutputBaseDescriptors(assets);
  const known = new Set();

  const remember = (messageIndex, value) => {
    const normalized = normalizeUnicodeOutputFilename(value);
    if (normalized) known.add(`${Number(messageIndex)}|${normalized}`);
  };

  for (const asset of Array.isArray(assets) ? assets : []) {
    if (asset?.type !== 'attachment') continue;
    remember(asset.messageIndex, asset.filename);
    remember(asset.messageIndex, asset.label);
  }

  for (const descriptor of descriptors) {
    remember(descriptor.messageIndex, descriptor.filename);
    remember(descriptor.messageIndex, descriptor.label);
  }

  const messages = Array.isArray(unicodeOutputPayload?.messages)
    ? unicodeOutputPayload.messages
    : [];

  messages.forEach((message, arrayIndex) => {
    if (String(message?.role || '').toLowerCase() !== 'assistant') return;

    const messageIndex = Number.isInteger(message?.index)
      ? message.index
      : arrayIndex;
    const content = [message?.text, message?.markdown]
      .filter((value) => typeof value === 'string')
      .join('\n');

    for (const filename of extractAssistantOutputFilenames(content)) {
      const normalized = normalizeUnicodeOutputFilename(filename);
      const key = `${messageIndex}|${normalized}`;
      if (!normalized || known.has(key)) continue;

      known.add(key);
      descriptors.push({
        messageIndex,
        label: filename,
        filename
      });
    }
  });

  return descriptors;
};

function extractAssistantOutputFilenames(value) {
  const supportedExtension = '(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)';
  const results = [];
  const seen = new Set();
  const add = (candidate) => {
    const cleaned = cleanUnicodeOutputCandidate(candidate);
    const normalized = normalizeUnicodeOutputFilename(cleaned);
    if (!cleaned || !normalized || seen.has(normalized)) return;
    seen.add(normalized);
    results.push(cleaned);
  };

  const text = String(value || '')
    .replace(/\\([_*`~[\]()])/g, '$1')
    .replace(/\r\n?/g, '\n');

  const markdownLink = new RegExp(`\\[([^\\]\\n]+\\.${supportedExtension})\\]\\([^\\n)]*\\)`, 'giu');
  for (const match of text.matchAll(markdownLink)) add(match[1]);

  const compactFilename = new RegExp(`[^\\s<>:"/\\\\|?*()\\[\\]{}'“”«»]+\\.${supportedExtension}`, 'giu');

  for (const sourceLine of text.split('\n')) {
    const line = sourceLine
      .replace(/^\s*(?:[-*+>]\s+|#{1,6}\s+|\d+[.)]\s+)/, '')
      .trim();
    if (!line) continue;

    const fullLine = line
      .replace(/^`+|`+$/g, '')
      .replace(/^\*+|\*+$/g, '')
      .trim();
    const fullLinePattern = new RegExp(`\\.${supportedExtension}$`, 'iu');
    const prefix = fullLine.replace(new RegExp(`\\.${supportedExtension}$`, 'iu'), '');

    if (
      fullLine.length <= 180 &&
      fullLinePattern.test(fullLine) &&
      !/[.!?]\s/u.test(prefix)
    ) {
      add(fullLine);
    }

    for (const match of line.matchAll(compactFilename)) add(match[0]);
  }

  return results;
}

function cleanUnicodeOutputCandidate(value) {
  return String(value || '')
    .trim()
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function normalizeUnicodeOutputFilename(value) {
  return cleanUnicodeOutputCandidate(value)
    .replace(/^_+/, '')
    .normalize('NFKC')
    .toLocaleLowerCase();
}
