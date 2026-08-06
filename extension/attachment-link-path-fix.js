'use strict';

const attachmentLinkBasePackageMarkdown = packageMarkdown;
const attachmentLinkBaseBuildHtmlExport = self.buildHtmlExport;

if (
  typeof attachmentLinkBasePackageMarkdown !== 'function' ||
  typeof attachmentLinkBaseBuildHtmlExport !== 'function'
) {
  throw new Error('Attachment link path dependencies were not initialized.');
}

packageMarkdown = function packageMarkdownWithEncodedAttachmentPaths(payload) {
  return attachmentLinkBasePackageMarkdown(normalizeAttachmentLinkPayload(payload));
};

self.buildHtmlExport = function buildHtmlExportWithEncodedAttachmentPaths(result) {
  if (!result?.ok || typeof result.content !== 'string') {
    return attachmentLinkBaseBuildHtmlExport(result);
  }

  try {
    const payload = JSON.parse(result.content);
    return attachmentLinkBaseBuildHtmlExport({
      ...result,
      content: JSON.stringify(normalizeAttachmentLinkPayload(payload))
    });
  } catch (_) {
    return attachmentLinkBaseBuildHtmlExport(result);
  }
};

buildHtmlExport = self.buildHtmlExport;

function normalizeAttachmentLinkPayload(payload) {
  if (!payload || !Array.isArray(payload.messages)) return payload;

  return {
    ...payload,
    messages: payload.messages.map((message) => {
      let markdown = String(message?.markdown || message?.text || '');

      for (const asset of Array.isArray(message?.assets) ? message.assets : []) {
        const path = String(asset?.path || '');
        if (!/^(?:assets|attachments)\//i.test(path)) continue;
        const encodedPath = encodeAttachmentLinkPath(path);
        markdown = markdown.split(`](${path})`).join(`](${encodedPath})`);
      }

      return { ...message, markdown };
    })
  };
}

function encodeAttachmentLinkPath(value) {
  return String(value || '')
    .split('/')
    .map((segment, index) => {
      if (index === 0) return segment;
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch (_) {
        // Keep the original segment when it is not valid percent encoding.
      }
      return encodeURIComponent(decoded).replace(/[!'()*]/g, (character) =>
        `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      );
    })
    .join('/');
}
