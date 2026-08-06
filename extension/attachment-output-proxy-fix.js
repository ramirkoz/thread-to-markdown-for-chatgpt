'use strict';

if (typeof annotateAssistantOutputCards !== 'function') {
  throw new Error('Output-card annotation was not initialized.');
}

annotateAssistantOutputCards = function annotateAssistantOutputCardsWithProxy(selectedIndices) {
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const filenamePattern = /[^\n<>:"/\\|?*]{1,180}\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)/giu;
  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalize = (value) => cleanText(value)
    .replace(/\\([_*`~[\]()])/g, '$1')
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .normalize('NFKC')
    .toLocaleLowerCase();

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

  const candidateSelector = [
    'a[href]', '[role="link"]', 'button', '[role="button"]', '[tabindex]', '[onclick]',
    '[data-href]', '[data-url]', '[data-download-url]', '[data-testid*="download"]',
    '[data-testid*="file"]', '[data-testid*="attachment"]', '[class*="download"]',
    '[class*="attachment"]', '[class*="file"]', '[class*="cursor-pointer"]'
  ].join(',');

  const rectDistance = (first, second) => {
    const a = first?.getBoundingClientRect?.();
    const b = second?.getBoundingClientRect?.();
    if (!a || !b) return 100000;
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
  };

  const descriptorFor = (element) => cleanText([
    element?.getAttribute?.('aria-label'),
    element?.getAttribute?.('title'),
    element?.getAttribute?.('download'),
    element?.getAttribute?.('data-testid'),
    element?.getAttribute?.('data-href'),
    element?.getAttribute?.('data-url'),
    element?.getAttribute?.('data-download-url'),
    element?.textContent
  ].filter(Boolean).join(' '));

  const scoreCandidate = (element, filename, textElements) => {
    const descriptor = normalize(descriptorFor(element));
    const wanted = normalize(filename);
    let score = 0;
    if (descriptor.includes(wanted)) score += 160;
    if (/(download|завантаж|file|attachment|файл|вкладенн)/iu.test(descriptor)) score += 90;
    if (element?.matches?.('a[href], [data-href], [data-url], [data-download-url]')) score += 55;
    if (element?.matches?.('button, [role="button"], [role="link"]')) score += 35;
    if (element?.matches?.('[data-testid*="download"], [data-testid*="file"], [data-testid*="attachment"]')) score += 35;
    if (element?.matches?.('[class*="download"], [class*="attachment"], [class*="file"], [class*="cursor-pointer"]')) score += 20;
    const distance = Math.min(...textElements.map((textElement) => rectDistance(element, textElement)), 100000);
    score += Math.max(0, 40 - distance / 8);
    return score;
  };

  const unique = (values) => [...new Set(values.filter(Boolean))];

  const gatherCandidates = (root, textElements) => {
    const candidates = [];

    for (const textElement of textElements) {
      candidates.push(textElement);
      let container = textElement;
      for (let depth = 0; container && depth < 10; depth += 1) {
        candidates.push(container);
        candidates.push(...container.querySelectorAll?.(candidateSelector) || []);
        const parent = container.parentElement;
        if (parent) {
          for (const sibling of parent.children) {
            if (sibling === container) continue;
            if (sibling.matches?.(candidateSelector)) candidates.push(sibling);
            candidates.push(...sibling.querySelectorAll?.(candidateSelector) || []);
          }
        }
        if (container === root) break;
        container = parent;
      }
    }

    const rootCandidates = [...root.querySelectorAll(candidateSelector)];
    if (rootCandidates.length <= 12) candidates.push(...rootCandidates);

    const nearbyGlobal = [...main.querySelectorAll(candidateSelector)]
      .filter((element) => textElements.some((textElement) => rectDistance(element, textElement) <= 220));
    candidates.push(...nearbyGlobal);

    return unique(candidates)
      .filter((element) => !element.hasAttribute?.('data-thread-export-proxy'));
  };

  const annotate = (element, filename) => {
    if (!element || !filename) return;
    const existing = cleanText(element.getAttribute?.('aria-label'));
    element.setAttribute('aria-label', existing.includes(filename)
      ? existing
      : cleanText(`${existing} ${filename}`));
    element.setAttribute('data-thread-export-filename', filename);
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

  const resourceSnapshot = () => new Set(
    (performance.getEntriesByType?.('resource') || [])
      .map((entry) => String(entry?.name || ''))
      .filter(Boolean)
  );

  const createProxy = (root, filename, candidates) => {
    const existing = [...root.querySelectorAll('[data-thread-export-proxy="true"]')]
      .find((element) => normalize(element.getAttribute('data-thread-export-filename')) === normalize(filename));
    if (existing) return existing;

    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.setAttribute('aria-label', filename);
    proxy.setAttribute('data-thread-export-filename', filename);
    proxy.setAttribute('data-thread-export-proxy', 'true');
    proxy.style.cssText = [
      'position:absolute', 'width:1px', 'height:1px', 'padding:0', 'margin:0',
      'opacity:0', 'overflow:hidden', 'pointer-events:none', 'clip-path:inset(50%)'
    ].join(';');

    const ordered = candidates.slice(0, 8);
    proxy.addEventListener('click', async () => {
      const before = resourceSnapshot();
      for (let index = 0; index < ordered.length; index += 1) {
        const candidate = ordered[index];
        if (!candidate || candidate === proxy || !candidate.isConnected) continue;
        clickElement(candidate);
        await new Promise((resolve) => setTimeout(resolve, index === 0 ? 900 : 450));

        const current = resourceSnapshot();
        const resourceChanged = [...current].some((url) => !before.has(url));
        const overlayOpened = Boolean(document.querySelector(
          '[role="dialog"], [data-state="open"], [aria-modal="true"]'
        ));
        if (resourceChanged || overlayOpened) break;
      }
    });

    root.appendChild(proxy);
    return proxy;
  };

  let annotated = 0;
  let proxies = 0;

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;

    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    const text = cleanText(root.innerText || root.textContent || '');
    const filenames = [...new Set(
      [...text.matchAll(filenamePattern)]
        .map((match) => cleanText(match[0]))
        .filter(Boolean)
    )];

    for (const filename of filenames) {
      const wanted = normalize(filename);
      const textElements = [...root.querySelectorAll('a, button, [role="button"], [role="link"], div, span, p')]
        .filter((element) => normalize(element.textContent).includes(wanted))
        .sort((a, b) => cleanText(a.textContent).length - cleanText(b.textContent).length)
        .slice(0, 12);

      if (!textElements.length) continue;

      const candidates = gatherCandidates(root, textElements)
        .map((element) => ({
          element,
          score: scoreCandidate(element, filename, textElements)
        }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.element);

      const primary = candidates[0] || textElements[0];
      annotate(primary, filename);
      annotated += 1;
      if (createProxy(root, filename, candidates.length ? candidates : textElements)) proxies += 1;
    }
  });

  return { annotated, proxies };
};
