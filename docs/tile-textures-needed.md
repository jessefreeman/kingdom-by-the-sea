# Kingdom by the Sea - Tile Texture System

This document describes the current tile texture system implementation using runtime atlas generation from individual texture files.

## Current Implementation Status ✅

The tile texture system is **fully implemented and operational** with the following features:

### ✅ **System Architecture**
- **Runtime Atlas Generation**: Creates optimized texture atlas from individual PNG files
- **JSON Configuration**: `assets/tiles/tile-config.json` maps tile types to atlas positions  
- **Dual Texture Sources**: Combines `map-tiles.png` and `auto-tiles-water.png`
- **Performance Optimized**: Single atlas lookup for all rendering operations

### ✅ **Implementation Files**
- `src/engine/services/tileAtlas.ts` - Core atlas management and tile lookup
- `src/engine/services/tileAtlasPreloader.ts` - Runtime atlas generation from individual textures
- `assets/tiles/tile-config.json` - Tile type to texture coordinate mapping

### ✅ **Integration Status**
- **Three.js Renderer**: Full integration with 3D heightmap visualization
- **Canvas2D Renderer**: Full integration with 2D top-down view
- **Debug Tools**: Atlas visualization and performance monitoring

### ✅ **Debug Controls**
Current debug functionality accessible in-game:
- **`A` key**: Toggle visual atlas debug overlay (6x scale)
- **`Shift+A`**: Log detailed atlas info to browser console
- **`F` key**: Toggle fog of war for visibility testing

## Texture Atlas Layout

The system currently uses an **8×8 grid** (64 total positions) with the following mapping:

### Current Tile Mapping

The atlas combines tiles from multiple source images:

#### **Primary Terrain** (from `map-tiles.png`)
- **Row 0, Col 0**: Burnt land (black placeholder)
- **Row 0, Col 3**: Grass ('G' letter placeholder)  
- **Row 0, Col 4**: Forest ('T' letter placeholder)
- **Row 0, Col 5**: Mountain ('M' letter placeholder)
- **Row 0, Col 6**: Building ('H' letter placeholder)
- **Row 0, Col 7**: Farm ('F' letter placeholder)
- **Row 1, Col 0**: Rubble (black placeholder)

#### **Coastline Tiles** (from `coast_tilesheet.png`)
Auto-tiling system with 16 total coastline pieces:
- **Row 0, Cols 0-7**: Water, Land, Edges (N,E,S,W), Corners (NW,NE)
- **Row 1, Cols 0-5**: Corners (SW,SE), Caps (NW,NE,SW,SE)

## Technical Details

### Atlas Generation Process
1. **Load Source Images**: `map-tiles.png` + `coast_tilesheet.png`
2. **Parse Configuration**: `tile-config.json` defines tile positions
3. **Generate Runtime Atlas**: 128×128px canvas with 8×8 grid (16px tiles)
4. **Optimize Rendering**: Single atlas lookup for all tile operations

### Performance Benefits
- **Single Texture**: Eliminates multiple texture binding calls
- **Batch Rendering**: All tiles rendered in single draw call
- **Memory Efficient**: One atlas vs. multiple individual textures
- **Cache Friendly**: GPU texture cache optimized for single atlas

### Integration Points

#### Three.js Renderer
```typescript
// Texture atlas usage in Three.js
const atlas = tileAtlasService.getAtlas();
const material = new THREE.MeshBasicMaterial({ map: atlas });
const uv = tileAtlasService.getUV(tileType); // UV coordinates for tile
```

#### Canvas2D Renderer  
```typescript
// Direct canvas usage
const atlas = tileAtlasService.getAtlasCanvas();
const coords = tileAtlasService.getCoords(tileType);
ctx.drawImage(atlas, coords.x, coords.y, 16, 16, x, y, tileSize, tileSize);
```

## Future Expansion

### Planned Art Assets
The current system uses placeholder graphics and is ready for art asset replacement:

