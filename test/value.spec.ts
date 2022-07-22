// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Context, IContext, withValue } from '$';

describe('withValue', () => {
  it('creates a child context from string key', () => {
    const root = Context.background;
    const child = root.withValue('a', 2);
    expect(child.value('a')).toBe(2);
  });

  it('creates a child context from symbol key', () => {
    const sym = Symbol('x');
    const root = Context.background;
    const child = root.withValue(sym, 2);
    expect(child.value(sym)).toBe(2);
  });

  it('creates a child context from setter', () => {
    const k = Symbol('number');
    const setK = function (ctx: IContext, n: number) {
      return withValue(ctx, k, n);
    };

    const root = Context.background;
    const child = root.withValue(setK, 2);
    expect(child.value(k)).toBe(2);
  });

  it('rejects null key', () => {
    const ctx = Context.background;
    expect(() => ctx.withValue(null!, 1)).toThrow('key cannot be null');
  });

  it('rejects invalid key type', () => {
    const ctx = Context.background;
    expect(() => ctx.withValue(<string>(<unknown>2), 1)).toThrow(
      'Invalid context key or setter'
    );
  });
});

describe('value', () => {
  it('returns defined value', () => {
    const ctx = Context.value('a', 2);
    expect(ctx.value('a')).toBe(2);
  });

  it('returns ancestor value', () => {
    const ctx1 = Context.value('one', 1);
    const ctx2 = ctx1.withValue('two', 2);
    const [ctxCncl] = ctx2.withCancel();
    const ctx3 = ctxCncl.withValue('three', 3);

    for (const ctx of [ctx3, ctxCncl]) {
      expect(ctx.value('two')).toBe(2);
    }

    for (const ctx of [ctx3, ctxCncl, ctx2]) {
      expect(ctx.value('one')).toBe(1);
    }

    for (const ctx of [ctx3, ctxCncl, ctx2, ctx1]) {
      expect(ctx.value('foo')).toBeUndefined();
    }
  });

  it('returns nearest matching value', () => {
    const ctx1 = Context.value('x', 1);
    const ctx2 = ctx1.withValue('y', 3);
    const ctx3 = ctx2.withValue('x', 11);

    // Ancestor contexts are not affected
    for (const ctx of [ctx1, ctx2]) {
      expect(ctx.value('x')).toBe(1);
    }

    // New 'x' hides ancestor 'x'
    expect(ctx3.value('x')).toBe(11);

    for (const ctx of [ctx2, ctx3]) {
      expect(ctx.value('y')).toBe(3);
    }
  });
});
