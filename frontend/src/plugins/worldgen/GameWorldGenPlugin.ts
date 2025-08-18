// GameWorldGenPlugin.ts - Extracted world generation functionality from kbts.ts
// Handles world generation, revealing, and resource management

import { EngineContext } from "../../engine/contracts/plugins";

interface GameWorldGenContext {
  state: any;
  worldGenUIService: any;
  rngService: any;
  gameStateService: any;
  resize: () => void;
  hud: () => void;
  draw: () => void;
  updateSeedDisplay: () => void;
  loadTileAtlas: () => Promise<any>;
}

export class GameWorldGenPlugin {
  private context!: EngineContext;
  private gameContext!: GameWorldGenContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GameWorldGenContext): void {
    this.gameContext = gameContext;
  }

  // ===== World Generation Configuration =====
  getCreateMode(): boolean {
    return this.gameContext.worldGenUIService.getCreateMode();
  }

  setCreateMode(enabled: boolean): void {
    this.gameContext.worldGenUIService.setCreateMode(enabled);
  }

  getGenParams(): any {
    return this.gameContext.worldGenUIService.getGenParams();
  }

  setGenParams(params: any): void {
    this.gameContext.worldGenUIService.setGenParams(params);
  }

  getOrgParams(): any {
    return this.gameContext.worldGenUIService.getOrgParams();
  }

  setOrgParams(params: any): void {
    this.gameContext.worldGenUIService.setOrgParams(params);
  }

  // ===== World Generation =====
  async initWorldgenPlugin(): Promise<any> {
    return await this.gameContext.worldGenUIService.initWorldgenPlugin(this.gameContext.state);
  }

  async generate(
    seed = Date.now(),
    size: "small" | "medium" | "large" = "medium"
  ): Promise<void> {
    const { worldGenUIService, state, updateSeedDisplay, loadTileAtlas, resize, hud, draw, rngService } = this.gameContext;
    
    // Use WorldGenUIService for world generation
    await worldGenUIService.generate(state, seed, size);
    
    // Update seed display for UI  
    updateSeedDisplay();

    // Load tile atlas for enhanced rendering - wait for it to load
    try {
      await loadTileAtlas();
      console.log("Tile atlas loaded successfully");
    } catch (e) {
      console.warn("Could not load tile atlas:", e);
    }

    resize();
    hud();
    draw();
    
    // Update seed and map displays
    const seedOut = document.getElementById("seedOut");
    const mapOut = document.getElementById("mapOut");
    if (seedOut) seedOut.textContent = String(rngService.getOriginalSeed());
    if (mapOut) mapOut.textContent = `${state.size.w}×${state.size.h}`;
  }

  reveal(cx: number, cy: number, r: number): void {
    this.gameContext.worldGenUIService.reveal(this.gameContext.state, cx, cy, r);
  }

  ensureStartResources(sx: number, sy: number): void {
    this.gameContext.worldGenUIService.ensureStartResources(this.gameContext.state, sx, sy);
  }

  // ===== RNG Management =====
  initializeRngStreams(baseSeed: number): void {
    this.gameContext.gameStateService.initializeRNG(baseSeed);
  }

  // ===== Public API =====
  isReady(): boolean {
    return this.isInitialized && !!this.gameContext;
  }
}
