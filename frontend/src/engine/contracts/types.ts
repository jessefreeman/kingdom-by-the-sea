// Core engine types and contracts

export interface Size {
  w: number;
  h: number;
  t: number; // tile size
}

export interface Cell {
  type: string;
  disc: boolean;
  upg: any | null;
  wrk: number;
  fx: number;
  h: number; // height
}

// Minimal serializable game state for the engine
export interface GameState {
  seed: number;
  tick: number;
  map: {
    width: number;
    height: number;
    cells: Cell[];
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
    sel: number | null;
    fogEnabled: boolean;
  };
  entities: Record<string, Entity>;
}

export interface Entity {
  id: string;
  kind: string; // e.g., 'unit', 'city', 'upgrade'
  x: number;
  y: number;
  props?: Record<string, unknown>;
}

// Legacy state interface for gradual migration
export interface LegacyState {
  seed: number;
  rng: (() => number) | null;
  size: Size;
  map: Cell[];
  year: number;
  gold: number;
  food: number;
  wood: number;
  people: number;
  actions: number;
  sel: number | null;
  noEvents?: boolean;
  fogEnabled?: boolean;
}

// Convert between legacy and new state formats
export function legacyToGameState(legacy: LegacyState): GameState {
  return {
    seed: legacy.seed,
    tick: 0, // Will be managed by engine
    map: {
      width: legacy.size.w,
      height: legacy.size.h,
      cells: [...legacy.map],
    },
    resources: {
      gold: legacy.gold,
      food: legacy.food,
      wood: legacy.wood,
      people: legacy.people,
      actions: legacy.actions,
    },
    game: {
      year: legacy.year,
      sel: legacy.sel,
      fogEnabled: legacy.fogEnabled ?? true,
    },
    entities: {}, // Will be populated as we extract systems
  };
}

export function gameStateToLegacy(gameState: GameState, size: Size, rng: (() => number) | null): LegacyState {
  return {
    seed: gameState.seed,
    rng,
    size,
    map: [...gameState.map.cells],
    year: gameState.game.year,
    gold: gameState.resources.gold,
    food: gameState.resources.food,
    wood: gameState.resources.wood,
    people: gameState.resources.people,
    actions: gameState.resources.actions,
    sel: gameState.game.sel,
    fogEnabled: gameState.game.fogEnabled,
  };
}
