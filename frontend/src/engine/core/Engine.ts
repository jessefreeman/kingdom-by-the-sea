// Main engine implementation

import type { 
  Engine, 
  EngineOptions, 
  EngineContext, 
  EnginePlugin
} from '../contracts/plugins';

import type { GameState } from '../contracts/types';

import { SimpleEventBus } from './EventBus';
import { SimpleServiceLocator } from './Services';
import { SimpleStateStore } from './StateStore';
import { EngineTime } from './Time';
import { SeededRNG } from './RNG';
import { ConsoleLogger } from './Logger';
import { ENGINE_EVENTS } from '../contracts/plugins';

export class GameEngine implements Engine {
  private options: EngineOptions;
  private context: EngineContext;
  private plugins: EnginePlugin[] = [];
  private running: boolean = false;
  private paused: boolean = false;
  private animationFrame: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;

  constructor(options: EngineOptions) {
    this.options = {
      timestepMs: 33.333, // 30 Hz default
      seed: Date.now(),
      services: {},
      config: {},
      ...options,
    };

    // Create core services
    const events = new SimpleEventBus();
    const services = new SimpleServiceLocator();
    const logger = new ConsoleLogger('KBTS');
    const rng = new SeededRNG(this.options.seed!);
    const time = new EngineTime(this.options.timestepMs);
    
    // Create initial state
    const seedValue = typeof this.options.seed === 'string' ? 
      this.hashStringSeed(this.options.seed) : 
      this.options.seed!;
    
    const initialState: GameState = {
      seed: seedValue,
      tick: 0,
      map: {
        width: 10,
        height: 8,
        cells: [],
      },
      resources: {
        gold: 3,
        food: 3,
        wood: 2,
        people: 3,
        actions: 3,
      },
      game: {
        year: 1,
        sel: null,
        fogEnabled: true,
      },
      entities: {},
    };
    
    const state = new SimpleStateStore(initialState);

    // Register core services
    services.provide('events', events);
    services.provide('logger', logger);
    services.provide('rng', rng);
    services.provide('time', time);
    services.provide('state', state);

    // Add any prebound services
    if (this.options.services) {
      for (const [id, service] of Object.entries(this.options.services)) {
        services.provide(id, service);
      }
    }

    // Create context
    this.context = {
      engine: this,
      events,
      services,
      logger,
      rng,
      time,
      state,
      config: this.options.config!,
    };

    this.plugins = [...this.options.plugins];
    
    logger.info('Engine created', { 
      seed: this.options.seed,
      timestepMs: this.options.timestepMs,
      pluginCount: this.plugins.length 
    });
  }

  async init(): Promise<void> {
    this.context.logger.info('Initializing engine...');
    this.context.events.publish(ENGINE_EVENTS.INIT, { engine: this });

    // Initialize plugins in dependency order (simplified for now)
    for (const plugin of this.plugins) {
      this.context.logger.debug(`Initializing plugin: ${plugin.id} v${plugin.version}`);
      
      // Check dependencies (simplified)
      if (plugin.requires) {
        for (const required of plugin.requires) {
          if (!this.context.services.has(required)) {
            throw new Error(`Plugin ${plugin.id} requires service "${required}" but it was not found`);
          }
        }
      }

      try {
        await plugin.init(this.context);
        this.context.logger.debug(`Plugin ${plugin.id} initialized successfully`);
      } catch (error) {
        this.context.logger.error(`Failed to initialize plugin ${plugin.id}:`, error);
        throw error;
      }
    }

    this.context.logger.info('Engine initialization complete');
  }

  start(): void {
    if (this.running) {
      this.context.logger.warn('Engine is already running');
      return;
    }

    this.context.logger.info('Starting engine...');
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;

    // Notify plugins
    for (const plugin of this.plugins) {
      if (plugin.start) {
        plugin.start(this.context);
      }
    }

    this.context.events.publish(ENGINE_EVENTS.START, { engine: this });
    
    // Start the game loop
    this.loop();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.context.logger.info('Stopping engine...');
    this.running = false;
    this.paused = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Notify plugins
    for (const plugin of this.plugins) {
      if (plugin.stop) {
        plugin.stop(this.context);
      }
    }

    this.context.events.publish(ENGINE_EVENTS.STOP, { engine: this });
  }

  pause(): void {
    if (!this.running || this.paused) {
      return;
    }

    this.context.logger.info('Pausing engine...');
    this.paused = true;
  }

  resume(): void {
    if (!this.running || !this.paused) {
      return;
    }

    this.context.logger.info('Resuming engine...');
    this.paused = false;
    this.lastTime = performance.now(); // Reset timing to avoid large delta
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  getState<T>(): T {
    return this.context.state.get() as T;
  }

  setState<T>(state: T): void {
    this.context.state.set(state as any);
  }

  private loop(): void {
    if (!this.running) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    if (!this.paused) {
      // Fixed timestep simulation with accumulator
      this.accumulator += deltaTime;
      
      const timestep = this.context.time.tickDelta();
      
      while (this.accumulator >= timestep) {
        this.update(timestep);
        this.accumulator -= timestep;
        (this.context.time as EngineTime).advanceTick();
      }

      // Render with interpolation alpha
      const alpha = this.accumulator / timestep;
      this.render(alpha);
    }

    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  private update(dt: number): void {
    // Update tick in state
    const currentState = this.context.state.get();
    currentState.tick = this.context.time.tick();
    this.context.state.set(currentState);

    // Update plugins
    for (const plugin of this.plugins) {
      if (plugin.update) {
        plugin.update(this.context, dt);
      }
    }

    // Publish tick event
    this.context.events.publish(ENGINE_EVENTS.TICK, { 
      tick: this.context.time.tick(),
      dt 
    });
  }

  private render(alpha: number): void {
    // Render plugins
    for (const plugin of this.plugins) {
      if (plugin.render) {
        plugin.render(this.context, alpha);
      }
    }
  }

  // Debug utilities
  getContext(): EngineContext {
    return this.context;
  }

  getPlugins(): EnginePlugin[] {
    return [...this.plugins];
  }

  private hashStringSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
