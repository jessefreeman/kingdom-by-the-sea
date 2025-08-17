// Kingdom by the Sea — TypeScript global API (KBTS)
// Port of the JS game core, exposed on window for renderer/tests.

import type { Cell, State, UpgradeSpec } from "../types";
import { getCoastOverlaysAt } from "../autotile";

// ===== DOM helpers =====
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: any) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const rng32 = (initialSeed: number) => {
  let seed = initialSeed >>> 0; // Ensure it's a 32-bit unsigned integer
  return () => {
    // xorshift32 algorithm - simple and effective PRNG
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed = seed >>> 0; // Keep as 32-bit unsigned
    return seed / 4294967296; // Convert to [0, 1)
  };
};

// ===== Constants / Data =====
const T = {
  WATER: "water",
  GRASS: "grass",
  FOREST: "forest",
  HILL: "hill",
  MOUNTAIN: "mountain",
  HUT: "hut",
  HOUSE: "house",
  MANSION: "mansion",
  PALACE: "palace",
  CASTLE: "castle",
  FARM: "farm",
  MINE: "mine",
  BURNT: "burnt",
  RUBBLE: "rubble",
  DOCK: "dock",
  TOWN: "town",
} as const;
const HOUSELINE = [T.HUT, T.HOUSE, T.MANSION, T.PALACE, T.CASTLE];
const C: Record<string, string> = {
  [T.WATER]: "#0c3b66",
  coast: "#155d96",
  [T.GRASS]: "#2e7d32",
  [T.FOREST]: "#1f5f24",
  [T.HILL]: "#7c6f4a",
  [T.MOUNTAIN]: "#5f5750",
  [T.FARM]: "#c68f39",
  [T.MINE]: "#8a7f78",
  [T.HUT]: "#9b5d2e",
  [T.HOUSE]: "#b97a3f",
  [T.MANSION]: "#d29a5a",
  [T.PALACE]: "#e2b874",
  [T.CASTLE]: "#e5d09a",
  [T.BURNT]: "#3a2d2d",
  [T.RUBBLE]: "#4a4a4a",
  [T.DOCK]: "#2563eb",
  fog: "#0a0d1a",
};
const LABEL: Record<string, string> = {
  [T.GRASS]: "G",
  [T.FOREST]: "T",
  // Use a different letter for HILL to avoid confusion with MOUNTAIN in debug dumps
  [T.HILL]: "h",
  [T.MOUNTAIN]: "M",
  [T.HUT]: "H",
  [T.HOUSE]: "H",
  [T.MANSION]: "H",
  [T.PALACE]: "H",
  [T.CASTLE]: "H",
  [T.FARM]: "F",
  [T.MINE]: "M",
  [T.BURNT]: "B",
  [T.RUBBLE]: "R",
  [T.DOCK]: "D",
  [T.TOWN]: "T",
};
const BASE: Record<string, Partial<{ G: number; F: number; W: number }>> = {
  [T.FARM]: { F: 2 },
  [T.MINE]: { G: 1 },
  [T.HOUSE]: { G: 1 },
  [T.MANSION]: { G: 2 },
  [T.PALACE]: { G: 3 },
  [T.CASTLE]: { G: 4 },
  [T.DOCK]: { F: 1, G: 1 },
};
const DIRS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// ===== State =====
const state: State = {
  seed: 0,
  rng: null,
  size: {
    w: 10,
    h: 8,
    t:
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--tile"),
        10
      ) || 24,
  },
  map: [],
  year: 1,
  gold: 3,
  food: 3,
  wood: 2,
  people: 3,
  actions: 3,
  sel: null,
  fogEnabled: true,
};
const rand = () => (state.rng ? (state.rng as () => number)() : Math.random());
const idx = (x: number, y: number) => y * state.size.w + x;
const inBounds = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < state.size.w && y < state.size.h;
const each = (fn: (x: number, y: number, cell: Cell) => void) => {
  for (let y = 0; y < state.size.h; y++)
    for (let x = 0; x < state.size.w; x++)
      fn(x, y, state.map[idx(x, y)] as Cell);
};
const rt = (c: any) => (c ? (c.upg ? c.upg.to : c.type) : null);

// ===== Overlays =====
const ov = (
  html: string,
  hook?: (box: HTMLElement, wrap: HTMLElement) => void
) => {
  const w = document.createElement("div");
  w.className = "overlay";
  Object.assign(w.style, {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,.55)",
    zIndex: "1000",
  } as CSSStyleDeclaration);
  w.innerHTML = `<div class="card">${html}</div>`;
  document.body.appendChild(w);
  if (hook) hook(w.querySelector(".card") as HTMLElement, w);
  return w;
};

// ===== Helpers =====
const cell = (t: string): Cell => ({
  type: t as any,
  disc: false,
  upg: null,
  wrk: 0,
  fx: 0,
  h: 0,
});
function houseNearby(x: number, y: number) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const t = rt(state.map[idx(nx, ny)]);
      if (t && HOUSELINE.includes(t)) return true;
    }
  return false;
}
// ===== Debug Dump =====
function debugDump() {
  const W = state.size.w,
    H = state.size.h;
  // Build Markdown table with row/col headers; cell shows letter+height (e.g., G2, W0)
  const letterOf = (t: string | null): string => {
    if (!t) return "?";
    // Prefer LABEL single-letter, else first letter uppercase
    const lbl = LABEL[t];
    if (lbl && lbl.length === 1) return lbl;
    if (t === T.WATER) return "W";
    const first = lbl ? lbl[0] : t && t.length ? t[0] : "?";
    return String(first).toUpperCase();
  };
  const header = [" ", ...Array.from({ length: W }, (_, i) => String(i))].join(
    " | "
  );
  const sep = Array(W + 1)
    .fill("---")
    .join(" | ");
  const lines: string[] = [];
  lines.push(`| ${header} |`);
  lines.push(`| ${sep} |`);
  for (let y = 0; y < H; y++) {
    const cells: string[] = [];
    for (let x = 0; x < W; x++) {
      const c = state.map[idx(x, y)] as any;
      const t = rt(c);
      const h = c?.h | 0;
      cells.push(`${letterOf(t)}${h}`);
    }
    lines.push(`| ${y} | ${cells.join(" | ")} |`);
  }
  const out = [
    "KBTS DEBUG DUMP",
    `seed: ${state.seed}`,
    `size: ${W}x${H}`,
    lines.join("\n"),
  ].join("\n");
  console.log(out);
}

// Bind K to dump
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "k" || e.key === "K") {
    debugDump();
  }
});
function noHouseNearby(x: number, y: number) {
  return !houseNearby(x, y);
}

