'use strict';

const mainWorldBaseExportThread = self.exportThread;
const mainWorldPrepareThread = self.prepareThread;

if (
  typeof mainWorldBaseExportThread !== 'function' ||
  typeof mainWorldPrepareThread !== 'function' ||
  typeof collectPortableAssets !== 'function' ||
  typeof collectFileCardAttachments !== 'function' ||
  typeof collectRelativeAttachmentCards !== 'function' ||
  typeof collectActivatedAttachmentCards !== 'function' ||
  typeof mergeCapturedAssets !== 'function' ||
  typeof mergeActivatedAssets !== 'function' ||
  typeof buildPortablePackage !== 'function' ||
  typeof bytesToDataUrl !== 'function'
) {
  throw new Error('Main-world attachment fallback dependencies were not initialized.');
}

self.exportThread = async function exportThreadWithMainWorldAttachments(
  tabId,
  selectedIndices,
  requestedFormat
) {
  if (requestedFormat !== 'zip') {
    return mainWorldBaseExportThread(tabId, selectedIndices, requestedFormat);
  }

  const jsonResult = await mainWorldPrepareThread(tabId, selectedIndices, 'json');
  const payload = JSON.parse(jsonResult.content);

  const baseRuns = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectPortableAssets,
    args: [selectedIndices]
  });
  const baseAssets = Array.isArray(baseRuns?.[0]?.result?.assets)
    ? baseRuns[0].result.assets
    : [];

  let cardAssets = [];
  const cardBytes = Math.max(0, 16 * 1024 * 1024 - mainWorldIncludedBytes(baseAssets));
  const cardSlots = Math.max(0, 40 - mainWorldUsedSlots(baseAssets));
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
  let relativeAssets = [];
  const relativeBytes = Math.max(0, 16 * 1024 * 1024 - mainWorldIncludedBytes(firstMerge));
  const relativeSlots = Math.max(0, 40 - mainWorldUsedSlots(firstMerge));
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
  const activationDescriptors = mainWorldUnresolvedDescriptors(secondMerge);
  let activatedAssets = [];
  if (activationDescriptors.length) {
    const activationBytes = Math.max(
      0,
      16 * 1024 * 1024 - mainWorldIncludedBytes(secondMerge)
    );
    const activationRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectActivatedAttachmentCards,
      args: [
        selectedIndices,
        activationDescriptors,
        activationBytes,
        Math.min(40, activationDescriptors.length)
      ]
    });
    activatedAssets = Array.isArray(activationRuns?.[0]?.result?.assets)
      ? activationRuns[0].result.assets
      : [];
  }

  const thirdMerge = mergeActivatedAssets(secondMerge, activatedAssets);
  const mainWorldDescriptors = mainWorldUnresolvedDescriptors(thirdMerge);
  let mainWorldAssets = [];
  if (mainWorldDescriptors.length) {
    const remainingBytes = Math.max(
      0,
      16 * 1024 * 1024 - mainWorldIncludedBytes(thirdMerge)
    );
    const mainWorldRuns = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: collectMainWorldAttachmentCards,
      args: [
        selectedIndices,
        mainWorldDescriptors,
        remainingBytes,
        Math.min(40, mainWorldDescriptors.length)
      ]
    });
    mainWorldAssets = Array.isArray(mainWorldRuns?.[0]?.result?.assets)
      ? mainWorldRuns[0].result.assets
      : [];
  }

  const capturedAssets = mergeActivatedAssets(thirdMerge, mainWorldAssets);
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

function mainWorldIncludedBytes(assets) {
  return (Array.isArray(assets) ? assets : []).reduce(
    (sum, asset) => sum + (asset?.included ? Number(asset.size || 0) : 0),
    0
  );
}

function mainWorldUsedSlots(assets) {
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset?.type !== 'notice')
    .length;
}

