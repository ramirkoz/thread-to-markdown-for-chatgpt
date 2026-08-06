'use strict';

bridgeAssistantOutputControls = function bridgeAssistantOutputControlsByGeometry(
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
  const supportedFile = new RegExp(`\\.${extensionPattern}$`, 'iu');

  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  const cleanFilename = (value) => cleanText(value)
    .replace(/\\([_*`~[\]()])/g, '$1')
    .replace(/^['"“”«»`*_\s]+|['"“”«»`*_\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const normalize = (value) => cleanFilename(value)
    .replace(/^_+/, '')
    .normalize('NFKC')
    .toLocaleLowerCase();

  const rect = (element) => element?.getBoundingClientRect?.() || null;
  const visible = (element) => {
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
  const isMessageAction = (element) => /(copy|copied|good response|bad response|read aloud|share|regenerate|retry|more actions|edit|копіювати|подобається|не подобається|озвучити|поділитися|повторити|інші дії|редагувати)/iu
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

  for (const oldBridge of main.querySelectorAll('[data-thread-export-index-bridge="true"]')) {
    oldBridge.remove();
  }

  const interactiveSelector = [
    'button', '[role="button"]', 'a[href]', 'a[download]',
    '[tabindex]:not([tabindex="-1"])', '[onclick]',
    '[data-testid*="download"]', '[data-download-url]', '[data-href]', '[data-url]',
    '[class*="cursor-pointer"]', '[class*="download"]'
  ].join(',');

  const targets = new Map();
  const rememberTarget = (filename, element, score = 0) => {
    const cleaned = cleanFilename(filename);
    const key = normalize(cleaned);
    if (!cleaned || !key || !supportedFile.test(cleaned) || !element) return;
    const current = targets.get(key);
    if (!current || score > current.score) {
      targets.set(key, { filename: cleaned, element, score });
    }
  };

  for (const element of main.querySelectorAll(
    '[data-thread-export-download-button="true"], [data-thread-export-exact-proxy="true"], [data-thread-export-proxy="true"], [data-thread-export-filename]'
  )) {
    const filename = element.getAttribute('data-thread-export-filename') ||
      element.getAttribute('data-thread-export-file-card') ||
      element.getAttribute('data-thread-export-filename-label') || '';
    rememberTarget(filename, element, 10000);
  }

  const filenameEntries = (root) => {
    const entries = [];
    const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const raw = String(node.nodeValue || '').replace(/\r\n?/g, '\n');
      for (const line of raw.split('\n')) {
        for (const match of line.matchAll(filenamePattern)) {
          const filename = cleanFilename(match[0]);
          const key = normalize(filename);
          if (!filename || !key || seen.has(key)) continue;
          seen.add(key);
          entries.push({ filename, element: node.parentElement });
        }
      }
      node = walker.nextNode();
    }
    return entries;
  };

  const candidateScore = (candidate, filenameElement) => {
    if (!candidate || !visible(candidate) || isMessageAction(candidate)) return -Infinity;
    const candidateBounds = rect(candidate);
    const filenameBounds = rect(filenameElement);
    if (!candidateBounds || !filenameBounds) return -Infinity;

    const descriptor = descriptorFor(candidate);
    let score = 0;
    if (/(download|завантаж)/iu.test(descriptor)) score += 600;
    if (/(file|attachment|файл|вкладенн)/iu.test(descriptor)) score += 180;
    if (candidate.matches?.('a[download], [data-download-url]')) score += 260;
    if (candidate.matches?.('button, [role="button"]')) score += 160;
    if (candidate.matches?.('[tabindex], [onclick], [class*="cursor-pointer"]')) score += 100;
    if (candidate.querySelector?.('svg') || candidate.matches?.('svg')) score += 100;
    if (!cleanText(candidate.textContent)) score += 100;

    const candidateCenterX = candidateBounds.left + candidateBounds.width / 2;
    const candidateCenterY = candidateBounds.top + candidateBounds.height / 2;
    const filenameCenterY = filenameBounds.top + filenameBounds.height / 2;
    const verticalDistance = Math.abs(candidateCenterY - filenameCenterY);
    const horizontalDistance = Math.abs(candidateCenterX - filenameBounds.right);

    if (candidateBounds.left >= filenameBounds.right - 32) score += 300;
    if (verticalDistance <= Math.max(28, filenameBounds.height * 1.5)) score += 260;
    score += Math.max(0, 260 - verticalDistance * 3);
    score += Math.max(0, 180 - horizontalDistance);
    if (candidateBounds.width <= 120 && candidateBounds.height <= 120) score += 140;
    return score;
  };

  const bestInteractive = (root, filenameElement) => {
    const pool = new Set();
    let container = filenameElement;
    for (let depth = 0; container && depth < 12; depth += 1) {
      if (container.matches?.(interactiveSelector)) pool.add(container);
      for (const candidate of container.querySelectorAll?.(interactiveSelector) || []) {
        pool.add(candidate);
      }
      if (container === root) break;
      container = container.parentElement;
    }

    for (const candidate of root.querySelectorAll(interactiveSelector)) {
      const candidateBounds = rect(candidate);
      const filenameBounds = rect(filenameElement);
      if (!candidateBounds || !filenameBounds) continue;
      const verticalDistance = Math.abs(
        (candidateBounds.top + candidateBounds.height / 2) -
        (filenameBounds.top + filenameBounds.height / 2)
      );
      if (verticalDistance <= 180) pool.add(candidate);
    }

    return [...pool]
      .map((candidate) => ({ candidate, score: candidateScore(candidate, filenameElement) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((first, second) => second.score - first.score)[0] || null;
  };

  roots.forEach((root) => {
    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    for (const entry of filenameEntries(root)) {
      if (!entry.element) continue;
      const best = bestInteractive(root, entry.element);
      if (!best || best.score < 120) continue;
      best.candidate.setAttribute('data-thread-export-filename', entry.filename);
      best.candidate.setAttribute('data-thread-export-download-button', 'true');
      const existingLabel = cleanText(best.candidate.getAttribute('aria-label'));
      best.candidate.setAttribute(
        'aria-label',
        existingLabel.includes(entry.filename)
          ? existingLabel
          : cleanText(`${existingLabel} Download file ${entry.filename}`)
      );
      rememberTarget(entry.filename, best.candidate, best.score);
    }
  });

  const destinationRoots = roots.filter((root, index) => !selected || selected.has(index));
  let bridges = 0;

  for (const target of targets.values()) {
    for (const root of destinationRoots) {
      const bridge = document.createElement('button');
      bridge.type = 'button';
      bridge.setAttribute('aria-label', target.filename);
      bridge.setAttribute('data-thread-export-filename', target.filename);
      bridge.setAttribute('data-thread-export-index-bridge', 'true');
      bridge.style.cssText = [
        'position:absolute', 'width:1px', 'height:1px', 'padding:0', 'margin:0',
        'opacity:0', 'overflow:hidden', 'pointer-events:none', 'clip-path:inset(50%)'
      ].join(';');
      bridge.addEventListener('click', () => {
        if (!target.element?.isConnected) return;
        try {
          target.element.scrollIntoView?.({ block: 'center', behavior: 'auto' });
          target.element.click?.();
        } catch (_) {
          try {
            target.element.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window
            }));
          } catch (_) {}
        }
      });
      root.appendChild(bridge);
      bridges += 1;
    }
  }

  return { bridges, targets: targets.size };
};
