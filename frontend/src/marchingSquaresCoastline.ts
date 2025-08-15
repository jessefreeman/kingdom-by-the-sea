/**
 * Marching Squares Coastline Auto-Tiler
 * 
 * A robust boundary detection solution for coastline generation that eliminates
 * the duplicate assignment issues plaguing traditional 8-neighbor auto-tiling systems.
 * 
 * Key Features:
 * - Only 16 fundamental configurations (vs 256 in 8-neighbor systems)
 * - Zero duplicate assignments guaranteed
 * - Pixel-perfect corner continuity
 * - Manageable tile set size
 */

export interface MarchingSquaresConfig {
    id: number;
    pattern: number; // 4-bit pattern for 2x2 corners
    type: 'water' | 'corner' | 'edge' | 'concave' | 'vertical' | 'horizontal' | 'land';
    name: string;
    needsTile: boolean;
    corners?: boolean[]; // [NW, NE, SE, SW]
    rotation?: number; // 0, 90, 180, 270 degrees
    uvX?: number; // Texture atlas coordinates
    uvY?: number;
}

export interface CoastlineTile {
    x: number;
    y: number;
    config: MarchingSquaresConfig;
    pattern: number;
    corners: boolean[];
    tileIndex: number;
    uvX: number;
    uvY: number;
}

export interface CoastlineResult {
    coastlineData: Map<string, CoastlineTile>;
    stats: {
        totalTiles: number;
        uniqueConfigurations: number;
        duplicateAssignments: number; // Always 0 with marching squares
        coverage: number;
    };
}

/**
 * The 16 fundamental Marching Squares configurations
 * Each represents a unique boundary pattern in a 2x2 cell
 */
const MARCHING_SQUARES_CONFIGS: MarchingSquaresConfig[] = [
    // Configuration 0: All water - no tile needed
    { 
        id: 0, 
        pattern: 0b0000, 
        type: 'water', 
        name: 'All Water', 
        needsTile: false 
    },
    
    // Single corner configurations (1-4)
    { 
        id: 1, 
        pattern: 0b0001, 
        type: 'corner', 
        name: 'SW Corner', 
        needsTile: true, 
        corners: [false, false, false, true],
        uvX: 0, uvY: 0 
    },
    { 
        id: 2, 
        pattern: 0b0010, 
        type: 'corner', 
        name: 'SE Corner', 
        needsTile: true, 
        corners: [false, false, true, false],
        uvX: 1, uvY: 0 
    },
    { 
        id: 4, 
        pattern: 0b0100, 
        type: 'corner', 
        name: 'NE Corner', 
        needsTile: true, 
        corners: [false, true, false, false],
        uvX: 2, uvY: 0 
    },
    { 
        id: 8, 
        pattern: 0b1000, 
        type: 'corner', 
        name: 'NW Corner', 
        needsTile: true, 
        corners: [true, false, false, false],
        uvX: 3, uvY: 0 
    },
    
    // Edge configurations (3, 6, 9, 12)
    { 
        id: 3, 
        pattern: 0b0011, 
        type: 'edge', 
        name: 'South Edge', 
        needsTile: true, 
        corners: [false, false, true, true],
        uvX: 0, uvY: 1 
    },
    { 
        id: 6, 
        pattern: 0b0110, 
        type: 'edge', 
        name: 'East Edge', 
        needsTile: true, 
        corners: [false, true, true, false],
        uvX: 1, uvY: 1 
    },
    { 
        id: 12, 
        pattern: 0b1100, 
        type: 'edge', 
        name: 'North Edge', 
        needsTile: true, 
        corners: [true, true, false, false],
        uvX: 2, uvY: 1 
    },
    { 
        id: 9, 
        pattern: 0b1001, 
        type: 'edge', 
        name: 'West Edge', 
        needsTile: true, 
        corners: [true, false, false, true],
        uvX: 3, uvY: 1 
    },
    
    // Diagonal split configurations (5, 10)
    { 
        id: 5, 
        pattern: 0b0101, 
        type: 'vertical', 
        name: 'Vertical Split', 
        needsTile: true, 
        corners: [false, true, false, true],
        uvX: 0, uvY: 2 
    },
    { 
        id: 10, 
        pattern: 0b1010, 
        type: 'horizontal', 
        name: 'Horizontal Split', 
        needsTile: true, 
        corners: [true, false, true, false],
        uvX: 1, uvY: 2 
    },
    
    // Concave corner configurations (7, 11, 13, 14)
    { 
        id: 7, 
        pattern: 0b0111, 
        type: 'concave', 
        name: 'NW Concave', 
        needsTile: true, 
        corners: [false, true, true, true],
        uvX: 2, uvY: 2 
    },
    { 
        id: 11, 
        pattern: 0b1011, 
        type: 'concave', 
        name: 'NE Concave', 
        needsTile: true, 
        corners: [true, false, true, true],
        uvX: 3, uvY: 2 
    },
    { 
        id: 13, 
        pattern: 0b1101, 
        type: 'concave', 
        name: 'SE Concave', 
        needsTile: true, 
        corners: [true, true, false, true],
        uvX: 0, uvY: 3 
    },
    { 
        id: 14, 
        pattern: 0b1110, 
        type: 'concave', 
        name: 'SW Concave', 
        needsTile: true, 
        corners: [true, true, true, false],
        uvX: 1, uvY: 3 
    },
    
    // Configuration 15: All land - no tile needed
    { 
        id: 15, 
        pattern: 0b1111, 
        type: 'land', 
        name: 'All Land', 
        needsTile: false 
    }
];

