// PluginCoordinationPlugin.ts - Consolidated plugin setup and context configuration from kbts.ts
// Handles plugin initialization, context setup, and coordination

import { EngineContext } from "../../engine/contracts/plugins";
import { T, BASE, DIRS } from "../../engine/constants";

interface PluginCoordinationContext {
  state: any;
  serviceCoordinationPlugin: any;
  coreRulesPlugin: any;
  gameUIPlugin: any;
  gameHUDPlugin: any;
  gameBusinessLogicPlugin: any;
  gameWorldGenPlugin: any;
  heightSystemPlugin: any;
  gameRenderingPlugin: any;
  gameInputPlugin: any;
  globalAPIPlugin: any;
  functionDelegationPlugin: any;
  gameStateService: any;
  rngService: any;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  // Functions that need to be passed to plugins
  generate: any;
  getGenParams: any;
  setGenParams: any;
  getOrgParams: any;
  setOrgParams: any;
  resize: any;
  hud: any;
  draw: any;
  endTurn: any;
  rng32: any;
  showStart: any;
  each: any;
  idx: any;
  inBounds: any;
  getCreateMode: any;
  rt: any;
  houseNearbyLocal: any;
  updateSeedDisplay: any;
  loadTileAtlas: any;
  EXPLORE: any;
  rand: any;
  cell: any;
  reveal: any;
  ensureStartResources: any;
  label: any;
  drawCanvas: any;
  canExplore: any;
  explore: any;
  isCoast: any;
  startUpgrade: any;
  uniqueAvailable: any;
  noHouseNearbyLocal: any;
  setFarmWorkers: any;
  farmWorkers: any;
  updateFarmSynergy: any;
  summary: any;
  countType: any;
  afford: any;
  whyNo: any;
  tileInfo: any;
  openPanel: any;
  computeHeightMap: any;
  adjustHeightByIndex: any;
  initializeRngStreams: any;
}

