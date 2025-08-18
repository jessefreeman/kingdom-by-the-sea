// Island worldgen plugin for Kingdom by the Sea

import type { EnginePlugin, EngineContext } from '../../../engine/contracts/plugins';
import type { GameState, Cell } from '../../../engine/contracts/types';
import { generateOrganicIslandHeight, type OrganicIslandParams } from '../../../worldgen/island';

export interface WorldgenOptions {
  forest: number;    // ~35% of land becomes forest
  mountains: number; // ~12% of land becomes mountains (clustered)
  villages: number;  // ~8% of land becomes villages
}

export interface IslandGenParams extends OrganicIslandParams {
  // extends the organic island params from worldgen/island.ts
}

export interface WorldgenResult {
  success: boolean;
  seed: number;
  mapSize: { w: number; h: number };
  landTiles: number;
  waterTiles: number;
  biomes: Record<string, number>;
}

export class IslandWorldgenPlugin implements EnginePlugin {
  id = 'kbts.worldgen.islands.v1';
  version = '1.0.0';
  requires = ['state', 'logger', 'rng'];

  private context: EngineContext | null = null;
  private createMode = false; // Creative mode for manual editing
  
  // Default generation parameters
  private genParams: WorldgenOptions = {
    forest: 0.35,   // ~35% of land becomes forest
    mountains: 0.12, // ~12% of land becomes mountains (clustered)
    villages: 0.08, // ~8% of land becomes villages
  };

  // Organic island shaping parameters
  private orgParams: IslandGenParams = {
    coastMargin: 1,
    baseRadiusFrac: 0.5,
    erodeIterations: 4,
    erodePercent: 0.22,
    lakePercent: 0.06,
    minLakeDistToSea: 3,
    maxLakeFlood: 24,
  };

  // Tile type constants (should match main game)
  private readonly T = {
    WATER: "water",
    GRASS: "grass",
    FOREST: "forest",
    HILL: "hill",
    MOUNTAIN: "mountain",
    HUT: "hut",
    HOUSE: "house",
    MANSION: "mansion",
    PALACE: "palace",
    CASTLE: "castle",
    FARM: "farm",
    MINE: "mine",
    BURNT: "burnt",
    RUBBLE: "rubble",
    DOCK: "dock",
    TOWN: "town",
  } as const;

  private readonly HOUSELINE = [this.T.HUT, this.T.HOUSE, this.T.MANSION, this.T.PALACE, this.T.CASTLE];

  private readonly DIRS: ReadonlyArray<[number, number]> = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  async init(ctx: EngineContext): Promise<void> {
    this.context = ctx;
    ctx.logger.info('Island worldgen plugin initializing...');
    
    // Register worldgen service
    ctx.services.provide('worldgen', this);
    
    ctx.logger.info('Island worldgen plugin initialized');
  }

  start(ctx: EngineContext): void {
    ctx.logger.info('Island worldgen plugin started');
  }

  update(ctx: EngineContext, dt: number): void {
    // Worldgen doesn't need regular updates
  }

  stop(ctx: EngineContext): void {
    ctx.logger.info('Island worldgen plugin stopped');
  }

  dispose(ctx: EngineContext): void {
    this.context = null;
    ctx.logger.info('Island worldgen plugin disposed');
  }

  // Public API for generating worlds
  async generateWorld(
    seed: number,
    size: "small" | "medium" | "large" = "medium",
    options?: Partial<WorldgenOptions>
  ): Promise<WorldgenResult> {
    if (!this.context) {
      throw new Error('Worldgen plugin not initialized');
    }

    const ctx = this.context;
    ctx.logger.info(`Generating ${size} island with seed ${seed}`);
    
    // Emit worldgen start event
    ctx.events.publish('worldgen.start', { seed, size, options });

    try {
      // Set RNG seed
      ctx.rng.seed(seed);

      // Apply options
      const genParams = { ...this.genParams, ...options };

      // Get map dimensions
      const sizes: Record<string, { w: number; h: number }> = {
        small: { w: 16, h: 12 },
        medium: { w: 20, h: 16 },
        large: { w: 30, h: 20 },
      };
      const mapSize = sizes[size];
      if (!mapSize) {
        throw new Error(`Invalid map size: ${size}`);
      }

      // Generate the world
      const result = await this.generateIsland(mapSize, seed, genParams);

      // Emit worldgen complete event
      ctx.events.publish('worldgen.done', result);

      ctx.logger.info(`Island generation complete: ${result.landTiles} land, ${result.waterTiles} water`);
      return result;

    } catch (error) {
      ctx.logger.error('Worldgen failed:', error);
      ctx.events.publish('worldgen.error', { error });
      throw error;
    }
  }

