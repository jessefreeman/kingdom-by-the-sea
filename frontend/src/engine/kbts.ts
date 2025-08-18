// Kingdom by the Sea — TypeScript global API (KBTS)
// Port of the JS game core, exposed on window for renderer/tests.

import type { Cell, State, UpgradeSpec } from "./contracts/types";
import { getCoastOverlaysAt } from "./utilities/autotile";
import { CoreRulesPlugin } from "../plugins/rules/core/CoreRulesPlugin";
import { GameUIPlugin } from "../plugins/ui/GameUIPlugin";
import { GameHUDPlugin } from "../plugins/ui/GameHUDPlugin";
import { GameBusinessLogicPlugin } from "../plugins/business/GameBusinessLogicPlugin";
import { GameRenderingPlugin } from "../plugins/rendering/GameRenderingPlugin";
import { GameInputPlugin } from "../plugins/input/GameInputPlugin";
import { GameWorldGenPlugin } from "../plugins/worldgen/GameWorldGenPlugin";
import { GameUtils } from "./utilities/GameUtils";
import { rngService } from "./services/RNGService";
import { worldGenService } from "./services/WorldGenService";
import { gameStateService } from "./services/GameStateService";
import { TerrainEditingService } from "./services/TerrainEditingService";
import { WorldGenUIService } from "./services/WorldGenUIService";
import { 
  T, HOUSELINE, DIRS, C, LABEL, BASE,
  TERRAIN_TYPES, COLORS, TERRAIN_LABELS, BASE_PRODUCTION, DIRECTIONS
} from "./constants";

// Convenience aliases for frequently used utilities
const { $, esc, ov } = GameUtils.DOM;
const { rng32 } = GameUtils.RNG;

// ===== State Management (via GameStateService) =====
// Initialize the game state service
const state = gameStateService.getState();

// Create CoreRulesPlugin instance for extracted functionality
const createMockEngineContext = () => ({
  engine: {} as any,
  events: { publish: () => {}, subscribe: () => () => {}, once: () => () => {}, clear: () => {} },
  services: {
    get: (id: string) => {
      if (id === 'rng') return rngService;
      return gameStateService;
    },
    provide: () => {},
    has: () => true
  },
  logger: { info: console.log, warn: console.warn, error: console.error, debug: console.log },
  rng: rngService as any,
  time: {} as any,
  state: {
    get: () => state,
    set: (newState: any) => Object.assign(state, newState)
  },
  config: {}
});

const coreRulesPlugin = new CoreRulesPlugin();
coreRulesPlugin.init(createMockEngineContext() as any);

// Create GameUIPlugin instance for UI functionality
const gameUIPlugin = new GameUIPlugin();
gameUIPlugin.init(createMockEngineContext() as any);

// Create GameHUDPlugin instance for HUD and turn management
const gameHUDPlugin = new GameHUDPlugin();
gameHUDPlugin.init(createMockEngineContext() as any);

// Create GameBusinessLogicPlugin instance for business logic
const gameBusinessLogicPlugin = new GameBusinessLogicPlugin();
gameBusinessLogicPlugin.init(createMockEngineContext() as any);

// Create GameRenderingPlugin instance for rendering
const gameRenderingPlugin = new GameRenderingPlugin();
gameRenderingPlugin.init(createMockEngineContext() as any);

// Create GameInputPlugin instance for input handling
const gameInputPlugin = new GameInputPlugin();
gameInputPlugin.init(createMockEngineContext() as any);

// Create GameWorldGenPlugin instance for world generation
const gameWorldGenPlugin = new GameWorldGenPlugin();
gameWorldGenPlugin.init(createMockEngineContext() as any);

// Constants for backward compatibility
const EXPLORE = { RISK: 0.25, FOOD: 1 };

// Initialize canvas for rendering
gameStateService.initializeCanvas();

// Initialize additional services
const terrainEditingService = new TerrainEditingService(gameStateService, rngService, worldGenService);
const worldGenUIService = new WorldGenUIService(rngService, worldGenService);

// Convenience functions that delegate to the service
const rand = () => gameStateService.random();
const idx = (x: number, y: number) => gameStateService.idx(x, y);
const inBounds = (x: number, y: number) => gameStateService.inBounds(x, y);
const each = (fn: (x: number, y: number, cell: Cell) => void) => gameStateService.each(fn);

// ===== Helpers =====
const cell = (t: string): Cell => gameStateService.createCell(t);

// Local wrapper functions that match original signatures
const rt = (c: any) => GameUtils.Cell.renderType(c);
const houseNearbyLocal = (x: number, y: number) => 
  GameUtils.Cell.houseNearby(x, y, state.map, state.size.w, state.size.h, HOUSELINE);
const noHouseNearbyLocal = (x: number, y: number) => 
  GameUtils.Cell.noHouseNearby(x, y, state.map, state.size.w, state.size.h, HOUSELINE);
