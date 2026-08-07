'use strict';

(() => {
  const statusNode = document.getElementById('status');
  if (!statusNode) return;

  const wrongPageMessage = chrome.i18n.getMessage('wrongPageError') || 'Open a ChatGPT conversation first.';
  let externalPage = false;

  const clearWrongPageStatus = () => {
    if (!externalPage) return;
    if (statusNode.textContent.trim() !== wrongPageMessage.trim()) return;
    statusNode.textContent = '';
    statusNode.className = '';
  };

  const observer = new MutationObserver(clearWrongPageStatus);
  observer.observe(statusNode, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
  });

  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    const url = String(tab?.url || '');
    externalPage = !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(url);
    clearWrongPageStatus();
  }).catch(() => {});
})();
