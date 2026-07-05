import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function browserExecutableCandidates() {
  const envCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
  ];
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    return [
      ...envCandidates,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      local ? path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      local ? path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    ];
  }
  if (process.platform === 'darwin') {
    return [
      ...envCandidates,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      path.join(os.homedir(), 'Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    ...envCandidates,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
  ];
}

function resolveBrowserExecutable(explicitPath = null) {
  const candidates = explicitPath ? [explicitPath] : browserExecutableCandidates();
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function defaultBrowserLaunchArgs(extraArgs = []) {
  const args = [];
  if (process.env.CI) args.push('--no-sandbox', '--disable-setuid-sandbox');
  return [...args, ...extraArgs];
}

async function importPuppeteerCore() {
  try {
    return await import('puppeteer-core');
  } catch (err) {
    throw new Error(
      `puppeteer-core is required for browser automation (${err.message}). Run npm install after updating dependencies.`,
    );
  }
}

async function launchLocalBrowser({
  executablePath = null,
  headless = true,
  args = [],
  defaultViewport,
  ignoreHTTPSErrors,
  ...rest
} = {}) {
  const puppeteer = await importPuppeteerCore();
  const resolvedExecutablePath = resolveBrowserExecutable(executablePath);
  if (!resolvedExecutablePath) {
    throw new Error(
      'No local Chrome, Edge, or Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH to an installed browser path.',
    );
  }
  return puppeteer.default.launch({
    executablePath: resolvedExecutablePath,
    headless,
    args: defaultBrowserLaunchArgs(args),
    defaultViewport,
    ignoreHTTPSErrors,
    ...rest,
  });
}

export {
  browserExecutableCandidates,
  defaultBrowserLaunchArgs,
  importPuppeteerCore,
  launchLocalBrowser,
  resolveBrowserExecutable,
};
