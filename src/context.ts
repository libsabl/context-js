// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Canceler, CancelFunc } from './canceler';

/** A valid context value key: either a symbol or a string */
export type ContextKey = symbol | string;

/** A simple union type of any `T` with `undefined` and `null` */
export type Maybe<T> = T | undefined | null;

/** A function that accepts a {@link IContext} and returns a {@link Maybe<T>} */
export type ContextGetter<T> = (ctx: IContext) => Maybe<T>;

/** A function that accepts a {@link IContext} and an item and returns an new child {@link Context} */
export type ContextSetter<T> = (ctx: IContext, item: T) => Context;

/** A simple interface for immutable context trees */
export interface IContext {
  /** Retrieve a context value by its key. Returns null if the value is not defined. */
  value(key: ContextKey): unknown | undefined | null;

  /** Get the canceler for the context. May return null if the context is not cancelable. */
  get canceler(): Canceler | null;
}

/** Base implementation of {@link IContext} */
export class Context {
  readonly #parent: IContext | null;
  readonly #name: string | null;

  constructor(parent?: IContext | null, name?: string) {
    this.#parent = parent || null;
    this.#name = name || null;
  }

  /** Retrieve a context value by its key. Returns null if the value is not defined. */
  value(key: ContextKey): unknown | undefined | null {
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
    return this.canceler?.canceled || false;
  }

  toString(): string {
    return this[Symbol.toStringTag];
  }

  get [Symbol.toStringTag](): string {
    return 'context.' + (this.#name || 'Base');
  }

  /** Return a new child context with a value set by the provided literal key */
  withValue(key: ContextKey, value: unknown | null): Context;

  /** Return a new child context with a value set by the provided setter */
  withValue<T>(setter: ContextSetter<T>, value: T): Context;

  withValue<T>(
    arg1: ContextKey | ContextSetter<T>,
    value: T | unknown | null
  ): Context {
    if (arg1 == null) {
      throw new Error('key cannot be null');
    }
    if (typeof arg1 === 'string' || typeof arg1 === 'symbol') {
      return withValue(this, arg1, value);
    }
    if (typeof arg1 === 'function') {
      return arg1(this, <T>value);
    }
    throw new Error('Invalid context key or setter');
  }

  #require<T>(getter: ContextGetter<T> & { label?: string }): T {
    const item = getter(this);
    if (item == null) {
      throw new Error(
        `${getter.label || 'item'} ${item === null ? 'is null' : 'not defined'}`
      );
    }
    return item;
  }

  /** Require a context value by its getter function,
   * and throw an error if it is null or undefined */
  require<T1>(getter: ContextGetter<T1>): T1;

  /** Require two context values by their getter functions,
   * and throw an error if either are null or undefined */
  require<T1, T2>(
    getter1: ContextGetter<T1>,
    getter2: ContextGetter<T2>
  ): [T1, T2];

  /** Require three context values by their getter functions,
   * and throw an error if any are null or undefined */
  require<T1, T2, T3>(
    getter1: ContextGetter<T1>,
    getter2: ContextGetter<T2>,
    getter3: ContextGetter<T3>
  ): [T1, T2, T3];

  /** Require four context values by their getter functions,
   * and throw an error if any are null or undefined */
  require<T1, T2, T3, T4>(
    getter1: ContextGetter<T1>,
    getter2: ContextGetter<T2>,
    getter3: ContextGetter<T3>,
    getter4: ContextGetter<T4>
  ): [T1, T2, T3, T4];

  /** Require five context values by their getter functions,
   * and throw an error if any are null or undefined */
  require<T1, T2, T3, T4, T5>(
    getter1: ContextGetter<T1>,
    getter2: ContextGetter<T2>,
    getter3: ContextGetter<T3>,
    getter4: ContextGetter<T4>,
    getter5: ContextGetter<T5>
  ): [T1, T2, T3, T4, T5];

  /** Require six context values by their getter functions,
   * and throw an error if any are null or undefined */
  require<T1, T2, T3, T4, T5, T6>(
    getter1: ContextGetter<T1>,
    getter2: ContextGetter<T2>,
    getter3: ContextGetter<T3>,
    getter4: ContextGetter<T4>,
    getter5: ContextGetter<T5>,
    getter6: ContextGetter<T6>
  ): [T1, T2, T3, T4, T5, T6];

