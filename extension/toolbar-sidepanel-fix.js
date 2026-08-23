'use strict';

(() => {
  const SIDE_PANEL_PATH = 'sidepanel.html';

  const isChatGptUrl = (value) => /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\//i.test(String(value || ''));

  async function openChatGptSidePanel(tab) {
    if (!tab?.id || !isChatGptUrl(tab.url || '')) return;
    if (!chrome.sidePanel?.open) {
      throw new Error('Chrome side panel API is unavailable.');
    }

    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: SIDE_PANEL_PATH,
      enabled: true
    });

    await chrome.sidePanel.open({ tabId: tab.id });
  }

  chrome.action.onClicked.addListener((tab) => {
    void openChatGptSidePanel(tab).catch((error) => {
      console.error('GPT Project & Memory Tools: toolbar side panel could not be opened.', error);
    });
  });
})();
