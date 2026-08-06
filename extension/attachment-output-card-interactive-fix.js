'use strict';

const interactiveCardBaseAnnotate = annotateAssistantOutputCards;

if (typeof interactiveCardBaseAnnotate !== 'function') {
  throw new Error('Generated-file card annotation was not initialized.');
}

annotateAssistantOutputCards = function annotateAssistantOutputCardsWithInteractiveControl(
  selectedIndices
) {
  const baseResult = interactiveCardBaseAnnotate(selectedIndices) || {};
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const extensionPattern = '(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)';
  const filenamePattern = new RegExp(
    `[^\\n<>:"/\\\\|?*]{1,180}\\.${extensionPattern}`,
    'giu'
  );
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

  const interactiveSelector = [
    'button', '[role="button"]', 'a[href]', 'a[download]',
    '[tabindex]:not([tabindex="-1"])', '[onclick]',
    '[data-testid*="download"]', '[data-download-url]', '[data-href]', '[data-url]',
    '[class*="cursor-pointer"]', '[class*="download"]'
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
    element?.getAttribute?.('data-download-url'),
    element?.getAttribute?.('data-href'),
    element?.getAttribute?.('data-url'),
    element?.textContent
  ].filter(Boolean).join(' '));
  const isMessageAction = (element) => /(copy|copied|good response|bad response|read aloud|share|regenerate|retry|more actions|копіювати|подобається|не подобається|озвучити|поділитися|повторити|інші дії)/iu
    .test(descriptorFor(element));

  const textFilenameEntries = (root) => {
    const results = [];
    const seen = new Set();
    const walker = document.createTreeWalker(root, 4);
    let node = walker.nextNode();
    while (node) {
      const raw = String(node.nodeValue || '').replace(/\r\n?/g, '\n');
      for (const line of raw.split('\n')) {
        for (const match of line.matchAll(filenamePattern)) {
          const filename = cleanFilename(match[0]);
          const key = normalize(filename);
          if (!filename || !key || seen.has(`${key}|${results.length}`)) continue;
          seen.add(`${key}|${results.length}`);
          results.push({ filename, element: node.parentElement });
        }
      }
      node = walker.nextNode();
    }
    return results;
  };

  const candidateScore = (candidate, filenameElement, card, filename) => {
    if (!candidate || !isVisible(candidate) || isMessageAction(candidate)) return -Infinity;
    const candidateBounds = rect(candidate);
    const filenameBounds = rect(filenameElement);
    const cardBounds = rect(card);
    if (!candidateBounds || !filenameBounds || !cardBounds) return -Infinity;

    const descriptor = descriptorFor(candidate);
    let score = 0;
    if (descriptor.includes(normalize(filename))) score += 240;
    if (/(download|завантаж)/iu.test(descriptor)) score += 260;
    if (/(file|attachment|файл|вкладенн)/iu.test(descriptor)) score += 90;
    if (candidate.matches?.('button, [role="button"]')) score += 80;
    if (candidate.matches?.('[tabindex], [onclick], [class*="cursor-pointer"]')) score += 70;
    if (candidate.matches?.('a[download], [data-download-url]')) score += 130;
    if (candidate.querySelector?.('svg')) score += 70;
    if (!cleanText(candidate.textContent)) score += 70;

    const overlap = verticalOverlap(candidate, filenameElement);
    score += Math.min(160, overlap * 6);
    if (candidateBounds.left >= filenameBounds.right - 24) score += 180;
    if (candidateBounds.left >= cardBounds.left + cardBounds.width * 0.55) score += 120;
    if (candidateBounds.width <= 100 && candidateBounds.height <= 100) score += 100;

    const dx = Math.abs(
      (candidateBounds.left + candidateBounds.width / 2) - filenameBounds.right
    );
    const dy = Math.abs(
      (candidateBounds.top + candidateBounds.height / 2) -
      (filenameBounds.top + filenameBounds.height / 2)
    );
    score += Math.max(0, 180 - Math.hypot(dx, dy));
    return score;
  };

  const cardFor = (root, filenameElement, filename) => {
    let best = null;
    let container = filenameElement;
    for (let depth = 0; container && depth < 10; depth += 1) {
      const bounds = rect(container);
      if (bounds && bounds.width >= 140 && bounds.width <= 1000 && bounds.height >= 34 && bounds.height <= 220) {
        const text = normalize(container.textContent);
        if (text.includes(normalize(filename))) {
          const candidates = [...container.querySelectorAll(interactiveSelector)]
            .filter((element) => element !== filenameElement && isVisible(element) && !isMessageAction(element));
          const ranked = candidates
            .map((candidate) => ({
              candidate,
              score: candidateScore(candidate, filenameElement, container, filename)
            }))
            .filter((item) => Number.isFinite(item.score))
            .sort((first, second) => second.score - first.score);
          if (ranked.length) {
            const compactness = Math.max(0, 220 - bounds.height) + Math.max(0, 120 - bounds.width / 10);
            const score = ranked[0].score + compactness;
            if (!best || score > best.score) {
              best = { card: container, candidates: ranked.map((item) => item.candidate), score };
            }
          }
        }
      }
      if (container === root) break;
      container = container.parentElement;
    }
    return best;
  };

  const annotate = (element, filename) => {
    const existing = cleanText(element.getAttribute?.('aria-label'));
    element.setAttribute(
      'aria-label',
      existing.includes(filename) ? existing : cleanText(`${existing} Download file ${filename}`)
    );
    element.setAttribute('data-thread-export-filename', filename);
    element.setAttribute('data-thread-export-download-button', 'true');
  };

  const clickElement = (element) => {
    if (!element || !element.isConnected) return;
    element.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    try {
      element.click?.();
    } catch (_) {
      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      }));
    }
  };

  const createExactProxy = (card, filename, targets) => {
    const selector = '[data-thread-export-exact-proxy="true"]';
    const existing = [...card.querySelectorAll(selector)]
      .find((element) => normalize(element.getAttribute('data-thread-export-filename')) === normalize(filename));
    if (existing) return existing;

    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.setAttribute('aria-label', `Download file ${filename}`);
    proxy.setAttribute('data-thread-export-filename', filename);
    proxy.setAttribute('data-thread-export-download-button', 'true');
    proxy.setAttribute('data-thread-export-exact-proxy', 'true');
    proxy.style.cssText = [
      'position:absolute', 'width:1px', 'height:1px', 'padding:0', 'margin:0',
      'opacity:0', 'overflow:hidden', 'pointer-events:none', 'clip-path:inset(50%)'
    ].join(';');
    proxy.addEventListener('click', async () => {
      for (const target of targets.slice(0, 4)) {
        if (!target || target === proxy || !target.isConnected) continue;
        clickElement(target);
        await new Promise((resolve) => setTimeout(resolve, 850));
      }
    });
    card.appendChild(proxy);
    return proxy;
  };

  let exactButtons = 0;
  let exactProxies = 0;

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;
    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    for (const entry of textFilenameEntries(root)) {
      if (!entry.element) continue;
      const match = cardFor(root, entry.element, entry.filename);
      if (!match || !match.candidates.length) continue;
      annotate(match.candidates[0], entry.filename);
      match.card.setAttribute('data-thread-export-file-card', entry.filename);
      entry.element.setAttribute('data-thread-export-filename-label', entry.filename);
      exactButtons += 1;
      if (createExactProxy(match.card, entry.filename, match.candidates)) exactProxies += 1;
    }
  });

  return {
    ...baseResult,
    exactButtons: Number(baseResult.exactButtons || 0) + exactButtons,
    exactProxies: Number(baseResult.exactProxies || 0) + exactProxies
  };
};
