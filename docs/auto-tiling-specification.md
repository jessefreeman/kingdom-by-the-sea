# Coastline Auto-Tiling Specification (Water/Land)

## Overview

This spec describes the coastline auto-tiler implemented in `frontend/auto-tile-test.html`. The algorithm operates on a binary grid where 1 = Land and 0 = Water. It draws outside edges on Water tiles that are adjacent to Land, and it also adds convex corners and tiny diagonal caps to close gaps. There is no 256-entry bitmask lookup; instead, neighbors are inspected directly and the appropriate overlay pieces are emitted.

Key properties:
- Tile size: 16×16 px
- Coordinate system: x→ (columns), y↓ (rows)
- Land is rendered as full tiles; edges/corners/caps are rendered on Water tiles that border Land

## Tilesheet Layout (8×2 grid, 16 tiles total)

The tilesheet used by the demo is arranged in 2 rows × 8 columns (indices enumerate left→right, top→bottom):

- 0: Water (base)
- 1: Land (full tile)
- 2–5: Edges N, E, S, W (thin bands drawn along the corresponding side)
- 6–9: Convex corners NW, NE, SW, SE (quarter-round arcs drawn into the corner)
- 10–13: Diagonal caps NW, NE, SW, SE (small squares to fill diagonal-only contact gaps)
- 14–15: Unused (reserved)

Notes:
- Edges and corners are drawn in the same color/style and are intended to be layered on top of the Water base.
- “Caps” are very small squares used when a Water tile only touches Land diagonally (no cardinal adjacency), to avoid tiny pinhole gaps.

## Neighborhood Logic (no bitmask)

Given a grid `grid[y][x]` where `1 = Land`, `0 = Water`:

For each tile (x,y):
1. If `grid[y][x] === 1` → emit a Land tile at (x,y). No edges/corners/caps are placed on Land tiles.
2. Else (Water tile), compute 8 neighbors (use out-of-bounds = 0/Water):
   - Cardinals: N=(x, y-1), E=(x+1, y), S=(x, y+1), W=(x-1, y)
   - Diagonals: NE=(x+1, y-1), NW=(x-1, y-1), SE=(x+1, y+1), SW=(x-1, y+1)

Then emit overlays on the Water tile at (x,y) as follows:

- Edges (if a cardinal neighbor is Land):
  - If N==1 → place Edge-N (tile 2)
  - If E==1 → place Edge-E (tile 3)
  - If S==1 → place Edge-S (tile 4)
  - If W==1 → place Edge-W (tile 5)

- Convex corners (if two adjacent cardinals are Land):
  - If N==1 and W==1 → place Corner-NW (tile 6)
  - If N==1 and E==1 → place Corner-NE (tile 7)
  - If S==1 and W==1 → place Corner-SW (tile 8)
  - If S==1 and E==1 → place Corner-SE (tile 9)

- Diagonal caps (if only a diagonal neighbor is Land, and its adjacent cardinals are Water):
  - If NE==1 and N==0 and E==0 → place Cap-NE (tile 11)
  - If NW==1 and N==0 and W==0 → place Cap-NW (tile 10)
  - If SE==1 and S==0 and E==0 → place Cap-SE (tile 13)
  - If SW==1 and S==0 and W==0 → place Cap-SW (tile 12)

Result: Water tiles bordering Land receive the appropriate outside edges and rounded corners; small diagonal-only gaps are filled with caps. Land tiles remain solid.

### Reference implementation (simplified TypeScript-ish)

```ts
type Cell = 0 | 1; // 0 = Water, 1 = Land

interface Coast {
  land: {x:number,y:number}[];
  edges: {x:number,y:number,d:'N'|'E'|'S'|'W'}[];
  corners: {x:number,y:number,c:'NW'|'NE'|'SW'|'SE'}[];
  caps: {x:number,y:number,c:'NW'|'NE'|'SW'|'SE'}[];
}

function autotileCoast(grid: Cell[][]): Coast {
  const H = grid.length, W = grid[0].length;
  const coast: Coast = { land: [], edges: [], corners: [], caps: [] };
  const at = (x:number,y:number)=> (y>=0&&y<H&&x>=0&&x<W) ? grid[y][x] : 0;

  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const self = at(x,y);
      if (self === 1) { coast.land.push({x,y}); continue; }

      const N=at(x,y-1), E=at(x+1,y), S=at(x,y+1), Wn=at(x-1,y);
      const NE=at(x+1,y-1), NW=at(x-1,y-1), SE=at(x+1,y+1), SW=at(x-1,y+1);

      if (N===1) coast.edges.push({x,y,d:'N'});
      if (E===1) coast.edges.push({x,y,d:'E'});
      if (S===1) coast.edges.push({x,y,d:'S'});
      if (Wn===1) coast.edges.push({x,y,d:'W'});

      if (N===1 && Wn===1) coast.corners.push({x,y,c:'NW'});
      if (N===1 && E===1)  coast.corners.push({x,y,c:'NE'});
      if (S===1 && Wn===1) coast.corners.push({x,y,c:'SW'});
      if (S===1 && E===1)  coast.corners.push({x,y,c:'SE'});

      if (NE===1 && N===0 && E===0) coast.caps.push({x,y,c:'NE'});
      if (NW===1 && N===0 && Wn===0) coast.caps.push({x,y,c:'NW'});
      if (SE===1 && S===0 && E===0) coast.caps.push({x,y,c:'SE'});
      if (SW===1 && S===0 && Wn===0) coast.caps.push({x,y,c:'SW'});
    }
  }
  return coast;
}
```

## Tile ID mapping and UVs

Indices (left→right, top→bottom across an 8×2 sheet):

- 0: Water
- 1: Land
- 2: Edge-N, 3: Edge-E, 4: Edge-S, 5: Edge-W
- 6: Corner-NW, 7: Corner-NE, 8: Corner-SW, 9: Corner-SE
- 10: Cap-NW, 11: Cap-NE, 12: Cap-SW, 13: Cap-SE
- 14–15: Unused

UV helper for an 8×2 sheet:

```ts
function tileIndexToUV(id: number): {x: number, y: number} {
  const cols = 8; // fixed in demo
  return { x: (id % cols) * 16, y: Math.floor(id / cols) * 16 };
}
```

## Asset requirements

- Tile size: 16×16 px
- Sheet layout: 8 columns × 2 rows (generated in the demo)
- Format: PNG with transparency
- Suggested naming: `auto-tiles-water.png`

## Integration points

1. Renderer: For each tile, decide Land vs Water base, then draw edges/corners/caps overlays on Water tiles per the rules above.
2. Atlas: Support addressing into an 8×2 tilesheet via the ID mapping listed here.
3. Debug: Optionally render overlay IDs for corners (6–9) to validate selection.
4. Performance: Recompute only affected tiles when edits occur; cache results if needed.

## Notes and future work

- This is an “outside-edge” coastline solution; it does not blend interiors or support a full 256-case Wang/autotile mask. If needed, we can extend it to support more shapes later.
- The last two tiles (14–15) are reserved for future pieces (e.g., T-junctions, bevel variants, or decorative ends).
