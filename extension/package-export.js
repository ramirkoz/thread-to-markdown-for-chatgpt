'use strict';

const packageBaseExportThread = self.exportThread;
const packageBaseNormalizeFormat = self.normalizeFormat;
const packageBasePrepareThread = self.prepareThread;

if (
  typeof packageBaseExportThread !== 'function' ||
  typeof packageBaseNormalizeFormat !== 'function' ||
  typeof packageBasePrepareThread !== 'function'
) {
  throw new Error('ZIP package export dependencies were not initialized.');
}

self.normalizeFormat = function normalizeFormatWithPackage(value) {
  return value === 'zip' ? 'zip' : packageBaseNormalizeFormat(value);
};

self.exportThread = async function exportThreadWithPackage(tabId, selectedIndices, requestedFormat) {
  if (requestedFormat !== 'zip') {
    return packageBaseExportThread(tabId, selectedIndices, requestedFormat);
  }

  const jsonResult = await packageBasePrepareThread(tabId, selectedIndices, 'json');
  const payload = JSON.parse(jsonResult.content);
  const assetRuns = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectPortableAssets,
    args: [selectedIndices]
  });
  const capturedAssets = assetRuns?.[0]?.result?.assets || [];
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

async function collectPortableAssets(selectedIndices) {
  const MAX_ASSET_BYTES = 6 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
  const MAX_ASSETS = 40;
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  let totalBytes = 0;

  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const safeUrl = (element, image = false) => {
    const value = image
      ? element.currentSrc || element.src || element.getAttribute('src') || ''
      : element.href || element.getAttribute('href') || element.getAttribute('data-href') || element.getAttribute('data-url') || '';
    return /^(?:https?:|blob:|data:)/i.test(value) ? value : '';
  };

  const labelFor = (element) => cleanText(
    element.getAttribute('download') ||
    element.getAttribute('alt') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.innerText ||
    element.textContent ||
    ''
  );

  const extensionForMime = (mimeType) => {
    const types = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/json': 'json',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/zip': 'zip'
    };
    return types[String(mimeType || '').toLowerCase()] || 'bin';
  };

  const sanitizeFilename = (value, fallback) => {
    const cleaned = cleanText(value)
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return cleaned || fallback;
  };

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

  const canvasFallback = async (image) => {
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      return blob || null;
    } catch (_) {
      return null;
    }
  };

  const capture = async (candidate, ordinal) => {
    const { element, type, messageIndex } = candidate;
    const url = safeUrl(element, type === 'image');
    const label = labelFor(element);
    const fallbackName = `${type}-${String(ordinal + 1).padStart(2, '0')}`;
    let filename = sanitizeFilename(
      element.getAttribute('download') || filenameFromUrl(url) || label,
      fallbackName
    );

    if (!url) {
      return { messageIndex, type, label, filename, sourceUrl: '', included: false, reason: 'No reusable file URL was exposed by ChatGPT.' };
    }

    try {
      let blob;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > MAX_ASSET_BYTES) throw new Error('File exceeds the 6 MB package limit.');
      blob = await response.blob();
      if (blob.size > MAX_ASSET_BYTES) throw new Error('File exceeds the 6 MB package limit.');
      if (totalBytes + blob.size > MAX_TOTAL_BYTES) throw new Error('Package asset limit of 16 MB was reached.');

      if (type === 'image' && (!blob.type || !blob.type.startsWith('image/'))) {
        const fallbackBlob = await canvasFallback(element);
        if (fallbackBlob) blob = fallbackBlob;
      }

      if (!/\.[a-z0-9]{1,8}$/i.test(filename)) {
        filename = `${filename}.${extensionForMime(blob.type)}`;
      }
      totalBytes += blob.size;
      return {
        messageIndex,
        type,
        label,
        filename,
        sourceUrl: url,
        mimeType: blob.type || 'application/octet-stream',
        size: blob.size,
        dataUrl: await blobToDataUrl(blob),
        included: true
      };
    } catch (error) {
      if (type === 'image') {
        const fallbackBlob = await canvasFallback(element);
        if (fallbackBlob && fallbackBlob.size <= MAX_ASSET_BYTES && totalBytes + fallbackBlob.size <= MAX_TOTAL_BYTES) {
          totalBytes += fallbackBlob.size;
          if (!/\.[a-z0-9]{1,8}$/i.test(filename)) filename = `${filename}.png`;
          return {
            messageIndex,
            type,
            label,
            filename,
            sourceUrl: url,
            mimeType: 'image/png',
            size: fallbackBlob.size,
            dataUrl: await blobToDataUrl(fallbackBlob),
            included: true
          };
        }
      }
      return {
        messageIndex,
        type,
        label,
        filename,
        sourceUrl: url,
        included: false,
        reason: String(error?.message || error)
      };
    }
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

  const candidates = [];
  const seenUrls = new Set();
  const filenamePattern = /\b[^\s<>:"/\\|?*]+\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)\b/i;

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;

    for (const image of root.querySelectorAll('img')) {
      const url = safeUrl(image, true);
      const alt = labelFor(image);
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      if (!url || (width > 0 && height > 0 && width <= 40 && height <= 40)) continue;
      if (!alt && /(avatar|icon|logo|favicon)/i.test(url)) continue;
      const key = `image:${url}`;
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      candidates.push({ element: image, type: 'image', messageIndex });
    }

    const links = root.querySelectorAll(
      'a[download], a[href], [role="link"][data-href], [role="link"][data-url], button[data-href], button[data-url]'
    );
    for (const link of links) {
      const url = safeUrl(link, false);
      const label = labelFor(link);
      const descriptor = `${url} ${label} ${link.getAttribute('data-testid') || ''}`;
      const isAttachment = Boolean(link.getAttribute('download')) ||
        /(?:\/files?\/|backend-api\/files|file-service|attachment|download|вкладенн|завантаж)/i.test(descriptor) ||
        filenamePattern.test(label);
      if (!isAttachment) continue;
      const key = `attachment:${url || label}`;
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      candidates.push({ element: link, type: 'attachment', messageIndex });
    }
  });

  const limited = candidates.slice(0, MAX_ASSETS);
  const assets = [];
  for (let index = 0; index < limited.length; index += 1) {
    assets.push(await capture(limited[index], index));
  }
  if (candidates.length > MAX_ASSETS) {
    assets.push({
      messageIndex: -1,
      type: 'notice',
      label: '',
      filename: '',
      sourceUrl: '',
      included: false,
      reason: `${candidates.length - MAX_ASSETS} additional assets were omitted because the package limit is ${MAX_ASSETS}.`
    });
  }

  return { assets };
}

