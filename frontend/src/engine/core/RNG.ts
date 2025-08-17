// Deterministic RNG implementation using xorshift32

import type { RNG } from '../contracts/plugins';

export class SeededRNG implements RNG {
  private state: number;
  private initialSeed: number;

  constructor(seed: string | number = Date.now()) {
    const numSeed = typeof seed === 'string' ? this.hashString(seed) : seed;
    this.initialSeed = numSeed;
    this.state = numSeed >>> 0; // Ensure it's a 32-bit unsigned integer
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  seed(value: string | number): void {
    const numSeed = typeof value === 'string' ? this.hashString(value) : value;
    this.initialSeed = numSeed;
    this.state = numSeed >>> 0;
  }

  next(): number {
    // xorshift32 algorithm - simple and effective PRNG
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    this.state = this.state >>> 0; // Keep as 32-bit unsigned
    return this.state / 4294967296; // Convert to [0, 1)
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index]!; // Safe because we checked length and bounds
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = result[i]!; // Safe because i is within bounds
      result[i] = result[j]!; // Safe because j is within bounds
      result[j] = temp;
    }
    return result;
  }

  // Utility methods for debugging/testing
  getSeed(): number {
    return this.initialSeed;
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}
