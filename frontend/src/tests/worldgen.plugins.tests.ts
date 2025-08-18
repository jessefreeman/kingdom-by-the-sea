// Worldgen plugin tests for Kingdom by the Sea engine

import { GameEngine } from '../engine/core/Engine';
import { IslandWorldgenPlugin } from '../plugins/worldgen/islands/IslandWorldgen';
import { ThreeRendererPlugin } from '../plugins/renderer/three/ThreeRenderer';

export async function testWorldgenPlugin(): Promise<void> {
  console.log('🌍 Testing worldgen plugin...');

  try {
    // Create worldgen and renderer plugins
    const worldgen = new IslandWorldgenPlugin();
    const renderer = new ThreeRendererPlugin();

    // Create engine with plugins
    const engine = new GameEngine({
      plugins: [worldgen, renderer],
      seed: 12345
    });

    // Initialize and start engine
    await engine.init();
    engine.start();

    console.log('✅ Engine started with worldgen plugin');

    // Test worldgen generation
    const result = await worldgen.generateWorld(12345, 'small', {
      forest: 0.3,
      mountains: 0.1,
      villages: 0.05
    });

    console.log('🏝️ Generated world:', result);

    // Verify result structure
    if (!result.success) {
      throw new Error('Worldgen failed');
    }

    if (result.landTiles + result.waterTiles === 0) {
      throw new Error('No tiles generated');
    }

    console.log(`🏔️ World stats: ${result.landTiles} land, ${result.waterTiles} water`);
    console.log('🌲 Biomes:', Object.keys(result.biomes).join(', '));

    // Test determinism - generate same world twice
    const result2 = await worldgen.generateWorld(12345, 'small', {
      forest: 0.3,
      mountains: 0.1,
      villages: 0.05
    });

    if (JSON.stringify(result.biomes) !== JSON.stringify(result2.biomes)) {
      console.warn('⚠️ Worldgen may not be fully deterministic');
    } else {
      console.log('🎯 Worldgen is deterministic');
    }

    // Test different world sizes
    const mediumWorld = await worldgen.generateWorld(54321, 'medium');
    console.log(`🌍 Medium world: ${mediumWorld.landTiles} land, ${mediumWorld.waterTiles} water`);

    // Test events (check if they were published)
    let eventCount = 0;
    engine.getContext().events.subscribe('worldgen.*', () => { eventCount++; });
    
    await worldgen.generateWorld(99999, 'small');
    console.log(`📢 Worldgen events published: ${eventCount}`);

    // Stop engine
    engine.stop();

    console.log('✅ Worldgen plugin test completed successfully');

  } catch (error) {
    console.error('❌ Worldgen plugin test failed:', error);
    throw error;
  }
}
