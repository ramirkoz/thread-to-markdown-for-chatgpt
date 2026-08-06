'use strict';

const attachmentFixBaseExportThread = self.exportThread;
const attachmentFixPrepareThread = self.prepareThread;

if (
  typeof attachmentFixBaseExportThread !== 'function' ||
  typeof attachmentFixPrepareThread !== 'function' ||
  typeof collectPortableAssets !== 'function' ||
  typeof buildPortablePackage !== 'function' ||
  typeof bytesToDataUrl !== 'function'
) {
  throw new Error('Attachment export fix dependencies were not initialized.');
}

self.exportThread = async function exportThreadWithAttachmentCards(
  tabId,
  selectedIndices,
  requestedFormat
) {
  if (requestedFormat !== 'zip') {
    return attachmentFixBaseExportThread(tabId, selectedIndices, requestedFormat);
  }

  const jsonResult = await attachmentFixPrepareThread(tabId, selectedIndices, 'json');
  const payload = JSON.parse(jsonResult.content);

  const baseRuns = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectPortableAssets,
    args: [selectedIndices]
  });
  const baseAssets = Array.isArray(baseRuns?.[0]?.result?.assets)
    ? baseRuns[0].result.assets
    : [];

  const usedBytes = baseAssets.reduce(
    (sum, asset) => sum + (asset?.included ? Number(asset.size || 0) : 0),
    0
  );
  const usedSlots = baseAssets.filter((asset) => asset?.type !== 'notice').length;
  const remainingBytes = Math.max(0, 16 * 1024 * 1024 - usedBytes);
  const remainingSlots = Math.max(0, 40 - usedSlots);

  let supplementalAssets = [];
  if (remainingBytes > 0 && remainingSlots > 0) {
    const supplementalRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectFileCardAttachments,
      args: [selectedIndices, remainingBytes, remainingSlots]
    });
    supplementalAssets = Array.isArray(supplementalRuns?.[0]?.result?.assets)
      ? supplementalRuns[0].result.assets
      : [];
  }

  const capturedAssets = mergeCapturedAssets(baseAssets, supplementalAssets);
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

function mergeCapturedAssets(baseAssets, supplementalAssets) {
  const merged = [...baseAssets];
  const seen = new Set();

  const keysFor = (asset) => [asset?.sourceUrl, asset?.label, asset?.filename]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  for (const asset of baseAssets) {
    for (const key of keysFor(asset)) seen.add(key);
  }

  for (const asset of supplementalAssets) {
    const keys = keysFor(asset);
    if (keys.some((key) => seen.has(key))) continue;
    merged.push(asset);
    for (const key of keys) seen.add(key);
  }

  return merged;
}

async function collectFileCardAttachments(selectedIndices, maxTotalBytes, maxAssets) {
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

  const labelFor = (element) => cleanText(
    element.getAttribute('download') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.innerText ||
    element.textContent ||
    ''
  );

  const firstReusableUrl = (element) => {
    const nodes = [
      element,
      element.querySelector?.(
        'a[href], a[data-href], a[data-url], [role="link"][data-href], [role="link"][data-url], button[data-href], button[data-url]'
      )
    ].filter(Boolean);

    for (const node of nodes) {
      const value = node.href ||
        node.getAttribute?.('href') ||
        node.getAttribute?.('data-href') ||
        node.getAttribute?.('data-url') ||
        node.getAttribute?.('data-download-url') ||
        node.getAttribute?.('formaction') ||
        '';
      if (/^(?:https?:|blob:|data:)/i.test(value)) return value;
    }
    return '';
  };

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
      'text/markdown': 'md',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    return types[String(mimeType || '').toLowerCase()] || 'bin';
  };

  const sanitizeFilename = (value, fallback) => cleanText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;

  const filenameFromUrl = (url) => {
    try {
      const parsed = new URL(url, location.href);
      return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    } catch (_) {
      return '';
    }
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed.'));
    reader.readAsDataURL(blob);
  });

  const roots = [];
  const seenRoots = new Set();
  const main = document.querySelector('main') || document.body;
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

  const candidates = [];
  const seen = new Set();
  const selector = [
    'button',
    '[role="button"]',
    '[data-testid*="file"]',
    '[data-testid*="attachment"]',
    '[data-testid*="download"]'
  ].join(',');

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;

    for (const element of root.querySelectorAll(selector)) {
      const label = labelFor(element);
      const filenameMatch = label.match(filenamePattern);
      if (!filenameMatch) continue;

      const url = firstReusableUrl(element);
      const key = `${url || ''}|${filenameMatch[0]}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ element, label, filename: filenameMatch[0], url, messageIndex });
    }
  });

  const assets = [];
  for (const candidate of candidates.slice(0, assetLimit)) {
    let filename = sanitizeFilename(
      candidate.element.getAttribute('download') ||
      filenameFromUrl(candidate.url) ||
      candidate.filename,
      'attachment.bin'
    );

    if (!candidate.url) {
      assets.push({
        messageIndex: candidate.messageIndex,
        type: 'attachment',
        label: candidate.label || candidate.filename,
        filename,
        sourceUrl: '',
        included: false,
        reason: 'The file card was detected, but ChatGPT did not expose reusable file bytes.'
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

      if (!/\.[a-z0-9]{1,8}$/i.test(filename)) {
        filename = `${filename}.${extensionForMime(blob.type)}`;
      }
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
      reason: `${candidates.length - assetLimit} additional file cards were omitted because the package limit is 40 assets.`
    });
  }

  return { assets };
}
