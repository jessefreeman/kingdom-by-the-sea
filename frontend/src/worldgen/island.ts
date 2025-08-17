// Organic island shaping inspired by C# Map.CreateIsland erosion + lake carving
// Produces a land mask (water=0, land=1). Heights are assigned later by kbts.ts

export type RNG = () => number; // returns 0..1
export type Grid = number[][];  // heights/mask

export interface OrganicIslandParams {
  coastMargin: number;        // water ring at border
  baseRadiusFrac: number;     // initial filled radius vs min(W,H)
  erodeIterations: number;    // number of erosion passes
  erodePercent: number;       // fraction of coast removed per pass (0..1)
  lakePercent: number;        // fraction of interior land picked as lake seeds (0..1 of interior land)
  minLakeDistToSea: number;   // only seed lakes this far from the sea (tiles)
  maxLakeFlood: number;       // cap flood size per seed to avoid giant lakes
}

function makeGrid(W: number, H: number, v = 0): Grid {
  return Array.from({ length: H }, () => Array(W).fill(v));
}
const inBounds = (W: number, H: number, x: number, y: number) =>
  x >= 0 && y >= 0 && x < W && y < H;
const isLand = (h: number) => h >= 1;

export function enforceWaterBorder(height: Grid, margin: number) {
  const H = height.length;
  const W = H > 0 ? (height[0] as number[]).length : 0;
  if (!W) return;
  for (let y = 0; y < H; y++) {
    const row = height[y]!;
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (d < margin) row[x] = 0;
    }
  }
}

function seedSolidIsland(W: number, H: number, radiusFrac: number): Grid {
  const g = makeGrid(W, H, 0);
  const cx = (W - 1) / 2, cy = (H - 1) / 2;
  const r = Math.min(W, H) * radiusFrac;
  const r2 = r * r;
  for (let y = 0; y < H; y++) {
    const row = g[y]!;
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy + 0.35 * (Math.abs(dx) + Math.abs(dy)) ** 2;
      if (d2 <= r2) row[x] = 1;
    }
  }
  return g;
}

function collectCoastCells(h: Grid): [number, number][] {
  const H = h.length;
  const W = H > 0 ? (h[0] as number[]).length : 0;
  const res: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const row = h[y]!;
    if (!isLand(row[x]!)) continue;
    if ((y > 0 && !isLand(h[y - 1]![x]!)) ||
        (y < H - 1 && !isLand(h[y + 1]![x]!)) ||
        (x > 0 && !isLand(row[x - 1]!)) ||
        (x < W - 1 && !isLand(row[x + 1]!))) {
      res.push([x, y]);
    }
  }
  return res;
}

function erodeOnce(h: Grid, rng: RNG, percent: number) {
  if (percent <= 0) return;
  const coast = collectCoastCells(h);
  for (let i = coast.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = coast[i]!; coast[i] = coast[j]!; coast[j] = t;
  }
  const n = Math.floor(coast.length * percent);
  for (let i = 0; i < n; i++) {
    const c = coast[i]!;
    const [x, y] = c;
    h[y]![x] = 0;
  }
}

function distanceToSea(h: Grid): number[][] {
  const H = h.length;
  const W = H > 0 ? (h[0] as number[]).length : 0;
  const dist = makeGrid(W, H, Number.POSITIVE_INFINITY as unknown as number);
  const q: [number, number][] = [];

  const sea = makeGrid(W, H, 0);
  const q2: [number, number][] = [];
  for (let x = 0; x < W; x++) { q2.push([x, 0]); q2.push([x, H - 1]); }
  for (let y = 0; y < H; y++) { q2.push([0, y]); q2.push([W - 1, y]); }
  while (q2.length) {
    const [x, y] = q2.pop()!;
    if (!inBounds(W, H, x, y) || sea[y]![x]!) continue;
    if (h[y]![x]! !== 0) continue;
    sea[y]![x] = 1;
    q2.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (sea[y]![x]!) { (dist[y] as any)[x] = 0; q.push([x, y]); }
  }

  while (q.length) {
    const [x, y] = q.shift()!;
  const d = ((dist[y] as any)[x] as number) + 1;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      if (!inBounds(W, H, nx, ny)) continue;
      if (d < (dist[ny]![nx] as number)) { (dist[ny] as any)[nx] = d; q.push([nx, ny]); }
    }
  }
  return dist as unknown as number[][];
}

function carveLakes(h: Grid, rng: RNG, percent: number, minDistToSea: number, maxFlood: number) {
  if (percent <= 0) return;
  const H = h.length;
  const W = H > 0 ? (h[0] as number[]).length : 0;
  const seaDist = distanceToSea(h);
  const interior: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const row = h[y]!;
    if (row[x]! >= 1 && (seaDist[y]![x] as number) >= minDistToSea) interior.push([x, y]);
  }
  for (let i = interior.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = interior[i]!; interior[i] = interior[j]!; interior[j] = t;
  }
  const seeds = Math.floor(interior.length * percent);
  for (let i = 0; i < seeds; i++) {
    const [sx, sy] = interior[i]!;
    if (h[sy]![sx]! === 0) continue;
    const q: [number, number][] = [[sx, sy]];
    let flooded = 0;
    while (q.length && flooded < maxFlood) {
      const [x, y] = q.pop()!;
      if (!inBounds(W, H, x, y) || h[y]![x]! === 0) continue;
      // prevent connecting to sea
      let touchesSea = false;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
        if (!inBounds(W, H, nx, ny)) continue;
        if (h[ny]![nx]! === 0 && (seaDist[ny]![nx] as number) === 0) { touchesSea = true; break; }
      }
      if (touchesSea) continue;
      h[y]![x] = 0; flooded++;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
        if (inBounds(W, H, nx, ny) && h[ny]![nx]! >= 1 && (seaDist[ny]![nx] as number) >= minDistToSea) q.push([nx, ny]);
      }
    }
  }
}

export function generateOrganicIslandHeight(
  W: number,
  H: number,
  rng: RNG,
  p: OrganicIslandParams
): Grid {
  const h = seedSolidIsland(W, H, p.baseRadiusFrac);
  enforceWaterBorder(h, p.coastMargin);

  for (let i = 0; i < p.erodeIterations; i++) {
    erodeOnce(h, rng, p.erodePercent);
    enforceWaterBorder(h, p.coastMargin);
  }

  carveLakes(h, rng, p.lakePercent, p.minLakeDistToSea, p.maxLakeFlood);
  enforceWaterBorder(h, p.coastMargin);

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const row = h[y]!;
    row[x] = row[x]! >= 1 ? 1 : 0;
  }
  return h;
}