// ===== Spec / Explore =====
const SPEC: Record<string, UpgradeSpec[]> = {
  [T.GRASS]: [
    { to: T.FARM as any, cost: { W: 1 }, duration: 1, perTurn: { F: 1 } },
  ],
  [T.FARM]: [
    {
      to: T.HOUSE as any,
      cost: { G: 1, W: 1 },
      duration: 1,
      instant: { P: 1 },
      pre: noHouseNearby,
      req: "needs 1-tile spacing from other houses",
    },
  ],
  [T.FOREST]: [
    { to: T.GRASS as any, cost: {}, duration: 1, instant: { W: 2 } },
  ],
  [T.HILL]: [
    { to: T.MINE as any, cost: { G: 1 }, duration: 1, perTurn: { G: 1 } },
  ],
  [T.WATER]: [
    {
      to: T.DOCK as any,
      cost: { W: 1 },
      duration: 1,
      perTurn: { F: 1, G: 1 },
      pre: (x: number, y: number) => isCoast(x, y),
      req: "coast required",
    },
  ],
  [T.HUT]: [
    {
      to: T.HOUSE as any,
      cost: { G: 1, W: 1 },
      duration: 1,
      pre: noHouseNearby,
      req: "needs 1-tile spacing from other houses",
    },
  ],
  [T.HOUSE]: [
    { to: T.MANSION as any, cost: { G: 2 }, duration: 2, perTurn: { G: 1 } },
  ],
  [T.MANSION]: [
    { to: T.PALACE as any, cost: { G: 3 }, duration: 2, perTurn: { G: 2 } },
  ],
  [T.PALACE]: [
    { to: T.CASTLE as any, cost: { G: 4 }, duration: 3, perTurn: { G: 3 } },
  ],
  [T.BURNT]: [{ to: T.GRASS as any, cost: { W: 1 }, duration: 1 }],
  [T.RUBBLE]: [{ to: T.HUT as any, cost: { W: 1 }, duration: 1 }],
};
const EXPLORE = { RISK: 0.25, FOOD: 1 };

// ===== Canvas / Renderer hooks =====
const canvas = $("gameCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const resize = () => {
  canvas.width = state.size.w * state.size.t;
  canvas.height = state.size.h * state.size.t;
  try {
    const RN = (window as any).KBTS_Renderer;
    RN?.onResize?.();
  } catch {
    /* noop */
  }
};

// Store the original seed separately from the working seed
let originalSeed: number = 0;
let generationSeed: number = 0;

// RNG stream management for reproducibility
let worldGenRng: (() => number) | null = null;
let gameplayRng: (() => number) | null = null;
let eventRng: (() => number) | null = null;

// Initialize all RNG streams from the base seed
function initializeRngStreams(baseSeed: number) {
  originalSeed = baseSeed;
  generationSeed = baseSeed;
  
  // Create separate deterministic streams for different purposes
  worldGenRng = rng32(baseSeed);
  gameplayRng = rng32(baseSeed ^ 0x12345678); // Different salt for gameplay
  eventRng = rng32(baseSeed ^ 0x87654321);    // Different salt for events
  
  // Main state RNG follows gameplay stream
  state.rng = gameplayRng;
}

// ===== World Generation =====
// Create Mode: sculpt islands directly. Start with all water; click selects a tile; +/- grows/erodes land.
// Default OFF to restore RNG-based layered world generation.
let CREATE_MODE = false;
// Legacy simple toggle kept for reference; when CREATE_MODE is enabled, this is implied
let SIMPLE_ISLAND_ONLY = false;

// Generation parameters (fractions 0..1)
let GEN_PARAMS = {
  forest: 0.35,   // ~35% of land becomes forest
  mountains: 0.12, // ~12% of land becomes mountains (clustered)
  villages: 0.08, // ~8% of land becomes villages
};

