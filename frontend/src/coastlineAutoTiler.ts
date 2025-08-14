// Enhanced coastline auto-tiling system for Kingdom by the Sea
// Handles 8-neighbor evaluation for smooth coastline generation

export interface CoastlineConfig {
  textureSize: number;
  tileSize: number;
  tilesPerRow: number;
}

export interface CoastlineResult {
  tileIndex: number;
  uvX: number;
  uvY: number;
  patternName: string;
}

// 47-tile Wang pattern definitions for coastlines
export const COASTLINE_PATTERNS = [
  // Basic isolated patterns
  { id: 0, pattern: 0b00000000, name: "Deep Water" },
  { id: 1, pattern: 0b00000001, name: "North Coast" },
  { id: 2, pattern: 0b00000100, name: "East Coast" },
  { id: 3, pattern: 0b00010000, name: "South Coast" },
  { id: 4, pattern: 0b01000000, name: "West Coast" },
  
  // Straight coastlines
  { id: 5, pattern: 0b00010001, name: "Vertical Coast" },
  { id: 6, pattern: 0b01000100, name: "Horizontal Coast" },
  
  // Outside corners (convex)
  { id: 7, pattern: 0b00000101, name: "NE Outer Corner" },
  { id: 8, pattern: 0b00010100, name: "SE Outer Corner" },
  { id: 9, pattern: 0b01010000, name: "SW Outer Corner" },
  { id: 10, pattern: 0b01000001, name: "NW Outer Corner" },
  
  // T-junctions
  { id: 11, pattern: 0b00010101, name: "North T-Junction" },
  { id: 12, pattern: 0b01010100, name: "East T-Junction" },
  { id: 13, pattern: 0b01010001, name: "South T-Junction" },
  { id: 14, pattern: 0b01000101, name: "West T-Junction" },
  
  // Cross pattern
  { id: 15, pattern: 0b01010101, name: "Cross Coast" },
  
  // Inside corners (concave) - critical for smooth coastlines!
  { id: 16, pattern: 0b00000111, name: "NE Inside Corner" },
  { id: 17, pattern: 0b00011100, name: "SE Inside Corner" },
  { id: 18, pattern: 0b01110000, name: "SW Inside Corner" },
  { id: 19, pattern: 0b11000001, name: "NW Inside Corner" },
  
  // Diagonal-only connections
  { id: 20, pattern: 0b00000010, name: "NE Diagonal" },
  { id: 21, pattern: 0b00001000, name: "SE Diagonal" },
  { id: 22, pattern: 0b00100000, name: "SW Diagonal" },
  { id: 23, pattern: 0b10000000, name: "NW Diagonal" },
  
  // Cardinal + diagonal combinations
  { id: 24, pattern: 0b00000011, name: "North + NE" },
  { id: 25, pattern: 0b00001100, name: "East + SE" },
  { id: 26, pattern: 0b00110000, name: "South + SW" },
  { id: 27, pattern: 0b11000000, name: "West + NW" },
  
  // Complex inside corners
  { id: 28, pattern: 0b01000111, name: "Complex NE Inside" },
  { id: 29, pattern: 0b01011100, name: "Complex SE Inside" },
  { id: 30, pattern: 0b01110001, name: "Complex SW Inside" },
  { id: 31, pattern: 0b11000101, name: "Complex NW Inside" },
  
  // Triple connections
  { id: 32, pattern: 0b00011111, name: "Triple NE" },
  { id: 33, pattern: 0b01111100, name: "Triple SE" },
  { id: 34, pattern: 0b11110000, name: "Triple SW" },
  { id: 35, pattern: 0b11000011, name: "Triple NW" },
  
  // Almost full with missing diagonals
  { id: 36, pattern: 0b01010111, name: "Full minus NW" },
  { id: 37, pattern: 0b01011101, name: "Full minus SW" },
  { id: 38, pattern: 0b01110101, name: "Full minus SE" },
  { id: 39, pattern: 0b11010101, name: "Full minus NE" },
  
  // Double diagonal patterns
  { id: 40, pattern: 0b00001010, name: "NE+SE Diagonals" },
  { id: 41, pattern: 0b00101000, name: "SE+SW Diagonals" },
  { id: 42, pattern: 0b10100000, name: "SW+NW Diagonals" },
  { id: 43, pattern: 0b10000010, name: "NW+NE Diagonals" },
  
  // Near-full patterns
  { id: 44, pattern: 0b01111111, name: "Almost Full A" },
  { id: 45, pattern: 0b11111101, name: "Almost Full B" },
  { id: 46, pattern: 0b11111111, name: "Surrounded" }
];

