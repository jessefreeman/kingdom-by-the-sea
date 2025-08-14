// Auto-tiling system for Kingdom by the Sea
// Enhanced with proper coastline auto-tiling using 8-neighbor evaluation

import { CoastlineAutoTiler, applyCoastlineTiling, type CoastlineResult } from './coastlineAutoTiler';

export interface AutoTileConfig {
  textureSize: number;
  tileSize: number;
  gridSize: number;
}

export interface AutoTileResult {
  tileIndex: number;
  uvX: number;
  uvY: number;
  patternName?: string;
}

export class AutoTiler {
  protected config: AutoTileConfig;
  protected coastlineTiler: CoastlineAutoTiler;

  constructor(config: AutoTileConfig = { textureSize: 64, tileSize: 16, gridSize: 4 }) {
    this.config = config;
    this.coastlineTiler = new CoastlineAutoTiler({
      textureSize: config.textureSize,
      tileSize: config.tileSize,
      tilesPerRow: 8 // Use 8x6 layout for 47-tile coastline patterns
    });
  }

  // Calculate auto-tile index based on neighbors
  calculateAutoTile(
    x: number,
    y: number,
    getTileType: (x: number, y: number) => string | null,
    targetType: string,
    connectsTo: string[]
  ): AutoTileResult {
    // For coastline/water tiles, use the enhanced coastline auto-tiler
    if (targetType === 'water' || targetType === 'coast') {
      const coastlineResult = this.coastlineTiler.calculateCoastlineTile(
        x, y, getTileType, ['water', 'coast']
      );
      
      if (coastlineResult) {
        return {
          tileIndex: coastlineResult.tileIndex,
          uvX: coastlineResult.uvX,
          uvY: coastlineResult.uvY,
          patternName: coastlineResult.patternName
        };
      }
    }

    // For land tiles, use the original 4-neighbor system
    let bitValue = 0;
    
    // Check the 8 adjacent positions
    const directions = [
      { dx: 0, dy: -1, bit: 0 }, // North
      { dx: 1, dy: -1, bit: 1 }, // NorthEast
      { dx: 1, dy: 0, bit: 2 },  // East
      { dx: 1, dy: 1, bit: 3 },  // SouthEast
      { dx: 0, dy: 1, bit: 4 },  // South
      { dx: -1, dy: 1, bit: 5 }, // SouthWest
      { dx: -1, dy: 0, bit: 6 }, // West
      { dx: -1, dy: -1, bit: 7 } // NorthWest
    ];
    
    for (const dir of directions) {
      const neighborX = x + dir.dx;
      const neighborY = y + dir.dy;
      const neighborType = getTileType(neighborX, neighborY);
      
      // Check if neighbor connects to this tile type
      if (neighborType && connectsTo.includes(neighborType)) {
        bitValue |= (1 << dir.bit);
      }
    }
    
    // Extract all 8 directions for full pattern analysis
    const north = (bitValue & 0b00000001) !== 0;     // bit 0
    const northEast = (bitValue & 0b00000010) !== 0; // bit 1
    const east = (bitValue & 0b00000100) !== 0;      // bit 2
    const southEast = (bitValue & 0b00001000) !== 0; // bit 3
    const south = (bitValue & 0b00010000) !== 0;     // bit 4
    const southWest = (bitValue & 0b00100000) !== 0; // bit 5
    const west = (bitValue & 0b01000000) !== 0;      // bit 6
    const northWest = (bitValue & 0b10000000) !== 0; // bit 7
    
    // Use enhanced algorithm that considers diagonal information
    let tileIndex = this.calculateTileFromPattern(
      north, northEast, east, southEast, 
      south, southWest, west, northWest
    );
    
    const uvCoords = this.getTileUV(tileIndex);
    
    return {
      tileIndex,
      uvX: uvCoords.x,
      uvY: uvCoords.y
    };
  }

