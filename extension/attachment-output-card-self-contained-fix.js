'use strict';

annotateAssistantOutputCards = function annotateAssistantOutputCardsSelfContained(
  selectedIndices
) {
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
  const cleanFilename = (value) => cleanText(value)
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const normalize = (value) => cleanFilename(value)
    .replace(/\\([_*`~[\]()])/g, '$1')
    .normalize('NFKC')
    .toLocaleLowerCase();
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
  const descriptorFor = (element) => cleanText([
    element?.getAttribute?.('aria-label'),
    element?.getAttribute?.('title'),
    element?.getAttribute?.('download'),
    element?.getAttribute?.('data-testid'),
    element?.getAttribute?.('data-download-url'),
    element?.getAttribute?.('data-href'),
    element?.getAttribute?.('data-url'),
    element?.textContent
  ].filter(Boolean).join(' ')).toLocaleLowerCase();
  const isMessageAction = (element) => /(copy|copied|good response|bad response|read aloud|share|regenerate|retry|more actions|копіювати|подобається|не подобається|озвучити|поділитися|повторити|інші дії)/iu
    .test(descriptorFor(element));

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

  const filenameEntries = (root) => {
    const entries = [];
    const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const raw = String(node.nodeValue || '').replace(/\r\n?/g, '\n');
      for (const sourceLine of raw.split('\n')) {
        for (const match of sourceLine.matchAll(filenamePattern)) {
          const filename = cleanFilename(match[0]);
          const key = `${normalize(filename)}|${entries.length}`;
          if (!filename || seen.has(key)) continue;
          seen.add(key);
          entries.push({ filename, element: node.parentElement });
        }
      }
      node = walker.nextNode();
    }
    return entries;
  };

  const verticalOverlap = (first, second) => {
    const a = rect(first);
    const b = rect(second);
    if (!a || !b) return 0;
    return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  };

  const candidateScore = (candidate, filenameElement, card, filename) => {
    if (!candidate || !isVisible(candidate) || isMessageAction(candidate)) return -Infinity;
    const candidateBounds = rect(candidate);
    const filenameBounds = rect(filenameElement);
    const cardBounds = rect(card);
    if (!candidateBounds || !filenameBounds || !cardBounds) return -Infinity;

    const descriptor = descriptorFor(candidate);
    let score = 0;
    if (descriptor.includes(normalize(filename))) score += 260;
    if (/(download|завантаж)/iu.test(descriptor)) score += 280;
    if (/(file|attachment|файл|вкладенн)/iu.test(descriptor)) score += 100;
    if (candidate.matches?.('button, [role="button"]')) score += 100;
    if (candidate.matches?.('[tabindex], [onclick], [class*="cursor-pointer"]')) score += 80;
    if (candidate.matches?.('a[download], [data-download-url]')) score += 150;
    if (candidate.querySelector?.('svg') || candidate.matches?.('svg')) score += 90;
    if (!cleanText(candidate.textContent)) score += 90;

    const overlap = verticalOverlap(candidate, filenameElement);
    score += Math.min(180, overlap * 7);
    if (candidateBounds.left >= filenameBounds.right - 28) score += 220;
    if (candidateBounds.left >= cardBounds.left + cardBounds.width * 0.55) score += 150;
    if (candidateBounds.width <= 100 && candidateBounds.height <= 100) score += 120;

    const dx = Math.abs(
      (candidateBounds.left + candidateBounds.width / 2) - filenameBounds.right
    );
    const dy = Math.abs(
      (candidateBounds.top + candidateBounds.height / 2) -
      (filenameBounds.top + filenameBounds.height / 2)
    );
    score += Math.max(0, 220 - Math.hypot(dx, dy));
    return score;
  };

  const locateCard = (root, filenameElement, filename) => {
    let best = null;
    let container = filenameElement;
    for (let depth = 0; container && depth < 10; depth += 1) {
      const bounds = rect(container);
      if (
        bounds &&
        bounds.width >= 120 && bounds.width <= 1000 &&
        bounds.height >= 32 && bounds.height <= 240 &&
        normalize(container.textContent).includes(normalize(filename))
      ) {
        const candidates = [...container.querySelectorAll(interactiveSelector)]
          .filter((element) => element !== filenameElement && isVisible(element));
        const ranked = candidates
          .map((candidate) => ({
            candidate,
            score: candidateScore(candidate, filenameElement, container, filename)
          }))
          .filter((item) => Number.isFinite(item.score))
          .sort((first, second) => second.score - first.score);
        if (ranked.length) {
          const compactness = Math.max(0, 260 - bounds.height) + Math.max(0, 130 - bounds.width / 10);
          const score = ranked[0].score + compactness;
          if (!best || score > best.score) {
            best = { card: container, target: ranked[0].candidate, score };
          }
        }
      }
      if (container === root) break;
      container = container.parentElement;
    }
    return best;
  };

  const promote = (element, filename) => {
    const existing = cleanText(element.getAttribute?.('aria-label'));
    element.setAttribute(
      'aria-label',
      existing.includes(filename) ? existing : cleanText(`${existing} Download file ${filename}`)
    );
    element.setAttribute('data-thread-export-filename', filename);
    element.setAttribute('data-thread-export-download-button', 'true');
    if (!element.getAttribute('data-testid')) {
      element.setAttribute('data-testid', 'thread-export-download-file');
    }
    if (!element.matches?.('button, a, [role="button"], [role="link"]')) {
      element.setAttribute('role', 'button');
    }
  };

  let promoted = 0;
  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;
    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    for (const entry of filenameEntries(root)) {
      if (!entry.element) continue;
      const match = locateCard(root, entry.element, entry.filename);
      if (!match?.target) continue;
      promote(match.target, entry.filename);
      match.card.setAttribute('data-thread-export-file-card', entry.filename);
      entry.element.setAttribute('data-thread-export-filename-label', entry.filename);
      promoted += 1;
    }
  });

  return { promoted };
};
