'use strict';

importScripts('background.js');

const originalReadThread = self.readThread;

if (typeof originalReadThread !== 'function') {
  throw new Error('Thread reader was not initialized.');
}

self.readThread = async function readThreadWithCleanup(tabId, options = {}) {
  const result = await originalReadThread(tabId, options);
  return cleanExportResult(result, options);
};

function cleanExportResult(result, options) {
  if (!result?.ok || !options?.includeContent || typeof result.content !== 'string') {
    return result;
  }

  if (options.format === 'json') {
    try {
      const payload = JSON.parse(result.content);
      if (Array.isArray(payload.messages)) {
        payload.messages = payload.messages.map((message) => ({
          ...message,
          markdown: typeof message.markdown === 'string'
            ? stripServiceArtifacts(message.markdown)
            : message.markdown
        }));
      }
      result.content = JSON.stringify(payload, null, 2);
    } catch (error) {
      console.warn('Thread to Markdown: JSON cleanup skipped.', error);
    }
  } else if (options.format === 'markdown') {
    result.content = stripServiceArtifacts(result.content);
  }

  return result;
}

function stripServiceArtifacts(value) {
  const standaloneLabel = /^(?:цитата(?:\s+кодування)?|кодування|копіювати код|скопійовано|quote(?:\s+coding)?|citation|citations|coding|copy code|copied)$/iu;
  const trailingLabel = /[ \t]+(?:цитата\s+кодування|копіювати код|скопійовано|quote\s+coding|copy code|copied)(?=\s*(?:\n+---\s*)?(?:\n|$))/giu;

  const lines = String(value || '')
    .split('\n')
    .filter((line) => !standaloneLabel.test(stripMarkdownDecoration(line)));

  return lines
    .join('\n')
    .replace(trailingLabel, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownDecoration(value) {
  return String(value || '')
    .trim()
    .replace(/^[-*+]\s+/, '')
    .replace(/^#+\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/[*_`~]/g, '')
    .trim();
}

importScripts('html-export.js');
importScripts('language-export.js');
importScripts('pdf-export.js');
importScripts('package-export.js');
