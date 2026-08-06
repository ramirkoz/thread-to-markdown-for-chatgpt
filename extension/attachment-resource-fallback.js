'use strict';

if (typeof collectRelativeAttachmentCards !== 'function') {
  throw new Error('Relative attachment collector was not initialized.');
}

collectRelativeAttachmentCards = async function collectRelativeAttachmentCardsWithResourceFallback(
  selectedIndices,
  maxTotalBytes,
  maxAssets
) {
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
  const fileIdPattern = /file_[a-z0-9_-]+/ig;

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

  const attributeValues = (node) => {
    const values = [];
    for (const attribute of [...(node?.attributes || [])]) {
      if (!/(?:href|src|url|download|source|file|attachment|action)/i.test(attribute.name)) continue;
      values.push(attribute.value);
    }
    return values;
  };

  const urlFromNode = (node) => {
    if (!node) return '';
    const values = [
      ...attributeValues(node),
      typeof node.href === 'string' ? node.href : '',
      typeof node.src === 'string' ? node.src : ''
    ];
    for (const value of values) {
      const normalized = normalizeUrl(value);
      if (normalized) return normalized;
    }
    return '';
  };

  const nearbyNodes = (element) => {
    const nodes = [element];
    nodes.push(...element.querySelectorAll?.(
      'a[href], [href], [src], [data-href], [data-url], [data-download-url], [formaction]'
    ) || []);
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1) {
      nodes.push(parent);
      parent = parent.parentElement;
    }
    return nodes;
  };

  const firstReusableUrl = (element) => {
    for (const node of nearbyNodes(element)) {
      const value = urlFromNode(node);
      if (value) return value;
    }
    return '';
  };

  const fileIdsFor = (element) => {
    const values = [];
    for (const node of nearbyNodes(element)) {
      values.push(...attributeValues(node));
      if (typeof node.outerHTML === 'string') values.push(node.outerHTML.slice(0, 12000));
    }
    return [...new Set(values.flatMap((value) => String(value || '').match(fileIdPattern) || []))];
  };

  const loadedResourceUrls = () => {
    const entries = performance.getEntriesByType?.('resource') || [];
    const urls = [];
    for (const entry of entries) {
      const url = normalizeUrl(entry?.name);
      if (!url) continue;
      if (!/(?:backend-api\/estuary\/content|backend-api\/files|file-service|files\.oaiusercontent\.com|\/attachment|\/download)/i.test(url)) continue;
      urls.push(url);
    }
    return [...new Set(urls)];
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
      'text/markdown': 'md',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    return types[String(mimeType || '').toLowerCase()] || 'bin';
  };

  const expectedExtension = (filename) => String(filename || '').split('.').pop().toLowerCase();

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
    if (['jpg', 'jpeg'].includes(extension)) return mimeType === 'image/jpeg' || (bytes[0] === 0xff && bytes[1] === 0xd8);
    if (extension === 'png') return mimeType === 'image/png' || ascii.startsWith('\x89PNG');
    return true;
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
    'a[href]', '[role="link"]', 'button', '[role="button"]',
    '[data-href]', '[data-url]', '[data-download-url]', '[data-file-id]',
    '[data-attachment-id]', '[data-testid*="file"]', '[data-testid*="attachment"]',
    '[data-testid*="download"]', '[class*="file"]', '[class*="attachment"]', '[class*="download"]'
  ].join(',');

  const candidates = [];
  const seen = new Set();
  const resources = loadedResourceUrls();

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;
    for (const element of root.querySelectorAll(selector)) {
      const label = labelFor(element);
      const match = label.match(filenamePattern);
      if (!match) continue;
      const filename = match[0];
      const fileIds = fileIdsFor(element);
      const directUrl = firstReusableUrl(element);
      const resourceUrl = resources.find((url) => fileIds.some((id) => url.includes(id))) || '';
      const url = directUrl || resourceUrl;
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
      if (!(await blobLooksLikeFile(blob, filename))) throw new Error('ChatGPT returned a page instead of the attachment bytes.');
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
};
