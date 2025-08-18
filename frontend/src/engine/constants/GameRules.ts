/**
 * Game Rules and Data Constants
 * 
 * Production rules, building benefits, and game mechanics data
 * that define how different terrain types interact with the economy.
 */

import { TERRAIN_TYPES } from "./TerrainTypes";
import type { Resources } from "./Resources";

// Base resource production for each terrain/building type
export const BASE_PRODUCTION: Record<string, Partial<Resources>> = {
  [TERRAIN_TYPES.FARM]: { F: 2 },      // Farms produce 2 food
  [TERRAIN_TYPES.MINE]: { G: 1 },      // Mines produce 1 gold
  [TERRAIN_TYPES.HOUSE]: { G: 1 },     // Houses generate 1 gold (taxes)
  [TERRAIN_TYPES.MANSION]: { G: 2 },   // Mansions generate 2 gold  
  [TERRAIN_TYPES.PALACE]: { G: 3 },    // Palaces generate 3 gold
  [TERRAIN_TYPES.CASTLE]: { G: 4 },    // Castles generate 4 gold
  [TERRAIN_TYPES.DOCK]: { F: 1, G: 1 }, // Docks produce food and gold
};

// Legacy alias for backward compatibility
export const BASE = BASE_PRODUCTION;
