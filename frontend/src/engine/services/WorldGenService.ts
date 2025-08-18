/**
 * World Generation Service - Centralized world generation and terrain management
 * 
 * This service handles:
 * - World generation using multiple algorithms (organic islands, simple generation)
 * - Terrain placement and height map computation
 * - Starting resource placement
 * - Map initialization and setup
 * - Integration with worldgen plugins
 */

import type { Cell, State } from "../contracts/types";
import { generateOrganicIslandHeight, type OrganicIslandParams } from "../../worldgen/island";
import { IslandWorldgenPlugin } from "../../plugins/worldgen/islands/IslandWorldgen";
import { rngService } from "./RNGService";
import { GameUtils } from "../utilities/GameUtils";
import { T, HOUSELINE, DIRS } from "../constants";

export interface WorldGenParams {
  forest: number;   // ~35% of land becomes forest
  mountains: number; // ~12% of land becomes mountains (clustered)
  villages: number;  // ~8% of land becomes villages
}

export interface WorldSize {
  w: number;
  h: number;
}

export class WorldGenService {
  private static instance: WorldGenService;
  
  // Current state reference for worldgen plugin compatibility
  private currentState: State | null = null;
  
  // World generation configuration
  private createMode = false;
  private simpleIslandOnly = false;
  
  // Default generation parameters
  private genParams: WorldGenParams = {
    forest: 0.35,   // ~35% of land becomes forest
    mountains: 0.12, // ~12% of land becomes mountains (clustered)
    villages: 0.08, // ~8% of land becomes villages
  };
  
  // Organic island shaping parameters
  private orgParams: OrganicIslandParams = {
    coastMargin: 1,
    baseRadiusFrac: 0.5,
    erodeIterations: 4,
    erodePercent: 0.22,
    lakePercent: 0.06,
    minLakeDistToSea: 3,
    maxLakeFlood: 24,
  };
  
  // Size configurations
  private readonly sizes: Record<string, WorldSize> = {
    small: { w: 16, h: 12 },
    medium: { w: 20, h: 16 },
    large: { w: 30, h: 20 },
  };
  
  private constructor() {}
  
  static getInstance(): WorldGenService {
    if (!WorldGenService.instance) {
      WorldGenService.instance = new WorldGenService();
    }
    return WorldGenService.instance;
  }
  
  /**
   * Main world generation function
   */
  async generate(
    state: State,
    seed = Date.now(),
    size: "small" | "medium" | "large" = "medium",
    customParams?: Partial<WorldGenParams>
  ): Promise<void> {
    // Store state reference for worldgen plugin compatibility
    this.currentState = state;
    
    // Initialize RNG streams
    rngService.initializeStreams(seed);
    
    // Update world size
    Object.assign(state.size, this.sizes[size]);
    
    // Initialize state
    Object.assign(state, {
      seed: rngService.getGenerationSeed(),
      rng: rngService.getGameplayRng(),
      year: 1,
      gold: 3,
      food: 3,
      wood: 2,
      people: 3,
      actions: 3,
      sel: null,
    });
    
    // Merge custom parameters if provided
    const params = { ...this.genParams, ...customParams };
    
    // Initialize base map with water
    state.map = Array(state.size.w * state.size.h)
      .fill(0)
      .map(() => GameUtils.Cell.createCell(T.WATER));
    
    const cx = (state.size.w - 1) / 2;
    const cy = (state.size.h - 1) / 2;
    
    if (this.createMode) {
      // Reveal all for editing
      this.revealAll(state);
    } else {
      // Use worldgen plugin for generation
      const worldgenPlugin = await this.initWorldgenPlugin();
      
      // Generate world using plugin (modifies state.map in place)
      await worldgenPlugin.generateWorld(
        state.seed,
        size,
        {
          mountains: params.mountains,
          forest: params.forest,
          villages: params.villages
        }
      );
    }
    
    // Compute initial heights based on terrain
    this.computeHeightMap(state);
  }
  
  /**
   * Initialize worldgen plugin for legacy compatibility
   */
  private async initWorldgenPlugin(): Promise<IslandWorldgenPlugin> {
    // Create a minimal engine context for the plugin
    const engineContext = {
      rng: {
        next: () => rngService.worldGen(),
        seed: (newSeed: number) => {
          // Re-initialize the worldgen RNG with new seed
          rngService.setGenerationSeed(newSeed);
        }
      },
      events: {
        publish: (event: string, data: any) => {
          console.log(`Worldgen event: ${event}`, data);
        }
      },
      state: {
        get: () => {
          // Return current state in the format expected by the plugin
          if (this.currentState) {
            return {
              map: {
                cells: this.currentState.map,
                width: this.currentState.size.w,
                height: this.currentState.size.h
              },
              size: this.currentState.size,
              seed: this.currentState.seed
            };
          }
          // Fallback for when no state is set
          return {
            map: {
              width: 20,
              height: 16,
              cells: []
            }
          };
        },
        set: (newState: any) => {
          // If the plugin modified map.cells, copy it back to current state
          if (this.currentState && newState.map && newState.map.cells) {
            this.currentState.map = newState.map.cells;
          }
          // Copy other properties except 'map' which we handled above
          if (this.currentState) {
            const { map, ...otherProps } = newState;
            Object.assign(this.currentState, otherProps);
          }
        }
      },
      services: {
        provide: (id: string, service: any) => {
          console.log(`Service "${id}" provided`);
        },
        get: (id: string) => {
          throw new Error(`Service "${id}" not available in legacy mode`);
        }
      },
      logger: {
        info: (msg: string) => console.log(`[Worldgen] ${msg}`),
        warn: (msg: string) => console.warn(`[Worldgen] ${msg}`),
        error: (msg: string) => console.error(`[Worldgen] ${msg}`)
      }
    };

    const plugin = new IslandWorldgenPlugin();
    await plugin.init(engineContext as any);
    plugin.start(engineContext as any);
    return plugin;
  }
  
