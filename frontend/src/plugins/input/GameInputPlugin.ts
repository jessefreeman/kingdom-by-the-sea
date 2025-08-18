// GameInputPlugin.ts - Extracted input handling functionality from kbts.ts
// Handles canvas clicks, keyboard controls, and debug commands

import { EngineContext } from "../../engine/contracts/plugins";

interface GameInputContext {
  state: any;
  canvas: HTMLCanvasElement;
  idx: (x: number, y: number) => number;
  inBounds: (x: number, y: number) => boolean;
  draw: () => void;
  openPanel: (x: number, y: number) => void;
  getCreateMode: () => boolean;
  adjustHeightByIndex: (i: number, delta: number, propagate: boolean) => void;
}

export class GameInputPlugin {
  private context!: EngineContext;
  private gameContext!: GameInputContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GameInputContext): void {
    this.gameContext = gameContext;
  }

  // ===== Canvas Input =====
  setupCanvasInput(): void {
    const { canvas } = this.gameContext;
    canvas.addEventListener("click", this.handleCanvasClick.bind(this));
  }

  public handleCanvasClick(e: MouseEvent): void {
    const { canvas, state, idx, inBounds, draw, openPanel, getCreateMode } = this.gameContext;
    
    const r = canvas.getBoundingClientRect();
    // Convert client pixels -> canvas pixels to handle CSS scaling
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const cx = (e.clientX - r.left) * scaleX;
    const cy = (e.clientY - r.top) * scaleY;
    const x = Math.floor(cx / state.size.t);
    const y = Math.floor(cy / state.size.t);
    
    if (!inBounds(x, y)) return;
    
    if (getCreateMode()) { 
      state.sel = idx(x, y); 
      draw(); 
      return; 
    }
    
    state.sel = idx(x, y);
    draw();
    openPanel(x, y);
  }

  // ===== Keyboard Input =====
  setupKeyboardInput(): void {
    // Debug height controls: +/- to raise/lower only the selected tile (no propagation)
    document.addEventListener("keydown", this.handleHeightControls.bind(this));
    
    // Fog of War toggle (F key)
    document.addEventListener("keydown", this.handleFogToggle.bind(this));
    
    // Atlas debug display (A key)
    document.addEventListener("keydown", this.handleAtlasDebug.bind(this));
    
    // Atlas info to console (Shift+A)
    document.addEventListener("keydown", this.handleAtlasInfo.bind(this));
    
    // Debug dump (K key) - handled elsewhere but could be moved here
    document.addEventListener("keydown", this.handleDebugDump.bind(this));
    
    // Autotile test helpers
    document.addEventListener("keydown", this.handleAutotileTest.bind(this));
  }

  private handleHeightControls(e: KeyboardEvent): void {
    const { state, adjustHeightByIndex } = this.gameContext;
    
    if (state.sel == null) return;
    
    if (e.key === "+" || e.key === "=") {
      adjustHeightByIndex(state.sel, +1, false);
      e.preventDefault();
      return;
    }
    
    if (e.key === "-" || e.key === "_") {
      adjustHeightByIndex(state.sel, -1, false);
      e.preventDefault();
      return;
    }
  }

  private handleFogToggle(e: KeyboardEvent): void {
    const { state, draw } = this.gameContext;
    
    if (e.key === "f" || e.key === "F") {
      state.fogEnabled = !state.fogEnabled;
      draw();
      e.preventDefault();
    }
  }

  private handleAtlasDebug(e: KeyboardEvent): void {
    if (e.key === "a" || e.key === "A") {
      import("../../engine/services/tileAtlasPreloader").then(module => {
        module.tileAtlasPreloader.showAtlasDebug(6);
      }).catch(err => {
        console.warn("Could not load atlas preloader for debug:", err);
      });
      e.preventDefault();
    }
  }

  private handleAtlasInfo(e: KeyboardEvent): void {
    if ((e.key === "A") && e.shiftKey) {
      import("../../engine/services/tileAtlasPreloader").then(module => {
        module.tileAtlasPreloader.logAtlasInfo();
      }).catch(err => {
        console.warn("Could not load atlas preloader for debug:", err);
      });
      e.preventDefault();
    }
  }

  private handleDebugDump(e: KeyboardEvent): void {
    // This could be moved here from kbts.ts if desired
    // Currently handled in main file
  }

  private handleAutotileTest(e: KeyboardEvent): void {
    // Autotile test functionality could be added here
    // Currently handled in main file
  }

  // ===== Autotile Test Helpers =====
  toggleTileForAutotileTest(x: number, y: number, erase = false): void {
    const { state, idx, draw } = this.gameContext;
    const i = idx(x, y);
    const c = state.map[i] as any;
    if (!c) return;
    
    // This would need access to rt and T constants
    // const t = rt(c);
    // if (erase || t !== T.WATER) c.type = T.WATER; else c.type = T.GRASS;
    c.disc = true;
    draw();
  }

  // ===== Setup =====
  setupAllInput(): void {
    this.setupCanvasInput();
    this.setupKeyboardInput();
  }

  // ===== Public API =====
  isReady(): boolean {
    return this.isInitialized && !!this.gameContext;
  }
}
