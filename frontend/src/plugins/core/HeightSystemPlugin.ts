// HeightSystemPlugin.ts - Extracted height system functionality from kbts.ts
// Handles terrain height management and related operations

import { EngineContext } from "../../engine/contracts/plugins";
import { TerrainEditingService } from "../../engine/services/TerrainEditingService";

interface HeightSystemContext {
  state: any;
  terrainEditingService: TerrainEditingService;
}

export class HeightSystemPlugin {
  private context!: EngineContext;
  private gameContext!: HeightSystemContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: HeightSystemContext): void {
    this.gameContext = gameContext;
  }

  // ===== Height System (Flattened) =====
  // Fixed heights by type; no neighbor-based adjustments.
  // - WATER: 0
  // - GRASS: 1
  // - FOREST: 2
  // - HUT/HOUSE/TOWN: 2
  // - MOUNTAIN: 4
  // - All others default to 1 if land (non-water)
  
  computeHeightMap(): void {
    const { state, terrainEditingService } = this.gameContext;
    terrainEditingService.computeHeightMap(state);
  }

  adjustHeightByIndex(i: number, delta: number, propagate: boolean): void {
    const { state, terrainEditingService } = this.gameContext;
    terrainEditingService.adjustHeightByIndex(state, i, delta, propagate);
  }

  // Updated function that doesn't mutate global seed
  updateSeedForTerrain(
    reason: "land-created" | "land-removed",
    x: number,
    y: number
  ): void {
    const { state, terrainEditingService } = this.gameContext;
    terrainEditingService.updateSeedForTerrain(state, reason, x, y);
  }

  // Update the displayed seed for UI purposes without affecting RNG
  updateSeedDisplay(): void {
    const { state, terrainEditingService } = this.gameContext;
    terrainEditingService.updateSeedDisplay(state);
  }
}