export class CoastlineAutoTiler {
  private config: CoastlineConfig;
  private patternLookup: Map<number, number>;

  constructor(config: CoastlineConfig = { 
    textureSize: 512, 
    tileSize: 64, 
    tilesPerRow: 8 
  }) {
    this.config = config;
    this.patternLookup = new Map();
    
    // Build pattern lookup table for fast access
    COASTLINE_PATTERNS.forEach(pattern => {
      this.patternLookup.set(pattern.pattern, pattern.id);
    });
  }

  /**
   * Calculate coastline auto-tile for a water tile
   * This is the main entry point for coastline tiling
   */
  calculateCoastlineTile(
    x: number,
    y: number,
    getTileType: (x: number, y: number) => string | null,
    waterTypes: string[] = ['water', 'coast']
  ): CoastlineResult | null {
    const currentTile = getTileType(x, y);
    
    // Only process water tiles
    if (!waterTypes.includes(currentTile || '')) {
      return null;
    }
    
    // Check if this water tile is adjacent to land
    if (!this.isAdjacentToLand(x, y, getTileType, waterTypes)) {
      // This is deep water - return the base water pattern
      return this.createResult(0, "Deep Water");
    }
    
    // This is a coastline tile - calculate its pattern
    const pattern = this.calculateLandPattern(x, y, getTileType, waterTypes);
    const tileId = this.findBestTileMatch(pattern);
    const patternData = COASTLINE_PATTERNS.find(p => p.id === tileId);
    
    return this.createResult(tileId, patternData?.name || "Unknown");
  }

