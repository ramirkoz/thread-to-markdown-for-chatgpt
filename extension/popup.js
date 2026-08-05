'use strict';

const exportButton = document.getElementById('export');
const statusNode = document.getElementById('status');
const selectionSection = document.getElementById('selection');
const messagesNode = document.getElementById('messages');
const threadTitleNode = document.getElementById('thread-title');
const selectionCountNode = document.getElementById('selection-count');
const selectAllButton = document.getElementById('select-all');
const clearAllButton = document.getElementById('clear-all');

let activeTabId = null;
let messages = [];

localizeDocument();
exportButton.addEventListener('click', exportSelectedMessages);
selectAllButton.addEventListener('click', () => setAllSelected(true));
clearAllButton.addEventListener('click', () => setAllSelected(false));
loadOpenThread();

function localizeDocument() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const message = chrome.i18n.getMessage(node.dataset.i18n);
    if (message) node.textContent = message;
  });
}

async function loadOpenThread() {
  setStatus(chrome.i18n.getMessage('loadingStatus') || 'Reading the open conversation…');
  exportButton.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(tab.url || '')) {
      throw new Error(chrome.i18n.getMessage('wrongPageError') || 'Open a ChatGPT conversation first.');
    }

    activeTabId = tab.id;
    const response = await chrome.runtime.sendMessage({ type: 'inspect-thread', tabId: tab.id });
    if (!response?.ok || !Array.isArray(response.messages) || !response.messages.length) {
      throw new Error(response?.error || chrome.i18n.getMessage('noMessagesError') || 'No messages were found.');
    }

    messages = response.messages;
    threadTitleNode.textContent = response.title || chrome.i18n.getMessage('fallbackThreadTitle') || 'ChatGPT conversation';
    renderMessages();
    selectionSection.hidden = false;
    updateSelectionState();
  } catch (error) {
    setStatus(String(error?.message || error), 'error');
  }
}

function renderMessages() {
  messagesNode.textContent = '';
  const fragment = document.createDocumentFragment();

  for (const message of messages) {
    const item = document.createElement('label');
    item.className = 'message-item';
    item.setAttribute('role', 'listitem');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.index = String(message.index);
    checkbox.addEventListener('change', updateSelectionState);

    const content = document.createElement('span');
    content.className = 'message-content';

    const role = document.createElement('strong');
    role.textContent = roleLabel(message.role);

    const preview = document.createElement('span');
    preview.textContent = message.preview;

    content.append(role, preview);
    item.append(checkbox, content);
    fragment.append(item);
  }

  messagesNode.append(fragment);
}

function roleLabel(role) {
  const keyByRole = {
    user: 'roleUser',
    assistant: 'roleAssistant',
    system: 'roleSystem',
    tool: 'roleTool',
    conversation: 'roleConversation',
    unknown: 'roleMessage'
  };
  return chrome.i18n.getMessage(keyByRole[role] || 'roleMessage') || role || 'Message';
}

function setAllSelected(selected) {
  messagesNode.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = selected;
  });
  updateSelectionState();
}

function selectedIndices() {
  return [...messagesNode.querySelectorAll('input[type="checkbox"]:checked')]
    .map((checkbox) => Number(checkbox.dataset.index))
    .filter(Number.isInteger);
}

function updateSelectionState() {
  const selected = selectedIndices().length;
  selectionCountNode.textContent = formatMessage('selectionCount', [selected, messages.length]) || `${selected} of ${messages.length} selected`;
  exportButton.disabled = selected === 0 || !activeTabId;
  exportButton.textContent = formatMessage('exportSelectedButton', [selected]) || `Export selected (${selected})`;

  if (selected === 0) {
    setStatus(chrome.i18n.getMessage('emptySelectionStatus') || 'Select at least one message.', 'error');
  } else {
    setStatus(formatMessage('readySelectionStatus', [messages.length]) || `${messages.length} messages found.`);
  }
}

async function exportSelectedMessages() {
  const indices = selectedIndices();
  if (!activeTabId || !indices.length) {
    updateSelectionState();
    return;
  }

  setStatus(chrome.i18n.getMessage('workingStatus') || 'Exporting…');
  exportButton.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'export-thread',
      tabId: activeTabId,
      selectedIndices: indices
    });
    if (!response?.ok) throw new Error(response?.error || 'Export failed.');

    setStatus(formatMessage('successStatus', [response.filename]) || `Saved: ${response.filename}`, 'success');
  } catch (error) {
    setStatus(String(error?.message || error), 'error');
  } finally {
    exportButton.disabled = selectedIndices().length === 0 || !activeTabId;
  }
}

function formatMessage(key, values = []) {
  const substitutions = values.map((value) => String(value));
  return substitutions.length
    ? chrome.i18n.getMessage(key, substitutions)
    : chrome.i18n.getMessage(key);
}

function setStatus(message, className = '') {
  statusNode.textContent = message;
  statusNode.className = className;
}