async function generate(
  seed = Date.now(),
  size: "small" | "medium" | "large" = "medium"
) {
  const sizes: Record<string, { w: number; h: number }> = {
    small: { w: 8, h: 6 },
    medium: { w: 10, h: 8 },
    large: { w: 12, h: 8 },
  };
  
  // Initialize all RNG streams
  initializeRngStreams(seed);
  
  Object.assign(state.size, sizes[size]);
  Object.assign(state, {
    seed: generationSeed,
    rng: gameplayRng,
    year: 1,
    gold: 3,
    food: 3,
    wood: 2,
    people: 3,
    actions: 3,
    sel: null,
  });
  // 1) Base map: initialize water
  state.map = Array(state.size.w * state.size.h)
    .fill(0)
    .map(() => cell(T.WATER));
  const cx = (state.size.w - 1) / 2,
    cy = (state.size.h - 1) / 2,
    maxR = Math.hypot(cx, cy);

  if (CREATE_MODE) {
    // Reveal all for editing
    each((x, y, c: any) => { c.disc = true; c.h = 0; });
  } else {
    // Layer 1: island shape from ocean (radial falloff + noise)
    each((x, y, c: any) => {
      const radial = 0.6 - Math.hypot(x - cx, y - cy) / maxR;
      const noise = worldGenRng!() * 0.35 - 0.15;
      c.type = radial + noise > 0 ? T.GRASS : T.WATER;
    });

    // Enforce a water border so land never reaches the map edge (guarantees a coastline)
    const BORDER_MARGIN = 1; // tiles of water around the map
    if (BORDER_MARGIN > 0) {
      for (let y = 0; y < state.size.h; y++) {
        for (let x = 0; x < state.size.w; x++) {
          const distToEdge = Math.min(x, y, state.size.w - 1 - x, state.size.h - 1 - y);
          if (distToEdge < BORDER_MARGIN) {
            const cc = state.map[idx(x, y)] as any;
            cc.type = T.WATER;
            cc.h = 0;
          }
        }
      }
    }

    // Collect land tiles
    const land: Array<{x:number,y:number,i:number}> = [];
    each((x, y, c: any) => { if (rt(c) !== T.WATER) land.push({x,y,i:idx(x,y)}); });

    // Helper: interior score (fewer adjacent water tiles preferred)
    const coastiness = (x:number, y:number) => {
      let w = 0;
      for (const d of DIRS) {
        const nx=x+d[0], ny=y+d[1];
        if (!inBounds(nx,ny)) { w += 1; continue; }
        const n = state.map[idx(nx,ny)] as any;
        if (!n || rt(n) === T.WATER) w += 1;
      }
      return w; // 0 best (interior), 4 worst (isolated/coast)
    };

    // Layer 2: place starter hut near center on grass
    const grassTiles = land.filter(p => (state.map[p.i] as any).type === T.GRASS);
    const centerSorted = [...grassTiles].sort((a,b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const start = centerSorted[0] || { x: Math.floor(cx), y: Math.floor(cy), i: idx(Math.floor(cx), Math.floor(cy)) };
    (state.map[start.i] as any).type = T.HUT;

    // Layer 3a: mountains (clustered) based on density
    const targetM = Math.max(0, Math.floor(land.length * Math.max(0, Math.min(1, GEN_PARAMS.mountains))));
    const interiorSorted = [...land].sort((a,b) => coastiness(a.x,a.y) - coastiness(b.x,b.y));
    let placedM = 0;
    const markMountain = (x:number,y:number) => { const c = state.map[idx(x,y)] as any; if (c && rt(c) !== T.WATER && c.type !== T.HUT && c.type !== T.MOUNTAIN) { c.type = T.MOUNTAIN; placedM++; return true; } return false; };
    let cursor = 0;
    const tried = new Set<number>();
    while (placedM < targetM && cursor < interiorSorted.length * 3) {
      // Bias toward interior: pick among the best 60%
      const span = Math.max(1, Math.floor(interiorSorted.length * 0.6));
      const pick = interiorSorted[Math.floor(worldGenRng!() * span)]!;
      cursor++;
      if (tried.has(pick.i)) continue; tried.add(pick.i);
      if (!markMountain(pick.x, pick.y)) continue;
      // Small cluster growth
      const q: Array<[number,number]> = [[pick.x, pick.y]];
      let budget = 4; // cap cluster size
      while (q.length && placedM < targetM && budget-- > 0) {
        const [cx1, cy1] = q.shift()!;
        for (const d of DIRS) {
          if (worldGenRng!() < 0.35) {
            const nx = cx1 + d[0], ny = cy1 + d[1];
            if (!inBounds(nx, ny)) continue;
            const ok = markMountain(nx, ny);
            if (ok) q.push([nx, ny]);
            if (placedM >= targetM) break;
          }
        }
      }
    }

    // Layer 3b: forests based on density (don’t overwrite hut or mountains)
    const targetF = Math.max(0, Math.floor(land.length * Math.max(0, Math.min(1, GEN_PARAMS.forest))));
    const candidatesF = land
      .filter(p => { const c = state.map[p.i] as any; return c.type === T.GRASS; })
      .sort(() => (worldGenRng!() < 0.5 ? -1 : 1));
    for (let i = 0; i < candidatesF.length && i < targetF; i++) {
      const pick = candidatesF[i];
      if (!pick) break;
      (state.map[pick.i] as any).type = T.FOREST;
    }

    // Layer 3c: villages (towns) based on density; place on grass or forest, avoid adjacency with other towns
    const targetV = Math.max(0, Math.floor(land.length * Math.max(0, Math.min(1, GEN_PARAMS.villages))));
    let placedV = 0;
    const canPlaceTown = (x:number,y:number) => {
      for (const d of DIRS) {
        const nx=x+d[0], ny=y+d[1];
        if (!inBounds(nx,ny)) continue;
        const n = state.map[idx(nx,ny)] as any;
        if (n && n.type === T.TOWN) return false;
      }
      return true;
    };
    const candV = land.filter(p => { const c = state.map[p.i] as any; return (c.type === T.GRASS || c.type === T.FOREST) && c.type !== T.HUT; })
                      .sort(() => (worldGenRng!() < 0.5 ? -1 : 1));
    for (const p of candV) {
      if (placedV >= targetV) break;
      if (!canPlaceTown(p.x, p.y)) continue;
      const c = state.map[p.i] as any;
      if (c.type === T.GRASS || c.type === T.FOREST) {
        c.type = T.TOWN;
        placedV++;
      }
    }

    // Ensure starter resources adjacent to hut and reveal vicinity
    ensureStartResources(start.x, start.y);
    reveal(start.x, start.y, 1);
  }
  // Compute initial heights based on terrain
  computeHeightMap();
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
  $("seedOut").textContent = String(originalSeed);
  $("mapOut").textContent = `${state.size.w}×${state.size.h}`;
}
function reveal(cx: number, cy: number, r: number) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      const c = state.map[idx(x, y)] as any;
      if (c) c.disc = true;
    }
}
function ensureStartResources(sx: number, sy: number) {
  const nbs: Array<{ i: number; cell: any; x: number; y: number }> = [];
  for (const d of DIRS) {
    const nx = sx + d[0],
      ny = sy + d[1];
    if (!inBounds(nx, ny)) continue;
    nbs.push({ i: idx(nx, ny), cell: state.map[idx(nx, ny)], x: nx, y: ny });
  }
  if (!nbs.length) return;
  const pref = (n: any) =>
    n.cell.type === T.WATER ? 2 : n.cell.type === T.MOUNTAIN ? 3 : 1;
  let forest = nbs.find((n) => (n.cell as any).type === T.FOREST);
  if (!forest) {
    forest = [...nbs].sort((a, b) => pref(a) - pref(b))[0]!;
    (state.map[forest.i] as any).type = T.FOREST;
  }
  let grass = nbs.find(
    (n) => (n.cell as any).type === T.GRASS && n.i !== (forest as any).i
  );
  if (!grass) {
    const cand = nbs.filter((n) => n.i !== (forest as any).i);
    const pick = (cand.length ? cand : [nbs[0]]).sort(
      (a, b) => pref(a) - pref(b)
    )[0]!;
    (state.map[pick.i] as any).type = T.GRASS;
  }
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
      tileAtlasModule = await import("../tileAtlas");
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
      // Scale the 16x16 tile to the current tile size
      ctx.save();
      ctx.imageSmoothingEnabled = false; // Pixel-perfect scaling
      ctx.drawImage(tileCanvas, px, py, ts, ts);
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
  if (CREATE_MODE) { state.sel = idx(x, y); draw(); return; }
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
    import("../tileAtlasPreloader").then(module => {
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
    import("../tileAtlasPreloader").then(module => {
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

// Create Mode: grow/erode operations
function growIslandAt(cx: number, cy: number) {
  if (!inBounds(cx, cy)) return;
  // If center is water, seed it; else grow by 4-neighborhood frontier
  const cur = state.map[idx(cx, cy)] as any;
  if (rt(cur) === T.WATER) {
    cur.type = T.GRASS;
    cur.disc = true;
    draw();
    return;
  }
  // Collect frontier: water tiles adjacent to any land
  const frontier: Array<[number, number]> = [];
  each((x, y, c: any) => {
    if (rt(c) !== T.WATER) return;
    for (const d of DIRS) {
      const nx = x + d[0], ny = y + d[1];
      if (!inBounds(nx, ny)) continue;
      if (rt(state.map[idx(nx, ny)] as any) !== T.WATER) { frontier.push([x, y]); break; }
    }
  });
  // If no frontier, expand a small plus shape around center
  const candidates: Array<[number, number]> = [
    [cx + 1, cy],
    [cx - 1, cy],
    [cx, cy + 1],
    [cx, cy - 1],
  ];
  const toFill: Array<[number, number]> = frontier.length
    ? frontier
    : candidates.filter(([x, y]) => inBounds(x, y));
  for (const [x, y] of toFill) {
    const c = state.map[idx(x,y)] as any; if (!c) continue; c.type = T.GRASS; c.disc = true;
  }
  draw();
}
function erodeIslandAt(cx: number, cy: number) {
  if (!inBounds(cx, cy)) return;
  // Remove coastal ring: land tiles adjacent to water
  const remove: Array<[number, number]> = [];
  each((x, y, c: any) => {
    if (rt(c) === T.WATER) return;
    for (const d of DIRS) {
      const nx = x + d[0], ny = y + d[1];
      if (!inBounds(nx, ny)) continue;
      if (rt(state.map[idx(nx, ny)] as any) === T.WATER) { remove.push([x, y]); break; }
    }
  });
  if (remove.length === 0) return; // nothing to erode
  for (const [x,y] of remove) { (state.map[idx(x,y)] as any).type = T.WATER; }
  draw();
}

// ===== Rules / UI =====
const afford = (c: any) =>
  (!("G" in c) || state.gold >= c.G) &&
  (!("W" in c) || state.wood >= c.W) &&
  (!("P" in c) || state.people >= c.P) &&
  (!("F" in c) || state.food >= c.F);
const pay = (c: any) => {
  if (c.G) state.gold -= c.G;
  if (c.W) state.wood -= c.W;
  if (c.F) state.food -= c.F;
};
const whyNo = (spec: any, cell: any) => {
  const r: string[] = [];
  if (cell.upg) r.push("already upgrading");
  if (state.actions <= 0) r.push("no actions left");
  const cc = spec.cost || {};
  if (cc.G && state.gold < cc.G) r.push("need G:" + cc.G);
  if (cc.W && state.wood < cc.W) r.push("need W:" + cc.W);
  if (cc.F && state.food < cc.F) r.push("need F:" + cc.F);
  if (cc.P && state.people < cc.P) r.push("need P:" + cc.P);
  return r.join(", ");
};
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

const isAdj = (x: number, y: number) => {
  for (const d of DIRS) {
    const nx = x + d[0],
      ny = y + d[1];
    if (!inBounds(nx, ny)) continue;
    const nc = state.map[idx(nx, ny)] as any;
    if (nc && nc.disc) return true;
  }
  return false;
};
const canExplore = (x: number, y: number) => {
  const c = state.map[idx(x, y)] as any;
  return (
    !!c &&
    !c.disc &&
    isAdj(x, y) &&
    state.actions > 0 &&
    state.people > 0 &&
    state.food >= EXPLORE.FOOD
  );
};
const whyNoExplore = (x: number, y: number) => {
  const r: string[] = [];
  const c = state.map[idx(x, y)] as any;
  if (!c) r.push("invalid");
  else if (c.disc) r.push("already visible");
  if (!isAdj(x, y)) r.push("adjacent required");
  if (state.actions <= 0) r.push("no actions");
  if (state.people <= 0) r.push("no people");
  if (state.food < EXPLORE.FOOD) r.push("need F:1");
  return r.join(", ");
};
function explore(x: number, y: number) {
  if (!canExplore(x, y)) return;
  state.actions--;
  state.food = Math.max(0, state.food - EXPLORE.FOOD);
  const risk = state.year <= 5 ? 0.15 : EXPLORE.RISK;
  if (rand() < risk && state.people > 0)
    state.people--;
  reveal(x, y, 1);
  hud();
  draw();
}

const hasAdjType = (x: number, y: number, t: string) => {
  for (const d of DIRS) {
    const nx = x + d[0],
      ny = y + d[1];
    if (!inBounds(nx, ny)) continue;
    const nc = state.map[idx(nx, ny)] as any;
    if (nc && rt(nc) === t) return true;
  }
  return false;
};
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
const countType = (t: string) => {
  let n = 0;
  each((x, y, c: any) => {
    if (c && rt(c) === t) n++;
  });
  return n;
};
const uniqueAvailable = (to: string) =>
  !(to === T.PALACE && countType(T.PALACE) >= 1) &&
  !(to === T.CASTLE && countType(T.CASTLE) >= 1);
function bufferOK(x: number, y: number, from: string, to: string) {
  if (!houseNearby(x, y)) return true;
  if (to === T.FARM) return true;
  if (from === T.FOREST && to === T.GRASS) return true;
  return false;
}

function applyAdjacencyBonuses(d: any) {
  each((x, y, c: any) => {
    if (
      [T.HOUSE, T.MANSION, T.PALACE, T.CASTLE].includes(c.type) &&
      hasAdjType(x, y, T.FARM)
    )
      d.G += 1;
    if (c.type === T.DOCK) {
      if (hasAdjType(x, y, T.FARM)) d.F += 1;
      if (
        [T.HOUSE, T.MANSION, T.PALACE, T.CASTLE].some((t) =>
          hasAdjType(x, y, t)
        )
      )
        d.G += 1;
    }
  });
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
  if (CREATE_MODE) { $("panel").innerHTML = ""; return; }
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
    opts = SPEC[c.type] || [];
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
      const specList = SPEC[c.type] || [];
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
  if (
    !s ||
    c.upg ||
    !afford(s.cost) ||
    state.actions <= 0 ||
    !uniqueAvailable(s.to as any) ||
    (s.pre && !s.pre(x, y)) ||
    !bufferOK(x, y, c.type, s.to as any)
  )
    return;
  pay(s.cost);
  state.actions--;
  const total = s.duration || 1;
  c.upg = { to: s.to as any, left: total, spec: s, total, prog: 0 } as any;
  if (total > 1) {
    c.upg.left--;
    c.upg.prog = 1;
  }
  reveal(x, y, 1);
  hud();
  draw();
}

// ===== Turn / Events =====
function endTurn() {
  const d: any = { G: 0, F: 0, W: 0, P: 0, events: [] as string[] };
  each((x, y, c: any) => {
    if (c.type === T.FARM) {
      if ((c.wrk | 0) > 0) d.F += 2 + ((c.fx | 0) === 2 ? 1 : 0);
    } else {
      const yld = BASE[c.type];
      if (yld) for (const k in yld) (d as any)[k] += (yld as any)[k];
    }
  });
  applyAdjacencyBonuses(d);
  each((x, y, c: any) => {
    if (c && c.upg) {
      if (--c.upg.left <= 0) {
        const to = c.upg.to;
        const spec = c.upg.spec;
        c.type = to;
        if (spec && spec.instant) {
          for (const k in spec.instant) {
            const v = (spec.instant as any)[k];
            if (k === "P") {
              d.P += v;
            } else {
              d[k] = (d[k] | 0) + v;
            }
          }
        }
        c.upg = null;
        reveal(x, y, 1);
        d.events.push(
          "Completed " + String(to).toUpperCase() + " at (" + x + "," + y + ")"
        );
      } else if (c.upg.total > 1) {
        c.upg.prog = c.upg.total - c.upg.left;
      }
    }
  });
  state.gold += d.G;
  state.food += d.F;
  state.wood += d.W;
  const need = state.people;
  const fed = Math.min(state.food, need);
  state.food -= fed;
  if (fed === need)
    d.events.push("All " + need + " people fed (−" + need + " F).");
  else {
    const deficit = need - fed;
    d.events.push(
      "Shortage: needed " +
        need +
        " F, had " +
        fed +
        " F (" +
        deficit +
        " unfed)."
    );
    if (state.people > 0) {
      state.people--;
      d.P--;
      d.events.push("Starvation: −1 Person due to shortage.");
    }
    state.food = 0;
  }
  const growth = Math.floor(state.food / 10);
  if (growth > 0) {
    state.people += growth;
    d.P += growth;
    state.food -= growth * 10;
    d.events.push(
      "Population growth: +" + growth + " (used " + growth * 10 + " F)."
    );
  } else
    d.events.push("Food stored: " + state.food + "/10 toward next person.");
  if (d.P > 0) {
    state.people += d.P;
  }
  state.year++;
  state.actions = Math.max(0, state.people - farmWorkers());
  if (!(state as any).noEvents) randomEvent(d);
  state.actions = Math.max(0, state.people - farmWorkers());
  updateFarmSynergy(d);
  hud();
  draw();
  summary(d);
  winLose();
  return d;
}
function randomEvent(d: any) {
  const EV = [
    { n: "Fire", w: 25 },
    { n: "Pirates", w: 20 },
    { n: "Plague", w: 15 },
    { n: "Storm", w: 25 },
    { n: "Treasure", w: 8 },
  ];
  const tot = EV.reduce((s, e) => s + e.w, 0);
  let r = eventRng!() * tot,
    pick: string = EV[0]!.n;
  for (const e of EV) {
    r -= e.w;
    if (r < 0) {
      pick = e.n;
      break;
    }
  }
  if (pick === "Fire") {
    const v: any[] = [];
    each((x, y, c: any) => {
      if (c && c.disc && (c.type === T.FOREST || c.type === T.FARM))
        v.push({ x, y, type: c.type });
    });
    if (v.length) {
      const t = v[Math.floor(eventRng!() * v.length)];
      const ci = state.map[idx(t.x, t.y)] as any;
      let deathNote = "";
      if (ci.type === T.FARM) {
        if ((ci.wrk | 0) > 0 && state.people > 0) {
          state.people--;
          d.P--;
          deathNote = " — worker died (−1P)";
        }
        ci.wrk = 0;
        ci.fx = 0;
      }
      ci.type = T.BURNT;
      d.events.push(
        "Fire destroyed a " +
          t.type.toUpperCase() +
          " at (" +
          t.x +
          "," +
          t.y +
          ") → BURNT" +
          deathNote
      );
    }
  } else if (pick === "Pirates") {
    if (state.gold > 0) {
      state.gold--;
      d.G--;
      d.events.push("Pirates stole 1 gold");
    }
  } else if (pick === "Plague") {
    if (state.people > 1) {
      state.people--;
      d.P--;
      d.events.push("Plague took 1 person");
    }
  } else if (pick === "Storm") {
    const v: any[] = [];
    each((x, y, c: any) => {
      if (
        c &&
        c.disc &&
        [T.HOUSE, T.MANSION, T.PALACE, T.CASTLE, T.MINE, T.FARM].includes(
          c.type
        )
      )
        v.push({ x, y, type: c.type });
    });
    if (v.length) {
      const t = v[Math.floor(eventRng!() * v.length)];
      const ci = state.map[idx(t.x, t.y)] as any;
      let notes: string[] = [];
      if (HOUSELINE.includes(ci.type) && state.people > 0) {
        state.people--;
        d.P--;
        notes.push("resident died −1P");
      }
      if (ci.type === T.FARM && (ci.wrk | 0) > 0) {
        if (state.people > 0) {
          state.people--;
          d.P--;
        }
        ci.wrk = 0;
        ci.fx = 0;
        notes.push("worker died −1P");
      }
      ci.type = T.RUBBLE;
      d.events.push(
        "Storm reduced " +
          t.type.toUpperCase() +
          " at (" +
          t.x +
          "," +
          t.y +
          ") → RUBBLE" +
          (notes.length ? " — " + notes.join("; ") : "")
      );
    }
  } else {
    state.gold++;
    d.G++;
    d.events.push("Found hidden treasure (+1 gold)");
  }
}

// ===== HUD / Summary =====
function summary(d: any) {
  const deltas = "Δ G:" + d.G + " F:" + d.F + " W:" + d.W + " P:" + d.P;
  const evHtml =
    d.events && d.events.length
      ? '<div class="section">' +
        d.events
          .filter(Boolean)
          .map((s: string) => "<div>• " + esc(s) + "</div>")
          .join("") +
        "</div>"
      : '<div class="section hint">No notable events.</div>';
  ov(
    '<div class="title">End of Year ' +
      (state.year - 1) +
      "</div>" +
      '<div class="section">' +
      deltas +
      "</div>" +
      evHtml +
      '<button class="btn primary" id="ok">Continue</button>',
    (box, wrap) => {
      (box.querySelector("#ok") as HTMLButtonElement).onclick = () =>
        wrap.remove();
    }
  );
}
function winLose() {
  let win = false;
  each((x, y, c: any) => {
    if (c && c.type === T.CASTLE) win = true;
  });
  if (state.people <= 0) gameOver(false, "Your people are gone.");
  else if (win) gameOver(true, "You raised a CASTLE!");
}
function gameOver(win: boolean, msg: string) {
  ov(
    '<div class="title">' +
      (win ? "Victory" : "Game Over") +
      '</div><div class="section">' +
      esc(msg) +
      '</div><div class="section">Years:' +
      state.year +
      " • People:" +
      state.people +
      " • Gold:" +
      state.gold +
      '</div><button class="btn primary" id="again">New Run</button>',
    (box, wrap) => {
      (box.querySelector("#again") as HTMLButtonElement).onclick = () => {
        wrap.remove();
        showStart();
      };
    }
  );
}
function hud() {
  $("y").textContent = String(state.year);
  $("g").textContent = String(state.gold);
  $("f").textContent = String(state.food);
  $("w").textContent = String(state.wood);
  $("p").textContent = String(state.people);
  $("a").textContent = String(state.actions);
}

// ===== Save / Start =====
const save = () => localStorage.setItem("kbts-save", JSON.stringify(state));
const load = () => {
  const raw = localStorage.getItem("kbts-save");
  if (!raw) return;
  Object.assign(state, JSON.parse(raw));
  state.rng = rng32(state.seed);
  resize();
  hud();
  draw();
  $("seedOut").textContent = String(state.seed);
  $("mapOut").textContent = `${state.size.w}×${state.size.h}`;
};
function clearOverlays() {
  document.querySelectorAll(".overlay").forEach((el) => el.remove());
  $("panel").innerHTML = "";
}
function showStart() {
  clearOverlays();
  ov(
    '<div class="title">New Game</div>' +
      '<div class="section"><label>Map Size' +
      '<select id="sz">' +
      '<option value="small">Small (8×6)</option>' +
      '<option value="medium" selected>Medium (10×8)</option>' +
      '<option value="large">Large (12×8)</option>' +
      "</select>" +
      "</label></div>" +
      '<div class="section"><label>Seed (optional)' +
      '<input id="sd" type="number" placeholder="random" style="width:100%" />' +
      "</label></div>" +
    '<div class="section">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><label>Forests</label><b id="forestOut">' +
    Math.round(GEN_PARAMS.forest*100) + '%</b></div>' +
    '<input id="forest" type="range" min="0" max="100" step="5" value="' + Math.round(GEN_PARAMS.forest*100) + '" />' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0 6px"><label>Mountains</label><b id="mountOut">' +
    Math.round(GEN_PARAMS.mountains*100) + '%</b></div>' +
    '<input id="mount" type="range" min="0" max="50" step="5" value="' + Math.round(GEN_PARAMS.mountains*100) + '" />' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0 6px"><label>Villages</label><b id="villOut">' +
    Math.round(GEN_PARAMS.villages*100) + '%</b></div>' +
    '<input id="vill" type="range" min="0" max="30" step="5" value="' + Math.round(GEN_PARAMS.villages*100) + '" />' +
    '<div class="hint" style="margin-top:6px">Forests ~1 level above grass; Mountains ~2+. Ranges raise nearby land. Values apply per new map.</div>' +
    "</div>" +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn" id="cancelNew">Cancel</button>' +
      '<button class="btn primary" id="startNew">Start</button>' +
      "</div>",
    (box, wrap) => {
      (box.querySelector("#cancelNew") as HTMLButtonElement).onclick = () =>
        wrap.remove();
      (box.querySelector("#startNew") as HTMLButtonElement).onclick =
        async () => {
          const size = (box.querySelector("#sz") as HTMLSelectElement)
            .value as any;
          const sd = parseInt(
            (box.querySelector("#sd") as HTMLInputElement).value,
            10
          );
      // Read sliders and update defaults for this run
      const fPct = parseInt((box.querySelector('#forest') as HTMLInputElement).value, 10) || 0;
      const mPct = parseInt((box.querySelector('#mount') as HTMLInputElement).value, 10) || 0;
      const vPct = parseInt((box.querySelector('#vill') as HTMLInputElement).value, 10) || 0;
      GEN_PARAMS = { forest: Math.max(0, Math.min(1, fPct/100)), mountains: Math.max(0, Math.min(1, mPct/100)), villages: Math.max(0, Math.min(1, vPct/100)) };
          await generate(Number.isFinite(sd) ? sd : Date.now(), size);
          wrap.remove();
        };
    // Live update labels
    const forest = box.querySelector('#forest') as HTMLInputElement;
    const mount = box.querySelector('#mount') as HTMLInputElement;
    const vill = box.querySelector('#vill') as HTMLInputElement;
    const forestOut = box.querySelector('#forestOut') as HTMLElement;
    const mountOut = box.querySelector('#mountOut') as HTMLElement;
    const villOut = box.querySelector('#villOut') as HTMLElement;
    forest?.addEventListener('input', () => forestOut.textContent = forest.value + '%');
    mount?.addEventListener('input', () => mountOut.textContent = mount.value + '%');
    vill?.addEventListener('input', () => villOut.textContent = vill.value + '%');
    }
  );
}

// Legacy global for compatibility with existing tests calling `showStart()` directly
(window as any).showStart = showStart;

// Boot bindings
(window as any).addEventListener("resize", () => {
  try {
    const RN = (window as any).KBTS_Renderer;
    RN?.onResize?.();
  } catch {}
});
($("end") as HTMLButtonElement).onclick = () => endTurn();
($("end") as HTMLButtonElement).disabled = false;
$("save")?.addEventListener("click", () => save());
$("load")?.addEventListener("click", () => load());
$("reset")?.addEventListener("click", () => showStart());
showStart();

// Expose KBTS for renderer/tests
(window as any).KBTS = {
  $,
  rng32,
  state,
  T,
  C,
  LABEL,
  SPEC,
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
  applyAdjacencyBonuses,
  uniqueAvailable,
  noHouseNearby,
  houseNearby,
  setFarmWorkers,
  farmWorkers,
  updateFarmSynergy,
  endTurn,
  randomEvent,
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
  originalSeed: () => originalSeed,
  worldGenRng: () => worldGenRng,
  gameplayRng: () => gameplayRng,
  eventRng: () => eventRng,
  setRenderer: (name: string) => {
    const RN = (window as any).KBTS_Renderer;
    RN?.set?.(name);
  },
  getRenderer: () => {
    const RN = (window as any).KBTS_Renderer;
    return RN?.get?.() || "debug";
  },
  // Toggle simple island generation for coast autotiling validation
  setSimpleIslandOnly: (v: boolean) => { SIMPLE_ISLAND_ONLY = !!v; },
  getSimpleIslandOnly: () => SIMPLE_ISLAND_ONLY,
  setCreateMode: (v: boolean) => { CREATE_MODE = !!v; },
  getCreateMode: () => CREATE_MODE,
};

// ===== Height System =====
// Rules:
// - Water is height 0 flat
// - Mountains are level 2, immediate neighbors level 1 (if land)
// - In a connected mountain range, the center grows: assign higher based on surrounding mountains
// - Heights descend by 1 per ring back to water
function computeHeightMap() {
  const W = state.size.w,
    H = state.size.h;
  const I = (x: number, y: number) => y * W + x;
  const DIRS4: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const DIRS8: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  // Tunables for organic verticality
  const PEAK_BASE = 5; // base seed for mountain tiles
  const DEPTH_BOOST = 2; // extra per step toward interior of a range
  const ADJ_BOOST = 1; // bonus per adjacent mountain (8-dir)
  const FALLOFF = 1; // height loss per step when propagating out
  const COAST_MAX = 3; // tiles from coast where we apply lowering
  const COAST_WEIGHT = 1; // how much to lower near coast per missing distance
  const MIN_MOUNTAIN = 4; // mountains are at least this high
  const MAX_H = 30; // clamp to avoid extreme values

  // 1) Baseline by tile type
  const base = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = state.map[I(x, y)] as any;
      const t = rt(c);
      let h0 = 0;
      if (t === T.WATER) h0 = 0;
      else if (t === T.GRASS) h0 = 1;
      else if (t === T.FOREST) h0 = 2;
      else if (t === T.HILL) h0 = 3;
      else if (t === T.MOUNTAIN) h0 = 3; // seed will raise higher
      else h0 = 1; // buildings and others sit on land
      base[I(x, y)] = h0;
    }

  // 2) Mountain range interior depth (8-dir) for range-peaks higher than edges
  const mDepth = new Array(W * H).fill(-1);
  const seedQ: Array<[number, number]> = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      const c = state.map[i] as any;
      if (!c || rt(c) !== T.MOUNTAIN) continue;
      let boundary = false;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx,
          ny = y + dy;
        if (!inBounds(nx, ny)) {
          boundary = true;
          break;
        }
        const nc = state.map[I(nx, ny)] as any;
        if (!nc || rt(nc) !== T.MOUNTAIN) {
          boundary = true;
          break;
        }
      }
      if (boundary) {
        mDepth[i] = 0;
        seedQ.push([x, y]);
      }
    }
  // BFS inward to compute depth
  while (seedQ.length) {
    const [cx, cy] = seedQ.shift()!;
    const ci = I(cx, cy);
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const ni = I(nx, ny);
      const nc = state.map[ni] as any;
      if (!nc || rt(nc) !== T.MOUNTAIN) continue;
      if (mDepth[ni] === -1) {
        mDepth[ni] = (mDepth[ci] | 0) + 1;
        seedQ.push([nx, ny]);
      }
    }
  }

  // 3) Seed mountain potentials and propagate outward with falloff across land (8-dir)
  const potential = new Array(W * H).fill(0);
  const q: Array<[number, number]> = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      const c = state.map[i] as any;
      if (!c || rt(c) !== T.MOUNTAIN) continue;
      // Count adjacent mountains to boost ridges/lines
      let adjM = 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx,
          ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const nc = state.map[I(nx, ny)] as any;
        if (nc && rt(nc) === T.MOUNTAIN) adjM++;
      }
      const depth = Math.max(0, mDepth[i]);
      const seedVal = Math.max(
        MIN_MOUNTAIN,
        PEAK_BASE + depth * DEPTH_BOOST + adjM * ADJ_BOOST
      );
      potential[i] = Math.max(potential[i], seedVal | 0);
      q.push([x, y]);
    }
  // Multi-source BFS propagation (skip water)
  while (q.length) {
    const [cx, cy] = q.shift()!;
    const ci = I(cx, cy);
    const cur = potential[ci] | 0;
    if (cur <= 0) continue;
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const ni = I(nx, ny);
      const nc = state.map[ni] as any;
      if (!nc || rt(nc) === T.WATER) continue; // don't raise water
      const cand = cur - FALLOFF;
      if (cand > (potential[ni] | 0)) {
        potential[ni] = cand;
        q.push([nx, ny]);
      }
    }
  }

  // 4) Distance to water (4-dir) to lower land near coasts for natural shorelines
  const dist = new Array(W * H).fill(Number.POSITIVE_INFINITY);
  const dq: Array<[number, number]> = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      const c = state.map[i] as any;
      if (c && rt(c) === T.WATER) {
        dist[i] = 0;
        dq.push([x, y]);
      }
    }
  while (dq.length) {
    const [cx, cy] = dq.shift()!;
    const ci = I(cx, cy);
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx,
        ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const ni = I(nx, ny);
      const nd = (dist[ci] | 0) + 1;
      if (nd < (dist[ni] as number)) {
        dist[ni] = nd;
        dq.push([nx, ny]);
      }
    }
  }

  // 5) Combine base + propagated potential - coastal penalty, then enforce dominance
  const heights = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      const c = state.map[i] as any;
      if (!c) continue;
      const t = rt(c);
      if (t === T.WATER) {
        heights[i] = 0;
        continue;
      }
      const dw = Math.min(COAST_MAX, dist[i] as number);
      const coastPenalty =
        Math.max(0, COAST_MAX - (Number.isFinite(dw) ? dw : COAST_MAX)) *
        COAST_WEIGHT;
      const combined = Math.max(base[i] | 0, (potential[i] | 0) - coastPenalty);
      heights[i] = Math.max(1, Math.min(MAX_H, Math.floor(combined)));
    }

  // Enforce mountain tiles stand above any non-mountain neighbors
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      const c = state.map[i] as any;
      if (!c || rt(c) !== T.MOUNTAIN) continue;
      let maxN = -Infinity;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx,
          ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = I(nx, ny);
        const nc = state.map[ni] as any;
        if (!nc) continue;
        if (rt(nc) === T.MOUNTAIN) continue;
        maxN = Math.max(maxN, heights[ni] | 0);
      }
      const req = Math.max(
        MIN_MOUNTAIN,
        maxN > -Infinity ? (maxN | 0) + 1 : MIN_MOUNTAIN
      );
      if ((heights[i] | 0) < req) heights[i] = req;
    }

  // 6) Assign back to cells
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      const c = state.map[i] as any;
      if (!c) continue;
      c.h = rt(c) === T.WATER ? 0 : Math.max(1, heights[i] | 0);
    }
}

