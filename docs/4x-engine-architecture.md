# Kingdom by the Sea - Game Engine Architecture

This document describes the current modular 4X game engine architecture implemented in Kingdom by the Sea. The engine features a small Core with a robust Plugin system, providing clean separation of concerns, testability, determinism, and extensibility.

## Architecture Overview

The engine has been successfully refactored from a monolithic structure into a modular system that supports:

- ✅ **Modular Core Engine** - Manages game loop, events, services, and plugin lifecycle
- ✅ **Multiple Renderer Support** - Swappable 2D Canvas and 3D Three.js renderers
- ✅ **Plugin-based Architecture** - Encapsulated worldgen, rendering, and game systems
- ✅ **Deterministic Simulation** - Seeded RNG for reproducible gameplay
- ✅ **Event-driven Communication** - Decoupled plugin interactions

## Current Implementation Status

### ✅ Core Engine Components (Implemented)

Located in `frontend/src/engine/core/`:

- **`Engine.ts`** - Main game engine with fixed-timestep loop (30Hz simulation, interpolated rendering)
- **`EventBus.ts`** - Pub/sub event system for decoupled plugin communication
- **`Services.ts`** - Service locator for dependency injection between plugins
- **`StateStore.ts`** - Serializable state management with snapshots and change tracking
- **`Time.ts`** - Fixed-timestep timing service with tick counting and delta calculations
- **`RNG.ts`** - Deterministic seeded random number generator using xorshift32
- **`Logger.ts`** - Leveled logging service (debug/info/warn/error)

### ✅ Plugin System (Implemented)

Located in `frontend/src/plugins/`:

#### Core Plugins
- **`core/`** - Foundation plugins for engine coordination and API exposure
  - `ServiceCoordinationPlugin.ts` - Manages inter-plugin service dependencies
  - `GlobalAPIPlugin.ts` - Exposes engine APIs to global scope for debugging
  - `PluginCoordinationPlugin.ts` - Coordinates plugin lifecycle management

#### Renderer Plugins
- **`renderer/canvas2d/Canvas2DRenderer.ts`** - Lightweight 2D Canvas renderer
- **`renderer/three/ThreeRenderer.ts`** - Advanced 3D renderer using Three.js
- Both renderers support runtime switching and maintain identical game state display

#### Worldgen Plugins
- **`worldgen/islands/IslandWorldgen.ts`** - Procedural island generation with configurable parameters
- Supports multiple world sizes (small 16x12, medium 20x16, large 30x20)
- Deterministic generation using seeded RNG

#### Business Logic Plugins
- **`business/GameBusinessLogicPlugin.ts`** - Core game rules and simulation logic
- **`rules/core/CoreRulesPlugin.ts`** - Fundamental game mechanics and validation

#### Utility Plugins
- **`ui/GameUIPlugin.ts`** - User interface management
- **`ui/GameHUDPlugin.ts`** - Heads-up display and overlays
- **`input/GameInputPlugin.ts`** - Input handling and event routing

### ✅ Services and Utilities

Located in `frontend/src/engine/services/` and `frontend/src/engine/utilities/`:

- **`tileAtlas.ts`** - Tile texture atlas management for efficient rendering
- **`tileAtlasPreloader.ts`** - Runtime atlas generation from individual textures
- **`autotile.ts`** - Coastline auto-tiling algorithms for seamless water/land transitions
- **`WorldGenService.ts`** - World generation coordination service
- **`TerrainEditingService.ts`** - Terrain modification and height system management

## Architecture Deep Dive

### Core Engine Responsibilities

The `GameEngine` class coordinates the entire system:

- **Plugin Lifecycle** - Initialize, start, update, and dispose plugins in proper order
- **Fixed-Timestep Simulation** - 30Hz game logic updates independent of rendering framerate
- **Event Coordination** - Route events between plugins via the central event bus
- **Service Management** - Provide dependency injection for shared services
- **State Persistence** - Manage serializable game state with snapshot support
- **Deterministic Timing** - Ensure reproducible simulation via seeded RNG and fixed timesteps

### Plugin Contract

All plugins implement the `EnginePlugin` interface:

