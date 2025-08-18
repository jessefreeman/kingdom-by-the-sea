# KBTS Monolith Refactoring Plan

**Date:** August 18, 2025  
**Target:** Break down `frontend/src/engine/kbts.ts` (1,627 lines) into modular plugins  
**Goal:** Complete the 4X engine plugin architecture by extracting remaining monolithic components

## 📊 Current Analysis

The `kbts.ts` file contains approximately **1,627 lines** with the following major sections:

### Code Distribution by Functionality
- **🎮 Game Rules & Simulation** (~400 lines) - Turn logic, upgrades, rules validation
- **🖼️ Legacy Rendering System** (~300 lines) - Fallback canvas renderer with tile atlas 
- **🎯 Input Handling** (~200 lines) - Mouse/keyboard events, tile selection
- **🏗️ Construction & Upgrades** (~250 lines) - Building specs, upgrade system
- **🎲 Random Events** (~150 lines) - Turn-based events (fire, pirates, etc.)
- **💾 Save/Load & UI** (~200 lines) - Game persistence, HUD, overlays
- **🗺️ Terrain Editing** (~127 lines) - Height system, terrain modification

## 🎯 Refactoring Strategy

Break the monolith into **6 focused plugins** following the established engine architecture:

### Phase 4: Rules & Simulation Plugin ⭐ **HIGH PRIORITY**
### Phase 5: Input Management Plugin  
### Phase 6: UI & HUD Plugin
### Phase 7: Persistence Plugin
### Phase 8: Terrain Editing Plugin
### Phase 9: Legacy Renderer Cleanup

---

## 📋 Phase 4: Rules & Simulation Plugin

**Target:** Extract core gameplay rules, turn logic, and building system  
**Size:** ~650 lines → `CoreRulesPlugin`

### 🎯 Components to Extract

#### A. Building & Upgrade System
**Lines:** 86-120, 479-580, 750-850
```typescript
// Current: Scattered throughout kbts.ts
const SPEC: Record<string, UpgradeSpec[]> = { ... }
function startUpgrade(x, y, c, s) { ... }
function afford(cost) { ... }
function whyNo(spec, cell) { ... }
```
**→ Extract to:** `CoreRulesPlugin.buildingSystem`

#### B. Turn Processing & Economics  
**Lines:** 920-1100
```typescript
// Current: endTurn() function with embedded logic
function endTurn() {
  // Resource collection
  // Adjacency bonuses  
  // Upgrade progression
  // Population & feeding
  // Action point allocation
}
```
**→ Extract to:** `CoreRulesPlugin.processTurn()`

#### C. Random Events System
**Lines:** 1020-1150  
```typescript
// Current: randomEvent() with hardcoded events
function randomEvent(d) {
  const EV = [
    { n: "Fire", w: 25 },
    { n: "Pirates", w: 20 },
    // ...
  ];
}
```
**→ Extract to:** `CoreRulesPlugin.eventSystem`

#### D. Exploration & Discovery
**Lines:** 630-680
```typescript
// Current: explore(), canExplore(), reveal()
function explore(x, y) { ... }
function canExplore(x, y) { ... }
```
**→ Extract to:** `CoreRulesPlugin.explorationSystem`

### ✅ Deliverables
- `frontend/src/plugins/rules/core/CoreRulesPlugin.ts`
- `frontend/src/plugins/rules/core/BuildingSystem.ts`  
- `frontend/src/plugins/rules/core/EconomicsSystem.ts`
- `frontend/src/plugins/rules/core/EventSystem.ts`
- `frontend/src/tests/rules.*.tests.ts`

### 🔧 Plugin Interface
```typescript
interface RulesPlugin extends EnginePlugin {
  kind: 'rules';
  processTurn(): TurnResult;
  canUpgrade(x: number, y: number, spec: UpgradeSpec): boolean;
  startUpgrade(x: number, y: number, spec: UpgradeSpec): void;
  explore(x: number, y: number): void;
  getRandomEvent(): GameEvent | null;
}
```

