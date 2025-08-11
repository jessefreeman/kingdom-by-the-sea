// Shared types and enums for Kingdom by the Sea
export type TileType =
  | 'water' | 'grass' | 'forest' | 'hill' | 'mountain'
  | 'hut' | 'house' | 'mansion' | 'palace' | 'castle'
  | 'farm' | 'mine' | 'burnt' | 'rubble' | 'dock' | 'town';

export const T: Record<string, TileType> = {
  WATER: 'water', GRASS: 'grass', FOREST: 'forest', HILL: 'hill', MOUNTAIN: 'mountain',
  HUT: 'hut', HOUSE: 'house', MANSION: 'mansion', PALACE: 'palace', CASTLE: 'castle',
  FARM: 'farm', MINE: 'mine', BURNT: 'burnt', RUBBLE: 'rubble', DOCK: 'dock', TOWN: 'town'
} as const;

export type Yield = Partial<{ G: number; F: number; W: number; P: number }>;
export type Size = { w: number; h: number; t: number };
export type Cell = { type: TileType; disc: boolean; upg: null | Upgrade; wrk?: number; fx?: number };
export type Upgrade = { to: TileType; left: number; total: number; prog?: number; spec: UpgradeSpec };
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
  riskRng: () => number;
  noEvents?: boolean;
};
