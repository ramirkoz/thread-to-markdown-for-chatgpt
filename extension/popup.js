'use strict';

const exportButton = document.getElementById('export');
const statusNode = document.getElementById('status');

localizeDocument();
exportButton.addEventListener('click', exportOpenThread);

function localizeDocument() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const message = chrome.i18n.getMessage(node.dataset.i18n);
    if (message) node.textContent = message;
  });
}

async function exportOpenThread() {
  setStatus(chrome.i18n.getMessage('workingStatus') || 'Exporting…');
  exportButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(tab.url || '')) {
      throw new Error(chrome.i18n.getMessage('wrongPageError') || 'Open a ChatGPT conversation first.');
    }

    const response = await chrome.runtime.sendMessage({ type: 'export-thread', tabId: tab.id });
    if (!response?.ok) throw new Error(response?.error || 'Export failed.');

    const template = chrome.i18n.getMessage('successStatus') || 'Saved: $1';
    setStatus(template.replace('$1', response.filename), 'success');
  } catch (error) {
    setStatus(String(error?.message || error), 'error');
  } finally {
    exportButton.disabled = false;
  }
}

function setStatus(message, className = '') {
  statusNode.textContent = message;
  statusNode.className = className;
}
