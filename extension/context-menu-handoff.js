'use strict';

(() => {
  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MENU_ROOT = 'ttm-site-tools';
  const MENU_SELECTION = 'ttm-send-selection';
  const MENU_PAGE = 'ttm-send-page';
  const MENU_SCREENSHOT = 'ttm-send-screenshot';
  const MENU_YOUTUBE = 'ttm-send-youtube';
  const SIDE_PANEL_PATH = 'sidepanel.html';
  const isUkrainian = String(chrome.i18n.getUILanguage?.() || 'en').toLowerCase().startsWith('uk');

  const labels = isUkrainian ? {
    root: 'GPT Project & Memory Tools: передати в ChatGPT',
    selection: 'Виділений текст',
    page: 'Поточну сторінку',
    screenshot: 'Видимий скриншот',
    youtube: 'Субтитри YouTube',
    permission: 'Потрібен дозвіл на відкриття ChatGPT.',
    selectionEmpty: 'Спочатку виділіть текст.',
    pageFailed: 'Не вдалося зчитати сторінку.',
    screenshotFailed: 'Не вдалося створити скриншот.',
    youtubeFailed: 'Не вдалося отримати субтитри YouTube.',
    chatgptOnly: 'Інструменти експорту ChatGPT доступні через верхній ярлик розширення.'
  } : {
    root: 'GPT Project & Memory Tools: send to ChatGPT',
    selection: 'Selected text',
    page: 'Current webpage',
    screenshot: 'Visible screenshot',
    youtube: 'YouTube subtitles',
    permission: 'Permission to open ChatGPT is required.',
    selectionEmpty: 'Select text first.',
    pageFailed: 'The webpage could not be read.',
    screenshotFailed: 'The screenshot could not be captured.',
    youtubeFailed: 'YouTube subtitles could not be obtained.',
    chatgptOnly: 'ChatGPT export tools are available from the extension toolbar button.'
  };

  const isChatGptUrl = (value) => /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\//i.test(String(value || ''));
  const isWebUrl = (value) => /^https?:\/\//i.test(String(value || ''));
  const isYoutubeUrl = (value) => /^https:\/\/(?:www\.)?youtube\.com\/(?:watch|shorts\/)/i.test(String(value || ''));

  async function createMenus() {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: MENU_ROOT, title: labels.root, contexts: ['all'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
    chrome.contextMenus.create({ id: MENU_SELECTION, parentId: MENU_ROOT, title: labels.selection, contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
    chrome.contextMenus.create({ id: MENU_PAGE, parentId: MENU_ROOT, title: labels.page, contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
    chrome.contextMenus.create({ id: MENU_SCREENSHOT, parentId: MENU_ROOT, title: labels.screenshot, contexts: ['page'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
    chrome.contextMenus.create({ id: MENU_YOUTUBE, parentId: MENU_ROOT, title: labels.youtube, contexts: ['page'], documentUrlPatterns: ['https://*.youtube.com/*', 'https://youtube.com/*'] });
  }

  async function configureSidePanel() {
    if (!chrome.sidePanel) return;
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.warn('GPT Project & Memory Tools: side panel behavior could not be configured.', error);
    }
  }

  async function updateTabUi(tabId, url) {
    if (!Number.isInteger(tabId)) return;
    const chatgpt = isChatGptUrl(url);
    const web = isWebUrl(url);

    try {
      if (chatgpt) await chrome.action.enable(tabId);
      else await chrome.action.disable(tabId);
      await chrome.action.setTitle({
        tabId,
        title: chatgpt ? (chrome.i18n.getMessage('actionTitle') || 'GPT Project & Memory Tools') : labels.chatgptOnly
      });
    } catch {}

    if (chrome.sidePanel) {
      try {
        await chrome.sidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: chatgpt });
      } catch {}
    }

    try {
      await chrome.contextMenus.update(MENU_ROOT, { visible: web && !chatgpt });
      await chrome.contextMenus.update(MENU_YOUTUBE, { visible: web && !chatgpt && isYoutubeUrl(url) });
    } catch {}
  }

  async function syncActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await updateTabUi(tab.id, tab.url || '');
  }

  async function ensureChatGptPermission() {
    const alreadyAllowed = await chrome.permissions.contains({ origins: [CHATGPT_ORIGIN] });
    if (alreadyAllowed) return true;
    try {
      return await chrome.permissions.request({ origins: [CHATGPT_ORIGIN] });
    } catch {
      return false;
    }
  }

  async function showPageToast(tabId, message, error = true) {
    if (!Number.isInteger(tabId)) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (text, isError) => {
          const previous = document.getElementById('thread-to-markdown-toast');
          previous?.remove();
          const toast = document.createElement('div');
          toast.id = 'thread-to-markdown-toast';
          toast.textContent = String(text || '');
          Object.assign(toast.style, {
            position: 'fixed',
            right: '18px',
            bottom: '18px',
            zIndex: '2147483647',
            maxWidth: '360px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: isError ? '#7f1d1d' : '#14532d',
            color: '#fff',
            font: '600 13px/1.4 system-ui, sans-serif',
            boxShadow: '0 10px 30px rgba(0,0,0,.25)'
          });
          document.documentElement.append(toast);
          window.setTimeout(() => toast.remove(), 4200);
        },
        args: [String(message || ''), Boolean(error)]
      });
    } catch {}
  }

  async function sendTextToChatGpt(text, sourceTabId) {
    const allowed = await ensureChatGptPermission();
    if (!allowed) throw new Error(labels.permission);
    if (typeof handleSelectedTextHandoff !== 'function') throw new Error(labels.pageFailed);
    return handleSelectedTextHandoff(text);
  }

  async function handleSelection(info, tab) {
    const text = String(info.selectionText || '').trim();
    if (!text) throw new Error(labels.selectionEmpty);
    await sendTextToChatGpt(text.slice(0, 30000), tab?.id);
  }

  async function handlePage(tab) {
    if (!tab?.id) throw new Error(labels.pageFailed);
    const runs = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractReadablePageForContextMenu
    });
    const result = runs?.[0]?.result;
    if (!result?.text) throw new Error(labels.pageFailed);
    const handoff = `${result.title}\n${result.url}\n\n${result.text}`.trim().slice(0, 30000);
    await sendTextToChatGpt(handoff, tab.id);
  }

  async function handleScreenshot(tab) {
    if (!tab?.id || !Number.isInteger(tab.windowId)) throw new Error(labels.screenshotFailed);
    const allowed = await ensureChatGptPermission();
    if (!allowed) throw new Error(labels.permission);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 });
    if (!dataUrl) throw new Error(labels.screenshotFailed);
    if (typeof handleScreenshotHandoff !== 'function') throw new Error(labels.screenshotFailed);
    const filename = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    await handleScreenshotHandoff(dataUrl, filename);
  }

  async function handleYoutube(tab) {
    if (!tab?.id || !isYoutubeUrl(tab.url || '')) throw new Error(labels.youtubeFailed);
    const runs = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: extractYoutubeTranscriptForContextMenu
    });
    const result = runs?.[0]?.result;
    if (!result?.text) throw new Error(labels.youtubeFailed);
    const handoff = `YouTube: ${result.title || ''}\n${tab.url || ''}\n\n${result.text}`.trim().slice(0, 30000);
    await sendTextToChatGpt(handoff, tab.id);
  }

  function extractReadablePageForContextMenu() {
    const clone = document.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, nav, aside, form, button, input, textarea, select, dialog, [aria-hidden="true"], [role="navigation"], [role="banner"], [role="complementary"], [class*="cookie" i], [class*="advert" i], [id*="cookie" i], [id*="advert" i]').forEach((node) => node.remove());
    const root = clone.querySelector('article, main, [role="main"]') || clone.body;
    const text = String(root?.innerText || root?.textContent || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
      .slice(0, 26000);
    return {
      title: String(document.title || '').trim(),
      url: location.href,
      text
    };
  }

  async function extractYoutubeTranscriptForContextMenu() {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const timestamp = /^\d{1,2}:\d{2}(?::\d{2})?$/;

    const clean = (raw) => {
      const lines = [];
      for (const rawLine of String(raw || '').split(/\r?\n/)) {
        let line = normalize(rawLine);
        if (!line || timestamp.test(line)) continue;
        line = line.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, '').trim();
        if (!line) continue;
        if (lines[lines.length - 1] !== line) lines.push(line);
      }
      return lines;
    };

    const readTranscript = () => {
      const selectors = [
        'ytd-transcript-segment-renderer',
        'ytd-transcript-segment-view-model',
        'yt-transcript-segment-view-model',
        '[target-id*="transcript"]',
        'ytd-transcript-renderer',
        'ytd-transcript-segment-list-renderer'
      ];
      let best = [];
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          const lines = clean(node.innerText || node.textContent || '');
          if (lines.length > best.length) best = lines;
        }
      }
      return best;
    };

    let lines = readTranscript();
    if (lines.length < 2) {
      const pattern = /(show\s+transcript|transcript|показати\s+текст\s+відео|текст\s+відео|стенограм|розшифров|расшифров)/iu;
      const controls = [...document.querySelectorAll('button, [role="button"], ytd-button-renderer, tp-yt-paper-button')];
      const target = controls.find((element) => pattern.test(normalize(`${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''}`)));
      try { target?.click?.(); } catch {}
      const deadline = Date.now() + 5500;
      while (lines.length < 2 && Date.now() < deadline) {
        await wait(200);
        lines = readTranscript();
      }
    }

    if (lines.length < 2) return { text: '' };
    return {
      title: normalize(document.querySelector('h1 yt-formatted-string')?.textContent || document.title.replace(/\s*-\s*YouTube\s*$/i, '')),
      text: lines.join('\n').slice(0, 26000)
    };
  }

  chrome.runtime.onInstalled.addListener(() => {
    void createMenus().then(syncActiveTab).catch(console.error);
    void configureSidePanel();
  });

  chrome.runtime.onStartup.addListener(() => {
    void createMenus().then(syncActiveTab).catch(console.error);
    void configureSidePanel();
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void chrome.tabs.get(tabId).then((tab) => updateTabUi(tabId, tab.url || '')).catch(() => {});
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      void updateTabUi(tabId, tab.url || changeInfo.url || '');
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const run = async () => {
      if (isChatGptUrl(tab?.url || '')) return;
      if (info.menuItemId === MENU_SELECTION) return handleSelection(info, tab);
      if (info.menuItemId === MENU_PAGE) return handlePage(tab);
      if (info.menuItemId === MENU_SCREENSHOT) return handleScreenshot(tab);
      if (info.menuItemId === MENU_YOUTUBE) return handleYoutube(tab);
    };

    void run().catch((error) => {
      console.error('GPT Project & Memory Tools: context-menu handoff failed.', error);
      void showPageToast(tab?.id, String(error?.message || error), true);
    });
  });

  void createMenus().then(syncActiveTab).catch(() => {});
  void configureSidePanel();
})();
