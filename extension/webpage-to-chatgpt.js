'use strict';

(() => {
  const button = document.getElementById('send-webpage-to-chatgpt');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MAX_HANDOFF_LENGTH = 30000;
  const MAX_PAGE_TEXT_LENGTH = 27000;
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
    void sendCurrentWebpage();
  });

  async function sendCurrentWebpage() {
    if (running) return;
    running = true;
    button.disabled = true;
    showStatus(localized('webpageReadingStatus') || 'Reading the current webpage…');

    try {
      const allowed = await chrome.permissions.request({
        origins: [CHATGPT_ORIGIN]
      });
      if (!allowed) {
        throw new Error(
          localized('chatGptPermissionDeniedError') ||
          'Permission to insert text into ChatGPT was not granted.'
        );
      }

      const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!sourceTab?.id || !/^https?:\/\//i.test(sourceTab.url || '')) {
        throw new Error(
          localized('webpageUnavailableError') ||
          'The current webpage cannot be read.'
        );
      }

      const page = await readWebpage(sourceTab.id);
      if (!page?.text) {
        throw new Error(
          localized('webpageEmptyError') ||
          'No readable page text was found.'
        );
      }

      const handoffText = buildHandoffText(page);
      if (handoffText.length > MAX_HANDOFF_LENGTH) {
        throw new Error(
          localized('webpageTooLongError', [MAX_HANDOFF_LENGTH]) ||
          `The prepared page content is longer than ${MAX_HANDOFF_LENGTH} characters.`
        );
      }

      showStatus(localized('openingChatGptStatus') || 'Opening a new ChatGPT chat…');
      const response = await chrome.runtime.sendMessage({
        type: 'insert-selected-text',
        text: handoffText
      });
      if (!response?.ok) {
        throw new Error(
          response?.error ||
          localized('chatGptComposerError') ||
          'The ChatGPT message field could not be found.'
        );
      }

      showStatus(
        localized('webpageInsertedStatus') ||
        'The webpage was inserted into ChatGPT. Review it and send manually.',
        'success'
      );
    } catch (error) {
      showStatus(String(error?.message || error), 'error');
    } finally {
      running = false;
      button.disabled = false;
    }
  }

  async function readWebpage(tabId) {
    try {
      const runs = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractReadableWebpage,
        args: [MAX_PAGE_TEXT_LENGTH]
      });
      return runs?.[0]?.result || null;
    } catch (error) {
      console.error('GPT Project & Memory Tools: webpage could not be read.', error);
      throw new Error(
        localized('webpageUnavailableError') ||
        'The current webpage cannot be read.'
      );
    }
  }

  function buildHandoffText(page) {
    const titleLabel = localized('webpagePromptTitle') || 'Title';
    const sourceLabel = localized('webpagePromptSource') || 'Source';
    const contentLabel = localized('webpagePromptContent') || 'Page content';
    const truncatedNote = localized('webpageTruncatedNote') || '[Page text was shortened to fit the limit.]';

    const title = String(page.title || '').trim().slice(0, 500) || titleLabel;
    const url = String(page.url || '').trim().slice(0, 2000);
    const body = String(page.text || '').trim();
    const note = page.truncated ? `\n\n${truncatedNote}` : '';

    return `${titleLabel}: ${title}\n${sourceLabel}: ${url}\n\n${contentLabel}:\n${body}${note}`;
  }

  function extractReadableWebpage(maxLength) {
    const removableSelectors = [
      'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe',
      'object', 'embed', 'nav', 'aside', 'form', 'dialog', '[hidden]',
      '[aria-hidden="true"]', '[role="navigation"]', '[role="banner"]',
      '[role="contentinfo"]', '[role="complementary"]',
      '[class*="cookie" i]', '[id*="cookie" i]',
      '[class*="advert" i]', '[id*="advert" i]',
      '[class*="sidebar" i]', '[id*="sidebar" i]',
      '[class*="social" i]', '[class*="share" i]'
    ];

    const clone = document.body?.cloneNode(true);
    if (!(clone instanceof HTMLElement)) {
      return { title: document.title || '', url: location.href, text: '', truncated: false };
    }

    for (const selector of removableSelectors) {
      try {
        clone.querySelectorAll(selector).forEach((node) => node.remove());
      } catch {
        // Ignore selectors unsupported by an older browser build.
      }
    }

    const candidates = [
      ...clone.querySelectorAll(
        'article, main, [role="main"], .article, .post, .entry-content, .post-content, #content, .content'
      ),
      clone
    ];

    const textFor = (root) => {
      const parts = [];
      const blockTags = new Set([
        'ADDRESS', 'ARTICLE', 'BLOCKQUOTE', 'DIV', 'DL', 'FIELDSET', 'FIGCAPTION',
        'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
        'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL'
      ]);

      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          parts.push(node.nodeValue || '');
          return;
        }
        if (!(node instanceof Element)) return;

        if (node.tagName === 'BR') {
          parts.push('\n');
          return;
        }

        const isBlock = blockTags.has(node.tagName);
        if (isBlock) parts.push('\n');
        if (node.tagName === 'LI') parts.push('- ');
        for (const child of node.childNodes) walk(child);
        if (isBlock) parts.push('\n');
      };

      walk(root);
      return parts
        .join('')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const scoreFor = (node, text) => {
      const linkTextLength = [...node.querySelectorAll('a')]
        .reduce((sum, link) => sum + String(link.textContent || '').trim().length, 0);
      let multiplier = 1;
      if (node.matches('article')) multiplier = 1.35;
      else if (node.matches('main, [role="main"]')) multiplier = 1.25;
      else if (node !== clone) multiplier = 1.12;
      else multiplier = 0.72;
      return (text.length - linkTextLength * 0.55) * multiplier;
    };

    let bestText = '';
    let bestScore = -Infinity;
    const seen = new Set();

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement) || seen.has(candidate)) continue;
      seen.add(candidate);
      const text = textFor(candidate);
      if (!text) continue;
      const score = scoreFor(candidate, text);
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }
    }

    const normalizedLimit = Math.max(1000, Number(maxLength) || 27000);
    let text = bestText;
    let truncated = false;
    if (text.length > normalizedLimit) {
      const cut = text.slice(0, normalizedLimit);
      const boundary = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
      text = cut.slice(0, boundary > normalizedLimit * 0.8 ? boundary : normalizedLimit).trim();
      truncated = true;
    }

    const heading = document.querySelector('h1')?.textContent?.trim();
    return {
      title: String(document.title || heading || '').trim(),
      url: location.href,
      text,
      truncated
    };
  }
})();
