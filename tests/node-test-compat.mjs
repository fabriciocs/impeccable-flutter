import {
  after,
  afterEach,
  before,
  beforeEach,
  describe as nodeDescribe,
  mock as nodeMock,
  test as nodeTest,
} from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const ASYMMETRIC = Symbol('asymmetricMatcher');

function wrapTest(fn) {
  return function wrappedTest(name, optionsOrFn, maybeFnOrTimeout) {
    if (typeof optionsOrFn === 'function') {
      const options = typeof maybeFnOrTimeout === 'number'
        ? { timeout: maybeFnOrTimeout }
        : undefined;
      return options ? fn(name, options, optionsOrFn) : fn(name, optionsOrFn);
    }
    return fn(name, optionsOrFn, maybeFnOrTimeout);
  };
}

function wrapSuite(fn) {
  return function wrappedSuite(name, optionsOrFn, maybeFn) {
    if (typeof optionsOrFn === 'function') return fn(name, optionsOrFn);
    return fn(name, optionsOrFn, maybeFn);
  };
}

export const test = Object.assign(wrapTest(nodeTest), {
  skip: wrapTest(nodeTest.skip),
  only: wrapTest(nodeTest.only),
});

export const describe = Object.assign(wrapSuite(nodeDescribe), {
  skip: wrapSuite(nodeDescribe.skip),
  only: wrapSuite(nodeDescribe.only),
});

export {
  beforeEach,
  afterEach,
  before as beforeAll,
  after as afterAll,
};

export function mock(implementation = () => undefined) {
  let currentImplementation = implementation;
  function mockFn(...args) {
    mockFn.mock.calls.push({ args });
    return currentImplementation.apply(this, args);
  }
  mockFn.mock = {
    calls: [],
    clear() {
      mockFn.mock.calls.length = 0;
    },
  };
  mockFn.mockClear = mockFn.mock.clear;
  mockFn.mockReset = () => {
    mockFn.mock.calls.length = 0;
    currentImplementation = () => undefined;
    return mockFn;
  };
  mockFn.mockImplementation = (next) => {
    currentImplementation = next;
    return mockFn;
  };
  mockFn.mockReturnValue = (value) => {
    currentImplementation = () => value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => {
    currentImplementation = async () => value;
    return mockFn;
  };
  mockFn.mockRejectedValue = (error) => {
    currentImplementation = async () => { throw error; };
    return mockFn;
  };
  return mockFn;
}

// Supported for ordinary configurable object methods. ESM namespace exports
// are intentionally not patched: tests that rely on Bun redefining those
// bindings must be rewritten as integration tests during the migration.
export function spyOn(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || descriptor.configurable === false) {
    throw new TypeError(`Cannot spy on non-configurable property ${String(key)}; rewrite this test as an integration test`);
  }
  const original = object[key];
  const fn = mock((...args) => original.apply(object, args));
  Object.defineProperty(object, key, { ...descriptor, value: fn });
  fn.mockRestore = () => {
    Object.defineProperty(object, key, descriptor);
  };
  return fn;
}

function asymmetric(type, value) {
  return { [ASYMMETRIC]: true, type, value };
}

function isAsymmetric(value) {
  return Boolean(value && value[ASYMMETRIC]);
}

function matches(actual, expected) {
  if (isAsymmetric(expected)) {
    if (expected.type === 'anything') return actual !== null && actual !== undefined;
    if (expected.type === 'any') return actual instanceof expected.value || typeof actual === expected.value?.name?.toLowerCase();
    if (expected.type === 'stringContaining') {
      return typeof actual === 'string' && actual.includes(expected.value);
    }
    if (expected.type === 'stringMatching') {
      return expected.value instanceof RegExp
        ? expected.value.test(String(actual))
        : String(actual).includes(String(expected.value));
    }
    if (expected.type === 'arrayContaining') {
      return Array.isArray(actual)
        && expected.value.every((item) => actual.some((candidate) => matches(candidate, item)));
    }
    if (expected.type === 'objectContaining') {
      if (!actual || typeof actual !== 'object') return false;
      return Object.entries(expected.value).every(([key, value]) => matches(actual[key], value));
    }
  }

  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every((value, index) => matches(actual[index], value));
  }

  if (expected && typeof expected === 'object') {
    const expectedEntries = Object.entries(expected);
    if (expectedEntries.some(([, value]) => isAsymmetric(value))) {
      if (!actual || typeof actual !== 'object') return false;
      return expectedEntries.every(([key, value]) => matches(actual[key], value));
    }
  }

  return isDeepStrictEqual(actual, expected);
}

function getCalls(fn) {
  if (Array.isArray(fn?.mock?.calls)) {
    return fn.mock.calls.map((call) => call.args ?? call.arguments ?? call);
  }
  return [];
}

function assertPass(pass, negated, message) {
  assert.equal(negated ? !pass : pass, true, message);
}

