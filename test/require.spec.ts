// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context, IContext } from '$';

const ctxKeyString = Symbol('string');
const ctxKeyNumber = Symbol('number');
const ctxKeyBool = Symbol('boolean');
const ctxKeyFunc = Symbol('func');
const ctxKeyObj = Symbol('object');
const ctxKeySymbol = Symbol('symbol');

const getString = (ctx: IContext) => ctx.value(ctxKeyString) as string;
const getNumber = (ctx: IContext) => ctx.value(ctxKeyNumber) as number;
const getBool = (ctx: IContext) => ctx.value(ctxKeyBool) as boolean;
const getObject = (ctx: IContext) => ctx.value(ctxKeyObj) as object;
const getSymbol = (ctx: IContext) => ctx.value(ctxKeySymbol) as symbol;

// eslint-disable-next-line @typescript-eslint/ban-types
const getFunc = (ctx: IContext) => ctx.value(ctxKeyFunc) as Function;

class ContextItem {
  constructor(readonly key: symbol, readonly val: unknown) {}
}

type entry = [symbol, unknown];

class ContextMap {
  readonly #items: ContextItem[];
  constructor(...items: entry[]) {
    this.#items = items.map(([k, v]) => new ContextItem(k, v));
  }

  build() {
    let ctx = Context.background;
    for (const i of this.#items) {
      ctx = ctx.withValue(i.key, i.val);
    }
    return ctx;
  }
}

function makectx(...items: [symbol, unknown][]) {
  return new ContextMap(...items).build();
}

function* skipEach(items: entry[]) {
  const l = items.length;
  for (let i = 0; i < l; i++) {
    const truncated = items.concat();
    truncated.splice(i, 1);
    yield makectx(...truncated);
  }
}

function* nullEach(items: entry[]) {
  const l = items.length;
  for (let i = 0; i < l; i++) {
    const copy = items.concat();
    copy[i][1] = null;
    yield makectx(...copy);
  }
}

describe('require', () => {
  const ctx = Context.background;
  // eslint-disable-next-line @typescript-eslint/ban-types
  const require: Function = ctx.require.bind(ctx);

  it('rejects 0 getters', () => {
    expect(() => require()).toThrow('At least one getter required');
  });

  it('rejects more than 6 getters', () => {
    expect(() =>
      require(getBool, getString, getNumber, getSymbol, getObject, getFunc, getString)
    ).toThrow('Only six getters supported');
  });
});

describe('require-1', function () {
  it('returns a single unwrapped value', () => {
    const ctx = Context.value(ctxKeyNumber, 1);
    const n = ctx.require(getNumber);
    expect(n).toBe(1);
  });

  it('throws if not defined', () => {
    const ctx = Context.background;
    expect(() => ctx.require(getNumber)).toThrow('item not defined');
  });

  it('throws if null', () => {
    const ctx = Context.value(ctxKeyNumber, null);
    expect(() => ctx.require(getNumber)).toThrow('item is null');
  });

  it('uses custom label', () => {
    const getNum = (ctx: IContext) => getNumber(ctx);
    getNum.label = 'special number';
    const ctx = Context.background;
    expect(() => ctx.require(getNum)).toThrow('special number not defined');
  });
});

describe('require-2', () => {
  const entries: entry[] = [
    [ctxKeyNumber, 11],
    [ctxKeyBool, true],
  ];

  it('returns two items', () => {
    const ctx = makectx(...entries);
    const [num, bool] = ctx.require(getNumber, getBool);
    expect(num).toBe(11);
    expect(bool).toBe(true);
  });

  it('throws if either is undefined', () => {
    for (const ctx of skipEach(entries)) {
      expect(() => ctx.require(getNumber, getBool)).toThrow('item not defined');
    }
  });

  it('throws if either is null', () => {
    for (const ctx of nullEach(entries)) {
      expect(() => ctx.require(getNumber, getBool)).toThrow('item is null');
    }
  });
});