function buildPortablePackage(payload, capturedAssets, jsonFilename) {
  const finalCapturedAssets = typeof suppressResolvedAttachmentFallbacks === 'function'
    ? suppressResolvedAttachmentFallbacks(capturedAssets)
    : (Array.isArray(capturedAssets) ? capturedAssets : []);
  const files = [];
  const usedPaths = new Set();
  const assetManifest = [];
  const assetsByMessage = new Map();

  const uniquePath = (directory, rawName) => {
    const safeName = sanitizePackageFilename(rawName || 'file.bin');
    const dot = safeName.lastIndexOf('.');
    const base = dot > 0 ? safeName.slice(0, dot) : safeName;
    const extension = dot > 0 ? safeName.slice(dot) : '';
    let candidate = `${directory}/${safeName}`;
    let counter = 2;
    while (usedPaths.has(candidate.toLowerCase())) {
      candidate = `${directory}/${base}-${counter}${extension}`;
      counter += 1;
    }
    usedPaths.add(candidate.toLowerCase());
    return candidate;
  };

  for (const asset of finalCapturedAssets) {
    const manifestItem = { ...asset };
    delete manifestItem.dataUrl;

    if (asset.included && asset.dataUrl) {
      try {
        const bytes = decodeDataUrl(asset.dataUrl);
        const directory = asset.type === 'image' ? 'assets' : 'attachments';
        const path = uniquePath(directory, asset.filename);
        files.push({ name: path, data: bytes });
        manifestItem.path = path;
        manifestItem.size = bytes.length;
        if (!assetsByMessage.has(asset.messageIndex)) assetsByMessage.set(asset.messageIndex, []);
        assetsByMessage.get(asset.messageIndex).push({ ...manifestItem, included: true });
      } catch (error) {
        manifestItem.included = false;
        manifestItem.reason = `Could not encode the captured file: ${String(error?.message || error)}`;
      }
    }
    assetManifest.push(manifestItem);
  }

  const packagePayload = {
    ...payload,
    packageVersion: 1,
    assets: assetManifest,
    messages: (payload.messages || []).map((message) => {
      const messageAssets = assetsByMessage.get(message.index) || [];
      let markdown = String(message.markdown || message.text || '');
      const append = [];

      for (const asset of messageAssets) {
        if (asset.type === 'image') {
          const encodedUrl = String(asset.sourceUrl || '').replace(/\)/g, '%29');
          if (asset.sourceUrl && markdown.includes(asset.sourceUrl)) {
            markdown = markdown.split(asset.sourceUrl).join(asset.path);
          } else if (encodedUrl && markdown.includes(encodedUrl)) {
            markdown = markdown.split(encodedUrl).join(asset.path);
          } else {
            append.push(`![${escapePackageMarkdown(asset.label || asset.filename)}](${asset.path})`);
          }
        } else if (asset.type === 'attachment') {
          append.push(`[${escapePackageMarkdown(asset.label || asset.filename)}](${asset.path})`);
        }
      }

      if (append.length) {
        markdown = `${markdown}\n\n### Included files\n\n${append.map((item) => `- ${item}`).join('\n')}`.trim();
      }
      return { ...message, markdown, assets: messageAssets };
    })
  };

  const baseName = String(jsonFilename || 'chatgpt-thread.json').replace(/\.json$/i, '');
  const markdown = packageMarkdown(packagePayload);
  const text = packageText(packagePayload);
  const htmlResult = buildHtmlExport({
    ok: true,
    content: JSON.stringify(packagePayload),
    filename: `${baseName}.json`,
    selectedCount: packagePayload.selectedCount,
    messageCount: packagePayload.messageCount
  });

  files.push({ name: 'conversation.md', data: encodeText(markdown) });
  files.push({ name: 'conversation.txt', data: encodeText(text) });
  files.push({ name: 'conversation.html', data: encodeText(htmlResult.content) });
  files.push({ name: 'conversation.json', data: encodeText(JSON.stringify(packagePayload, null, 2)) });
  files.push({
    name: 'manifest.json',
    data: encodeText(JSON.stringify({
      packageVersion: 1,
      title: packagePayload.title,
      exportedAt: packagePayload.exportedAt,
      source: packagePayload.source,
      messageCount: packagePayload.messageCount,
      selectedCount: packagePayload.selectedCount,
      includedAssets: assetManifest.filter((item) => item.included && item.path).length,
      skippedAssets: assetManifest.filter((item) => !item.included).length,
      diagnostics: packagePayload.exportDiagnostics || {},
      assets: assetManifest
    }, null, 2))
  });
  const missingAssets = assetManifest.filter((item) => !item.included);
  if (missingAssets.length) {
    files.push({
      name: 'MISSING_FILES.txt',
      data: encodeText([
        'Files detected in the ChatGPT conversation but not captured into this archive:',
        '',
        ...missingAssets.map((item, index) => `${index + 1}. ${item.filename || item.label || 'unnamed file'}\n   Message: ${Number.isInteger(Number(item.messageIndex)) && Number(item.messageIndex) >= 0 ? Number(item.messageIndex) + 1 : 'unknown'}\n   Reason: ${item.reason || 'Unknown reason'}`)
      ].join('\n'))
    });
  }

  files.push({
    name: 'README.txt',
    data: encodeText([
      'GPT Project & Memory Tools portable package',
      '',
      'Open conversation.html for the formatted offline copy.',
      'conversation.md, conversation.txt, and conversation.json contain the same selected messages in other formats.',
      'Captured images are stored in assets/. Captured attachments are stored in attachments/.',
      'manifest.json lists every detected file and explains why a file was skipped when ChatGPT did not expose reusable bytes.',
      '',
      `Included assets: ${assetManifest.filter((item) => item.included && item.path).length}`,
      `Skipped assets: ${assetManifest.filter((item) => !item.included).length}`
    ].join('\n'))
  });

  const includedAssets = assetManifest.filter((item) => item.included && item.path).length;
  const skippedAssets = assetManifest.filter((item) => !item.included).length;
  return {
    filename: `${baseName}-package.zip`,
    bytes: createStoredZip(files),
    includedAssets,
    skippedAssets
  };
}

