import { launchLocalBrowser } from '../../cli/engine/node/local-browser.mjs';

async function launchLiveBrowser(options = {}) {
  const browser = await launchLocalBrowser({ headless: true, ...options });
  return installBrowserCompat(browser);
}

function installBrowserCompat(browser) {
  if (browser.__impeccablePuppeteerCompat) return browser;
  Object.defineProperty(browser, '__impeccablePuppeteerCompat', { value: true });
  browser.newContext = async (options = {}) => {
    const pages = new Set();
    return {
      async newPage() {
        const page = await browser.newPage();
        pages.add(page);
        installPageCompat(page, options);
        return page;
      },
      async close() {
        await Promise.all([...pages].map((page) => page.close().catch(() => {})));
        pages.clear();
      },
    };
  };
  return browser;
}

function installPageCompat(page) {
  if (page.__impeccablePuppeteerCompat) return page;
  Object.defineProperty(page, '__impeccablePuppeteerCompat', { value: true });

  const waitForFunction = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, argOrOptions = {}, maybeOptions = null) => {
    if (maybeOptions) return waitForFunction(fn, maybeOptions, argOrOptions);
    return waitForFunction(fn, argOrOptions);
  };

  page.waitForTimeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  page.waitForEvent = (eventName, { timeout = 30_000 } = {}) => new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      page.off(eventName, onEvent);
    };
    const onEvent = (event) => {
      cleanup();
      resolve(event);
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for page event ${eventName}`));
    }, timeout);
    page.on(eventName, onEvent);
  });

  page.evaluateOnNewDocument(installLocatorHelpers).catch(() => {});
  page.evaluate(installLocatorHelpers).catch(() => {});
  page.locator = (selector, options = {}) => createLocator(page, [{ selector, options, first: false }]);
  return page;
}

function createLocator(page, chain) {
  return {
    first() {
      const next = chain.slice();
      next[next.length - 1] = { ...next[next.length - 1], first: true };
      return createLocator(page, next);
    },
    locator(selector, options = {}) {
      return createLocator(page, [...chain, { selector, options, first: false }]);
    },
    async count() {
      return page.evaluate((serialized) => window.__impeccablePuppeteerCompatFind(serialized).length, serializeChain(chain));
    },
    async isVisible() {
      return page.evaluate((serialized) => {
        const el = window.__impeccablePuppeteerCompatFind(serialized)[0];
        return Boolean(el && window.__impeccablePuppeteerCompatVisible(el));
      }, serializeChain(chain));
    },
    async waitFor({ state = 'visible', timeout = 30_000 } = {}) {
      return waitForLocator(page, chain, { state, timeout });
    },
    async click({ timeout = 30_000 } = {}) {
      const handle = await waitForLocator(page, chain, { state: 'visible', timeout });
      await handle.click();
    },
    async fill(value, { timeout = 30_000 } = {}) {
      const handle = await waitForLocator(page, chain, { state: 'visible', timeout });
      await handle.focus();
      await page.evaluate((el, nextValue) => {
        if ('value' in el) el.value = nextValue;
        else el.textContent = nextValue;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextValue }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, handle, value);
    },
    async type(value, { timeout = 30_000 } = {}) {
      const handle = await waitForLocator(page, chain, { state: 'visible', timeout });
      await handle.click();
      await page.keyboard.type(value);
    },
    async press(key, { timeout = 30_000 } = {}) {
      const handle = await waitForLocator(page, chain, { state: 'visible', timeout });
      await handle.click();
      await page.keyboard.press(key);
    },
    async textContent({ timeout = 30_000 } = {}) {
      const handle = await waitForLocator(page, chain, { state: 'attached', timeout });
      return handle.evaluate((el) => el.textContent);
    },
    async evaluate(fn) {
      const handle = await waitForLocator(page, chain, { state: 'attached', timeout: 30_000 });
      return handle.evaluate(fn);
    },
  };
}

async function waitForLocator(page, chain, { state, timeout }) {
  const started = Date.now();
  const serialized = serializeChain(chain);
  while (Date.now() - started < timeout) {
    const handle = await page.evaluateHandle((input) => {
      const el = window.__impeccablePuppeteerCompatFind(input.serialized)[0] || null;
      if (!el) return null;
      if (input.state === 'visible' && !window.__impeccablePuppeteerCompatVisible(el)) return null;
      return el;
    }, { serialized, state });
    const element = handle.asElement();
    if (element) return element;
    await handle.dispose().catch(() => {});
    await page.waitForTimeout(50);
  }
  throw new Error(`Locator ${chain.map((part) => part.selector).join(' >> ')} did not reach state ${state} in ${timeout}ms`);
}

function serializeChain(chain) {
  return chain.map((part) => ({
    selector: part.selector,
    first: part.first === true,
    hasText: serializeTextMatcher(part.options?.hasText),
  }));
}

function serializeTextMatcher(value) {
  if (value == null) return null;
  if (value instanceof RegExp) return { type: 'regex', source: value.source, flags: value.flags };
  return { type: 'text', value: String(value) };
}

function installLocatorHelpers() {
  if (window.__impeccablePuppeteerCompatFind) return;
  const queryAll = (root, selector) => {
    if (root === document && typeof window.__impeccableLiveQueryAll === 'function') {
      return Array.from(window.__impeccableLiveQueryAll(selector) || []);
    }
    const results = [];
    if (root?.querySelectorAll) results.push(...root.querySelectorAll(selector));
    if (root?.shadowRoot?.querySelectorAll) results.push(...root.shadowRoot.querySelectorAll(selector));
    return results;
  };
  const matchesText = (el, matcher) => {
    if (!matcher) return true;
    const text = el?.textContent || '';
    if (matcher.type === 'regex') return new RegExp(matcher.source, matcher.flags).test(text);
    return text.includes(matcher.value);
  };
  window.__impeccablePuppeteerCompatFind = (chain) => {
    let roots = [document];
    for (const part of chain) {
      const matches = roots
        .flatMap((root) => queryAll(root, part.selector))
        .filter((el) => matchesText(el, part.hasText));
      roots = part.first ? matches.slice(0, 1) : matches;
      if (roots.length === 0) break;
    }
    return roots;
  };
  window.__impeccablePuppeteerCompatVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
}

export { installBrowserCompat, installPageCompat, launchLiveBrowser };
