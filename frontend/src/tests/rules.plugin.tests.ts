// Rules Plugin Tests
// Tests for the CoreRulesPlugin functionality

import { CoreRulesPlugin } from '../plugins/rules';
import type { EngineContext } from '../engine/contracts/plugins';

// Mock engine context for testing
function createMockContext(): EngineContext {
  return {
    engine: {} as any,
    events: {
      publish: (topic: string, data?: any) => console.log(`Event: ${topic}`, data),
      subscribe: (topic: string, handler: Function) => () => {},
      once: (topic: string, handler: Function) => () => {},
      clear: () => {}
    },
    services: {
      get: (id: string) => {
        if (id === 'gameState') {
          return {
            getState: () => ({
              seed: 12345,
              rng: null,
              size: { w: 20, h: 16, t: 32 },
              map: [],
              year: 1,
              gold: 10,
              food: 5,
              wood: 3,
              people: 2,
              actions: 2,
              sel: null,
              fogEnabled: true
            })
          };
        }
        if (id === 'rng') {
          return {
            gameplay: () => Math.random(),
            event: () => Math.random()
          };
        }
        return null;
      },
      provide: (id: string, service: any) => {},
      has: (id: string) => false,
      remove: (id: string) => false
    } as any,
    logger: {
      debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
      info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
    },
    rng: {
      seed: () => {},
      next: () => Math.random(),
      nextInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
      nextFloat: (min: number, max: number) => Math.random() * (max - min) + min,
      chance: (prob: number) => Math.random() < prob,
      pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)] as T,
      shuffle: <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)
    },
    time: {
      now: () => Date.now(),
      tick: () => 0,
      delta: () => 0,
      tickDelta: () => 33.333
    },
    state: {} as any,
    config: {}
  };
}

export function testRulesPlugin() {
  console.log('🧪 Testing CoreRulesPlugin...');
  
  const context = createMockContext();
  const plugin = new CoreRulesPlugin();
  
  plugin.init(context);
  
  // Test building system
  console.log('✅ Building system tests:');
  
  // Test upgrade specs
  const grassSpecs = plugin.getUpgradeSpecs('GRASS');
  console.log(`  GRASS upgrades: ${grassSpecs.length} options`);
  
  const hutSpecs = plugin.getUpgradeSpecs('HUT');
  console.log(`  HUT upgrades: ${hutSpecs.length} options`);
  
  // Test resource checking
  console.log('✅ Resource checking tests:');
  
  const hutSpec = plugin.getUpgradeSpecs('HUT')[0];
  if (hutSpec) {
    console.log(`  Can afford HUT→${hutSpec.to}: ${plugin.afford(hutSpec.cost)}`);
    
    // Test with insufficient resources
    const gameStateService = context.services.get('gameState') as any;
    const state = gameStateService.getState();
    state.gold = 0;
    console.log(`  Can afford HUT→${hutSpec.to} (no gold): ${plugin.afford(hutSpec.cost)}`);
  }
  
  // Test turn processing
  console.log('✅ Turn processing tests:');
  
  // Setup test state with farms
  const gameStateService2 = context.services.get('gameState') as any;
  const state2 = gameStateService2.getState();
  state2.gold = 10;
  state2.food = 5;
  state2.wood = 3;
  state2.people = 2;
  state2.year = 1;
  
  // Create a simple map with a farm
  for (let i = 0; i < state2.map.length; i++) {
    state2.map[i] = { type: 'GRASS', disc: true };
  }
  
  // Add a working farm at (5, 5)
  const farmIdx = 5 * state2.size.w + 5;
  state2.map[farmIdx] = { type: 'FARM', disc: true, wrk: 1, fx: 0 };
  
  // Process a turn
  const turnResult = plugin.processTurn();
  console.log(`  Turn result: G:${turnResult.G} F:${turnResult.F} W:${turnResult.W} P:${turnResult.P}`);
  console.log(`  Events: ${turnResult.events.length} events`);
  
  if (turnResult.events.length > 0) {
    turnResult.events.forEach(event => console.log(`    • ${event}`));
  }
  
  const gameStateService3 = context.services.get('gameState') as any;
  const newState = gameStateService3.getState();
  console.log(`  State after turn: Year ${newState.year}, People ${newState.people}, Food ${newState.food}`);
  
  // Test exploration system
  console.log('✅ Exploration system tests:');
  
  // Reset state for exploration tests
  const exploreState = context.services.get('gameState') as any;
  const state3 = exploreState.getState();
  state3.actions = 3;
  state3.food = 5;
  state3.people = 2;
  
  // Create a map with some discovered tiles
  for (let i = 0; i < state3.map.length; i++) {
    state3.map[i] = { type: 'GRASS', disc: false };
  }
  
  // Discover starting tile at (10, 8)
  const startIdx = 8 * state3.size.w + 10;
  state3.map[startIdx] = { type: 'GRASS', disc: true };
  
  // Test exploration of adjacent tile
  const adjacentX = 11;
  const adjacentY = 8;
  
  console.log(`  Can explore (${adjacentX},${adjacentY}): ${plugin.canExplore(adjacentX, adjacentY)}`);
  
  if (!plugin.canExplore(adjacentX, adjacentY)) {
    console.log(`  Why not: ${plugin.whyNoExplore(adjacentX, adjacentY)}`);
  }
  
  // Test exploration
  const exploreResult = plugin.explore(adjacentX, adjacentY);
  console.log(`  Exploration result: ${exploreResult}`);
  
  if (exploreResult) {
    const postExploreState = context.services.get('gameState') as any;
    const state4 = postExploreState.getState();
    console.log(`  After exploration: Actions ${state4.actions}, Food ${state4.food}, People ${state4.people}`);
  }
  
  console.log('✅ CoreRulesPlugin tests completed');
}

// Auto-run test if called directly
if (typeof window !== 'undefined') {
  (window as any).testRulesPlugin = testRulesPlugin;
}
