/**
 * RNG Service - Centralized random number generation with deterministic streams
 * 
 * Manages multiple RNG streams for different purposes:
 * - worldGenRng: For world generation (terrain, island shapes)
 * - gameplayRng: For game mechanics (events, combat, etc.)
 * - eventRng: For random events and story generation
 * 
 * Each stream is seeded differently to prevent correlation while maintaining
 * reproducibility from a single base seed.
 */

import { GameUtils } from "../utilities/GameUtils";

export class RNGService {
  private static instance: RNGService;
  
  // Seed tracking
  private originalSeed: number = 0;
  private generationSeed: number = 0;
  
  // RNG streams
  private worldGenRng: (() => number) | null = null;
  private gameplayRng: (() => number) | null = null;
  private eventRng: (() => number) | null = null;
  
  // Salt constants for stream differentiation
  private static readonly GAMEPLAY_SALT = 0x12345678;
  private static readonly EVENT_SALT = 0x87654321;
  
  private constructor() {}
  
  /**
   * Get the singleton instance of RNGService
   */
  static getInstance(): RNGService {
    if (!RNGService.instance) {
      RNGService.instance = new RNGService();
    }
    return RNGService.instance;
  }
  
  /**
   * Initialize all RNG streams from a base seed
   * @param baseSeed The master seed for all RNG streams
   */
  initializeStreams(baseSeed: number): void {
    this.originalSeed = baseSeed;
    this.generationSeed = baseSeed;
    
    // Create separate deterministic streams for different purposes
    this.worldGenRng = GameUtils.RNG.rng32(baseSeed);
    this.gameplayRng = GameUtils.RNG.rng32(baseSeed ^ RNGService.GAMEPLAY_SALT);
    this.eventRng = GameUtils.RNG.rng32(baseSeed ^ RNGService.EVENT_SALT);
  }
  
  /**
   * Get a random number from the world generation stream
   */
  worldGen(): number {
    if (!this.worldGenRng) {
      throw new Error("RNG streams not initialized. Call initializeStreams() first.");
    }
    return this.worldGenRng();
  }
  
  /**
   * Get a random number from the gameplay stream
   */
  gameplay(): number {
    if (!this.gameplayRng) {
      throw new Error("RNG streams not initialized. Call initializeStreams() first.");
    }
    return this.gameplayRng();
  }
  
  /**
   * Get a random number from the event stream
   */
  event(): number {
    if (!this.eventRng) {
      throw new Error("RNG streams not initialized. Call initializeStreams() first.");
    }
    return this.eventRng();
  }
  
  /**
   * Get the main gameplay RNG function for external assignment
   * Used for compatibility with legacy state.rng assignment
   */
  getGameplayRng(): (() => number) | null {
    return this.gameplayRng;
  }
  
  /**
   * Get the world generation RNG function for external assignment
   */
  getWorldGenRng(): (() => number) | null {
    return this.worldGenRng;
  }
  
  /**
   * Get the event RNG function for external assignment
   */
  getEventRng(): (() => number) | null {
    return this.eventRng;
  }
  
  /**
   * Get the original seed used to initialize the streams
   */
  getOriginalSeed(): number {
    return this.originalSeed;
  }
  
  /**
   * Get the generation seed
   */
  getGenerationSeed(): number {
    return this.generationSeed;
  }
  
  /**
   * Set the generation seed (for world regeneration scenarios)
   */
  setGenerationSeed(seed: number): void {
    this.generationSeed = seed;
  }
  
  /**
   * Check if RNG streams are initialized
   */
  isInitialized(): boolean {
    return this.worldGenRng !== null && this.gameplayRng !== null && this.eventRng !== null;
  }
  
  /**
   * Legacy compatibility function - returns a random number from gameplay stream
   * This matches the behavior of the original rand() function
   */
  rand(): number {
    return this.gameplay();
  }
  
  /**
   * Reset all streams (useful for testing or cleanup)
   */
  reset(): void {
    this.originalSeed = 0;
    this.generationSeed = 0;
    this.worldGenRng = null;
    this.gameplayRng = null;
    this.eventRng = null;
  }
}

// Export a singleton instance for convenience
export const rngService = RNGService.getInstance();
