'use strict';

const pdfBaseExportThread = self.exportThread;
const pdfBasePrepareThread = self.prepareThread;
const pdfBaseNormalizeFormat = self.normalizeFormat;
const pendingPrintJobs = new Map();

if (
  typeof pdfBaseExportThread !== 'function' ||
  typeof pdfBasePrepareThread !== 'function' ||
  typeof pdfBaseNormalizeFormat !== 'function'
) {
  throw new Error('PDF export dependencies were not initialized.');
}

self.normalizeFormat = function normalizeFormatWithPdf(value) {
  return value === 'pdf' ? 'pdf' : pdfBaseNormalizeFormat(value);
};

self.exportThread = async function exportThreadWithPdf(tabId, selectedIndices, requestedFormat) {
  if (requestedFormat !== 'pdf') {
    return pdfBaseExportThread(tabId, selectedIndices, requestedFormat);
  }

  const htmlResult = await pdfBasePrepareThread(tabId, selectedIndices, 'html');
  const token = createPrintToken();
  const filename = String(htmlResult.filename || 'chatgpt-thread.html')
    .replace(/\.html$/i, '.pdf');

  pendingPrintJobs.set(token, {
    content: htmlResult.content,
    filename,
    messageCount: htmlResult.messageCount
  });

  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL(`print.html?token=${encodeURIComponent(token)}`),
    active: true
  });

  setTimeout(() => pendingPrintJobs.delete(token), 120000);

  return {
    filename,
    messageCount: htmlResult.messageCount,
    format: 'pdf',
    printDialog: true,
    tabId: tab?.id
  };
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'pdf-print') return;

  port.onMessage.addListener((message) => {
    const token = String(message?.token || '');
    const job = pendingPrintJobs.get(token);

    if (!job) {
      port.postMessage({
        ok: false,
        error: 'The PDF print document expired. Export it again.'
      });
      return;
    }

    pendingPrintJobs.delete(token);
    port.postMessage({ ok: true, ...job });
  });
});

function createPrintToken() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
