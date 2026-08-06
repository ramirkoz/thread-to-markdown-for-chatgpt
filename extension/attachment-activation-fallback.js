'use strict';

const activationBaseExportThread = self.exportThread;
const activationPrepareThread = self.prepareThread;

if (
  typeof activationBaseExportThread !== 'function' ||
  typeof activationPrepareThread !== 'function' ||
  typeof collectPortableAssets !== 'function' ||
  typeof collectFileCardAttachments !== 'function' ||
  typeof collectRelativeAttachmentCards !== 'function' ||
  typeof mergeCapturedAssets !== 'function' ||
  typeof buildPortablePackage !== 'function' ||
  typeof bytesToDataUrl !== 'function'
) {
  throw new Error('Attachment activation fallback dependencies were not initialized.');
}

self.exportThread = async function exportThreadWithAttachmentActivation(
  tabId,
  selectedIndices,
  requestedFormat
) {
  if (requestedFormat !== 'zip') {
    return activationBaseExportThread(tabId, selectedIndices, requestedFormat);
  }

  const jsonResult = await activationPrepareThread(tabId, selectedIndices, 'json');
  const payload = JSON.parse(jsonResult.content);

  const baseRuns = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectPortableAssets,
    args: [selectedIndices]
  });
  const baseAssets = Array.isArray(baseRuns?.[0]?.result?.assets)
    ? baseRuns[0].result.assets
    : [];

  const baseBytes = activationIncludedBytes(baseAssets);
  const baseSlots = activationUsedSlots(baseAssets);

  let cardAssets = [];
  const cardBytes = Math.max(0, 16 * 1024 * 1024 - baseBytes);
  const cardSlots = Math.max(0, 40 - baseSlots);
  if (cardBytes > 0 && cardSlots > 0) {
    const cardRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectFileCardAttachments,
      args: [selectedIndices, cardBytes, cardSlots]
    });
    cardAssets = Array.isArray(cardRuns?.[0]?.result?.assets)
      ? cardRuns[0].result.assets
      : [];
  }

  const firstMerge = mergeCapturedAssets(baseAssets, cardAssets);
  const relativeBytes = Math.max(0, 16 * 1024 * 1024 - activationIncludedBytes(firstMerge));
  const relativeSlots = Math.max(0, 40 - activationUsedSlots(firstMerge));

  let relativeAssets = [];
  if (relativeBytes > 0 && relativeSlots > 0) {
    const relativeRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectRelativeAttachmentCards,
      args: [selectedIndices, relativeBytes, relativeSlots]
    });
    relativeAssets = Array.isArray(relativeRuns?.[0]?.result?.assets)
      ? relativeRuns[0].result.assets
      : [];
  }

  const secondMerge = mergeCapturedAssets(firstMerge, relativeAssets);
  const unresolved = secondMerge
    .filter((asset) => asset?.type === 'attachment' && asset?.included === false)
    .map((asset) => ({
      messageIndex: Number(asset.messageIndex),
      label: String(asset.label || ''),
      filename: String(asset.filename || '')
    }));

  let activatedAssets = [];
  if (unresolved.length) {
    const remainingBytes = Math.max(
      0,
      16 * 1024 * 1024 - activationIncludedBytes(secondMerge)
    );
    const activationRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectActivatedAttachmentCards,
      args: [
        selectedIndices,
        unresolved,
        remainingBytes,
        Math.min(40, unresolved.length)
      ]
    });
    activatedAssets = Array.isArray(activationRuns?.[0]?.result?.assets)
      ? activationRuns[0].result.assets
      : [];
  }

  const capturedAssets = mergeActivatedAssets(secondMerge, activatedAssets);
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

function activationIncludedBytes(assets) {
  return (Array.isArray(assets) ? assets : []).reduce(
    (sum, asset) => sum + (asset?.included ? Number(asset.size || 0) : 0),
    0
  );
}

function activationUsedSlots(assets) {
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset?.type !== 'notice')
    .length;
}

