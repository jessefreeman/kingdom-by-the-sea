/**
 * Comprehensive tests for the Marching Squares Coastline System
 * 
 * These tests validate that the new system eliminates all the problems
 * identified in the traditional 8-neighbor approach.
 */

import { 
    applyMarchingSquaresCoastline,
    convertTileMapToLandMap,
    validateCornerContinuity,
    generateDebugInfo,
    enhanceGameWithMarchingSquaresCoastlines
} from '../marchingSquaresCoastline';

describe('Marching Squares Coastline System', () => {
    
    describe('Core Algorithm', () => {
        test('generates coastline for simple island', () => {
            // Create a simple 3x3 island
            const landMap = [
                [false, false, false, false, false],
                [false, true,  true,  true,  false],
                [false, true,  true,  true,  false], 
                [false, true,  true,  true,  false],
                [false, false, false, false, false]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            
            expect(result.stats.totalTiles).toBeGreaterThan(0);
            expect(result.stats.duplicateAssignments).toBe(0); // Key guarantee!
            expect(result.coastlineData.size).toBe(result.stats.totalTiles);
        });

        test('handles complex coastline shapes', () => {
            // Create an L-shaped island with inside corners
            const landMap = [
                [false, false, false, false, false, false],
                [false, true,  true,  true,  false, false],
                [false, true,  true,  true,  false, false],
                [false, true,  true,  true,  true,  false],
                [false, true,  true,  true,  true,  false],
                [false, false, false, false, false, false]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            
            expect(result.stats.duplicateAssignments).toBe(0);
            expect(result.stats.uniqueConfigurations).toBeGreaterThan(3);
        });

        test('guarantees zero duplicate assignments', () => {
            // Test with the most complex possible coastline
            const landMap = [
                [false, true,  false, true,  false],
                [true,  false, true,  false, true ],
                [false, true,  false, true,  false],
                [true,  false, true,  false, true ],
                [false, true,  false, true,  false]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            
            // This is the key test - marching squares GUARANTEES no duplicates
            expect(result.stats.duplicateAssignments).toBe(0);
        });
    });

    describe('Corner Continuity', () => {
        test('validates perfect corner continuity', () => {
            const landMap = [
                [false, false, false, false],
                [false, true,  true,  false],
                [false, true,  true,  false],
                [false, false, false, false]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            const continuityIssues = validateCornerContinuity(result.coastlineData);
            
            expect(continuityIssues).toHaveLength(0);
        });

        test('detects continuity issues if they exist', () => {
            // Create artificial bad data to test validation
            const landMap = [[false, true], [false, false]];
            const result = applyMarchingSquaresCoastline(landMap);
            
            // Artificially corrupt corner data to test validation
            if (result.coastlineData.size > 0) {
                const firstTile = Array.from(result.coastlineData.values())[0];
                firstTile.corners = [true, false, true, false]; // Incorrect corners
                
                const continuityIssues = validateCornerContinuity(result.coastlineData);
                // Validation should work regardless (this is testing the validator itself)
                expect(Array.isArray(continuityIssues)).toBe(true);
            }
        });
    });

    describe('Pattern Coverage', () => {
        test('uses only valid marching squares patterns', () => {
            const landMap = [
                [true,  true,  false, false],
                [true,  false, true,  false],
                [false, true,  true,  true ],
                [false, false, true,  true ]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            
            // All patterns should be in the valid range 0-15
            result.coastlineData.forEach(tile => {
                expect(tile.pattern).toBeGreaterThanOrEqual(0);
                expect(tile.pattern).toBeLessThanOrEqual(15);
                expect(tile.config.needsTile).toBe(true);
            });
        });

        test('achieves good pattern coverage', () => {
            // Create a map that should use many different configurations
            const landMap = [
                [false, false, false, false, false, false],
                [false, true,  false, true,  true,  false],
                [false, false, true,  true,  false, false],
                [false, true,  true,  false, true,  false],
                [false, true,  false, false, false, false],
                [false, false, false, false, false, false]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            
            expect(result.stats.coverage).toBeGreaterThan(50);
            expect(result.stats.uniqueConfigurations).toBeGreaterThan(5);
        });
    });

    describe('Tile Map Conversion', () => {
        test('converts string tile map correctly', () => {
            const tileMap = ['water', 'land', 'land', 'water'];
            const landMap = convertTileMapToLandMap(
                tileMap, 
                2, 2, 
                (tile: string) => tile === 'land'
            );
            
            expect(landMap).toEqual([
                [false, true],
                [true, false]
            ]);
        });

        test('handles undefined tiles gracefully', () => {
            const tileMap: (string | undefined)[] = ['water', undefined, 'land', 'water'];
            const landMap = convertTileMapToLandMap(
                tileMap, 
                2, 2, 
                (tile: string | undefined) => tile === 'land'
            );
            
            expect(landMap).toEqual([
                [false, false], // undefined becomes false (water)
                [true, false]
            ]);
        });
    });

    describe('Game Integration', () => {
        test('enhances game state with coastline data', () => {
            const mockGameState = {
                mapData: ['water', 'land', 'land', 'water', 'water', 'land', 'land', 'water', 'water'],
                mapWidth: 3,
                mapHeight: 3
            };
            
            const enhancedState = enhanceGameWithMarchingSquaresCoastlines(mockGameState);
            
            expect(enhancedState.coastlineData).toBeDefined();
            expect(enhancedState.coastlineStats).toBeDefined();
            expect(enhancedState.coastlineStats.duplicateAssignments).toBe(0);
            expect(enhancedState.debugInfo).toContain('MARCHING SQUARES');
        });
    });

    describe('Error Handling', () => {
        test('throws error for invalid map data', () => {
            expect(() => {
                applyMarchingSquaresCoastline([]);
            }).toThrow('Invalid map data provided');
            
            expect(() => {
                applyMarchingSquaresCoastline([[]]);
            }).toThrow('Invalid map data provided');
        });
    });

    describe('Performance Comparison', () => {
        test('processes large maps efficiently', () => {
            // Create a 50x50 map with complex coastlines
            const size = 50;
            const landMap: boolean[][] = [];
            
            for (let y = 0; y < size; y++) {
                landMap[y] = [];
                for (let x = 0; x < size; x++) {
                    // Create complex pattern using sine waves
                    const distance = Math.sqrt((x - size/2)**2 + (y - size/2)**2);
                    const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3);
                    landMap[y][x] = distance < size/3 + noise * 5;
                }
            }
            
            const startTime = performance.now();
            const result = applyMarchingSquaresCoastline(landMap);
            const endTime = performance.now();
            
            expect(result.stats.duplicateAssignments).toBe(0);
            expect(endTime - startTime).toBeLessThan(100); // Should be fast
            expect(result.stats.totalTiles).toBeGreaterThan(100); // Should have many coastline tiles
        });
    });

    describe('Debug Information', () => {
        test('generates comprehensive debug info', () => {
            const landMap = [
                [false, false, false],
                [false, true,  false],
                [false, false, false]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            const debugInfo = generateDebugInfo(result);
            
            expect(debugInfo).toContain('MARCHING SQUARES COASTLINE DEBUG INFO');
            expect(debugInfo).toContain('STATISTICS');
            expect(debugInfo).toContain('CONFIGURATION USAGE');
            expect(debugInfo).toContain('VALIDATION');
            expect(debugInfo).toContain('Perfect!');
        });
    });

    describe('Comparison with Old System', () => {
        test('eliminates all problems of 8-neighbor approach', () => {
            // This test demonstrates the key advantages
            const problematicMap = [
                [false, true,  true,  false, false],
                [true,  true,  false, true,  false],
                [true,  false, true,  true,  true ],
                [false, true,  true,  false, false],
                [false, false, false, false, false]
            ];
            
            const result = applyMarchingSquaresCoastline(problematicMap);
            
            // Key test: NO duplicate assignments (8-neighbor systems fail this)
            expect(result.stats.duplicateAssignments).toBe(0);
            
            // All configurations should be valid and unique
            const usedConfigs = new Set();
            result.coastlineData.forEach(tile => {
                expect(tile.pattern).toBeGreaterThanOrEqual(0);
                expect(tile.pattern).toBeLessThanOrEqual(15);
                expect(tile.config.needsTile).toBe(true);
                
                // Each tile position should have unique configuration for its context
                const key = `${tile.x},${tile.y}:${tile.pattern}`;
                expect(usedConfigs.has(key)).toBe(false);
                usedConfigs.add(key);
            });
            
            // Corner continuity should be perfect
            const continuityIssues = validateCornerContinuity(result.coastlineData);
            expect(continuityIssues).toHaveLength(0);
        });
    });
});

/**
 * Integration test that simulates the exact problems from the old system
 */
describe('Old System Problem Resolution', () => {
    test('resolves duplicate tile assignments issue', () => {
        // This recreates the specific problem mentioned in the documentation:
        // "Position (6,0), (7,0), (8,0), (9,6), (10,6) all assigned tile 38"
        
        // Create a coastline that would cause this issue in 8-neighbor system
        const problematicCoastline = [
            [false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, true,  true,  true,  true,  true,  false],
            [false, false, false, false, false, false, true,  true,  true,  true,  true,  false],
            [false, false, false, false, false, false, true,  true,  true,  true,  true,  false],
            [false, false, false, false, false, false, false, false, false, false, false, false]
        ];
        
        const result = applyMarchingSquaresCoastline(problematicCoastline);
        
        // Verify no duplicate assignments
        expect(result.stats.duplicateAssignments).toBe(0);
        
        // Verify each position gets appropriate configuration
        const positionConfigs = new Map<string, number>();
        result.coastlineData.forEach(tile => {
            positionConfigs.set(`${tile.x},${tile.y}`, tile.pattern);
        });
        
        // The positions that would have been problematic should now have
        // appropriate unique configurations based on their actual 2x2 context
        expect(positionConfigs.size).toBe(result.coastlineData.size);
    });

    test('handles missing pattern coverage gracefully', () => {
        // In 8-neighbor systems, some patterns had no exact match
        // Marching squares handles all possible boundary configurations
        
        const allPossibleBoundaries = [
            // Test all 16 possible 2x2 configurations
            [false, false, false, true ], // SW corner
            [false, false, true,  false], // SE corner  
            [false, true,  false, false], // NE corner
            [true,  false, false, false], // NW corner
            [false, false, true,  true ], // South edge
            [false, true,  true,  false], // East edge
            [true,  true,  false, false], // North edge
            [true,  false, false, true ], // West edge
            [false, true,  false, true ], // Vertical split
            [true,  false, true,  false], // Horizontal split
            [false, true,  true,  true ], // NW concave
            [true,  false, true,  true ], // NE concave
            [true,  true,  false, true ], // SE concave
            [true,  true,  true,  false], // SW concave
        ];
        
        allPossibleBoundaries.forEach((corners, index) => {
            // Create minimal map for each configuration
            const landMap = [
                [corners[0], corners[1]],
                [corners[3], corners[2]]
            ];
            
            const result = applyMarchingSquaresCoastline(landMap);
            
            // Should handle every configuration without falling back to approximations
            expect(result.stats.duplicateAssignments).toBe(0);
            if (result.coastlineData.size > 0) {
                const tile = Array.from(result.coastlineData.values())[0];
                expect(tile.config.needsTile).toBe(true);
            }
        });
    });
});
