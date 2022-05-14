// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { withCancel, withValue } from '$';
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
});
