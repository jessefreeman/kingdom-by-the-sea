// Plugin system contracts

export interface EngineContext {
  engine: Engine;
  events: EventBus;
  services: ServiceLocator;
  logger: Logger;
  rng: RNG;
  time: Time;
  state: StateStore<any>;
  config: Record<string, unknown>;
}

export interface EnginePlugin {
  id: string; // unique, e.g., "kbts.rules.v1"
  version: string; // semver
  requires?: string[]; // plugin or service ids
  provides?: string[]; // services or capabilities
  
  init(ctx: EngineContext): void | Promise<void>; // register services, events
  start?(ctx: EngineContext): void; // engine started
  update?(ctx: EngineContext, dt: number): void; // fixed tick
  render?(ctx: EngineContext, alpha: number): void; // optional (renderer uses)
  stop?(ctx: EngineContext): void; // engine stopped
  dispose?(ctx: EngineContext): void; // cleanup
}

export interface RendererPlugin extends EnginePlugin {
  kind: 'renderer';
  mount(target: HTMLElement): void;
  resize?(w: number, h: number): void;
  getCanvas?(): HTMLCanvasElement | null;
}

export interface EngineOptions {
  seed?: string | number;
  timestepMs?: number; // default 33.333 (30 Hz) or 16.667 (60 Hz)
  plugins: EnginePlugin[];
  services?: Record<string, unknown>; // prebound services
  config?: Record<string, unknown>;
}

// Core service interfaces
export interface EventBus {
  publish<T = unknown>(topic: string, payload?: T): void;
  subscribe<T = unknown>(topic: string, handler: (payload: T) => void): () => void; // returns unsubscribe
  once<T = unknown>(topic: string, handler: (payload: T) => void): () => void;
  clear(): void;
}

export interface ServiceLocator {
  get<T>(id: string): T;
  provide<T>(id: string, service: T): void;
  has(id: string): boolean;
  remove(id: string): boolean;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface RNG {
  seed(value: string | number): void;
  next(): number; // [0, 1)
  nextInt(min: number, max: number): number; // [min, max]
  nextFloat(min: number, max: number): number; // [min, max)
  chance(probability: number): boolean;
  pick<T>(array: T[]): T;
  shuffle<T>(array: T[]): T[];
}

export interface Time {
  now(): number; // current time in ms
  tick(): number; // current tick count
  delta(): number; // time since last tick in ms
  tickDelta(): number; // fixed timestep in ms
}

export interface StateStore<T> {
  get(): T;
  set(state: T): void;
  patch(updates: Partial<T>): void;
  snapshot(): string; // serialized state
  restore(snapshot: string): void;
  subscribe(handler: (state: T) => void): () => void;
}

export interface Engine {
  init(): Promise<void>;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isRunning(): boolean;
  getState<T>(): T;
  setState<T>(state: T): void;
}

// Event topics (constants)
export const ENGINE_EVENTS = {
  INIT: 'engine.init',
  START: 'engine.start',
  STOP: 'engine.stop',
  TICK: 'engine.tick',
  SNAPSHOT: 'engine.snapshot',
} as const;

export const INPUT_EVENTS = {
  MOUSE_DOWN: 'input.mouse.down',
  MOUSE_UP: 'input.mouse.up',
  MOUSE_MOVE: 'input.mouse.move',
  KEY_DOWN: 'input.key.down',
  KEY_UP: 'input.key.up',
  WHEEL: 'input.wheel',
} as const;

export const MAP_EVENTS = {
  TILE_CHANGED: 'map.tile.changed',
  CHUNK_LOADED: 'map.chunk.loaded',
  CHUNK_UNLOADED: 'map.chunk.unloaded',
} as const;

export const ENTITY_EVENTS = {
  CREATED: 'entity.created',
  UPDATED: 'entity.updated',
  REMOVED: 'entity.removed',
} as const;

export const WORLDGEN_EVENTS = {
  START: 'worldgen.start',
  PROGRESS: 'worldgen.progress',
  DONE: 'worldgen.done',
} as const;

export const RENDER_EVENTS = {
  REQUEST: 'render.request',
  AFTER: 'render.after',
} as const;
