import { accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const OPTION_KEYS = new Set(['timeout', 'polling', 'signal']);

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
    const tool = process.platform === 'win32' ? 'where.exe' : 'which';
    return execFileSync(tool, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
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

class ElementAdapter {
  constructor(page, handle) {
    this.page = page;
    this.handle = handle;
  }

  async click(options = {}) {
    await this.handle.click({ button: options.button, clickCount: options.clickCount, delay: options.delay });
  }

  async fill(value) {
    await this.handle.evaluate((el, next) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
        el.value = String(next);
      } else {
        el.focus?.();
        el.textContent = String(next);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  async type(value, options = {}) {
    await this.handle.focus();
    await this.page.raw.keyboard.type(String(value), { delay: options.delay });
  }

  async press(key) {
    await this.handle.focus();
    await this.page.raw.keyboard.press(key);
  }

  async evaluate(fn, arg) {
    return this.handle.evaluate(fn, arg);
  }

  async innerText() {
    return this.handle.evaluate((el) => el.innerText || '');
  }

  async textContent() {
    return this.handle.evaluate((el) => el.textContent);
  }

  async getAttribute(name) {
    return this.handle.evaluate((el, key) => el.getAttribute(key), name);
  }
}

class LocatorAdapter {
  constructor(page, selector, options = {}, index = null) {
    this.page = page;
    this.selector = selector;
    this.options = options;
    this.index = index;
  }

  first() {
    return new LocatorAdapter(this.page, this.selector, this.options, 0);
  }

  nth(index) {
    return new LocatorAdapter(this.page, this.selector, this.options, index);
  }

  locator(selector, options = {}) {
    return new LocatorAdapter(this.page, `${this.selector} ${selector}`, options, null);
  }

  async _handles() {
    const handles = await this.page.raw.$$(this.selector);
    const hasText = this.options?.hasText;
    if (hasText == null) return handles;
    const out = [];
    for (const handle of handles) {
      const text = await handle.evaluate((el) => el.textContent || '');
      const matched = hasText instanceof RegExp ? hasText.test(text) : text.includes(String(hasText));
      if (matched) out.push(handle);
    }
    return out;
  }

  async _one(timeout = 5000) {
    const deadline = Date.now() + timeout;
    do {
      const handles = await this._handles();
      const handle = this.index == null ? handles[0] : handles[this.index];
      if (handle) return handle;
      await new Promise((resolve) => setTimeout(resolve, 50));
    } while (Date.now() < deadline);
    throw new Error(`Element not found: ${this.selector}`);
  }

  async count() {
    return (await this._handles()).length;
  }

  async click(options = {}) {
    const handle = await this._one(options.timeout ?? 5000);
    await new ElementAdapter(this.page, handle).click(options);
  }

  async evaluate(fn, arg) {
    const handle = await this._one();
    return handle.evaluate(fn, arg);
  }

  async fill(value, options = {}) {
    const handle = await this._one(options.timeout ?? 5000);
    return new ElementAdapter(this.page, handle).fill(value);
  }

  async type(value, options = {}) {
    const handle = await this._one(options.timeout ?? 5000);
    return new ElementAdapter(this.page, handle).type(value, options);
  }

  async press(key) {
    const handle = await this._one();
    return new ElementAdapter(this.page, handle).press(key);
  }

  async innerText() {
    const handle = await this._one();
    return new ElementAdapter(this.page, handle).innerText();
  }

  async textContent() {
    const handle = await this._one();
    return new ElementAdapter(this.page, handle).textContent();
  }

  async getAttribute(name) {
    const handle = await this._one();
    return new ElementAdapter(this.page, handle).getAttribute(name);
  }

  async waitFor({ state = 'visible', timeout = 5000 } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const handles = await this._handles();
      const selected = this.index == null ? handles[0] : handles[this.index];
      const exists = Boolean(selected);
      const visible = selected
        ? await selected.evaluate((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
          })
        : false;
      if ((state === 'attached' && exists) || (state === 'detached' && !exists)
          || (state === 'visible' && visible) || (state === 'hidden' && (!exists || !visible))) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${state}: ${this.selector}`);
  }
}

class PageAdapter {
  constructor(raw) {
    this.raw = raw;
    this.mouse = raw.mouse;
    this.keyboard = raw.keyboard;
  }

  on(event, handler) {
    this.raw.on(event, handler);
    return this;
  }

  once(event, handler) {
    this.raw.once(event, handler);
    return this;
  }

  mainFrame() { return this.raw.mainFrame(); }
  url() { return this.raw.url(); }
  goto(url, options) { return this.raw.goto(url, options); }
  reload(options) { return this.raw.reload(options); }
  close(options) { return this.raw.close(options); }
  screenshot(options) { return this.raw.screenshot(options); }
  setDefaultTimeout(timeout) { this.raw.setDefaultTimeout(timeout); }
  setViewportSize(viewport) { return this.raw.setViewport(viewport); }
  waitForNavigation(options) { return this.raw.waitForNavigation(options); }
  waitForSelector(selector, options) { return this.raw.waitForSelector(selector, options); }
  click(selector, options) { return this.raw.click(selector, options); }
  evaluate(fn, arg) { return arguments.length > 1 ? this.raw.evaluate(fn, arg) : this.raw.evaluate(fn); }
  addInitScript(fn, arg) { return this.raw.evaluateOnNewDocument(fn, arg); }
  locator(selector, options) { return new LocatorAdapter(this, selector, options); }

  async $(selector) {
    const handle = await this.raw.$(selector);
    return handle ? new ElementAdapter(this, handle) : null;
  }

  async $$(selector) {
    return (await this.raw.$$(selector)).map((handle) => new ElementAdapter(this, handle));
  }

  async waitForTimeout(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  waitForFunction(fn, argOrOptions, maybeOptions) {
    if (maybeOptions !== undefined) return this.raw.waitForFunction(fn, maybeOptions || {}, argOrOptions);
    if (argOrOptions && typeof argOrOptions === 'object'
        && Object.keys(argOrOptions).every((key) => OPTION_KEYS.has(key))) {
      return this.raw.waitForFunction(fn, argOrOptions);
    }
    if (argOrOptions === undefined) return this.raw.waitForFunction(fn);
    return this.raw.waitForFunction(fn, {}, argOrOptions);
  }

  waitForEvent(event, { timeout = 5000 } = {}) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.raw.off(event, handler);
        reject(new Error(`Timed out waiting for page event ${event}`));
      }, timeout);
      const handler = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      this.raw.once(event, handler);
    });
  }
}

class ContextAdapter {
  constructor(raw, options = {}) {
    this.raw = raw;
    this.options = options;
    this.routes = [];
  }

  async route(_pattern, handler) {
    this.routes.push(handler);
  }

  async _applyOptions(page) {
    const features = [];
    if (this.options.colorScheme) features.push({ name: 'prefers-color-scheme', value: this.options.colorScheme });
    if (this.options.reducedMotion) features.push({ name: 'prefers-reduced-motion', value: this.options.reducedMotion });
    if (features.length) await page.emulateMediaFeatures(features);
    if (this.options.serviceWorkers === 'block') await page.setBypassServiceWorker(true);
    if (this.routes.length) {
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        const route = {
          request: () => request,
          abort: () => request.abort(),
          continue: () => request.continue(),
        };
        try {
          await this.routes[0](route);
        } catch {
          if (!request.isInterceptResolutionHandled?.()) await request.continue().catch(() => {});
        }
      });
    }
  }

  async newPage() {
    const rawPage = await this.raw.newPage();
    await this._applyOptions(rawPage);
    return new PageAdapter(rawPage);
  }

  close() { return this.raw.close(); }
}

class BrowserAdapter {
  constructor(raw) { this.raw = raw; }

  async newContext(options = {}) {
    const context = await this.raw.createBrowserContext();
    return new ContextAdapter(context, options);
  }

  close() { return this.raw.close(); }
}

export const chromium = {
  async launch(options = {}) {
    const executablePath = options.executablePath || resolveBrowserExecutable();
    const args = [...(options.args || [])];
    if (typeof process.getuid === 'function' && process.getuid() === 0) args.push('--no-sandbox', '--disable-setuid-sandbox');
    const raw = await puppeteer.launch({
      headless: options.headless ?? true,
      executablePath,
      args,
      acceptInsecureCerts: true,
      timeout: options.timeout,
    });
    return new BrowserAdapter(raw);
  },
};

export default { chromium, resolveBrowserExecutable };
