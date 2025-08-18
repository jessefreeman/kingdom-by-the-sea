/**
 * Resource Types and Economy Constants
 * 
 * Definitions for resource types, production values, and economic rules
 * used in the Kingdom by the Sea economy system.
 */

// Resource type identifiers
export const RESOURCE_TYPES = {
  GOLD: "G",     // Gold - currency and trade
  FOOD: "F",     // Food - population sustenance  
  WOOD: "W",     // Wood - construction material
} as const;

// Type definition for resource identifiers
export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];

// Resource interface for type safety
export interface Resources {
  G?: number;  // Gold
  F?: number;  // Food
  W?: number;  // Wood
}

// Legacy aliases for backward compatibility
export const G = RESOURCE_TYPES.GOLD;
export const F = RESOURCE_TYPES.FOOD;
export const W = RESOURCE_TYPES.WOOD;
