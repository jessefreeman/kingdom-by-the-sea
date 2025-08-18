/**
 * Terrain Types and Game Constants
 * 
 * Core definitions for all terrain types, building types, and related constants
 * used throughout the Kingdom by the Sea game engine.
 */

// Core terrain and building types
export const TERRAIN_TYPES = {
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

// Type definition for terrain type values
export type TerrainType = typeof TERRAIN_TYPES[keyof typeof TERRAIN_TYPES];

// Housing progression line (for upgrade chains)
export const HOUSING_LINE = [
  TERRAIN_TYPES.HUT,
  TERRAIN_TYPES.HOUSE,
  TERRAIN_TYPES.MANSION,
  TERRAIN_TYPES.PALACE,
  TERRAIN_TYPES.CASTLE
] as const;

// Type definition for housing types
export type HousingType = typeof HOUSING_LINE[number];

// Legacy alias for backward compatibility
export const T = TERRAIN_TYPES;
export const HOUSELINE = HOUSING_LINE;

// Directional vectors for neighbor calculations
export const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [1, 0],   // East
  [-1, 0],  // West
  [0, 1],   // South
  [0, -1],  // North
];

// Legacy alias for backward compatibility
export const DIRS = DIRECTIONS;
