// Auto-tiling system for Kingdom by the Sea
// Implements 8-bit auto-tiling with 4x4 template layout

export interface AutoTileConfig {
  textureSize: number;
  tileSize: number;
  gridSize: number;
}

export interface AutoTileResult {
  tileIndex: number;
  uvX: number;
  uvY: number;
}

export class AutoTiler {
  private config: AutoTileConfig;

  constructor(config: AutoTileConfig = { textureSize: 64, tileSize: 16, gridSize: 4 }) {
    this.config = config;
  }

  // Calculate auto-tile index based on neighbors
  calculateAutoTile(
    x: number,
    y: number,
    getTileType: (x: number, y: number) => string | null,
    targetType: string,
    connectsTo: string[]
  ): AutoTileResult {
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
    
    // Extract cardinal directions and calculate tile index directly
    const north = (bitValue & 0b00000001) !== 0;  // bit 0
    const east =  (bitValue & 0b00000100) !== 0;  // bit 2  
    const south = (bitValue & 0b00010000) !== 0;  // bit 4
    const west =  (bitValue & 0b01000000) !== 0;  // bit 6
    
    // Create 4-bit index that directly maps to sprite position
    const tileIndex = (north ? 1 : 0) | 
                     (east ? 2 : 0) | 
                     (south ? 4 : 0) | 
                     (west ? 8 : 0);
    
    const uvCoords = this.getTileUV(tileIndex);
    
    return {
      tileIndex,
      uvX: uvCoords.x,
      uvY: uvCoords.y
    };
  }

  // Convert tile index to UV coordinates
  getTileUV(tileIndex: number): { x: number, y: number } {
    const col = tileIndex % this.config.gridSize;
    const row = Math.floor(tileIndex / this.config.gridSize);
    
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

// Water-specific auto-tiler
export class WaterAutoTiler extends AutoTiler {
  calculateWaterTile(
    x: number,
    y: number,
    getTileType: (x: number, y: number) => string | null
  ): AutoTileResult {
    const currentTile = getTileType(x, y);
    
    if (currentTile === 'coast') {
      // Shallow water/coast - should connect to LAND tiles to form beach edges
      // This creates the proper water-to-land transition
      return this.calculateAutoTile(x, y, getTileType, 'coast', ['grass', 'forest', 'mountain', 'building', 'farm']);
    }
    
    // For deep water, return isolated tile (no auto-tiling needed)
    return {
      tileIndex: 5, // Changed from 13 to 5 to match the new sprite ordering
      uvX: this.getTileUV(5).x,
      uvY: this.getTileUV(5).y
    };
  }
}

// Global instance for water auto-tiling
export const waterAutoTiler = new WaterAutoTiler();