describe('require-3', () => {
  const entries: entry[] = [
    [ctxKeyNumber, 11],
    [ctxKeyBool, true],
    [ctxKeyString, 'hello'],
  ];

  it('returns three items', () => {
    const ctx = makectx(...entries);
    const [num, bool, str] = ctx.require(getNumber, getBool, getString);
    expect(num).toBe(11);
    expect(bool).toBe(true);
    expect(str).toBe('hello');
  });

  it('throws if any are undefined', () => {
    for (const ctx of skipEach(entries)) {
      expect(() => ctx.require(getNumber, getBool, getString)).toThrow(
        'item not defined'
      );
    }
  });

  it('throws if any are null', () => {
    for (const ctx of nullEach(entries)) {
      expect(() => ctx.require(getNumber, getBool, getString)).toThrow(
        'item is null'
      );
    }
  });
});

describe('require-4', () => {
  const entries: entry[] = [
    [ctxKeyNumber, 11],
    [ctxKeyBool, true],
    [ctxKeyString, 'hello'],
    [ctxKeyFunc, Math.max],
  ];

  it('returns four items', () => {
    const ctx = makectx(...entries);
    const [num, bool, str, fn] = ctx.require(
      getNumber,
      getBool,
      getString,
      getFunc
    );
    expect(num).toBe(11);
    expect(bool).toBe(true);
    expect(str).toBe('hello');
    expect(fn).toBe(Math.max);
  });

  it('throws if any are undefined', () => {
    for (const ctx of skipEach(entries)) {
      expect(() => ctx.require(getNumber, getBool, getString, getFunc)).toThrow(
        'item not defined'
      );
    }
  });

  it('throws if any are null', () => {
    for (const ctx of nullEach(entries)) {
      expect(() => ctx.require(getNumber, getBool, getString, getFunc)).toThrow(
        'item is null'
      );
    }
  });
});

describe('require-5', () => {
  const entries: entry[] = [
    [ctxKeyNumber, 11],
    [ctxKeyBool, true],
    [ctxKeyString, 'hello'],
    [ctxKeyFunc, Math.max],
    [ctxKeySymbol, Symbol.iterator],
  ];

  it('returns five items', () => {
    const ctx = makectx(...entries);
    const [num, bool, str, fn, sym] = ctx.require(
      getNumber,
      getBool,
      getString,
      getFunc,
      getSymbol
    );
    expect(num).toBe(11);
    expect(bool).toBe(true);
    expect(str).toBe('hello');
    expect(fn).toBe(Math.max);
    expect(sym).toBe(Symbol.iterator);
  });

  it('throws if any are undefined', () => {
    for (const ctx of skipEach(entries)) {
      expect(() =>
        ctx.require(getNumber, getBool, getString, getFunc, getSymbol)
      ).toThrow('item not defined');
    }
  });

  it('throws if any are null', () => {
    for (const ctx of nullEach(entries)) {
      expect(() =>
        ctx.require(getNumber, getBool, getString, getFunc, getSymbol)
      ).toThrow('item is null');
    }
  });
});

describe('require-6', () => {
  const d = new Date();
  const entries: entry[] = [
    [ctxKeyNumber, 11],
    [ctxKeyBool, true],
    [ctxKeyString, 'hello'],
    [ctxKeyFunc, Math.max],
    [ctxKeySymbol, Symbol.iterator],
    [ctxKeyObj, d],
  ];

  it('returns six items', () => {
    const ctx = makectx(...entries);
    const [num, bool, str, fn, sym, obj] = ctx.require(
      getNumber,
      getBool,
      getString,
      getFunc,
      getSymbol,
      getObject
    );
    expect(num).toBe(11);
    expect(bool).toBe(true);
    expect(str).toBe('hello');
    expect(fn).toBe(Math.max);
    expect(sym).toBe(Symbol.iterator);
    expect(obj).toBe(d);
  });

  it('throws if any are undefined', () => {
    for (const ctx of skipEach(entries)) {
      expect(() =>
        ctx.require(
          getNumber,
          getBool,
          getString,
          getFunc,
          getSymbol,
          getObject
        )
      ).toThrow('item not defined');
    }
  });

  it('throws if any are null', () => {
    for (const ctx of nullEach(entries)) {
      expect(() =>
        ctx.require(
          getNumber,
          getBool,
          getString,
          getFunc,
          getSymbol,
          getObject
        )
      ).toThrow('item is null');
    }
  });
});
