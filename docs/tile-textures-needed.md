# Kingdom by the Sea - Tile Texture System Implementation

This document outlines the tile texture system using individual texture files that are preloaded and combined into a runtime atlas.

## System Overview

**Architecture**: Single existing texture → JSON configuration → Runtime atlas generation
- **Development**: Using existing 128x128 PNG with letter placeholders
- **Runtime**: Single texture atlas for optimal performance  
- **Configuration**: JSON file maps tile types to atlas positions

## Current Implementation Status

✅ **JSON Configuration**: Created `assets/tiles/tile-config.json` with tile mappings
✅ **Preloader System**: Built `src/tileAtlasPreloader.ts` for runtime atlas generation  
✅ **Updated TileAtlas**: Modified existing `src/tileAtlas.ts` to use new system
✅ **Integration**: System works with existing Three.js and debug renderers

**Current Tile Mapping** (using existing map-tiles.png):
- Column 0: Burnt land (black)
- Column 1: Water (D letter)
- Column 2: Coast (W letter) 
- Column 3: Grass (G letter)
- Column 4: Forest (T letter)
- Column 5: Mountain (M letter)
- Column 6: Building (H letter)
- Column 7: Farm (F letter)

**Next Steps**: Replace letter placeholders with actual art assets as individual PNG files

## Core Terrain Tiles (8 columns)

### Column 0: Burnt/Destroyed
- [ ] **Burnt Land** - Charred/blackened ground (from fire events)

### Column 1: Deep Water
- [ ] **Deep Water** - Dark blue deep ocean water

### Column 2: Coastal Water  
- [ ] **Coastal Water** - Lighter blue coastal water (for dock placement)

### Column 3: Grass
- [ ] **Grass** - Green grassland (base buildable terrain)

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
