'use strict';

annotateAssistantOutputCards = function annotateAssistantOutputCardsWithDownloadButton(
  selectedIndices
) {
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const supportedExtension = '(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)';
  const compactFilenamePattern = new RegExp(
    `[^\\s<>:"/\\\\|?*()\\[\\]{}'“”«»]+\\.${supportedExtension}`,
    'giu'
  );
  const fullLinePattern = new RegExp(`\\.${supportedExtension}$`, 'iu');

  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const normalize = (value) => cleanText(value)
    .replace(/\\([_*`~[\]()])/g, '$1')
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .normalize('NFKC')
    .toLocaleLowerCase();

  const cleanFilename = (value) => cleanText(value)
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  const addFilename = (results, seen, value) => {
    const filename = cleanFilename(value);
    const key = normalize(filename);
    if (!filename || !key || seen.has(key) || !fullLinePattern.test(filename)) return;
    seen.add(key);
    results.push(filename);
  };

  const extractFilenames = (root) => {
    const results = [];
    const seen = new Set();
    const textNodes = [
      root,
      ...root.querySelectorAll(
        'a, button, [role="button"], [role="link"], [download], span, p, div'
      )
    ];

    for (const element of textNodes) {
      const raw = String(element?.innerText || element?.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n?/g, '\n');

      for (const sourceLine of raw.split('\n')) {
        const line = cleanText(sourceLine)
          .replace(/^(?:PDF|DOCX?|XLSX?|PPTX?|ZIP|TXT|CSV|JSON|MD|HTML?)\s+/iu, '')
          .trim();
        if (!line) continue;

        if (line.length <= 180 && fullLinePattern.test(line)) {
          addFilename(results, seen, line);
        }

        for (const match of line.matchAll(compactFilenamePattern)) {
          addFilename(results, seen, match[0]);
        }
      }
    }

    return results;
  };

  const main = document.querySelector('main') || document.body;
  const roots = [];
  const seenRoots = new Set();

  for (const roleNode of main.querySelectorAll('[data-message-author-role]')) {
    const root = roleNode.closest(
      'article, [data-testid^="conversation-turn-"], [data-message-id], [class*="group/conversation-turn"]'
    ) || roleNode;
    if (seenRoots.has(root)) continue;
    seenRoots.add(root);
    roots.push(root);
  }

  if (!roots.length) {
    for (const root of main.querySelectorAll(
      '[data-testid^="conversation-turn-"], [data-message-id], article, [class*="group/conversation-turn"]'
    )) {
      if (seenRoots.has(root)) continue;
      seenRoots.add(root);
      roots.push(root);
    }
  }

  const buttonSelector = [
    'button', '[role="button"]', 'a[download]', 'a[href]',
    '[data-testid*="download"]', '[data-download-url]', '[data-href]', '[data-url]'
  ].join(',');

  const rect = (element) => element?.getBoundingClientRect?.() || null;

  const isVisible = (element) => {
    const bounds = rect(element);
    if (!bounds || bounds.width < 1 || bounds.height < 1) return false;
    const style = globalThis.getComputedStyle?.(element);
    return !style || (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) > 0
    );
  };

  const verticalOverlap = (first, second) => {
    const a = rect(first);
    const b = rect(second);
    if (!a || !b) return 0;
    return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  };

  const descriptorFor = (element) => normalize([
    element?.getAttribute?.('aria-label'),
    element?.getAttribute?.('title'),
    element?.getAttribute?.('download'),
    element?.getAttribute?.('data-testid'),
    element?.getAttribute?.('data-href'),
    element?.getAttribute?.('data-url'),
    element?.getAttribute?.('data-download-url'),
    element?.textContent
  ].filter(Boolean).join(' '));

  const isMessageAction = (element) => {
    const descriptor = descriptorFor(element);
    return /(copy|copied|good response|bad response|read aloud|share|regenerate|retry|more actions|копіювати|подобається|не подобається|озвучити|поділитися|повторити|інші дії)/iu.test(descriptor);
  };

  const cardScore = (container, filenameElement, filename) => {
    const bounds = rect(container);
    const fileBounds = rect(filenameElement);
    if (!bounds || !fileBounds || bounds.width < 120 || bounds.height < 32) return -Infinity;
    if (bounds.height > 260 || bounds.width > 1000) return -Infinity;

    const buttons = [...container.querySelectorAll(buttonSelector)]
      .filter((element) =>
        element !== filenameElement &&
        !isMessageAction(element) &&
        isVisible(element)
      );
    if (!buttons.length) return -Infinity;

    const text = normalize(container.textContent);
    if (!text.includes(normalize(filename))) return -Infinity;

    let score = 0;
    score += Math.max(0, 150 - bounds.height);
    score += Math.max(0, 100 - bounds.width / 10);
    score += Math.min(60, buttons.length * 20);
    if (buttons.some((button) => /(download|завантаж)/iu.test(descriptorFor(button)))) score += 140;
    if (buttons.some((button) => verticalOverlap(button, filenameElement) > 8)) score += 100;
    if (bounds.height >= 40 && bounds.height <= 120) score += 80;
    return score;
  };

  const buttonScore = (button, filenameElement, card, filename) => {
    const buttonBounds = rect(button);
    const fileBounds = rect(filenameElement);
    const cardBounds = rect(card);
    if (!buttonBounds || !fileBounds || !cardBounds || !isVisible(button)) return -Infinity;
    if (isMessageAction(button)) return -Infinity;

    const descriptor = descriptorFor(button);
    let score = 0;
    if (descriptor.includes(normalize(filename))) score += 200;
    if (/(download|завантаж)/iu.test(descriptor)) score += 220;
    if (/(file|attachment|файл|вкладенн)/iu.test(descriptor)) score += 90;
    if (button.matches?.('button, [role="button"]')) score += 70;
    if (button.matches?.('a[download], [data-download-url]')) score += 120;
    if (button.matches?.('a[href], [data-href], [data-url]')) score += 60;
    if (button.querySelector?.('svg')) score += 40;

    const overlap = verticalOverlap(button, filenameElement);
    score += Math.min(120, overlap * 5);
    if (buttonBounds.left >= fileBounds.right - 18) score += 120;
    if (buttonBounds.left >= cardBounds.left + cardBounds.width * 0.55) score += 80;
    if (buttonBounds.width <= 96 && buttonBounds.height <= 96) score += 60;
    if (!cleanText(button.textContent)) score += 50;

    const dx = Math.abs((buttonBounds.left + buttonBounds.width / 2) - fileBounds.right);
    const dy = Math.abs(
      (buttonBounds.top + buttonBounds.height / 2) -
      (fileBounds.top + fileBounds.height / 2)
    );
    score += Math.max(0, 140 - Math.hypot(dx, dy) / 2);
    return score;
  };

  const annotateButton = (button, filename) => {
    const existing = cleanText(button.getAttribute?.('aria-label'));
    button.setAttribute(
      'aria-label',
      existing.includes(filename) ? existing : cleanText(`${existing} Download file ${filename}`)
    );
    button.setAttribute('data-thread-export-filename', filename);
    button.setAttribute('data-thread-export-download-button', 'true');
  };

  const clickElement = (element) => {
    if (!element || !element.isConnected) return;
    try {
      element.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      element.click?.();
    } catch (_) {
      try {
        element.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        }));
      } catch (_) {}
    }
  };

  const createProxy = (root, filename, candidates) => {
    const existing = [...root.querySelectorAll('[data-thread-export-proxy="true"]')]
      .find((element) =>
        normalize(element.getAttribute('data-thread-export-filename')) === normalize(filename)
      );
    if (existing) return existing;

    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.setAttribute('aria-label', `Download file ${filename}`);
    proxy.setAttribute('data-thread-export-filename', filename);
    proxy.setAttribute('data-thread-export-proxy', 'true');
    proxy.style.cssText = [
      'position:absolute', 'width:1px', 'height:1px', 'padding:0', 'margin:0',
      'opacity:0', 'overflow:hidden', 'pointer-events:none', 'clip-path:inset(50%)'
    ].join(';');

    const ordered = candidates.slice(0, 8);
    proxy.addEventListener('click', async () => {
      for (const candidate of ordered) {
        if (!candidate || candidate === proxy || !candidate.isConnected) continue;
        clickElement(candidate);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    });

    root.appendChild(proxy);
    return proxy;
  };

  let annotated = 0;
  let boundButtons = 0;
  let proxies = 0;

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;

    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    const filenames = extractFilenames(root);

    for (const filename of filenames) {
      const wanted = normalize(filename);
      const filenameElements = [...root.querySelectorAll(
        'a, button, [role="button"], [role="link"], [download], div, span, p'
      )]
        .filter((element) => normalize(element.textContent).includes(wanted))
        .sort(
          (first, second) =>
            cleanText(first.textContent).length - cleanText(second.textContent).length
        )
        .slice(0, 20);

      let best = null;

      for (const filenameElement of filenameElements) {
        let container = filenameElement;
        for (let depth = 0; container && depth < 10; depth += 1) {
          const score = cardScore(container, filenameElement, filename);
          if (Number.isFinite(score) && (!best || score > best.cardScore)) {
            best = { card: container, filenameElement, cardScore: score };
          }
          if (container === root) break;
          container = container.parentElement;
        }
      }

      if (!best) continue;

      const buttons = [...best.card.querySelectorAll(buttonSelector)]
        .filter((button) => button !== best.filenameElement);
      const ranked = buttons
        .map((button) => ({
          button,
          score: buttonScore(button, best.filenameElement, best.card, filename)
        }))
        .filter((item) => Number.isFinite(item.score))
        .sort((first, second) => second.score - first.score);

      if (ranked.length && ranked[0].score >= 100) {
        annotateButton(ranked[0].button, filename);
        best.card.setAttribute('data-thread-export-file-card', filename);
        best.filenameElement.setAttribute('data-thread-export-filename-label', filename);
        annotated += 1;
        boundButtons += 1;
        continue;
      }

      if (createProxy(root, filename, ranked.map((item) => item.button))) {
        annotated += 1;
        proxies += 1;
      }
    }
  });

  return { annotated, boundButtons, proxies };
};