```typescript
export interface EnginePlugin {
  id: string;                                    // unique identifier, e.g., "kbts.worldgen.v1"
  version: string;                               // semantic version
  requires?: string[];                           // dependent plugin/service IDs
  provides?: string[];                           // services this plugin exposes
  
  init(ctx: EngineContext): void | Promise<void>; // setup phase
  start?(ctx: EngineContext): void;             // engine started
  update?(ctx: EngineContext, dt: number): void; // fixed-tick simulation
  render?(ctx: EngineContext, alpha: number): void; // interpolated rendering
  stop?(ctx: EngineContext): void;              // engine stopped  
  dispose?(ctx: EngineContext): void;           // cleanup phase
}

export interface EngineContext {
  engine: Engine;           // engine control methods
  events: EventBus;         // pub/sub messaging
  services: ServiceLocator; // dependency injection
  logger: Logger;           // leveled logging
  rng: RNG;                // deterministic random
  time: Time;              // timing services
  state: StateStore<any>;  // game state management
  config: Record<string, unknown>; // configuration
}
```

### Renderer Plugin Extension

Renderer plugins extend the base interface with display-specific methods:

```typescript
export interface RendererPlugin extends EnginePlugin {
  kind: 'renderer';
  mount(target: HTMLElement): void;          // attach to DOM element
  resize?(w: number, h: number): void;       // handle viewport changes
  getCanvas?(): HTMLCanvasElement | null;    // access underlying canvas
}
```

## Event System Architecture

The event bus enables decoupled communication between plugins. Standard event topics include:

### Engine Events
- `engine.init` - Engine initialization complete
- `engine.start` - Engine started
- `engine.stop` - Engine stopped  
- `engine.tick` - Fixed timestep tick
- `engine.snapshot` - State snapshot created

### Input Events
- `input.mouse.down` - Mouse button pressed
- `input.mouse.move` - Mouse movement
- `input.key.down` - Keyboard key pressed
- `input.key.up` - Keyboard key released

### Game Events
- `map.tile.changed` - Tile state modified
- `worldgen.start` - World generation started
- `worldgen.progress` - Generation progress update
- `worldgen.done` - World generation complete

## State Management and Serialization

The engine uses a modern `GameState` interface that is fully serializable:

```typescript
export interface GameState {
  seed: number;           // Random seed for deterministic behavior
  tick: number;           // Current simulation tick
  map: {
    width: number;
    height: number;
    cells: Cell[];        // Flat array of map cells
  };
  resources: {
    gold: number;
    food: number;
    wood: number;
    people: number;
    actions: number;
  };
  game: {
    year: number;
    sel: number | null;   // Selected tile index
    fogEnabled: boolean;
  };
  entities: Record<string, Entity>; // Future extensibility
}
```

### State Features

- **Deterministic** - All randomness controlled by seeded RNG
- **Serializable** - JSON-compatible for save/load functionality
- **Versioned** - Snapshot support for undo/redo and debugging
- **Reactive** - Change subscriptions for UI updates
- **Migration Ready** - Conversion utilities for legacy formats

### Backward Compatibility

The engine maintains compatibility with the original monolithic code through conversion utilities:
- `legacyToGameState()` - Convert old state format to new
- `gameStateToLegacy()` - Convert new state format to old

## How to Use the Engine

### Basic Setup

```typescript
import { GameEngine } from './engine';
import { Canvas2DRenderer } from './plugins/renderer/canvas2d/Canvas2DRenderer';
import { IslandWorldgenPlugin } from './plugins/worldgen/islands/IslandWorldgen';

const engine = new GameEngine({
  seed: 'my-game-seed',
  timestepMs: 33.333, // 30 Hz simulation
  plugins: [
    new Canvas2DRenderer(),
    new IslandWorldgenPlugin(),
    // Add more plugins as needed
  ],
  config: {
    worldSize: 'medium', // small, medium, large
    debug: true
  }
});

// Mount to DOM element
const gameContainer = document.getElementById('game');
await engine.init();
engine.start();

// Access engine services
const renderer = engine.services.get('renderer');
const worldgen = engine.services.get('worldgen');
```

### Runtime Renderer Switching

```typescript
// Switch from 2D to 3D renderer
const threeRenderer = new ThreeRenderer();
await engine.switchRenderer(threeRenderer);
```

### Event Handling

