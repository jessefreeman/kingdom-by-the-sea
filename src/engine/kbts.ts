// Kingdom by the Sea — TypeScript global API (KBTS)
// Port of the JS game core, exposed on window for renderer/tests.

import type { Cell, State, UpgradeSpec } from "../types";

// ===== DOM helpers =====
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: any) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const rng32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  [T.HILL]: "M",
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
  riskRng: Math.random,
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
  const toId = (t: string | null) => {
    if (!t) return "??";
    // short ID from LABEL or first 2 letters
    return LABEL[t] || t.slice(0, 2).toUpperCase();
  };
  const tiles: string[] = [];
  const heights: string[] = [];
  for (let y = 0; y < H; y++) {
    let rowT: string[] = [],
      rowH: string[] = [];
    for (let x = 0; x < W; x++) {
      const c = state.map[idx(x, y)] as any;
      const t = rt(c);
      rowT.push(toId(t));
      rowH.push(String(c?.h | 0));
    }
    tiles.push(rowT.join(" "));
    heights.push(rowH.join(" "));
  }
  console.log("KBTS DEBUG DUMP");
  console.log("seed:", state.seed);
  console.log("map (ids):");
  tiles.forEach((r) => console.log(r));
  console.log("heights:");
  heights.forEach((r) => console.log(r));
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