function packageMarkdown(payload) {
  const labels = { user: 'User', assistant: 'ChatGPT', system: 'System', tool: 'Tool', conversation: 'Conversation', unknown: 'Message' };
  const parts = [
    `# ${payload.title || 'ChatGPT conversation'}`,
    '',
    `> Exported: ${payload.exportedAt || ''}`,
    `> Source: ${payload.source || ''}`,
    `> Messages: ${payload.selectedCount || payload.messages?.length || 0} of ${payload.messageCount || payload.messages?.length || 0}`,
    ''
  ];
  for (const message of payload.messages || []) {
    parts.push(`## ${labels[message.role] || labels.unknown}`, '', message.markdown || message.text || '', '', '---', '');
  }
  return parts.join('\n');
}

function packageText(payload) {
  const labels = { user: 'User', assistant: 'ChatGPT', system: 'System', tool: 'Tool', conversation: 'Conversation', unknown: 'Message' };
  const parts = [
    payload.title || 'ChatGPT conversation',
    '',
    `Exported: ${payload.exportedAt || ''}`,
    `Source: ${payload.source || ''}`,
    `Messages: ${payload.selectedCount || payload.messages?.length || 0} of ${payload.messageCount || payload.messages?.length || 0}`,
    ''
  ];
  for (const message of payload.messages || []) {
    parts.push(`[${labels[message.role] || labels.unknown}]`, message.text || '', '', '---', '');
  }
  return parts.join('\n');
}

function sanitizePackageFilename(value) {
  return String(value || 'file.bin')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || 'file.bin';
}

function escapePackageMarkdown(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!])/g, '\\$1');
}

function encodeText(value) {
  return new TextEncoder().encode(String(value || ''));
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]*)(;base64)?,(.*)$/s);
  if (!match) throw new Error('Invalid data URL.');
  if (!match[2]) return encodeText(decodeURIComponent(match[3]));
  const binary = atob(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToDataUrl(bytes, mimeType) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = dosDateTime(new Date());

  entries.forEach((entry) => {
    const name = encodeText(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : encodeText(entry.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, ...centralParts, end]);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function dosDateTime(value) {
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate()
  };
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