---

## 📋 Phase 5: Input Management Plugin

**Target:** Extract mouse/keyboard input handling  
**Size:** ~200 lines → `DOMInputPlugin`

### 🎯 Components to Extract

#### A. Canvas Interaction
**Lines:** 430-460
```typescript
// Current: canvasClick() with embedded logic
const canvasClick = (e: MouseEvent) => {
  // Convert screen to grid coordinates
  // Handle tile selection
  // Trigger panel opening
};
canvas.addEventListener("click", canvasClick);
```
**→ Extract to:** `DOMInputPlugin.handleCanvasClick()`

#### B. Keyboard Controls  
**Lines:** 450-520
```typescript
// Current: Multiple document.addEventListener scattered
document.addEventListener("keydown", (e) => {
  if (e.key === "f") state.fogEnabled = !state.fogEnabled;
  if (e.key === "+") adjustHeightByIndex(state.sel, +1, false);
  // ... more keys
});
```
**→ Extract to:** `DOMInputPlugin.keyboard`

#### C. Debug Commands
**Lines:** 460-520
```typescript
// Current: Debug key handlers (K, A, F, +/-)
// Height adjustment, fog toggle, atlas debug
```
**→ Extract to:** `DOMInputPlugin.debugCommands`

### ✅ Deliverables
- `frontend/src/plugins/input/dom/DOMInputPlugin.ts`
- `frontend/src/plugins/input/dom/KeyboardHandler.ts`
- `frontend/src/plugins/input/dom/MouseHandler.ts`
- `frontend/src/tests/input.*.tests.ts`

### 🔧 Plugin Interface
```typescript
interface InputPlugin extends EnginePlugin {
  kind: 'input';
  bindToElement(element: HTMLElement): void;
  enableDebugMode(enabled: boolean): void;
  onTileClick?: (x: number, y: number) => void;
  onKeyPress?: (key: string, modifiers: KeyModifiers) => void;
}
```

---

## 📋 Phase 6: UI & HUD Plugin

**Target:** Extract user interface and overlay management  
**Size:** ~200 lines → `HUDPlugin`

### 🎯 Components to Extract

#### A. HUD & Resource Display
**Lines:** 1180-1220
```typescript
// Current: hud() function updates DOM elements
function hud() {
  $("y").textContent = String(state.year);
  $("g").textContent = String(state.gold);
  // ... other resources
}
```
**→ Extract to:** `HUDPlugin.updateResourceDisplay()`

#### B. Panel System  
**Lines:** 700-850
```typescript
// Current: openPanel() with massive HTML generation
function openPanel(x, y) {
  // Generate upgrade options
  // Format costs/yields
  // Bind click handlers
}
```
**→ Extract to:** `HUDPlugin.showTilePanel()`

#### C. Modal Overlays
**Lines:** 1150-1200, 1250-1400
```typescript
// Current: summary(), gameOver(), showStart()
function summary(d) { ... }
function gameOver(win, msg) { ... }
function showStart() { ... }
```
**→ Extract to:** `HUDPlugin.modalSystem`

### ✅ Deliverables
- `frontend/src/plugins/ui/hud/HUDPlugin.ts`
- `frontend/src/plugins/ui/hud/PanelSystem.ts`
- `frontend/src/plugins/ui/hud/ModalSystem.ts`
- `frontend/src/tests/ui.*.tests.ts`

### 🔧 Plugin Interface
```typescript
interface UIPlugin extends EnginePlugin {
  kind: 'ui';
  updateHUD(gameState: GameState): void;
  showTilePanel(x: number, y: number, tileData: any): void;
  showModal(type: 'summary' | 'gameOver' | 'newGame', data: any): void;
  hideAllModals(): void;
}
```

---

## 📋 Phase 7: Persistence Plugin

**Target:** Extract save/load functionality  
**Size:** ~80 lines → `JSONPersistencePlugin`

### 🎯 Components to Extract

