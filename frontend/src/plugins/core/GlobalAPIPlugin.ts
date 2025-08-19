// GlobalAPIPlugin.ts - Extracted global API exposure from kbts.ts
// Handles exposing KBTS API on window object for external access

import { EngineContext } from "../../engine/contracts/plugins";
import { rngService } from "../../engine/services/RNGService";
import { worldGenService } from "../../engine/services/WorldGenService";
import { GameUtils } from "../../engine/utilities/GameUtils";
import { T, C, LABEL, BASE, DIRS } from "../../engine/constants";

interface GlobalAPIContext {
  state: any;
  // All the functions that need to be exposed
  rand: () => number;
  rng32: () => number;
  idx: (x: number, y: number) => number;
  inBounds: (x: number, y: number) => boolean;
  each: (fn: (x: number, y: number, cell: any) => void) => void;
  cell: (t: string) => any;
  generate: (seed?: any, size?: any) => Promise<any>;
  reveal: (cx?: number, cy?: number, r?: number) => void;
  ensureStartResources: (sx: number, sy: number) => void;
  label: (c: any) => string;
  draw: () => void;
  drawCanvas: () => void;
  resize: () => void;
  hud: () => void;
  canExplore: (x: number, y: number) => boolean;
  explore: (x: number, y: number) => void;
  isCoast: (x: number, y: number) => boolean;
  startUpgrade: (x: number, y: number, c: any, s: any) => void;
  uniqueAvailable: (to: string) => boolean;
  noHouseNearby: (x: number, y: number) => boolean;
  houseNearby: (x: number, y: number) => boolean;
  setFarmWorkers: (x: number, y: number, delta: number) => void;
  farmWorkers: () => number;
  updateFarmSynergy: (d?: any) => void;
  endTurn: () => void;
  summary: (d: any) => void;
  countType: (t: string) => number;
  afford: (c: any) => boolean;
  whyNo: (spec: any, cell: any) => string;
  showStart: () => void;
  tileInfo: (c: any) => string;
  openPanel: (x: number, y: number) => void;
  computeHeightMap: () => void;
  adjustHeightByIndex: (i: number, delta: number, propagate: boolean) => void;
  initializeRngStreams: (baseSeed: number) => void;
}

export class GlobalAPIPlugin {
  private context!: EngineContext;
  private gameContext!: GlobalAPIContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GlobalAPIContext): void {
    this.gameContext = gameContext;
  }

  // ===== Global API Exposure =====
  exposeGlobalAPI(): void {
    const { $ } = GameUtils.DOM;
    const { rng32 } = GameUtils.RNG;
    const {
      state,
      rand, idx, inBounds, each, cell, generate, reveal, ensureStartResources,
      label, draw, drawCanvas, resize, hud, canExplore, explore, isCoast,
      startUpgrade, uniqueAvailable, noHouseNearby, houseNearby, setFarmWorkers,
      farmWorkers, updateFarmSynergy, endTurn, summary, countType, afford,
      whyNo, showStart, tileInfo, openPanel, computeHeightMap, adjustHeightByIndex,
      initializeRngStreams
    } = this.gameContext;

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
      noHouseNearby,
      houseNearby,
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
  }
}
