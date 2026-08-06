'use strict';

const relativeAttachmentBaseExportThread = self.exportThread;
const relativeAttachmentPrepareThread = self.prepareThread;

if (
  typeof relativeAttachmentBaseExportThread !== 'function' ||
  typeof relativeAttachmentPrepareThread !== 'function' ||
  typeof collectPortableAssets !== 'function' ||
  typeof collectFileCardAttachments !== 'function' ||
  typeof mergeCapturedAssets !== 'function' ||
  typeof buildPortablePackage !== 'function' ||
  typeof bytesToDataUrl !== 'function'
) {
  throw new Error('Relative attachment export dependencies were not initialized.');
}

self.exportThread = async function exportThreadWithRelativeAttachments(
  tabId,
  selectedIndices,
  requestedFormat
) {
  if (requestedFormat !== 'zip') {
    return relativeAttachmentBaseExportThread(tabId, selectedIndices, requestedFormat);
  }

  const jsonResult = await relativeAttachmentPrepareThread(tabId, selectedIndices, 'json');
  const payload = JSON.parse(jsonResult.content);

  const baseRuns = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectPortableAssets,
    args: [selectedIndices]
  });
  const baseAssets = Array.isArray(baseRuns?.[0]?.result?.assets)
    ? baseRuns[0].result.assets
    : [];

  const baseBytes = includedBytes(baseAssets);
  const baseSlots = usedAssetSlots(baseAssets);
  const firstRemainingBytes = Math.max(0, 16 * 1024 * 1024 - baseBytes);
  const firstRemainingSlots = Math.max(0, 40 - baseSlots);

  let cardAssets = [];
  if (firstRemainingBytes > 0 && firstRemainingSlots > 0) {
    const cardRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectFileCardAttachments,
      args: [selectedIndices, firstRemainingBytes, firstRemainingSlots]
    });
    cardAssets = Array.isArray(cardRuns?.[0]?.result?.assets)
      ? cardRuns[0].result.assets
      : [];
  }

  const firstMerge = mergeCapturedAssets(baseAssets, cardAssets);
  const secondRemainingBytes = Math.max(0, 16 * 1024 * 1024 - includedBytes(firstMerge));
  const secondRemainingSlots = Math.max(0, 40 - usedAssetSlots(firstMerge));

  let relativeAssets = [];
  if (secondRemainingBytes > 0 && secondRemainingSlots > 0) {
    const relativeRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectRelativeAttachmentCards,
      args: [selectedIndices, secondRemainingBytes, secondRemainingSlots]
    });
    relativeAssets = Array.isArray(relativeRuns?.[0]?.result?.assets)
      ? relativeRuns[0].result.assets
      : [];
  }

  const capturedAssets = mergeCapturedAssets(firstMerge, relativeAssets);
  const packageResult = buildPortablePackage(payload, capturedAssets, jsonResult.filename);

  const downloadId = await chrome.downloads.download({
    url: bytesToDataUrl(packageResult.bytes, 'application/zip'),
    filename: packageResult.filename,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#166534' });
  await chrome.action.setBadgeText({ tabId, text: '✓' });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2500);

  return {
    filename: packageResult.filename,
    messageCount: Number(payload.selectedCount || payload.messages?.length || 0),
    format: 'zip',
    includedAssets: packageResult.includedAssets,
    skippedAssets: packageResult.skippedAssets,
    downloadId
  };
};

function includedBytes(assets) {
  return (Array.isArray(assets) ? assets : []).reduce(
    (sum, asset) => sum + (asset?.included ? Number(asset.size || 0) : 0),
    0
  );
}

function usedAssetSlots(assets) {
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset?.type !== 'notice')
    .length;
}