  // Enhanced pattern calculation using all 8 neighbors
  private calculateTileFromPattern(
    north: boolean, northEast: boolean, east: boolean, southEast: boolean,
    south: boolean, southWest: boolean, west: boolean, northWest: boolean
  ): number {
    // First, check basic 4-directional patterns
    const cardinalIndex = (north ? 1 : 0) | 
                         (east ? 2 : 0) | 
                         (south ? 4 : 0) | 
                         (west ? 8 : 0);
    
    // For basic patterns without diagonal conflicts, use the simple mapping
    if (cardinalIndex === 0) return 5;   // Isolated
    if (cardinalIndex === 1) return 1;   // North only
    if (cardinalIndex === 2) return 6;   // East only
    if (cardinalIndex === 4) return 9;   // South only
    if (cardinalIndex === 8) return 4;   // West only
    if (cardinalIndex === 5) return 13;  // North + South
    if (cardinalIndex === 10) return 7;  // East + West
    
    // Corner patterns - but check diagonals for refinement
    if (cardinalIndex === 3) {  // North + East
      return northEast ? 2 : 16;  // If diagonal exists, outer corner, else inner corner
    }
    if (cardinalIndex === 6) {  // East + South  
      return southEast ? 10 : 17; // If diagonal exists, outer corner, else inner corner
    }
    if (cardinalIndex === 12) { // South + West
      return southWest ? 8 : 18;  // If diagonal exists, outer corner, else inner corner
    }
    if (cardinalIndex === 9) {  // West + North
      return northWest ? 0 : 19;  // If diagonal exists, outer corner, else inner corner
    }
    
    // T-junction patterns
    if (cardinalIndex === 7) return 14;   // North + East + South
    if (cardinalIndex === 14) return 11;  // East + South + West
    if (cardinalIndex === 13) return 12;  // South + West + North
    if (cardinalIndex === 11) return 3;   // West + North + East
    
    // Full connection
    if (cardinalIndex === 15) return 15;
    
    // Fallback to basic cardinal mapping
    return cardinalIndex;
  }

  // Convert tile index to UV coordinates
  getTileUV(tileIndex: number): { x: number, y: number } {
    const col = tileIndex % 4; // 4 columns in your sprite sheet
    const row = Math.floor(tileIndex / 4); // Calculate row
    
    return {
      x: col * this.config.tileSize,
      y: row * this.config.tileSize
    };
  }

  // Get normalized UV coordinates (0-1 range)
  getTileUVNormalized(tileIndex: number): { x: number, y: number, width: number, height: number } {
    const uv = this.getTileUV(tileIndex);
    return {
      x: uv.x / this.config.textureSize,
      y: uv.y / this.config.textureSize,
      width: this.config.tileSize / this.config.textureSize,
      height: this.config.tileSize / this.config.textureSize
    };
  }
}

// Enhanced Water-specific auto-tiler using coastline system
export class WaterAutoTiler extends AutoTiler {
  constructor(config: AutoTileConfig = { textureSize: 64, tileSize: 16, gridSize: 4 }) {
    super(config);
  }

  calculateWaterTile(
    x: number,
    y: number,
    getTileType: (x: number, y: number) => string | null
  ): AutoTileResult {
    const currentTile = getTileType(x, y);
    
    if (currentTile === 'water' || currentTile === 'coast') {
      // Use the enhanced coastline auto-tiler
      const coastlineResult = this.coastlineTiler.calculateCoastlineTile(
        x, y, getTileType, ['water', 'coast']
      );
      
      if (coastlineResult) {
        return {
          tileIndex: coastlineResult.tileIndex,
          uvX: coastlineResult.uvX,
          uvY: coastlineResult.uvY,
          patternName: coastlineResult.patternName
        };
      }
    }
    
    // Fallback for deep water
    return {
      tileIndex: 0,
      uvX: 0,
      uvY: 0,
      patternName: 'Deep Water'
    };
  }

  /**
   * Process an entire map and apply coastline auto-tiling
   */
  processMap(
    map: Array<{ type: string }>,
    mapWidth: number,
    mapHeight: number
  ): {
    processedMap: Array<{ type: string }>,
    coastlineData: Map<number, CoastlineResult>,
    stats: { totalTiles: number, coastTiles: number, deepWater: number, landTiles: number }
  } {
    return applyCoastlineTiling(map, mapWidth, mapHeight);
  }
}

// Global instance for water auto-tiling
export const waterAutoTiler = new WaterAutoTiler();