  /**
   * Reveal a circular area around coordinates
   */
  reveal(state: State, cx: number, cy: number, r: number): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(state, x, y)) continue;
        const c = state.map[this.idx(state, x, y)] as any;
        if (c) c.disc = true;
      }
    }
  }
  
  /**
   * Reveal all tiles on the map
   */
  private revealAll(state: State): void {
    for (let y = 0; y < state.size.h; y++) {
      for (let x = 0; x < state.size.w; x++) {
        const c = state.map[this.idx(state, x, y)] as any;
        if (c) {
          c.disc = true;
          c.h = 0;
        }
      }
    }
  }
  
  /**
   * Ensure starting resources around spawn point
   */
  ensureStartResources(state: State, sx: number, sy: number): void {
    const nbs: Array<{ i: number; cell: any; x: number; y: number }> = [];
    
    for (const d of DIRS) {
      const nx = sx + d[0];
      const ny = sy + d[1];
      if (!this.inBounds(state, nx, ny)) continue;
      nbs.push({ 
        i: this.idx(state, nx, ny), 
        cell: state.map[this.idx(state, nx, ny)], 
        x: nx, 
        y: ny 
      });
    }
    
    if (!nbs.length) return;
    
    const pref = (n: any) =>
      n.cell.type === T.WATER ? 2 : n.cell.type === T.MOUNTAIN ? 3 : 1;
    
    // Ensure forest
    let forest = nbs.find((n) => (n.cell as any).type === T.FOREST);
    if (!forest) {
      forest = [...nbs].sort((a, b) => pref(a) - pref(b))[0]!;
      (state.map[forest.i] as any).type = T.FOREST;
    }
    
    // Ensure grass
    let grass = nbs.find(
      (n) => (n.cell as any).type === T.GRASS && n.i !== (forest as any).i
    );
    if (!grass) {
      const cand = nbs.filter((n) => n.i !== (forest as any).i);
      const pick = (cand.length ? cand : [nbs[0]]).sort(
        (a, b) => pref(a) - pref(b)
      )[0]!;
      (state.map[pick.i] as any).type = T.GRASS;
    }
  }
  
  /**
   * Compute height map based on terrain types
   */
  computeHeightMap(state: State): void {
    for (let y = 0; y < state.size.h; y++) {
      for (let x = 0; x < state.size.w; x++) {
        const c = state.map[this.idx(state, x, y)] as any;
        if (!c) continue;
        
        const t = GameUtils.Cell.renderType(c);
        let h = 1; // default land height
        
        if (t === T.WATER) h = 0;
        else if (t === T.GRASS) h = 1;
        else if (t === T.FOREST) h = 2;
        else if (t === T.TOWN || (t && HOUSELINE.includes(t as any))) h = 2;
        else if (t === T.MOUNTAIN) h = 4;
        else h = 1;
        
        c.h = h;
      }
    }
  }
  
  /**
   * Create a deterministic sub-RNG for specific operations
   */
  createSubRng(baseSeed: number, operation: string, x?: number, y?: number): () => number {
    // Create a unique seed for this specific operation and location
    const locationSeed = x !== undefined && y !== undefined ? (x * 1000 + y) : 0;
    const operationSeed = operation.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const combinedSeed = baseSeed ^ locationSeed ^ operationSeed;
    
    return GameUtils.RNG.rng32(combinedSeed);
  }
  
  // Utility methods
  private idx(state: State, x: number, y: number): number {
    return y * state.size.w + x;
  }
  
  private inBounds(state: State, x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < state.size.w && y < state.size.h;
  }
  
  // Configuration getters/setters
  getGenParams(): WorldGenParams {
    return { ...this.genParams };
  }
  
  setGenParams(params: Partial<WorldGenParams>): void {
    Object.assign(this.genParams, params);
  }
  
  getOrgParams(): OrganicIslandParams {
    return { ...this.orgParams };
  }
  
  setOrgParams(params: Partial<OrganicIslandParams>): void {
    Object.assign(this.orgParams, params);
  }
  
  getCreateMode(): boolean {
    return this.createMode;
  }
  
  setCreateMode(enabled: boolean): void {
    this.createMode = enabled;
  }
  
  getSimpleIslandOnly(): boolean {
    return this.simpleIslandOnly;
  }
  
  setSimpleIslandOnly(enabled: boolean): void {
    this.simpleIslandOnly = enabled;
  }
  
  getSizes(): Record<string, WorldSize> {
    return { ...this.sizes };
  }
}

// Export singleton instance for convenience
export const worldGenService = WorldGenService.getInstance();
