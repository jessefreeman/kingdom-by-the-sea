// Kingdom by the Sea — TypeScript global API (KBTS)
// Port of the JS game core, exposed on window for renderer/tests.

import type { Cell, State, UpgradeSpec } from "./contracts/types";
import { getCoastOverlaysAt } from "./utilities/autotile";
import { CoreRulesPlugin } from "../plugins/rules/core/CoreRulesPlugin";
import { GameUIPlugin } from "../plugins/ui/GameUIPlugin";
import { GameHUDPlugin } from "../plugins/ui/GameHUDPlugin";
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

// ===== State Management =====

// Initialize RNG service wrapper
const initializeRngStreams = (baseSeed: number) => {
  gameStateService.initializeRNG(baseSeed);
};

// ===== World Generation =====
// Access world generation configuration through service
const getCreateMode = () => worldGenUIService.getCreateMode();
const setCreateMode = (enabled: boolean) => worldGenUIService.setCreateMode(enabled);
const getGenParams = () => worldGenUIService.getGenParams();
const setGenParams = (params: any) => worldGenUIService.setGenParams(params);
const getOrgParams = () => worldGenUIService.getOrgParams();
const setOrgParams = (params: any) => worldGenUIService.setOrgParams(params);

// Initialize worldgen plugin for use with legacy generate function
async function initWorldgenPlugin() {
  return await worldGenUIService.initWorldgenPlugin(state);
}

async function generate(
  seed = Date.now(),
  size: "small" | "medium" | "large" = "medium"
) {
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
  $("seedOut").textContent = String(rngService.getOriginalSeed());
  $("mapOut").textContent = `${state.size.w}×${state.size.h}`;
}

function reveal(cx: number, cy: number, r: number) {
  worldGenUIService.reveal(state, cx, cy, r);
}

function ensureStartResources(sx: number, sy: number) {
  worldGenUIService.ensureStartResources(state, sx, sy);
}

// ===== Rendering (fallback if renderer missing) =====
const varA = "#7bdff6";
const label = (c: any) =>
  !c || c.type === T.WATER
    ? ""
    : c.disc
    ? LABEL[c.type] || c.type.slice(0, 2).toUpperCase()
    : "?";

// Import tile atlas for debug renderer
let tileAtlasModule: any = null;
async function loadTileAtlas() {
  if (!tileAtlasModule) {
    try {
      tileAtlasModule = await import("./services/tileAtlas");
      await tileAtlasModule.tileAtlas.load();
      // Force redraw once atlas is loaded
      draw();
    } catch (e) {
      console.warn("Could not load tile atlas for debug renderer:", e);
    }
  }
  return tileAtlasModule?.tileAtlas;
}

function tile(x: number, y: number, c: any) {
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
  const atlas = tileAtlasModule?.tileAtlas;
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
        ctx.strokeStyle = varA; ctx.lineWidth = 2; ctx.strokeRect(px0 + 1, py0 + 1, tsz - 2, tsz - 2);
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
        ctx.strokeStyle = varA;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      }

      if (c.type === T.FARM && (c.fx | 0) === 2 && c.disc) {
        ctx.save();
        ctx.font = `bold ${Math.max(
          8,
          Math.floor(ts * 0.5)
        )}px ui-monospace,Menlo`;
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
    ctx.strokeStyle = varA;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
  }
  let tl = "";
  if (c.disc || state.fogEnabled === false) {
    const tt = c.upg ? rt(c) : c.type;
    tl = LABEL[tt] || String(tt).slice(0, 2).toUpperCase();
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
    ctx.font = `bold ${Math.max(
      7,
      Math.floor(ts * 0.35)
    )}px ui-monospace,Menlo`;
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
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  each((x, y, c) => tile(x, y, c));
}
function draw() {
  const RN = (window as any).KBTS_Renderer;
  if (RN?.draw) {
    RN.draw();
    return;
  }
  drawCanvas();
}

// ===== Input =====
const canvasClick = (e: MouseEvent) => {
  const r = canvas.getBoundingClientRect();
  // Convert client pixels -> canvas pixels to handle CSS scaling
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  const cx = (e.clientX - r.left) * scaleX;
  const cy = (e.clientY - r.top) * scaleY;
  const x = Math.floor(cx / state.size.t);
  const y = Math.floor(cy / state.size.t);
  if (!inBounds(x, y)) return;
  if (getCreateMode()) { state.sel = idx(x, y); draw(); return; }
  state.sel = idx(x, y);
  draw();
  openPanel(x, y);
};
canvas.addEventListener("click", canvasClick);
// Debug height controls: +/- to raise/lower only the selected tile (no propagation)
document.addEventListener("keydown", (e: KeyboardEvent) => {
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
});
// Fog of War toggle (F key)
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "f" || e.key === "F") {
    state.fogEnabled = !state.fogEnabled;
    draw();
    e.preventDefault();
  }
});
// Atlas debug display (A key)
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "a" || e.key === "A") {
    import("./services/tileAtlasPreloader").then(module => {
      module.tileAtlasPreloader.showAtlasDebug(6);
    }).catch(err => {
      console.warn("Could not load atlas preloader for debug:", err);
    });
    e.preventDefault();
  }
});
// Atlas info to console (Shift+A)
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.key === "A") && e.shiftKey) {
    import("./services/tileAtlasPreloader").then(module => {
      module.tileAtlasPreloader.logAtlasInfo();
    }).catch(err => {
      console.warn("Could not load atlas preloader for debug:", err);
    });
    e.preventDefault();
  }
});

