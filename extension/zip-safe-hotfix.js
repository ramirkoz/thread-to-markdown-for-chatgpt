'use strict';

(() => {
  const safeZipFallbackExportThread = self.exportThread;
  const safeZipPrepareThread = self.prepareThread;

  if (
    typeof safeZipFallbackExportThread !== 'function' ||
    typeof safeZipPrepareThread !== 'function' ||
    typeof collectPortableAssets !== 'function' ||
    typeof collectFileCardAttachments !== 'function' ||
    typeof collectRelativeAttachmentCards !== 'function' ||
    typeof mergeCapturedAssets !== 'function' ||
    typeof buildPortablePackage !== 'function' ||
    typeof bytesToDataUrl !== 'function'
  ) {
    throw new Error('Safe ZIP export dependencies were not initialized.');
  }

  const includedBytes = (assets) => (Array.isArray(assets) ? assets : []).reduce(
    (sum, asset) => sum + (asset?.included ? Number(asset.size || 0) : 0),
    0
  );

  const usedSlots = (assets) => (Array.isArray(assets) ? assets : [])
    .filter((asset) => asset?.type !== 'notice')
    .length;

  self.exportThread = async function exportThreadWithSafeZip(
    tabId,
    selectedIndices,
    requestedFormat
  ) {
    if (requestedFormat !== 'zip') {
      return safeZipFallbackExportThread(tabId, selectedIndices, requestedFormat);
    }

    const jsonResult = await safeZipPrepareThread(tabId, selectedIndices, 'json');
    const payload = JSON.parse(jsonResult.content);

    const baseRuns = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectPortableAssets,
      args: [selectedIndices]
    });
    const baseAssets = Array.isArray(baseRuns?.[0]?.result?.assets)
      ? baseRuns[0].result.assets
      : [];

    const firstRemainingBytes = Math.max(
      0,
      16 * 1024 * 1024 - includedBytes(baseAssets)
    );
    const firstRemainingSlots = Math.max(0, 40 - usedSlots(baseAssets));

    let cardAssets = [];
    if (firstRemainingBytes > 0 && firstRemainingSlots > 0) {
      const cardRuns = await chrome.scripting.executeScript({
        target: { tabId },
        func: collectFileCardAttachments,
        args: [selectedIndices, firstRemainingBytes, firstRemainingSlots]
      });
      cardAssets = Array.isArray(cardRuns?.[0]?.result?.assets)
        ? cardRuns[0].result.assets
        : [];
    }

    const firstMerge = mergeCapturedAssets(baseAssets, cardAssets);
    const secondRemainingBytes = Math.max(
      0,
      16 * 1024 * 1024 - includedBytes(firstMerge)
    );
    const secondRemainingSlots = Math.max(0, 40 - usedSlots(firstMerge));

    let relativeAssets = [];
    if (secondRemainingBytes > 0 && secondRemainingSlots > 0) {
      const relativeRuns = await chrome.scripting.executeScript({
        target: { tabId },
        func: collectRelativeAttachmentCards,
        args: [selectedIndices, secondRemainingBytes, secondRemainingSlots]
      });
      relativeAssets = Array.isArray(relativeRuns?.[0]?.result?.assets)
        ? relativeRuns[0].result.assets
        : [];
    }

    const capturedAssets = mergeCapturedAssets(firstMerge, relativeAssets);
    const packageResult = buildPortablePackage(payload, capturedAssets, jsonResult.filename);

    const downloadId = await chrome.downloads.download({
      url: bytesToDataUrl(packageResult.bytes, 'application/zip'),
      filename: packageResult.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#166534' });
    await chrome.action.setBadgeText({ tabId, text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2500);

    return {
      filename: packageResult.filename,
      messageCount: Number(payload.selectedCount || payload.messages?.length || 0),
      format: 'zip',
      includedAssets: packageResult.includedAssets,
      skippedAssets: packageResult.skippedAssets,
      safeMode: true,
      downloadId
    };
  };
})();