async function collectRelativeAttachmentCards(selectedIndices, maxTotalBytes, maxAssets) {
  const MAX_ASSET_BYTES = 6 * 1024 * 1024;
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const byteLimit = Math.max(0, Number(maxTotalBytes || 0));
  const assetLimit = Math.max(0, Number(maxAssets || 0));
  let totalBytes = 0;

  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const filenamePattern = /\b[^\s<>:"/\\|?*]+\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)\b/i;

  const normalizeUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw || /^(?:javascript|about):/i.test(raw)) return '';
    try {
      const parsed = new URL(raw, location.href);
      return /^(?:https?:|blob:|data:)/i.test(parsed.href) ? parsed.href : '';
    } catch (_) {
      return '';
    }
  };

  const urlFromNode = (node) => {
    if (!node) return '';
    const direct = [
      node.href,
      node.src,
      node.getAttribute?.('href'),
      node.getAttribute?.('src'),
      node.getAttribute?.('data-href'),
      node.getAttribute?.('data-url'),
      node.getAttribute?.('data-download-url'),
      node.getAttribute?.('formaction')
    ];
    for (const value of direct) {
      const normalized = normalizeUrl(value);
      if (normalized) return normalized;
    }
    for (const attribute of [...(node.attributes || [])]) {
      if (!/(?:href|url|download|source|file)/i.test(attribute.name)) continue;
      const normalized = normalizeUrl(attribute.value);
      if (normalized) return normalized;
    }
    return '';
  };

  const firstReusableUrl = (element) => {
    const nodes = [element];
    nodes.push(...element.querySelectorAll?.(
      'a[href], [href], [src], [data-href], [data-url], [data-download-url], [formaction]'
    ) || []);
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1) {
      nodes.push(parent);
      parent = parent.parentElement;
    }
    for (const node of nodes) {
      const value = urlFromNode(node);
      if (value) return value;
    }
    return '';
  };

  const labelFor = (element) => cleanText(
    element.getAttribute('download') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.innerText ||
    element.textContent ||
    ''
  ).slice(0, 300);

  const sanitizeFilename = (value, fallback) => cleanText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;

  const extensionForMime = (mimeType) => {
    const types = {
      'application/pdf': 'pdf',
      'application/json': 'json',
      'application/zip': 'zip',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'text/markdown': 'md'
    };
    return types[String(mimeType || '').toLowerCase()] || 'bin';
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed.'));
    reader.readAsDataURL(blob);
  });

  const main = document.querySelector('main') || document.body;
  const roots = [];
  const seenRoots = new Set();
  const roleNodes = [...main.querySelectorAll('[data-message-author-role]')];

  for (const roleNode of roleNodes) {
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

  const selector = [
    'a[href]',
    '[role="link"]',
    'button',
    '[role="button"]',
    '[data-href]',
    '[data-url]',
    '[data-download-url]',
    '[data-file-id]',
    '[data-attachment-id]',
    '[data-testid*="file"]',
    '[data-testid*="attachment"]',
    '[data-testid*="download"]',
    '[class*="file"]',
    '[class*="attachment"]',
    '[class*="download"]'
  ].join(',');

  const candidates = [];
  const seen = new Set();

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;

    for (const element of root.querySelectorAll(selector)) {
      const label = labelFor(element);
      const match = label.match(filenamePattern);
      if (!match) continue;
      const filename = match[0];
      const url = firstReusableUrl(element);
      const key = `${messageIndex}|${filename}|${url}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ messageIndex, label, filename, url });
    }
  });

  const assets = [];
  for (const candidate of candidates.slice(0, assetLimit)) {
    let filename = sanitizeFilename(candidate.filename, 'attachment.bin');

    if (!candidate.url) {
      assets.push({
        messageIndex: candidate.messageIndex,
        type: 'attachment',
        label: candidate.label || candidate.filename,
        filename,
        sourceUrl: '',
        included: false,
        reason: 'The attachment card was detected, but ChatGPT did not expose reusable file bytes.'
      });
      continue;
    }

    try {
      const response = await fetch(candidate.url, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > MAX_ASSET_BYTES) throw new Error('File exceeds the 6 MB package limit.');
      const blob = await response.blob();
      if (blob.size > MAX_ASSET_BYTES) throw new Error('File exceeds the 6 MB package limit.');
      if (totalBytes + blob.size > byteLimit) throw new Error('Package asset limit of 16 MB was reached.');
      if (!/\.[a-z0-9]{1,8}$/i.test(filename)) filename = `${filename}.${extensionForMime(blob.type)}`;
      totalBytes += blob.size;
      assets.push({
        messageIndex: candidate.messageIndex,
        type: 'attachment',
        label: candidate.label || candidate.filename,
        filename,
        sourceUrl: candidate.url,
        mimeType: blob.type || 'application/octet-stream',
        size: blob.size,
        dataUrl: await blobToDataUrl(blob),
        included: true
      });
    } catch (error) {
      assets.push({
        messageIndex: candidate.messageIndex,
        type: 'attachment',
        label: candidate.label || candidate.filename,
        filename,
        sourceUrl: candidate.url,
        included: false,
        reason: String(error?.message || error)
      });
    }
  }

  if (candidates.length > assetLimit) {
    assets.push({
      messageIndex: -1,
      type: 'notice',
      label: '',
      filename: '',
      sourceUrl: '',
      included: false,
      reason: `${candidates.length - assetLimit} additional attachment cards were omitted because the package limit is 40 assets.`
    });
  }

  return { assets };
}
