'use strict';

const baseSafeUrl = self.safeUrl;
const baseBuildHtmlExport = self.buildHtmlExport;

if (typeof baseSafeUrl !== 'function' || typeof baseBuildHtmlExport !== 'function') {
  throw new Error('HTML asset support dependencies were not initialized.');
}

self.safeUrl = function safeUrlWithPackagedAssets(value) {
  const url = String(value || '').replace(/&amp;/g, '&').trim();
  if (/^(?:\.\.?\/)?(?:assets|attachments)\/[a-z0-9_().+,% -]+$/i.test(url)) {
    return url;
  }
  return baseSafeUrl(value);
};

self.buildHtmlExport = function buildHtmlExportWithAssetStyles(result) {
  const output = baseBuildHtmlExport(result);
  if (!output?.ok || typeof output.content !== 'string') return output;

  output.content = output.content.replace(
    '</style>',
    'img{display:block;max-width:100%;height:auto;margin:1em 0;border-radius:8px}figure{margin:1em 0}</style>'
  );
  return output;
};
