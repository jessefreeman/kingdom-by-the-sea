# 8-Bit Auto-Tiling Specification for Kingdom by the Sea

## Overview

This document defines the 8-bit auto-tiling system used for seamless tile transitions, starting with water tiles. The system uses a 64x64 texture containing 16 variants of 16x16 tiles arranged in a 4x4 grid.

## Auto-Tiling Concept

Auto-tiling automatically selects the correct tile variant based on the presence of matching tiles in the 8 adjacent positions (4 cardinal + 4 diagonal directions). Each tile variant handles a specific combination of connections.

## Template Layout (4x4 Grid)

The auto-tile template follows this standard layout:

```
+---+---+---+---+
| 0 | 1 | 2 | 3 |  Row 0: Corner and edge combinations
+---+---+---+---+
| 4 | 5 | 6 | 7 |  Row 1: Complex edge cases  
+---+---+---+---+
| 8 | 9 |10 |11 |  Row 2: Diagonal corner combinations
+---+---+---+---+
|12 |13 |14 |15 |  Row 3: Full connections and special cases
+---+---+---+---+
```

## Tile Index Mapping

Based on the visual analysis of the provided template:

### Row 0 (Basic Corners and Edges)
- **Tile 0**: Top-left outer corner
- **Tile 1**: Top edge connection
- **Tile 2**: Top-right outer corner  
- **Tile 3**: Right edge connection

### Row 1 (Complex Edges)
- **Tile 4**: Left edge connection
- **Tile 5**: Full center tile (all sides connected)
- **Tile 6**: Inner corner combinations
- **Tile 7**: Bottom-right outer corner

### Row 2 (Diagonal Corners)
- **Tile 8**: Bottom-left outer corner
- **Tile 9**: Bottom edge connection
- **Tile 10**: Complex inner corner
- **Tile 11**: Vertical edge only

### Row 3 (Special Cases)
- **Tile 12**: Horizontal edge only
- **Tile 13**: Isolated tile (no connections)
- **Tile 14**: Triple connection variants
- **Tile 15**: Complex connection patterns

## 8-Bit Calculation Method

The tile index is calculated using 8 bits representing the 8 adjacent positions:

```
NW  N  NE     7  0  1
 W  C   E  =  6  C  2  
SW  S  SE     5  4  3
```

Where:
- **N, E, S, W**: Cardinal directions (North, East, South, West)
- **NW, NE, SW, SE**: Diagonal directions (corners)
- **C**: Center tile being calculated

### Bit Calculation
```
bit_value = 0
if (North tile matches)     bit_value |= (1 << 0)  // bit 0
if (NorthEast tile matches) bit_value |= (1 << 1)  // bit 1  
if (East tile matches)      bit_value |= (1 << 2)  // bit 2
if (SouthEast tile matches) bit_value |= (1 << 3)  // bit 3
if (South tile matches)     bit_value |= (1 << 4)  // bit 4
if (SouthWest tile matches) bit_value |= (1 << 5)  // bit 5
if (West tile matches)      bit_value |= (1 << 6)  // bit 6
if (NorthWest tile matches) bit_value |= (1 << 7)  // bit 7

tile_index = lookup_table[bit_value]
```

## Lookup Table (8-bit to Tile Index)

The lookup table maps the 8-bit value (0-255) to the appropriate tile index (0-15):

```typescript
// Simplified lookup table - needs to be populated based on visual analysis
const AUTO_TILE_LOOKUP: number[] = [
  13, // 0b00000000 - no connections (isolated)
   9, // 0b00000001 - north only
   1, // 0b00000010 - northeast only  
   // ... (256 entries total)
   5, // 0b11111111 - all connections (full center)
];
```

## Implementation for Water Tiles

### Usage Example
```typescript
function getWaterAutoTile(x: number, y: number, mapData: TileType[][]): number {
  let bitValue = 0;
  
  // Check each of the 8 adjacent positions
  const directions = [
    {dx: 0, dy: -1, bit: 0}, // North
    {dx: 1, dy: -1, bit: 1}, // NorthEast
    {dx: 1, dy: 0,  bit: 2}, // East
    {dx: 1, dy: 1,  bit: 3}, // SouthEast
    {dx: 0, dy: 1,  bit: 4}, // South
    {dx: -1, dy: 1, bit: 5}, // SouthWest
    {dx: -1, dy: 0, bit: 6}, // West
    {dx: -1, dy: -1, bit: 7} // NorthWest
  ];
  
  for (const dir of directions) {
    const neighborX = x + dir.dx;
    const neighborY = y + dir.dy;
    
    if (isWaterTile(neighborX, neighborY, mapData)) {
      bitValue |= (1 << dir.bit);
    }
  }
  
  return AUTO_TILE_LOOKUP[bitValue] || 13; // fallback to isolated tile
}
```

### Texture Coordinates
```typescript
function getAutoTileUV(tileIndex: number): {x: number, y: number} {
  const col = tileIndex % 4;
  const row = Math.floor(tileIndex / 4);
  
  return {
    x: col * 16, // 16px per tile
    y: row * 16  // 16px per tile
  };
}
```

## Asset Requirements

- **Texture Size**: 64x64 pixels
- **Tile Size**: 16x16 pixels each
- **Grid**: 4x4 arrangement
- **Format**: PNG with transparency support
- **Naming**: `auto-tiles-[type].png` (e.g., `auto-tiles-water.png`)

## Integration Points

1. **Tile Config JSON**: Add auto-tile flag and lookup table
2. **Renderer**: Calculate neighbor connections and select correct tile
3. **Atlas System**: Support for 4x4 auto-tile layouts
4. **Performance**: Cache calculations when possible

## Next Steps

1. Populate the complete 256-entry lookup table based on visual analysis
2. Implement auto-tile calculation in the renderer
3. Create additional auto-tile sets for other terrain types
4. Add debug visualization for auto-tile selection

---

*This specification provides the foundation for seamless tile transitions that will significantly improve the visual quality of terrain boundaries in Kingdom by the Sea.*