// ===== World Generation =====
async function generate(
  seed = Date.now(),
  size: "small" | "medium" | "large" = "medium"
) {
  const sizes: Record<string, { w: number; h: number }> = {
    small: { w: 8, h: 6 },
    medium: { w: 10, h: 8 },
    large: { w: 12, h: 8 },
  };
  Object.assign(state.size, sizes[size]);
  Object.assign(state, {
    seed,
    rng: rng32(seed),
    year: 1,
    gold: 3,
    food: 3,
    wood: 2,
    people: 3,
    actions: 3,
    sel: null,
  });
  state.map = Array(state.size.w * state.size.h)
    .fill(0)
    .map(() => cell(T.WATER));
  const cx = (state.size.w - 1) / 2,
    cy = (state.size.h - 1) / 2,
    maxR = Math.hypot(cx, cy);
  each((x, y, c: any) => {
    const v = 0.6 - Math.hypot(x - cx, y - cy) / maxR + (rand() * 0.35 - 0.15);
    c.type = v > 0 ? T.GRASS : T.WATER;
  });
  const L: Array<{ x: number; y: number }> = [];
  const n = Math.max(4, Math.floor((state.size.w * state.size.h) / 12));
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(rand() * (state.size.w - 2)),
      y = 1 + Math.floor(rand() * (state.size.h - 2));
    if ((state.map[idx(x, y)] as any).type !== T.WATER) L.push({ x, y });
  }
  each((x, y, c: any) => {
    if (c.type === T.WATER) return;
    let k = 0;
    for (const m of L) if (Math.hypot(m.x - x, m.y - y) <= 2.1) k++;
    c.type =
      k >= 4 ? T.MOUNTAIN : k === 3 ? T.HILL : k === 2 ? T.FOREST : T.GRASS;
  });
  for (const m of L) {
    if (rand() < 0.25) {
      (state.map[idx(m.x, m.y)] as any).type = T.WATER;
      for (const d of DIRS) {
        const nx = m.x + d[0],
          ny = m.y + d[1];
        if (inBounds(nx, ny) && rand() < 0.5)
          (state.map[idx(nx, ny)] as any).type = T.WATER;
      }
    }
  }
  const gs: Array<{ x: number; y: number }> = [];
  each((x, y, c: any) => {
    if (c.type === T.GRASS) gs.push({ x, y });
  });
  const s = gs.sort(
    (a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)
  )[0] || { x: Math.floor(cx), y: Math.floor(cy) };
  (state.map[idx(s.x, s.y)] as any).type = T.HUT;
  ensureStartResources(s.x, s.y);
  reveal(s.x, s.y, 1);
  let towns = 0;
  each((x, y, c: any) => {
    if (
      towns < 2 &&
      (c.type === T.GRASS || c.type === T.FOREST) &&
      (x + y) % 7 === 0 &&
      rand() < 0.25
    ) {
      c.type = T.TOWN;
      towns++;
    }
  });
  // Compute initial heights based on terrain
  computeHeightMap();
  // Deterministically set seed from current land/water layout
  recomputeSeedFromMap();

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
  $("seedOut").textContent = String(state.seed);
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
    let atlasType = t || T.WATER;
    let isCoast = false;

    if (t === T.WATER) {
      // Check if this is a coastal tile
      for (const d of DIRS) {
        const nx = x + d[0],
          ny = y + d[1];
        if (inBounds(nx, ny)) {
          const n = rt(state.map[idx(nx, ny)]);
          if (n !== T.WATER) {
            isCoast = true;
            break;
          }
        }
      }
      atlasType = isCoast ? "coast" : "water";
    }

    const useLetters = true; // Use letter tiles during development
    const useFog = state.fogEnabled !== false && !c.disc;

    const tileCanvas = atlas.getTileCanvas(atlasType, useLetters, useFog);
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
  state.sel = idx(x, y);
  draw();
  openPanel(x, y);
};
canvas.addEventListener("click", canvasClick);
// Debug height controls: +/- to raise/lower selected tile and propagate to neighbors
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (state.sel == null) return;
  if (e.key === "+" || e.key === "=") {
    // Only affect the selected tile (no propagation) for manual testing
    adjustHeightByIndex(state.sel, +1, false);
    e.preventDefault();
  }
  if (e.key === "-" || e.key === "_") {
    adjustHeightByIndex(state.sel, -1, false);
    e.preventDefault();
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
  if ((state.riskRng?.() || Math.random()) < risk && state.people > 0)
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
  let r = rand() * tot,
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
      const t = v[Math.floor(rand() * v.length)];
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
      const t = v[Math.floor(rand() * v.length)];
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
          await generate(Number.isFinite(sd) ? sd : Date.now(), size);
          wrap.remove();
        };
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
  setRenderer: (name: string) => {
    const RN = (window as any).KBTS_Renderer;
    RN?.set?.(name);
  },
  getRenderer: () => {
    const RN = (window as any).KBTS_Renderer;
    return RN?.get?.() || "debug";
  },
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
  const heights = new Array(W * H).fill(0);
  // Seed mountains
  each((x, y, c: any) => {
    if (c.type === T.MOUNTAIN) {
      heights[idx(x, y)] = 2;
    }
  });
  // Neighbor raise around mountains
  each((x, y, c: any) => {
    if (c.type !== T.MOUNTAIN) return;
    for (const d of DIRS) {
      const nx = x + d[0],
        ny = y + d[1];
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      const nc = state.map[ni] as any;
      if (nc && rt(nc) !== T.WATER) heights[ni] = Math.max(heights[ni], 1);
    }
  });
  // Mountain ranges: BFS over connected mountains, raise inner tiles
  const seen = new Array(W * H).fill(false);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (seen[i]) continue;
      const c = state.map[i] as any;
      if (!c || c.type !== T.MOUNTAIN) continue;
      // Collect component
      const comp: Array<[number, number]> = [];
      const q: Array<[number, number]> = [[x, y]];
      seen[i] = true;
      while (q.length) {
        const [cx, cy] = q.shift()!;
        comp.push([cx, cy]);
        for (const d of DIRS) {
          const nx = cx + d[0],
            ny = cy + d[1];
          if (!inBounds(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (seen[ni]) continue;
          const nc = state.map[ni] as any;
          if (nc && nc.type === T.MOUNTAIN) {
            seen[ni] = true;
            q.push([nx, ny]);
          }
        }
      }
      if (comp.length >= 2) {
        // Determine a "center" as the tile with most mountain neighbors
        let best: [number, number] = comp[0]!,
          bestDeg = -1;
        for (const [cx, cy] of comp) {
          let deg = 0;
          for (const d of DIRS) {
            const nx = cx + d[0],
              ny = cy + d[1];
            if (!inBounds(nx, ny)) continue;
            const nc = state.map[idx(nx, ny)] as any;
            if (nc && nc.type === T.MOUNTAIN) deg++;
          }
          if (deg > bestDeg) {
            bestDeg = deg;
            best = [cx, cy];
          }
        }
        // Raise center proportional to degree (cap at 3 for now)
        const centerI = idx(best[0], best[1]);
        heights[centerI] = Math.max(
          heights[centerI],
          Math.min(3, 2 + Math.max(0, bestDeg - 2))
        );
        // Other mountain tiles reduced by 1 toward base 1
        for (const [mx, my] of comp) {
          const mi = idx(mx, my);
          if (mi === centerI) continue;
          heights[mi] = Math.max(1, heights[mi] - 1);
        }
      }
    }
  // Propagate downward to land, stop at water
  // Multi-source BFS from non-water tiles with assigned heights
  const q: Array<[number, number]> = [];
  each((x, y, c: any) => {
    const i = idx(x, y);
    if (rt(c) !== T.WATER && heights[i] > 0) q.push([x, y]);
  });
  while (q.length) {
    const [cx, cy] = q.shift()!;
    const ci = idx(cx, cy);
    for (const d of DIRS) {
      const nx = cx + d[0],
        ny = cy + d[1];
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      const nc = state.map[ni] as any;
      if (!nc || rt(nc) === T.WATER) continue;
      const target = Math.max(0, heights[ci] - 1);
      if (target > heights[ni]) {
        heights[ni] = target;
        q.push([nx, ny]);
      }
    }
  }
  // Assign back to cells (water stays 0)
  each((x, y, c: any) => {
    const i = idx(x, y);
    // Normalize: all land sits at least 1 above water
    c.h = rt(c) === T.WATER ? 0 : Math.max(1, heights[i] | 0);
  });
}