function adjustHeightByIndex(i: number, delta: number, propagate: boolean) {
  if (i < 0 || i >= state.map.length) return;
  const x = i % state.size.w,
    y = Math.floor(i / state.size.w);
  adjustHeightAt(x, y, delta, propagate);
}

// Create a deterministic sub-RNG for specific operations
function createSubRng(baseSeed: number, operation: string, x?: number, y?: number): () => number {
  // Create a unique seed for this specific operation and location
  let subSeed = baseSeed;
  for (let i = 0; i < operation.length; i++) {
    subSeed = (subSeed * 31 + operation.charCodeAt(i)) >>> 0;
  }
  if (x !== undefined) subSeed = (subSeed * 73856093 + x) >>> 0;
  if (y !== undefined) subSeed = (subSeed * 19349663 + y) >>> 0;
  return rng32(subSeed);
}

// Updated function that doesn't mutate global seed
function updateSeedForTerrain(
  reason: "land-created" | "land-removed",
  x: number,
  y: number
) {
  // Create a sub-RNG specifically for terrain changes
  // This maintains determinism without affecting the main RNG stream
  const terrainRng = createSubRng(generationSeed, reason, x, y);
  
  // Update the display seed for UI purposes, but keep the RNG stream intact
  const displaySeed = (state.seed * 1664525 + 1013904223) >>> 0;
  const so = document.getElementById("seedOut");
  if (so) so.textContent = String(displaySeed);
}