// === Autotile test helpers ===
function toggleTileForAutotileTest(x: number, y: number, erase = false) {
  const i = idx(x, y);
  const c = state.map[i] as any;
  if (!c) return;
  const t = rt(c);
  if (erase || t !== T.WATER) c.type = T.WATER; else c.type = T.GRASS;
  c.disc = true;
  draw();
}

// ===== Rules / UI =====
const afford = (c: any) => coreRulesPlugin.afford(c);
const whyNo = (spec: any, cell: any) => coreRulesPlugin.whyNo(spec, cell);
const fmtCost = (c: any) =>
  Object.entries(c || {})
    .filter((p) => p[0] !== "Y")
    .map((p) => p[0] + ":" + p[1])
    .join(" ");
const fmtYield = (y: any) =>
  !y
    ? ""
    : Object.entries(y)
        .map((p) => p[0] + ":+" + p[1] + "/t")
        .join(" ");
const upgradeName = (from: string, to: string) =>
  from === T.BURNT
    ? "CLEAR"
    : from === T.RUBBLE
    ? "REBUILD"
    : String(to).toUpperCase();
function tileInfo(c: any) {
  const y = BASE[c.type];
  const needs = c.type === T.FARM && !(c.wrk > 0);
  return {
    yield: needs ? "— (needs worker)" : y ? fmtYield(y) : "—",
    status: c.upg
      ? "Upgrading → " +
        upgradeName(c.type, c.upg.to) +
        " • " +
        c.upg.left +
        "t left"
      : "—",
  };
}

// const isAdj = (x: number, y: number) => {
//   for (const d of DIRS) {
//     const nx = x + d[0],
//       ny = y + d[1];
//     if (!inBounds(nx, ny)) continue;
//     const nc = state.map[idx(nx, ny)] as any;
//     if (nc && nc.disc) return true;
//   }
//   return false;
// };
const canExplore = (x: number, y: number) => coreRulesPlugin.canExplore(x, y);
const whyNoExplore = (x: number, y: number) => coreRulesPlugin.whyNoExplore(x, y);
function explore(x: number, y: number) {
  const success = coreRulesPlugin.explore(x, y);
  if (success) {
    hud();
    draw();
  }
}

// const hasAdjType = (x: number, y: number, t: string) => {
//   for (const d of DIRS) {
//     const nx = x + d[0],
//       ny = y + d[1];
//     if (!inBounds(nx, ny)) continue;
//     const nc = state.map[idx(nx, ny)] as any;
//     if (nc && rt(nc) === t) return true;
//   }
//   return false;
// };
function isCoast(x: number, y: number) {
  if (!inBounds(x, y)) return false;
  const c = state.map[idx(x, y)] as any;
  if (!c || rt(c) !== T.WATER) return false;
  return DIRS.some((d) => {
    const nx = x + d[0],
      ny = y + d[1];
    return inBounds(nx, ny) && rt(state.map[idx(nx, ny)] as any) !== T.WATER;
  });
}
const countType = (t: string) => coreRulesPlugin.countType(t);
const uniqueAvailable = (to: string) => coreRulesPlugin.uniqueAvailable(to);
function bufferOK(x: number, y: number, from: string, to: string) {
  if (!houseNearbyLocal(x, y)) return true;
  if (to === T.FARM) return true;
  if (from === T.FOREST && to === T.GRASS) return true;
  return false;
}

// ===== Workforce/Farm synergy =====
const farmWorkers = () => {
  let n = 0;
  each((x, y, c: any) => {
    if (c.type === T.FARM) n += c.wrk | 0;
  });
  return n;
};
function setFarmWorkers(x: number, y: number, delta: number) {
  const i = idx(x, y),
    c = state.map[i] as any;
  if (!c || c.type !== T.FARM) return;
  const cur = c.wrk | 0;
  if (delta > 0) {
    if (state.actions <= 0 || cur >= 1) return;
    c.wrk = cur + 1;
    state.actions = Math.max(0, state.actions - 1);
  } else {
    if (cur <= 0) return;
    c.wrk = cur - 1;
    state.actions = Math.min(state.people - farmWorkers(), state.actions + 1);
  }
  hud();
  draw();
  openPanel(x, y);
}
function updateFarmSynergy(d?: any) {
  const hasArr = new Array(state.size.w * state.size.h).fill(false);
  each((x, y, c: any) => {
    if (c.type !== T.FARM || (c.wrk | 0) <= 0) return;
    for (const dxy of DIRS) {
      const nx = x + dxy[0],
        ny = y + dxy[1];
      if (!inBounds(nx, ny)) continue;
      const n = state.map[idx(nx, ny)] as any;
      if (n && n.type === T.FARM && (n.wrk | 0) > 0) {
        hasArr[idx(x, y)] = true;
        break;
      }
    }
  });
  each((x, y, c: any) => {
    if (c.type !== T.FARM) {
      if (c.fx) c.fx = 0;
      return;
    }
    const prev = c.fx | 0,
      has = hasArr[idx(x, y)];
    if (has) {
      c.fx = prev === 0 ? 1 : prev === 1 ? 2 : 2;
      if (c.fx === 2 && prev !== 2) {
        if (d) d.events.push(`Farm synergy active at (${x},${y})`);
      }
    } else {
      c.fx = 0;
    }
  });
}