// Bind K to dump
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "k" || e.key === "K") {
    const dumpResult = GameUtils.Debug.debugDump(state, LABEL);
    console.log([
      "KBTS DEBUG DUMP", 
      `seed: ${state.seed}`,
      `size: ${state.size.w}x${state.size.h}`,
      dumpResult
    ].join("\n"));
  }
});

// ===== Canvas / Renderer hooks =====
const canvas = gameStateService.getCanvas() || $("gameCanvas") as HTMLCanvasElement;
const ctx = gameStateService.getContext() || canvas.getContext("2d")!;
const resize = () => gameStateService.resize();

// ===== State Management ===== (Handled by plugins)

// ===== World Generation ===== (Delegated to GameWorldGenPlugin)
const getCreateMode = () => gameWorldGenPlugin.getCreateMode();
const setCreateMode = (enabled: boolean) => gameWorldGenPlugin.setCreateMode(enabled);
const getGenParams = () => gameWorldGenPlugin.getGenParams();
const setGenParams = (params: any) => gameWorldGenPlugin.setGenParams(params);
const getOrgParams = () => gameWorldGenPlugin.getOrgParams();
const setOrgParams = (params: any) => gameWorldGenPlugin.setOrgParams(params);
const initWorldgenPlugin = async () => gameWorldGenPlugin.initWorldgenPlugin();
const generate = async (seed = Date.now(), size: "small" | "medium" | "large" = "medium") => gameWorldGenPlugin.generate(seed, size);
const reveal = (cx: number, cy: number, r: number) => gameWorldGenPlugin.reveal(cx, cy, r);
const ensureStartResources = (sx: number, sy: number) => gameWorldGenPlugin.ensureStartResources(sx, sy);
const initializeRngStreams = (baseSeed: number) => gameWorldGenPlugin.initializeRngStreams(baseSeed);

// ===== Rendering (fallback if renderer missing) ===== (Delegated to GameRenderingPlugin)
const label = (c: any) => gameRenderingPlugin.label(c);
const loadTileAtlas = async () => gameRenderingPlugin.loadTileAtlas();
const tile = (x: number, y: number, c: any) => gameRenderingPlugin.tile(x, y, c);
const drawCanvas = () => gameRenderingPlugin.drawCanvas();
const draw = () => gameRenderingPlugin.draw();

// ===== Input ===== (Delegated to GameInputPlugin)
const canvasClick = (e: MouseEvent) => gameInputPlugin.handleCanvasClick(e);
canvas.addEventListener("click", canvasClick);

// Setup keyboard events through GameInputPlugin
gameInputPlugin.setupKeyboardInput();


// ===== Rules / UI ===== (Delegated to GameBusinessLogicPlugin)
const afford = (c: any) => gameBusinessLogicPlugin.afford(c);
const whyNo = (spec: any, cell: any) => gameBusinessLogicPlugin.whyNo(spec, cell);
const fmtCost = (c: any) => gameBusinessLogicPlugin.fmtCost(c);
const fmtYield = (y: any) => gameBusinessLogicPlugin.fmtYield(y);
const upgradeName = (from: string, to: string) => gameBusinessLogicPlugin.upgradeName(from, to);
const tileInfo = (c: any) => gameBusinessLogicPlugin.tileInfo(c);
const canExplore = (x: number, y: number) => gameBusinessLogicPlugin.canExplore(x, y);
const whyNoExplore = (x: number, y: number) => gameBusinessLogicPlugin.whyNoExplore(x, y);
const explore = (x: number, y: number) => gameBusinessLogicPlugin.explore(x, y);
const isCoast = (x: number, y: number) => gameBusinessLogicPlugin.isCoast(x, y);
const countType = (t: string) => gameBusinessLogicPlugin.countType(t);
const uniqueAvailable = (to: string) => gameBusinessLogicPlugin.uniqueAvailable(to);
const bufferOK = (x: number, y: number, from: string, to: string) => gameBusinessLogicPlugin.bufferOK(x, y, from, to);

// ===== Workforce/Farm synergy ===== (Delegated to GameBusinessLogicPlugin)
const farmWorkers = () => gameBusinessLogicPlugin.farmWorkers();
const setFarmWorkers = (x: number, y: number, delta: number) => gameBusinessLogicPlugin.setFarmWorkers(x, y, delta);
const updateFarmSynergy = (d?: any) => gameBusinessLogicPlugin.updateFarmSynergy(d);

const openPanel = (x: number, y: number) => gameBusinessLogicPlugin.openPanel(x, y);

const startUpgrade = (x: number, y: number, c: any, s: any) => gameBusinessLogicPlugin.startUpgrade(x, y, c, s);

// ===== Turn / Events ===== (Delegated to GameHUDPlugin)
function endTurn() {
  return gameHUDPlugin.endTurn();
}

