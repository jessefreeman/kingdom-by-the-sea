// ServiceCoordinationPlugin.ts - Extracted service initialization and coordination from kbts.ts
// Handles service setup, canvas initialization, and utility function coordination

import { EngineContext } from "../../engine/contracts/plugins";
import { gameStateService } from "../../engine/services/GameStateService";
import { rngService } from "../../engine/services/RNGService";
import { worldGenService } from "../../engine/services/WorldGenService";
import { TerrainEditingService } from "../../engine/services/TerrainEditingService";
import { WorldGenUIService } from "../../engine/services/WorldGenUIService";
import { GameUtils } from "../../engine/utilities/GameUtils";
import type { Cell } from "../../engine/contracts/types";
import { HOUSELINE } from "../../engine/constants";

interface ServiceCoordinationContext {
  state: any;
}

export class ServiceCoordinationPlugin {
  private context!: EngineContext;
  private gameContext!: ServiceCoordinationContext;
  private isInitialized = false;
  
  // Services
  private terrainEditingService!: TerrainEditingService;
  private worldGenUIService!: WorldGenUIService;
  
  // Canvas references
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: ServiceCoordinationContext): void {
    this.gameContext = gameContext;
    this.initializeServices();
    this.initializeCanvas();
    this.setupDebugBindings();
  }

  // ===== Service Initialization =====
  private initializeServices(): void {
    // Initialize additional services
    this.terrainEditingService = new TerrainEditingService(gameStateService, rngService, worldGenService);
    this.worldGenUIService = new WorldGenUIService(rngService, worldGenService);
  }

  private initializeCanvas(): void {
    // Initialize canvas for rendering
    gameStateService.initializeCanvas();
    
    // Get canvas references
    this.canvas = gameStateService.getCanvas() || GameUtils.DOM.$("gameCanvas") as HTMLCanvasElement;
    this.ctx = gameStateService.getContext() || this.canvas.getContext("2d")!;
  }

  // ===== Service Access =====
  getTerrainEditingService(): TerrainEditingService {
    return this.terrainEditingService;
  }

  getWorldGenUIService(): WorldGenUIService {
    return this.worldGenUIService;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  // ===== Utility Functions =====
  rand(): number {
    return gameStateService.random();
  }

  idx(x: number, y: number): number {
    return gameStateService.idx(x, y);
  }

  inBounds(x: number, y: number): boolean {
    return gameStateService.inBounds(x, y);
  }

  each(fn: (x: number, y: number, cell: Cell) => void): void {
    gameStateService.each(fn);
  }

  createCell(t: string): Cell {
    return gameStateService.createCell(t);
  }

  resize(): void {
    gameStateService.resize();
  }

  // ===== Helper Functions =====
  renderType(c: any): any {
    return GameUtils.Cell.renderType(c);
  }

  houseNearby(x: number, y: number): boolean {
    const { state } = this.gameContext;
    return GameUtils.Cell.houseNearby(x, y, state.map, state.size.w, state.size.h, HOUSELINE);
  }

  noHouseNearby(x: number, y: number): boolean {
    const { state } = this.gameContext;
    return GameUtils.Cell.noHouseNearby(x, y, state.map, state.size.w, state.size.h, HOUSELINE);
  }

  // ===== Debug Functions =====
  private setupDebugBindings(): void {
    // Bind K to dump
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "K") {
        this.debugDump();
      }
    });
  }

  debugDump(): void {
    const { state } = this.gameContext;
    const dumpResult = GameUtils.Debug.debugDump(state, {}); // LABEL would need to be passed in
    console.log([
      "KBTS DEBUG DUMP", 
      `seed: ${state.seed}`,
      `size: ${state.size.w}x${state.size.h}`,
      dumpResult
    ].join("\n"));
  }
}
