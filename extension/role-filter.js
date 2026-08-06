'use strict';

(() => {
  const searchInput = document.getElementById('message-search');
  const messagesNode = document.getElementById('messages');
  const searchCountNode = document.getElementById('search-count');
  const filterGroup = document.getElementById('role-filter');

  if (!searchInput || !messagesNode || !searchCountNode || !filterGroup) return;

  let activeRole = 'all';

  const localized = (key) => chrome.i18n.getMessage(key) || '';

  function setLocalizedAttributes() {
    filterGroup.setAttribute(
      'aria-label',
      localized('roleFilterLabel') || 'Filter messages by role'
    );

    filterGroup.querySelectorAll('[data-role-filter]').forEach((button) => {
      const role = button.dataset.roleFilter;
      const keyByRole = {
        all: 'roleFilterAll',
        user: 'roleFilterUser',
        assistant: 'roleFilterAssistant'
      };
      const label = localized(keyByRole[role] || 'roleFilterAll');
      if (label) button.textContent = label;
    });
  }

  function normalizedQuery() {
    const value = searchInput.value || '';
    if (typeof normalizeSearchText === 'function') {
      return normalizeSearchText(value);
    }
    return String(value)
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function applyRoleFilter() {
    const query = normalizedQuery();
    let visible = 0;

    messagesNode.querySelectorAll('.message-item').forEach((item) => {
      const roleMatches = activeRole === 'all' || item.dataset.role === activeRole;
      const textMatches = !query || String(item.dataset.search || '').includes(query);
      const matches = roleMatches && textMatches;
      item.hidden = !matches;
      if (matches) visible += 1;
    });

    filterGroup.querySelectorAll('[data-role-filter]').forEach((button) => {
      const selected = button.dataset.roleFilter === activeRole;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    const empty = document.getElementById('empty-search');
    if (empty) empty.hidden = visible !== 0;

    const total = messagesNode.querySelectorAll('.message-item').length;
    const text = typeof formatMessage === 'function'
      ? formatMessage('searchResultCount', [visible, total])
      : '';
    searchCountNode.textContent = text || `${visible} of ${total}`;
  }

  filterGroup.addEventListener('click', (event) => {
    const button = event.target.closest('[data-role-filter]');
    if (!button) return;
    activeRole = button.dataset.roleFilter || 'all';
    applyRoleFilter();
  });

  searchInput.addEventListener('input', () => queueMicrotask(applyRoleFilter));

  const observer = new MutationObserver(() => applyRoleFilter());
  observer.observe(messagesNode, { childList: true });

  setLocalizedAttributes();
  applyRoleFilter();
})();
