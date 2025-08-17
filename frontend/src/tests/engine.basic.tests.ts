// Test the new engine implementation

import { GameEngine } from '../engine';
import { NoOpPlugin } from '../plugins';

export function testEngineBasics(): void {
  console.log('=== Testing Engine Basics ===');
  
  try {
    // Create engine with no-op plugin
    const engine = new GameEngine({
      seed: 'test-engine-seed',
      timestepMs: 16.667, // 60 Hz for test
      plugins: [new NoOpPlugin()],
      config: {
        debug: true
      }
    });

    console.log('✅ Engine created successfully');

    // Initialize
    engine.init().then(() => {
      console.log('✅ Engine initialized successfully');
      
      // Start for a short time
      engine.start();
      console.log('✅ Engine started successfully');
      
      // Let it run for 2 seconds then stop
      setTimeout(() => {
        engine.stop();
        console.log('✅ Engine stopped successfully');
        
        // Test state access
        const state = engine.getState() as any; // Type assertion for test
        console.log('✅ State accessed:', {
          seed: state.seed,
          tick: state.tick,
          mapSize: `${state.map.width}x${state.map.height}`
        });
        
        console.log('=== Engine test complete ===');
      }, 2000);
      
    }).catch(error => {
      console.error('❌ Engine initialization failed:', error);
    });
    
  } catch (error) {
    console.error('❌ Engine creation failed:', error);
  }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('Engine test available as window.testEngineBasics()');
  (window as any).testEngineBasics = testEngineBasics;
}
