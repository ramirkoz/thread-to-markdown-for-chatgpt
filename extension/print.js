'use strict';

const token = new URLSearchParams(location.search).get('token') || '';
const port = chrome.runtime.connect({ name: 'pdf-print' });

port.onMessage.addListener(async (message) => {
  if (!message?.ok || typeof message.content !== 'string') {
    showError(message?.error || 'The PDF document could not be prepared.');
    return;
  }

  try {
    const parsed = new DOMParser().parseFromString(message.content, 'text/html');
    const language = normalizeLanguage(parsed.documentElement.getAttribute('lang'));
    const title = String(message.filename || parsed.title || 'chatgpt-thread.pdf')
      .replace(/\.pdf$/i, '');

    document.documentElement.lang = language;
    document.title = title;

    const documentContent = document.createDocumentFragment();
    for (const node of parsed.body.childNodes) {
      documentContent.append(document.importNode(node, true));
    }
    document.body.replaceChildren(documentContent);

    const guide = buildPrintGuide(language);
    document.body.prepend(guide);

    await waitForImages(document.images, 2500);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const printButton = document.getElementById('open-print-dialog');
    printButton?.addEventListener('click', () => window.print());
    printButton?.focus();
  } catch (error) {
    showError(String(error?.message || error));
  }
});

port.postMessage({ token });

function buildPrintGuide(language) {
  const copy = printCopy(language);
  const guide = document.createElement('aside');
  guide.className = 'print-guide';
  guide.setAttribute('aria-labelledby', 'print-guide-title');

  const heading = document.createElement('h1');
  heading.id = 'print-guide-title';
  heading.textContent = copy.heading;

  const intro = document.createElement('p');
  intro.textContent = copy.intro;

  const steps = document.createElement('ol');
  for (const step of copy.steps) {
    const item = document.createElement('li');
    item.textContent = step;
    steps.append(item);
  }

  const actions = document.createElement('div');
  actions.className = 'print-actions';

  const printButton = document.createElement('button');
  printButton.id = 'open-print-dialog';
  printButton.type = 'button';
  printButton.textContent = copy.button;

  const note = document.createElement('span');
  note.textContent = copy.note;

  actions.append(printButton, note);
  guide.append(heading, intro, steps, actions);
  return guide;
}

function printCopy(language) {
  const copies = {
    uk: {
      heading: 'PDF готовий до друку',
      intro: 'Щоб у PDF не було дати, адреси chrome-extension:// та номерів сторінок:',
      steps: [
        'Натисніть «Відкрити друк».',
        'У вікні Chrome відкрийте «Додаткові налаштування».',
        'Вимкніть «Колонтитули».',
        'Оберіть «Зберегти як PDF».'
      ],
      button: 'Відкрити друк',
      note: 'Ця підказка не потрапить у PDF.'
    },
    ru: {
      heading: 'PDF готов к печати',
      intro: 'Чтобы в PDF не было даты, адреса chrome-extension:// и номеров страниц:',
      steps: [
        'Нажмите «Открыть печать».',
        'В окне Chrome откройте «Дополнительные настройки».',
        'Отключите «Колонтитулы».',
        'Выберите «Сохранить как PDF».'
      ],
      button: 'Открыть печать',
      note: 'Эта подсказка не попадёт в PDF.'
    },
    en: {
      heading: 'PDF is ready to print',
      intro: 'To remove the date, chrome-extension:// address, and page numbers from the PDF:',
      steps: [
        'Select Open print dialog.',
        'In Chrome, open More settings.',
        'Turn off Headers and footers.',
        'Choose Save as PDF.'
      ],
      button: 'Open print dialog',
      note: 'This guide will not appear in the PDF.'
    }
  };

  return copies[normalizeLanguage(language)] || copies.en;
}

function normalizeLanguage(value) {
  const language = String(value || '').toLowerCase().split('-')[0];
  return ['uk', 'ru', 'en'].includes(language) ? language : 'en';
}

function waitForImages(images, timeoutMs) {
  const pending = [...images]
    .filter((image) => !image.complete)
    .map((image) => new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }));

  if (!pending.length) return Promise.resolve();

  return Promise.race([
    Promise.all(pending),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

function showError(message) {
  const loading = document.getElementById('loading') || document.body;
  loading.innerHTML = '';
  const heading = document.createElement('h1');
  heading.textContent = 'PDF export failed';
  const paragraph = document.createElement('p');
  paragraph.textContent = String(message || 'Unknown error');
  loading.append(heading, paragraph);
}
