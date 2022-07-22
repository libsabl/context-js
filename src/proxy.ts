// Copyright 2022 Joshua Honig. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

import { Context, IContext } from './context';

const attachedContext = Symbol('context');

type EmbeddedContext = {
  [attachedContext]: IContext;
};

/**
 * Proxy an input source while attaching a context to it which can be
 * retrieved using {@link getContext}
 * @param source The object to which the context should be attached
 * @param ctx The context to attach
 * @returns A proxy of `source`
 */
export function withContext<T extends object>(source: T, ctx: IContext): T {
  const proxy = <T>Object.create(source);
  (<EmbeddedContext>proxy)[attachedContext] = ctx;
  return proxy;
}

/**
 * Retrieve the context previously attached to an object using {@link withContext}
 * @param source The object to which the context should be attached
 * @param allowNull Whether to ignore if no context was present
 * @returns The retrieved context
 */
export function getContext(source: unknown, allowNull = false): Context {
  const ctx = (<EmbeddedContext>source)[attachedContext];
  if (!allowNull && ctx == null) {
    throw new Error('Context not assigned to source');
  }
  if (ctx == null) return ctx;
  return Context.as(ctx);
}
