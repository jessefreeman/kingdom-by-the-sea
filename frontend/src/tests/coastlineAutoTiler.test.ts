// Browser-run TS tests for Coastline Auto-Tiler
// Unit tests for the coastline auto-tiling system

import { CoastlineAutoTiler, COASTLINE_PATTERNS, applyCoastlineTiling } from '../coastlineAutoTiler';

(function runCoastlineTests() {
  function tests() {
    const as = (cond: any, msg: string) => { if (!cond) throw new Error(msg); };
    
    console.log('🏝️ Running Coastline Auto-Tiler Tests...');
    
    let autoTiler = new CoastlineAutoTiler();
    
    // Test 1: Pattern Recognition - Deep Water
    {
      const getTileType = (x: number, y: number) => {
        if (x >= 0 && x < 3 && y >= 0 && y < 3) return 'water';
        return null;
      };

      const result = autoTiler.calculateCoastlineTile(1, 1, getTileType);
      as(result !== null, 'deep water result should not be null');
      as(result!.tileIndex === 0, 'deep water should have tile index 0');
      as(result!.patternName === 'Deep Water', 'deep water should have correct pattern name');
      console.log('✅ Deep water pattern recognition test passed');
    }
    
    // Test 2: Single Direction Coastlines
    {
      const getTileType = (x: number, y: number) => {
        if (x === 1 && y === 0) return 'grass'; // North
        if (x === 1 && y === 1) return 'water'; // Center
        return 'water';
      };

      const result = autoTiler.calculateCoastlineTile(1, 1, getTileType);
      as(result !== null, 'north coast result should not be null');
      as(result!.tileIndex === 1, 'north coast should have tile index 1');
      as(result!.patternName === 'North Coast', 'north coast should have correct pattern name');
      console.log('✅ North coast pattern recognition test passed');
    }
    
    // Test 3: Outside Corners (Convex)
    {
      const getTileType = (x: number, y: number) => {
        if ((x === 1 && y === 0) || (x === 2 && y === 1)) return 'grass';
        if (x === 1 && y === 1) return 'water';
        return 'water';
      };

      const result = autoTiler.calculateCoastlineTile(1, 1, getTileType);
      as(result !== null, 'NE outer corner result should not be null');
      as(result!.tileIndex === 7, 'NE outer corner should have tile index 7');
      as(result!.patternName === 'NE Outer Corner', 'NE outer corner should have correct pattern name');
      console.log('✅ Outside corner pattern recognition test passed');
    }
    
    // Test 4: Inside Corners (Concave)
    {
      const getTileType = (x: number, y: number) => {
        const landPositions = [
          [1, 0], // North
          [2, 0], // NorthEast
          [2, 1]  // East
        ];
        
        for (const [lx, ly] of landPositions) {
          if (x === lx && y === ly) return 'grass';
        }
        
        if (x === 1 && y === 1) return 'water';
        return 'water';
      };

      const result = autoTiler.calculateCoastlineTile(1, 1, getTileType);
      as(result !== null, 'NE inside corner result should not be null');
      as(result!.tileIndex === 16, 'NE inside corner should have tile index 16');
      as(result!.patternName === 'NE Inside Corner', 'NE inside corner should have correct pattern name');
      console.log('✅ Inside corner pattern recognition test passed');
    }
    
    // Test 5: UV Coordinate Calculation
    {
      const tileSize = 64;
      const tilesPerRow = 8;
      const config = { textureSize: 512, tileSize, tilesPerRow };
      const tiler = new CoastlineAutoTiler(config);

      // Test first tile (top-left)
      const uv0 = tiler.getTileUV(0);
      as(uv0.x === 0 && uv0.y === 0, 'tile 0 should be at (0,0)');

      // Test tile in second row, first column
      const uv8 = tiler.getTileUV(8);
      as(uv8.x === 0 && uv8.y === tileSize, 'tile 8 should be at (0,64)');

      // Test tile in first row, second column
      const uv1 = tiler.getTileUV(1);
      as(uv1.x === tileSize && uv1.y === 0, 'tile 1 should be at (64,0)');

      console.log('✅ UV coordinate calculation test passed');
    }
    
    // Test 6: Map Processing
    {
      // Create a 5x5 map with a small island in the center
      const mapData = Array(25).fill(0).map((_, i) => {
        const x = i % 5;
        const y = Math.floor(i / 5);
        
        // Island in center (2,2)
        if (x === 2 && y === 2) {
          return { type: 'grass' };
        }
        return { type: 'water' };
      });

      const result = autoTiler.processMap(
        mapData,
        5,
        5,
        (tile) => tile.type
      );

      as(result.stats.totalTiles === 25, 'should process all 25 tiles');
      as(result.stats.landTiles === 1, 'should have 1 land tile');
      as(result.stats.coastTiles === 4, 'should have 4 coast tiles adjacent to island');
      as(result.stats.deepWater === 20, 'should have 20 deep water tiles');
      as(result.coastlineData.size === 4, 'should have coastline data for 4 tiles');

      console.log('✅ Map processing test passed');
    }
    
    // Test 7: Pattern Coverage and Validation
    {
      as(COASTLINE_PATTERNS.length === 47, 'should have exactly 47 patterns');
      
      const ids = COASTLINE_PATTERNS.map(p => p.id);
      const uniqueIds = new Set(ids);
      as(uniqueIds.size === 47, 'all pattern IDs should be unique');
      
      const patterns = COASTLINE_PATTERNS.map(p => p.pattern);
      const uniquePatterns = new Set(patterns);
      as(uniquePatterns.size === 47, 'all bit patterns should be unique');
      
      // Check for essential patterns
      const patternMap = new Map(COASTLINE_PATTERNS.map(p => [p.pattern, p]));
      as(patternMap.has(0b00000000), 'should have deep water pattern');
      as(patternMap.has(0b00000001), 'should have north coast pattern');
      as(patternMap.has(0b00000101), 'should have NE outer corner pattern');
      as(patternMap.has(0b00000111), 'should have NE inside corner pattern');
      as(patternMap.has(0b01010101), 'should have cross pattern');
      
      console.log('✅ Pattern coverage validation test passed');
    }
    
    // Test 8: Integration with Kingdom by the Sea
    {
      const map = [
        { type: 'water' }, { type: 'water' }, { type: 'water' },
        { type: 'water' }, { type: 'grass' }, { type: 'water' },
        { type: 'water' }, { type: 'water' }, { type: 'water' }
      ];

      const result = applyCoastlineTiling(map, 3, 3);

      as(result.stats.landTiles === 1, 'should have 1 land tile');
      as(result.stats.coastTiles > 0, 'should have coastline tiles');
      
      const coastTiles = result.processedMap.filter(tile => tile.type === 'coast');
      as(coastTiles.length === result.stats.coastTiles, 'coast tile count should match');

      console.log('✅ Integration with Kingdom by the Sea test passed');
    }
    
    // Test 9: Edge Case - Null Tile Types
    {
      const getTileType = (x: number, y: number) => {
        if (x === 1 && y === 1) return 'water';
        return null; // Out of bounds
      };

      const result = autoTiler.calculateCoastlineTile(1, 1, getTileType);
      as(result !== null, 'result should not be null for out-of-bounds neighbors');
      as(result!.tileIndex === 0, 'should be deep water when no adjacent land');

      console.log('✅ Edge case handling test passed');
    }
    
    // Test 10: Performance with Large Maps
    {
      const mapSize = 50; // Reduced size for browser testing
      const mapData = Array(mapSize * mapSize).fill(0).map((_, i) => {
        const x = i % mapSize;
        const y = Math.floor(i / mapSize);
        
        // Create a circular island
        const centerX = mapSize / 2;
        const centerY = mapSize / 2;
        const radius = mapSize / 4;
        const distance = Math.hypot(x - centerX, y - centerY);
        
        return {
          type: distance < radius ? 'grass' : 'water'
        };
      });

      const startTime = performance.now();
      const result = autoTiler.processMap(
        mapData,
        mapSize,
        mapSize,
        (tile) => tile.type
      );
      const endTime = performance.now();

      as(endTime - startTime < 500, 'should complete large map processing in reasonable time');
      as(result.stats.totalTiles === mapSize * mapSize, 'should process all tiles');
      as(result.stats.coastTiles > 0, 'should have coastline tiles');

      console.log(`✅ Performance test passed (${Math.round(endTime - startTime)}ms for ${mapSize}x${mapSize} map)`);
    }
    
    console.log('🎉 All Coastline Auto-Tiler tests passed!');
  }

  try {
    tests();
  } catch (e) {
    console.error('❌ Coastline Auto-Tiler test failed:', e);
    throw e;
  }
})();

// Export for manual testing
if (typeof window !== 'undefined') {
  (window as any).CoastlineTests = {
    CoastlineAutoTiler,
    COASTLINE_PATTERNS,
    applyCoastlineTiling
  };
}