  private async generateIsland(
    mapSize: { w: number; h: number },
    seed: number,
    genParams: WorldgenOptions
  ): Promise<WorldgenResult> {
    if (!this.context) throw new Error('Context not available');

    const ctx = this.context;
    const state = ctx.state.get() as GameState;

    // Update state dimensions
    state.map.width = mapSize.w;
    state.map.height = mapSize.h;
    
    // Initialize map with water
    state.map.cells = Array(mapSize.w * mapSize.h)
      .fill(null)
      .map(() => this.createCell(this.T.WATER));

    const cx = (mapSize.w - 1) / 2;
    const cy = (mapSize.h - 1) / 2;

    ctx.events.publish('worldgen.progress', { phase: 'base_terrain', progress: 0.1 });

    if (this.createMode) {
      // Creative mode: reveal all for editing
      this.eachCell(state, (x, y, c) => { 
        c.disc = true; 
        c.h = 0; 
      });
    } else {
      // Generate organic island shape
      ctx.events.publish('worldgen.progress', { phase: 'island_shape', progress: 0.2 });
      
      const mask = generateOrganicIslandHeight(mapSize.w, mapSize.h, () => ctx.rng.next(), this.orgParams);
      
      for (let y = 0; y < mapSize.h; y++) {
        for (let x = 0; x < mapSize.w; x++) {
          const cell = state.map.cells[this.idx(x, y, mapSize.w)];
          if (!cell) continue;
          
          if (mask[y]![x] === 1) { 
            cell.type = this.T.GRASS; 
          } else { 
            cell.type = this.T.WATER; 
            cell.h = 0; 
          }
        }
      }

      // Collect land tiles
      const land: Array<{x:number, y:number, i:number}> = [];
      this.eachCell(state, (x, y, c) => { 
        if (this.getType(c) !== this.T.WATER) {
          land.push({x, y, i: this.idx(x, y, mapSize.w)}); 
        }
      });

      ctx.events.publish('worldgen.progress', { phase: 'starter_hut', progress: 0.4 });

      // Place starter hut near center
      const grassTiles = land.filter(p => {
        const cell = state.map.cells[p.i];
        return cell && cell.type === this.T.GRASS;
      });
      const centerSorted = [...grassTiles].sort((a,b) => 
        Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)
      );
      const start = centerSorted[0] || { 
        x: Math.floor(cx), 
        y: Math.floor(cy), 
        i: this.idx(Math.floor(cx), Math.floor(cy), mapSize.w) 
      };
      const startCell = state.map.cells[start.i];
      if (startCell) {
        startCell.type = this.T.HUT;
      }

      ctx.events.publish('worldgen.progress', { phase: 'mountains', progress: 0.5 });

      // Place mountains (clustered)
      this.placeMountains(state, mapSize, land, genParams.mountains);

      ctx.events.publish('worldgen.progress', { phase: 'forests', progress: 0.7 });

      // Place forests
      this.placeForests(state, mapSize, land, genParams.forest);

      ctx.events.publish('worldgen.progress', { phase: 'villages', progress: 0.8 });

      // Place villages/towns
      this.placeVillages(state, mapSize, land, genParams.villages);

      ctx.events.publish('worldgen.progress', { phase: 'starter_resources', progress: 0.9 });

      // Ensure starter resources and reveal area
      this.ensureStartResources(state, mapSize, start.x, start.y);
      this.reveal(state, mapSize, start.x, start.y, 1);
    }

    // Compute heights based on terrain
    this.computeHeightMap(state, mapSize);

    // Update state
    ctx.state.set(state);

    ctx.events.publish('worldgen.progress', { phase: 'complete', progress: 1.0 });

    // Calculate statistics
    const stats = this.calculateStats(state);

