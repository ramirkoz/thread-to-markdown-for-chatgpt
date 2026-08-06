'use strict';

bridgeAssistantOutputControls = function bridgeAssistantOutputControlsWithoutFileCandidates(
  selectedIndices
) {
  const selected = Array.isArray(selectedIndices)
    ? new Set(selectedIndices.filter(Number.isInteger))
    : null;
  const supportedFile = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)$/iu;
  const cleanText = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
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

  const main = document.querySelector('main') || document.body;
  for (const stale of main.querySelectorAll('[data-thread-export-index-bridge="true"]')) {
    stale.remove();
  }

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

  const targetSelector = [
    '[data-thread-export-geometric-target="true"]',
    '[data-thread-export-download-button="true"]',
    '[data-thread-export-exact-proxy="true"]',
    '[data-thread-export-proxy="true"]',
    '[data-thread-export-filename]'
  ].join(',');
  const targets = [];
  const seenTargets = new Set();

  for (const element of main.querySelectorAll(targetSelector)) {
    if (element.getAttribute('data-thread-export-index-bridge') === 'true') continue;
    const filename = cleanFilename(
      element.getAttribute('data-thread-export-filename') ||
      element.getAttribute('data-thread-export-file-card') ||
      element.getAttribute('data-thread-export-filename-label') ||
      ''
    );
    const key = normalize(filename);
    if (!filename || !key || !supportedFile.test(filename) || seenTargets.has(key)) continue;
    seenTargets.add(key);
    targets.push({ filename, key, element });
  }

  const destinationRoots = roots.filter((root, index) => !selected || selected.has(index));
  let bridges = 0;

  for (const target of targets) {
    const stem = cleanFilename(target.filename.replace(/\.[^.]+$/u, '')) || target.filename;
    for (const root of destinationRoots) {
      const bridge = document.createElement('span');
      bridge.setAttribute('aria-label', stem);
      bridge.setAttribute('data-thread-export-filename', target.filename);
      bridge.setAttribute('data-thread-export-index-bridge', 'true');
      bridge.setAttribute('data-href', '');
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

  return { bridges, targets: targets.length };
};