```typescript
// Listen for game events
engine.events.subscribe('worldgen.done', (mapData) => {
  console.log('World generation complete:', mapData);
});

// Trigger custom events
engine.events.publish('game.pause', { reason: 'user-request' });
```

## How to Extend the Engine

### Creating a New Plugin

1. **Implement the EnginePlugin interface:**

```typescript
export class MyCustomPlugin implements EnginePlugin {
  id = 'my-custom-plugin.v1';
  version = '1.0.0';
  requires = ['core-service']; // Optional dependencies
  provides = ['my-service'];   // Services this plugin exposes

  async init(ctx: EngineContext): Promise<void> {
    // Register services and event handlers
    ctx.services.provide('my-service', new MyService());
    
    ctx.events.subscribe('engine.tick', this.onTick.bind(this));
  }

  start(ctx: EngineContext): void {
    ctx.logger.info('MyCustomPlugin started');
  }

  update(ctx: EngineContext, dt: number): void {
    // Fixed-timestep simulation updates
  }

  render(ctx: EngineContext, alpha: number): void {
    // Interpolated rendering (optional)
  }

  dispose(ctx: EngineContext): void {
    // Cleanup resources
  }

  private onTick(payload: any): void {
    // Handle engine tick events
  }
}
```

2. **Register the plugin:**

```typescript
const engine = new GameEngine({
  plugins: [
    new MyCustomPlugin(),
    // ... other plugins
  ]
});
```

### Creating a Custom Renderer

Renderer plugins extend the base interface with display-specific methods:

```typescript
export class MyRendererPlugin implements RendererPlugin {
  kind = 'renderer' as const;
  id = 'my-renderer.v1';
  version = '1.0.0';
  
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  async init(ctx: EngineContext): Promise<void> {
    ctx.services.provide('renderer', this);
  }

  mount(target: HTMLElement): void {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    target.appendChild(this.canvas);
  }

  render(ctx: EngineContext, alpha: number): void {
    const state = ctx.state.get();
    // Custom rendering logic using state data
    this.drawMap(state.map);
  }

  resize(w: number, h: number): void {
    if (this.canvas) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas || null;
  }

  private drawMap(map: any): void {
    // Implement custom map rendering
  }
}
```

### Adding Custom Services

Services provide shared functionality across plugins:

```typescript
class MyDataService {
  private data: Map<string, any> = new Map();

  store(key: string, value: any): void {
    this.data.set(key, value);
  }

  retrieve(key: string): any {
    return this.data.get(key);
  }
}

// Register in plugin init
ctx.services.provide('data-service', new MyDataService());

// Use in other plugins
const dataService = ctx.services.get<MyDataService>('data-service');
```

## File Structure

```
frontend/src/
├── engine/
│   ├── index.ts              # Engine exports
│   ├── core/                 # Core engine components
│   │   ├── Engine.ts         # Main game engine
│   │   ├── EventBus.ts       # Pub/sub messaging
│   │   ├── Services.ts       # Dependency injection
│   │   ├── StateStore.ts     # State management
│   │   ├── Time.ts           # Timing services
│   │   ├── RNG.ts            # Deterministic random
│   │   └── Logger.ts         # Logging service
│   ├── contracts/            # Type definitions
│   │   ├── plugins.ts        # Plugin interfaces
│   │   └── types.ts          # Game state types
│   ├── services/             # Shared services
│   │   ├── tileAtlas.ts      # Texture management
│   │   ├── WorldGenService.ts # World generation
│   │   └── TerrainEditingService.ts
│   └── utilities/            # Utility functions
│       └── autotile.ts       # Auto-tiling algorithms
└── plugins/                  # Plugin implementations
    ├── index.ts              # Plugin exports
    ├── core/                 # Foundation plugins
    ├── renderer/             # Rendering plugins
    ├── worldgen/             # World generation
    ├── business/             # Game logic
    ├── ui/                   # User interface
    └── input/                # Input handling
```

## Development Workflow

### Testing

The engine includes comprehensive tests accessible via browser console:

```javascript
// Run all engine tests
KBTS_ENGINE_TESTS.runAll();

// Test specific components
KBTS_ENGINE_TESTS.testRNGDeterminism();
KBTS_ENGINE_TESTS.testRendererPlugins();
KBTS_ENGINE_TESTS.testWorldgenPlugins();
```

### Debugging

