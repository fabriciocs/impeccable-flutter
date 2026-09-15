import { accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

function executableExists(file) {
  if (!file) return false;
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandPath(command) {
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    return execFileSync(locator, [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || null;
  } catch {
    return null;
  }
}

export function resolveBrowserExecutable() {
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (explicit && executableExists(explicit)) return explicit;

  const candidates = [];
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      candidates.push(
        `${base}\\Google\\Chrome\\Application\\chrome.exe`,
        `${base}\\Microsoft\\Edge\\Application\\msedge.exe`,
        `${base}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      );
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable',
      '/usr/bin/brave-browser',
      '/snap/bin/chromium',
    );
  }

  const direct = candidates.find(executableExists);
  if (direct) return direct;

  for (const command of [
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    'microsoft-edge', 'microsoft-edge-stable', 'brave-browser', 'chrome', 'msedge',
  ]) {
    const found = commandPath(command);
    if (found && executableExists(found)) return found;
  }

  throw new Error(
    'No Chrome/Chromium/Edge executable found. Set PUPPETEER_EXECUTABLE_PATH to an installed browser.',
  );
}
