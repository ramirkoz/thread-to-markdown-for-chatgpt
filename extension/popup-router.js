'use strict';

(() => {
  const CHATGPT_POPUP = 'sidepanel.html';
  const SITE_POPUP = 'site-tools.html';

  const isChatGptUrl = (value) => /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\//i.test(String(value || ''));

  async function setPopupForTab(tabId, url) {
    if (!Number.isInteger(tabId)) return;
    const popup = isChatGptUrl(url) ? CHATGPT_POPUP : SITE_POPUP;
    try {
      await chrome.action.enable(tabId);
      await chrome.action.setPopup({ tabId, popup });
    } catch (error) {
      console.warn('Thread to Markdown: popup routing failed.', error);
    }
  }

  async function syncTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await setPopupForTab(tabId, tab?.url || '');
    } catch {}
  }

  async function syncActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await setPopupForTab(tab.id, tab.url || '');
    } catch {}
  }

  chrome.runtime.onInstalled.addListener(() => { void syncActiveTab(); });
  chrome.runtime.onStartup.addListener(() => { void syncActiveTab(); });
  chrome.tabs.onActivated.addListener(({ tabId }) => { void syncTab(tabId); });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      void setPopupForTab(tabId, tab?.url || changeInfo.url || '');
    }
  });

  void syncActiveTab();
})();
