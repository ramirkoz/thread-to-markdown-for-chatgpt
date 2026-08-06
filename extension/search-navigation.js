'use strict';

(() => {
  const searchInput = document.getElementById('message-search');
  const messagesNode = document.getElementById('messages');
  const previousButton = document.getElementById('previous-search-result');
  const nextButton = document.getElementById('next-search-result');
  const positionNode = document.getElementById('search-position');

  if (!searchInput || !messagesNode || !previousButton || !nextButton || !positionNode) return;

  let activeMessageIndex = null;
  let navigationBusy = false;

  const localized = (key, substitutions = []) => {
    const values = substitutions.map((value) => String(value));
    return values.length
      ? chrome.i18n.getMessage(key, values)
      : chrome.i18n.getMessage(key);
  };

  const visibleItems = () => [...messagesNode.querySelectorAll('.message-item')]
    .filter((item) => !item.hidden);

  const messageIndexFor = (item) => {
    const value = Number(item?.dataset?.index);
    return Number.isInteger(value) ? value : null;
  };

  const hasSearchQuery = () => Boolean(String(searchInput.value || '').trim());

  function setLocalizedAttributes() {
    const previousLabel = localized('previousSearchResult') || 'Previous search result';
    const nextLabel = localized('nextSearchResult') || 'Next search result';
    const navigationLabel = localized('searchNavigationLabel') || 'Search result navigation';

    previousButton.setAttribute('aria-label', previousLabel);
    previousButton.title = previousLabel;
    nextButton.setAttribute('aria-label', nextLabel);
    nextButton.title = nextLabel;
    previousButton.parentElement?.setAttribute('aria-label', navigationLabel);
  }

  function syncSearchNavigation() {
    const items = visibleItems();
    const searchable = hasSearchQuery() && items.length > 0;
    const indices = items.map(messageIndexFor);

    if (!searchable) {
      activeMessageIndex = null;
    } else if (!indices.includes(activeMessageIndex)) {
      activeMessageIndex = indices[0];
    }

    items.forEach((item) => {
      item.classList.toggle('search-current', messageIndexFor(item) === activeMessageIndex && searchable);
    });

    const activePosition = searchable
      ? Math.max(0, indices.indexOf(activeMessageIndex)) + 1
      : 0;
    positionNode.textContent = localized('searchPosition', [activePosition, items.length]) || `${activePosition} of ${items.length}`;

    const disabled = navigationBusy || !searchable;
    previousButton.disabled = disabled;
    nextButton.disabled = disabled;
  }

  async function navigateSearchResult(direction) {
    if (navigationBusy) return;

    const items = visibleItems();
    if (!hasSearchQuery() || !items.length) {
      syncSearchNavigation();
      return;
    }

    const currentPosition = items.findIndex((item) => messageIndexFor(item) === activeMessageIndex);
    const nextPosition = currentPosition < 0
      ? (direction < 0 ? items.length - 1 : 0)
      : (currentPosition + direction + items.length) % items.length;
    const target = items[nextPosition];
    const targetIndex = messageIndexFor(target);
    if (!Number.isInteger(targetIndex)) return;

    activeMessageIndex = targetIndex;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    navigationBusy = true;
    syncSearchNavigation();

    try {
      if (typeof navigateToMessage === 'function') {
        await navigateToMessage(targetIndex);
      }
    } finally {
      navigationBusy = false;
      syncSearchNavigation();
    }
  }

  previousButton.addEventListener('click', () => navigateSearchResult(-1));
  nextButton.addEventListener('click', () => navigateSearchResult(1));

  searchInput.addEventListener('input', () => {
    activeMessageIndex = null;
    queueMicrotask(syncSearchNavigation);
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    navigateSearchResult(event.shiftKey ? -1 : 1);
  });

  messagesNode.addEventListener('click', (event) => {
    const openButton = event.target.closest('.message-open');
    const item = openButton?.closest('.message-item');
    const index = messageIndexFor(item);
    if (!Number.isInteger(index)) return;
    activeMessageIndex = index;
    syncSearchNavigation();
  }, true);

  const observer = new MutationObserver(() => syncSearchNavigation());
  observer.observe(messagesNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden']
  });

  setLocalizedAttributes();
  syncSearchNavigation();
})();
