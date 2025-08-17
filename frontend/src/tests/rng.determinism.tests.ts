// Tests for deterministic RNG

import { SeededRNG } from '../engine/core/RNG';

// Simple test function that can run in browser console
export function testRNGDeterminism(): boolean {
  console.log('Testing RNG determinism...');
  
  // Test same seed produces same sequence
  const rng1 = new SeededRNG(12345);
  const rng2 = new SeededRNG(12345);
  
  const sequence1 = Array.from({ length: 10 }, () => rng1.next());
  const sequence2 = Array.from({ length: 10 }, () => rng2.next());
  
  const consistent = JSON.stringify(sequence1) === JSON.stringify(sequence2);
  console.log('Same seed consistency:', consistent ? 'PASS' : 'FAIL');
  
  // Test different seeds produce different sequences
  const rng3 = new SeededRNG(54321);
  const sequence3 = Array.from({ length: 10 }, () => rng3.next());
  const different = JSON.stringify(sequence1) !== JSON.stringify(sequence3);
  console.log('Different seed variation:', different ? 'PASS' : 'FAIL');
  
  // Test string seeds
  const rng4 = new SeededRNG('test-seed');
  const rng5 = new SeededRNG('test-seed');
  const seq4 = Array.from({ length: 5 }, () => rng4.next());
  const seq5 = Array.from({ length: 5 }, () => rng5.next());
  const stringConsistent = JSON.stringify(seq4) === JSON.stringify(seq5);
  console.log('String seed consistency:', stringConsistent ? 'PASS' : 'FAIL');
  
  // Test pick consistency
  const rng6 = new SeededRNG(99999);
  const rng7 = new SeededRNG(99999);
  const array = ['a', 'b', 'c', 'd', 'e'];
  const picks1 = Array.from({ length: 5 }, () => rng6.pick(array));
  const picks2 = Array.from({ length: 5 }, () => rng7.pick(array));
  const pickConsistent = JSON.stringify(picks1) === JSON.stringify(picks2);
  console.log('Pick consistency:', pickConsistent ? 'PASS' : 'FAIL');
  
  const allPassed = consistent && different && stringConsistent && pickConsistent;
  console.log('Overall RNG test result:', allPassed ? 'ALL PASS' : 'SOME FAILURES');
  
  return allPassed;
}

// Auto-run if imported
if (typeof window !== 'undefined') {
  console.log('RNG determinism test available as window.testRNGDeterminism()');
  (window as any).testRNGDeterminism = testRNGDeterminism;
}
