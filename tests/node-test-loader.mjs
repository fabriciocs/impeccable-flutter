const TEST_COMPAT_URL = new URL('./node-test-compat.mjs', import.meta.url).href;
const BROWSER_DRIVER_URL = new URL('./lib/browser-driver.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'bun:test') {
    return { url: TEST_COMPAT_URL, shortCircuit: true };
  }
  if (specifier === 'playwright') {
    return { url: BROWSER_DRIVER_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