#### A. Save/Load System
**Lines:** 1230-1250
```typescript
// Current: save(), load() functions
const save = () => localStorage.setItem("kbts-save", JSON.stringify(state));
const load = () => {
  const raw = localStorage.getItem("kbts-save");
  // ... restore state
};
```
**→ Extract to:** `JSONPersistencePlugin`

### ✅ Deliverables
- `frontend/src/plugins/persistence/json/JSONPersistencePlugin.ts`
- `frontend/src/tests/persistence.*.tests.ts`

### 🔧 Plugin Interface
```typescript
interface PersistencePlugin extends EnginePlugin {
  kind: 'persistence';
  save(gameState: GameState, slot?: string): Promise<void>;
  load(slot?: string): Promise<GameState | null>;
  listSaves(): Promise<string[]>;
  deleteSave(slot: string): Promise<void>;
}
```

---

## 📋 Phase 8: Terrain Editing Plugin

**Target:** Extract height system and terrain modification  
**Size:** ~127 lines → `TerrainEditingPlugin`

### 🎯 Components to Extract

#### A. Height System
**Lines:** 1500-1627 (bottom of file)
```typescript
// Current: Height calculation and adjustment functions
function computeHeightMap() { ... }
function adjustHeightByIndex(i, delta, propagate) { ... }
function adjustHeightAt(x, y, delta, propagate) { ... }
```
**→ Extract to:** `TerrainEditingPlugin.heightSystem`

#### B. Terrain Modification
**Lines:** 480-550
```typescript
// Current: growIslandAt(), erodeIslandAt(), toggleTileForAutotileTest()
function growIslandAt(cx, cy) { ... }
function erodeIslandAt(cx, cy) { ... }
```
**→ Extract to:** `TerrainEditingPlugin.editingTools`

### ✅ Deliverables
- `frontend/src/plugins/terrain/TerrainEditingPlugin.ts`
- `frontend/src/plugins/terrain/HeightSystem.ts`
- `frontend/src/tests/terrain.*.tests.ts`

### 🔧 Plugin Interface
```typescript
interface TerrainEditingPlugin extends EnginePlugin {
  kind: 'terrain';
  adjustHeight(x: number, y: number, delta: number): void;
  setTileType(x: number, y: number, type: string): void;
  smoothTerrain(centerX: number, centerY: number, radius: number): void;
  getHeightAt(x: number, y: number): number;
}
```

---

## 📋 Phase 9: Legacy Renderer Cleanup

**Target:** Remove/consolidate legacy rendering code  
**Size:** ~300 lines reduction

### 🎯 Components to Remove/Move

#### A. Legacy Canvas Renderer
**Lines:** 180-430
```typescript
// Current: tile(), drawCanvas(), draw() fallback functions
// Move tile atlas integration to Canvas2DRenderer plugin
```
**→ Action:** Move to existing `Canvas2DRendererPlugin`, remove from kbts.ts

#### B. Renderer Management  
**Lines:** 125-180
```typescript
// Current: Canvas setup, resize handlers
// Already handled by renderer plugins
```
**→ Action:** Remove from kbts.ts, handled by renderer manager

### ✅ Deliverables
- Enhanced `Canvas2DRendererPlugin` with tile atlas support
- Removed ~300 lines of legacy rendering code
- Updated renderer tests

---

## 🚀 Implementation Checklist

### Phase 4: Rules & Simulation ⭐ **START HERE**
- [x] Create `CoreRulesPlugin` skeleton with engine contracts
- [x] Extract building specifications and upgrade system
- [ ] Move turn processing logic (`endTurn()` → `processTurn()`)
- [ ] Extract random events system with configurable event weights
- [ ] Move exploration and discovery mechanics
- [ ] Add rules plugin tests with deterministic scenarios
- [x] Update `main.ts` to load rules plugin
- [ ] Verify game mechanics work identically

### Phase 5: Input Management
- [ ] Create `DOMInputPlugin` with keyboard/mouse handlers
- [ ] Extract canvas click handling and coordinate conversion
- [ ] Move debug key bindings (height adjustment, fog toggle, etc.)
- [ ] Add input event routing through engine event bus
- [ ] Test input responsiveness and debug commands
- [ ] Remove input handling from kbts.ts