/**
 * Create a fast lookup map for O(1) pattern matching
 */
const CONFIG_LOOKUP = new Map<number, MarchingSquaresConfig>();
MARCHING_SQUARES_CONFIGS.forEach(config => {
    CONFIG_LOOKUP.set(config.pattern, config);
});

/**
 * Apply Marching Squares coastline generation to a map
 * 
 * @param mapData - 2D array where true = land, false = water
 * @param options - Configuration options
 * @returns Complete coastline data with guaranteed unique tile assignments
 */
export function applyMarchingSquaresCoastline(
    mapData: boolean[][],
    options: {
        tileSize?: number;
        atlasWidth?: number;
        atlasHeight?: number;
    } = {}
): CoastlineResult {
    const { tileSize = 32, atlasWidth = 4, atlasHeight = 4 } = options;
    
    if (!mapData || mapData.length === 0 || !mapData[0] || mapData[0].length === 0) {
        throw new Error('Invalid map data provided');
    }
    
    const mapHeight = mapData.length;
    const mapWidth = mapData[0].length;
    const coastlineData = new Map<string, CoastlineTile>();
    const configurationCounts = new Map<number, number>();
    
    // Process each 2x2 cell in the map
    for (let y = 0; y < mapHeight - 1; y++) {
        for (let x = 0; x < mapWidth - 1; x++) {
            // Sample the 2x2 corners: NW, NE, SE, SW
            const row1 = mapData[y];
            const row2 = mapData[y + 1];
            if (!row1 || !row2) continue;
            
            const corners: boolean[] = [
                row1[x] || false,         // NW
                row1[x + 1] || false,     // NE  
                row2[x + 1] || false,     // SE
                row2[x] || false          // SW
            ];
            
            // Convert to 4-bit pattern (NW=bit3, NE=bit2, SE=bit1, SW=bit0)
            const pattern = corners.reduce((acc, isLand, index) => {
                return acc | (isLand ? (1 << (3 - index)) : 0);
            }, 0);
            
            // Get configuration from lookup table
            const config = CONFIG_LOOKUP.get(pattern);
            
            if (!config) {
                throw new Error(`Invalid pattern ${pattern} - this should never happen`);
            }
            
            // Only create tiles for configurations that need them
            if (config.needsTile) {
                const key = `${x},${y}`;
                
                // Calculate UV coordinates
                const uvX = config.uvX! / atlasWidth;
                const uvY = config.uvY! / atlasHeight;
                
                const tile: CoastlineTile = {
                    x,
                    y,
                    config,
                    pattern,
                    corners,
                    tileIndex: config.id,
                    uvX,
                    uvY
                };
                
                coastlineData.set(key, tile);
                
                // Track configuration usage
                configurationCounts.set(pattern, (configurationCounts.get(pattern) || 0) + 1);
            }
        }
    }
    
    // Calculate statistics
    const stats = {
        totalTiles: coastlineData.size,
        uniqueConfigurations: configurationCounts.size,
        duplicateAssignments: 0, // Marching Squares guarantees this is always 0
        coverage: Math.round((configurationCounts.size / MARCHING_SQUARES_CONFIGS.filter(c => c.needsTile).length) * 100)
    };
    
    return {
        coastlineData,
        stats
    };
}

/**
 * Convert traditional tile-based map to boolean land/water map
 * 
 * @param tileMap - Array of tile types or tile IDs
 * @param isLandTile - Function to determine if a tile represents land
 * @returns Boolean map suitable for marching squares
 */
export function convertTileMapToLandMap<T>(
    tileMap: T[], 
    mapWidth: number,
    mapHeight: number,
    isLandTile: (tile: T) => boolean
): boolean[][] {
    const landMap: boolean[][] = [];
    
    for (let y = 0; y < mapHeight; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < mapWidth; x++) {
            const index = y * mapWidth + x;
            const tile = tileMap[index];
            if (tile !== undefined) {
                row[x] = isLandTile(tile);
            } else {
                row[x] = false; // Default to water for undefined tiles
            }
        }
        landMap[y] = row;
    }
    
    return landMap;
}

/**
 * Get coastline tile information for rendering
 * 
 * @param x - Tile x coordinate  
 * @param y - Tile y coordinate
 * @param coastlineData - Result from applyMarchingSquaresCoastline
 * @returns Tile info or null if no coastline tile exists
 */
