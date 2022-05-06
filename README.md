# sabl/js/context

[**sabl**](https://github.com/libsabl) is a open-source project to identify, describe, and implement effective software component patterns which solve small problems clearly, can be composed to solve big problems, and which work consistently across many programming langauges.

**context** is a sabl root pattern that provides a solution for state injection that is simple, extensible, and intrinsicly thread safe. It was first demonstrated in the now-canonical [`context` package](https://pkg.go.dev/context) of the [**go**](https://go.dev/doc/) standard library.

## Developer setup

See [SETUP.md](./SETUP.md), [CONFIG.md](./CONFIG.md).

## Contents

- Basic API
  - [`IContext`](#basic-icontext-interface)
  - [`withValue`](#value-context)
  - [`withCancel`](#cancelable-context)
- Extended API
  - Instance `withValue`, `withCancel`
  - Static `background`, `empty`, `value`, `cancel`
  - Static `use` and fluid builder extensibility
- Immutability
  - Value overriding
  - Cascading cancellations
- Implementing getters and setters
- [Examples](#examples)


## Usage
 
A context is a simple thread-safe solution to injecting state and dependencies across API boundaries. A single `context` value is generally provided to functions as the first argument, followed by other function-specific arguments. Consuming code can than retrieve needed values or services from the context, can check for operation cancellation, or can wrap the provided context with additional values or cancellation signals and provide to downstream functions.


### Basic `IContext` interface
A `context` is a simple interface that allows for two operations:

- Retrieving a context value by its key
- Checking if the context is cancelable or canceled

The `IContext` interface:

```ts
// Note: Named IContext to distinguish from larger 
// Context class, which has several additional APIs
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

### Value context

The `withValue` function is an exact equivalent of go's [WithValue](https://pkg.go.dev/context#WithValue), and returns a child context with a value set. Note this function accepts any value that implements the minimal [`IContext` interface](#basic-context-interface) but returns a concrete [`Context`](#extended-context-interface).


```ts
export function withValue(
  parent: IContext, 
  key: symbol | string, 
  value: unknown
): Context { ... }
```

### Cancelable context

The `withCancel` function is an exact equivalent of go's [WithCancel](https://pkg.go.dev/context#WithCancel), and returns a child cancelable context along with a function the can be called to cancel it. Note this function accepts any value that implements the minimal [`IContext` interface](#basic-context-interface) but returns a concrete [`Context`](#extended-context-interface).

```ts
export function withCancel(parent: IContext): [Context, CancelFunc] { ... }
```

### Extended `Context` interface

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

  /** Create a child context with the provided value set */
  withValue(key: Symbol | string, value: unknown): Context { ... }

  /** Create a child cancelable context */
  withCancel(): Context { ... }

  // =============================================
  //  Static factories
  // =============================================

  /** Get a simple root context */
  static get background(): Context { ... }

  /** Create a root empty context with a name */
  static empty(name: string): Context { ... }

  /** Create a root context with a value */
  static value(key: Symbol | string, value: unknown): Context { ... }

  /** Create a root cancelable context */
  static cancel(): [Context, CancelFunc] { ... }

  // =============================================
  // Static chained getter / setter registration
  // =============================================
  
  /** Register a new context value getter and setter */
  static use<T>(
    prop: string,
    getter: ContextGetter<T>,
    setter: ContextSetter<T>,
    defineReq: boolean = false
  ) { ... }
}
```

#### Chained withValue, withCancel
The instance `withValue` and `withCancel` methods allow chained syntax for setting multiple values, and also make both methods available on any `Context` instance without having to explicitly import the `withValue` and `withCancel` functions.

#### Static factory methods
The static `Context.background` property is the exact equivalent of go's [`context.Background()`](https://pkg.go.dev/context#Background). This libary also provides the static factory methods `empty`, `value`, and `cancel` for creating root contexts. These are especially useful for creating root contexts in unit testing scenarios.

#### Static `Context.use`



## Examples

### 1. Setting up context

#### 1.1 Plain string keys
Context values can be set with the `withValue` method and plain string keys. This demonstrates the simplicity of the pattern. In practice, it is preferable to use unexported `symbol` keys with exported getter and setter functions.

```ts
// Plain string keys 
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

#### 1.3 Chained symbolic getters and setters

TypeScript declarations and a call to `Context.use` can be used to bind the symbolic getters and setters to the prototype of the `Context` class. This adds support for a chained `.with*` and `.get*` syntax both for static type-checking and runtime invocation:

```ts
// Safe symbolic setters and Context.use extensibility
import { Logger } from '.../logger';
import { Repo   } from '.../repo';

const [root, kill] = Context.background.withCancel();
let ctx = root.withLogger(new Logger(root))
    ctx =  ctx.withRepo  (new Repo(ctx))
              .withX     (...)
              .withY     (...);
```

### 2. Retrieving context

#### 2.1 Plain string keys
Context values can be retrieved with the basic `value(...)` method and plain string keys. This demonstrates the simplicity of the pattern, but in practice this is not the best approach due to potential key collision, and because we lose any static type checking on the return value.

```ts
// Plain string keys
function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promize<PizzaOrder> {
  const user = ctx.value('user');
  if (user null) throw new NotAuthnticatedError();
  if (user as User == null) throw new Error('Invalid context user');
  
  const sec = ctx.value('security-service');
  if (sec == null) throw new Error('No security service');
  if (sec as SecurityService == null) throw new Error('Invalid security service');

  await sec.authorize(user, 'order-pizza');

  const repo = ctx.value('repo') as Repo ...;

  ...
}
```

#### 2.2 Non-chained symbolic getters
This is the complement to using a exported type-checked setter. An exported type-checked getter can use a private unexported `Symbol` for a key, and can guarantee the type of the returned value. Implemented getter functions called `get*` should be allowed to return null or undefined, while getter functions called `req*` should guarantee that they return non-null values, and should throw errors if no value was available.

```ts
// Safe symbolic getters
import { getUser, reqUser, reqSecSvc } from '.../security';
import { getRepo } from '.../repo';

function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promize<PizzaOrder> {
  // get** pattern: Value may be null or not defined,
  // so if it is important that the value is non-null then
  // callers must add their own null checks.
  const user = getUser(ctx);
  if (user == null) throw new NotAuthnticatedError();

  // req** pattern: Will throw error if value is null or undefined,
  // so callers are guaranteed a non-null value
  const user = reqUser(ctx);
  
  const sec = reqSecSvc(ctx);

  await sec.authorize(user, 'order-pizza');

  const repo = getRepo(ctx);
  if (repo == null) { ... }
  ...
}
```

#### 2.3 Chained symbolic getters
TypeScript declartions and a call to `Context.use` can be used to bind the symbolic gettes and setters to the prototype of the `Context` class. This adds support for a chained `.with*` and `.get*` syntax both for static type-checking and runtime invocation. 

```ts
// Ensure safe getters are imported / loaded
import '.../security';
import '.../repo';

function orderPizza(ctx: Context, size: int, toppings: Topping[]) : Promize<PizzaOrder> {
  // get** pattern: Value may be null or not defined,
  // so if it is important that the value is non-null then
  // callers must add their own null checks.
  const user = ctx.getUser();
  if (user == null) throw new NotAuthnticatedError();

  // req** pattern: Will throw error if value is null or undefined,
  // so callers are guaranteed a non-null value
  const user = ctx.reqUser(); 
  const sec  = ctx.reqSecSvc();

  await sec.authorize(user, 'order-pizza');

  const repo = ctx.getRepo();
  if (repo == null) { ... }
  ...
}
```