### Phase 6: UI & HUD  
- [ ] Create `HUDPlugin` with resource display management
- [ ] Extract tile panel system with upgrade UI generation
- [ ] Move modal system (game over, new game, turn summary)
- [ ] Add UI state management and event subscriptions
- [ ] Test UI updates and user interactions
- [ ] Remove UI code from kbts.ts

### Phase 7: Persistence
- [ ] Create `JSONPersistencePlugin` with localStorage backend
- [ ] Add save/load state validation and migration
- [ ] Implement save slot management
- [ ] Add persistence tests with state round-trip validation
- [ ] Hook up save/load buttons to plugin
- [ ] Remove persistence code from kbts.ts

### Phase 8: Terrain Editing
- [ ] Create `TerrainEditingPlugin` with height system
- [ ] Move terrain modification tools (grow/erode islands)
- [ ] Add terrain editing event publishing
- [ ] Test height adjustments and terrain changes
- [ ] Remove terrain editing from kbts.ts

### Phase 9: Legacy Renderer Cleanup
- [ ] Move tile atlas integration to `Canvas2DRendererPlugin`
- [ ] Remove legacy `tile()`, `drawCanvas()`, `draw()` functions
- [ ] Update renderer fallback logic
- [ ] Remove canvas setup code (handled by renderer manager)
- [ ] Final cleanup and dead code removal

## 🎯 Success Metrics

### Code Quality
- [ ] **kbts.ts reduced from 1,627 → ~200 lines** (87% reduction)
- [ ] **6 new focused plugins** with single responsibilities
- [ ] **Zero breaking changes** to existing game behavior
- [ ] **100% test coverage** for extracted systems

### Architecture
- [ ] **Clean plugin contracts** with well-defined interfaces
- [ ] **Event-driven communication** between plugins
- [ ] **Deterministic behavior** maintained throughout refactoring
- [ ] **Modular testing** enabled for each game system

### Maintainability  
- [ ] **Clear separation of concerns** (rules ≠ UI ≠ input ≠ rendering)
- [ ] **Easy to add new features** (buildings, events, UI elements)
- [ ] **Isolated debugging** of individual systems
- [ ] **Plugin hot-swapping** capability for development

## 📝 Implementation Notes

### Plugin Loading Order
```typescript
// main.ts plugin initialization order
engine.loadPlugin(new CoreRulesPlugin());      // Rules first (core logic)
engine.loadPlugin(new HUDPlugin());            // UI second (subscribes to rules events)  
engine.loadPlugin(new DOMInputPlugin());       // Input third (triggers rules actions)
engine.loadPlugin(new JSONPersistencePlugin()); // Persistence fourth (saves/loads state)
engine.loadPlugin(new TerrainEditingPlugin()); // Terrain last (optional creative tools)
```

### Event Flow Architecture
```typescript
// Example: Player clicks to upgrade a tile
DOMInputPlugin.onTileClick(x, y) 
  → engine.eventBus.emit('tile.selected', {x, y})
  → HUDPlugin.showTilePanel() 
  → User clicks upgrade button
  → HUDPlugin.onUpgradeClick() 
  → engine.eventBus.emit('rules.upgrade.request', {x, y, spec})
  → CoreRulesPlugin.handleUpgradeRequest()
  → engine.eventBus.emit('rules.upgrade.started', {x, y, spec})
  → HUDPlugin.updateTilePanel() + HUDPlugin.updateHUD()
```

### Breaking Changes Policy
- **Zero breaking changes** to window.KBTS API during refactoring
- **Maintain all existing tests** - they should pass throughout
- **Preserve deterministic behavior** - same seed = same result
- **Keep legacy compatibility** for existing save files

This refactoring plan will transform the monolithic `kbts.ts` into a clean, modular plugin architecture while preserving all existing functionality and maintaining the deterministic 4X game engine behavior.