function makeMatchers(actual, negated = false) {
  const api = {
    get not() {
      return makeMatchers(actual, !negated);
    },
    get resolves() {
      return makeAsyncMatchers(actual, negated, false);
    },
    get rejects() {
      return makeAsyncMatchers(actual, negated, true);
    },
    toBe(expected) {
      assertPass(Object.is(actual, expected), negated, `Expected ${actual} ${negated ? 'not ' : ''}to be ${expected}`);
    },
    toEqual(expected) {
      assertPass(matches(actual, expected), negated, `Expected values ${negated ? 'not ' : ''}to be deeply equal`);
    },
    toStrictEqual(expected) {
      assertPass(isDeepStrictEqual(actual, expected), negated, `Expected values ${negated ? 'not ' : ''}to be strictly deeply equal`);
    },
    toContain(expected) {
      assertPass(actual?.includes?.(expected), negated, `Expected value ${negated ? 'not ' : ''}to contain ${expected}`);
    },
    toHaveLength(expected) {
      assertPass(actual?.length === expected, negated, `Expected length ${negated ? 'not ' : ''}to be ${expected}`);
    },
    toBeDefined() {
      assertPass(actual !== undefined, negated, `Expected value ${negated ? 'not ' : ''}to be defined`);
    },
    toBeUndefined() {
      assertPass(actual === undefined, negated, `Expected value ${negated ? 'not ' : ''}to be undefined`);
    },
    toBeNull() {
      assertPass(actual === null, negated, `Expected value ${negated ? 'not ' : ''}to be null`);
    },
    toBeTruthy() {
      assertPass(Boolean(actual), negated, `Expected value ${negated ? 'not ' : ''}to be truthy`);
    },
    toBeFalsy() {
      assertPass(!actual, negated, `Expected value ${negated ? 'not ' : ''}to be falsy`);
    },
    toBeTypeOf(expected) {
      assertPass(typeof actual === expected, negated, `Expected type ${negated ? 'not ' : ''}to be ${expected}`);
    },
    toBeArray() {
      assertPass(Array.isArray(actual), negated, `Expected value ${negated ? 'not ' : ''}to be an array`);
    },
    toBeInstanceOf(expected) {
      assertPass(actual instanceof expected, negated, `Expected value ${negated ? 'not ' : ''}to be instance of ${expected?.name}`);
    },
    toHaveProperty(key, expectedValue) {
      const path = Array.isArray(key) ? key : String(key).split('.');
      let current = actual;
      let exists = current != null;
      for (const part of path) {
        if (!exists || !(part in Object(current))) { exists = false; break; }
        current = current[part];
      }
      let pass = exists;
      if (pass && arguments.length > 1) pass = matches(current, expectedValue);
      assertPass(pass, negated, `Expected value ${negated ? 'not ' : ''}to have property ${path.join('.')}`);
    },
    toMatch(expected) {
      const pass = expected instanceof RegExp
        ? expected.test(String(actual))
        : String(actual).includes(String(expected));
      assertPass(pass, negated, `Expected value ${negated ? 'not ' : ''}to match ${expected}`);
    },
    toMatchObject(expected) {
      const pass = expected && typeof expected === 'object'
        && actual && typeof actual === 'object'
        && Object.entries(expected).every(([key, value]) => matches(actual[key], value));
      assertPass(pass, negated, `Expected object ${negated ? 'not ' : ''}to match subset`);
    },
    toThrow(expected) {
      assert.equal(typeof actual, 'function', true, 'toThrow expects a function');
      let thrown = null;
      try {
        actual();
      } catch (err) {
        thrown = err;
      }
      let pass = Boolean(thrown);
      if (pass && expected instanceof RegExp) pass = expected.test(String(thrown?.message ?? thrown));
      if (pass && typeof expected === 'string') pass = String(thrown?.message ?? thrown).includes(expected);
      if (pass && typeof expected === 'function') pass = thrown instanceof expected;
      assertPass(pass, negated, `Expected function ${negated ? 'not ' : ''}to throw`);
    },
    toBeGreaterThan(expected) {
      assertPass(actual > expected, negated, `Expected ${actual} ${negated ? 'not ' : ''}to be greater than ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assertPass(actual >= expected, negated, `Expected ${actual} ${negated ? 'not ' : ''}to be greater than or equal to ${expected}`);
    },
    toBeLessThan(expected) {
      assertPass(actual < expected, negated, `Expected ${actual} ${negated ? 'not ' : ''}to be less than ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assertPass(actual <= expected, negated, `Expected ${actual} ${negated ? 'not ' : ''}to be less than or equal to ${expected}`);
    },
    toHaveBeenCalled() {
      assertPass(getCalls(actual).length > 0, negated, `Expected mock ${negated ? 'not ' : ''}to have been called`);
    },
    toHaveBeenCalledTimes(expected) {
      assertPass(getCalls(actual).length === expected, negated, `Expected mock ${negated ? 'not ' : ''}to have been called ${expected} times`);
    },
    toHaveBeenCalledWith(...expectedArgs) {
      const pass = getCalls(actual).some((args) => matches(args, expectedArgs));
      assertPass(pass, negated, `Expected mock ${negated ? 'not ' : ''}to have been called with the expected args`);
    },
  };
  return api;
}

function makeAsyncMatchers(value, negated, expectRejection) {
  const resolveActual = async () => {
    try {
      const resolved = await value;
      if (expectRejection) throw new assert.AssertionError({ message: 'Expected promise to reject' });
      return resolved;
    } catch (error) {
      if (!expectRejection) throw error;
      return error;
    }
  };
  return {
    async toBe(expected) { makeMatchers(await resolveActual(), negated).toBe(expected); },
    async toEqual(expected) { makeMatchers(await resolveActual(), negated).toEqual(expected); },
    async toMatch(expected) { makeMatchers(await resolveActual(), negated).toMatch(expected); },
    async toThrow(expected) {
      const error = await resolveActual();
      makeMatchers(() => { throw error; }, negated).toThrow(expected);
    },
  };
}

export function expect(actual) {
  return makeMatchers(actual);
}

expect.anything = () => asymmetric('anything');
expect.any = (value) => asymmetric('any', value);
expect.stringContaining = (value) => asymmetric('stringContaining', value);
expect.stringMatching = (value) => asymmetric('stringMatching', value);
expect.arrayContaining = (value) => asymmetric('arrayContaining', value);
expect.objectContaining = (value) => asymmetric('objectContaining', value);

// Expose Node's native mock tracker for specs that need timers/method mocking
// without relying on the legacy function helper above.
export const nodeTestMock = nodeMock;
