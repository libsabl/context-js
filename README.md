[![codecov](https://codecov.io/gh/libsabl/context-js/branch/main/graph/badge.svg?token=TVL1XYSJHA)](https://codecov.io/gh/libsabl/context-js)

# sabl/js/context

[**sabl**](https://github.com/libsabl) is an open-source project to identify, describe, and implement effective software component patterns which solve small problems clearly, can be composed to solve big problems, and which work consistently across many programming langauges.

**context** is a sabl root pattern that provides a solution for state injection that is simple, extensible, and intrinsicly thread safe. It was first demonstrated in the golang [`context` package](https://pkg.go.dev/context) which is now part of the [**go**](https://go.dev/doc/) standard library.

<!-- BEGIN:REMOVE_FOR_NPM -->
## Full Docs

See [DOCS.md](./docs/DOCS.md)

## Developer orientation

See [SETUP.md](./docs/SETUP.md), [CONFIG.md](./docs/CONFIG.md).
<!-- END:REMOVE_FOR_NPM -->

## Usage

1. Define a getter and setter

   You can also use plain strings or public symbol keys with `withValue` and `value`, but using the following pattern is much better for both runtime and compile type safety:

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