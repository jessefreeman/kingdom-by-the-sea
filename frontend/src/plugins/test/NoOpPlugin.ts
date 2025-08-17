// No-op plugin for testing the engine

import type { EnginePlugin, EngineContext } from '../../engine/contracts/plugins';

export class NoOpPlugin implements EnginePlugin {
  id = 'kbts.noop.v1';
  version = '1.0.0';

  init(ctx: EngineContext): void {
    ctx.logger.info('NoOp plugin initialized');
  }

  start(ctx: EngineContext): void {
    ctx.logger.info('NoOp plugin started');
  }

  update(ctx: EngineContext, dt: number): void {
    // Log every 60 ticks (roughly 2 seconds at 30Hz)
    if (ctx.time.tick() % 60 === 0) {
      ctx.logger.debug(`NoOp plugin tick ${ctx.time.tick()}, dt: ${dt.toFixed(2)}ms`);
    }
  }

  stop(ctx: EngineContext): void {
    ctx.logger.info('NoOp plugin stopped');
  }

  dispose(ctx: EngineContext): void {
    ctx.logger.info('NoOp plugin disposed');
  }
}
