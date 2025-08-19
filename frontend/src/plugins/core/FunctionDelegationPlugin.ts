// FunctionDelegationPlugin.ts - Consolidated delegation functions from kbts.ts
// Handles all the simple delegation functions to reduce main file size

import { EngineContext } from "../../engine/contracts/plugins";
import type { Cell } from "../../engine/contracts/types";

interface FunctionDelegationContext {
  serviceCoordinationPlugin: any;
  gameWorldGenPlugin: any;
  gameRenderingPlugin: any;
  gameInputPlugin: any;
  gameBusinessLogicPlugin: any;
  gameHUDPlugin: any;
  heightSystemPlugin: any;
  canvas: HTMLCanvasElement;
}

export class FunctionDelegationPlugin {
  private context!: EngineContext;
  private gameContext!: FunctionDelegationContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: FunctionDelegationContext): void {
    this.gameContext = gameContext;
    this.setupInputDelegation();
  }

  // ===== Utility Function Delegations =====
  rand() { return this.gameContext.serviceCoordinationPlugin.rand(); }
  idx(x: number, y: number) { return this.gameContext.serviceCoordinationPlugin.idx(x, y); }
  inBounds(x: number, y: number) { return this.gameContext.serviceCoordinationPlugin.inBounds(x, y); }
  each(fn: (x: number, y: number, cell: Cell) => void) { this.gameContext.serviceCoordinationPlugin.each(fn); }
  cell(t: string): Cell { return this.gameContext.serviceCoordinationPlugin.createCell(t); }
  resize() { this.gameContext.serviceCoordinationPlugin.resize(); }
  
  // Helper function delegations
  renderType(c: any) { return this.gameContext.serviceCoordinationPlugin.renderType(c); }
  houseNearby(x: number, y: number) { return this.gameContext.serviceCoordinationPlugin.houseNearby(x, y); }
  noHouseNearby(x: number, y: number) { return this.gameContext.serviceCoordinationPlugin.noHouseNearby(x, y); }

  // ===== World Generation Delegations =====
  getCreateMode() { return this.gameContext.gameWorldGenPlugin.getCreateMode(); }
  setCreateMode(enabled: boolean) { this.gameContext.gameWorldGenPlugin.setCreateMode(enabled); }
  getGenParams() { return this.gameContext.gameWorldGenPlugin.getGenParams(); }
  setGenParams(params: any) { this.gameContext.gameWorldGenPlugin.setGenParams(params); }
  getOrgParams() { return this.gameContext.gameWorldGenPlugin.getOrgParams(); }
  setOrgParams(params: any) { this.gameContext.gameWorldGenPlugin.setOrgParams(params); }
  async initWorldgenPlugin() { return this.gameContext.gameWorldGenPlugin.initWorldgenPlugin(); }
  async generate(seed = Date.now(), size: "small" | "medium" | "large" = "medium") { 
    return this.gameContext.gameWorldGenPlugin.generate(seed, size); 
  }
  reveal(cx: number, cy: number, r: number) { this.gameContext.gameWorldGenPlugin.reveal(cx, cy, r); }
  ensureStartResources(sx: number, sy: number) { this.gameContext.gameWorldGenPlugin.ensureStartResources(sx, sy); }
  initializeRngStreams(baseSeed: number) { this.gameContext.gameWorldGenPlugin.initializeRngStreams(baseSeed); }

  // ===== Rendering Delegations =====
  label(c: any) { return this.gameContext.gameRenderingPlugin.label(c); }
  async loadTileAtlas() { return this.gameContext.gameRenderingPlugin.loadTileAtlas(); }
  tile(x: number, y: number, c: any) { this.gameContext.gameRenderingPlugin.tile(x, y, c); }
  drawCanvas() { this.gameContext.gameRenderingPlugin.drawCanvas(); }
  draw() { this.gameContext.gameRenderingPlugin.draw(); }

  // ===== Business Logic Delegations =====
  afford(c: any) { return this.gameContext.gameBusinessLogicPlugin.afford(c); }
  whyNo(spec: any, cell: any) { return this.gameContext.gameBusinessLogicPlugin.whyNo(spec, cell); }
  fmtCost(c: any) { return this.gameContext.gameBusinessLogicPlugin.fmtCost(c); }
  fmtYield(y: any) { return this.gameContext.gameBusinessLogicPlugin.fmtYield(y); }
  upgradeName(from: string, to: string) { return this.gameContext.gameBusinessLogicPlugin.upgradeName(from, to); }
  tileInfo(c: any) { return this.gameContext.gameBusinessLogicPlugin.tileInfo(c); }
  canExplore(x: number, y: number) { return this.gameContext.gameBusinessLogicPlugin.canExplore(x, y); }
  whyNoExplore(x: number, y: number) { return this.gameContext.gameBusinessLogicPlugin.whyNoExplore(x, y); }
  explore(x: number, y: number) { this.gameContext.gameBusinessLogicPlugin.explore(x, y); }
  isCoast(x: number, y: number) { return this.gameContext.gameBusinessLogicPlugin.isCoast(x, y); }
  countType(t: string) { return this.gameContext.gameBusinessLogicPlugin.countType(t); }
  uniqueAvailable(to: string) { return this.gameContext.gameBusinessLogicPlugin.uniqueAvailable(to); }
  bufferOK(x: number, y: number, from: string, to: string) { 
    return this.gameContext.gameBusinessLogicPlugin.bufferOK(x, y, from, to); 
  }
  
  // Farm-related delegations
  farmWorkers() { return this.gameContext.gameBusinessLogicPlugin.farmWorkers(); }
  setFarmWorkers(x: number, y: number, delta: number) { 
    this.gameContext.gameBusinessLogicPlugin.setFarmWorkers(x, y, delta); 
  }
  updateFarmSynergy(d?: any) { this.gameContext.gameBusinessLogicPlugin.updateFarmSynergy(d); }
  openPanel(x: number, y: number) { this.gameContext.gameBusinessLogicPlugin.openPanel(x, y); }
  startUpgrade(x: number, y: number, c: any, s: any) { 
    this.gameContext.gameBusinessLogicPlugin.startUpgrade(x, y, c, s); 
  }

  // ===== HUD Delegations =====
  endTurn() { return this.gameContext.gameHUDPlugin.endTurn(); }
  showSummary(d: any) { this.gameContext.gameHUDPlugin.showSummary(d); }
  checkWinLose() { return this.gameContext.gameHUDPlugin.checkWinLose(); }
  showGameOver(win: boolean, msg: string) { this.gameContext.gameHUDPlugin.showGameOver(win, msg); }
  updateHUD() { this.gameContext.gameHUDPlugin.updateHUD(); }

  // ===== Height System Delegations =====
  computeHeightMap() { this.gameContext.heightSystemPlugin.computeHeightMap(); }
  adjustHeightByIndex(i: number, delta: number, propagate: boolean) { 
    this.gameContext.heightSystemPlugin.adjustHeightByIndex(i, delta, propagate); 
  }
  updateSeedForTerrain(reason: "land-created" | "land-removed", x: number, y: number) { 
    this.gameContext.heightSystemPlugin.updateSeedForTerrain(reason, x, y); 
  }
  updateSeedDisplay() { this.gameContext.heightSystemPlugin.updateSeedDisplay(); }

  // ===== Input Setup =====
  private setupInputDelegation(): void {
    const canvasClick = (e: MouseEvent) => this.gameContext.gameInputPlugin.handleCanvasClick(e);
    this.gameContext.canvas.addEventListener("click", canvasClick);
    this.gameContext.gameInputPlugin.setupKeyboardInput();
  }
}
