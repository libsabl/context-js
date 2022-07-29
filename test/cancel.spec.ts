// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Canceler, Context } from '$';
import { CanceledError, DeadlineError, VoidCallback } from '$/canceler';

describe('cancel', () => {
  it('creates a root cancelable context', () => {
    const [ctx, cancel] = Context.cancel();
    expect(cancel).toBeInstanceOf(Function);
    expect(ctx.toString()).toBe('context.Cancel');

    expect(ctx.canceler).toBeInstanceOf(Canceler);

    let somevar = 2;

    expect(ctx.canceled).toBe(false);

    expect(somevar).toBe(2);
    ctx.canceler.onCancel(() => (somevar = 3));

    cancel();

    expect(ctx.canceled).toBe(true);
    expect(somevar).toBe(3);
  });

  it('cancels child contexts', () => {
    const [ctxParent, cancelParent] = Context.cancel();
    const [ctxChild] = ctxParent
      .withValue('one', 1)
      .withValue('two', 2)
      .withCancel();
    const ctxDesc = ctxChild.withValue('x', 2);

    for (const ctx of [ctxParent, ctxChild, ctxDesc]) {
      expect(ctx.canceled).toBe(false);
    }

    let somevar = 2;
    ctxChild.canceler.onCancel(() => (somevar = 3));

    cancelParent();

    for (const ctx of [ctxParent, ctxChild, ctxDesc]) {
      expect(ctx.canceled).toBe(true);
    }

    // Prove child callbacks were called
    expect(somevar).toBe(3);
  });

  it('removes itself from parent cancelers', () => {
    const [ctxParent] = Context.cancel();
    const [ctxChild, cancelChild] = ctxParent.withCancel();

    expect(Canceler.size(ctxParent.canceler)).toBe(1);

    // Cancel the child directly
    cancelChild();
    expect(ctxChild.canceled).toBe(true);

    // Parent should not be canceled, but
    // callback should be removed from parent canceler
    expect(ctxParent.canceled).toBe(false);
    expect(Canceler.size(ctxParent.canceler)).toBe(0);
  });
});

