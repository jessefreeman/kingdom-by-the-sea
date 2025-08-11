// Random Number Generator Tests
// Tests for reproducible, deterministic random number generation

import type { KBTSApi } from '../types';

type RNG = () => number;

export function runRngTests() {
  console.log('Running RNG reproducibility tests...');
  
  const K = (window as any).KBTS as KBTSApi;
  const { rng32 } = K as any;
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  function test(name: string, fn: () => boolean | void | Promise<boolean>) {
    testsTotal++;
    try {
      const result = fn();
      if (result instanceof Promise) {
        result.then((res) => {
          if (res !== false) {
            testsPassed++;
            console.log(`✓ ${name}`);
          } else {
            console.error(`✗ ${name}`);
          }
        }).catch((e) => {
          console.error(`✗ ${name}: ${e}`);
        });
      } else {
        if (result !== false) {
          testsPassed++;
          console.log(`✓ ${name}`);
        } else {
          console.error(`✗ ${name}`);
        }
      }
    } catch (e) {
      console.error(`✗ ${name}: ${e}`);
    }
  }

  // Test 1: Same seed produces same sequence
  test('Same seed produces identical sequences', () => {
    const seed = 12345;
    const rng1 = rng32(seed);
    const rng2 = rng32(seed);
    
    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());
    
    for (let i = 0; i < seq1.length; i++) {
      if (seq1[i] !== seq2[i]) {
        console.error(`Mismatch at index ${i}: ${seq1[i]} !== ${seq2[i]}`);
        return false;
      }
    }
    return true;
  });

  // Test 2: Different seeds produce different sequences
  test('Different seeds produce different sequences', () => {
    const rng1 = rng32(12345);
    const rng2 = rng32(54321);
    
    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());
    
    let differences = 0;
    for (let i = 0; i < seq1.length; i++) {
      if (seq1[i] !== seq2[i]) differences++;
    }
    
    // Should have significant differences (>90% different)
    return differences > 90;
  });

  // Test 3: RNG produces values in [0, 1) range
  test('RNG produces values in [0, 1) range', () => {
    const rng = rng32(42);
    
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      if (val < 0 || val >= 1) {
        console.error(`Value out of range: ${val}`);
        return false;
      }
    }
    return true;
  });

  // Test 4: RNG has good distribution
  test('RNG has reasonable distribution', () => {
    const rng = rng32(999);
    const buckets = new Array(10).fill(0);
    const samples = 10000;
    
    for (let i = 0; i < samples; i++) {
      const val = rng();
      const bucket = Math.floor(val * 10);
      buckets[bucket]++;
    }
    
    // Each bucket should have roughly 10% of samples (±5%)
    const expected = samples / 10;
    const tolerance = expected * 0.15; // 15% tolerance
    
    for (let i = 0; i < buckets.length; i++) {
      if (Math.abs(buckets[i] - expected) > tolerance) {
        console.error(`Bucket ${i} has ${buckets[i]} samples, expected ~${expected}`);
        return false;
      }
    }
    return true;
  });

  // Test 5: Reproducible world generation
  test('World generation is reproducible', async () => {
    const { generate, state } = K as any;
    const seed = 987654321;
    
    // Generate world twice with same seed
    await generate(seed, 'small');
    const map1 = state.map.map((cell: any) => ({ 
      type: cell.type, 
      h: cell.h || 0,
      disc: cell.disc || false 
    }));
    const seed1 = state.seed;
    
    await generate(seed, 'small');
    const map2 = state.map.map((cell: any) => ({ 
      type: cell.type, 
      h: cell.h || 0,
      disc: cell.disc || false 
    }));
    const seed2 = state.seed;
    
    // Maps should be identical
    if (map1.length !== map2.length) {
      console.error(`Map length mismatch: ${map1.length} !== ${map2.length}`);
      return false;
    }
    
    for (let i = 0; i < map1.length; i++) {
      const c1 = map1[i];
      const c2 = map2[i];
      if (c1.type !== c2.type || c1.h !== c2.h || c1.disc !== c2.disc) {
        console.error(`Cell ${i} mismatch:`, c1, 'vs', c2);
        return false;
      }
    }
    
    // Final seeds should be identical
    if (seed1 !== seed2) {
      console.error(`Final seed mismatch: ${seed1} !== ${seed2}`);
      return false;
    }
    
    return true;
  });

  // Test 6: Random events are reproducible
  test('Random events are reproducible', () => {
    const { randomEvent, state, rng32, T, cell } = K as any;
    
    // Set up identical state
    const setupState = () => {
      state.size = { w: 3, h: 3, t: 24 };
      state.map = Array.from({ length: 9 }, () => cell(T.GRASS));
      state.map[0].type = T.FARM;
      state.map[0].disc = true;
      state.map[1].type = T.HOUSE;
      state.map[1].disc = true;
      state.people = 5;
      state.gold = 10;
      state.food = 5;
      state.wood = 5;
    };
    
    // Run events with same RNG seed
    const seed = 555555;
    
    setupState();
    state.rng = rng32(seed);
    const delta1 = { G: 0, F: 0, W: 0, P: 0, events: [] };
    randomEvent(delta1);
    
    setupState();
    state.rng = rng32(seed);
    const delta2 = { G: 0, F: 0, W: 0, P: 0, events: [] };
    randomEvent(delta2);
    
    // Results should be identical
    const keys = ['G', 'F', 'W', 'P'] as const;
    for (const key of keys) {
      if (delta1[key] !== delta2[key]) {
        console.error(`Delta ${key} mismatch: ${delta1[key]} !== ${delta2[key]}`);
        return false;
      }
    }
    
    if (JSON.stringify(delta1.events) !== JSON.stringify(delta2.events)) {
      console.error('Events mismatch:', delta1.events, 'vs', delta2.events);
      return false;
    }
    
    return true;
  });

  // Test 7: State should not affect RNG determinism
  test('RNG is isolated from external state', () => {
    const seed = 777;
    const rng1 = rng32(seed);
    const rng2 = rng32(seed);
    
    // Consume different amounts from each RNG
    rng1(); // 1 call
    rng2(); rng2(); rng2(); // 3 calls
    
    // Create fresh RNGs with same seed
    const rng3 = rng32(seed);
    const rng4 = rng32(seed);
    
    // First values should still match
    const val1 = rng3();
    const val2 = rng4();
    
    if (val1 !== val2) {
      console.error(`Fresh RNG mismatch: ${val1} !== ${val2}`);
      return false;
    }
    
    return true;
  });

  console.log(`\nRNG Tests completed: ${testsPassed}/${testsTotal} passed`);
  
  if (testsPassed !== testsTotal) {
    console.error('❌ Some RNG tests failed! Random number generation is not fully reproducible.');
    return false;
  } else {
    console.log('✅ All RNG tests passed! Random number generation is reproducible.');
    return true;
  }
}

// Auto-run when loaded
if (typeof window !== 'undefined') {
  const runWhenReady = () => {
    if (!(window as any).KBTS) { 
      setTimeout(runWhenReady, 100); 
      return; 
    }
    runRngTests();
  };
  runWhenReady();
}
