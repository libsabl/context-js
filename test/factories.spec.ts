// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context, IContext, withValue } from '$';
import { CustomRootContext } from '$test/fixtures/custom-context';

describe('background', () => {
  it('returns a background context', () => {
    const bg = Context.background;
    expect(bg).not.toBeNull();
    expect(typeof bg.value).toEqual('function');
    expect('canceler' in bg).toEqual(true);
    expect(bg.canceler).toEqual(null);
    expect(bg.canceled).toBe(false);
    expect(bg.toString()).toEqual('context.Background');
  });

  it('returns the same instance', () => {
    const bg = Context.background;
    for (let i = 0; i < 10; i++) {
      expect(Context.background).toBe(bg);
    }
  });
});

describe('as', () => {
  it('returns existing context', function () {
    const source = Context.empty('hello');
    const ctx = Context.as(source);
    expect(ctx).toBe(source);
  });

  it('wraps a context interface', function () {
    const source = new CustomRootContext('a', 1);
    const ctx = Context.as(source);
    expect(ctx).not.toBe(source);
    expect(ctx).toBeInstanceOf(Context);
  });
});

describe('empty', () => {
  it('creates a new context', () => {
    const ctx = Context.empty();
    expect(ctx.toString()).toBe('context.Base');
    expect(Object.prototype.toString.apply(ctx)).toBe('[object context.Base]');
    expect(ctx.canceler).toBeNull();
  });

  it('uses provided name', () => {
    const ctx = Context.empty('Empty');
    expect(ctx.toString()).toBe('context.Empty');
    expect(Object.prototype.toString.apply(ctx)).toBe('[object context.Empty]');
  });
});

describe('value', () => {
  it('creates a root value context - string key', () => {
    const ctx = Context.value('a', 2);
    expect(ctx.toString()).toBe('context.Value');
    expect(ctx.canceler).toBeNull();
    expect(ctx.value('a')).toBe(2);
  });

  it('creates a root value context - symbol key', () => {
    const k = Symbol('a');
    const ctx = Context.value(k, 2);
    expect(ctx.toString()).toBe('context.Value');
    expect(ctx.canceler).toBeNull();
    expect(ctx.value(k)).toBe(2);
  });

  it('creates a root value context - setter', () => {
    const k = Symbol('number');
    const setK = function (ctx: IContext, n: number) {
      return withValue(ctx, k, n);
    };
    const ctx = Context.value(setK, 2);
    expect(ctx.toString()).toBe('context.Value');
    expect(ctx.canceler).toBeNull();
    expect(ctx.value(k)).toBe(2);
  });

  it('rejects null key', () => {
    expect(() => Context.value(<string>(<unknown>null), 2)).toThrow(
      /key cannot be null/
    );
  });

  it('rejects invalid key type', () => {
    expect(() => Context.value(<string>(<unknown>2), 2)).toThrow(
      'Invalid context key or setter'
    );
  });

  it('accepts null value', () => {
    const ctx = Context.value('a', null);
    expect(ctx.value('a')).toBeNull();
    expect(ctx.value('b')).toBeUndefined();
  });
});
