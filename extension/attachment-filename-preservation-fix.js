'use strict';

const attachmentFilenameBaseBuildPortablePackage = buildPortablePackage;

if (typeof attachmentFilenameBaseBuildPortablePackage !== 'function') {
  throw new Error('Attachment filename preservation dependencies were not initialized.');
}

buildPortablePackage = function buildPortablePackageWithAttachmentFilenames(
  payload,
  capturedAssets,
  jsonFilename
) {
  const normalizedAssets = (Array.isArray(capturedAssets) ? capturedAssets : [])
    .map(preserveAttachmentFilename);

  return attachmentFilenameBaseBuildPortablePackage(
    payload,
    normalizedAssets,
    jsonFilename
  );
};

function preserveAttachmentFilename(asset) {
  if (asset?.type !== 'attachment') return asset;

  const supportedExtension = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv|json|md|html?|png|jpe?g|gif|webp|svg|mp3|wav|mp4|mov|webm|exe)$/iu;
  const clean = (value) => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\\([_*`~[\]()])/g, '$1')
    .replace(/^\s*(?:download\s+file|завантажити\s+файл)\s*[:—-]?\s*/iu, '')
    .replace(/^['"“”«»`*\s]+|['"“”«»`*\s]+$/gu, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  const candidate = clean(asset.label);
  const current = clean(asset.filename);
  if (!candidate || !supportedExtension.test(candidate)) return asset;
  if (!current || candidate.normalize('NFKC') !== current.normalize('NFKC')) {
    return { ...asset, filename: candidate };
  }
  return asset;
}
