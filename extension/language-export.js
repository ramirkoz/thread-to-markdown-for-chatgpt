'use strict';

const htmlLanguageReadThread = self.readThread;

if (typeof htmlLanguageReadThread !== 'function') {
  throw new Error('HTML export layer was not initialized.');
}

self.readThread = async function readThreadWithLanguage(tabId, options = {}) {
  const result = await htmlLanguageReadThread(tabId, options);

  if (
    options.format === 'html' &&
    result?.ok &&
    typeof result.content === 'string'
  ) {
    const language = detectDocumentLanguage(result.content);
    result.content = result.content.replace(
      /<html\s+lang="[^"]*">/i,
      `<html lang="${language}">`
    );
  }

  return result;
};

function detectDocumentLanguage(html) {
  const text = String(html || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, ' ')
    .toLowerCase();

  const count = (pattern) => (text.match(pattern) || []).length;
  const ukrainian = count(/[іїєґ]/g) * 4 + count(/\b(?:україна|україн|повідомлення|розмова|потрібно|зроблено|через|щоб|який|яка|які)\b/gu);
  const russian = count(/[ыэъё]/g) * 4 + count(/\b(?:россия|русск|сообщение|разговор|нужно|сделано|через|чтобы|который|которая|которые)\b/gu);
  const cyrillic = count(/[а-яіїєґ]/g);
  const latin = count(/[a-z]/g);

  if (ukrainian > russian && ukrainian > 0) return 'uk';
  if (russian > ukrainian && russian > 0) return 'ru';

  const interfaceLanguage = String(chrome.i18n.getUILanguage?.() || '')
    .toLowerCase()
    .split('-')[0];

  if (cyrillic > latin) {
    return ['uk', 'ru'].includes(interfaceLanguage) ? interfaceLanguage : 'uk';
  }

  if (latin > 0) return 'en';
  return /^[a-z]{2}$/.test(interfaceLanguage) ? interfaceLanguage : 'und';
}
