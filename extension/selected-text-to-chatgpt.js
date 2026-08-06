'use strict';

(() => {
  const button = document.getElementById('send-selection-to-chatgpt');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const CHATGPT_URL = 'https://chatgpt.com/';
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
      const allowed = await ensureChatGptPermission();
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
      const targetTab = await chrome.tabs.create({ url: CHATGPT_URL, active: true });
      if (!targetTab?.id) {
        throw new Error(localized('chatGptOpenError') || 'ChatGPT could not be opened.');
      }

      await waitForTabReady(targetTab.id, 25000);
      const runs = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: insertIntoChatGptComposer,
        args: [selection]
      });
      const result = runs?.[0]?.result;
      if (!result?.inserted) {
        throw new Error(
          localized('chatGptComposerError') ||
          'The ChatGPT message field could not be found.'
        );
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

  async function ensureChatGptPermission() {
    const request = { origins: [CHATGPT_ORIGIN] };
    if (await chrome.permissions.contains(request)) return true;
    return chrome.permissions.request(request);
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

  async function waitForTabReady(tabId, timeoutMs) {
    const current = await chrome.tabs.get(tabId);
    if (current?.status === 'complete') {
      await delay(500);
      return;
    }

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
        clearTimeout(timer);
        callback();
      };
      const onUpdated = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          finish(resolve);
        }
      };
      const onRemoved = (removedTabId) => {
        if (removedTabId === tabId) {
          finish(() => reject(new Error(localized('chatGptOpenError') || 'ChatGPT was closed before it loaded.')));
        }
      };
      const timer = setTimeout(() => {
        finish(() => reject(new Error(localized('chatGptLoadTimeoutError') || 'ChatGPT took too long to load.')));
      }, timeoutMs);

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });
    await delay(500);
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

  async function insertIntoChatGptComposer(text) {
    const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    const selectors = [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'form textarea',
      'form [contenteditable="true"]',
      'main textarea',
      'main [contenteditable="true"]'
    ];

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };

    const findComposer = () => {
      for (const selector of selectors) {
        const candidates = [...document.querySelectorAll(selector)];
        const target = candidates.find((element) => isVisible(element) && !element.disabled);
        if (target) return target;
      }
      return null;
    };

    const dispatchInput = (element, value) => {
      try {
        element.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: value
        }));
      } catch {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const setControlValue = (element, value) => {
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
      dispatchInput(element, value);
    };

    const setEditableValue = (element, value) => {
      element.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, value);
      } catch {
        inserted = false;
      }

      if (!inserted) {
        const fragment = document.createDocumentFragment();
        const lines = String(value).split('\n');
        for (const line of lines) {
          const paragraph = document.createElement('p');
          if (line) paragraph.textContent = line;
          else paragraph.append(document.createElement('br'));
          fragment.append(paragraph);
        }
        element.replaceChildren(fragment);
      }

      dispatchInput(element, value);
      selection?.removeAllRanges();
      element.focus();
    };

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const composer = findComposer();
      if (composer) {
        if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
          setControlValue(composer, text);
        } else {
          setEditableValue(composer, text);
        }
        composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { inserted: true };
      }
      await wait(250);
    }

    return { inserted: false };
  }
})();