function mergeActivatedAssets(existingAssets, activatedAssets) {
  const merged = [...(Array.isArray(existingAssets) ? existingAssets : [])];
  const identity = (asset) => [
    Number(asset?.messageIndex),
    String(asset?.type || ''),
    String(asset?.filename || asset?.label || '').trim().toLowerCase()
  ].join('|');

  const indexByIdentity = new Map();
  merged.forEach((asset, index) => {
    if (asset?.type === 'notice') return;
    indexByIdentity.set(identity(asset), index);
  });

  for (const asset of Array.isArray(activatedAssets) ? activatedAssets : []) {
    if (asset?.type === 'notice') {
      merged.push(asset);
      continue;
    }

    const key = identity(asset);
    const existingIndex = indexByIdentity.get(key);
    if (existingIndex === undefined) {
      indexByIdentity.set(key, merged.length);
      merged.push(asset);
      continue;
    }

    const current = merged[existingIndex];
    if (
      asset?.included === true ||
      (current?.included !== true && String(asset?.reason || '').length >= String(current?.reason || '').length)
    ) {
      merged[existingIndex] = asset;
    }
  }

  return merged;
}

async function collectActivatedAttachmentCards(
  selectedIndices,
  unresolvedDescriptors,
  maxTotalBytes,
  maxAssets
) {
  const MAX_ASSET_BYTES = 6 * 1024 * 1024;
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const descriptors = Array.isArray(unresolvedDescriptors)
    ? unresolvedDescriptors.slice(0, Math.max(0, Number(maxAssets || 0)))
    : [];
  const byteLimit = Math.max(0, Number(maxTotalBytes || 0));
  let totalBytes = 0;

  const wait = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const filenamePattern = /\b[^\s<>:"/\\|?*]+\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)\b/i;

  const expectedExtension = (filename) => String(filename || '')
    .split('.')
    .pop()
    .toLowerCase();

  const normalizeUrl = (value) => {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (
      !raw ||
      /^file_[a-z0-9_-]+$/i.test(raw) ||
      /\[object\s/i.test(raw) ||
      /^(?:javascript|about):/i.test(raw)
    ) {
      return '';
    }

    try {
      const parsed = new URL(raw, location.href);
      const href = parsed.href;
      if (!/^(?:https?:|blob:|data:)/i.test(href)) return '';
      if (/\/c\/(?:%5b|\[)?object/i.test(href)) return '';
      if (/^https?:\/\/(?:www\.)?chatgpt\.com\/(?:c|g|share)\//i.test(href)) return '';
      return href;
    } catch (_) {
      return '';
    }
  };

  const plausibleUrl = (url, filename) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return false;

    let parsed;
    try {
      parsed = new URL(normalized, location.href);
    } catch (_) {
      return false;
    }

    const href = parsed.href.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const extension = expectedExtension(filename);

    if (/\/cdn\/assets\/|sprites?|favicon|(?:^|[\/_.-])icon(?:[\/_.-]|$)/i.test(href)) {
      return false;
    }
    if (
      extension !== 'svg' &&
      (pathname.endsWith('.svg') || /\.svg(?:#|\?|$)/i.test(href))
    ) {
      return false;
    }
    if (
      /backend-api\/estuary\/content|backend-api\/files|file-service|files\.oaiusercontent\.com|\/attachment(?:\/|$)|\/download(?:\/|$|\?)/i.test(href)
    ) {
      return true;
    }
    if (extension && pathname.endsWith(`.${extension}`)) return true;
    return /file_[a-z0-9_-]+/i.test(href);
  };

  const attributeValues = (node) => {
    const values = [];
    for (const attribute of [...(node?.attributes || [])]) {
      if (!/(?:href|src|url|download|source|file|attachment|action)/i.test(attribute.name)) continue;
      values.push(attribute.value);
    }
    return values;
  };

  const labelFor = (element) => cleanText(
    element?.getAttribute?.('download') ||
    element?.getAttribute?.('aria-label') ||
    element?.getAttribute?.('title') ||
    element?.innerText ||
    element?.textContent ||
    ''
  ).slice(0, 500);

  const nearbyNodes = (element) => {
    const nodes = [element];
    nodes.push(...element?.querySelectorAll?.(
      'a[href], [href], [src], [data-href], [data-url], [data-download-url], [formaction]'
    ) || []);

    let parent = element?.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      nodes.push(parent);
      parent = parent.parentElement;
    }
    return nodes;
  };

  const fileIdsFor = (element) => {
    const values = [];
    for (const node of nearbyNodes(element)) {
      values.push(...attributeValues(node));
      if (typeof node?.outerHTML === 'string') values.push(node.outerHTML.slice(0, 20000));
    }
    return [...new Set(values.flatMap(
      (value) => String(value || '').match(/file_[a-z0-9_-]+/ig) || []
    ))];
  };

  const urlsFromNodes = (nodes, filename) => {
    const urls = [];
    for (const node of nodes) {
      const values = [
        ...attributeValues(node),
        typeof node?.href === 'string' ? node.href : '',
        typeof node?.src === 'string' ? node.src : ''
      ];
      for (const value of values) {
        const normalized = normalizeUrl(value);
        if (normalized && plausibleUrl(normalized, filename)) urls.push(normalized);
      }
    }
    return [...new Set(urls)];
  };

  const resourceUrls = () => {
    const entries = performance.getEntriesByType?.('resource') || [];
    return [...new Set(entries
      .map((entry) => normalizeUrl(entry?.name))
      .filter(Boolean))];
  };

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
      'text/markdown': 'md',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    return types[String(mimeType || '').toLowerCase()] || 'bin';
  };

  const blobLooksLikeFile = async (blob, filename) => {
    if (!blob?.size) return false;
    const extension = expectedExtension(filename);
    const mimeType = String(blob.type || '').toLowerCase();
    if (mimeType === 'text/html' && extension !== 'html' && extension !== 'htm') return false;

    const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const ascii = String.fromCharCode(...bytes);
    if (extension === 'pdf') return mimeType === 'application/pdf' || ascii.startsWith('%PDF-');
    if (['zip', 'docx', 'xlsx', 'pptx'].includes(extension)) {
      return mimeType.includes('zip') || (bytes[0] === 0x50 && bytes[1] === 0x4b);
    }
    if (['jpg', 'jpeg'].includes(extension)) {
      return mimeType === 'image/jpeg' || (bytes[0] === 0xff && bytes[1] === 0xd8);
    }
    if (extension === 'png') {
      return mimeType === 'image/png' || (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    }
    return true;
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed.'));
    reader.readAsDataURL(blob);
  });

  const extractJsonUrls = (value, filename, depth = 0) => {
    if (depth > 6 || value === null || value === undefined) return [];
    if (typeof value === 'string') {
      const normalized = normalizeUrl(value);
      return normalized && plausibleUrl(normalized, filename) ? [normalized] : [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => extractJsonUrls(item, filename, depth + 1));
    }
    if (typeof value === 'object') {
      return Object.values(value).flatMap(
        (item) => extractJsonUrls(item, filename, depth + 1)
      );
    }
    return [];
  };

  const fetchValidBlob = async (initialUrls, filename) => {
    const queue = [...new Set(initialUrls)];
    const visited = new Set();
    const errors = [];

    while (queue.length && visited.size < 20) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      try {
        const response = await fetch(url, {
          credentials: 'include',
          redirect: 'follow'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        if (response.redirected && plausibleUrl(response.url, filename)) {
          queue.unshift(response.url);
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          const payload = await response.clone().json();
          queue.push(...extractJsonUrls(payload, filename));
        }

        const declaredSize = Number(response.headers.get('content-length') || 0);
        if (declaredSize > MAX_ASSET_BYTES) {
          throw new Error('File exceeds the 6 MB package limit.');
        }

        const blob = await response.blob();
        if (blob.size > MAX_ASSET_BYTES) {
          throw new Error('File exceeds the 6 MB package limit.');
        }
        if (totalBytes + blob.size > byteLimit) {
          throw new Error('Package asset limit of 16 MB was reached.');
        }
        if (!(await blobLooksLikeFile(blob, filename))) {
          throw new Error('ChatGPT returned metadata, a page, or a decorative asset instead of the attachment bytes.');
        }

        return { url: response.url || url, blob, errors };
      } catch (error) {
        errors.push(String(error?.message || error));
      }
    }

    return { url: '', blob: null, errors };
  };

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
    'a[href]', '[role="link"]', 'button', '[role="button"]',
    '[data-href]', '[data-url]', '[data-download-url]', '[data-file-id]',
    '[data-attachment-id]', '[data-testid*="file"]', '[data-testid*="attachment"]',
    '[data-testid*="download"]', '[class*="file"]', '[class*="attachment"]',
    '[class*="download"]'
  ].join(',');

  const findTarget = (descriptor) => {
    const root = roots[Number(descriptor.messageIndex)];
    if (!root) return null;

    const wanted = [
      descriptor.label,
      descriptor.filename,
      String(descriptor.filename || '').replace(/^_+/, '')
    ]
      .map((value) => cleanText(value).toLowerCase())
      .filter(Boolean);

    const matches = [];
    for (const element of root.querySelectorAll(selector)) {
      const label = labelFor(element);
      const lower = label.toLowerCase();
      const fileMatch = label.match(filenamePattern)?.[0]?.toLowerCase() || '';
      const matched = wanted.some((value) =>
        lower.includes(value) ||
        value.includes(lower) ||
        (fileMatch && (fileMatch.includes(value) || value.includes(fileMatch)))
      );
      if (!matched) continue;

      const area = Math.max(
        1,
        Number(element.getBoundingClientRect?.().width || 1) *
        Number(element.getBoundingClientRect?.().height || 1)
      );
      matches.push({ element, label, score: label.length + Math.log(area) });
    }

    matches.sort((a, b) => a.score - b.score);
    return matches[0]?.element || null;
  };

  const dismissOverlay = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    }));
  };

  const assets = [];

  for (const descriptor of descriptors) {
    if (selected && !selected.has(Number(descriptor.messageIndex))) continue;

    const filename = sanitizeFilename(
      descriptor.filename || descriptor.label,
      'attachment.bin'
    );
    const target = findTarget(descriptor);

    if (!target) {
      assets.push({
        messageIndex: Number(descriptor.messageIndex),
        type: 'attachment',
        label: descriptor.label || filename,
        filename,
        sourceUrl: '',
        included: false,
        reason: 'The attachment card was detected earlier, but its interactive element could not be resolved for local capture.'
      });
      continue;
    }

    const fileIds = fileIdsFor(target);
    const before = new Set(resourceUrls());
    const initialUrls = urlsFromNodes(nearbyNodes(target), filename);

    try {
      target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      target.click();
      await wait(1800);
    } catch (_) {
      await wait(400);
    }

    const after = resourceUrls();
    const newResources = after.filter((url) => !before.has(url));
    const openNodes = [
      ...document.querySelectorAll(
        '[role="dialog"] a[href], [role="dialog"] [data-href], [role="dialog"] [data-url], [data-state="open"] a[href], [data-state="open"] [data-href], [data-state="open"] [data-url]'
      )
    ];
    const openedUrls = urlsFromNodes(openNodes, filename);
    const matchingResources = after.filter((url) =>
      plausibleUrl(url, filename) &&
      (
        fileIds.some((fileId) => url.includes(fileId)) ||
        newResources.includes(url) ||
        url.toLowerCase().includes(encodeURIComponent(filename).toLowerCase())
      )
    );

    const generated = [];
    for (const fileId of fileIds) {
      const encoded = encodeURIComponent(fileId);
      generated.push(
        `${location.origin}/backend-api/estuary/content?id=${encoded}`,
        `${location.origin}/backend-api/files/${encoded}/download`,
        `${location.origin}/backend-api/files/${encoded}`
      );
    }

    const urls = [...new Set([
      ...matchingResources,
      ...openedUrls,
      ...initialUrls,
      ...generated
    ])].filter((url) => plausibleUrl(url, filename));

    const result = await fetchValidBlob(urls, filename);
    dismissOverlay();
    await wait(150);

    if (!result.blob) {
      assets.push({
        messageIndex: Number(descriptor.messageIndex),
        type: 'attachment',
        label: descriptor.label || filename,
        filename,
        sourceUrl: '',
        included: false,
        reason: urls.length
          ? `The file card was activated, but no reusable bytes were exposed: ${[...new Set(result.errors)].slice(0, 3).join('; ') || 'unknown error'}`
          : 'The file card was activated, but ChatGPT did not expose a reusable attachment URL.'
      });
      continue;
    }

    let outputName = filename;
    if (!/\.[a-z0-9]{1,8}$/i.test(outputName)) {
      outputName = `${outputName}.${extensionForMime(result.blob.type)}`;
    }

    totalBytes += result.blob.size;
    assets.push({
      messageIndex: Number(descriptor.messageIndex),
      type: 'attachment',
      label: descriptor.label || outputName,
      filename: outputName,
      sourceUrl: result.url,
      mimeType: result.blob.type || 'application/octet-stream',
      size: result.blob.size,
      dataUrl: await blobToDataUrl(result.blob),
      included: true
    });
  }

  return { assets };
}
