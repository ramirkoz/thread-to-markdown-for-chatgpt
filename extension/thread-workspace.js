'use strict';

(() => {
  const DB_NAME = 'thread-to-markdown.workspace.v2';
  const DB_VERSION = 1;
  const STORE = 'threads';
  const PROMPT_STORAGE_KEY = 'thread-to-markdown.prompt-library.v1';
  const MAX_RECORDS = 250;
  const MAX_FOLDER = 80;
  const MAX_TAG = 48;
  const MAX_NOTE = 8000;

  const root = document.getElementById('thread-workspace');
  if (!root) return;

  const countNode = document.getElementById('workspace-count');
  const currentTitleNode = document.getElementById('workspace-current-title');
  const folderInput = document.getElementById('workspace-folder');
  const tagsInput = document.getElementById('workspace-tags');
  const noteInput = document.getElementById('workspace-note');
  const folderList = document.getElementById('workspace-folder-list');
  const saveButton = document.getElementById('workspace-save-current');
  const clearButton = document.getElementById('workspace-clear-meta');
  const searchInput = document.getElementById('workspace-search');
  const folderFilter = document.getElementById('workspace-folder-filter');
  const listNode = document.getElementById('workspace-list');
  const emptyNode = document.getElementById('workspace-empty');
  const exportButton = document.getElementById('workspace-export-selected');
  const deleteButton = document.getElementById('workspace-delete-selected');
  const backupButton = document.getElementById('workspace-backup');
  const restoreButton = document.getElementById('workspace-restore');
  const restoreFile = document.getElementById('workspace-restore-file');

  if (![countNode, currentTitleNode, folderInput, tagsInput, noteInput, folderList, saveButton,
    clearButton, searchInput, folderFilter, listNode, emptyNode, exportButton, deleteButton,
    backupButton, restoreButton, restoreFile].every(Boolean)) return;

  const uk = /^uk\b/i.test(chrome.i18n.getUILanguage?.() || navigator.language || '');
  const t = uk ? {
    current: 'Поточна розмова', saved: 'Збережено локально', updated: 'Оновлено локально',
    save: 'Зберегти поточний чат', update: 'Оновити збережений чат', empty: 'Збережених чатів ще немає.',
    noResults: 'Відповідних чатів не знайдено.', open: 'Відкрити', loading: 'Готую локальний знімок розмови…',
    needThread: 'Спочатку відкрийте розмову ChatGPT.', storageError: 'Не вдалося відкрити локальне сховище.',
    limit: `Досягнуто ліміту ${MAX_RECORDS} збережених чатів.`, select: 'Виберіть хоча б один збережений чат.',
    exportDone: 'ZIP зі збереженими чатами створено.', deleteConfirm: 'Видалити вибрані збережені чати?',
    deleted: 'Вибрані чати видалено.', backupDone: 'Резервну копію локальних даних створено.',
    restoreConfirm: 'Замінити локальні чати та бібліотеку промптів даними з цієї резервної копії?',
    restoreDone: 'Резервну копію відновлено.', restoreError: 'Файл резервної копії некоректний.',
    allFolders: 'Усі папки', noFolder: 'Без папки', snapshotMissing: 'У записі немає локального знімка Markdown.'
  } : {
    current: 'Current conversation', saved: 'Saved locally', updated: 'Updated locally',
    save: 'Save current chat', update: 'Update saved chat', empty: 'No saved chats yet.',
    noResults: 'No matching chats.', open: 'Open', loading: 'Preparing a local conversation snapshot…',
    needThread: 'Open a ChatGPT conversation first.', storageError: 'The local workspace could not be opened.',
    limit: `The limit of ${MAX_RECORDS} saved chats has been reached.`, select: 'Select at least one saved chat.',
    exportDone: 'ZIP with saved chats created.', deleteConfirm: 'Delete the selected saved chats?',
    deleted: 'Selected chats deleted.', backupDone: 'Local-data backup created.',
    restoreConfirm: 'Replace local chats and the prompt library with this backup?',
    restoreDone: 'Backup restored.', restoreError: 'The backup file is invalid.',
    allFolders: 'All folders', noFolder: 'No folder', snapshotMissing: 'This record has no local Markdown snapshot.'
  };

  let db = null;
  let records = [];
  let currentUrl = '';
  let currentRecordId = '';
  let busy = false;

  const normalize = (value) => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  const searchNormalize = (value) => normalize(value).toLocaleLowerCase();
  const createId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function status(message, kind = '') {
    if (typeof setStatus === 'function') setStatus(message, kind);
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value;
    backupButton.disabled = value;
    restoreButton.disabled = value;
    updateBulkButtons();
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(t.storageError));
    });
  }

  function transaction(mode, operation) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = operation(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error || result?.error || new Error(t.storageError));
      tx.onabort = () => reject(tx.error || new Error(t.storageError));
    });
  }

  async function reloadRecords() {
    records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result.map(cleanRecord) : []);
      request.onerror = () => reject(request.error || new Error(t.storageError));
    });
    records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function cleanRecord(record) {
    return {
      id: String(record?.id || createId()),
      url: String(record?.url || ''),
      title: normalize(record?.title || 'ChatGPT conversation').slice(0, 240),
      folder: normalize(record?.folder || '').slice(0, MAX_FOLDER),
      tags: Array.isArray(record?.tags) ? [...new Set(record.tags.map((tag) => normalize(tag).slice(0, MAX_TAG)).filter(Boolean))].slice(0, 20) : [],
      note: String(record?.note || '').trim().slice(0, MAX_NOTE),
      markdown: String(record?.markdown || ''),
      messageCount: Number(record?.messageCount || 0),
      savedAt: String(record?.savedAt || new Date().toISOString()),
      updatedAt: String(record?.updatedAt || record?.savedAt || new Date().toISOString())
    };
  }

  function parseTags(value) {
    return [...new Set(String(value || '').split(',').map((tag) => normalize(tag).slice(0, MAX_TAG)).filter(Boolean))].slice(0, 20);
  }

  function currentRecord() {
    return records.find((item) => item.id === currentRecordId) || records.find((item) => item.url === currentUrl) || null;
  }

  function fillCurrent(record) {
    currentRecordId = record?.id || '';
    folderInput.value = record?.folder || '';
    tagsInput.value = record?.tags?.join(', ') || '';
    noteInput.value = record?.note || '';
    saveButton.textContent = record ? t.update : t.save;
  }

  function syncCurrentMetadata() {
    const record = records.find((item) => item.url === currentUrl) || null;
    fillCurrent(record);
  }

  function folders() {
    return [...new Set(records.map((item) => item.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function renderFolderControls() {
    const values = folders();
    folderList.textContent = '';
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      folderList.append(option);
    }

    const selected = folderFilter.value;
    folderFilter.textContent = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = t.allFolders;
    folderFilter.append(all);
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      folderFilter.append(option);
    }
    if ([...folderFilter.options].some((option) => option.value === selected)) folderFilter.value = selected;
  }

  function filteredRecords() {
    const query = searchNormalize(searchInput.value);
    const folder = folderFilter.value;
    return records.filter((record) => {
      if (folder && record.folder !== folder) return false;
      if (!query) return true;
      return searchNormalize(`${record.title} ${record.folder} ${record.tags.join(' ')} ${record.note}`).includes(query);
    });
  }

  function render() {
    countNode.textContent = String(records.length);
    renderFolderControls();
    listNode.textContent = '';
    const visible = filteredRecords();
    const fragment = document.createDocumentFragment();
    for (const record of visible) fragment.append(createCard(record));
    listNode.append(fragment);
    emptyNode.hidden = visible.length !== 0;
    emptyNode.textContent = records.length ? t.noResults : t.empty;
    syncCurrentMetadata();
    updateBulkButtons();
  }

  function createCard(record) {
    const card = document.createElement('article');
    card.className = 'workspace-card';
    card.dataset.workspaceId = record.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'workspace-select';
    checkbox.dataset.workspaceId = record.id;

    const main = document.createElement('div');
    main.className = 'workspace-card-main';
    const title = document.createElement('strong');
    title.className = 'workspace-card-title';
    title.textContent = record.title;
    title.title = record.title;
    const meta = document.createElement('div');
    meta.className = 'workspace-card-meta';
    const date = new Date(record.updatedAt);
    meta.textContent = `${record.folder || t.noFolder} · ${record.messageCount || 0} · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()}`;
    main.append(title, meta);

    if (record.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'workspace-tags';
      record.tags.forEach((value) => {
        const tag = document.createElement('span');
        tag.className = 'workspace-tag';
        tag.textContent = value;
        tags.append(tag);
      });
      main.append(tags);
    }
    if (record.note) {
      const note = document.createElement('p');
      note.className = 'workspace-card-note';
      note.textContent = record.note;
      main.append(note);
    }

    const actions = document.createElement('div');
    actions.className = 'workspace-card-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'workspace-button';
    open.dataset.workspaceAction = 'open';
    open.textContent = t.open;
    actions.append(open);

    card.append(checkbox, main, actions);
    return card;
  }

  function selectedIds() {
    return [...listNode.querySelectorAll('.workspace-select:checked')].map((node) => node.dataset.workspaceId).filter(Boolean);
  }

  function updateBulkButtons() {
    const count = selectedIds().length;
    exportButton.disabled = busy || count === 0;
    deleteButton.disabled = busy || count === 0;
  }

  async function prepareCurrentMarkdown() {
    if (!Number.isInteger(activeTabId) || !Array.isArray(messages) || !messages.length) throw new Error(t.needThread);
    const indices = messages.map((message) => Number(message.index)).filter(Number.isInteger);
    const response = await chrome.runtime.sendMessage({
      type: 'prepare-thread',
      tabId: activeTabId,
      selectedIndices: indices,
      format: 'markdown'
    });
    if (!response?.ok || !response.content) throw new Error(response?.error || t.needThread);
    return { markdown: response.content, messageCount: Number(response.messageCount || indices.length) };
  }

  async function saveCurrent() {
    if (!currentUrl) throw new Error(t.needThread);
    const existing = currentRecord();
    if (!existing && records.length >= MAX_RECORDS) throw new Error(t.limit);
    status(t.loading);
    setBusy(true);
    try {
      const snapshot = await prepareCurrentMarkdown();
      const now = new Date().toISOString();
      const title = normalize(threadTitleNode?.textContent || document.title || 'ChatGPT conversation').slice(0, 240);
      const record = cleanRecord({
        id: existing?.id || createId(),
        url: currentUrl,
        title,
        folder: folderInput.value,
        tags: parseTags(tagsInput.value),
        note: noteInput.value,
        markdown: snapshot.markdown,
        messageCount: snapshot.messageCount,
        savedAt: existing?.savedAt || now,
        updatedAt: now
      });
      await transaction('readwrite', (store) => store.put(record));
      currentRecordId = record.id;
      await reloadRecords();
      render();
      status(`${existing ? t.updated : t.saved}: ${record.title}`, 'success');
    } finally {
      setBusy(false);
    }
  }

  async function exportSelected() {
    const ids = new Set(selectedIds());
    const items = records.filter((record) => ids.has(record.id));
    if (!items.length) throw new Error(t.select);
    if (items.some((item) => !item.markdown)) throw new Error(t.snapshotMissing);
    setBusy(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'workspace-bulk-export', items });
      if (!response?.ok) throw new Error(response?.error || 'Bulk export failed.');
      status(`${t.exportDone} ${response.filename || ''}`.trim(), 'success');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const ids = selectedIds();
    if (!ids.length) throw new Error(t.select);
    if (!window.confirm(t.deleteConfirm)) return;
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => transaction('readwrite', (store) => store.delete(id))));
      await reloadRecords();
      render();
      status(t.deleted, 'success');
    } finally {
      setBusy(false);
    }
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readPrompts() {
    try {
      const value = JSON.parse(localStorage.getItem(PROMPT_STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function backup() {
    const payload = {
      schema: 'thread-to-markdown-local-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      workspace: records,
      prompts: readPrompts()
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`thread-to-markdown-backup-${stamp}.json`, payload);
    status(t.backupDone, 'success');
  }

  async function restore(file) {
    const parsed = JSON.parse(await file.text());
    if (parsed?.schema !== 'thread-to-markdown-local-backup' || Number(parsed?.version) !== 2 || !Array.isArray(parsed?.workspace)) {
      throw new Error(t.restoreError);
    }
    if (!window.confirm(t.restoreConfirm)) return;
    const restored = parsed.workspace.map(cleanRecord).slice(0, MAX_RECORDS);
    setBusy(true);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        store.clear();
        restored.forEach((record) => store.put(record));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error(t.storageError));
      });
      if (Array.isArray(parsed.prompts)) localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(parsed.prompts));
      await reloadRecords();
      render();
      status(t.restoreDone, 'success');
      setTimeout(() => location.reload(), 350);
    } finally {
      setBusy(false);
    }
  }

  saveButton.addEventListener('click', () => saveCurrent().catch((error) => status(String(error?.message || error), 'error')));
  clearButton.addEventListener('click', () => fillCurrent(null));
  searchInput.addEventListener('input', render);
  folderFilter.addEventListener('change', render);
  listNode.addEventListener('change', updateBulkButtons);
  listNode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workspace-action="open"]');
    const card = button?.closest('[data-workspace-id]');
    const record = records.find((item) => item.id === card?.dataset?.workspaceId);
    if (button && record?.url) chrome.tabs.create({ url: record.url });
  });
  exportButton.addEventListener('click', () => exportSelected().catch((error) => status(String(error?.message || error), 'error')));
  deleteButton.addEventListener('click', () => deleteSelected().catch((error) => status(String(error?.message || error), 'error')));
  backupButton.addEventListener('click', backup);
  restoreButton.addEventListener('click', () => restoreFile.click());
  restoreFile.addEventListener('change', () => {
    const file = restoreFile.files?.[0];
    if (file) restore(file).catch((error) => status(String(error?.message || error), 'error'));
    restoreFile.value = '';
  });

  void (async () => {
    try {
      db = await openDatabase();
      await reloadRecords();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentUrl = /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\//i.test(tab?.url || '') ? String(tab.url) : '';
      currentTitleNode.textContent = t.current;
      render();
    } catch (error) {
      status(String(error?.message || error || t.storageError), 'error');
      root.open = false;
    }
  })();
})();