function openPanel(x: number, y: number) {
  if (getCreateMode()) { $("panel").innerHTML = ""; return; }
  const c = state.map[idx(x, y)] as any,
    P = $("panel");
  if (!c) {
    P.innerHTML = "";
    return;
  }
  if (!c.disc) {
    const can = canExplore(x, y),
      why = can ? "" : whyNoExplore(x, y),
      dis = can ? "" : `disabled title="${esc(why)}"`;
    P.innerHTML = `<div class="card"><div class="title">Unknown @ (${x},${y})</div><div class="section">Explore: adjacent (4-dir) only • uses 1A + 1F • ${Math.round(
      EXPLORE.RISK * 100
    )}% risk −1P</div><button class="btn primary" ${dis} id="e">Explore</button></div>`;
    const b = $("e");
    if (b)
      (b as HTMLButtonElement).onclick = () => {
        explore(x, y);
        openPanel(x, y);
      };
    return;
  }
  const info = tileInfo(c),
    opts = coreRulesPlugin.getUpgradeSpecs(c.type);
  const farmCtrl =
    c.type === T.FARM
      ? `<div class="section"><div><b>Workers</b> ${
          c.wrk | 0
        }/1 <span class="hint">(ties up 1 Action)</span></div><div style="display:flex;gap:6px"><button class="btn" id="wMinus" ${
          (c.wrk | 0) <= 0 ? "disabled" : ""
        }>− Remove</button><button class="btn" id="wPlus" ${
          state.actions <= 0 || (c.wrk | 0) >= 1 ? "disabled" : ""
        }>+ Assign</button></div></div>`
      : "";
  const rows = opts.length
    ? opts
        .map((o, i) => {
          const baseOK = afford(o.cost) && state.actions > 0 && !c.upg,
            bufOK = bufferOK(x, y, c.type, o.to as any),
            siteOK =
              (!o.pre || o.pre(x, y)) && uniqueAvailable(o.to as any) && bufOK,
            can = baseOK && siteOK;
          const whyParts: string[] = [];
          if (!baseOK) whyParts.push(whyNo(o, c));
          if (baseOK && !siteOK) {
            if (!bufOK) whyParts.push("residence buffer (farm-only)");
            if (o.pre && !o.pre(x, y))
              whyParts.push(o.req || "site requirement not met");
            if (!uniqueAvailable(o.to as any))
              whyParts.push("unique limit reached");
          }
          const why = can ? "" : whyParts.filter(Boolean).join("; "),
            yd = [fmtYield((o as any).perTurn), fmtYield(o.instant as any)]
              .filter(Boolean)
              .join(" • "),
            dis = can ? "" : `disabled title="${esc(why)}"`;
          return `<div class="section"><div><b>Upgrade → ${upgradeName(
            c.type,
            o.to as any
          )}</b> <span class="hint">${
            o.duration
          }t</span></div><div>Cost: ${fmtCost(o.cost)}${
            yd ? " • " + yd : ""
          }</div><button class="btn primary" ${dis} data-u="${i}">Start (−1A)</button></div>`;
        })
        .join("")
    : '<div class="hint">No upgrades available.</div>';
  P.innerHTML = `<div class="card"><div class="title">${c.type.toUpperCase()} @ (${x},${y})</div><div class="section"><div><b>Yield</b> ${
    info["yield"]
  }</div><div><b>Status</b> ${info.status}</div></div>${farmCtrl}${rows}</div>`;
  P.querySelectorAll("[data-u]").forEach((b) => {
    (b as HTMLButtonElement).onclick = () => {
      const idxStr = (b as HTMLElement).getAttribute("data-u");
      if (idxStr == null) return;
      const uIndex = parseInt(idxStr, 10);
      const specList = coreRulesPlugin.getUpgradeSpecs(c.type);
      const upg = specList[uIndex];
      if (!upg) return;
      startUpgrade(x, y, c, upg);
      openPanel(x, y);
    };
  });
  if (c.type === T.FARM) {
    const add = P.querySelector("#wPlus") as HTMLButtonElement | null,
      rem = P.querySelector("#wMinus") as HTMLButtonElement | null;
    if (add) add.onclick = () => setFarmWorkers(x, y, +1);
    if (rem) rem.onclick = () => setFarmWorkers(x, y, -1);
  }
}

function startUpgrade(x: number, y: number, c: any, s: UpgradeSpec) {
  if (coreRulesPlugin.canUpgrade(x, y, s)) {
    coreRulesPlugin.startUpgrade(x, y, s);
    hud();
    draw();
  }
}

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

