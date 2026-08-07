'use strict';

(() => {
  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const status = document.getElementById('status');
  const siteName = document.getElementById('site-name');
  const selectionButton = document.getElementById('send-selection');
  const pageButton = document.getElementById('send-page');
  const screenshotButton = document.getElementById('send-screenshot');
  const youtubeButton = document.getElementById('send-youtube');
  let activeTab = null;

  const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));
  const isYoutubeUrl = (value) => /^https:\/\/(?:www\.)?youtube\.com\/(?:watch|shorts\/)/i.test(String(value || ''));

  function setStatus(text, kind = '') {
    status.textContent = text;
    status.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function setBusy(busy) {
    for (const button of [selectionButton, pageButton, screenshotButton, youtubeButton]) {
      if (button && !button.hidden) button.disabled = busy;
    }
  }

  async function ensurePermission() {
    const allowed = await chrome.permissions.contains({ origins: [CHATGPT_ORIGIN] });
    if (allowed) return true;
    return chrome.permissions.request({ origins: [CHATGPT_ORIGIN] });
  }

  async function sendText(text) {
    const value = String(text || '').trim();
    if (!value) throw new Error('Немає тексту для передачі.');
    if (value.length > 30000) throw new Error('Текст завеликий для передачі.');
    const response = await chrome.runtime.sendMessage({ type: 'insert-selected-text', text: value });
    if (!response?.ok) throw new Error(response?.error || 'Не вдалося вставити текст у ChatGPT.');
  }

  async function withAction(label, action) {
    setBusy(true);
    setStatus(label);
    try {
      const allowed = await ensurePermission();
      if (!allowed) throw new Error('Потрібен дозвіл на відкриття ChatGPT.');
      await action();
      setStatus('Готово. Вміст вставлено в новий чат без автоматичного надсилання.', 'success');
    } catch (error) {
      setStatus(String(error?.message || error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function readSelection() {
    if (!activeTab?.id) throw new Error('Не знайдено активну вкладку.');
    const runs = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => String(window.getSelection?.()?.toString?.() || '').trim()
    });
    return String(runs?.[0]?.result || '').trim();
  }

  async function readPage() {
    if (!activeTab?.id) throw new Error('Не знайдено активну вкладку.');
    const runs = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        const clone = document.cloneNode(true);
        clone.querySelectorAll('script,style,noscript,nav,aside,form,button,input,textarea,select,dialog,[aria-hidden="true"],[role="navigation"],[role="banner"],[role="complementary"],[class*="cookie" i],[class*="advert" i],[id*="cookie" i],[id*="advert" i]').forEach((node) => node.remove());
        const root = clone.querySelector('article,main,[role="main"]') || clone.body;
        const text = String(root?.innerText || root?.textContent || '')
          .replace(/\r/g, '')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
          .slice(0, 27000);
        return { title: String(document.title || '').trim(), url: location.href, text };
      }
    });
    return runs?.[0]?.result || null;
  }

  async function readYoutubeTranscript() {
    if (!activeTab?.id) throw new Error('Не знайдено активну вкладку.');
    const runs = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      world: 'MAIN',
      func: async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const timestamp = /^\d{1,2}:\d{2}(?::\d{2})?$/;
        const cleanLines = (raw) => String(raw || '').split(/\r?\n/).map(normalize).filter((line) => line && !timestamp.test(line));
        const selectors = ['ytd-transcript-segment-renderer','ytd-transcript-segment-view-model','yt-transcript-segment-view-model','ytd-transcript-renderer','ytd-transcript-segment-list-renderer','[target-id*="transcript"]'];
        const read = () => {
          let best = [];
          for (const selector of selectors) {
            for (const node of document.querySelectorAll(selector)) {
              const lines = cleanLines(node.innerText || node.textContent || '');
              if (lines.length > best.length) best = lines;
            }
          }
          return best;
        };
        let lines = read();
        if (lines.length < 2) {
          const pattern = /(show\s+transcript|transcript|показати\s+текст\s+відео|текст\s+відео|стенограм|розшифров|расшифров)/iu;
          const controls = [...document.querySelectorAll('button,[role="button"],ytd-button-renderer,tp-yt-paper-button')];
          const target = controls.find((element) => pattern.test(normalize(`${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''}`)));
          try { target?.click?.(); } catch {}
          const deadline = Date.now() + 5000;
          while (lines.length < 2 && Date.now() < deadline) {
            await wait(200);
            lines = read();
          }
        }
        return {
          title: normalize(document.querySelector('h1 yt-formatted-string')?.textContent || document.title.replace(/\s*-\s*YouTube\s*$/i, '')),
          text: lines.join('\n').slice(0, 26000)
        };
      }
    });
    return runs?.[0]?.result || null;
  }

  selectionButton.addEventListener('click', () => {
    void withAction('Зчитую виділений текст…', async () => {
      const text = await readSelection();
      if (!text) throw new Error('Спочатку виділіть текст на сторінці.');
      await sendText(text.slice(0, 30000));
    });
  });

  pageButton.addEventListener('click', () => {
    void withAction('Зчитую поточну сторінку…', async () => {
      const page = await readPage();
      if (!page?.text) throw new Error('Не вдалося зчитати основний текст сторінки.');
      await sendText(`Заголовок: ${page.title}\nДжерело: ${page.url}\n\n${page.text}`.slice(0, 30000));
    });
  });

  screenshotButton.addEventListener('click', () => {
    void withAction('Створюю видимий скриншот…', async () => {
      if (!Number.isInteger(activeTab?.windowId)) throw new Error('Не знайдено активне вікно.');
      const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'jpeg', quality: 92 });
      const filename = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      const response = await chrome.runtime.sendMessage({ type: 'insert-screenshot', dataUrl, filename });
      if (!response?.ok) throw new Error(response?.error || 'Не вдалося прикріпити скриншот.');
    });
  });

  youtubeButton.addEventListener('click', () => {
    void withAction('Зчитую субтитри YouTube…', async () => {
      const transcript = await readYoutubeTranscript();
      if (!transcript?.text) throw new Error('Не вдалося отримати субтитри цього відео.');
      await sendText(`YouTube: ${transcript.title || ''}\n${activeTab.url}\n\n${transcript.text}`.slice(0, 30000));
    });
  });

  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab || null;
    if (!isHttpUrl(activeTab?.url || '')) {
      setStatus('На цій службовій сторінці Chrome інструменти недоступні.', 'error');
      setBusy(true);
      return;
    }
    try { siteName.textContent = new URL(activeTab.url).hostname; } catch { siteName.textContent = 'Поточна сторінка'; }
    youtubeButton.hidden = !isYoutubeUrl(activeTab.url || '');
  })().catch((error) => setStatus(String(error?.message || error), 'error'));
})();
