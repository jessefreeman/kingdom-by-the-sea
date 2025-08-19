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
import { ServiceCoordinationPlugin } from "../plugins/core/ServiceCoordinationPlugin";
import { GlobalAPIPlugin } from "../plugins/core/GlobalAPIPlugin";
import { HeightSystemPlugin } from "../plugins/core/HeightSystemPlugin";
import { FunctionDelegationPlugin } from "../plugins/core/FunctionDelegationPlugin";
import { PluginCoordinationPlugin } from "../plugins/core/PluginCoordinationPlugin";
import { GameUtils } from "./utilities/GameUtils";
import { rngService } from "./services/RNGService";
import { worldGenService } from "./services/WorldGenService";
import { gameStateService } from "./services/GameStateService";
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

// Create plugin instances for modular functionality
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
  config: { get: () => ({}) }
});

// Create all plugin instances
const coreRulesPlugin = new CoreRulesPlugin();
coreRulesPlugin.init(createMockEngineContext() as any);

const serviceCoordinationPlugin = new ServiceCoordinationPlugin();
serviceCoordinationPlugin.init(createMockEngineContext() as any);
serviceCoordinationPlugin.setGameContext({ state });

const heightSystemPlugin = new HeightSystemPlugin();
heightSystemPlugin.init(createMockEngineContext() as any);

const globalAPIPlugin = new GlobalAPIPlugin();
globalAPIPlugin.init(createMockEngineContext() as any);

const gameUIPlugin = new GameUIPlugin();
gameUIPlugin.init(createMockEngineContext() as any);

const gameHUDPlugin = new GameHUDPlugin();
gameHUDPlugin.init(createMockEngineContext() as any);

const gameBusinessLogicPlugin = new GameBusinessLogicPlugin();
gameBusinessLogicPlugin.init(createMockEngineContext() as any);

const gameRenderingPlugin = new GameRenderingPlugin();
gameRenderingPlugin.init(createMockEngineContext() as any);

const gameInputPlugin = new GameInputPlugin();
gameInputPlugin.init(createMockEngineContext() as any);

const gameWorldGenPlugin = new GameWorldGenPlugin();
gameWorldGenPlugin.init(createMockEngineContext() as any);

const functionDelegationPlugin = new FunctionDelegationPlugin();
functionDelegationPlugin.init(createMockEngineContext() as any);

const pluginCoordinationPlugin = new PluginCoordinationPlugin();
pluginCoordinationPlugin.init(createMockEngineContext() as any);

// Constants for backward compatibility
const EXPLORE = { RISK: 0.25, FOOD: 1 };

// Get canvas references from ServiceCoordinationPlugin
const canvas = serviceCoordinationPlugin.getCanvas();
const ctx = serviceCoordinationPlugin.getContext();

// Setup FunctionDelegationPlugin to handle all delegations
functionDelegationPlugin.setGameContext({
  serviceCoordinationPlugin,
  gameWorldGenPlugin,
  gameRenderingPlugin,
  gameInputPlugin,
  gameBusinessLogicPlugin,
  gameHUDPlugin,
  heightSystemPlugin,
  canvas
});

// Create delegation functions using the plugin
const rand = () => functionDelegationPlugin.rand();
const idx = (x: number, y: number) => functionDelegationPlugin.idx(x, y);
const inBounds = (x: number, y: number) => functionDelegationPlugin.inBounds(x, y);
const each = (fn: (x: number, y: number, cell: Cell) => void) => functionDelegationPlugin.each(fn);
const cell = (t: string): Cell => functionDelegationPlugin.cell(t);
const resize = () => functionDelegationPlugin.resize();
const rt = (c: any) => functionDelegationPlugin.renderType(c);
const houseNearbyLocal = (x: number, y: number) => functionDelegationPlugin.houseNearby(x, y);
const noHouseNearbyLocal = (x: number, y: number) => functionDelegationPlugin.noHouseNearby(x, y);

// World Generation functions
const getCreateMode = () => functionDelegationPlugin.getCreateMode();
const setCreateMode = (enabled: boolean) => functionDelegationPlugin.setCreateMode(enabled);
const getGenParams = () => functionDelegationPlugin.getGenParams();
const setGenParams = (params: any) => functionDelegationPlugin.setGenParams(params);
const getOrgParams = () => functionDelegationPlugin.getOrgParams();
const setOrgParams = (params: any) => functionDelegationPlugin.setOrgParams(params);
const initWorldgenPlugin = async () => functionDelegationPlugin.initWorldgenPlugin();
const generate = async (seed = Date.now(), size: "small" | "medium" | "large" = "medium") => functionDelegationPlugin.generate(seed, size);
const reveal = (cx: number, cy: number, r: number) => functionDelegationPlugin.reveal(cx, cy, r);
const ensureStartResources = (sx: number, sy: number) => functionDelegationPlugin.ensureStartResources(sx, sy);
const initializeRngStreams = (baseSeed: number) => functionDelegationPlugin.initializeRngStreams(baseSeed);

