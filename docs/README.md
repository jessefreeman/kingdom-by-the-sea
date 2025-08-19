# Kingdom by the Sea - Documentation

This directory contains comprehensive documentation for the Kingdom by the Sea game engine and systems.

## 📋 Documentation Index

### Core Architecture
- **[Game Engine Architecture](4x-engine-architecture.md)** - Complete guide to the modular 4X engine system
  - Engine overview and implementation status
  - Plugin system architecture and contracts
  - Event-driven communication patterns
  - State management and serialization
  - Usage examples and extension guides
  - File structure and development workflow

### Technical Specifications
- **[Auto-Tiling Specification](auto-tiling-specification.md)** - Coastline auto-tiling system documentation
  - Binary grid processing for water/land transitions
  - 16-tile coastline set with edges, corners, and caps
  - Neighborhood logic without bitmask lookups
  - Implementation details for seamless terrain rendering

- **[Tile Texture System](tile-textures-needed.md)** - Texture atlas and art asset documentation
  - Runtime atlas generation system
  - Current tile mapping and placeholders
  - Performance optimization details
  - Art asset expansion roadmap

## 🏗️ Engine Architecture Overview

The Kingdom by the Sea engine has been successfully refactored from a monolithic structure into a modular 4X game engine featuring:

### ✅ **Implemented Core Systems**
- **Modular Core Engine** - Game loop, events, services, plugin lifecycle
- **Plugin Architecture** - Renderer, worldgen, business logic, UI plugins
- **Dual Renderers** - Canvas2D and Three.js with runtime switching
- **Deterministic Simulation** - Seeded RNG for reproducible gameplay
- **Event System** - Decoupled plugin communication
- **State Management** - Serializable game state with snapshots

### 🎯 **Key Features**
- **Fixed-Timestep Simulation** - 30Hz game logic independent of rendering
- **Runtime Renderer Switching** - Seamless transitions between 2D/3D views
- **Procedural World Generation** - Island generation with configurable parameters
- **Auto-Tiling System** - Automatic coastline generation for natural terrain
- **Extensible Plugin System** - Clean interfaces for adding new functionality

### 📁 **Project Structure**
```
frontend/src/
├── engine/           # Core engine components
│   ├── core/        # Engine runtime (EventBus, Services, StateStore, etc.)
│   ├── contracts/   # TypeScript interfaces and types
│   ├── services/    # Shared services (TileAtlas, WorldGen, etc.)
│   └── utilities/   # Utility functions (autotile, etc.)
├── plugins/         # Plugin implementations
│   ├── core/       # Foundation plugins
│   ├── renderer/   # 2D/3D rendering plugins
│   ├── worldgen/   # World generation plugins
│   ├── business/   # Game logic plugins
│   ├── ui/         # User interface plugins
│   └── input/      # Input handling plugins
└── tests/          # Engine and plugin tests
```

## 🚀 Getting Started

### For Developers
1. Read the **[Game Engine Architecture](4x-engine-architecture.md)** for complete system overview
2. Examine plugin implementations in `frontend/src/plugins/`
3. Run tests via browser console: `KBTS_ENGINE_TESTS.runAll()`

### For Artists
1. Review **[Tile Texture System](tile-textures-needed.md)** for art asset requirements
2. Current system uses 16×16px tiles with automatic atlas generation
3. Placeholder graphics are ready for replacement with final art

### For Modders
1. Follow plugin creation examples in the architecture documentation
2. Use the established plugin contracts for clean integration
3. Leverage the event system for decoupled functionality

## 🧪 Testing and Debugging

The engine includes comprehensive testing tools accessible via browser console:

```javascript
// Run all engine tests
KBTS_ENGINE_TESTS.runAll();

// Test specific systems
KBTS_ENGINE_TESTS.testRNGDeterminism();
KBTS_ENGINE_TESTS.testRendererPlugins();
KBTS_ENGINE_TESTS.testWorldgenPlugins();

// Access engine directly
const engine = window.KBTS_ENGINE;
console.log(engine.getState());

// Debug tile atlas
// Press 'A' key in-game for visual atlas overlay
// Press 'Shift+A' for console atlas info
```

## 📈 Development Status

The engine architecture is **production-ready** with the following implementation status:

- ✅ **Core Engine** - Complete with fixed-timestep loop and plugin system
- ✅ **Renderer System** - Both 2D Canvas and 3D Three.js renderers operational
- ✅ **World Generation** - Procedural island generation with multiple sizes
- ✅ **Auto-Tiling** - Seamless coastline generation system
- ✅ **Texture Atlas** - Runtime atlas generation with debug tools
- ✅ **Event System** - Pub/sub communication between all plugins
- ✅ **State Management** - Serializable state with snapshot support
- ✅ **Testing Framework** - Comprehensive test suite for all systems

The modular architecture provides a solid foundation for expanding into a full 4X strategy game while maintaining code quality, performance, and extensibility.
