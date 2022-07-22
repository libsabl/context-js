// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context } from '$/context';
import { getNumber, withNumber } from '$test/fixtures/number-context';

describe('NumberContext', () => {
  describe('getNumber', () => {
    it('gets the number from the context', () => {
      const ctx = Context.value(withNumber, 11);
      const n = getNumber(ctx);
      expect(n).toBe(11);
    });
  });
});
