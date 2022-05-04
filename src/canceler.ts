// Copyright 2022 the Sable authors. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/**  
  @summary A CancelFunc tells an operation to abandon its work.
    A CancelFunc does not wait for the work to stop.
    A CancelFunc may be called by multiple threads simultaneously.
    After the first call, subsequent calls to a CancelFunc do nothing.
    
    See [`context/CancelFunc`](https://github.com/golang/go/blob/release-branch.go1.18/src/context/context.go#L220-L224)
*/
export type CancelFunc = () => void;

const cancelerToken = Symbol('Canceler');

export type VoidCallback = () => void;

/** A simple cancelation signaler that support polling for status or  */
export class Canceler {
  readonly #callbacks: VoidCallback[] = [];
  #canceled = false;
  #canceling = false;

  /** This constructor is private and should not be called directly */
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

  /** Register a callback to be invoked when the {@link Canceler} is canceled.
   * A null callback is ignored.
   */
  onCancel(cb: () => void) {
    if (cb == null) return;
    if (typeof cb !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (this.#canceled && !this.#canceling) {
      // Already canceled, and done with any queued callbacks.
      // Call this callback immediately.
      cb();
      return;
    }

    this.#callbacks.push(cb);
  }

  /** Signal cancellation */
  private cancel(): void {
    if (this.#canceled) return;
    this.#canceling = true;
    this.#canceled = true;
    const stack = this.#callbacks;
    while (stack.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cb = stack.shift()!;
      cb();
    }
    this.#canceling = false;
  }

  /** Creata a new {@link Canceler} and return it along with
   * the {@link CancelFunc} used to signal cancellation
   */
  static create(canceled = false): [Canceler, CancelFunc] {
    const clr = new Canceler(cancelerToken, canceled || false);
    const cnf: CancelFunc = clr.cancel.bind(clr);
    return [clr, cnf];
  }
}
