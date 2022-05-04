// Copyright 2022 the Sabl authors. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context } from '$/context';
import '$test/fixtures/number-context';

describe('NumberContext', () => {
  describe('getNumber', () => {
    it('gets the number from the context', () => {
      const ctx = Context.background.withNumber(11);
      const n = ctx.getNumber();
      expect(n).toBe(11);
    });
  });
});