```javascript
// Access engine instance
const engine = window.KBTS_ENGINE;

// Check current state
console.log(engine.getState());

// Examine plugin services
const renderer = engine.services.get('renderer');
const worldgen = engine.services.get('worldgen');

// Monitor events
engine.events.subscribe('*', (topic, payload) => {
  console.log(`Event: ${topic}`, payload);
});
```

This architecture provides a solid foundation for building complex 4X games while maintaining modularity, testability, and extensibility.
- RNG backed by a seedable generator; advancing only in update() ensures determinism.
- Time service exposes tick count and dt; no plugin should call Date.now directly.
- Snapshots support: takeSnapshot(), restoreSnapshot(), diff patches.

Optional future: ECS layer on top of StateStore for high-entity simulations.

## Subsystems as Plugins (mapping from current code)

- Rendering
  - 2D Canvas renderer plugin (basic tiles, overlays)
  - 3D Three renderer plugin (current `renderer/three.ts` code adapts here)
  - Tile atlas and autotiling as either internal to renderer or separate services
- Worldgen
  - `worldgen/island.ts` becomes a worldgen plugin; emits worldgen.* events; writes to StateStore via context
- Rules/Simulation
  - Current rules and turn/real-time logic live in a rules plugin; listens to input/commands; mutates state; publishes entity/map events
- Input
  - Wraps DOM listeners; normalizes into input.* events and high-level commands
- UI/HUD
  - Panels, selections, tooltips; subscribes to state/events and requests renders
- Audio
  - Plays sfx/music in response to events
- Persistence
  - JSON save/load; later binary or cloud sync variants as separate plugins

## Suggested Directory Layout

```
frontend/src/engine/core/
  Engine.ts           // loop, lifecycle, plugin host
  EventBus.ts
  Services.ts         // DI-lite ServiceLocator
  StateStore.ts
  Time.ts
  RNG.ts
  Logger.ts

frontend/src/engine/contracts/
  types.ts            // GameState, Tile, Entity, IDs
  plugins.ts          // EnginePlugin, RendererPlugin, etc
  events.ts           // topic constants

frontend/src/plugins/
  renderer/canvas2d/Canvas2DRenderer.ts
  renderer/three/ThreeRenderer.ts
  worldgen/islands/IslandWorldgen.ts
  rules/core/CoreRules.ts
  input/dom/DOMInput.ts
  ui/hud/HUD.ts
  audio/howler/Audio.ts (optional)
  persistence/json/JSONPersistence.ts

frontend/src/services/
  TileAtlas.ts        // extracted from `tileAtlas.ts`
  Autotile.ts         // extracted from `autotile.ts`
  Pathfinding.ts      // future
```

Entry points:
- `main.ts` wires Engine + desired plugin set and mounts renderer.

## Minimal Engine Lifecycle

1) Engine constructed with options/plugins
2) init(): create services, init plugins
3) start(): start loop, call start() on plugins
4) tick(): fixed dt; call update() on plugins in order
5) render(): call renderer plugin(s) render(); support interpolation alpha
6) stop(): stop loop; call stop()/dispose()

## Rendering Abstraction

- Only renderer plugins access DOM/WebGL/Three.
- Simulation never calls renderer directly; it emits events or updates state.
- Renderer reads StateStore snapshots or subscribes to map/entity events.
- Swapping renderers should not affect simulation.

## Plugin Versioning and Capabilities

- Plugins declare `version`, `requires`, and `provides`.
- Engine validates dependency graph and start order.
- Capability examples: `cap:renderer`, `cap:worldgen`, `svc:tileAtlas`, `svc:autotile`.

## Testing Strategy

- Unit tests per plugin and core modules (deterministic RNG and loop).
- Contract tests: any renderer must pass a minimal rendering conformance suite.
- Worldgen snapshot tests: same seed -> same map hash.
- Rules plugin tests: simulation invariants (e.g., resource conservation).

## Migration Plan (Phased)

Phase 0 — Preparatory
- Identify state shape in current code; codify minimal GameState in `contracts/types.ts`.
- Extract RNG and Logger utilities; replace direct Date/Math.random calls in core.

Phase 1 — Core Shell
- Create `Engine.ts`, `EventBus.ts`, `Services.ts`, `StateStore.ts`, `Time.ts`.
- Introduce Engine loop (fixed timestep) and plugin host; run with a No-Op plugin.