// ===== HUD / Summary ===== (Delegated to GameHUDPlugin)
const summary = (d: any) => gameHUDPlugin.showSummary(d);
const winLose = () => gameHUDPlugin.checkWinLose();
const gameOver = (win: boolean, msg: string) => gameHUDPlugin.showGameOver(win, msg);
const hud = () => gameHUDPlugin.updateHUD();

// ===== Save / Start ===== (Delegated to GameUIPlugin)
const save = () => gameUIPlugin.save();
const load = () => gameUIPlugin.load();
const clearOverlays = () => gameUIPlugin.clearOverlays();
const showStart = () => gameUIPlugin.showStart();

// Legacy global for compatibility with existing tests calling `showStart()` directly
(window as any).showStart = showStart;

// Setup GameUIPlugin with game context after all functions are declared
gameUIPlugin.setGameContext({
  state,
  gameStateService,
  rngService,
  worldGenUIService,
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

// Setup GameHUDPlugin with game context after all functions are declared
gameHUDPlugin.setGameContext({
  state,
  coreRulesPlugin,
  draw,
  showStart,
  each,
  T
});

// Setup GameBusinessLogicPlugin with game context after all functions are declared
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

// Setup GameWorldGenPlugin with game context after all functions are declared
gameWorldGenPlugin.setGameContext({
  state,
  worldGenUIService,
  rngService,
  gameStateService,
  resize,
  hud,
  draw,
  updateSeedDisplay,
  loadTileAtlas
});

// Setup GameRenderingPlugin with game context after all functions are declared
gameRenderingPlugin.setGameContext({
  state,
  canvas,
  ctx,
  idx,
  inBounds,
  each,
  rt,
  T,
  C,
  LABEL,
  DIRS
});

// Setup GameInputPlugin with game context after all functions are declared
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

// Boot bindings and worldgen debug panel (delegated to GameUIPlugin)
gameUIPlugin.setupBootBindings();
gameUIPlugin.setupWorldgenDebugPanel();

// Initialize the game
showStart();

// Expose KBTS for renderer/tests
(window as any).KBTS = {
  $,
  rng32,
  state,
  T,
  C,
  LABEL,
  BASE,
  DIRS,
  idx,
  inBounds,
  each,
  cell,
  generate,
  reveal,
  ensureStartResources,
  label,
  draw,
  drawCanvas,
  resize,
  hud,
  canExplore,
  explore,
  isCoast,
  startUpgrade,
  uniqueAvailable,
  noHouseNearby: noHouseNearbyLocal,
  houseNearby: houseNearbyLocal,
  setFarmWorkers,
  farmWorkers,
  updateFarmSynergy,
  endTurn,
  summary,
  countType,
  afford,
  whyNo,
  showStart,
  start: async (size?: any) => await generate(undefined as any, size),
  tileInfo,
  openPanel,
  // Height debug helpers
  computeHeightMap,
  adjustHeightByIndex,
  // RNG testing and debugging
  initializeRngStreams,
  originalSeed: () => rngService.getOriginalSeed(),
  worldGenRng: () => rngService.getWorldGenRng(),
  gameplayRng: () => rngService.getGameplayRng(),
  eventRng: () => rngService.getEventRng(),
  setRenderer: (name: string) => {
    const RN = (window as any).KBTS_Renderer;
    RN?.set?.(name);
  },
  getRenderer: () => {
    const RN = (window as any).KBTS_Renderer;
    return RN?.get?.() || "debug";
  },
  // Toggle simple island generation for coast autotiling validation
  setSimpleIslandOnly: (v: boolean) => { worldGenService.setSimpleIslandOnly(!!v); },
  getSimpleIslandOnly: () => worldGenService.getSimpleIslandOnly(),
  setCreateMode: (v: boolean) => { worldGenService.setCreateMode(!!v); },
  getCreateMode: () => worldGenService.getCreateMode(),
};

// ===== Height System (Flattened) =====
// Fixed heights by type; no neighbor-based adjustments.
// - WATER: 0
// - GRASS: 1
// - FOREST: 2
// - HUT/HOUSE/TOWN: 2
// - MOUNTAIN: 4
// - All others default to 1 if land (non-water)
function computeHeightMap() {
  terrainEditingService.computeHeightMap(state);
}

function adjustHeightByIndex(i: number, delta: number, propagate: boolean) {
  terrainEditingService.adjustHeightByIndex(state, i, delta, propagate);
}

// Updated function that doesn't mutate global seed
function updateSeedForTerrain(
  reason: "land-created" | "land-removed",
  x: number,
  y: number
) {
  terrainEditingService.updateSeedForTerrain(state, reason, x, y);
}

// Update the displayed seed for UI purposes without affecting RNG
function updateSeedDisplay() {
  terrainEditingService.updateSeedDisplay(state);
}