describe('Canceler', () => {
  describe('ctor', () => {
    it('rejects direct invoke', () => {
      expect(() => new Canceler(Symbol('Canceler'), false)).toThrow(
        /Canceler constructor is private/
      );
    });
  });

  describe('onCancel', () => {
    it('ignores null callback', () => {
      const [clr] = Canceler.create();
      expect(() => clr.onCancel(null!)).not.toThrow();
    });

    it('rejects non-function', () => {
      const [clr] = Canceler.create();
      for (const v of [2, 'hello', new Date()]) {
        const fn = <VoidCallback>(<unknown>v);
        expect(() => clr.onCancel(fn)).toThrow(/Callback must be a function/);
      }
    });

    it('queues calls in order', () => {
      const [clr, cancel] = Canceler.create();
      const msgs: string[] = [];

      clr.onCancel(() => msgs.push('First'));
      clr.onCancel(() => msgs.push('Second'));
      clr.onCancel(() => msgs.push('Third'));

      expect(msgs).toEqual([]);

      cancel();

      expect(msgs).toEqual(['First', 'Second', 'Third']);
    });

    it('immediately invokes if already canceled', () => {
      const [clr, cancel] = Canceler.create();
      const msgs: string[] = [];

      cancel();

      clr.onCancel(() => msgs.push('First'));
      expect(msgs).toEqual(['First']);

      clr.onCancel(() => msgs.push('Second'));
      expect(msgs).toEqual(['First', 'Second']);
    });

    it('queues call from within cancel callback', () => {
      const [clr, cancel] = Canceler.create();
      const msgs: string[] = [];

      clr.onCancel(() => msgs.push('First'));

      clr.onCancel(() => {
        // Only first callback has already been invoked
        expect(msgs).toEqual(['First']);

        // Append these to end of queue
        clr.onCancel(() => msgs.push('Third'));
        clr.onCancel(() => msgs.push('Fourth'));
      });

      clr.onCancel(() => msgs.push('Second'));

      cancel();

      expect(msgs).toEqual(['First', 'Second', 'Third', 'Fourth']);
    });

    it('ignores repeat calls to cancel', () => {
      const [clr, cancel] = Canceler.create();
      const msgs: string[] = [];

      clr.onCancel(() => msgs.push('First'));

      clr.onCancel(() => {
        // Only first callback has already been invoked
        expect(msgs).toEqual(['First']);
        expect(clr.canceled).toBe(true);

        // This does nothing
        cancel();

        // Append these to end of queue
        clr.onCancel(() => msgs.push('Third'));
      });

      clr.onCancel(() => msgs.push('Second'));

      cancel();

      expect(msgs).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('cancel', () => {
    it('provides error to callbacks', () => {
      const [clr, cancel] = Canceler.create();
      const errs: unknown[] = [];

      clr.onCancel((err) => errs.push(err));
      clr.onCancel((err) => errs.push(err));
      clr.onCancel((err) => errs.push(err));

      cancel();

      expect(errs.length).toBe(3);
      for (const err of errs) {
        expect(CanceledError.is(err)).toBe(true);
      }
    });

    it('provides custom error to callbacks - string', () => {
      const [clr, cancel] = Canceler.create();
      const errs: Error[] = [];

      clr.onCancel((err) => errs.push(err));
      clr.onCancel((err) => errs.push(err));
      clr.onCancel((err) => errs.push(err));

      cancel('rejected');

      expect(errs.length).toBe(3);
      for (const err of errs) {
        expect(CanceledError.is(err)).toBe(true);
        expect(err.message).toEqual('rejected');
      }
    });

    it('provides custom error to callbacks - error', () => {
      const [clr, cancel] = Canceler.create();
      const errs: Error[] = [];

      clr.onCancel((err) => errs.push(err));
      clr.onCancel((err) => errs.push(err));
      clr.onCancel((err) => errs.push(err));

      cancel(new DeadlineError('times up'));

      expect(errs.length).toBe(3);
      for (const err of errs) {
        expect(CanceledError.is(err)).toBe(true);
        expect(DeadlineError.is(err)).toBe(true);
        expect(err.message).toEqual('times up');
      }
    });

    it('sets error on canceler', () => {
      const [clr, cancel] = Canceler.create();
      cancel(new DeadlineError('times up'));
      const err = clr.err!;
      expect(CanceledError.is(err)).toBe(true);
      expect(DeadlineError.is(err)).toBe(true);
      expect(err.message).toEqual('times up');
    });
  });
});

describe('CanceledError', () => {
  it('does not require message or options', () => {
    const err = new CanceledError();
    expect(err.message).toEqual('Operation was canceled');
    expect((<Error>err).name).toEqual('CanceledError');
  });

  it('uses message and options', () => {
    const innerError = new Error('Connection dropped');
    const err = new CanceledError('Oh no', { cause: innerError });
    expect(err.message).toEqual('Oh no');
    expect((<Error>err).name).toEqual('CanceledError');
    expect((<Error>err).cause).toBe(innerError);
  });

  describe('is', () => {
    it('returns true for a CanceledError', () => {
      const err = new CanceledError();
      expect(CanceledError.is(err)).toBe(true);
    });

    it('returns true for a decorated value', () => {
      const err = CanceledError.as(new Date());
      expect(CanceledError.is(err)).toBe(true);
    });

    it('returns false for null', () => {
      expect(CanceledError.is(null)).toBe(false);
    });

    it('returns false for non-decorated values', () => {
      expect(CanceledError.is(new Error())).toBe(false);
      expect(CanceledError.is(1)).toBe(false);
      expect(CanceledError.is('canceled!')).toBe(false);
    });
  });

  describe('as', () => {
    it('decorates any object value', () => {
      for (const v of [{}, new Date(), new Error()]) {
        const decorated = CanceledError.as(v);
        expect(CanceledError.is(decorated)).toBe(true);
      }
    });

    it('does nothing to null', () => {
      expect(CanceledError.as(null!)).toBe(null);
    });

    it('throws for non-object values', () => {
      const myFunc = () => 2;
      for (const v of [1, 1n, 'hello', true, myFunc]) {
        expect(() => CanceledError.as(<object>v)).toThrow('value of type');
      }
    });
  });

  describe('create', () => {
    it('returns existing CanceledError', () => {
      const err = CanceledError.as(new Error('bummer'));
      const result = CanceledError.create(err);
      expect(result).toBe(err);
    });

    it('uses reason message', () => {
      const result = CanceledError.create('oh no!');
      expect(result.message).toEqual('oh no!');
    });

    it('uses error as cause', () => {
      const innerError = new Error('Connection dropped');
      const err = CanceledError.create(innerError);
      expect(err.message).toEqual('Operation was canceled');
      expect((<Error>err).name).toEqual('CanceledError');
      expect((<Error>err).cause).toBe(innerError);
    });

    it('ignores empty', () => {
      for (const reason of [null, undefined]) {
        const err = CanceledError.create(reason);
        expect(err.message).toEqual('Operation was canceled');
      }
    });

    it('wraps any object', () => {
      for (const reason of [new Date(), console, { a: 'b' }]) {
        const err = CanceledError.create(reason);
        expect(err.cause).toBe(reason);
      }
    });

    it('rejects non-objects', () => {
      for (const reason of [1, 2n, console.log, true]) {
        expect(() => CanceledError.create(reason)).toThrow('Cannot wrap');
      }
    });
  });
});

describe('DeadlineError', () => {
  it('does not require message or options', () => {
    const err = new DeadlineError();
    expect(err.message).toEqual('Context deadline was exceeded');
    expect((<Error>err).name).toEqual('DeadlineError');
  });

  it('uses message and options', () => {
    const innerError = new Error('Connection dropped');
    const err = new DeadlineError('Oh no', { cause: innerError });
    expect(err.message).toEqual('Oh no');
    expect((<Error>err).name).toEqual('DeadlineError');
    expect((<Error>err).cause).toBe(innerError);
  });

  it('is also a CanceledError', () => {
    const err = new DeadlineError();
    expect(CanceledError.is(err)).toBe(true);
  });

  describe('is', () => {
    it('returns true for a DeadlineError', () => {
      const err = new DeadlineError();
      expect(DeadlineError.is(err)).toBe(true);
    });

    it('returns true for a decorated value', () => {
      const err = DeadlineError.as(new Date());
      expect(DeadlineError.is(err)).toBe(true);
    });

    it('returns false for null', () => {
      expect(DeadlineError.is(null)).toBe(false);
    });

    it('returns false for non-decorated values', () => {
      expect(DeadlineError.is(new Error())).toBe(false);
      expect(DeadlineError.is(1)).toBe(false);
      expect(DeadlineError.is('canceled!')).toBe(false);
    });
  });

  describe('as', () => {
    it('decorates any object value', () => {
      for (const v of [{}, new Date(), new Error()]) {
        const decorated = DeadlineError.as(v);
        expect(DeadlineError.is(decorated)).toBe(true);
      }
    });

    it('does nothing to null', () => {
      expect(DeadlineError.as(null!)).toBe(null);
    });

    it('throws for non-object values', () => {
      const myFunc = () => 2;
      for (const v of [1, 1n, 'hello', true, myFunc]) {
        expect(() => DeadlineError.as(<object>v)).toThrow('value of type');
      }
    });
  });

  describe('create', () => {
    it('returns existing DeadlineError', () => {
      const err = DeadlineError.as(new Error('bummer'));
      const result = DeadlineError.create(err);
      expect(result).toBe(err);
    });

    it('uses reason message', () => {
      const result = DeadlineError.create('oh no!');
      expect(result.message).toEqual('oh no!');
    });

    it('uses error as cause', () => {
      const innerError = new Error('Connection dropped');
      const err = DeadlineError.create(innerError);
      expect(err.message).toEqual('Context deadline was exceeded');
      expect((<Error>err).name).toEqual('DeadlineError');
      expect((<Error>err).cause).toBe(innerError);
    });

    it('ignores empty', () => {
      for (const reason of [null, undefined]) {
        const err = DeadlineError.create(reason);
        expect(err.message).toEqual('Context deadline was exceeded');
      }
    });

    it('wraps any object', () => {
      for (const reason of [new Date(), console, { a: 'b' }]) {
        const err = DeadlineError.create(reason);
        expect(err.cause).toBe(reason);
      }
    });

    it('rejects non-objects', () => {
      for (const reason of [1, 2n, console.log, true]) {
        expect(() => DeadlineError.create(reason)).toThrow('Cannot wrap');
      }
    });
  });
});
