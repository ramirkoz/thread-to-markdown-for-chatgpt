'use strict';

(() => {
  const button = document.getElementById('send-screenshot-to-chatgpt');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MAX_SCREENSHOT_DATA_URL_LENGTH = 12000000;
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
    void sendVisibleScreenshot();
  });

  async function sendVisibleScreenshot() {
    if (running) return;
    running = true;
    button.disabled = true;
    showStatus(localized('screenshotCapturingStatus') || 'Capturing the visible page…');

    try {
      const allowed = await chrome.permissions.request({
        origins: [CHATGPT_ORIGIN]
      });
      if (!allowed) {
        throw new Error(
          localized('chatGptPermissionDeniedError') ||
          'Permission to insert content into ChatGPT was not granted.'
        );
      }

      const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!sourceTab?.id || !Number.isInteger(sourceTab.windowId) || !/^https?:\/\//i.test(sourceTab.url || '')) {
        throw new Error(
          localized('screenshotUnavailableError') ||
          'The visible page cannot be captured.'
        );
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(sourceTab.windowId, {
        format: 'jpeg',
        quality: 92
      });
      if (!/^data:image\/jpeg;base64,/i.test(dataUrl || '')) {
        throw new Error(
          localized('screenshotUnavailableError') ||
          'The visible page cannot be captured.'
        );
      }
      if (dataUrl.length > MAX_SCREENSHOT_DATA_URL_LENGTH) {
        throw new Error(
          localized('screenshotTooLargeError') ||
          'The screenshot is too large to hand off safely.'
        );
      }

      const filename = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      showStatus(localized('openingChatGptStatus') || 'Opening a new ChatGPT chat…');
      const response = await chrome.runtime.sendMessage({
        type: 'insert-screenshot',
        dataUrl,
        filename
      });
      if (!response?.ok) {
        throw new Error(
          response?.error ||
          localized('screenshotAttachmentError') ||
          'The screenshot could not be attached to ChatGPT.'
        );
      }

      showStatus(
        localized('screenshotInsertedStatus') ||
        'The screenshot was attached in ChatGPT. Review it and send manually.',
        'success'
      );
    } catch (error) {
      showStatus(String(error?.message || error), 'error');
    } finally {
      running = false;
      button.disabled = false;
    }
  }
})();
