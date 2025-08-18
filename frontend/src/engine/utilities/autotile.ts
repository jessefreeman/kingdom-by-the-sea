// Coastline autotiling helpers shared by 2D and 3D renderers
// Implements the same logic as frontend/auto-tile-test.html for outside edges on WATER tiles

export type Dir4 = 'N' | 'E' | 'S' | 'W';
export type Corner = 'NW' | 'NE' | 'SW' | 'SE';

export interface CoastOverlays {
  edges: Dir4[];
  corners: Corner[];
  caps: Corner[];
}

export interface LandQuery {
  inBounds(x: number, y: number): boolean;
  isLand(x: number, y: number): boolean; // true if tile at (x,y) counts as land
}

// Compute overlays for a single WATER tile at (x,y)
export function getCoastOverlaysAt(q: LandQuery, x: number, y: number): CoastOverlays {
  const at = (xx: number, yy: number) => (q.inBounds(xx, yy) ? (q.isLand(xx, yy) ? 1 : 0) : 0);
  const N = at(x, y - 1), E = at(x + 1, y), S = at(x, y + 1), W = at(x - 1, y);
  const NE = at(x + 1, y - 1), NW = at(x - 1, y - 1), SE = at(x + 1, y + 1), SW = at(x - 1, y + 1);

  const edges: Dir4[] = [];
  if (N === 1) edges.push('N');
  if (E === 1) edges.push('E');
  if (S === 1) edges.push('S');
  if (W === 1) edges.push('W');

  const corners: Corner[] = [];
  if (N === 1 && W === 1) corners.push('NW');
  if (N === 1 && E === 1) corners.push('NE');
  if (S === 1 && W === 1) corners.push('SW');
  if (S === 1 && E === 1) corners.push('SE');

  const caps: Corner[] = [];
  if (NE === 1 && N === 0 && E === 0) caps.push('NE');
  if (NW === 1 && N === 0 && W === 0) caps.push('NW');
  if (SE === 1 && S === 0 && E === 0) caps.push('SE');
  if (SW === 1 && S === 0 && W === 0) caps.push('SW');

  return { edges, corners, caps };
}

// Map overlay directions to tilesheet keys used in tile-config.json
export function coastOverlayKey(kind: 'edge' | 'corner' | 'cap', d: Dir4 | Corner): string {
  if (kind === 'edge') {
    const k: Record<Dir4, string> = { N: 'coast_edge_n', E: 'coast_edge_e', S: 'coast_edge_s', W: 'coast_edge_w' };
    return k[d as Dir4];
  }
  const base = kind === 'corner' ? 'coast_corner_' : 'coast_cap_';
  return base + String(d).toLowerCase();
}
