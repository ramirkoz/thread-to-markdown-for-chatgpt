'use strict';

(() => {
  const button = document.getElementById('send-youtube-subtitles-to-chatgpt');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MAX_TRANSCRIPT_LENGTH = 26000;
  const MAX_HANDOFF_LENGTH = 30000;
  let running = false;

  const uiLanguage = String(chrome.i18n.getUILanguage?.() || 'en').toLowerCase();
  const isUkrainian = uiLanguage.startsWith('uk');
  const labels = isUkrainian ? {
    reading: 'Зчитуємо відкритий транскрипт YouTube…',
    wrongPage: 'Відкрийте відео YouTube і повторіть спробу.',
    unavailable: 'Для цього відео не вдалося отримати субтитри.',
    permission: 'Не надано дозвіл на вставлення вмісту в ChatGPT.',
    opening: 'Відкриваємо новий чат ChatGPT…',
    composer: 'Не вдалося знайти поле повідомлення ChatGPT.',
    inserted: 'Субтитри вставлено в ChatGPT. Перевірте текст і надішліть вручну.',
    title: 'YouTube-відео',
    source: 'Джерело',
    transcript: 'Субтитри',
    shortened: '[Субтитри скорочено відповідно до ліміту.]'
  } : {
    reading: 'Reading the open YouTube transcript…',
    wrongPage: 'Open a YouTube video and try again.',
    unavailable: 'Subtitles could not be obtained for this video.',
    permission: 'Permission to insert content into ChatGPT was not granted.',
    opening: 'Opening a new ChatGPT chat…',
    composer: 'The ChatGPT message field could not be found.',
    inserted: 'The subtitles were inserted into ChatGPT. Review them and send manually.',
    title: 'YouTube video',
    source: 'Source',
    transcript: 'Subtitles',
    shortened: '[Subtitles were shortened to fit the limit.]'
  };

  const showStatus = (message, className = '') => {
    if (typeof setStatus === 'function') setStatus(message, className);
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    void sendOpenTranscript();
  }, true);

  async function sendOpenTranscript() {
    if (running) return;
    running = true;
    button.disabled = true;
    showStatus(labels.reading);

    try {
      const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!sourceTab?.id || !isYoutubeVideoUrl(sourceTab.url || '')) {
        throw new Error(labels.wrongPage);
      }

      const runs = await chrome.scripting.executeScript({
        target: { tabId: sourceTab.id },
        world: 'MAIN',
        func: readYoutubeTranscriptPanel,
        args: [MAX_TRANSCRIPT_LENGTH]
      });
      const result = runs?.[0]?.result;
      if (!result?.text) throw new Error(labels.unavailable);

      const allowed = await chrome.permissions.request({ origins: [CHATGPT_ORIGIN] });
      if (!allowed) throw new Error(labels.permission);

      const shortened = result.truncated ? `\n\n${labels.shortened}` : '';
      const handoff = `${labels.title}: ${String(result.title || '').trim()}\n${labels.source}: ${sourceTab.url || ''}\n\n${labels.transcript}:\n${String(result.text || '').trim()}${shortened}`;
      if (handoff.length > MAX_HANDOFF_LENGTH) throw new Error(labels.unavailable);

      showStatus(labels.opening);
      const response = await chrome.runtime.sendMessage({
        type: 'insert-selected-text',
        text: handoff
      });
      if (!response?.ok) throw new Error(response?.error || labels.composer);
      showStatus(labels.inserted, 'success');
    } catch (error) {
      showStatus(String(error?.message || error), 'error');
    } finally {
      running = false;
      button.disabled = false;
    }
  }

  function isYoutubeVideoUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      return (host === 'youtube.com' || host.endsWith('.youtube.com')) &&
        (url.pathname === '/watch' || url.pathname.startsWith('/shorts/'));
    } catch {
      return false;
    }
  }

  async function readYoutubeTranscriptPanel(maxLength) {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const normalize = (value) => String(value || '').replace(/[ \t\f\v]+/g, ' ').trim();
    const timePattern = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/;
    const timePrefixPattern = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+/;
    const limit = Math.max(2000, Number(maxLength) || 26000);

    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    const cleanLines = (raw) => {
      const output = [];
      for (const rawLine of String(raw || '').split(/\r?\n/)) {
        let line = normalize(rawLine);
        if (!line || timePattern.test(line)) continue;
        line = line.replace(timePrefixPattern, '').trim();
        if (!line) continue;
        if (/^(transcript|транскрипт|текст відео|розшифровка|расшифровка)$/iu.test(line)) continue;
        if (/^(search in video|пошук у відео|show transcript|показати текст відео)$/iu.test(line)) continue;
        if (output[output.length - 1] !== line) output.push(line);
      }
      return output;
    };

    const readSegmentNodes = () => {
      const selectors = [
        'ytd-transcript-segment-renderer',
        'ytd-transcript-segment-view-model',
        'yt-transcript-segment-view-model',
        '[class*="transcript-segment"]',
        '[class*="segment-text"]'
      ];
      const nodes = [];
      const seenNodes = new Set();
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          if (!seenNodes.has(node) && visible(node)) {
            seenNodes.add(node);
            nodes.push(node);
          }
        }
      }

      const lines = [];
      for (const node of nodes) {
        for (const line of cleanLines(node.innerText || node.textContent || '')) {
          if (!lines.includes(line)) lines.push(line);
        }
      }
      return lines;
    };

    const readPanelText = () => {
      const selectors = [
        'ytd-engagement-panel-section-list-renderer[target-id*="transcript"]',
        '[target-id*="transcript"]',
        'ytd-transcript-renderer',
        '[id*="transcript"]'
      ];
      for (const selector of selectors) {
        for (const panel of document.querySelectorAll(selector)) {
          if (!visible(panel)) continue;
          const raw = String(panel.innerText || panel.textContent || '');
          const timestamps = raw.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) || [];
          const lines = cleanLines(raw);
          if (timestamps.length >= 2 && lines.length >= 2) return lines;
        }
      }
      return [];
    };

    const readNow = () => {
      const segmentLines = readSegmentNodes();
      if (segmentLines.length >= 2) return segmentLines;
      return readPanelText();
    };

    let lines = readNow();
    if (lines.length < 2) {
      const transcriptPattern = /(show\s+transcript|transcript|показати\s+текст\s+відео|текст\s+відео|стенограм|розшифров|расшифров)/iu;
      const controls = [...document.querySelectorAll('button, [role="button"], ytd-button-renderer, tp-yt-paper-button')];
      const target = controls.find((element) => visible(element) && transcriptPattern.test(normalize(`${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''}`)));
      try { target?.click?.(); } catch {}

      const deadline = Date.now() + 6000;
      while (lines.length < 2 && Date.now() < deadline) {
        await wait(200);
        lines = readNow();
      }
    }

    if (lines.length < 2) return { text: '' };

    let text = lines.join('\n').trim();
    let truncated = false;
    if (text.length > limit) {
      const cut = text.slice(0, limit);
      const boundary = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
      text = cut.slice(0, boundary > limit * 0.8 ? boundary : limit).trim();
      truncated = true;
    }

    const title = normalize(
      document.querySelector('h1 yt-formatted-string')?.textContent ||
      document.querySelector('h1.ytd-watch-metadata')?.textContent ||
      document.title.replace(/\s*-\s*YouTube\s*$/i, '')
    );

    return { title, text, truncated, source: 'open-transcript-panel' };
  }
})();
