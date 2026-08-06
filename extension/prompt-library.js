'use strict';

(() => {
  const STORAGE_KEY = 'thread-to-markdown.prompt-library.v1';
  const MAX_PROMPTS = 100;
  const MAX_TITLE_LENGTH = 120;
  const MAX_CONTENT_LENGTH = 12000;

  const library = document.getElementById('prompt-library');
  const countNode = document.getElementById('prompt-count');
  const searchInput = document.getElementById('prompt-search');
  const listNode = document.getElementById('prompt-list');
  const emptyNode = document.getElementById('prompt-empty');
  const addButton = document.getElementById('prompt-add');
  const form = document.getElementById('prompt-form');
  const titleInput = document.getElementById('prompt-title');
  const contentInput = document.getElementById('prompt-content');
  const cancelButton = document.getElementById('prompt-cancel');
  const saveButton = document.getElementById('prompt-save');

  if (
    !library || !countNode || !searchInput || !listNode || !emptyNode ||
    !addButton || !form || !titleInput || !contentInput || !cancelButton || !saveButton
  ) return;

  let prompts = loadPrompts();
  let editingId = null;

  const localized = (key, substitutions = []) => {
    const values = substitutions.map((value) => String(value));
    return values.length
      ? chrome.i18n.getMessage(key, values)
      : chrome.i18n.getMessage(key);
  };

  function loadPrompts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((prompt) => prompt && typeof prompt === 'object')
        .map((prompt) => ({
          id: String(prompt.id || createId()),
          title: String(prompt.title || '').slice(0, MAX_TITLE_LENGTH).trim(),
          content: String(prompt.content || '').slice(0, MAX_CONTENT_LENGTH).trim(),
          createdAt: String(prompt.createdAt || new Date().toISOString()),
          updatedAt: String(prompt.updatedAt || prompt.createdAt || new Date().toISOString())
        }))
        .filter((prompt) => prompt.title && prompt.content)
        .slice(0, MAX_PROMPTS);
    } catch (error) {
      console.warn('Thread to Markdown: prompt library could not be read.', error);
      return [];
    }
  }

  function savePrompts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
      return true;
    } catch (error) {
      console.error('Thread to Markdown: prompt library could not be saved.', error);
      showStatus(localized('promptStorageError') || 'The prompt library could not be saved.', 'error');
      return false;
    }
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function filteredPrompts() {
    const query = normalize(searchInput.value);
    const sorted = [...prompts].sort((left, right) =>
      String(right.updatedAt).localeCompare(String(left.updatedAt))
    );
    if (!query) return sorted;
    return sorted.filter((prompt) =>
      normalize(`${prompt.title} ${prompt.content}`).includes(query)
    );
  }

  function render() {
    const visible = filteredPrompts();
    countNode.textContent = localized('promptCount', [prompts.length]) || String(prompts.length);
    listNode.textContent = '';

    const fragment = document.createDocumentFragment();
    for (const prompt of visible) {
      fragment.append(createPromptCard(prompt));
    }
    listNode.append(fragment);

    emptyNode.hidden = visible.length !== 0;
    emptyNode.textContent = prompts.length
      ? (localized('promptNoResults') || 'No matching prompts.')
      : (localized('promptEmpty') || 'No prompts saved yet.');

    addButton.disabled = prompts.length >= MAX_PROMPTS;
    addButton.title = prompts.length >= MAX_PROMPTS
      ? (localized('promptLimitReached', [MAX_PROMPTS]) || `The limit of ${MAX_PROMPTS} prompts has been reached.`)
      : '';
  }

  function createPromptCard(prompt) {
    const card = document.createElement('article');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;

    const text = document.createElement('div');
    text.className = 'prompt-card-text';

    const title = document.createElement('strong');
    title.textContent = prompt.title;

    const preview = document.createElement('p');
    preview.textContent = prompt.content;

    text.append(title, preview);

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';
    actions.append(
      actionButton('copy', localized('promptCopy') || 'Copy'),
      actionButton('edit', localized('promptEdit') || 'Edit'),
      actionButton('delete', localized('promptDelete') || 'Delete')
    );

    card.append(text, actions);
    return card;
  }

  function actionButton(action, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `prompt-action prompt-action-${action}`;
    button.dataset.promptAction = action;
    button.textContent = label;
    return button;
  }

  function openForm(prompt = null) {
    editingId = prompt?.id || null;
    titleInput.value = prompt?.title || '';
    contentInput.value = prompt?.content || '';
    saveButton.textContent = editingId
      ? (localized('promptUpdate') || 'Update prompt')
      : (localized('promptSave') || 'Save prompt');
    form.hidden = false;
    addButton.hidden = true;
    queueMicrotask(() => {
      titleInput.focus();
      form.scrollIntoView({ block: 'nearest' });
    });
  }

  function closeForm() {
    editingId = null;
    form.reset();
    form.hidden = true;
    addButton.hidden = false;
    saveButton.textContent = localized('promptSave') || 'Save prompt';
  }

  async function copyPrompt(prompt) {
    try {
      if (typeof writeClipboard === 'function') {
        await writeClipboard(prompt.content);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt.content);
      } else {
        throw new Error(localized('clipboardError') || 'The prompt could not be copied.');
      }
      showStatus(localized('promptCopied', [prompt.title]) || `Copied prompt: ${prompt.title}`, 'success');
    } catch (error) {
      showStatus(String(error?.message || error), 'error');
    }
  }

  function deletePrompt(prompt) {
    const message = localized('promptDeleteConfirm', [prompt.title]) || `Delete “${prompt.title}”?`;
    if (!window.confirm(message)) return;

    const next = prompts.filter((item) => item.id !== prompt.id);
    const previous = prompts;
    prompts = next;
    if (!savePrompts()) {
      prompts = previous;
      return;
    }
    if (editingId === prompt.id) closeForm();
    render();
    showStatus(localized('promptDeleted', [prompt.title]) || `Deleted prompt: ${prompt.title}`, 'success');
  }

  function showStatus(message, className = '') {
    if (typeof setStatus === 'function') {
      setStatus(message, className);
    }
  }

  addButton.addEventListener('click', () => openForm());
  cancelButton.addEventListener('click', closeForm);
  searchInput.addEventListener('input', render);

  listNode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-prompt-action]');
    const card = button?.closest('[data-prompt-id]');
    const prompt = prompts.find((item) => item.id === card?.dataset?.promptId);
    if (!button || !prompt) return;

    const action = button.dataset.promptAction;
    if (action === 'copy') copyPrompt(prompt);
    if (action === 'edit') openForm(prompt);
    if (action === 'delete') deletePrompt(prompt);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = titleInput.value.trim().slice(0, MAX_TITLE_LENGTH);
    const content = contentInput.value.trim().slice(0, MAX_CONTENT_LENGTH);
    if (!title || !content) {
      showStatus(localized('promptRequiredError') || 'Enter a prompt name and text.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const previous = prompts;
    if (editingId) {
      prompts = prompts.map((prompt) => prompt.id === editingId
        ? { ...prompt, title, content, updatedAt: now }
        : prompt);
    } else {
      if (prompts.length >= MAX_PROMPTS) {
        showStatus(localized('promptLimitReached', [MAX_PROMPTS]) || `The limit of ${MAX_PROMPTS} prompts has been reached.`, 'error');
        return;
      }
      prompts = [{ id: createId(), title, content, createdAt: now, updatedAt: now }, ...prompts];
    }

    if (!savePrompts()) {
      prompts = previous;
      return;
    }

    const messageKey = editingId ? 'promptUpdated' : 'promptSaved';
    showStatus(localized(messageKey, [title]) || `${editingId ? 'Updated' : 'Saved'} prompt: ${title}`, 'success');
    closeForm();
    render();
  });

  render();
})();
