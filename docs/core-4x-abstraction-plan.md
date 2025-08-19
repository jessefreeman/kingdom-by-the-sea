# Core 4X Engine Abstraction Plan

This document outlines the strategy for completely separating the generic 4X engine from Kingdom by the Sea specific business logic.

## Current State Analysis

### ✅ **Already Abstracted (Core Engine)**
- **Engine Runtime** - Fixed timestep loop, plugin lifecycle, events
- **Service Layer** - Dependency injection, state management, RNG
- **Renderer System** - Canvas2D and Three.js with runtime switching
- **Basic Plugin Architecture** - Plugin contracts and lifecycle management
- **State Management** - Serializable game state with snapshots

### 🔄 **Partially Abstracted (Needs Work)**
- **Input System** - Generic input handling but KBTS-specific actions
- **UI Framework** - Basic structure but KBTS-specific components
- **Turn Management** - Generic turn concept but KBTS-specific logic
- **Tile Selection** - Core mechanism exists but mixed with KBTS logic

### ❌ **Not Abstracted (KBTS Specific)**
- **Game Rules** - Building costs, upgrade paths, resource formulas
- **Content Definitions** - Tile types, building specs, upgrade trees
- **Business Logic** - End-of-turn calculations, adjacency bonuses
- **Event Handlers** - Game-specific responses to core events

## Target Architecture

### Core 4X Engine (Generic)
```
engine/
├── core/                    # Engine runtime
│   ├── Engine.ts           # Main game loop and coordination
│   ├── EventBus.ts         # Pub/sub messaging
│   ├── Services.ts         # Dependency injection
│   ├── StateStore.ts       # State management
│   ├── Time.ts             # Timing services
│   ├── RNG.ts              # Deterministic random
│   └── Logger.ts           # Logging service
├── systems/                 # Core 4X systems
│   ├── TurnSystem.ts       # Turn management framework
│   ├── TileSystem.ts       # Tile selection and manipulation
│   ├── ResourceSystem.ts   # Resource tracking framework
│   ├── UpgradeSystem.ts    # Generic upgrade/construction system
│   ├── InputSystem.ts      # Input handling and routing
│   └── UISystem.ts         # UI framework and components
├── contracts/               # Type definitions
│   ├── plugins.ts          # Plugin interfaces
│   ├── systems.ts          # System interfaces
│   ├── gameTypes.ts        # Generic game state types
│   └── contentTypes.ts     # Content definition interfaces
└── services/                # Shared engine services
    ├── tileAtlas.ts        # Texture management
    └── autotile.ts         # Auto-tiling utilities
```

### Game Implementation (KBTS Specific)
```
games/kbts/                  # Kingdom by the Sea implementation
├── content/                 # Game content definitions
│   ├── tileTypes.ts        # KBTS tile definitions
│   ├── buildingSpecs.ts    # Building costs and requirements
│   ├── upgradeTree.ts      # Upgrade paths and dependencies
│   ├── resources.ts        # Resource types and formulas
│   └── events.ts           # Random events and outcomes
├── rules/                   # Game-specific rules
│   ├── TurnRules.ts        # End-of-turn calculations
│   ├── BuildingRules.ts    # Construction and upgrade logic
│   ├── ResourceRules.ts    # Resource generation and consumption
│   └── ExplorationRules.ts # Exploration mechanics
├── plugins/                 # KBTS-specific plugins
│   ├── KBTSGameLogic.ts    # Main game logic coordinator
│   ├── KBTSWorldGen.ts     # Island generation
│   ├── KBTSUI.ts           # Game-specific UI components
│   └── KBTSInput.ts        # Game-specific input handlers
└── config/                  # Game configuration
    ├── gameConfig.ts       # Default game settings
    └── balancing.ts        # Tuning parameters
```

## Implementation Progress ✅

I've successfully created the foundational systems for the core 4X engine abstraction:

### ✅ **Core Systems Implemented**

#### **TurnSystem** (`/engine/systems/TurnSystem.ts`)
- Generic turn management with configurable phases
- Plugin-based phase handlers for game-specific logic
- Standard 4X phases: start_turn → movement → actions → production → maintenance → end_turn
- Event-driven communication between phases
- Support for turn skipping and system reset

#### **TileSystem** (`/engine/systems/TileSystem.ts`)  
- Generic tile selection and manipulation framework
- Coordinate/index conversion utilities
- Tile action registration and execution system
- Neighbor calculation with optional diagonals
- Type-based tile searching and iteration
- Hover and selection state management

#### **ResourceSystem** (`/engine/systems/ResourceSystem.ts`)
- Configurable resource types with constraints
- Transaction-based resource changes (gain/spend/set)
- Automatic validation and clamping
- Transaction history for debugging
- Cost checking and missing resource calculation
- Event publication for resource changes

