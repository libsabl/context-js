// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/**  
  @summary A CancelFunc tells an operation to abandon its work.
    A CancelFunc does not wait for the work to stop.
    A CancelFunc may be called by multiple threads simultaneously.
    After the first call, subsequent calls to a CancelFunc do nothing.
    
    See [`context/CancelFunc`](https://github.com/golang/go/blob/release-branch.go1.18/src/context/context.go#L220-L224)
*/
export type CancelFunc = (reason?: string | Error) => void;

export type VoidCallback = () => void;

export type CanceledCallback = (err: CanceledError) => void;

const cancelerToken = Symbol('Canceler');

const SymErrCanceled = Symbol('ErrCanceled');
const SymErrDeadline = Symbol('ErrDeadline');

type CanceledErrorDecorator = {
  [SymErrCanceled]: true;
};

type DeadlineErrorDecorator = {
  [SymErrDeadline]: true;
};

/** An {@link Error} that indicates an operation was canceled */
export class CanceledError extends Error {
  readonly [SymErrCanceled] = true;
  readonly name: string = 'CanceledError';

  constructor(message?: string, options?: ErrorOptions) {
    super(message || 'Operation was canceled', options);
  }

  /**
   * Check if the error or promise rejection reason
   * was due to the request being canceled
   */
  static is(reason: unknown): reason is CanceledErrorDecorator {
    if (reason == null) return false;
    if (typeof reason !== 'object') {
      return false;
    }
    return (<CanceledErrorDecorator>reason)[SymErrCanceled] === true;
  }

  /**
   * Decorate `reason` to indicate that it was
   * a cancellation error, so that calling `CanceledError.is()`
   * on the value will return true.
   */
  static as<T extends object>(reason: T): T {
    if (reason == null) return reason;
    if (typeof reason !== 'object') {
      throw new Error(`value of type ${typeof reason} cannot be decorated`);
    }
    (<CanceledErrorDecorator>(<unknown>reason))[SymErrCanceled] = true;
    return reason;
  }

  /**
   * Create a new CanceledError based on the provided
   * input. If `reason` is already a `CanceledError`,
   * `reason` itself is returned.
   */
  static create(reason?: unknown): CanceledError {
    if (CanceledError.is(reason) && reason instanceof Error) {
      return reason;
    } else if (typeof reason === 'object') {
      return new CanceledError(undefined, { cause: <Error>reason });
    } else if (typeof reason === 'string') {
      return new CanceledError(reason);
    } else if (reason == null) {
      return new CanceledError();
    } else {
      throw new Error(
        `Cannot wrap '${typeof reason}' input as a CanceledError`
      );
    }
  }
}

/**
 * An {@link CanceledError} that indicates an operation
 * was canceled specifically because of a deadline or timeout
 */
export class DeadlineError extends CanceledError {
  readonly [SymErrDeadline] = true;
  readonly name: string = 'DeadlineError';

  constructor(message?: string, options?: ErrorOptions) {
    super(message || 'Context deadline was exceeded', options);
  }

  /**
   * Check if the error or promise rejection reason
   * was due to the operation or context being canceled
   * because of a deadline or timeout
   */
  static is(reason: unknown): reason is DeadlineError {
    return (
      CanceledError.is(reason) &&
      (<DeadlineErrorDecorator>(<unknown>reason))[SymErrDeadline] === true
    );
  }

  /**
   * Decorate `reason` to indicate that it was
   * a deadline cancellation error, so that calling
   * `DeadlineError.is()` on the value will return true.
   */
  static as<T extends object>(reason: T): T {
    if (reason == null) return reason;
    if (typeof reason !== 'object') {
      throw new Error(`value of type ${typeof reason} cannot be decorated`);
    }
    (<CanceledErrorDecorator>(<unknown>reason))[SymErrCanceled] = true;
    (<DeadlineErrorDecorator>(<unknown>reason))[SymErrDeadline] = true;
    return reason;
  }

  /**
   * Create a new DeadlineError based on the provided
   * input. If `reason` is already a `DeadlineError`,
   * `reason` itself is returned.
   */
  static create(reason?: unknown): DeadlineError {
    if (DeadlineError.is(reason) && reason instanceof Error) {
      return reason;
    } else if (typeof reason === 'object') {
      return new DeadlineError(undefined, { cause: <Error>reason });
    } else if (typeof reason === 'string') {
      return new DeadlineError(reason);
    } else if (reason == null) {
      return new DeadlineError();
    } else {
      throw new Error(
        `Cannot wrap '${typeof reason}' input as a DeadlineError`
      );
    }
  }
}

/** A simple cancellation signaler that supports polling for status or registering a callback */
export class Canceler {
  readonly #callbacks: Set<VoidCallback | CanceledCallback> = new Set<
    VoidCallback | CanceledCallback
  >();
  #canceled = false;
  #canceling = false;
  #err: CanceledError | null = null;

  /**
   * This constructor is private and should not be
   * called directly. Use Canceler.create instead.
   */
  constructor(token: symbol, canceled: boolean) {
    if (token !== cancelerToken) {
      throw new Error(
        'Canceler constructor is private. Use static Canceler.create'
      );
    }
    this.#canceled = canceled;
  }

  /** Whether the Canceler is canceled */
  get canceled(): boolean {
    return this.#canceled;
  }

  /** The reason the Canceler was canceled */
  get err(): CanceledError | null {
    return this.#err;
  }

  /**
   * Register a callback to be invoked when the {@link Canceler} is canceled.
   * A null callback is ignored.
   */
  onCancel(cb: VoidCallback | CanceledCallback) {
    if (cb == null) return;
    if (typeof cb !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (this.#canceled && !this.#canceling) {
      // Already canceled, and done with any queued callbacks.
      // Call this callback immediately.
      cb(this.#err!);
      return;
    }

    this.#callbacks.add(cb);
  }

  /** Remove a registered callback */
  off(cb: VoidCallback | CanceledCallback) {
    this.#callbacks.delete(cb);
  }

  /** Signal cancellation */
  #cancel(reason?: unknown): void {
    if (this.#canceled) return;
    this.#canceled = true;
    this.#canceling = true;

    this.#err = CanceledError.create(reason);

    const stack = this.#callbacks;
    while (stack.size) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const cb of stack) {
        stack.delete(cb);
        cb(this.#err);
        break;
      }
    }
    this.#canceling = false;
  }

  /**
   * Create a new {@link Canceler} and return it along with
   * the {@link CancelFunc} used to signal cancellation
   */
  static create(canceled = false): [Canceler, CancelFunc] {
    const clr = new Canceler(cancelerToken, canceled || false);
    const cnf: CancelFunc = clr.#cancel.bind(clr);
    return [clr, cnf];
  }

  /** Check the count of registered callbacks on the canceler */
  static size(clr: Canceler) {
    return clr.#callbacks.size;
  }
}