function mainWorldUnresolvedDescriptors(assets) {
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset?.type === 'attachment' && asset?.included === false)
    .map((asset) => ({
      messageIndex: Number(asset.messageIndex),
      label: String(asset.label || ''),
      filename: String(asset.filename || '')
    }));
}

async function collectMainWorldAttachmentCards(
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

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const filenamePattern = /\b[^\s<>:"/\\|?*]+\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)\b/i;
  const expectedExtension = (filename) => String(filename || '').split('.').pop().toLowerCase();
  const sanitizeFilename = (value, fallback) => cleanText(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;

  const normalizeUrl = (value) => {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw || /^(?:javascript|about):/i.test(raw) || /\[object\s/i.test(raw)) return '';
    try {
      const parsed = new URL(raw, location.href);
      if (!/^(?:https?:|blob:|data:)/i.test(parsed.href)) return '';
      if (/^https?:\/\/(?:www\.)?chatgpt\.com\/(?:c|g|share)\//i.test(parsed.href)) return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  };

  const plausibleUrl = (url, filename) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return false;
    const lower = normalized.toLowerCase();
    const extension = expectedExtension(filename);
    let pathname = '';
    try {
      pathname = new URL(normalized, location.href).pathname.toLowerCase();
    } catch (_) {
      return false;
    }
    if (/\/cdn\/assets\/|sprites?|favicon|(?:^|[\/_.-])icon(?:[\/_.-]|$)/i.test(lower)) return false;
    if (extension !== 'svg' && /\.svg(?:#|\?|$)/i.test(lower)) return false;
    if (/backend-api\/estuary\/content|backend-api\/files|file-service|files\.oaiusercontent\.com|\/attachment(?:\/|$)|\/download(?:\/|$|\?)/i.test(lower)) return true;
    if (extension && pathname.endsWith(`.${extension}`)) return true;
    return /file_[a-z0-9_-]+/i.test(lower) || /blob:/i.test(lower);
  };

  const blobLooksLikeFile = async (blob, filename) => {
    if (!blob?.size) return false;
    const extension = expectedExtension(filename);
    const mimeType = String(blob.type || '').toLowerCase();
    if (mimeType === 'text/html' && !['html', 'htm'].includes(extension)) return false;
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
        bytes[0] === 0x89 && bytes[1] === 0x50 &&
        bytes[2] === 0x4e && bytes[3] === 0x47
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

  const attributeValues = (node) => {
    const values = [];
    for (const attribute of [...(node?.attributes || [])]) {
      if (!/(?:href|src|url|download|source|file|attachment|action)/i.test(attribute.name)) continue;
      values.push(attribute.value);
    }
    return values;
  };

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

  const labelFor = (element) => cleanText(
    element?.getAttribute?.('download') ||
    element?.getAttribute?.('aria-label') ||
    element?.getAttribute?.('title') ||
    element?.innerText ||
    element?.textContent ||
    ''
  ).slice(0, 500);

  const fileIdsFor = (element) => {
    const values = [];
    for (const node of nearbyNodes(element)) {
      values.push(...attributeValues(node));
      if (typeof node?.outerHTML === 'string') values.push(node.outerHTML.slice(0, 30000));
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

  const extractUrls = (value, filename, depth = 0) => {
    if (depth > 8 || value === null || value === undefined) return [];
    if (typeof value === 'string') {
      const normalized = normalizeUrl(value);
      return normalized && plausibleUrl(normalized, filename) ? [normalized] : [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => extractUrls(item, filename, depth + 1));
    }
    if (typeof value === 'object') {
      return Object.values(value).flatMap((item) => extractUrls(item, filename, depth + 1));
    }
    return [];
  };

  const roots = [];
  const seenRoots = new Set();
  const main = document.querySelector('main') || document.body;
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
    const wanted = [descriptor.label, descriptor.filename, String(descriptor.filename || '').replace(/^_+/, '')]
      .map((value) => cleanText(value).toLowerCase())
      .filter(Boolean);
    const matches = [];
    for (const element of root.querySelectorAll(selector)) {
      const label = labelFor(element);
      const lower = label.toLowerCase();
      const fileMatch = label.match(filenamePattern)?.[0]?.toLowerCase() || '';
      if (!wanted.some((value) =>
        lower.includes(value) || value.includes(lower) ||
        (fileMatch && (fileMatch.includes(value) || value.includes(fileMatch)))
      )) continue;
      const rect = element.getBoundingClientRect?.();
      const area = Math.max(1, Number(rect?.width || 1) * Number(rect?.height || 1));
      matches.push({ element, score: label.length + Math.log(area) });
    }
    matches.sort((a, b) => a.score - b.score);
    return matches[0]?.element || null;
  };

  const originalFetch = window.fetch.bind(window);
  const originalOpen = window.open;
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  const capturedUrls = [];
  const capturedBlobs = [];
  const pending = [];
  let activeFilename = '';
  let activeKey = '';

  const rememberUrl = (value) => {
    const normalized = normalizeUrl(value);
    if (normalized) capturedUrls.push({ key: activeKey, filename: activeFilename, url: normalized });
  };

  const rememberBlob = async (blob, url) => {
    if (!activeFilename || !blob || blob.size > MAX_ASSET_BYTES) return;
    if (!(await blobLooksLikeFile(blob, activeFilename))) return;
    capturedBlobs.push({ key: activeKey, filename: activeFilename, url: normalizeUrl(url), blob });
  };

  const inspectResponse = async (response, filename, key) => {
    if (!response) return;
    const previousFilename = activeFilename;
    const previousKey = activeKey;
    activeFilename = filename;
    activeKey = key;
    try {
      rememberUrl(response.url);
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        try {
          const payload = await response.clone().json();
          for (const url of extractUrls(payload, filename)) rememberUrl(url);
        } catch (_) {}
      }
      const declaredSize = Number(response.headers?.get?.('content-length') || 0);
      if (!declaredSize || declaredSize <= MAX_ASSET_BYTES) {
        try {
          const blob = await response.clone().blob();
          await rememberBlob(blob, response.url);
        } catch (_) {}
      }
    } finally {
      activeFilename = previousFilename;
      activeKey = previousKey;
    }
  };

  window.fetch = async function interceptedAttachmentFetch(...args) {
    const filename = activeFilename;
    const key = activeKey;
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (filename && key) rememberUrl(requestUrl);
    const response = await originalFetch(...args);
    if (filename && key) pending.push(inspectResponse(response.clone(), filename, key));
    return response;
  };

  window.open = function interceptedAttachmentOpen(url, ...args) {
    rememberUrl(url);
    return originalOpen.call(window, url, ...args);
  };

  URL.createObjectURL = function interceptedAttachmentObjectUrl(object) {
    const url = originalCreateObjectURL(object);
    rememberUrl(url);
    if (object instanceof Blob) pending.push(rememberBlob(object, url));
    return url;
  };

  const captureNavigation = (event) => {
    const anchor = event.target?.closest?.('a[href]');
    if (anchor) rememberUrl(anchor.href);
  };
  document.addEventListener('click', captureNavigation, true);

  const resourceUrls = () => (performance.getEntriesByType?.('resource') || [])
    .map((entry) => normalizeUrl(entry?.name))
    .filter(Boolean);

  const fetchValidBlob = async (initialUrls, filename) => {
    const queue = [...new Set(initialUrls.filter((url) => plausibleUrl(url, filename)))];
    const visited = new Set();
    const errors = [];
    while (queue.length && visited.size < 30) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);
      try {
        const response = await originalFetch(url, { credentials: 'include', redirect: 'follow' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (response.redirected && plausibleUrl(response.url, filename)) queue.unshift(response.url);
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          try {
            const payload = await response.clone().json();
            queue.push(...extractUrls(payload, filename));
          } catch (_) {}
        }
        const declaredSize = Number(response.headers.get('content-length') || 0);
        if (declaredSize > MAX_ASSET_BYTES) throw new Error('File exceeds the 6 MB package limit.');
        const blob = await response.blob();
        if (blob.size > MAX_ASSET_BYTES) throw new Error('File exceeds the 6 MB package limit.');
        if (totalBytes + blob.size > byteLimit) throw new Error('Package asset limit of 16 MB was reached.');
        if (!(await blobLooksLikeFile(blob, filename))) {
          throw new Error('ChatGPT main world returned metadata, a page, or a decorative asset instead of the attachment bytes.');
        }
        return { url: response.url || url, blob, errors };
      } catch (error) {
        errors.push(String(error?.message || error));
      }
    }
    return { url: '', blob: null, errors };
  };

  const assets = [];
  try {
    for (const descriptor of descriptors) {
      if (selected && !selected.has(Number(descriptor.messageIndex))) continue;
      const filename = sanitizeFilename(descriptor.filename || descriptor.label, 'attachment.bin');
      const key = `${Number(descriptor.messageIndex)}|${filename.toLowerCase()}`;
      activeFilename = filename;
      activeKey = key;
      const target = findTarget(descriptor);
      if (!target) {
        assets.push({
          messageIndex: Number(descriptor.messageIndex), type: 'attachment',
          label: descriptor.label || filename, filename, sourceUrl: '', included: false,
          reason: 'The attachment card could not be resolved in the ChatGPT page context.'
        });
        continue;
      }

      const fileIds = fileIdsFor(target);
      const before = new Set(resourceUrls());
      const initialUrls = urlsFromNodes(nearbyNodes(target), filename);
      try {
        target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
        target.click();
      } catch (_) {}
      await wait(2500);
      await Promise.allSettled(pending.splice(0));

      const after = resourceUrls();
      const newResources = after.filter((url) => !before.has(url));
      const openNodes = [...document.querySelectorAll(
        '[role="dialog"] a[href], [role="dialog"] [data-href], [role="dialog"] [data-url], [data-state="open"] a[href], [data-state="open"] [data-href], [data-state="open"] [data-url]'
      )];
      const openedUrls = urlsFromNodes(openNodes, filename);
      const observedUrls = capturedUrls
        .filter((item) => item.key === key)
        .map((item) => item.url);
      const generated = fileIds.flatMap((fileId) => {
        const encoded = encodeURIComponent(fileId);
        return [
          `${location.origin}/backend-api/estuary/content?id=${encoded}`,
          `${location.origin}/backend-api/files/${encoded}/download`,
          `${location.origin}/backend-api/files/${encoded}`
        ];
      });

      let captured = capturedBlobs.find((item) => item.key === key && item.blob?.size);
      let result = captured
        ? { url: captured.url, blob: captured.blob, errors: [] }
        : await fetchValidBlob([
          ...observedUrls,
          ...newResources,
          ...openedUrls,
          ...initialUrls,
          ...generated
        ], filename);

      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
      }));
      await wait(150);

      if (!result.blob) {
        assets.push({
          messageIndex: Number(descriptor.messageIndex), type: 'attachment',
          label: descriptor.label || filename, filename, sourceUrl: '', included: false,
          reason: `The ChatGPT page context did not expose reusable bytes: ${[...new Set(result.errors)].slice(0, 4).join('; ') || 'no valid file response was observed'}`
        });
        continue;
      }

      totalBytes += result.blob.size;
      assets.push({
        messageIndex: Number(descriptor.messageIndex), type: 'attachment',
        label: descriptor.label || filename, filename,
        sourceUrl: result.url || '', mimeType: result.blob.type || 'application/octet-stream',
        size: result.blob.size, dataUrl: await blobToDataUrl(result.blob), included: true
      });
    }
  } finally {
    activeFilename = '';
    activeKey = '';
    window.fetch = originalFetch;
    window.open = originalOpen;
    URL.createObjectURL = originalCreateObjectURL;
    document.removeEventListener('click', captureNavigation, true);
  }

  return { assets };
}
