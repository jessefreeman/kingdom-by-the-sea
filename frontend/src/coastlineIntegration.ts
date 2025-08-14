// Demonstration of integrating coastline auto-tiling with Kingdom by the Sea
// This shows how to enhance the existing game with proper coastline rendering

import { waterAutoTiler } from './autoTiler';
import { applyCoastlineTiling } from './coastlineAutoTiler';
import type { Cell, State } from './types';

/**
 * Enhanced map generation that includes coastline auto-tiling
 * This can be called after the normal island generation to add proper coastlines
 */
export function enhanceMapWithCoastlines(state: State): {
  coastlineData: Map<number, any>,
  stats: { totalTiles: number, coastTiles: number, deepWater: number, landTiles: number }
} {
  console.log('🏝️ Applying coastline auto-tiling to generated map...');
  
  // Convert the game's map format to something our auto-tiler can work with
  const mapData = state.map.map((cell: Cell) => ({ type: cell.type }));
  
  // Apply coastline tiling
  const result = applyCoastlineTiling(mapData, state.size.w, state.size.h);
  
  // Update the game state with coastline tiles
  result.processedMap.forEach((cell, index) => {
    if (cell.type === 'coast') {
      (state.map[index] as any).type = 'coast';
    }
  });
  
  console.log(`✅ Coastline processing complete:`, result.stats);
  
  return {
    coastlineData: result.coastlineData,
    stats: result.stats
  };
}

/**
 * Get auto-tile information for rendering a specific water/coast tile
 */
export function getCoastlineTileInfo(x: number, y: number, state: State) {
  const getTileType = (tileX: number, tileY: number): string | null => {
    if (tileX < 0 || tileX >= state.size.w || tileY < 0 || tileY >= state.size.h) {
      return null;
    }
    const index = tileY * state.size.w + tileX;
    const cell = state.map[index] as Cell;
    return cell ? cell.type : null;
  };
  
  return waterAutoTiler.calculateWaterTile(x, y, getTileType);
}

/**
 * Demonstration of how to use coastline tiling in the renderer
 */
export function demonstrateCoastlineRendering() {
  console.log('🎨 Coastline Rendering Demo');
  
  // Get the game state
  const KBTS = (window as any).KBTS;
  if (!KBTS || !KBTS.state) {
    console.error('KBTS game state not available');
    return;
  }
  
  const state = KBTS.state;
  
  // Apply coastline enhancement
  const coastlineResult = enhanceMapWithCoastlines(state);
  
  // Example of how to render each tile with proper coastline auto-tiling
  console.log('📋 Tile rendering information:');
  
  for (let y = 0; y < state.size.h; y++) {
    for (let x = 0; x < state.size.w; x++) {
      const index = y * state.size.w + x;
      const cell = state.map[index] as Cell;
      
      if (cell.type === 'water' || cell.type === 'coast') {
        const tileInfo = getCoastlineTileInfo(x, y, state);
        
        console.log(`Tile (${x},${y}): ${cell.type} -> Pattern: ${tileInfo.patternName}, UV: (${tileInfo.uvX}, ${tileInfo.uvY})`);
      }
    }
  }
  
  // Return information that can be used by the renderer
  return {
    coastlineData: coastlineResult.coastlineData,
    stats: coastlineResult.stats,
    getTileInfo: (x: number, y: number) => getCoastlineTileInfo(x, y, state)
  };
}

/**
 * Integration point for the existing renderer system
 */
export function initCoastlineRenderer() {
  // Hook into the existing renderer to demonstrate coastline tiling
  const originalDraw = (window as any).KBTS_Renderer?._impls?.debug?.draw;
  
  if (originalDraw && typeof originalDraw === 'function') {
    // Enhance the debug renderer with coastline information
    (window as any).KBTS_Renderer._impls.debug.drawWithCoastlines = function() {
      // Call original draw
      originalDraw.call(this);
      
      // Add coastline visualization
      const KBTS = (window as any).KBTS;
      if (KBTS && KBTS.state) {
        const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawCoastlineOverlay(ctx, KBTS.state);
          }
        }
      }
    };
    
    console.log('🔧 Coastline renderer integration complete');
  }
}

/**
 * Draw coastline pattern overlay for debugging
 */
function drawCoastlineOverlay(ctx: CanvasRenderingContext2D, state: State) {
  const cellSize = 32; // Adjust based on your renderer
  
  // Set overlay style
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  
  for (let y = 0; y < state.size.h; y++) {
    for (let x = 0; x < state.size.w; x++) {
      const index = y * state.size.w + x;
      const cell = state.map[index] as Cell;
      
      if (cell.type === 'coast') {
        const tileInfo = getCoastlineTileInfo(x, y, state);
        
        // Draw pattern index
        const drawX = x * cellSize + cellSize / 2;
        const drawY = y * cellSize + cellSize / 2;
        
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        
        ctx.strokeText(tileInfo.tileIndex.toString(), drawX, drawY);
        ctx.fillText(tileInfo.tileIndex.toString(), drawX, drawY);
      }
    }
  }
  
  ctx.restore();
}

// Auto-initialize when this module is loaded
if (typeof window !== 'undefined') {
  // Expose demonstration functions to window for manual testing
  (window as any).CoastlineDemo = {
    enhance: enhanceMapWithCoastlines,
    demonstrate: demonstrateCoastlineRendering,
    init: initCoastlineRenderer,
    getTileInfo: getCoastlineTileInfo
  };
  
  console.log('🌊 Coastline integration loaded. Use CoastlineDemo.demonstrate() to test.');
}
