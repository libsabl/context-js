// Copyright 2022 the Sabl authors. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context, Maybe } from '$/context';

const ctxKeyNumber = Symbol('number');

export function getNumber(ctx: Context) {
  return ctx.value(ctxKeyNumber) as Maybe<number>;
}

export function withNumber(ctx: Context, n: number) {
  return ctx.withValue(ctxKeyNumber, n);
}

declare module '$/context' {
  interface Context {
    withNumber: Setter<number>;
    getNumber: Getter<number>;
  }
}

Context.use('Number', getNumber, withNumber);
