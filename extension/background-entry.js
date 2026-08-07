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
      console.warn('ChatExtra Toolkit: JSON cleanup skipped.', error);
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
importScripts('html-assets.js');
importScripts('language-export.js');
importScripts('pdf-export.js');
importScripts('package-export.js');
importScripts('workspace-bulk-export.js');
importScripts('attachment-export-fix.js');
importScripts('attachment-preview-filter.js');
importScripts('attachment-relative-url-fix.js');
importScripts('attachment-resource-fallback.js');
importScripts('attachment-activation-fallback.js');
importScripts('attachment-main-world-fallback.js');
importScripts('attachment-unicode-output-fix.js');
importScripts('attachment-output-card-annotation.js');
importScripts('attachment-output-proxy-fix.js');
importScripts('attachment-output-card-button-fix.js');
importScripts('attachment-output-card-interactive-fix.js');
importScripts('attachment-output-card-self-contained-fix.js');
importScripts('attachment-output-index-fix.js');
importScripts('attachment-output-card-geometric-bridge.js');
importScripts('attachment-output-index-bridge-cleanup.js');
importScripts('attachment-filename-preservation-fix.js');
importScripts('attachment-link-path-fix.js');
importScripts('selected-text-handoff-background.js');
importScripts('screenshot-handoff-background.js');