// Rendering functions
const label = (c: any) => functionDelegationPlugin.label(c);
const loadTileAtlas = async () => functionDelegationPlugin.loadTileAtlas();
const tile = (x: number, y: number, c: any) => functionDelegationPlugin.tile(x, y, c);
const drawCanvas = () => functionDelegationPlugin.drawCanvas();
const draw = () => functionDelegationPlugin.draw();

// Business Logic functions
const afford = (c: any) => functionDelegationPlugin.afford(c);
const whyNo = (spec: any, cell: any) => functionDelegationPlugin.whyNo(spec, cell);
const fmtCost = (c: any) => functionDelegationPlugin.fmtCost(c);
const fmtYield = (y: any) => functionDelegationPlugin.fmtYield(y);
const upgradeName = (from: string, to: string) => functionDelegationPlugin.upgradeName(from, to);
const tileInfo = (c: any) => functionDelegationPlugin.tileInfo(c);
const canExplore = (x: number, y: number) => functionDelegationPlugin.canExplore(x, y);
const whyNoExplore = (x: number, y: number) => functionDelegationPlugin.whyNoExplore(x, y);
const explore = (x: number, y: number) => functionDelegationPlugin.explore(x, y);
const isCoast = (x: number, y: number) => functionDelegationPlugin.isCoast(x, y);
const countType = (t: string) => functionDelegationPlugin.countType(t);
const uniqueAvailable = (to: string) => functionDelegationPlugin.uniqueAvailable(to);
const bufferOK = (x: number, y: number, from: string, to: string) => functionDelegationPlugin.bufferOK(x, y, from, to);
const farmWorkers = () => functionDelegationPlugin.farmWorkers();
const setFarmWorkers = (x: number, y: number, delta: number) => functionDelegationPlugin.setFarmWorkers(x, y, delta);
const updateFarmSynergy = (d?: any) => functionDelegationPlugin.updateFarmSynergy(d);
const openPanel = (x: number, y: number) => functionDelegationPlugin.openPanel(x, y);
const startUpgrade = (x: number, y: number, c: any, s: any) => functionDelegationPlugin.startUpgrade(x, y, c, s);

// HUD functions
const endTurn = () => functionDelegationPlugin.endTurn();
const summary = (d: any) => functionDelegationPlugin.showSummary(d);
const winLose = () => functionDelegationPlugin.checkWinLose();
const gameOver = (win: boolean, msg: string) => functionDelegationPlugin.showGameOver(win, msg);
const hud = () => functionDelegationPlugin.updateHUD();

// Height System functions
const computeHeightMap = () => functionDelegationPlugin.computeHeightMap();
const adjustHeightByIndex = (i: number, delta: number, propagate: boolean) => functionDelegationPlugin.adjustHeightByIndex(i, delta, propagate);
const updateSeedForTerrain = (reason: "land-created" | "land-removed", x: number, y: number) => functionDelegationPlugin.updateSeedForTerrain(reason, x, y);
const updateSeedDisplay = () => functionDelegationPlugin.updateSeedDisplay();

// ===== Save / Start ===== (Delegated to GameUIPlugin)
const save = () => gameUIPlugin.save();
const load = () => gameUIPlugin.load();
const clearOverlays = () => gameUIPlugin.clearOverlays();
const showStart = () => gameUIPlugin.showStart();

// Legacy global for compatibility with existing tests calling `showStart()` directly
(window as any).showStart = showStart;

// Setup all plugins using PluginCoordinationPlugin
pluginCoordinationPlugin.setGameContext({
  state, serviceCoordinationPlugin, coreRulesPlugin, gameUIPlugin, gameHUDPlugin,
  gameBusinessLogicPlugin, gameWorldGenPlugin, heightSystemPlugin, gameRenderingPlugin,
  gameInputPlugin, globalAPIPlugin, functionDelegationPlugin, gameStateService, rngService,
  canvas, ctx, generate, getGenParams, setGenParams, getOrgParams, setOrgParams, resize,
  hud, draw, endTurn, rng32, showStart, each, idx, inBounds, getCreateMode, rt,
  houseNearbyLocal, updateSeedDisplay, loadTileAtlas, EXPLORE, rand, cell, reveal,
  ensureStartResources, label, drawCanvas, canExplore, explore, isCoast, startUpgrade,
  uniqueAvailable, noHouseNearbyLocal, setFarmWorkers, farmWorkers, updateFarmSynergy,
  summary, countType, afford, whyNo, tileInfo, openPanel, computeHeightMap,
  adjustHeightByIndex, initializeRngStreams
});

pluginCoordinationPlugin.setupAllPluginContexts();
pluginCoordinationPlugin.bootPlugins();

// Initialize the game
showStart();

// Expose global API
pluginCoordinationPlugin.exposeGlobalAPI();

// Legacy global for compatibility with existing tests calling functions directly