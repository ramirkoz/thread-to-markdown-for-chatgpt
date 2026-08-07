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
        const uiNoise = /^(?:текст відео|пошук у текстовій версії|transcript|show transcript|search transcript)$/iu;

        const visible = (node) => {
          if (!(node instanceof Element)) return false;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const cleanText = (value) => normalize(value)
          .replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, '')
          .trim();

        const addUnique = (list, value) => {
          const text = cleanText(value);
          if (!text || timestamp.test(text) || uiNoise.test(text)) return;
          if (text.length < 2) return;
          if (list[list.length - 1] !== text) list.push(text);
        };

        const readKnownSegments = () => {
          const lines = [];
          const segmentSelectors = [
            'ytd-transcript-segment-renderer',
            'ytd-transcript-segment-view-model',
            'yt-transcript-segment-view-model',
            '[class*="transcript-segment"]',
            '[class*="segment-item"]'
          ];
          const textSelectors = [
            '.segment-text',
            '[class*="segment-text"]',
            'yt-formatted-string[class*="segment"]',
            '[class*="cue"]'
          ];

          for (const selector of segmentSelectors) {
            for (const segment of document.querySelectorAll(selector)) {
              if (!visible(segment)) continue;
              let found = '';
              for (const textSelector of textSelectors) {
                const node = segment.querySelector(textSelector);
                const candidate = cleanText(node?.innerText || node?.textContent || '');
                if (candidate && !uiNoise.test(candidate) && !timestamp.test(candidate)) {
                  found = candidate;
                  break;
                }
              }
              if (!found) {
                const parts = String(segment.innerText || segment.textContent || '')
                  .split(/\r?\n/)
                  .map(cleanText)
                  .filter((part) => part && !timestamp.test(part) && !uiNoise.test(part));
                found = parts.join(' ');
              }
              addUnique(lines, found);
            }
          }
          return lines;
        };

        const readVisibleTimedRows = () => {
          const lines = [];
          const candidates = [...document.querySelectorAll('span,div,p,button')]
            .filter((node) => visible(node) && timestamp.test(normalize(node.textContent || '')));

          for (const timeNode of candidates) {
            let row = timeNode.closest('ytd-transcript-segment-renderer, ytd-transcript-segment-view-model, yt-transcript-segment-view-model, [class*="transcript-segment"], [class*="segment-item"], [role="button"]');
            if (!row) row = timeNode.parentElement;
            if (!row) continue;

            let text = '';
            const preferred = row.querySelector?.('.segment-text, [class*="segment-text"], yt-formatted-string, [class*="cue"]');
            if (preferred && preferred !== timeNode) text = preferred.innerText || preferred.textContent || '';

            if (!cleanText(text) || timestamp.test(cleanText(text))) {
              const parts = String(row.innerText || row.textContent || '')
                .split(/\r?\n/)
                .map(cleanText)
                .filter((part) => part && !timestamp.test(part) && !uiNoise.test(part));
              text = parts.join(' ');
            }
            addUnique(lines, text);
          }
          return lines;
        };

        const readTranscript = () => {
          const known = readKnownSegments();
          const timed = readVisibleTimedRows();
          return timed.length > known.length ? timed : known;
        };

        let lines = readTranscript();
        if (lines.length < 2) {
          const pattern = /(show\s+transcript|transcript|показати\s+текст\s+відео|текст\s+відео|стенограм|розшифров|расшифров)/iu;
          const controls = [...document.querySelectorAll('button,[role="button"],ytd-button-renderer,tp-yt-paper-button')]
            .filter(visible);
          const target = controls.find((element) => pattern.test(normalize(`${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''}`)));
          try { target?.click?.(); } catch {}

          const deadline = Date.now() + 5500;
          while (lines.length < 2 && Date.now() < deadline) {
            await wait(200);
            lines = readTranscript();
          }
        }

        return {
          title: normalize(document.querySelector('h1 yt-formatted-string')?.textContent || document.title.replace(/\s*-\s*YouTube\s*$/i, '')),
          text: lines.length >= 2 ? lines.join('\n').slice(0, 26000) : ''
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
