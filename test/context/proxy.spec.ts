// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context, withContext, getContext } from '$';

describe('context proxy', function () {
  it('sets and gets context', function () {
    const source = global.performance;
    const ctx = Context.background.withValue('a', 1);
    const proxy = withContext(source, ctx);

    // Ensure proxy behaves like source
    expect(proxy).toBeInstanceOf(source.constructor);
    expect(proxy.toJSON().nodeTiming.name).toEqual(
      source.toJSON().nodeTiming.name
    );

    // Can retrieve context
    const ctx2 = getContext(proxy);
    expect(ctx2).toBe(ctx);
    expect(ctx.value('a')).toBe(1);
  });

  describe('getContext', function () {
    it('throws error if no context present', function () {
      expect(() => getContext(new Date())).toThrow(
        'Context not assigned to source'
      );
    });

    it('returns null if allowNull is true', function () {
      let ctx = null;
      expect(() => (ctx = getContext(new Date(), true))).not.toThrow();
      expect(ctx).toBe(undefined);
    });
  });
});
