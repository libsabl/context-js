// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Canceler, Context } from '$';
import { VoidCallback } from '$/canceler';
import exp from 'constants';

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
});
