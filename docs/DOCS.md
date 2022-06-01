# sabl/js/context
 
## Contents

- [Basic API](#basic-api)
  - [Core interfaces](#core-interfaces-icontext-canceler)
  - [Callback types](#callback-types)
    - [`CancelFunc`](#cancelfunc)
    - [`ContextGetter<T>`](#contextgettert)
    - [`ContextSetter<T>`](#contextsettert)
  - [Static package functions](#static-package-functions)
    - [`withValue`](#withvalue)
    - [`withCancel`](#withcancel)
    - [`withContext`](#withcontext)
    - [`getContext`](#getcontext)
- [Immutability](#immutability)
  - [Overriding values](#overriding-values)
  - [Cascading cancellations](#cascading-cancellations)
- [Context class](#context-class)
  - [`withValue`](#withvalue-instance)
  - [`withCancel`](#withcancel-instance)
  - [`require`](#require)
  - [Static `background`, `as`, `empty`, `value`, `cancel`](#static-factory-members)
- Implementing getters and setters
- [Examples](#examples)
  - [Setting up context](#1-setting-up-context)
  - [Retrieving context](#2-retrieving-context)
  - [Defining getters and setters](#3-defining-getters-and-setters)

## Basic API

### Core interfaces: `IContext`, `Canceler`
A context is a simple interface that allows for two operations:

- Retrieving a context value by its key
- Checking if the context is cancelable or canceled

In this implementation, we define two top-level interfaces: `IContext` and `Canceler`:

```ts
interface IContext {
  value(key: symbol | string): unknown;
  get canceler(): Canceler | null;
}

interface Canceler {
  canceled: boolean;
  onCancel(cb: () => void): void;
  off(cb: () => void): void;
}
```

The `Canceler` interface allows for registering a callback upon cancellation. If the `canceler` of a context is null, then the context is not cancelable.
 
> **Note on naming: `IContext`**
>
> It is usually discouraged in TypeScript to prefix interfaces with `I` since classes and interfaces can be used interchangeably. In this case the interface is named `IContext` to distinguish it from the `Context` class, described below, which has additional methods. Custom implementations of `IContext` are allowed and need only implement the three members of `IContext`, not the additional members of the `Context` class. 
>

### Callback types

This library also defines three callback types:

```ts
export type CancelFunc = () => void;

export type ContextGetter<T> = (ctx: IContext) => T | null | undefined;
 
export type ContextSetter<T> = (ctx: IContext, item: T) => Context;
```

#### `CancelFunc`

A simple alias for a void-returning function. Represents the signature of the function returned by the static or instance `withCancel` functions which, when called, will cancel the applicable context.

#### `ContextGetter<T>`

A context getter function does not accept a key value. Instead, it encapsulates a non-exported key. This must be paired with a corresponding context setter function.
 
#### `ContextSetter<T>`

A context setter function does not accept a key value. Instead, it encapsulates a non-exported key. This must be paired with a corresponding context getter function.

### Static package functions

### `withValue`

```ts
export function withValue(
  parent: IContext, 
  key: symbol | string, 
  value: unknown
): Context;
```

Returns a child context with a value set. Note this function accepts any value that implements the minimal [`IContext` interface](#icontext-interface) but it returns a concrete [`Context`](#extended-context-interface).

### `withCancel`

```ts
export function withCancel(parent: IContext): [Context, CancelFunc];
```

Returns a child cancelable context along with a function the can be called to cancel it. Note this function accepts any value that implements the minimal [`IContext` interface](#icontext-interface) but returns a concrete [`Context`](#extended-context-interface).

**IMPORTANT**: To avoid memory leaks, all cancelable contexts **must** be canceled when their work is complete, including if the work completed successfully. The safest way to accomplish this is to enclose all use of the cancelable context in a `try` block, with a call to the cancel func in an associated `finally` block. There is no harm in calling the same cancel function multiple times. Any calls after the first have no effect and return immediately.

```ts
async function handleRequest(ctx: IContext, req: Request) {
  const [childCtx, cancel] = withCancel(ctx);
  try {
    /* 
      ...
      all logic using childCtx 
      ...
    */
  } finally {
    // Ensure cancel is called to remove callback
    // added to an ancestor cancelable context
    cancel();
  }
}
```

### `withContext`

```ts
export function withContext<T>(source: T, ctx: IContext): T;
```

Returns a proxy of the `source` object with the provided context attached. The context can be retrieved from the proxy object using [`getContext`](#getcontext).

### `getContext`

```ts
export function getContext(
  source: unknown, 
  allowNull: boolean = false
): Context;
```

Retrieves a context from a proxy object previously created with [`withContext`](#withcontext). Returns a concrete [`Context`](#context-class) even if the original context provided to `getContext` was not, by internally using [`Context.as`](#as). Will throw an error if no context is present, unless `allowNull` is true.

#### Using `withContext` and `getContext`

`withContext` and `getContext` are useful for integrating the context pattern into an existing codebase where it is not possible or practical to change the signatures of many existing functions or APIs. A prime use case is to incorporate the context pattern into existing service middleware patterns such as those used by express. The following example adds a very simple inline middleware to attach a root context to each request. That context can then be retrieved and used in any downstream middleware or endpoint.

```ts
import { Context, withContext, getContext } from '@sabl/context';

/* -- service startup -- */
const app = new [express | koa | etc.]();
 
// Build up shared services to inject
const ctx = Context.background.
  withValue(withRepo, new RealRepo()).
  withValue(withLogger, new RealLogger()).
  withValue(with..., new ...()) 
  /* etc */; 

// Attach root context to each incoming request
app.use((req, res, next) => {
  return next(withContext(req, ctx), res);
})

/* -- in other middleware -- */
async function authorizeMiddleware(req, res, next) {
  const ctx = getContext(req);
  // Now retrieve dependencies, etc.
  const secSvc = ctx.require(getSecSvc);
}

/* -- in an endpoint -- */
async function getItems(req, res) {
  const ctx = getContext(req);
  // Now retrieve validated state, etc.
  const [user, order] = ctx.require(getUser, getOrder);
}
```

## Immutability

Each individual context instance is immutable. New values are "set" on a context by creating a new child context with the desired key and value, but which retains a reference to its parent context. 

This is similar to how property lookups work in JavaScript, where an object can walk its prototype chain to retrieve values that are not defined on the object instance itself. In this pattern, however, each new context instance can only contain **either** exactly one new key-value pair, **or** a new canceler.

**Custom implementations of IContext** MUST also be immutable.

### Overriding values

A value already assigned on a context chain can be "reassigned" by creating a descendant context with a new value for the same key, or can be "removed" by creating a descendant context with an explicit `null` or `undefined` value for the the same key:

```ts
const ctxRoot = Context.value('x', 22);
const child   = ctxRoot.withValue('x', 11);
const gchild  = child.withValue('x', undefined);

console.log(ctxRoot.value('x')); // 22, never modified
console.log(child.value('x'));   // 11, closest match
console.log(gchild.value('x'));  // undefined, closest match
```

### Cascading cancellations

The cancellation propagation architecture of the context pattern provides an intrinsically thread-safe way of propagating cancellations to an arbitrary number of descendants, either linearly or fanned.

Cancellation of a given context is always propagated immediately through callbacks to all its descendants, but is not propagated up.

A common scenario is a root context of a web server which is canceled when the program receives a termination signal, which would cascade its cancellation to any and all ongoing requests. Conversely, canceling an individual request does not propagate upwards and kill the entire server.
 
## `Context` class

This library defines `Context` as a concrete class which implements `IContext` but also provides several instance and static methods for convenient syntax and extensibility.

```ts
class Context implements IContext {
  // Base IContext interface:
  value(key: Symbol | string): unknown;
  get canceler(): Canceler | null;
  get canceled(): boolean;

  // =============================================
  //  Convenience instance methods
  // =============================================

  /** Create a child context with the provided key and value */
  withValue(key: symbol | string, value: unknown): Context;

  /** Create a new child context using the provided setter and value */
  withValue<T>(setter: ContextSetter<T>, item: T): Context;

  /** Create a child cancelable context */
  withCancel(): Context;

  /** Require one to six context items using their getter functions, 
   * throwing an error if any is null or undefined */
  require<T, [T2, T3, ... T6]>(
    getter : (ctx: IContext) => T,
   [getter2: (ctx: IContext) => T2,
    getter3: (ctx: IContext) => T3,
    ...
    getter6: (ctx: IContext) => T6]
  );

  // =============================================
  //  Static factory methods
  // =============================================

  /** Get a simple root context */
  static get background(): Context;

  /** Wrap an IContext as a concrete Context */
  static as(source: IContext): Context;

  /** Create a new root empty context with a name */
  static empty(name: string): Context;

  /** Create a new root context with a value */
  static value(key: symbol | string, value: unknown): Context;

  /** Create a new root context using the provided setter and value */
  static value<T>(setter: ContextSetter<T>, value: T): Context;
   
  /** Create a new root cancelable context */
  static cancel(): [Context, CancelFunc];
}
```

### Instance methods

#### `withValue` (instance)
The `withValue` instance method of `Context` accepts either a literal key or a context setter function and a corresponding value. It can be used to chain assignments to add multiple context values. See [examples](#1-setting-up-context).

```ts
const ctx = Context.background;

// Using withValue function
const child = withValue(ctx, 'a', 1);

// Using withValue method of Context, same effect:
const child = ctx.withValue('a' 1);
```

#### `withCancel` (instance)
The `withCancel` instance method of `Context` returns a child cancelable context along with a function that can be called to cancel it. It is a convenience alternative to calling the [`withCancel` function](#cancelable-context).

```ts
const ctx = Context.value('a', 1);

// Using withCancel function
const [child, cancel] = withCancel(ctx);

// Using withCancel method of Context, same effect:
const [child, cancel] = ctx.withCancel();
```

#### `require`
The `require` instance method of `Context` accepts one to six getter functions and returns the applicable retrieved values, while also guaranteeing that all returned values are non-null.

Following the established context pattern, getter functions **should not throw an error** if the requested value is null or undefined. This should be true for any implementations of the base `IContext.value(...)` method, as well as for any symbolic getter functions. 

Often, however, it is helpful to succinctly validate that one or more context values definitely are present and non-null. The `require` function of the `Context` class provides this. The arguments are one to six context getter functions, which also provide static type information to the TypeScript compiler. If only one getter function is used, the the resulting value is returned unwrapped. If more than one getter is used, then all the values are returned in an ordered array which can be destructured. 

```ts
import { getUser } from '.../security';

function doStuff(ctx: Context) {
  // Works, but does not guarantee return value is not null
  const user = getUser(ctx);

  // Guarantees return value is not null, and preserves static type
  const user = ctx.require(getUser);

  // Guarantees all return values are not null and preserves static types
  const [ user, repo, secSvc ] = ctx.require(
    getUser, getRepo, getSecSvc
  );
}
```

### Static factory members

The `Context` class includes several factory members for retrieving or creating root contexts. `background` is an immutable property which always returns the same value, while the remaining members are functions which create new context instances each time they are called.

#### `as`
`Context.as` is a convenient way to accept any `IContext` (interface) value but convert it to a concrete `Context` in order to use the instance methods `withValue`, `withCancel`, and `require`. If the input value is already a `Context` instance then that value is returned. If it is not, a new `Context` instance which wraps the provided value is returned.

#### `background`
`Context.background` is an empty base context that can be used as a root context.

#### `empty`
`Context.empty` creates an empty root context with a custom name. The name of the context has no effect whatsoever except in the output of `toString`:

```js
console.log(`${Context.background}`);     // "context.Background"
console.log(`${Context.empty('root')}`);  // "context.root"
```

#### `value`
`Context.value` creates a root context with a key/value pair set. It accepts a string or symbol key literal or a context setter function, along with the value to set. Note the overload which accepts a setter function is generic and can enforce that the value is of the correct type.

```ts
const rootByString = Context.value('message', 'Hello');
const rootBySymbol = Context.value(Symbol('x'), 'y');
const rootBySetter = Context.value(withStartTime, new Date);
```

#### `cancel`
`Context.cancel` creates a root cancelable context. It is the equivalent of using [`withCancel`](#cancelable-context) but with a null parent context.

```ts
const [root, kill] = Context.cancel();

// Same as this:
const [root, kill] = withCancel(null);
```

## Examples

### 1. Setting up context

#### 1.1 Plain string keys
Context values can be set with the `withValue` method and plain string keys. This demonstrates the simplicity of the pattern. In practice, it is preferable to use unexported `symbol` keys with exported getter and setter functions.

```ts
// Plain string keys chained using withValue method of Context class
const [root, kill] = Context.background.withCancel();
let ctx = root.withValue('logger', new Logger(root));
    ctx =  ctx.withValue('repo', new Repo(ctx));
              .withValue('x', ...)
              .withValue('y', ...); 
```

#### 1.2 Non-chained symbolic setters
The approach usually used in go is to use private (unexported) key values with public (exported) getter and setter functions. The JavaScript `Symbol` type can be used to create private key values that will never collide. By itself this is an improvement in safety and type-checking over using plain string keys, but we lose the fluid or chained syntax.

```ts
// Safe symbolic setters
import { Logger, withLogger } from '.../logger';
import { Repo  , withRepo   } from '.../repo';

const [root, kill] = Context.background.withCancel();
let ctx = withLogger(root.withValue, new Logger(root));
    ctx = withRepo(ctx, new Repo(ctx));
    ctx = withX(ctx, ...);
    ctx = withY(ctx, ...);
```

#### 1.3 Chained symbolic setters

The `Context` class's `withValue` method also accepts a context setter function as the first arguments, so symbolic setters can still be used with a chained syntax:

```ts
// Safe symbolic setters chained using withValue method of Context class
import { Logger, withLogger } from '.../logger';
import { Repo  , withRepo   } from '.../repo';

const [root, kill] = Context.cancel();
let ctx = root.withValue(withLogger, new Logger(root))
    ctx =  ctx.withValue(withRepo, new Repo(ctx))
              .withValue(withX, ...)
              .withValue(withY, ...);
```

### 2. Retrieving context

#### 2.1 Plain string keys
Context values can be retrieved with the `value(...)` method and plain string keys. This demonstrates the simplicity of the pattern, but in practice this is not the best approach due to potential key collision, and because we lose any static type checking on the return value.

```ts
// Plain string keys
function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promise<PizzaOrder> {
  const user = ctx.value('user');
  if (user == null) throw new NotAuthenticatedError();
  if (user as User == null) throw new Error('Invalid context user');
  
  const sec = ctx.value('security-service');
  if (sec == null) throw new Error('No security service');
  if (sec as SecurityService == null) throw new Error('Invalid security service');

  await sec.authorize(user, 'order-pizza');

  const repo = ctx.value('repo') as Repo ...;

  ...
}
```

#### 2.2 Symbolic getters
This is the complement to using a exported type-checked setter. An exported type-checked getter can use a private unexported `Symbol` for a key, and can guarantee the type of the returned value. Implemented getter functions should be allowed to return null or undefined.

```ts
// Safe symbolic getters
import { getUser, getSecSvc } from '.../security';
import { getRepo } from '.../repo';

function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promise<PizzaOrder> {
  // Type is guaranteed, by value may be null or not defined,
  // so if it is important that the value is non-null then
  // callers must still add their own null checks.
  const user = getUser(ctx);
  if (user == null) throw new NotAuthenticatedError();
  
  const sec = getSecSvc(ctx);
  if (sec == null) throw new Error('No security service');

  await sec.authorize(user, 'order-pizza');

  const repo = getRepo(ctx);
  if (repo == null) { ... }
  ...
}
```

#### 2.3 Symbolic getters with `require`


```ts
// Safe symbolic getters
import { getUser, getSecSvc } from '.../security';
import { getRepo } from '.../repo';

function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promise<PizzaOrder> {
  const [user, sec, repo] = ctx.require(
    getUser,
    getSecSvc,
    getRepo
  );

  await sec.authorize(user, 'order-pizza');
 
  ...
}
```

### 3. Defining getters and setters

The most effective way to use the context pattern is to define a pair of definitely-type getters and setters which internally use an unexported context key. A key benefit they provide is type safety. The getter and setter functions themselves can verify the the context value is of the correct type. In addition, both the static and instance `withValue` functions, as well as the instance `require` method, can propagate this type information.

```ts 
import { withValue } from '@sabl/context';

// Step 1: Unique symbol key, NOT exported
// JavaScript itself guarantees strict comparison of Symbol
// instances. This will not collide event with another symbol
// created from the same string.
const ctxKeyMyService = Symbol('my-service');

// Step 2: Exported setter function which uses unexported key
export function withMyService(ctx: IContext, svc: MyService): Context {
  return withValue(ctx, ctxKeyMyService, svc);
}

// Step 3: Exported getter function which uses unexported key
export function getMyService(ctx: IContext): MyService | null | undefined {
  return <MyService | null | undefined>ctx.value(ctxKeyMyService)
}
```

#### `Maybe<T>`

For convenience, this library also exports a type `Maybe<T>` which is a union of `T` with `null` and `undefined`:

```ts
export type Maybe<T> = T | null | undefined;
```

This can be used in the declaration of a context getter:

```ts
import { withValue, Maybe } from '@sabl/context';

... 

export function getMyService(ctx: IContext): Maybe<MyService> {
  return <Maybe<MyService>>ctx.value(ctxKeyMyService)
}
```

#### Type Information

With public key values, neither the runtime nor the compiler can check or guarantee the type of a context value:

```ts
// Compiler allows this, because withValue(...) takes any value
const ctx = withValue(parent, 'my-service', 'I am actually just a string');
...
// But we expect it to be a MyService instance:
const svc = ctx.value('my-service'); 

// Compiler won't allow, because return from ctx
await svc.listen();  // Fail
```

With the getter / setter pattern the compiler can enforce the type of the value provided to the setter, so it can in turn guarantee the type of a non-null return value from the getter. Optionally, the setter could also implement runtime checks to guarantee the value is of the correct type.

```ts
import { MyService, getMyService, withMyService } from './my-service';

/* Setter */
const svc = new MyService();

// In all three forms, the compiler will enforce that
// the item value (svc) is the correct type as declared
// by withMyService:

// Used as function directly
const ctx = withMyService(Context.background, svc);

// Used with root factory
const ctx = Context.value(withMyService, svc);

// Used with instance withValue
const ctx = Context.background.withValue(withMyService, svc);

...

/* Getter */

// In both forms, the compiler knows the correct return
// type as declared by getMyService:

// Used as function directly
const svc = getMyService(ctx);

// Used with require, which also narrows the type
// from T | null | undefined to just T
const svc = ctx.require(getMyService);
```