  require<T1, T2, T3, T4, T5, T6>(
    getter1: ContextGetter<T1>,
    getter2?: ContextGetter<T2>,
    getter3?: ContextGetter<T3>,
    getter4?: ContextGetter<T4>,
    getter5?: ContextGetter<T5>,
    getter6?: ContextGetter<T6>
  ):
    | T1
    | [T1, T2]
    | [T1, T2, T3]
    | [T1, T2, T3, T4]
    | [T1, T2, T3, T4, T5]
    | [T1, T2, T3, T4, T5, T6] {
    switch (arguments.length) {
      case 0:
        throw new Error('At least one getter required');
      case 1:
        return this.#require(getter1);
      case 2:
        return [this.#require(getter1), this.#require(getter2!)];
      case 3:
        return [
          this.#require(getter1),
          this.#require(getter2!),
          this.#require(getter3!),
        ];
      case 4:
        return [
          this.#require(getter1),
          this.#require(getter2!),
          this.#require(getter3!),
          this.#require(getter4!),
        ];
      case 5:
        return [
          this.#require(getter1),
          this.#require(getter2!),
          this.#require(getter3!),
          this.#require(getter4!),
          this.#require(getter5!),
        ];
      case 6:
        return [
          this.#require(getter1),
          this.#require(getter2!),
          this.#require(getter3!),
          this.#require(getter4!),
          this.#require(getter5!),
          this.#require(getter6!),
        ];
      default:
        throw new Error('Only six getters supported');
    }
  }

  /** Return a new cancelable child context along with the {@link CancelFunc} to cancel it */
  withCancel(): [CancelableContext, CancelFunc] {
    return withCancel(this);
  }

  /* ==================================================================
    Static contexts / factories
  ================================================================== */

  static readonly #background = new Context(null, 'Background');

  /** The root background context */
  static get background(): Context {
    return this.#background;
  }

  /**
   * Returns a concrete {@link Context} from the
   * source interface. If `source` is already a
   * Context instance then it is returned.
   */
  static as(source: IContext): Context {
    if (source instanceof Context) return source;
    return new Context(source);
  }

  /** Create a new empty root context */
  static empty(name?: string): Context {
    return new Context(null, name);
  }

  /** Create a new root context with a key and value */
  static value(key: ContextKey, value: unknown | null): Context;

  /** Create a new root context using the provided setter and value */
  static value<T>(setter: ContextSetter<T>, value: T): Context;

  static value<T>(
    arg1: ContextKey | ContextSetter<T>,
    value: T | unknown | null
  ): Context {
    if (arg1 == null) {
      throw new Error('key cannot be null');
    }
    if (typeof arg1 === 'string' || typeof arg1 === 'symbol') {
      return new ValueContext(arg1, value, null, 'Value');
    }
    if (typeof arg1 === 'function') {
      return arg1(this.#background, <T>value);
    }
    throw new Error('Invalid context key or setter');
  }

  /** Create a new cancelable root context along with the {@link CancelFunc} to cancel it */
  static cancel(): [CancelableContext, CancelFunc] {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return withCancel(null!);
  }
}

/** ValueContext is an internal implementation, intentionally not exported */
class ValueContext extends Context {
  readonly #key: ContextKey;
  readonly #value: unknown | null;

  constructor(
    key: ContextKey,
    value: unknown | null,
    parent?: IContext | null,
    name?: string
  ) {
    super(parent, name);
    this.#key = key;
    this.#value = value;
  }

  override value(key: ContextKey) {
    if (key === this.#key) return this.#value;
    return super.value(key);
  }
}

/** Return a new child context with the provided key and value */
export function withValue(
  ctx: IContext,
  key: ContextKey,
  value: unknown | null
): Context {
  return new ValueContext(key, value, ctx, 'Value');
}

/** CancelContext is an internal implementation, intentionally not exported */
class CancelContext extends Context {
  readonly #canceler: Canceler;

  constructor(canceler: Canceler, parent?: IContext | null) {
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

/** A {@link Context} with a guaranteed non-null canceler */
export interface CancelableContext extends Context {
  get canceler(): Canceler;
}

/**
 * Return a new child context cancelable context.
 * Any cancelation on the parent will be cascaded to the child.
 *
 * Caller must ensure the returned CancelFunc is called as soon as work is
 * complete, including if work completes successfully.
 */
export function withCancel(ctx: IContext): [CancelableContext, CancelFunc] {
  if (ctx != null && ctx.canceler != null && ctx.canceler.canceled) {
    // Parent is already canceled
    return [<CancelableContext>ctx, makeNoOp()];
  }

  const [clr, cfn] = Canceler.create();

  let cancelFunc = cfn;
  if (ctx != null) {
    const parentClr = ctx.canceler;
    if (parentClr != null) {
      // Ensure parent cancellation is cascaded
      parentClr.onCancel(cfn);

      // Also clean up child call back if it is canceled directly
      cancelFunc = () => {
        parentClr.off(cfn);
        cfn();
      };
    }
  }

  // Return the wrapped cancel func which also removes
  // the inner cancel callback from its parent
  return [new CancelContext(clr, ctx), cancelFunc];
}

const ctxKeyDeadline = Symbol('Deadline');

/** Get the existing deadline, if any, from the context */
function getDeadline(ctx: IContext): Date | undefined {
  return <Date | undefined>ctx.value(ctxKeyDeadline);
}

function makeNoOp(): CancelFunc {
  return () => {
    /* no op */
  };
}

/**
 * Return a new child context cancelable context, and ensure
 * that the child context is canceled within `ms` milliseconds.
 * Any earlier cancelation on the parent will be cascaded to the child.
 *
 * Caller must ensure the returned CancelFunc is called as soon as work is
 * complete, including if work completes successfully.
 */
export function withTimeout(
  ctx: IContext,
  ms: number
): [CancelableContext, CancelFunc] {
  const deadline = new Date(+new Date() + ms);
  return withDeadline(ctx, deadline);
}

/**
 * Return a new child context cancelable context, and ensure
 * that the child context is canceled no later than `deadline`.
 * Any earlier cancelation on the parent will be cascaded to the child.
 *
 * Caller must ensure the returned CancelFunc is called as soon as work is
 * complete, including if work completes successfully.
 */
export function withDeadline(
  ctx: IContext,
  deadline: Date
): [CancelableContext, CancelFunc] {
  if (ctx != null && ctx.canceler != null && ctx.canceler.canceled) {
    // Parent is already canceled
    return [<CancelableContext>ctx, makeNoOp()];
  }

  const deadlineMs = +deadline;
  const existing = getDeadline(ctx);
  if (existing != null && +existing < deadlineMs) {
    // Existing deadline is already earlier.
    return withCancel(ctx);
  }

  const [clr, cfn] = Canceler.create();
  const cancelCtx = new CancelContext(
    clr,
    withValue(ctx, ctxKeyDeadline, deadline)
  );

  const nowMs = +new Date();
  if (deadlineMs < nowMs) {
    // Already passed deadline
    cfn();
    return [cancelCtx, cfn];
  }

  const timeout: { token?: NodeJS.Timeout } = {};

  const clearAndCancel: CancelFunc = () => {
    clearTimeout(timeout.token);
    cfn();
  };

  let cancelFunc: CancelFunc;
  if (ctx != null && ctx.canceler != null) {
    const parentClr = ctx.canceler;
    // Ensure parent cancellation is cascaded
    parentClr.onCancel(clearAndCancel);

    // Also clean up child call back if it is canceled directly
    cancelFunc = () => {
      parentClr.off(clearAndCancel);
      clearTimeout(timeout.token);
      cfn();
    };
  } else {
    cancelFunc = clearAndCancel;
  }

  timeout.token = setTimeout(cancelFunc, deadlineMs - nowMs);

  // Return the wrapped cancel func which also clears timeout
  // and removes the inner cancel callback from its parent
  return [cancelCtx, cancelFunc];
}
