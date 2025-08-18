/**
 * Visual Constants - Colors and Display Properties
 * 
 * All color definitions, visual styling, and display-related constants
 * for terrain, UI elements, and game visuals.
 */

import { TERRAIN_TYPES } from "./TerrainTypes";

// Terrain and UI color palette
export const COLORS: Record<string, string> = {
  // Terrain colors
  [TERRAIN_TYPES.WATER]: "#0c3b66",
  [TERRAIN_TYPES.GRASS]: "#2e7d32",
  [TERRAIN_TYPES.FOREST]: "#1f5f24",
  [TERRAIN_TYPES.HILL]: "#7c6f4a",
  [TERRAIN_TYPES.MOUNTAIN]: "#5f5750",
  [TERRAIN_TYPES.FARM]: "#c68f39",
  [TERRAIN_TYPES.MINE]: "#8a7f78",
  [TERRAIN_TYPES.HUT]: "#9b5d2e",
  [TERRAIN_TYPES.HOUSE]: "#b97a3f",
  [TERRAIN_TYPES.MANSION]: "#d29a5a",
  [TERRAIN_TYPES.PALACE]: "#e2b874",
  [TERRAIN_TYPES.CASTLE]: "#e5d09a",
  [TERRAIN_TYPES.BURNT]: "#3a2d2d",
  [TERRAIN_TYPES.RUBBLE]: "#4a4a4a",
  [TERRAIN_TYPES.DOCK]: "#2563eb",
  
  // Special visual elements
  coast: "#155d96",
  fog: "#0a0d1a",
};

// Single-character labels for debug display and compact representation
export const TERRAIN_LABELS: Record<string, string> = {
  [TERRAIN_TYPES.GRASS]: "G",
  [TERRAIN_TYPES.FOREST]: "T",
  [TERRAIN_TYPES.HILL]: "h",  // Lowercase to distinguish from HOUSE
  [TERRAIN_TYPES.MOUNTAIN]: "M",
  [TERRAIN_TYPES.HUT]: "H",
  [TERRAIN_TYPES.HOUSE]: "H",
  [TERRAIN_TYPES.MANSION]: "H",
  [TERRAIN_TYPES.PALACE]: "H",
  [TERRAIN_TYPES.CASTLE]: "H",
  [TERRAIN_TYPES.FARM]: "F",
  [TERRAIN_TYPES.MINE]: "M",
  [TERRAIN_TYPES.BURNT]: "B",
  [TERRAIN_TYPES.RUBBLE]: "R",
  [TERRAIN_TYPES.DOCK]: "D",
  [TERRAIN_TYPES.TOWN]: "T",
};

// Legacy aliases for backward compatibility
export const C = COLORS;
export const LABEL = TERRAIN_LABELS;
