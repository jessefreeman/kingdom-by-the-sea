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
  private lookupTable: number[];

  constructor(config: AutoTileConfig = { textureSize: 64, tileSize: 16, gridSize: 4 }) {
    this.config = config;
    this.lookupTable = this.generateLookupTable();
  }

  // Generate the 256-entry lookup table mapping bit patterns to tile indices
  private generateLookupTable(): number[] {
    const table = new Array(256);
    
    // Initialize all entries to isolated tile (index 13)
    table.fill(13);
    
    // Define patterns for each tile index based on the template
    // Using cardinal directions (N, E, S, W) as primary connections
    
    // Isolated tile (no connections)
    table[0b00000000] = 13;
    
    // Single connections
    table[0b00000001] = 1;  // North only - top edge
    table[0b00000100] = 3;  // East only - right edge  
    table[0b00010000] = 9;  // South only - bottom edge
    table[0b01000000] = 4;  // West only - left edge
    
    // Opposite connections (straight lines)
    table[0b00010001] = 12; // North + South - vertical line
    table[0b01000100] = 11; // East + West - horizontal line
    
    // Adjacent connections (corners)
    table[0b00000101] = 2;  // North + East - top-right corner
    table[0b00010100] = 7;  // East + South - bottom-right corner
    table[0b01010000] = 8;  // South + West - bottom-left corner
    table[0b01000001] = 0;  // West + North - top-left corner
    
    // Three connections  
    table[0b00010101] = 14; // North + East + South
    table[0b01010100] = 14; // East + South + West  
    table[0b01010001] = 14; // South + West + North
    table[0b01000101] = 14; // West + North + East
    
    // Full connections
    table[0b01010101] = 5;  // All cardinal directions
    
    // Add diagonal awareness for smoother transitions
    for (let i = 0; i < 256; i++) {
      const north = (i & 0b00000001) !== 0;
      const northEast = (i & 0b00000010) !== 0;
      const east = (i & 0b00000100) !== 0;
      const southEast = (i & 0b00001000) !== 0;
      const south = (i & 0b00010000) !== 0;
      const southWest = (i & 0b00100000) !== 0;
      const west = (i & 0b01000000) !== 0;
      const northWest = (i & 0b10000000) !== 0;
      
      // If we have all four cardinal directions, check for inner corners
      if (north && east && south && west) {
        if (!northEast && !southEast && !southWest && !northWest) {
          table[i] = 6; // Inner corners variant
        } else if (!northEast || !southEast || !southWest || !northWest) {
          table[i] = 10; // Partial inner corners
        } else {
          table[i] = 5; // Full connection
        }
      }
    }
    
    return table;
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
    
    const tileIndex = this.lookupTable[bitValue] || 13;
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
      // Shallow water/coast - connects to water and creates beach edges against land
      return this.calculateAutoTile(x, y, getTileType, 'coast', ['water', 'coast']);
    }
    
    // For deep water, return isolated tile (no auto-tiling needed)
    return {
      tileIndex: 13,
      uvX: this.getTileUV(13).x,
      uvY: this.getTileUV(13).y
    };
  }
}

// Global instance for water auto-tiling
export const waterAutoTiler = new WaterAutoTiler();