#### **Core Terrain Tiles** (Priority 1)
- [ ] **Water**: Deep blue ocean water texture
- [ ] **Grass**: Green grassland with varied texture
- [ ] **Forest**: Dense woodland canopy view
- [ ] **Mountain**: Rocky/snow-capped peaks
- [ ] **Burnt**: Charred, blackened ground

#### **Structure Overlays** (Priority 2)  
- [ ] **Hut**: Small wooden dwelling
- [ ] **House**: Medium stone/wood house
- [ ] **Mansion**: Large multi-story building
- [ ] **Palace**: Ornate government building
- [ ] **Castle**: Fortified stronghold
- [ ] **Farm**: Agricultural fields with crops
- [ ] **Mine**: Mountain mining operation
- [ ] **Dock**: Coastal port structure

#### **Special Effects** (Priority 3)
- [ ] **Selection Border**: Animated highlight ring
- [ ] **Farm Synergy**: Glow effect for adjacent farms
- [ ] **Construction**: Building progress indicators
- [ ] **Worker**: Animated worker sprites

### Expansion Process
1. Create 16×16px PNG files for each tile type
2. Update `tile-config.json` with new file paths
3. Atlas automatically rebuilds on next game load
4. No code changes required for new art assets

## Coastline Auto-Tiling System

The engine includes a sophisticated auto-tiling system for seamless water/land transitions. See `auto-tiling-specification.md` for detailed technical documentation.

### Features
- **Binary Grid Processing**: Operates on 1=Land, 0=Water data
- **16-Tile Coastline Set**: Complete edge, corner, and cap pieces
- **Real-time Generation**: Calculates appropriate tiles based on neighbors
- **Gap Prevention**: Diagonal caps fill pinhole gaps in coastlines

This system ensures that any procedurally generated or hand-edited terrain automatically displays smooth, natural-looking coastlines without manual tile placement.

### Column 4: Forest
- [ ] **Forest** - Dense trees/woodland (produces wood when cleared)

### Column 5: Mountain/Hills
- [ ] **Mountain** - Rocky terrain (for mine placement)

### Column 6: Buildings Base
- [ ] **Building Foundation** - Basic structure base (used for all building types)

### Column 7: Farm
- [ ] **Farm** - Agricultural fields/crops

## Building States & Variations

### Core Building Types (use Column 6 base + overlays)
- [ ] **Hut** - Basic wooden shelter
- [ ] **House** - Standard home  
- [ ] **Mansion** - Large residence
- [ ] **Palace** - Grand residence
- [ ] **Castle** - Fortified residence

### Resource Buildings
- [ ] **Mine** - Gold extraction facility (placed on mountains)
- [ ] **Dock** - Coastal trading post (placed on coastal water)

### Destroyed States
- [ ] **Rubble** - Stone debris from destroyed buildings (storm damage)

## Worker & Activity Indicators

### Farm Workers
- [ ] **Farm Worker Sprite** - Small person figure to overlay on farms
- [ ] **Empty Farm Indicator** - Visual cue showing farm needs worker

### Construction Progress
- [ ] **Construction Site** - Scaffolding/building-in-progress overlay
- [ ] **Progress Bar Elements** - Simple progress indicator components

## Special Effects & UI

### Selection & Feedback
- [ ] **Selection Border** - Highlight border for selected tiles
- [ ] **Farm Synergy Glow** - Effect for farms with adjacency bonus

## Simplified Implementation Notes

**Single Row Layout**: All core tiles in one 8×8 row
- **Programmatic Effects**: 
  - Fog of War: Darken tiles with shader/tint
  - Debug Letters: Overlay text programmatically  
  - Selection: Border/glow effects
  - Progress: Overlay progress bars
  - Workers: Sprite overlays on farm tiles

**Total Core Tiles Needed: ~20 unique graphics**

This simplified approach focuses on the essential gameplay visuals while keeping the art workload manageable.