// Compute a hash of the current map state for display purposes only
// This does NOT affect the RNG - it's just for UI/debugging
function computeMapStateHash() {
  // FNV-1a 32-bit style mixing over width, height, and full per-tile state
  let h = 0x811c9dc5 >>> 0; // 2166136261
  const mix = (v: number) => {
    h ^= v >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0; // 16777619
  };
  mix(state.size.w | 0);
  mix(state.size.h | 0);
  for (let y = 0; y < state.size.h; y++) {
    for (let x = 0; x < state.size.w; x++) {
      const c = state.map[idx(x, y)] as any;
      // Base tile code: map string types to small integers
      const t = rt(c);
      let code = 0;
      switch (t) {
        case T.WATER:
          code = 0;
          break;
        case T.GRASS:
          code = 1;
          break;
        case T.FOREST:
          code = 2;
          break;
        case T.HILL:
          code = 3;
          break;
        case T.MOUNTAIN:
          code = 4;
          break;
        case T.FARM:
          code = 5;
          break;
        case T.MINE:
          code = 6;
          break;
        case T.HUT:
          code = 7;
          break;
        case T.HOUSE:
          code = 8;
          break;
        case T.MANSION:
          code = 9;
          break;
        case T.PALACE:
          code = 10;
          break;
        case T.CASTLE:
          code = 11;
          break;
        case T.BURNT:
          code = 12;
          break;
        case T.RUBBLE:
          code = 13;
          break;
        case T.DOCK:
          code = 14;
          break;
        case T.TOWN:
          code = 15;
          break;
        default:
          code = 31;
          break;
      }
      mix(code);
      // Include height (clamped small int)
      mix((c.h | 0) & 0xff);
      // Include discovery flag
      mix(c.disc ? 1 : 0);
      // Include farm synergy/workers if present
      mix((c.wrk | 0) & 0xff);
      mix((c.fx | 0) & 0xff);
      // Include upgrade-in-progress details if any
      if (c.upg) {
        // encode target tile type of upgrade
        const to = c.upg.to;
        let toCode = 0;
        switch (to) {
          case T.WATER:
            toCode = 0;
            break;
          case T.GRASS:
            toCode = 1;
            break;
          case T.FOREST:
            toCode = 2;
            break;
          case T.HILL:
            toCode = 3;
            break;
          case T.MOUNTAIN:
            toCode = 4;
            break;
          case T.FARM:
            toCode = 5;
            break;
          case T.MINE:
            toCode = 6;
            break;
          case T.HUT:
            toCode = 7;
            break;
          case T.HOUSE:
            toCode = 8;
            break;
          case T.MANSION:
            toCode = 9;
            break;
          case T.PALACE:
            toCode = 10;
            break;
          case T.CASTLE:
            toCode = 11;
            break;
          case T.BURNT:
            toCode = 12;
            break;
          case T.RUBBLE:
            toCode = 13;
            break;
          case T.DOCK:
            toCode = 14;
            break;
          case T.TOWN:
            toCode = 15;
            break;
          default:
            toCode = 31;
            break;
        }
        mix(0x9 as number);
        mix(toCode);
        mix((c.upg.left | 0) & 0xff);
        mix((c.upg.total | 0) & 0xff);
        mix((c.upg.prog | 0) & 0xff);
      } else {
        mix(0x0);
      }
    }
  }
  // Final avalanche to improve bit diffusion
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// Update the displayed seed for UI purposes without affecting RNG
function updateSeedDisplay() {
  const mapHash = computeMapStateHash();
  const so = document.getElementById("seedOut");
  if (so) so.textContent = `${originalSeed} (state: ${mapHash.toString(16)})`;
}

// Apply a height value and convert between water and land at thresholds
function applyHeightAndMaybeConvert(x: number, y: number, newH: number) {
  const i = idx(x, y);
  const c = state.map[i] as any;
  if (!c) return;
  const t = rt(c);
  if (t === T.WATER) {
    if (newH >= 1) {
      // Water becomes land (grass) at height >= 1
      c.type = T.GRASS;
      c.upg = null;
      c.h = Math.max(1, newH | 0);
    } else {
      c.h = 0;
    }
  } else {
    if (newH <= 0) {
      // Land removed becomes water at height 0
      c.type = T.WATER;
      c.upg = null;
      c.h = 0;
    } else {
      // Land remains, enforce baseline of 1
      c.h = Math.max(1, newH | 0);
    }
  }
}

function adjustHeightAt(
  x: number,
  y: number,
  delta: number,
  propagate: boolean
) {
  if (!inBounds(x, y)) return;
  const c = state.map[idx(x, y)] as any;
  if (!c) return;
  const was = c.h | 0;
  const newH = was + delta;
  applyHeightAndMaybeConvert(x, y, newH);
  if (propagate) {
    for (const d of DIRS) {
      const nx = x + d[0],
        ny = y + d[1];
      if (!inBounds(nx, ny)) continue;
      const n = state.map[idx(nx, ny)] as any;
      if (!n) continue;
      const nNew = (n.h | 0) + delta;
      applyHeightAndMaybeConvert(nx, ny, nNew);
    }
    // After manual edit, optionally smooth descent toward water
    smoothHeightsAround(x, y);
  }
  // Update the UI seed display to reflect the current state
  updateSeedDisplay();
  draw();
}

function smoothHeightsAround(cx: number, cy: number) {
  // Simple 2-step relaxation: tiles must not exceed any neighbor by >1, water clamps to 0
  for (let pass = 0; pass < 2; pass++) {
    for (const [x, y] of [
      [cx, cy],
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ] as any) {
      if (!inBounds(x, y)) continue;
      const i = idx(x, y);
      const c = state.map[i] as any;
      if (!c) continue;
      if (rt(c) === T.WATER) {
        c.h = 0;
        continue;
      }
      let maxN = 0;
      for (const d of DIRS) {
        const nx = x + d[0],
          ny = y + d[1];
        if (!inBounds(nx, ny)) continue;
        const n = state.map[idx(nx, ny)] as any;
        if (!n) continue;
        maxN = Math.max(maxN, n.h | 0);
      }
      if ((c.h | 0) > maxN + 1) c.h = maxN + 1;
      if ((c.h | 0) < 0) c.h = 0;
    }
  }
}