export class PluginCoordinationPlugin {
  private context!: EngineContext;
  private gameContext!: PluginCoordinationContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: PluginCoordinationContext): void {
    this.gameContext = gameContext;
  }

  // ===== Plugin Context Setup =====
  setupAllPluginContexts(): void {
    this.setupGameUIPlugin();
    this.setupGameHUDPlugin();
    this.setupGameBusinessLogicPlugin();
    this.setupGameWorldGenPlugin();
    this.setupHeightSystemPlugin();
    this.setupGameRenderingPlugin();
    this.setupGameInputPlugin();
    this.setupGlobalAPIPlugin();
  }

  private setupGameUIPlugin(): void {
    const {
      state, gameStateService, rngService, serviceCoordinationPlugin,
      generate, getGenParams, setGenParams, getOrgParams, setOrgParams,
      resize, hud, draw, endTurn, rng32, gameUIPlugin
    } = this.gameContext;

    gameUIPlugin.setGameContext({
      state,
      gameStateService,
      rngService,
      worldGenUIService: serviceCoordinationPlugin.getWorldGenUIService(),
      generate: generate as any, // Type compatibility
      getGenParams,
      setGenParams,
      getOrgParams,
      setOrgParams,
      resize,
      hud,
      draw,
      endTurn,
      rng32
    });
  }

  private setupGameHUDPlugin(): void {
    const { state, coreRulesPlugin, draw, showStart, each, gameHUDPlugin } = this.gameContext;
    
    gameHUDPlugin.setGameContext({
      state,
      coreRulesPlugin,
      draw,
      showStart,
      each,
      T
    });
  }

  private setupGameBusinessLogicPlugin(): void {
    const {
      state, coreRulesPlugin, idx, inBounds, each, hud, draw, getCreateMode,
      EXPLORE, rt, houseNearbyLocal, gameBusinessLogicPlugin
    } = this.gameContext;

    gameBusinessLogicPlugin.setGameContext({
      state,
      coreRulesPlugin,
      idx,
      inBounds,
      each,
      hud,
      draw,
      getCreateMode,
      BASE,
      T,
      DIRS,
      EXPLORE,
      rt,
      houseNearbyLocal
    });
  }

  private setupGameWorldGenPlugin(): void {
    const {
      state, serviceCoordinationPlugin, rngService, gameStateService,
      resize, hud, draw, updateSeedDisplay, loadTileAtlas, gameWorldGenPlugin
    } = this.gameContext;

    gameWorldGenPlugin.setGameContext({
      state,
      worldGenUIService: serviceCoordinationPlugin.getWorldGenUIService(),
      rngService,
      gameStateService,
      resize,
      hud,
      draw,
      updateSeedDisplay,
      loadTileAtlas
    });
  }

  private setupHeightSystemPlugin(): void {
    const { state, serviceCoordinationPlugin, heightSystemPlugin } = this.gameContext;

    heightSystemPlugin.setGameContext({
      state,
      terrainEditingService: serviceCoordinationPlugin.getTerrainEditingService()
    });
  }

  private setupGameRenderingPlugin(): void {
    const {
      state, canvas, ctx, idx, inBounds, each, rt, gameRenderingPlugin
    } = this.gameContext;

    gameRenderingPlugin.setGameContext({
      state,
      canvas,
      ctx,
      idx,
      inBounds,
      each,
      rt,
      T,
      C: {}, // Will need to import C if needed
      LABEL: {}, // Will need to import LABEL if needed
      DIRS
    });
  }

  private setupGameInputPlugin(): void {
    const {
      state, canvas, idx, inBounds, draw, openPanel, getCreateMode,
      adjustHeightByIndex, gameInputPlugin
    } = this.gameContext;

    gameInputPlugin.setGameContext({
      state,
      canvas,
      idx,
      inBounds,
      draw,
      openPanel,
      getCreateMode,
      adjustHeightByIndex
    });
  }

  private setupGlobalAPIPlugin(): void {
    const {
      state, rand, rng32, idx, inBounds, each, cell, generate, reveal,
      ensureStartResources, label, draw, drawCanvas, resize, hud, canExplore,
      explore, isCoast, startUpgrade, uniqueAvailable, noHouseNearbyLocal,
      houseNearbyLocal, setFarmWorkers, farmWorkers, updateFarmSynergy,
      endTurn, summary, countType, afford, whyNo, showStart, tileInfo,
      openPanel, computeHeightMap, adjustHeightByIndex, initializeRngStreams,
      globalAPIPlugin
    } = this.gameContext;

    globalAPIPlugin.setGameContext({
      state,
      rand, rng32: rng32 as any, idx, inBounds, each, cell, generate, 
      reveal: reveal as any, ensureStartResources, label, draw, drawCanvas, 
      resize, hud, canExplore, explore, isCoast, startUpgrade, uniqueAvailable, 
      noHouseNearby: noHouseNearbyLocal, houseNearby: houseNearbyLocal, 
      setFarmWorkers, farmWorkers, updateFarmSynergy, endTurn, summary, 
      countType, afford, whyNo, showStart, tileInfo: tileInfo as any, 
      openPanel, computeHeightMap, adjustHeightByIndex, initializeRngStreams
    });
  }

  // ===== Plugin Boot Operations =====
  bootPlugins(): void {
    const { gameUIPlugin } = this.gameContext;
    
    // Boot bindings and worldgen debug panel (delegated to GameUIPlugin)
    gameUIPlugin.setupBootBindings();
    gameUIPlugin.setupWorldgenDebugPanel();
  }

  // ===== Global API Exposure =====
  exposeGlobalAPI(): void {
    const { globalAPIPlugin, showStart } = this.gameContext;
    
    globalAPIPlugin.exposeGlobalAPI();
    
    // Legacy global for compatibility with existing tests calling `showStart()` directly
    (window as any).showStart = showStart;
  }
}
