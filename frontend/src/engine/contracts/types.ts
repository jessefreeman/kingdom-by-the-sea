// Core engine types and contracts

export interface Size {
  w: number;
  h: number;
  t: number; // tile size
}

// Game-specific tile types
export type TileType =
  | "water"
  | "grass"
  | "forest"
  | "hill"
  | "mountain"
  | "hut"
  | "house"
  | "mansion"
  | "palace"
  | "castle"
  | "farm"
  | "mine"
  | "burnt"
  | "rubble"
  | "dock"
  | "town";

export const T: Record<string, TileType> = {
  WATER: "water",
  GRASS: "grass",
  FOREST: "forest",
  HILL: "hill",
  MOUNTAIN: "mountain",
  HUT: "hut",
  HOUSE: "house",
  MANSION: "mansion",
  PALACE: "palace",
  CASTLE: "castle",
  FARM: "farm",
  MINE: "mine",
  BURNT: "burnt",
  RUBBLE: "rubble",
  DOCK: "dock",
  TOWN: "town",
} as const;

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

// Legacy types for backward compatibility during migration
export type Yield = Partial<{ G: number; F: number; W: number; P: number }>;

export type Upgrade = {
  to: TileType;
  left: number;
  total: number;
  prog?: number;
  spec: UpgradeSpec;
};

export type UpgradeSpec = {
  to: TileType;
  cost: Partial<{ G: number; W: number; F: number; P: number }>;
  duration: number;
  instant?: Yield;
  perTurn?: Yield;
  pre?: (x: number, y: number) => boolean;
  req?: string;
};

export type Delta = Required<Yield> & { events: string[] };
export type Point = { x: number; y: number };

export type KBTSApi = {
  // core data/constants
  state: State;
  T: typeof T;
  C: Record<string, string>;
  LABEL: Record<string, string>;
  SPEC: Record<string, UpgradeSpec[]>;
  BASE: Record<string, Partial<{ G: number; F: number; W: number }>>;
  DIRS: ReadonlyArray<[number, number]>;
  // helpers
  idx(x: number, y: number): number;
  inBounds(x: number, y: number): boolean;
  each(fn: (x: number, y: number, cell: Cell) => void): void;
  // rules/actions (selected subset)
  afford(cost: any): boolean;
  whyNo(spec: any, cell: any): string;
  uniqueAvailable(to: string): boolean;
  applyAdjacencyBonuses(d: any): void;
  startUpgrade(x: number, y: number, c: any, s: any): void;
  endTurn(): any;
};

export type State = {
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
};

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
