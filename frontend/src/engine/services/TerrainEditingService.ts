import { T, DIRS } from '../constants';
import { GameUtils } from '../utilities/GameUtils';
import { type GameStateService } from './GameStateService';
import { type RNGService } from './RNGService';
import { type WorldGenService } from './WorldGenService';

/**
 * Service for terrain editing, height management, and map state utilities.
 * Handles manual terrain modifications, height adjustments, and UI state updates.
 */
export class TerrainEditingService {
  private gameStateService: GameStateService;
  private rngService: RNGService;
  private worldGenService: WorldGenService;

  constructor(
    gameStateService: GameStateService,
    rngService: RNGService,
    worldGenService: WorldGenService
  ) {
    this.gameStateService = gameStateService;
    this.rngService = rngService;
    this.worldGenService = worldGenService;
  }

  /**
   * Adjust height at a specific map index
   */
  adjustHeightByIndex(state: any, i: number, delta: number, propagate: boolean): void {
    if (i < 0 || i >= state.map.length) return;
    const x = i % state.size.w;
    const y = Math.floor(i / state.size.w);
    this.adjustHeightAt(state, x, y, delta, propagate);
  }

  /**
   * Adjust height at specific coordinates with optional propagation
   */
  adjustHeightAt(
    state: any,
    x: number,
    y: number,
    delta: number,
    propagate: boolean
  ): void {
    if (!this.gameStateService.inBounds(x, y)) return;
    const c = state.map[this.gameStateService.idx(x, y)] as any;
    if (!c) return;

    const was = c.h | 0;
    const newH = was + delta;
    this.applyHeightAndMaybeConvert(state, x, y, newH);

    if (propagate) {
      for (const d of DIRS) {
        const nx = x + d[0];
        const ny = y + d[1];
        if (!this.gameStateService.inBounds(nx, ny)) continue;
        const n = state.map[this.gameStateService.idx(nx, ny)] as any;
        if (!n) continue;
        const nNew = (n.h | 0) + delta;
        this.applyHeightAndMaybeConvert(state, nx, ny, nNew);
      }
      // After manual edit, optionally smooth descent toward water
      this.smoothHeightsAround(state, x, y);
    }

    // Update the UI seed display to reflect the current state
    this.updateSeedDisplay(state);
  }

  /**
   * Apply a height value and convert between water and land at thresholds
   */
  applyHeightAndMaybeConvert(state: any, x: number, y: number, newH: number): void {
    const i = this.gameStateService.idx(x, y);
    const c = state.map[i] as any;
    if (!c) return;

    const t = GameUtils.Cell.renderType(c);
    if (t === T.WATER) {
      if (newH >= 1) {
        // Water becomes land (grass) at height >= 1
        c.type = T.GRASS;
        c.upg = null;
        c.h = Math.max(1, newH | 0);
      } else {
        c.h = 0;
      }
    } else {
      if (newH <= 0) {
        // Land removed becomes water at height 0
        c.type = T.WATER;
        c.upg = null;
        c.h = 0;
      } else {
        // Land remains, enforce baseline of 1
        c.h = Math.max(1, newH | 0);
      }
    }
  }

  /**
   * Smooth heights around a center point to avoid steep transitions
   */
  smoothHeightsAround(state: any, cx: number, cy: number): void {
    // Simple 2-step relaxation: tiles must not exceed any neighbor by >1, water clamps to 0
    for (let pass = 0; pass < 2; pass++) {
      for (const [x, y] of [
        [cx, cy],
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ] as any) {
        if (!this.gameStateService.inBounds(x, y)) continue;
        const i = this.gameStateService.idx(x, y);
        const c = state.map[i] as any;
        if (!c) continue;

        if (GameUtils.Cell.renderType(c) === T.WATER) {
          c.h = 0;
          continue;
        }

        let maxN = 0;
        for (const d of DIRS) {
          const nx = x + d[0];
          const ny = y + d[1];
          if (!this.gameStateService.inBounds(nx, ny)) continue;
          const n = state.map[this.gameStateService.idx(nx, ny)] as any;
          if (!n) continue;
          maxN = Math.max(maxN, n.h | 0);
        }
        if ((c.h | 0) > maxN + 1) c.h = maxN + 1;
      }
    }
  }

  /**
   * Create a deterministic sub-RNG for specific operations
   */
  createSubRng(baseSeed: number, operation: string, x?: number, y?: number): () => number {
    return this.worldGenService.createSubRng(baseSeed, operation, x, y);
  }

  /**
   * Compute height map for the world
   */
  computeHeightMap(state: any): void {
    this.worldGenService.computeHeightMap(state);
  }

  /**
   * Update seed for terrain changes (for UI display purposes)
   */
  updateSeedForTerrain(
    state: any,
    reason: "land-created" | "land-removed",
    x: number,
    y: number
  ): void {
    // Create a sub-RNG specifically for terrain changes
    // This maintains determinism without affecting the main RNG stream
    const terrainRng = this.createSubRng(this.rngService.getGenerationSeed(), reason, x, y);
    
    // Update the display seed for UI purposes, but keep the RNG stream intact
    const displaySeed = (state.seed * 1664525 + 1013904223) >>> 0;
    const so = document.getElementById("seedOut");
    if (so) so.textContent = String(displaySeed);
  }

  /**
   * Compute a hash of the current map state for display purposes only
   */
  computeMapStateHash(state: any): number {
    // FNV-1a 32-bit style mixing over width, height, and full per-tile state
    let h = 0x811c9dc5 >>> 0; // 2166136261
    const mix = (v: number) => {
      h ^= v >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0; // 16777619
    };
    
    mix(state.size.w | 0);
    mix(state.size.h | 0);
    
    for (let y = 0; y < state.size.h; y++) {
      for (let x = 0; x < state.size.w; x++) {
        const c = state.map[this.gameStateService.idx(x, y)] as any;
        // Base tile code: map string types to small integers
        const t = GameUtils.Cell.renderType(c);
        let code = 0;
        switch (t) {
          case T.WATER: code = 1; break;
          case T.GRASS: code = 2; break;
          case T.FOREST: code = 3; break;
          case T.MOUNTAIN: code = 4; break;
          case T.HILL: code = 5; break;
          case T.FARM: code = 6; break;
          case T.TOWN: code = 7; break;
          default: code = 9; break;
        }
        mix(code);
        
        // Height
        mix((c.h | 0) & 0xff);
        
        // Discovery state
        mix(c.disc ? 1 : 0);
        
        // Upgrade state (simplified)
        if (c.upg) {
          mix((c.upg.total | 0) & 0xff);
          mix((c.upg.prog | 0) & 0xff);
        }
      }
    }
    
    return h >>> 0;
  }

  /**
   * Update the displayed seed for UI purposes without affecting RNG
   */
  updateSeedDisplay(state: any): void {
    const mapHash = this.computeMapStateHash(state);
    const so = document.getElementById("seedOut");
    if (so) {
      so.textContent = `${this.rngService.getOriginalSeed()} (state: ${mapHash.toString(16)})`;
    }
  }
}
