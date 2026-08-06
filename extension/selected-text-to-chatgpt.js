'use strict';

(() => {
  const button = document.getElementById('send-selection-to-chatgpt');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MAX_SELECTION_LENGTH = 30000;
  let running = false;

  const localized = (key, substitutions = []) => {
    const values = substitutions.map((value) => String(value));
    return values.length
      ? chrome.i18n.getMessage(key, values)
      : chrome.i18n.getMessage(key);
  };

  const showStatus = (message, className = '') => {
    if (typeof setStatus === 'function') setStatus(message, className);
  };

  button.addEventListener('click', () => {
    void sendSelectedText();
  });

  async function sendSelectedText() {
    if (running) return;
    running = true;
    button.disabled = true;
    showStatus(localized('selectionReadingStatus') || 'Reading the selected text…');

    try {
      const permissionPromise = chrome.permissions.request({
        origins: [CHATGPT_ORIGIN]
      });
      const allowed = await permissionPromise;
      if (!allowed) {
        throw new Error(
          localized('chatGptPermissionDeniedError') ||
          'Permission to insert text into ChatGPT was not granted.'
        );
      }

      const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!sourceTab?.id) {
        throw new Error(localized('selectionUnavailableError') || 'The active page could not be read.');
      }

      const selection = await readSelectionFromTab(sourceTab.id);
      if (!selection) {
        throw new Error(
          localized('selectionEmptyError') ||
          'Select text on the page before using this button.'
        );
      }
      if (selection.length > MAX_SELECTION_LENGTH) {
        throw new Error(
          localized('selectionTooLongError', [MAX_SELECTION_LENGTH]) ||
          `The selected text is longer than ${MAX_SELECTION_LENGTH} characters.`
        );
      }

      showStatus(localized('openingChatGptStatus') || 'Opening a new ChatGPT chat…');
      const response = await chrome.runtime.sendMessage({
        type: 'insert-selected-text',
        text: selection
      });
      if (!response?.ok) {
        throw new Error(response?.error || localized('chatGptComposerError') || 'The ChatGPT message field could not be found.');
      }

      showStatus(
        localized('selectionInsertedStatus') ||
        'The selected text was inserted into ChatGPT. Review it and send manually.',
        'success'
      );
    } catch (error) {
      showStatus(String(error?.message || error), 'error');
    } finally {
      running = false;
      button.disabled = false;
    }
  }

  async function readSelectionFromTab(tabId) {
    try {
      const runs = await chrome.scripting.executeScript({
        target: { tabId },
        func: readPageSelection
      });
      return String(runs?.[0]?.result?.text || '').trim();
    } catch (error) {
      console.error('Thread to Markdown: selected text could not be read.', error);
      throw new Error(
        localized('selectionUnavailableError') ||
        'The selected text cannot be read on this page.'
      );
    }
  }

  function readPageSelection() {
    const active = document.activeElement;
    const isTextControl = active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && /^(?:text|search|url|tel|email|password)$/i.test(active.type));

    if (
      isTextControl &&
      Number.isInteger(active.selectionStart) &&
      Number.isInteger(active.selectionEnd) &&
      active.selectionEnd > active.selectionStart
    ) {
      return {
        text: String(active.value || '').slice(active.selectionStart, active.selectionEnd)
      };
    }

    return { text: String(window.getSelection?.()?.toString() || '') };
  }
})();
