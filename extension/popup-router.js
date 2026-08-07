'use strict';

(async () => {
  const CHATGPT_POPUP = 'sidepanel.html';
  const SITE_POPUP = 'site-tools.html';
  const isChatGptUrl = (value) => /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\//i.test(String(value || ''));

  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {}

  let url = String(tab?.url || tab?.pendingUrl || '');

  if (!url && Number.isInteger(tab?.id)) {
    try {
      const runs = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => location.href
      });
      url = String(runs?.[0]?.result || '');
    } catch {}
  }

  const target = isChatGptUrl(url) ? CHATGPT_POPUP : SITE_POPUP;
  location.replace(chrome.runtime.getURL(target));
})();
