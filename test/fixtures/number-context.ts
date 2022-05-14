// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { IContext, Context, Maybe, withValue } from '$/context';

const cxtKeyNumber = Symbol('number');

/** Get the number from a context */
export function getNumber(ctx: IContext): Maybe<number> {
  return <Maybe<number>>ctx.value(cxtKeyNumber);
}

/** Set the number on a context */
export function withNumber(ctx: IContext, n: number): Context {
  return withValue(ctx, cxtKeyNumber, n);
}

getNumber.label = cxtKeyNumber.description;
