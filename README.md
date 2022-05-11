# sabl/js/context

[**sabl**](https://github.com/libsabl) is a open-source project to identify, describe, and implement effective software component patterns which solve small problems clearly, can be composed to solve big problems, and which work consistently across many programming langauges.

**context** is a sabl root pattern that provides a solution for state injection that is simple, extensible, and intrinsicly thread safe. It was first demonstrated in the now-canonical [`context` package](https://pkg.go.dev/context) of the [**go**](https://go.dev/doc/) standard library.

## Developer setup

See [SETUP.md](./SETUP.md), [CONFIG.md](./CONFIG.md).

## Contents

- [Basic API](#basic-icontext-interface)
  - [`IContext`](#basic-icontext-interface)
  - [`withValue`](#value-context)
  - [`withCancel`](#cancelable-context)
- [Immutability](#immutability)
  - [Overriding values](#overriding-values)
  - [Cascading cancellations](#cascading-cancellations)
- [Extended API](#context-class)
  - Instance [`withValue`](#withvalue), [`withCancel`](#withcancel)
  - Instance [`require`](#require)
  - Static `background`, `empty`, `value`, `cancel`
- Implementing getters and setters
- [Examples](#examples)


## Basic `IContext` interface
A `context` is a simple interface that allows for two operations:

- Retrieving a context value by its key
- Checking if the context is cancelable or canceled

The `IContext` interface:

```ts 
interface IContext {
  value(key: symbol | string): unknown;
  get canceler(): Canceler | null;
  get canceled(): boolean;
}
```

If the `canceler` of a context is null, then the context is not cancelable. The `Canceler` interface allows for registering a callback upon cancellation:

```ts
interface Canceler {
  canceled: boolean;
  onCancel(cb: () => void): void;
}
```

> **Note on naming**
>
> It is usually discouraged in TypeScript to prefix interfaces with `I` since classes and interfaces can be used interchangeably. In this case the interface is named `IContext` to distinguish it from the `Context` class, described below, which has additional methods. Custom implementations of `IContext` are allowed and need only implement the three members of `IContext`, not the additional members of the `Context` class. 
>

### Value context

The `withValue` function returns a child context with a value set. Note this function accepts any value that implements the minimal [`IContext` interface](#basic-context-interface) but it returns a concrete [`Context`](#extended-context-interface).

```ts
export function withValue(
  parent: IContext, 
  key: symbol | string, 
  value: unknown
): Context { ... }
```

### Cancelable context

The `withCancel` function returns a child cancelable context along with a function the can be called to cancel it. Note this function accepts any value that implements the minimal [`IContext` interface](#basic-icontext-interface) but returns a concrete [`Context`](#extended-context-interface).

```ts
export function withCancel(parent: IContext): [Context, CancelFunc] { ... }
```

## Immutability

### Overriding values

### Cascading cancellations

## `Context` class

This library defines `Context` as a concrete class which implements `IContext` but also provides several instance and static methods for convenient syntax and extensibility.

```ts
class Context implements IContext {
  // Base IContext inteface:
  value(key: Symbol | string): unknown { ... }
  get canceler(): Canceler | null { ... }
  get canceled(): boolean { ... }

  // =============================================
  //  Fluid instance syntax
  // =============================================

  /** Create a child context with the provided key and value */
  withValue(key: symbol | string, value: unknown): Context { ... }

  /** Create a new child context using the provided setter and value */
  withValue<T>(setter: ContextSetter<T>, item: T): Context { ... }

  /** Create a child cancelable context */
  withCancel(): Context { ... }

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
  //  Static factories
  // =============================================

  /** Get a simple root context */
  static get background(): Context { ... }

  /** Create a new root empty context with a name */
  static empty(name: string): Context { ... }

  /** Create a new root context with a value */
  static value(key: symbol | string, value: unknown): Context { ... }

  /** Create a new root context using the provided setter and value */
  static value<T>(setter: ContextSetter<T>, value: T): Context { ... }
   
  /** Create a new root cancelable context */
  static cancel(): [Context, CancelFunc] { ... }
}
```
### Instance methods
#### **withValue**
The `withValue` instance method of `Context` accepts either a literal key or a context setter function and a corresponding value. It can be used to chain assignments to add multiple context values. See [examples](#1-setting-up-context).

#### **withCancel**
The `withCancel` instance method of `Context` returns a child cancelable context along with a function that can be called to cancel it. It is a convenience alternative to calling the [`withCancel` function](#cancelable-context).

```ts
const ctx = Context.value('a', 1);

// Using withCancel function
const [child, cancel] = withCancel(ctx);

// Using withCancel method of Context, same effect:
const [child, cancel] = ctx.withCancel();
```

#### **require**
The `require` instance method of `Context` accepts one to six getter functions and returns the applicable retrieved values, while also guaranteeing that all returned values are non-null.

Following the established context pattern, getter functions **should not throw an error** if the requested value is null or undefined. This should be true for any implementations of the base `IContext.value(...)` method, as well as for any symbolic getter functions. 

Often, however, it is helpful to succinctly validate that one or more context values definitely are present and non-null. The `require` function of the `Context` class provides this. The arguments are one to six context getter functions, which also provide static type information to the TypeScript compiler. If only one getter function is used, the the resulting value is returned unwrapped. If more than one getter is used, then all the values are returned in an ordered array which can be desctructured. 

```ts
import { getUser } from '.../security';

function doStuff(ctx: Context) {
  // Works, but does not guarntee return value is not null
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

#### **background**
`Context.background` is an empty base context that can be used as a root context.

#### **empty**
`Context.empty` creates an empty root context with a custom name. The name of the context has no effect whatsoever except in the output of `toString`:

```js
console.log(`${Context.background}`);     // "context.Background"
console.log(`${Context.empty('root')}`);  // "context.root"
```

#### **value**
`Context.value` creates a root context with a key/value pair set. It accepts either a key literal or a context setter function, along with the value to set. Note the overload which accepts a setter function is generic and can enforce that the value is of the correct type.

```ts
const rootByString = Context.value('message', 'Hello');
const rootBySymbol = Context.value(Symbol('x'), 'y');
const rootBySetter = Context.value(withStartTime, new Date);
```

#### **cancel**
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
The approach usually used in go is to use private (unexported) key values with public (exported) getter and setter functions. The JavaScript `Symbol` type can be used to create private key values that will never collide. By itself this is an improvement in safety and type-checking over using plain string keys, but we lose the fluid or chained sytax.

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
function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promize<PizzaOrder> {
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

function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promize<PizzaOrder> {
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

function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promize<PizzaOrder> {
  const [user, sec, repo] = ctx.require(
    getUser,
    getSecSvc,
    getRepo
  );

  await sec.authorize(user, 'order-pizza');
 
  ...
}
```