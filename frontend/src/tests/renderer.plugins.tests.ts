// Test the new renderer plugins

import { GameEngine } from '../engine';
import { NoOpPlugin, ThreeRendererPlugin, Canvas2DRendererPlugin } from '../plugins';

export function testRendererPlugins(): void {
  console.log('=== Testing Renderer Plugins ===');
  
  // Get target element
  const targetElement = document.getElementById('app');
  if (!targetElement) {
    console.error('❌ Target element #app not found');
    return;
  }

  try {
    // Test Canvas2D renderer
    testCanvas2DRenderer(targetElement);
    
    // Test after a delay to see the Canvas2D renderer first
    setTimeout(() => {
      testThreeRenderer(targetElement);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Renderer plugin test failed:', error);
  }
}

function testCanvas2DRenderer(targetElement: HTMLElement): void {
  console.log('--- Testing Canvas2D Renderer ---');
  
  const engine = new GameEngine({
    seed: 'canvas2d-test',
    timestepMs: 33.333, // 30 Hz
    plugins: [new Canvas2DRendererPlugin()],
    config: { renderer: 'canvas2d' }
  });

  engine.init().then(() => {
    console.log('✅ Canvas2D engine initialized');
    
    // Mount the renderer
    const rendererPlugin = engine.getPlugins()[0] as Canvas2DRendererPlugin;
    rendererPlugin.mount(targetElement).then(() => {
      console.log('✅ Canvas2D renderer mounted');
      
      // Set up some test state
      const testState = engine.getState() as any;
      testState.map.width = 8;
      testState.map.height = 6;
      testState.map.cells = [];
      
      // Create a simple test map
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 8; x++) {
          const isWater = x === 0 || x === 7 || y === 0 || y === 5;
          const isCenter = x >= 2 && x <= 5 && y >= 2 && y <= 3;
          
          testState.map.cells.push({
            type: isWater ? 'water' : isCenter ? 'forest' : 'grass',
            disc: true,
            upg: null,
            wrk: 0,
            fx: 0,
            h: isCenter ? 1 : 0,
          });
        }
      }
      
      // Set selection on center tile
      testState.game.sel = 2 * 8 + 3; // Row 2, Col 3
      
      engine.setState(testState);
      engine.start();
      
      console.log('✅ Canvas2D renderer running with test map');
      
      // Store reference for cleanup
      (window as any).canvas2dEngine = engine;
      
    }).catch(error => {
      console.error('❌ Canvas2D renderer mount failed:', error);
    });
    
  }).catch(error => {
    console.error('❌ Canvas2D engine initialization failed:', error);
  });
}

function testThreeRenderer(targetElement: HTMLElement): void {
  console.log('--- Testing Three.js Renderer ---');
  
  // Clean up previous renderer
  const prevEngine = (window as any).canvas2dEngine;
  if (prevEngine) {
    prevEngine.stop();
    console.log('✅ Previous Canvas2D engine stopped');
  }
  
  const engine = new GameEngine({
    seed: 'three-test',
    timestepMs: 33.333, // 30 Hz
    plugins: [new ThreeRendererPlugin()],
    config: { renderer: 'three' }
  });

  engine.init().then(() => {
    console.log('✅ Three.js engine initialized');
    
    // Mount the renderer
    const rendererPlugin = engine.getPlugins()[0] as ThreeRendererPlugin;
    rendererPlugin.mount(targetElement).then(() => {
      console.log('✅ Three.js renderer mounted');
      
      // Set up the same test state as Canvas2D
      const testState = engine.getState() as any;
      testState.map.width = 8;
      testState.map.height = 6;
      testState.map.cells = [];
      
      // Create the same test map
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 8; x++) {
          const isWater = x === 0 || x === 7 || y === 0 || y === 5;
          const isCenter = x >= 2 && x <= 5 && y >= 2 && y <= 3;
          
          testState.map.cells.push({
            type: isWater ? 'water' : isCenter ? 'forest' : 'grass',
            disc: true,
            upg: null,
            wrk: 0,
            fx: 0,
            h: isCenter ? 2 : 0, // Higher for 3D effect
          });
        }
      }
      
      testState.game.sel = 2 * 8 + 3;
      
      engine.setState(testState);
      engine.start();
      
      console.log('✅ Three.js renderer running with test map');
      
      // Store reference for cleanup
      (window as any).threeEngine = engine;
      
    }).catch(error => {
      console.error('❌ Three.js renderer mount failed:', error);
    });
    
  }).catch(error => {
    console.error('❌ Three.js engine initialization failed:', error);
  });
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('Renderer plugin test available as window.testRendererPlugins()');
  (window as any).testRendererPlugins = testRendererPlugins;
}
