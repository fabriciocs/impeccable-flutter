/**
 * Impeccable DevTools Extension - Popup
 *
 * Quick controls: scan, toggle overlays, and see finding count.
 */

const countNumber = document.getElementById('count-number');
const countLabel = document.getElementById('count-label');
const btnScan = document.getElementById('btn-scan');
const btnToggle = document.getElementById('btn-toggle');
const scanError = document.getElementById('scan-error');
const flutterHint = document.getElementById('flutter-hint');

let overlaysVisible = true;
// The popup only ever reflects the active tab. Broadcasts from the service
// worker carry a tabId, so we cache the active one and ignore updates meant
// for other tabs (e.g. a DevTools-driven rescan failing on a background tab).
let activeTabId = null;

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function updateFromState(state) {
  if (!state) return;
  const count = state.findings?.reduce((sum, f) => sum + f.findings.length, 0) || 0;
  countNumber.textContent = String(count);
  countNumber.classList.toggle('has-findings', count > 0);
  countLabel.textContent = count === 1 ? 'anti-pattern' : 'anti-patterns';
  overlaysVisible = state.overlaysVisible !== false;
  btnToggle.textContent = overlaysVisible ? 'Hide overlays' : 'Show overlays';
}

/**
 * Best-effort rendered Flutter Web identification.
 *
 * This function is intentionally self-contained because Chrome serializes it
 * into the inspected page with `executeScript`. It combines stable bootstrap
 * evidence with DOM evidence instead of depending only on private `flt-*`
 * internals, which can change between Flutter renderer versions.
 */
function detectFlutterWebDocument() {
  const scriptSources = Array.from(document.scripts, (script) => script.src || '');
  const hasFlutterBootstrap = scriptSources.some((src) =>
    /(?:^|\/)(?:flutter(?:_bootstrap)?\.js|main\.dart\.js)(?:[?#]|$)/i.test(src),
  );
  const hasFlutterGlobal = Boolean(
    window._flutter
      || window.flutterConfiguration
      || window.flutterWebRenderer,
  );
  const hasStableFlutterElement = Boolean(document.querySelector('flutter-view'));
  const hasLegacyRendererElement = Boolean(
    document.querySelector('flt-glass-pane, flt-scene-host'),
  );
  const hasFlutterAssetManifest = Array.from(document.querySelectorAll('link[href], meta[content]'))
    .some((node) => /(?:flutter_service_worker\.js|assets\/AssetManifest)/i.test(
      node.getAttribute('href') || node.getAttribute('content') || '',
    ));

  return hasFlutterBootstrap
    || hasFlutterGlobal
    || hasStableFlutterElement
    || hasLegacyRendererElement
    || hasFlutterAssetManifest;
}

async function updateFlutterHint(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: detectFlutterWebDocument,
    });
    flutterHint.hidden = results?.[0]?.result !== true;
  } catch {
    // Browser-internal pages and other restricted tabs cannot be scripted.
    // The normal scan path handles those errors; this hint is best-effort.
    flutterHint.hidden = true;
  }
}

async function loadState() {
  const tabId = await getActiveTabId();
  if (!tabId) return;
  activeTabId = tabId;
  chrome.runtime.sendMessage({ action: 'get-state', tabId }, updateFromState);
  await updateFlutterHint(tabId);
}

// Listen for real-time updates from service worker
chrome.runtime.onMessage.addListener((msg) => {
  // Ignore broadcasts for a tab other than the one this popup is showing.
  if (msg.tabId != null && activeTabId != null && msg.tabId !== activeTabId) return;
  if (msg.action === 'findings-updated') {
    const count = msg.findings?.reduce((sum, f) => sum + f.findings.length, 0) || 0;
    countNumber.textContent = String(count);
    countNumber.classList.toggle('has-findings', count > 0);
    countLabel.textContent = count === 1 ? 'anti-pattern' : 'anti-patterns';
    btnScan.textContent = 'Scan page';
    btnScan.disabled = false;
    scanError.hidden = true;
  }
  if (msg.action === 'scan-failed') {
    btnScan.textContent = 'Scan page';
    btnScan.disabled = false;
    scanError.textContent = msg.message || 'Couldn\u2019t scan this page.';
    scanError.hidden = false;
  }
  if (msg.action === 'overlays-toggled-broadcast') {
    overlaysVisible = msg.visible;
    btnToggle.textContent = overlaysVisible ? 'Hide overlays' : 'Show overlays';
  }
});

// Refresh the best-effort Flutter hint if the active tab changes or finishes a
// navigation while the popup remains open. Source/project classification is
// intentionally independent from this rendered-page hint.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  activeTabId = tabId;
  chrome.runtime.sendMessage({ action: 'get-state', tabId }, updateFromState);
  await updateFlutterHint(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (tabId !== activeTabId || changeInfo.status !== 'complete') return;
  await updateFlutterHint(tabId);
});

btnScan.addEventListener('click', async () => {
  const tabId = await getActiveTabId();
  if (!tabId) return;
  activeTabId = tabId;
  scanError.hidden = true;
  btnScan.textContent = 'Scanning...';
  btnScan.disabled = true;
  chrome.runtime.sendMessage({ action: 'scan', tabId });
});

btnToggle.addEventListener('click', async () => {
  const tabId = await getActiveTabId();
  if (!tabId) return;
  chrome.runtime.sendMessage({ action: 'toggle-overlays', tabId });
  overlaysVisible = !overlaysVisible;
  btnToggle.textContent = overlaysVisible ? 'Hide overlays' : 'Show overlays';
});

loadState();