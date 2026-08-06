'use strict';

const attachmentPreviewBaseMerge = mergeCapturedAssets;

if (typeof attachmentPreviewBaseMerge !== 'function') {
  throw new Error('Attachment preview cleanup dependency was not initialized.');
}

mergeCapturedAssets = function mergeCapturedAssetsWithoutImagePreviewDuplicates(
  baseAssets,
  supplementalAssets
) {
  const merged = attachmentPreviewBaseMerge(baseAssets, supplementalAssets);
  const imagePreviewLabel = /(?:open|view|preview)\s+image|відкрити\s+зображення|переглянути\s+зображення|попередній\s+перегляд\s+зображення/i;

  return merged.filter((asset) => !(
    asset?.type === 'attachment' &&
    asset?.included === false &&
    imagePreviewLabel.test(String(asset?.label || '')) &&
    /\.(?:png|jpe?g|gif|webp|svg)$/i.test(String(asset?.label || asset?.filename || ''))
  ));
};
