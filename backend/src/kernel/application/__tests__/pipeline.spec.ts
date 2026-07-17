import { Pipeline } from '../pipeline/pipeline';
import { IMiddleware } from '../pipeline/middleware';

interface TestContext {
  logs: string[];
}

describe('Pipeline', () => {
  let pipeline: Pipeline<TestContext>;
  let context: TestContext;

  beforeEach(() => {
    pipeline = new Pipeline<TestContext>();
    context = { logs: [] };
  });

  it('should execute handler directly when no middleware', async () => {
    await pipeline.execute(context, async () => {
      context.logs.push('handler');
    });

    expect(context.logs).toEqual(['handler']);
  });

  it('should execute middleware before handler', async () => {
    const middleware: IMiddleware<TestContext> = {
      execute: async (ctx, next) => {
        ctx.logs.push('before');
        await next();
      },
    };

    pipeline.use(middleware);

    await pipeline.execute(context, async () => {
      context.logs.push('handler');
    });

    expect(context.logs).toEqual(['before', 'handler']);
  });

  it('should execute multiple middleware in order', async () => {
    const middleware1: IMiddleware<TestContext> = {
      execute: async (ctx, next) => {
        ctx.logs.push('m1-before');
        await next();
        ctx.logs.push('m1-after');
      },
    };

    const middleware2: IMiddleware<TestContext> = {
      execute: async (ctx, next) => {
        ctx.logs.push('m2-before');
        await next();
        ctx.logs.push('m2-after');
      },
    };

    pipeline.use(middleware1).use(middleware2);

    await pipeline.execute(context, async () => {
      context.logs.push('handler');
    });

    expect(context.logs).toEqual([
      'm1-before',
      'm2-before',
      'handler',
      'm2-after',
      'm1-after',
    ]);
  });

  it('should support fluent chaining', () => {
    const m1: IMiddleware<TestContext> = {
      execute: async (_ctx, next) => { await next(); },
    };
    const m2: IMiddleware<TestContext> = {
      execute: async (_ctx, next) => { await next(); },
    };

    const result = pipeline.use(m1).use(m2);

    expect(result).toBe(pipeline);
    expect(pipeline.count).toBe(2);
  });

  it('should allow middleware to short-circuit', async () => {
    const shortCircuit: IMiddleware<TestContext> = {
      execute: async (ctx, _next) => {
        ctx.logs.push('blocked');
        // Not calling next()
      },
    };

    pipeline.use(shortCircuit);

    await pipeline.execute(context, async () => {
      context.logs.push('handler');
    });

    expect(context.logs).toEqual(['blocked']);
  });
});
