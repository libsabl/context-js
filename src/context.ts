// Copyright 2022 the Sable authors. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Canceler, CancelFunc } from './canceler';

/** A simple union type of any `T` with `undefined` and `null` */
export type Maybe<T> = T | undefined | null;

/** A method that returns a {@link Maybe<T>} */
export type Getter<T> = () => Maybe<T>;

/** A method that accepts an item and returns a new child {@link Context} */
export type Setter<T> = (item: T) => Context;

/** A function that accepts a {@link Context} and returns a {@link Maybe<T>} */
export type ContextGetter<T> = (ctx: Context) => Maybe<T>;

/** A function that accepts a {@link Context} and an item and returns an new child {@link Context} */
export type ContextSetter<T> = (ctx: Context, item: T) => Context;

/** A simple interface for immutable context trees */
export class Context {
  readonly #parent: Context | null;
  readonly #name: string | null;

  constructor(parent?: Context | null, name?: string) {
    this.#parent = parent || null;
    this.#name = name || null;
  }

  /** Retrieve a context value by its key. Returns null if the value is not defined. */
  value(key: any): any | undefined | null {
    if (this.#parent == null) return undefined;
    return this.#parent.value(key);
  }

  /** Get the canceler for the context. May return null if the context is not cancelable. */
  get canceler(): Canceler | null {
    if (this.#parent == null) return null;
    return this.#parent.canceler;
  }

  /** Check whether the context is canceled. Returns false if parent if canceler is null. */
  get canceled(): boolean {
    if (this.#parent == null) return false;
    return this.#parent.canceled;
  }

  toString(): string {
    return 'context.' + (this.#name || 'Base');
  }

  /** Return a new child context with the provided key and value */
  withValue(key: any, value: any | null): Context {
    return withValue(this, key, value);
  }

  /** Return a new cancelable child context along with the {@link CancelFunc} to cancel it */
  withCancel(): [CancelableContext, CancelFunc] {
    return withCancel(this);
  }

  /** Register a new context value getter and setter */
  static use<T>(
    prop: string,
    getter: ContextGetter<T>,
    setter: ContextSetter<T>
  ) {
    (Context.prototype as any)['get' + prop] = function () {
      return getter(this);
    };

    (Context.prototype as any)['with' + prop] = function (item: T) {
      return setter(this, item);
    };
  }

  /* ==================================================================
    Static contexts / factories
  ================================================================== */

  static readonly #background = new Context(null, 'Background');

  /** The root background context */
  static get background(): Context {
    return this.#background;
  }

  /** Create a new empty root context */
  static empty(name?: string): Context {
    return new Context(null, name);
  }

  /** Create a new root context with a key and value */
  static value(key: any, value: any | null) {
    return new ValueContext(key, value, null, 'Value');
  }

  /** Create a new cancelable root context along with the {@link CancelFunc} to cancel it */
  static cancel(): [CancelableContext, CancelFunc] {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return withCancel(null!);
  }
}

/** ValueContext is an internal implementation, intentionally not exported */
class ValueContext extends Context {
  readonly #key: any;
  readonly #value: any | null;

  constructor(
    key: any,
    value: any | null,
    parent?: Context | null,
    name?: string
  ) {
    super(parent, name);
    if (key == null) {
      throw new Error('key cannot be null');
    }
    this.#key = key;
    this.#value = value;
  }

  override value(key: any) {
    if (key === this.#key) return this.#value;
    return super.value(key);
  }
}

/** Return a new child context with the provided key and value */
export function withValue(ctx: Context, key: any, value: any | null): Context {
  return new ValueContext(key, value, ctx, 'Value');
}

/** CancelContext is an internal implementation, intentionally not exported */
class CancelContext extends Context {
  readonly #canceler: Canceler;

  constructor(canceler: Canceler, parent?: Context | null) {
    super(parent, 'Cancel');
    this.#canceler = canceler;
  }

  override get canceler(): Canceler {
    return this.#canceler;
  }

  override get canceled(): boolean {
    return this.#canceler.canceled;
  }
}

export interface CancelableContext extends CancelContext {
  get canceler(): Canceler;
}

/** Return a new child context cancelable context.
 * Any cancelation on the parent will be cascaded to the child */
export function withCancel(ctx: Context): [CancelableContext, CancelFunc] {
  const [clr, cfn] = Canceler.create();

  if (ctx != null) {
    const parentClr = ctx.canceler;
    if (parentClr != null) {
      parentClr.onCancel(cfn);
    }
  }

  return [new CancelContext(clr, ctx), cfn];
}
