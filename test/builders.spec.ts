// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import {
  Canceler,
  Context,
  withCancel,
  withDeadline,
  withTimeout,
  withValue,
} from '$';
import { DeadlineError } from '$/canceler';
import { CustomRootContext } from '$test/fixtures/custom-context';

describe('withValue', () => {
  it('works with custom context implementation', () => {
    const cctx = new CustomRootContext('a', 2);
    const child = withValue(cctx, 'b', 3);

    expect(child.value('b')).toBe(3);
    expect(child.value('a')).toBe(2);
  });
});

describe('withCancel', () => {
  it('works with custom context implementation', () => {
    const cctx = new CustomRootContext('a', 2);
    const [child, cancel] = withCancel(cctx);

    expect(child.value('a')).toBe(2);
    expect(child.canceled).toBe(false);

    cancel();

    expect(child.canceled).toBe(true);
  });

  it('returns parent context if parent is already canceled', () => {
    const [root, rootCancel] = Context.cancel();
    rootCancel();

    const [child, childCancel] = withCancel(root);
    expect(child).toBe(root);

    expect(childCancel).not.toBe(rootCancel);
  });

  it('cascades cancellation with reason', () => {
    const [ctxRoot, cancel] = Context.cancel();
    const [ctxChild] = ctxRoot.withCancel();
    const [ctxGrandChild] = ctxChild.withCancel();

    const rootErr = new DeadlineError();
    cancel(rootErr);

    expect(ctxGrandChild.canceler.canceled).toBe(true);
    expect(ctxGrandChild.canceler.err).toBe(rootErr);
    expect(DeadlineError.is(ctxGrandChild.canceler.err)).toBe(true);
  });
});

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe('withDeadline', () => {
  it('can be canceled directly', () => {
    const [ctx, cancel] = withDeadline(
      Context.background,
      new Date(+new Date() + 600_000)
    );

    let msg = 'original';
    ctx.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('original');

    cancel();

    expect(msg).toBe('canceled!');
  });

  it('can be canceled directly - with parent', () => {
    const [root] = Context.cancel();
    const [ctx, cancel] = withDeadline(root, new Date(+new Date() + 600_000));

    expect(Canceler.size(root.canceler)).toBe(1);

    let msg = 'original';
    ctx.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('original');

    cancel();

    expect(msg).toBe('canceled!');

    expect(Canceler.size(root.canceler)).toBe(0);
  });

  it('returns parent context if parent is already canceled', () => {
    const [root, rootCancel] = Context.cancel();
    rootCancel();

    const [child, childCancel] = withDeadline(
      root,
      new Date(+new Date() + 600_000)
    );
    expect(child).toBe(root);

    childCancel(); // Does nothing

    expect(childCancel).not.toBe(rootCancel);
  });

  it('cancels automatically', async () => {
    const [ctx] = withDeadline(Context.background, new Date(+new Date() + 10));

    let msg = 'original';
    ctx.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('original');

    await wait(15);

    expect(msg).toBe('canceled!');
  });

  it('cascades parent', async () => {
    const [root, rootCancel] = Context.cancel();
    const [ctx] = withDeadline(root, new Date(+new Date() + 10));

    let msg = 'original';
    ctx.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('original');

    rootCancel();

    expect(msg).toBe('canceled!');
  });

  it('checks parent deadline', async () => {
    const [ctxDL1] = withDeadline(
      Context.background,
      new Date(+new Date() + 10)
    );
    const [ctxDL2] = withDeadline(ctxDL1, new Date(+new Date() + 100));

    let msg = 'original';
    ctxDL2.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('original');

    await wait(15);

    expect(msg).toBe('canceled!');
  });

  it('is already canceled if deadline is past', () => {
    const [ctx] = withDeadline(
      Context.background,
      new Date(+new Date() - 600_000)
    );
    expect(ctx.canceled).toBe(true);

    let msg = 'original';
    ctx.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('canceled!');
  });

  it('cancels with DeadlineError if timed out', async () => {
    let capturedError: Error = null!;

    const [ctx] = withDeadline(Context.background, new Date(+new Date() + 10));
    ctx.canceler.onCancel((err) => (capturedError = err));
    await wait(15);

    expect(DeadlineError.is(capturedError)).toBe(true);
  });

  it('cancels with non-DeadlineError if canceled directly', async () => {
    let capturedError: Error = null!;

    const [ctx, cancel] = withDeadline(
      Context.background,
      new Date(+new Date() + 10)
    );
    ctx.canceler.onCancel((err) => (capturedError = err));
    cancel();

    await wait(15);

    expect(DeadlineError.is(capturedError)).toBe(false);
  });

  it('cancels with non-DeadlineError if cascade canceled', async () => {
    let capturedError: Error = null!;

    const [ctxRoot, cancel] = Context.cancel();
    const [ctxChild] = ctxRoot.withCancel();
    const [ctxGrandChild] = ctxChild.withCancel();

    const [ctx] = withDeadline(ctxGrandChild, new Date(+new Date() + 10));

    ctx.canceler.onCancel((err) => (capturedError = err));

    cancel();

    await wait(15);

    expect(DeadlineError.is(capturedError)).toBe(false);
  });
});

describe('withTimeout', () => {
  it('cancels automatically', async () => {
    const [ctx] = withTimeout(Context.background, 10);

    let msg = 'original';
    ctx.canceler.onCancel(() => (msg = 'canceled!'));

    expect(msg).toBe('original');

    await wait(15);

    expect(msg).toBe('canceled!');
  });

  it('cancels with DeadlineError if timed out', async () => {
    let capturedError: Error = null!;

    const [ctx] = withTimeout(Context.background, 10);
    ctx.canceler.onCancel((err) => (capturedError = err));
    await wait(15);

    expect(DeadlineError.is(capturedError)).toBe(true);
  });

  it('cancels with non-DeadlineError if canceled directly', async () => {
    let capturedError: Error = null!;

    const [ctx, cancel] = withTimeout(Context.background, 10);
    ctx.canceler.onCancel((err) => (capturedError = err));
    cancel();

    await wait(15);

    expect(DeadlineError.is(capturedError)).toBe(false);
  });

  it('cancels with non-DeadlineError if cascade canceled', async () => {
    let capturedError: Error = null!;

    const [ctxRoot, cancel] = Context.cancel();
    const [ctxChild] = ctxRoot.withCancel();
    const [ctxGrandChild] = ctxChild.withCancel();

    const [ctx] = withTimeout(ctxGrandChild, 10);

    ctx.canceler.onCancel((err) => (capturedError = err));

    cancel();

    await wait(15);

    expect(DeadlineError.is(capturedError)).toBe(false);
  });
});