  /**
   * Check if a water tile has any adjacent land
   */
  private isAdjacentToLand(
    x: number, 
    y: number, 
    getTileType: (x: number, y: number) => string | null,
    waterTypes: string[]
  ): boolean {
    const directions: [number, number][] = [
      [-1, -1], [0, -1], [1, -1],  // NW, N, NE
      [-1,  0],          [1,  0],  // W,     E  
      [-1,  1], [0,  1], [1,  1]   // SW, S, SE
    ];
    
    for (const [dx, dy] of directions) {
      const neighborType = getTileType(x + dx, y + dy);
      
      // If neighbor exists and is not water, this water tile is adjacent to land
      if (neighborType && !waterTypes.includes(neighborType)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate 8-neighbor land pattern for a water tile
   * Returns a bitmask where each bit represents presence of land in that direction
   */
  private calculateLandPattern(
    x: number, 
    y: number, 
    getTileType: (x: number, y: number) => string | null,
    waterTypes: string[]
  ): number {
    let pattern = 0;
    
    // 8-direction check: for water tile, we check where LAND is
    const directions = [
      { dx: 0, dy: -1, bit: 0 },  // North
      { dx: 1, dy: -1, bit: 1 },  // NorthEast
      { dx: 1, dy: 0, bit: 2 },   // East
      { dx: 1, dy: 1, bit: 3 },   // SouthEast
      { dx: 0, dy: 1, bit: 4 },   // South
      { dx: -1, dy: 1, bit: 5 },  // SouthWest
      { dx: -1, dy: 0, bit: 6 },  // West
      { dx: -1, dy: -1, bit: 7 }  // NorthWest
    ];
    
    for (const dir of directions) {
      const neighborType = getTileType(x + dir.dx, y + dir.dy);
      
      // If neighbor is land (not water or null), set the bit
      if (neighborType && !waterTypes.includes(neighborType)) {
        pattern |= (1 << dir.bit);
      }
    }
    
    return pattern;
  }

  /**
   * Find the best matching tile for a given land pattern
   */
  private findBestTileMatch(pattern: number): number {
    // First try exact match
    if (this.patternLookup.has(pattern)) {
      return this.patternLookup.get(pattern)!;
    }
    
    // If no exact match, find closest match by bit similarity
    let bestMatch = 0;
    let bestScore = -1;
    
    for (const tile of COASTLINE_PATTERNS) {
      const score = this.calculatePatternSimilarity(pattern, tile.pattern);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = tile.id;
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate similarity between two bit patterns
   */
  private calculatePatternSimilarity(pattern1: number, pattern2: number): number {
    const xor = pattern1 ^ pattern2;
    const differentBits = this.countSetBits(xor);
    return 8 - differentBits; // Higher score = more similar
  }

  /**
   * Count number of set bits in a number
   */
  private countSetBits(n: number): number {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }

  /**
   * Create a result object with UV coordinates
   */
  private createResult(tileId: number, patternName: string): CoastlineResult {
    const uvCoords = this.getTileUV(tileId);
    
    return {
      tileIndex: tileId,
      uvX: uvCoords.x,
      uvY: uvCoords.y,
      patternName
    };
  }

  /**
   * Convert tile index to UV coordinates in the texture atlas
   */
  getTileUV(tileIndex: number): { x: number, y: number } {
    const col = tileIndex % this.config.tilesPerRow;
    const row = Math.floor(tileIndex / this.config.tilesPerRow);
    
    return {
      x: col * this.config.tileSize,
      y: row * this.config.tileSize
    };
  }

  /**
   * Get normalized UV coordinates (0-1 range) for shaders
   */
  getTileUVNormalized(tileIndex: number): { x: number, y: number, width: number, height: number } {
    const uv = this.getTileUV(tileIndex);
    return {
      x: uv.x / this.config.textureSize,
      y: uv.y / this.config.textureSize,
      width: this.config.tileSize / this.config.textureSize,
      height: this.config.tileSize / this.config.textureSize
    };
  }

  /**
   * Process an entire map and generate coastline tiles
   * Returns a map where water tiles adjacent to land are marked as 'coast'
   */
  processMap<T>(
    mapData: T[],
    mapWidth: number,
    mapHeight: number,
    getTileType: (tile: T) => string,
    waterTypes: string[] = ['water'],
    coastType: string = 'coast'
  ): { 
    processedMap: T[], 
    coastlineData: Map<number, CoastlineResult>,
    stats: { totalTiles: number, coastTiles: number, deepWater: number, landTiles: number }
  } {
    const processedMap = [...mapData];
    const coastlineData = new Map<number, CoastlineResult>();
    const stats = { totalTiles: mapData.length, coastTiles: 0, deepWater: 0, landTiles: 0 };
    
    const getTileTypeAt = (x: number, y: number): string | null => {
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
        return null; // Out of bounds
      }
      const index = y * mapWidth + x;
      const tile = mapData[index];
      return tile ? getTileType(tile) : null;
    };
    
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const index = y * mapWidth + x;
        const tile = mapData[index];
        if (!tile) continue;
        
        const tileType = getTileType(tile);
        
        if (waterTypes.includes(tileType)) {
          const coastlineResult = this.calculateCoastlineTile(x, y, getTileTypeAt, waterTypes);
          
          if (coastlineResult) {
            if (coastlineResult.tileIndex === 0) {
              // Deep water
              stats.deepWater++;
            } else {
              // Coastline water
              stats.coastTiles++;
              coastlineData.set(index, coastlineResult);
              
              // Update the tile type to coast if it's not already
              if (tileType !== coastType) {
                (processedMap[index] as any).type = coastType;
              }
            }
          }
        } else {
          stats.landTiles++;
        }
      }
    }
    
    return { processedMap, coastlineData, stats };
  }
}

// Global coastline auto-tiler instance
export const coastlineAutoTiler = new CoastlineAutoTiler();

/**
 * Utility function to apply coastline tiling to a Kingdom by the Sea map
 */
export function applyCoastlineTiling(
  map: Array<{ type: string }>,
  mapWidth: number,
  mapHeight: number
): {
  processedMap: Array<{ type: string }>,
  coastlineData: Map<number, CoastlineResult>,
  stats: { totalTiles: number, coastTiles: number, deepWater: number, landTiles: number }
} {
  return coastlineAutoTiler.processMap(
    map,
    mapWidth,
    mapHeight,
    (tile) => tile.type,
    ['water'],
    'coast'
  );
}