Phase 2 — Renderer Plugins
- Wrap current 3D renderer (`renderer/three.ts`) behind `RendererPlugin`.
- Add a simple Canvas2D renderer for smoke tests.

Phase 3 — Worldgen Plugin
- Move `worldgen/island.ts` into a `worldgen` plugin; write to StateStore.
- Emit worldgen.* events for progress/UI.

Phase 4 — Rules/Simulation Plugin
- Move rules and game logic from the monolith into a `rules` plugin.
- Replace direct calls with event subscriptions and state mutations via context.

Phase 5 — Services Extraction
- Extract `tileAtlas.ts`, `autotile.ts`, `tileAtlasPreloader.ts` into services or plugins used by renderers and worldgen.

Phase 6 — Input/UI/Audio
- Add input plugin to normalize DOM events; wire a minimal HUD plugin to visualize state.

Phase 7 — Persistence
- Add JSON persistence plugin; wire save/load commands and hotkeys.

Phase 8 — Cleanup and Docs
- Remove old monolith; update docs and examples; add conformance tests.

## Acceptance Criteria

- Engine boots with either Canvas2D or Three renderer with identical simulation output.
- Given a fixed seed, worldgen and rules produce identical map hashes across runs.
- Plugins load order resolved; missing dependencies produce clear errors.
- No plugin directly imports another plugin's internals (only contracts/services).
- Test suite covers core loop, RNG determinism, and at least one plugin per type.

## Example Contracts (WIP)

```ts
// contracts/types.ts
export interface GameState {
  seed: string;
  tick: number;
  map: {
    width: number;
    height: number;
    tiles: Uint16Array | number[]; // tile ids
  };
  entities: Record<string, Entity>;
}

export interface Entity {
  id: string;
  kind: string; // e.g., 'unit', 'city'
  x: number;
  y: number;
  // component-like optional bags
  props?: Record<string, unknown>;
}

// contracts/plugins.ts
export interface EventBus {
  publish<T = unknown>(topic: string, payload?: T): void;
  subscribe<T = unknown>(topic: string, handler: (p: T) => void): () => void; // returns unsubscribe
}

export interface ServiceLocator {
  get<T>(id: string): T;
  provide<T>(id: string, svc: T): void;
  has(id: string): boolean;
}
```

## Mapping Current Files → New Modules

- `frontend/src/renderer/three.ts` → `plugins/renderer/three/ThreeRenderer.ts`
- `frontend/src/tileAtlas.ts` → `services/TileAtlas.ts`
- `frontend/src/tileAtlasPreloader.ts` → `services/TileAtlasPreloader.ts` or part of TileAtlas service
- `frontend/src/autotile.ts` → `services/Autotile.ts` (used by renderers/worldgen)
- `frontend/src/worldgen/island.ts` → `plugins/worldgen/islands/IslandWorldgen.ts`
- `frontend/src/rules.ts` → `plugins/rules/core/CoreRules.ts`
- `frontend/src/game.ts` / `kbts.ts` monolith → split across Engine core + plugins above
- `frontend/src/main.ts` → entry that wires the engine + plugin list

## Quick Start (target)

```ts
import { Engine } from './engine/core/Engine';
import { ThreeRenderer } from './plugins/renderer/three/ThreeRenderer';
import { CoreRules } from './plugins/rules/core/CoreRules';
import { IslandWorldgen } from './plugins/worldgen/islands/IslandWorldgen';

const engine = new Engine({
  seed: 'kbts-001',
  timestepMs: 33.333,
  plugins: [
    new ThreeRenderer({ mount: document.getElementById('app')! }),
    new IslandWorldgen(),
    new CoreRules(),
  ],
});

await engine.init();
engine.start();
```

## Next Steps

- Approve this architecture.
- Bootstrap core folders and minimal Engine + EventBus + RNG.
- Wrap current Three renderer as the first plugin and boot simulation without rules.
- Move worldgen next, then rules, then UI/input.

---

Appendix: Future Enhancements
- ECS atop StateStore for large entity counts
- Lockstep/network sync and replay system
- Scripting layer for mods (WASM/Lua/JS sandboxes)
- Asset pipeline and hot-reload for data-driven rules
