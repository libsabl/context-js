<!-- BEGIN:REMOVE_FOR_NPM -->
[![codecov](https://codecov.io/gh/libsabl/context-js/branch/main/graph/badge.svg?token=TVL1XYSJHA)](https://app.codecov.io/gh/libsabl/context-js/branch/main)
<span class="badge-npmversion"><a href="https://npmjs.org/package/@sabl/context" title="View this project on NPM"><img src="https://img.shields.io/npm/v/@sabl/context.svg" alt="NPM version" /></a></span>
<!-- END:REMOVE_FOR_NPM -->

# @sabl/context
 
**context** is a pattern for injecting state and dependencies and for propagating cancellation signals. It is simple, mechanically clear, and intrinsically safe for concurrent environments. It was first demonstrated in the [golang](https://go.dev/doc/) standard library [`context` package](https://pkg.go.dev/context). This package makes the same pattern available in TypeScript and JavaScript projects.

For more detail on the context pattern, see sabl / [patterns](https://github.com/libsabl/patterns#patterns) / [context](https://github.com/libsabl/patterns/blob/main/patterns/context.md).

<!-- BEGIN:REMOVE_FOR_NPM -->
> [**sabl**](https://github.com/libsabl/patterns) is an open-source project to identify, describe, and implement effective software patterns which solve small problems clearly, can be composed to solve big problems, and which work consistently across many programming languages.

## Full Docs

See [DOCS.md](./docs/DOCS.md)

## Developer orientation

See [SETUP.md](./docs/SETUP.md), [CONFIG.md](./docs/CONFIG.md).
<!-- END:REMOVE_FOR_NPM -->

## Usage - Context Values

1. Define a getter and setter

   You can use plain strings or public symbol keys with `withValue` and `value`, but using the following pattern is much better for both runtime and compile type safety:

   ```ts
   import { Maybe, IContext, Context, withValue } from '@sabl/context';
   import { MyService } from '$/services/my-service';

   // Do not export this value
   const ctxKeyMyService = Symbol('my-service');

   export function withMyService(ctx: IContext, svc: MyService):Context {
     return withValue(ctx, ctxKeyMyService, svc);
   }

   export function getMyService(ctx: IContext): Maybe<MyService> {
     return <Maybe<MyService>>ctx.value(ctxKeyMyService);
   }
   ```

2. Set up your context

   Contexts are immutable. You add values or cancelation by wrapping a parent context with `withValue` or `withCancel`.

   ```ts
   import { Context } from '@sabl/context';
   import { MyService, withMyService, Logger, withLogger } from '$/services';

   // Make a root cancelable context 
   const [root, kill] = Context.cancel();

   // Give to a new logger instance
   const logger = new Logger(root);

   // Create child context with the logger injected
   let ctx = root.withValue(withLogger, logger);

   // Feed that to a new MyService and attach MyService to 
   // a new child context
   ctx = ctx.withValue(withMyService, new MyService(ctx));

   // Chaining works too
   ctx = ctx.withValue(withUser, user)
            .withValue('plain-string', 'hello');
   ```

3. Retrieve a value

   ```ts
   import { getMyService, getLogger } from '$/services';

   export function exportData(ctx: Context, { /* other params */ }) {
     // Null is ok: Use getter directly
     let logger = getLogger(ctx);
     if (logger == null) {
       console.log('Warning: no logger. Falling back to console');
       logger = console;
     }

     // Null is not ok: Use require
     const svc = ctx.require(getMyService);

     // Check for cancelation if applicable
     if (ctx.canceled) {
       throw new Error('operation canceled');
     }

     /* ... do stuff with logger and svc ... */
   }
   ```

## Usage - Cancellation

Create a root cancelable context with static `Context.cancel()`, or wrap an existing context with `withCancel(ctx)`, which returns the child context along with a function that can be called to cancel it. 

Note that **all cancelable contexts must be canceled** even if their work completes successfully. See [**library docs**](./docs/DOCS.md#withcancel), [**pattern docs**](https://github.com/libsabl/patterns/blob/main/patterns/context.md#cancellation), original [**golang docs**](https://pkg.go.dev/context#WithCancel).

### Cascade cancellation

Cancellation of an ancestor context is immediately cascaded down to all descendant contexts. Cancellation of a descendant context does not bubble up to an ancestor context.

```ts
const [root  , cancel      ] = Context.cancel();
const [child , cancelChild ] = withCancel(root);
const [gChild, cancelGChild] = withCancel(child);

// Cancellations do not bubble up
cancelGChild();
console.log(gChild.canceled); // true
console.log(child.canceled);  // false
console.log(root.canceled);   // false

// Cancellations do cascade down
cancel();
console.log(child.canceled);  // true
console.log(root.canceled);   // true
```

### Check for cancellation errors

This library includes two Error types: `CanceledError` and `DeadlineError`. All `DeadlineError`s are also `CanceledError`s. Check whether an existing error or promise reject reason is due to cancellation using the static `CanceledError.is` and `DeadlineError.is` methods: 

```ts
async function calculate(ctx: IContext, matrix: number[][]): Promise<number> {
  try {
    return await superCalc(ctx, matrix);
  } catch (e) {
    if (DeadlineError.is(e)) {
      // Operation specifically canceled due to a timeout
      ...
    } else if (CanceledError.is(e)) {
      // Operation was canceled due to some other reason
      ...
    } else {
      // Something else went wrong
      ...
    }
  }
}
```

### Throw your own cancellation errors

Most existing libraries don't know about context. You can easily wrap an existing error or promise rejection reason with any of the following factory functions to create a `CanceledError` or `DeadlineError`:

```ts
CanceledError.as<T extends object>(reason: T): T
CanceledError.create(reason?: unknown): CanceledError

DeadlineError.as<T extends object>(reason: T): T
DeadlineError.create(reason?: unknown): DeadlineError
```

#### **`as`**

`as` requires a non-null input with `typeof === 'object'`. It decorates the object with a hidden property which is checked by `CanceledError.is` and `DeadlineError.is`.

```ts
const input = { name: 'my own object' };
const myError = CanceledError.as(input);
console.log(input === myError);         // true, it's the same object
console.log(CanceledError.is(myError)); // also true now
console.log(myError instanceof Error);  // false. It's the same plain object
```

#### **`create`**

`create` will wrap the input value, which may be null or undefined.

- If input is null or undefined, a new `CanceledError` or `DeadlineError` is created with a default message
- If input is as string, the string is used as the message for the new `CanceledError` or `DeadlineError`
- If input is an Error that is already a `CanceledError` or `DeadlineError`, that the input itself is returned
- If input is any other value with `typeof === 'object'` but is not a `CanceledError` or `DeadlineError`, then the input is used as the `cause` for a new `CanceledError` or `DeadlineError`
- Any other input is rejected

```ts
// Empty
const err0 = DeadlineError.create(); // Same as `new DeadlineError()`;
console.log(err0.message); // 'Context deadline was exceeded'

// From a string
const err1 = DeadlineError.create('a message');
console.log(err1.message); // 'a message'

// From a decorated Error
const err2in   = DeadlineError.as(new Error('my own error'));
const err2out  = DeadlineError.create(err2in);
console.log(err2in === err2out);  // 'true'. Returned the same object

// From any other 'object' type
for(let input of [
  new Error('my own error'),
  new Date(),
  { a: 'b' }
]) { 
  const err = DeadlineError.create(input);
  console.log(input === err);        // 'false'
  console.log(input === err.cause);  // 'true'
}
```

**Example: Wrapping errors as DeadlineError or CanceledError**

```ts
const promise = someLibrary.doAThing();
promise.catch((reason) => {
  if (reason && reason.code == someLibrary.ERR_TIMEOUT) {
    throw DeadlineError.create(reason)
  } else if (reason && reason.code == someLibrary.ERR_OP_CANCELED_1230) {
    throw CanceledError.create(reason)
  }
  throw reason;
})
```

## Example Use Cases

<!-- BEGIN:REMOVE_FOR_NPM -->
_**Full docs**: see [DOCS.md](./docs/DOCS.md)_
<!-- END:REMOVE_FOR_NPM -->

### Testing

Consolidating all service injection into a single context parameter makes it easy and simple to provide a real instance in production, but a mocked or instrumented instance in testing. No fancy dependency injection frameworks required.

*In production code*
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

// Attach context to each incoming request
app.use((req, res, next) => {
  return next(withContext(req, ctx), res);
})

/* -- export data route -- */ 
import { exportData } from '$/export-service'

app.use('data/export', async (req, res) => { 
  const exportParams = parseBody(req.body);
  const ctx = getContext(req);
  // Pass along context to service logic
  const data = await exportData(ctx, exportParams);
  res.json(data);
})
```

*In test code*

```ts
import { exportData } from '$/export-service'

describe('export-service', () => {
  describe('exportData', () => {
    it('logs record count', async () => {
      const mockRepo = new MockRepo();
      const logger   = new MockLogger();
      const ctx = Context.background.
        withValue(withRepo, mockRepo).
        withValue(withLogger, mockLogger).
        withValue(with..., new ...());

      mockRepo.mock('getRecords', () => {
        return [ ... ]
      })

      // Provide context with mocked / alternative 
      // services to method under test
      await exportData(ctx, {
        format: 'csv', 
        paginate: false
      });

      expect(mockLogger.messages).toContain('Exported 5 records');
    })
  })
})
```

### Proxy authentication

A common item to inject in a context is the current authenticated user. This makes it easy to inject fake or test users in testing, but it also makes it easy to implement proxy authentication in production scenarios, such as allowing admins to interact with an application as another user in order to reproduce an issue exactly as the target user sees it.

```ts
app.use(async (req, res, next) => {
  const proxyUserId = eq.headers['X-Proxy-User'];

  if(!proxyUserId || !proxyUserId.length)
    return next(req, res);
   
  const ctx = req.context as Context;

  // Get already authenticated user from incoming context
  const realUser = getUser(ctx);
  if(realUser == null) {
    throw new SecurityError('No underlying user authenticated');
  };

  // Get needed service from context
  const secSvc = ctx.require(getSecSvc);
  const targetUser = await secSvc.findUser(proxyUserId);
  if(targetUser == null) {
    throw new SecurityError('Target user does not exist');
  }

  const ok = await secSvc.canProxy(realUser, targetUser);
  if(!ok) { 
    throw new SecurityError(
      `User ${realUser.userName} not authorized to proxy user ${targetUser.userName}`
    );
  } 

  // Continue pipeline with augmented context and request
  const childCtx = ctx.
    withValue(withUser, targetUser).      // Replace User with proxied target user
    withValue(withRealUser, realUser).    // But also attach real user as RealUser
    withValue(withIsProxied, true);       // And flag that context is proxied

  return next(req.withContext(childCtx), res);
})
```

### Database Transactions

Occasionally a code path requires several successive database actions to succeed or fail together in a transaction. This becomes especially tricky if the same code path might sometimes be executed within a transaction while other times not, or when a code path could result in a nested attempts to initiate a remote connection. All of this can be greatly simplified in code that needs to execute database calls by injecting the transaction, if any, in the context. 

```ts
async function addItemRecord(ctx: Context, { /* other params */ }) {
  await execTxn(ctx, async (ctx, qry) => {
    /* do something with inner ctx and qry, 
       which execute in a database transaction */

    // Within this transaction, call another method 
    // which may itself include a transaction:
    await addItemStock(ctx, { /* ... */ });
  });
}

async function addItemStock(ctx: Context, { /* other params */ }) {
  await execTxn(ctx, async (ctx, qry) => {
    /* do something with inner ctx and qry, 
       which execute in a database transaction */
  });
}
 
// Generic implementation of execTxn with simple RDB interfaces:
interface Query {
  async query(ctx: Context, sql: string, params: ...): Promise<...>;
  async exec(ctx: Context, sql: string, params: ...): Promise<number>; 
}
 
interface Db extends Query {
  async beginTxn(ctx: Context): Promise<DbTxn>;
}

interface DbTxn extends Query {
  async commit(): Promise<void>;
  async rollback(): Promise<void>;
}
 
type QueryFunc = (ctx: Context, qry: Query) => Promise<void>;

async function execTxn(ctx: Context, fn: QueryFunc) {
  let txn = getDbTxn(ctx);
  if(txn != null) { 
    // Already in a transaction. Execute the callback within this one
    return fn(ctx, txn);
  }

  const db = ctx.require(getDb);
  txn = await db.beginTxn(ctx);
  try {
    const txnCtx = ctx.withValue(withDbTxn, txn);
    await fn(txnCtx, txn);
    await txn.commit();
  } catch {
    await txn.rollback();
    throw;
  }
}
```