    return {
      success: true,
      seed,
      mapSize,
      landTiles: stats.landTiles,
      waterTiles: stats.waterTiles,
      biomes: stats.biomes,
    };
  }

  private createCell(type: string): Cell {
    return {
      type,
      disc: false,
      upg: null,
      wrk: 0,
      fx: 0,
      h: 0,
    };
  }

  private idx(x: number, y: number, width: number): number {
    return y * width + x;
  }

  private inBounds(x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && y >= 0 && x < width && y < height;
  }

  private eachCell(state: GameState, fn: (x: number, y: number, cell: Cell) => void): void {
    for (let y = 0; y < state.map.height; y++) {
      for (let x = 0; x < state.map.width; x++) {
        const cell = state.map.cells[this.idx(x, y, state.map.width)];
        if (cell) {
          fn(x, y, cell);
        }
      }
    }
  }

  private getType(c: Cell): string {
    return c.upg ? c.upg.to : c.type;
  }

  private coastiness(state: GameState, x: number, y: number): number {
    let w = 0;
    for (const d of this.DIRS) {
      const nx = x + d[0], ny = y + d[1];
      if (!this.inBounds(nx, ny, state.map.width, state.map.height)) { 
        w += 1; 
        continue; 
      }
      const n = state.map.cells[this.idx(nx, ny, state.map.width)];
      if (!n || this.getType(n) === this.T.WATER) w += 1;
    }
    return w; // 0 best (interior), 4 worst (isolated/coast)
  }

  private placeMountains(state: GameState, mapSize: { w: number; h: number }, land: Array<{x:number, y:number, i:number}>, density: number): void {
    if (!this.context) return;

    const targetM = Math.max(0, Math.floor(land.length * Math.max(0, Math.min(1, density))));
    const interiorSorted = [...land].sort((a,b) => 
      this.coastiness(state, a.x, a.y) - this.coastiness(state, b.x, b.y)
    );
    
    let placedM = 0;
    const markMountain = (x: number, y: number): boolean => { 
      const c = state.map.cells[this.idx(x, y, mapSize.w)];
      if (c && this.getType(c) !== this.T.WATER && c.type !== this.T.HUT && c.type !== this.T.MOUNTAIN) { 
        c.type = this.T.MOUNTAIN; 
        placedM++; 
        return true; 
      } 
      return false; 
    };

    let cursor = 0;
    const tried = new Set<number>();
    
    while (placedM < targetM && cursor < interiorSorted.length * 3) {
      // Bias toward interior: pick among the best 60%
      const span = Math.max(1, Math.floor(interiorSorted.length * 0.6));
      const pick = interiorSorted[Math.floor(this.context.rng.next() * span)]!;
      cursor++;
      if (tried.has(pick.i)) continue; 
      tried.add(pick.i);
      if (!markMountain(pick.x, pick.y)) continue;
      
      // Small cluster growth
      const q: Array<[number,number]> = [[pick.x, pick.y]];
      let budget = 4; // cap cluster size
      while (q.length && placedM < targetM && budget-- > 0) {
        const [cx1, cy1] = q.shift()!;
        for (const d of this.DIRS) {
          if (this.context.rng.next() < 0.35) {
            const nx = cx1 + d[0], ny = cy1 + d[1];
            if (!this.inBounds(nx, ny, mapSize.w, mapSize.h)) continue;
            const ok = markMountain(nx, ny);
            if (ok) q.push([nx, ny]);
            if (placedM >= targetM) break;
          }
        }
      }
    }
  }

  private placeForests(state: GameState, mapSize: { w: number; h: number }, land: Array<{x:number, y:number, i:number}>, density: number): void {
    if (!this.context) return;

    const targetF = Math.max(0, Math.floor(land.length * Math.max(0, Math.min(1, density))));
    const candidatesF = land
      .filter(p => {
        const cell = state.map.cells[p.i];
        return cell && cell.type === this.T.GRASS;
      })
      .sort(() => (this.context!.rng.next() < 0.5 ? -1 : 1));
    
    for (let i = 0; i < candidatesF.length && i < targetF; i++) {
      const pick = candidatesF[i];
      if (!pick) break;
      const cell = state.map.cells[pick.i];
      if (cell) {
        cell.type = this.T.FOREST;
      }
    }
  }

  private placeVillages(state: GameState, mapSize: { w: number; h: number }, land: Array<{x:number, y:number, i:number}>, density: number): void {
    if (!this.context) return;

    const targetV = Math.max(0, Math.floor(land.length * Math.max(0, Math.min(1, density))));
    let placedV = 0;
    
    const canPlaceTown = (x: number, y: number): boolean => {
      for (const d of this.DIRS) {
        const nx = x + d[0], ny = y + d[1];
        if (!this.inBounds(nx, ny, mapSize.w, mapSize.h)) continue;
        const n = state.map.cells[this.idx(nx, ny, mapSize.w)];
        if (n && n.type === this.T.TOWN) return false;
      }
      return true;
    };

    const candV = land
      .filter(p => {
        const c = state.map.cells[p.i];
        return c && (c.type === this.T.GRASS || c.type === this.T.FOREST);
      })
      .sort(() => (this.context!.rng.next() < 0.5 ? -1 : 1));
    
    for (const p of candV) {
      if (placedV >= targetV) break;
      if (!canPlaceTown(p.x, p.y)) continue;
      const c = state.map.cells[p.i];
      if (c && (c.type === this.T.GRASS || c.type === this.T.FOREST)) {
        c.type = this.T.TOWN;
        placedV++;
      }
    }
  }

  private reveal(state: GameState, mapSize: { w: number; h: number }, cx: number, cy: number, r: number): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y, mapSize.w, mapSize.h)) continue;
        const c = state.map.cells[this.idx(x, y, mapSize.w)];
        if (c) c.disc = true;
      }
    }
  }

  private ensureStartResources(state: GameState, mapSize: { w: number; h: number }, sx: number, sy: number): void {
    const nbs: Array<{ i: number; cell: Cell; x: number; y: number }> = [];
    
    for (const d of this.DIRS) {
      const nx = sx + d[0], ny = sy + d[1];
      if (!this.inBounds(nx, ny, mapSize.w, mapSize.h)) continue;
      const i = this.idx(nx, ny, mapSize.w);
      const cell = state.map.cells[i];
      if (cell) {
        nbs.push({ i, cell, x: nx, y: ny });
      }
    }
    
    if (!nbs.length) return;
    
    const pref = (n: { cell: Cell }) =>
      n.cell.type === this.T.WATER ? 2 : n.cell.type === this.T.MOUNTAIN ? 3 : 1;
      
    let forest = nbs.find(n => n.cell.type === this.T.FOREST);
    if (!forest) {
      forest = [...nbs].sort((a, b) => pref(a) - pref(b))[0];
      if (forest) {
        const forestCell = state.map.cells[forest.i];
        if (forestCell) {
          forestCell.type = this.T.FOREST;
        }
      }
    }
    
    let grass = nbs.find(n => n.cell.type === this.T.GRASS && n.i !== forest?.i);
    if (!grass) {
      const cand = nbs.filter(n => n.i !== forest?.i);
      const pick = (cand.length ? cand : nbs.slice(0, 1)).sort(
        (a, b) => pref(a) - pref(b)
      )[0];
      if (pick) {
        const grassCell = state.map.cells[pick.i];
        if (grassCell) {
          grassCell.type = this.T.GRASS;
        }
      }
    }
  }

  private computeHeightMap(state: GameState, mapSize: { w: number; h: number }): void {
    for (let y = 0; y < mapSize.h; y++) {
      for (let x = 0; x < mapSize.w; x++) {
        const c = state.map.cells[this.idx(x, y, mapSize.w)];
        if (!c) continue;
        
        const t = this.getType(c);
        let h = 1; // default land height
        
        if (t === this.T.WATER) h = 0;
        else if (t === this.T.GRASS) h = 1;
        else if (t === this.T.FOREST) h = 2;
        else if (t === this.T.TOWN || (this.HOUSELINE as readonly string[]).includes(t)) h = 2;
        else if (t === this.T.MOUNTAIN) h = 4;
        else h = 1;
        
        c.h = h;
      }
    }
  }

  private calculateStats(state: GameState): { landTiles: number; waterTiles: number; biomes: Record<string, number> } {
    const biomes: Record<string, number> = {};
    let landTiles = 0;
    let waterTiles = 0;

    this.eachCell(state, (x, y, c) => {
      const type = this.getType(c);
      biomes[type] = (biomes[type] || 0) + 1;
      
      if (type === this.T.WATER) {
        waterTiles++;
      } else {
        landTiles++;
      }
    });

    return { landTiles, waterTiles, biomes };
  }

  // Public API methods
  setCreateMode(enabled: boolean): void {
    this.createMode = enabled;
  }

  setGenParams(params: Partial<WorldgenOptions>): void {
    this.genParams = { ...this.genParams, ...params };
  }

  setOrgParams(params: Partial<IslandGenParams>): void {
    this.orgParams = { ...this.orgParams, ...params };
  }

  getGenParams(): WorldgenOptions {
    return { ...this.genParams };
  }

  getOrgParams(): IslandGenParams {
    return { ...this.orgParams };
  }
}
