const COMPAT_URL = new URL('./node-test-compat.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'bun:test') {
    return { url: COMPAT_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
