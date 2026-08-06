'use strict';

const outputCardBaseExportThread = self.exportThread;

if (typeof outputCardBaseExportThread !== 'function') {
  throw new Error('Output-card annotation dependencies were not initialized.');
}

self.exportThread = async function exportThreadWithOutputCardAnnotation(
  tabId,
  selectedIndices,
  requestedFormat
) {
  if (requestedFormat === 'zip') {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: annotateAssistantOutputCards,
      args: [selectedIndices]
    });
  }

  return outputCardBaseExportThread(tabId, selectedIndices, requestedFormat);
};

function annotateAssistantOutputCards(selectedIndices) {
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const filenamePattern = /[^\n<>:"/\\|?*]{1,180}\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)/giu;
  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
    'a[href]', '[role="link"]', 'button', '[role="button"]',
    '[data-href]', '[data-url]', '[data-download-url]', '[data-testid*="download"]',
    '[data-testid*="file"]', '[data-testid*="attachment"]'
  ].join(',');

  const scoreInteractive = (element) => {
    const descriptor = cleanText([
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('download'),
      element.getAttribute?.('data-testid'),
      element.textContent
    ].filter(Boolean).join(' ')).toLowerCase();
    let score = 0;
    if (/(download|завантаж|file|attachment|файл|вкладенн)/i.test(descriptor)) score += 50;
    if (element.matches?.('a[href], [data-href], [data-url], [data-download-url]')) score += 25;
    if (element.matches?.('button, [role="button"]')) score += 10;
    const rect = element.getBoundingClientRect?.();
    const area = Math.max(1, Number(rect?.width || 1) * Number(rect?.height || 1));
    score += Math.min(10, Math.log(area));
    return score;
  };

  const annotate = (element, filename) => {
    if (!element || !filename) return false;
    const existing = cleanText(element.getAttribute?.('aria-label'));
    const label = existing && existing.includes(filename)
      ? existing
      : cleanText(`${existing} ${filename}`);
    element.setAttribute('aria-label', label || filename);
    element.setAttribute('data-thread-export-filename', filename);
    return true;
  };

  let annotated = 0;

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
      const textElements = [...root.querySelectorAll('a, button, [role="button"], [role="link"], div, span, p')]
        .filter((element) => cleanText(element.textContent).includes(filename));

      let target = textElements
        .filter((element) => element.matches(interactiveSelector))
        .sort((a, b) => scoreInteractive(b) - scoreInteractive(a))[0];

      if (!target) {
        const candidates = [];
        for (const textElement of textElements) {
          let container = textElement;
          for (let depth = 0; container && depth < 7; depth += 1) {
            for (const interactive of container.querySelectorAll?.(interactiveSelector) || []) {
              candidates.push(interactive);
            }
            if (container.matches?.(interactiveSelector)) candidates.push(container);
            container = container.parentElement;
          }
        }
        target = [...new Set(candidates)]
          .sort((a, b) => scoreInteractive(b) - scoreInteractive(a))[0];
      }

      if (!target) {
        const allInteractive = [...root.querySelectorAll(interactiveSelector)];
        if (filenames.length === 1 && allInteractive.length === 1) {
          target = allInteractive[0];
        }
      }

      if (annotate(target, filename)) annotated += 1;
    }
  });

  return { annotated };
}
