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
    const language = parsed.documentElement.getAttribute('lang') || 'und';
    const title = String(message.filename || parsed.title || 'chatgpt-thread.pdf')
      .replace(/\.pdf$/i, '');

    document.documentElement.lang = language;
    document.title = title;
    document.body.innerHTML = parsed.body.innerHTML;

    await waitForImages(document.images, 2500);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    setTimeout(() => window.print(), 150);
  } catch (error) {
    showError(String(error?.message || error));
  }
});

port.postMessage({ token });

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
