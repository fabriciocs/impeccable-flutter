import {
  after,
  afterEach,
  before,
  beforeEach,
  describe as nodeDescribe,
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
  function mockFn(...args) {
    mockFn.mock.calls.push({ args });
    return implementation.apply(this, args);
  }
  mockFn.mock = {
    calls: [],
    clear() {
      mockFn.mock.calls.length = 0;
    },
  };
  mockFn.mockClear = mockFn.mock.clear;
  return mockFn;
}

function asymmetric(type, value) {
  return { [ASYMMETRIC]: true, type, value };
}

function isAsymmetric(value) {
  return Boolean(value && value[ASYMMETRIC]);
}

function matches(actual, expected) {
  if (isAsymmetric(expected)) {
    if (expected.type === 'stringContaining') {
      return typeof actual === 'string' && actual.includes(expected.value);
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
    toBe(expected) {
      assertPass(Object.is(actual, expected), negated, `Expected ${actual} ${negated ? 'not ' : ''}to be ${expected}`);
    },
    toEqual(expected) {
      assertPass(matches(actual, expected), negated, `Expected values ${negated ? 'not ' : ''}to be deeply equal`);
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
    toBeTypeOf(expected) {
      assertPass(typeof actual === expected, negated, `Expected type ${negated ? 'not ' : ''}to be ${expected}`);
    },
    toBeArray() {
      assertPass(Array.isArray(actual), negated, `Expected value ${negated ? 'not ' : ''}to be an array`);
    },
    toHaveProperty(key) {
      assertPass(actual != null && Object.hasOwn(actual, key), negated, `Expected value ${negated ? 'not ' : ''}to have property ${key}`);
    },
    toMatch(expected) {
      const pass = expected instanceof RegExp
        ? expected.test(String(actual))
        : String(actual).includes(String(expected));
      assertPass(pass, negated, `Expected value ${negated ? 'not ' : ''}to match ${expected}`);
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
      assertPass(pass, negated, `Expected function ${negated ? 'not ' : ''}to throw`);
    },
    toBeGreaterThan(expected) {
      assertPass(actual > expected, negated, `Expected ${actual} ${negated ? 'not ' : ''}to be greater than ${expected}`);
    },
    toBeGreaterThanOrEqual(expected) {
      assertPass(actual >= expected, negated, `Expected ${actual} ${negated ? 'not ' : ''}to be greater than or equal to ${expected}`);
    },
    toHaveBeenCalledWith(...expectedArgs) {
      const pass = getCalls(actual).some((args) => matches(args, expectedArgs));
      assertPass(pass, negated, `Expected mock ${negated ? 'not ' : ''}to have been called with the expected args`);
    },
  };
  return api;
}

export function expect(actual) {
  return makeMatchers(actual);
}

expect.stringContaining = (value) => asymmetric('stringContaining', value);
expect.objectContaining = (value) => asymmetric('objectContaining', value);