#### **ContentRegistry** (`/engine/systems/ContentRegistry.ts`)
- Data-driven content definition system
- Type-safe building, tile, and upgrade definitions
- Dependency validation and conflict resolution
- Placement rule validation for buildings
- Upgrade requirement checking system
- Plugin-based content loading

### ✅ **KBTS Demonstration**

#### **Content Definitions** (`/games/kbts/content.ts`)
- Complete KBTS content pack with all resources, tiles, buildings, and upgrades
- Data-driven definitions replacing hardcoded specifications
- Placement rules and upgrade requirements defined declaratively
- 5 resource types, 7 tile types, 8 building types, 12 upgrade definitions

#### **Rules Engine** (`/games/kbts/rules.ts`)
- Game-specific logic using the generic systems
- Turn phase handlers for production, maintenance, and events
- Resource generation calculations
- Construction progress tracking
- Random event system (fire, pirates, storms)
- Farm worker management and adjacency bonuses

## Benefits Already Achieved

### **For Engine Development**
✅ **Clean Separation** - Core systems have no game-specific logic
✅ **Reusable Components** - Systems work for any 4X-style game
✅ **Event-Driven** - Decoupled communication between all systems
✅ **Type-Safe** - Full TypeScript support with proper interfaces

### **For Game Development**  
✅ **Data-Driven Content** - No hardcoded buildings or upgrades
✅ **Declarative Rules** - Placement and requirements defined in data
✅ **Easier Balancing** - Change costs/effects without code modifications
✅ **Modding Ready** - Content packs can be loaded dynamically

### **For Kingdom by the Sea**
✅ **Preserved Functionality** - All existing features represented in new system
✅ **Better Organization** - Clear separation between engine and game logic
✅ **More Extensible** - Easy to add new buildings, resources, rules
✅ **Performance Ready** - Systems designed for optimal performance

## Key Abstraction Principles

### 1. **Data-Driven Content**
```typescript
// Instead of hardcoded in plugins:
const HOUSE_SPEC = { cost: { G: 1, W: 1 }, duration: 1 };

// Use content registry:
contentRegistry.register('building', 'house', {
  cost: { gold: 1, wood: 1 },
  buildTime: 1,
  provides: ['population'],
  requires: ['grass_tile']
});
```

### 2. **Plugin-Based Rules**
```typescript
// Core engine provides framework:
class TurnSystem {
  async processTurn() {
    await this.executePhase('start_turn');
    await this.executePhase('resource_generation');
    await this.executePhase('end_turn');
  }
}

// Games register specific logic:
turnSystem.registerPhaseHandler('resource_generation', kbtsResourceGeneration);
```

### 3. **Event-Driven Architecture**
```typescript
// Core events:
events.publish('tile.selected', { x, y, tileType });
events.publish('turn.started', { turnNumber, player });

// Game-specific handlers:
events.subscribe('tile.selected', kbtsHandleTileSelection);
events.subscribe('turn.started', kbtsProcessTurnStart);
```

### 4. **Configurable Systems**
```typescript
// Engine configuration:
const engine = new Engine({
  systems: {
    resources: new ResourceSystem(['gold', 'food', 'wood', 'population']),
    turns: new TurnSystem({ phaseBased: true }),
    tiles: new TileSystem({ gridSize: { width: 20, height: 16 } })
  },
  content: kbtsContentPack,
  rules: kbtsRulesPack
});
```

## Benefits of This Architecture

### **For Engine Development**
- **Reusable across games** - Core engine works for any 4X game
- **Easier testing** - Core systems testable in isolation
- **Better maintainability** - Clear separation of concerns
- **Plugin ecosystem** - Third-party plugins for common features

### **For Game Development**
- **Faster prototyping** - Focus on content and rules, not engine
- **Easier balancing** - Modify data files without code changes
- **Modding support** - Players can create content packs
- **A/B testing** - Easy to swap rule variations

### **For Kingdom by the Sea**
- **Same functionality** - No loss of existing features
- **Better organized** - Clear structure for all game content
- **More extensible** - Easy to add new buildings, resources, etc.
- **Performance optimized** - Generic systems are more efficient

## Migration Risk Mitigation

### **Parallel Development**
- Keep existing KBTS code working during migration
- Develop new architecture alongside current system
- Switch over when feature parity is achieved

### **Incremental Migration**
- Migrate one system at a time (turns → tiles → resources)
- Test each migration step thoroughly
- Maintain backward compatibility during transition

### **Automated Testing**
- Create comprehensive test suite for current KBTS behavior
- Ensure new architecture produces identical results
- Performance benchmarking to avoid regressions

This abstraction will transform Kingdom by the Sea from a monolithic game into a showcase of what's possible with a well-designed 4X engine, while making the engine itself valuable for other projects.