function adjustHeightByIndex(i: number, delta: number, propagate: boolean) {
  if (i < 0 || i >= state.map.length) return;
  const x = i % state.size.w,
    y = Math.floor(i / state.size.w);
  adjustHeightAt(x, y, delta, propagate);
}

// Bump the random seed when land is created/removed to reflect terrain changes
function bumpSeed(
  reason: "land-created" | "land-removed",
  x: number,
  y: number
) {
  // Mix old seed with position and reason salts, keep as uint32
  const salt =
    ((x + 1) * 73856093) ^
    ((y + 1) * 19349663) ^
    (reason === "land-created" ? 0x9e3779b9 : 0x85ebca6b);
  let s = (state.seed >>> 0) ^ (salt >>> 0);
  s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  state.seed = s >>> 0;
  state.rng = rng32(state.seed);
  const so = document.getElementById("seedOut");
  if (so) so.textContent = String(state.seed);
}

// Deterministically recompute seed from full map state (tile types, upgrades, workers, flags, height)
function recomputeSeedFromMap() {
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
        case T.WATER: code = 0; break;
        case T.GRASS: code = 1; break;
        case T.FOREST: code = 2; break;
        case T.HILL: code = 3; break;
        case T.MOUNTAIN: code = 4; break;
        case T.FARM: code = 5; break;
        case T.MINE: code = 6; break;
        case T.HUT: code = 7; break;
        case T.HOUSE: code = 8; break;
        case T.MANSION: code = 9; break;
        case T.PALACE: code = 10; break;
        case T.CASTLE: code = 11; break;
        case T.BURNT: code = 12; break;
        case T.RUBBLE: code = 13; break;
        case T.DOCK: code = 14; break;
        case T.TOWN: code = 15; break;
        default: code = 31; break;
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
          case T.WATER: toCode = 0; break;
          case T.GRASS: toCode = 1; break;
          case T.FOREST: toCode = 2; break;
          case T.HILL: toCode = 3; break;
          case T.MOUNTAIN: toCode = 4; break;
          case T.FARM: toCode = 5; break;
          case T.MINE: toCode = 6; break;
          case T.HUT: toCode = 7; break;
          case T.HOUSE: toCode = 8; break;
          case T.MANSION: toCode = 9; break;
          case T.PALACE: toCode = 10; break;
          case T.CASTLE: toCode = 11; break;
          case T.BURNT: toCode = 12; break;
          case T.RUBBLE: toCode = 13; break;
          case T.DOCK: toCode = 14; break;
          case T.TOWN: toCode = 15; break;
          default: toCode = 31; break;
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
  state.seed = h >>> 0;
  state.rng = rng32(state.seed);
  const so = document.getElementById("seedOut");
  if (so) so.textContent = String(state.seed);
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
  // Recompute seed deterministically from land/water layout
  recomputeSeedFromMap();
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