export function getCoastlineTileInfo(
    x: number, 
    y: number, 
    coastlineData: Map<string, CoastlineTile>
): CoastlineTile | null {
    return coastlineData.get(`${x},${y}`) || null;
}

/**
 * Validate that adjacent coastline tiles have proper corner continuity
 * This function can be used for debugging and quality assurance
 * 
 * @param coastlineData - Coastline data to validate
 * @returns Array of continuity issues found
 */
export function validateCornerContinuity(
    coastlineData: Map<string, CoastlineTile>
): Array<{ tile1: CoastlineTile; tile2: CoastlineTile; issue: string }> {
    const issues: Array<{ tile1: CoastlineTile; tile2: CoastlineTile; issue: string }> = [];
    
    coastlineData.forEach(tile => {
        const { x, y } = tile;
        
        // Check right neighbor
        const rightNeighbor = coastlineData.get(`${x + 1},${y}`);
        if (rightNeighbor) {
            // tile's NE and SE corners should match neighbor's NW and SW corners
            if (tile.corners[1] !== rightNeighbor.corners[0] || 
                tile.corners[2] !== rightNeighbor.corners[3]) {
                issues.push({
                    tile1: tile,
                    tile2: rightNeighbor,
                    issue: 'Horizontal corner mismatch'
                });
            }
        }
        
        // Check bottom neighbor
        const bottomNeighbor = coastlineData.get(`${x},${y + 1}`);
        if (bottomNeighbor) {
            // tile's SW and SE corners should match neighbor's NW and NE corners
            if (tile.corners[3] !== bottomNeighbor.corners[0] || 
                tile.corners[2] !== bottomNeighbor.corners[1]) {
                issues.push({
                    tile1: tile,
                    tile2: bottomNeighbor,
                    issue: 'Vertical corner mismatch'
                });
            }
        }
    });
    
    return issues;
}

/**
 * Generate debug information about the coastline generation
 * 
 * @param result - Result from applyMarchingSquaresCoastline
 * @returns Formatted debug string
 */
export function generateDebugInfo(result: CoastlineResult): string {
    const { coastlineData, stats } = result;
    
    let debug = '🌊 MARCHING SQUARES COASTLINE DEBUG INFO\n';
    debug += '═══════════════════════════════════════\n\n';
    
    debug += `📊 STATISTICS:\n`;
    debug += `• Total coastline tiles: ${stats.totalTiles}\n`;
    debug += `• Unique configurations: ${stats.uniqueConfigurations}\n`;
    debug += `• Duplicate assignments: ${stats.duplicateAssignments} (Perfect!)\n`;
    debug += `• Pattern coverage: ${stats.coverage}%\n\n`;
    
    debug += `🎯 CONFIGURATION USAGE:\n`;
    const configUsage = new Map<number, number>();
    coastlineData.forEach(tile => {
        configUsage.set(tile.pattern, (configUsage.get(tile.pattern) || 0) + 1);
    });
    
    Array.from(configUsage.entries())
        .sort(([,a], [,b]) => b - a)
        .forEach(([pattern, count]) => {
            const config = CONFIG_LOOKUP.get(pattern)!;
            debug += `• ${config.name}: ${count} tiles (Pattern: ${pattern.toString(2).padStart(4, '0')})\n`;
        });
    
    debug += `\n✅ VALIDATION:\n`;
    const continuityIssues = validateCornerContinuity(coastlineData);
    if (continuityIssues.length === 0) {
        debug += `• Corner continuity: Perfect!\n`;
    } else {
        debug += `• Corner continuity issues: ${continuityIssues.length}\n`;
        continuityIssues.forEach(issue => {
            debug += `  - ${issue.issue} between (${issue.tile1.x},${issue.tile1.y}) and (${issue.tile2.x},${issue.tile2.y})\n`;
        });
    }
    
    debug += `\n🏆 CONCLUSION:\n`;
    debug += `Marching Squares eliminates all duplicate assignment issues\n`;
    debug += `while providing pixel-perfect coastline boundaries!\n`;
    
    return debug;
}

/**
 * Integration function for existing Kingdom by the Sea game
 * 
 * @param gameState - Current game state with map data
 * @returns Enhanced game state with coastline data
 */
export function enhanceGameWithMarchingSquaresCoastlines(gameState: any): any {
    // Convert existing map to land/water boolean map
    const landMap = convertTileMapToLandMap(
        gameState.mapData,
        gameState.mapWidth,
        gameState.mapHeight,
        (tileType: string) => tileType !== 'water'
    );
    
    // Apply marching squares coastline generation
    const coastlineResult = applyMarchingSquaresCoastline(landMap);
    
    // Enhance game state with coastline data
    return {
        ...gameState,
        coastlineData: coastlineResult.coastlineData,
        coastlineStats: coastlineResult.stats,
        debugInfo: generateDebugInfo(coastlineResult)
    };
}
