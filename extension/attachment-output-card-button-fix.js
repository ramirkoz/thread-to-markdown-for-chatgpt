'use strict';

const outputCardButtonBaseAnnotate = annotateAssistantOutputCards;

if (typeof outputCardButtonBaseAnnotate !== 'function') {
  throw new Error('Assistant output annotation was not initialized.');
}

annotateAssistantOutputCards = function annotateAssistantOutputCardsWithDownloadButton(
  selectedIndices
) {
  const baseResult = outputCardButtonBaseAnnotate(selectedIndices) || {};
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

  const buttonSelector = [
    'button', '[role="button"]', 'a[download]', 'a[href]',
    '[data-testid*="download"]', '[data-download-url]', '[data-href]', '[data-url]'
  ].join(',');

  const rect = (element) => element?.getBoundingClientRect?.() || null;
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
    if (!bounds || !fileBounds || bounds.width < 120 || bounds.height < 36) return -Infinity;
    if (bounds.height > 240 || bounds.width > 900) return -Infinity;

    const buttons = [...container.querySelectorAll(buttonSelector)]
      .filter((element) => element !== filenameElement && !isMessageAction(element));
    if (!buttons.length) return -Infinity;

    const text = normalize(container.textContent);
    if (!text.includes(normalize(filename))) return -Infinity;

    let score = 0;
    score += Math.max(0, 100 - bounds.height / 2);
    score += Math.max(0, 80 - bounds.width / 12);
    score += Math.min(60, buttons.length * 20);
    if (buttons.some((button) => /(download|завантаж)/iu.test(descriptorFor(button)))) score += 100;
    if (buttons.some((button) => verticalOverlap(button, filenameElement) > 8)) score += 80;
    return score;
  };

  const buttonScore = (button, filenameElement, card, filename) => {
    const buttonBounds = rect(button);
    const fileBounds = rect(filenameElement);
    const cardBounds = rect(card);
    if (!buttonBounds || !fileBounds || !cardBounds) return -Infinity;
    if (isMessageAction(button)) return -Infinity;

    const descriptor = descriptorFor(button);
    let score = 0;
    if (descriptor.includes(normalize(filename))) score += 180;
    if (/(download|завантаж)/iu.test(descriptor)) score += 180;
    if (/(file|attachment|файл|вкладенн)/iu.test(descriptor)) score += 80;
    if (button.matches?.('button, [role="button"]')) score += 60;
    if (button.matches?.('a[download], [data-download-url]')) score += 100;
    if (button.matches?.('a[href], [data-href], [data-url]')) score += 50;

    const overlap = verticalOverlap(button, filenameElement);
    score += Math.min(100, overlap * 4);
    if (buttonBounds.left >= fileBounds.right - 12) score += 90;
    if (buttonBounds.left >= cardBounds.left + cardBounds.width * 0.55) score += 50;
    if (buttonBounds.width <= 96 && buttonBounds.height <= 96) score += 40;
    if (!cleanText(button.textContent)) score += 30;

    const dx = Math.abs((buttonBounds.left + buttonBounds.width / 2) - fileBounds.right);
    const dy = Math.abs((buttonBounds.top + buttonBounds.height / 2) - (fileBounds.top + fileBounds.height / 2));
    score += Math.max(0, 100 - Math.hypot(dx, dy) / 2);
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

  let boundButtons = 0;

  roots.forEach((root, messageIndex) => {
    if (selected && !selected.has(messageIndex)) return;
    const role = cleanText(
      root.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
    ).toLowerCase();
    if (role && role !== 'assistant') return;

    const filenames = [...new Set(
      [...cleanText(root.innerText || root.textContent || '').matchAll(filenamePattern)]
        .map((match) => cleanText(match[0]))
        .filter(Boolean)
    )];

    for (const filename of filenames) {
      const wanted = normalize(filename);
      const filenameElements = [...root.querySelectorAll('a, button, div, span, p')]
        .filter((element) => normalize(element.textContent).includes(wanted))
        .sort((first, second) => cleanText(first.textContent).length - cleanText(second.textContent).length)
        .slice(0, 16);

      let best = null;

      for (const filenameElement of filenameElements) {
        let container = filenameElement;
        for (let depth = 0; container && depth < 8; depth += 1) {
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

      if (!ranked.length || ranked[0].score < 90) continue;
      annotateButton(ranked[0].button, filename);
      boundButtons += 1;
    }
  });

  return {
    ...baseResult,
    boundButtons: Number(baseResult.boundButtons || 0) + boundButtons
  };
};
