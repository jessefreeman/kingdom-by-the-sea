// GameRenderingPlugin.ts - Extracted rendering functionality from kbts.ts
// Handles tile rendering, canvas drawing, and tile atlas management

import { EngineContext } from "../../engine/contracts/plugins";
import { GameUtils } from "../../engine/utilities/GameUtils";
import { getCoastOverlaysAt } from "../../engine/utilities/autotile";

interface GameRenderingContext {
  state: any;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  each: (fn: (x: number, y: number, cell: any) => void) => void;
  idx: (x: number, y: number) => number;
  inBounds: (x: number, y: number) => boolean;
  rt: (c: any) => any;
  T: any;
  C: any;
  LABEL: any;
  DIRS: any;
}

export class GameRenderingPlugin {
  private context!: EngineContext;
  private gameContext!: GameRenderingContext;
  private isInitialized = false;
  private tileAtlasModule: any = null;
  private readonly varA = "#7bdff6";

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GameRenderingContext): void {
    this.gameContext = gameContext;
  }

  // ===== Rendering Utilities =====
  label(c: any): string {
    const { T, LABEL } = this.gameContext;
    return !c || c.type === T.WATER
      ? ""
      : c.disc
      ? LABEL[c.type] || c.type.slice(0, 2).toUpperCase()
      : "?";
  }

  async loadTileAtlas(): Promise<any> {
    if (!this.tileAtlasModule) {
      try {
        this.tileAtlasModule = await import("../../engine/services/tileAtlas");
        await this.tileAtlasModule.tileAtlas.load();
        // Force redraw once atlas is loaded
        this.draw();
      } catch (e) {
        console.warn("Could not load tile atlas for debug renderer:", e);
      }
    }
    return this.tileAtlasModule?.tileAtlas;
  }

  // ===== Tile Rendering =====
  tile(x: number, y: number, c: any): void {
    const { state, ctx, idx, inBounds, rt, T, C, DIRS } = this.gameContext;
    const ts = state.size.t,
      px = x * ts,
      py = y * ts;
    
    if (!c) {
      ctx.fillStyle = "#0b0f22";
      ctx.fillRect(px, py, ts, ts);
      return;
    }
    
    const t = rt(c);
    const h = c.h | 0; // height levels; 1 level = 16px in 3D, but here we fake shadow/offset

    // Try to use tile atlas if available
    const atlas = this.tileAtlasModule?.tileAtlas;
    if (atlas && atlas.isLoaded()) {
      const useLetters = true; // Use letter tiles during development
      const useFog = state.fogEnabled !== false && !c.disc;

      let tileCanvas: HTMLCanvasElement | null = null;

      if (t === T.WATER) {
        // 2D preview: draw procedurally to match auto-tile-test.html 1:1
        const tsz = state.size.t;
        const px0 = px, py0 = py;
        // Base water
        ctx.fillStyle = '#0b2a4a';
        ctx.fillRect(px0, py0, tsz, tsz);
        // Compute overlays
        const q = {
          inBounds: (xx: number, yy: number) => inBounds(xx, yy),
          isLand: (xx: number, yy: number) => {
            if (!inBounds(xx, yy)) return false;
            const tt = rt(state.map[idx(xx, yy)]);
            return tt !== T.WATER;
          }
        };
        const { edges, corners, caps } = getCoastOverlaysAt(q as any, x, y);
        const e = Math.max(2, Math.round(tsz * 0.28));
        const r = Math.max(3, Math.round(tsz * 0.42));
        // Edges
        ctx.fillStyle = '#1f6feb';
        for (const d of edges) {
          if (d === 'N') ctx.fillRect(px0, py0, tsz, e);
          if (d === 'S') ctx.fillRect(px0, py0 + tsz - e, tsz, e);
          if (d === 'W') ctx.fillRect(px0, py0, e, tsz);
          if (d === 'E') ctx.fillRect(px0 + tsz - e, py0, e, tsz);
        }
        // Caps
        for (const cdir of caps) {
          if (cdir === 'NW') ctx.fillRect(px0, py0, e, e);
          if (cdir === 'NE') ctx.fillRect(px0 + tsz - e, py0, e, e);
          if (cdir === 'SW') ctx.fillRect(px0, py0 + tsz - e, e, e);
          if (cdir === 'SE') ctx.fillRect(px0 + tsz - e, py0 + tsz - e, e, e);
        }
        // Corners (quarter-circle)
        for (const cdir of corners) {
          ctx.beginPath();
          if (cdir === 'NW') { ctx.moveTo(px0, py0); ctx.arc(px0, py0, r, 0, Math.PI/2, true); }
          if (cdir === 'NE') { ctx.moveTo(px0 + tsz, py0); ctx.arc(px0 + tsz, py0, r, Math.PI, Math.PI/2, true); }
          if (cdir === 'SW') { ctx.moveTo(px0, py0 + tsz); ctx.arc(px0, py0 + tsz, r, 0, -Math.PI/2, true); }
          if (cdir === 'SE') { ctx.moveTo(px0 + tsz, py0 + tsz); ctx.arc(px0 + tsz, py0 + tsz, r, Math.PI, -Math.PI/2, true); }
          ctx.closePath();
          ctx.fill();
        }
        // Selection overlay if selected
        if (state.sel === idx(x, y)) {
          ctx.strokeStyle = this.varA; 
          ctx.lineWidth = 2; 
          ctx.strokeRect(px0 + 1, py0 + 1, tsz - 2, tsz - 2);
        }
        return; // Done procedurally for water; skip atlas path
      } else {
        // Land tiles: use coast_land as a generic base for now if no per-biome art
        const baseKey = (t === T.GRASS || t === T.FOREST || t === T.MOUNTAIN || t === T.HILL) ? 'coast_land' : (t || T.WATER);
        tileCanvas = atlas.getTileCanvas(baseKey, useLetters, useFog);
      }
      
      if (tileCanvas) {
        // Scale the atlas tile to the current tile size
        ctx.save();
        (ctx as any).imageSmoothingEnabled = false;
        ctx.drawImage(tileCanvas, 0, 0, tileCanvas.width, tileCanvas.height, px, py, ts, ts);
        ctx.restore();

        // Add overlays
        if (state.sel === idx(x, y)) {
          ctx.strokeStyle = this.varA;
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        }

        if (c.type === T.FARM && (c.fx | 0) === 2 && c.disc) {
          ctx.save();
          ctx.font = `bold ${Math.max(8, Math.floor(ts * 0.5))}px ui-monospace,Menlo`;
          ctx.textAlign = "right";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#fff";
          ctx.globalAlpha = 0.9;
          ctx.fillText("+", px + ts - 3, py + 2);
          ctx.restore();
        }

        if (c.upg && c.upg.total > 1) {
          ctx.save();
          ctx.fillStyle = "#000";
          ctx.globalAlpha = 0.45;
          ctx.fillRect(px + 2, py + ts - 10, 24, 8);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px ui-monospace,Menlo";
          const step = c.upg.prog || 0;
          ctx.fillText(`${step}/${c.upg.total}`, px + 14, py + ts - 6);
          ctx.restore();
        }

        return;
      }
    }

    // Fallback to color-based rendering
    if (t === T.WATER) {
      let coast = false;
      for (const d of DIRS) {
        const nx = x + d[0],
          ny = y + d[1];
        if (inBounds(nx, ny)) {
          const n = rt(state.map[idx(nx, ny)]);
          if (n !== T.WATER) {
            coast = true;
            break;
          }
        }
      }
      ctx.fillStyle = (coast ? C.coast : C[T.WATER]) || "#0c3b66";
    } else {
      const fill = (t && (C as any)[t]) || "#333";
      ctx.fillStyle = fill as string;
    }
    
    // Vertical offset for debug 2D: draw higher tiles slightly lighter border and small top offset
    ctx.fillRect(px, py, ts, ts);
    if (h > 0) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#000";
      ctx.fillRect(px, py, ts, 2);
      ctx.restore();
    }
    
    if (state.fogEnabled !== false && !c.disc) {
      ctx.fillStyle = C.fog || "#0a0d1a";
      ctx.globalAlpha = 0.75;
      ctx.fillRect(px, py, ts, ts);
      ctx.globalAlpha = 1;
    }
    
    if (state.sel === idx(x, y)) {
      ctx.strokeStyle = this.varA;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
    }
    
    let tl = "";
    if (c.disc || state.fogEnabled === false) {
      const tt = c.upg ? rt(c) : c.type;
      tl = this.gameContext.LABEL[tt] || String(tt).slice(0, 2).toUpperCase();
    }
    
    if (tl) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.font = `bold ${Math.max(9, Math.floor(ts * 0.6))}px ui-monospace,Menlo`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(tl, px + ts / 2, py + ts / 2 + 0.5);
      ctx.restore();
    }
    
    // Height debug overlay
    if ((c.disc || state.fogEnabled === false) && (c.h | 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = `bold ${Math.max(7, Math.floor(ts * 0.35))}px ui-monospace,Menlo`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#fff";
      ctx.fillText("h" + (c.h | 0), px + 2, py + 2);
      ctx.restore();
    }
    
    if (c.type === T.FARM && (c.fx | 0) === 2 && c.disc) {
      ctx.save();
      ctx.font = `bold ${Math.max(8, Math.floor(ts * 0.5))}px ui-monospace,Menlo`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.9;
      ctx.fillText("+", px + ts - 3, py + 2);
      ctx.restore();
    }
    
    if (c.upg && c.upg.total > 1) {
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.globalAlpha = 0.45;
      ctx.fillRect(px + 2, py + ts - 10, 24, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px ui-monospace,Menlo";
      const step = c.upg.prog || 0;
      ctx.fillText(`${step}/${c.upg.total}`, px + 14, py + ts - 6);
      ctx.restore();
    }
  }

  // ===== Canvas Drawing =====
  drawCanvas(): void {
    const { canvas, ctx, each } = this.gameContext;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    each((x: number, y: number, c: any) => this.tile(x, y, c));
  }

  draw(): void {
    const RN = (window as any).KBTS_Renderer;
    if (RN?.draw) {
      RN.draw();
      return;
    }
    this.drawCanvas();
  }

  // ===== Public API =====
  isReady(): boolean {
    return this.isInitialized && !!this.gameContext;
  }
}
