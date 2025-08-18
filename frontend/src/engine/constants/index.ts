/**
 * Game Constants - Central Export
 * 
 * Re-exports all game constants from their organized modules.
 * This provides a single import point for all constants while maintaining
 * logical organization in separate files.
 */

// Terrain and building types
export * from "./TerrainTypes";

// Visual constants (colors, labels)
export * from "./Colors";

// Resource system
export * from "./Resources";

// Game rules and production
export * from "./GameRules";

// Convenience re-exports for common usage patterns
export { 
  TERRAIN_TYPES as T,
  HOUSING_LINE as HOUSELINE,
  DIRECTIONS as DIRS
} from "./TerrainTypes";

export {
  COLORS as C,
  TERRAIN_LABELS as LABEL
} from "./Colors";

export {
  BASE_PRODUCTION as BASE
} from "./GameRules";
