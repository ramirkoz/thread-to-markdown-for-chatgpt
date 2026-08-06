'use strict';

(() => {
  const HIGHLIGHT_SELECTOR = '[data-thread-export-navigation-highlight="true"]';

  function restoreHighlight(element) {
    if (!(element instanceof HTMLElement)) return;

    element.style.outline = element.dataset.threadExportPreviousOutline || '';
    element.style.outlineOffset = element.dataset.threadExportPreviousOutlineOffset || '';
    element.style.transition = element.dataset.threadExportPreviousTransition || '';

    delete element.dataset.threadExportNavigationHighlight;
    delete element.dataset.threadExportNavigationToken;
    delete element.dataset.threadExportPreviousOutline;
    delete element.dataset.threadExportPreviousOutlineOffset;
    delete element.dataset.threadExportPreviousTransition;
  }

  function clearNavigationHighlights() {
    document.querySelectorAll(HIGHLIGHT_SELECTOR).forEach(restoreHighlight);
  }

  globalThis.scrollToConversationMessage = function scrollToConversationMessage(messageIndex) {
    const main = document.querySelector('main') || document.body;
    const roots = [];
    const seen = new Set();
    const roleNodes = [...main.querySelectorAll('[data-message-author-role]')];

    for (const roleNode of roleNodes) {
      const root = roleNode.closest(
        'article, [data-testid^="conversation-turn-"], [data-message-id], [class*="group/conversation-turn"]'
      ) || roleNode;
      if (seen.has(root)) continue;
      seen.add(root);
      roots.push(root);
    }

    if (!roots.length) {
      for (const root of main.querySelectorAll(
        '[data-testid^="conversation-turn-"], [data-message-id], article, [class*="group/conversation-turn"]'
      )) {
        if (seen.has(root)) continue;
        seen.add(root);
        roots.push(root);
      }
    }

    const target = roots[messageIndex];
    if (!target) return { found: false, messageCount: roots.length };

    clearNavigationHighlights();
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    target.dataset.threadExportNavigationHighlight = 'true';
    target.dataset.threadExportNavigationToken = token;
    target.dataset.threadExportPreviousOutline = target.style.outline || '';
    target.dataset.threadExportPreviousOutlineOffset = target.style.outlineOffset || '';
    target.dataset.threadExportPreviousTransition = target.style.transition || '';

    target.style.transition = 'outline-color 160ms ease';
    target.style.outline = '3px solid #22c55e';
    target.style.outlineOffset = '6px';

    window.setTimeout(() => {
      if (target.dataset.threadExportNavigationToken !== token) return;
      restoreHighlight(target);
    }, 1800);

    return { found: true, messageCount: roots.length };
  };
})();
