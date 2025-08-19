// Core 4X Engine Systems - Generic tile management framework

import type { EngineContext } from '../contracts/plugins';

export interface TileCoordinate {
  x: number;
  y: number;
}

export interface TileData {
  x: number;
  y: number;
  index: number;
  type: string;
  properties: Record<string, any>;
}

export interface TileAction {
  id: string;
  name: string;
  validate?: (tile: TileData, context: EngineContext) => boolean;
  execute?: (tile: TileData, context: EngineContext) => void;
  cost?: Record<string, number>;
}

export interface TileSelectionEvent {
  tile: TileData;
  previousTile?: TileData;
  source: 'mouse' | 'keyboard' | 'api';
}

export class TileSystem {
  private context!: EngineContext;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private selectedTile: TileData | null = null;
  private tileActions: Map<string, TileAction> = new Map();
  private hoveredTile: TileData | null = null;

  constructor(mapWidth?: number, mapHeight?: number) {
    this.mapWidth = mapWidth || 16;
    this.mapHeight = mapHeight || 12;
  }

  init(context: EngineContext): void {
    this.context = context;
    context.services.provide('tiles', this);

    // Subscribe to map changes
    context.events.subscribe('map.initialized', this.onMapInitialized.bind(this));
    context.events.subscribe('map.resized', this.onMapResized.bind(this));
  }

  /**
   * Set map dimensions
   */
  setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    this.context.events.publish('tiles.map.resized', { width, height });
  }

  /**
   * Get map dimensions
   */
  getMapSize(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }

  /**
   * Convert coordinates to flat array index
   */
  coordinateToIndex(x: number, y: number): number {
    return y * this.mapWidth + x;
  }

  /**
   * Convert flat array index to coordinates
   */
  indexToCoordinate(index: number): TileCoordinate {
    return {
      x: index % this.mapWidth,
      y: Math.floor(index / this.mapWidth)
    };
  }

  /**
   * Check if coordinates are within map bounds
   */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
  }

  /**
   * Get tile data at coordinates
   */
  getTileAt(x: number, y: number): TileData | null {
    if (!this.isInBounds(x, y)) return null;

    const state = this.context.state.get();
    const index = this.coordinateToIndex(x, y);
    const cell = state.map.cells[index];

    if (!cell) return null;

    return {
      x,
      y,
      index,
      type: cell.type,
      properties: { ...cell }
    };
  }

  /**
   * Get tile data by index
   */
  getTileByIndex(index: number): TileData | null {
    const coord = this.indexToCoordinate(index);
    return this.getTileAt(coord.x, coord.y);
  }

  /**
   * Select a tile
   */
  selectTile(x: number, y: number, source: 'mouse' | 'keyboard' | 'api' = 'api'): boolean {
    if (!this.isInBounds(x, y)) return false;

    const previousTile = this.selectedTile;
    const newTile = this.getTileAt(x, y);

    if (!newTile) return false;

    this.selectedTile = newTile;

    const event: TileSelectionEvent = {
      tile: newTile,
      source
    };

    if (previousTile) {
      event.previousTile = previousTile;
    }

    this.context.events.publish('tile.selected', event);
    return true;
  }

  /**
   * Clear tile selection
   */
  clearSelection(): void {
    if (this.selectedTile) {
      const previousTile = this.selectedTile;
      this.selectedTile = null;
      this.context.events.publish('tile.deselected', { tile: previousTile });
    }
  }

  /**
   * Get currently selected tile
   */
  getSelectedTile(): TileData | null {
    return this.selectedTile;
  }

  /**
   * Set hovered tile (for UI feedback)
   */
  setHoveredTile(x: number, y: number): void {
    const newHovered = this.getTileAt(x, y);
    if (newHovered?.index !== this.hoveredTile?.index) {
      const previousHovered = this.hoveredTile;
      this.hoveredTile = newHovered;
      
      this.context.events.publish('tile.hover.changed', {
        tile: newHovered,
        previousTile: previousHovered
      });
    }
  }

  /**
   * Clear hovered tile
   */
  clearHover(): void {
    if (this.hoveredTile) {
      const previousHovered = this.hoveredTile;
      this.hoveredTile = null;
      this.context.events.publish('tile.hover.cleared', { tile: previousHovered });
    }
  }

  /**
   * Get currently hovered tile
   */
  getHoveredTile(): TileData | null {
    return this.hoveredTile;
  }

  /**
   * Register a tile action
   */
  registerAction(action: TileAction): void {
    this.tileActions.set(action.id, action);
  }

  /**
   * Execute a tile action
   */
  executeAction(actionId: string, x: number, y: number): boolean {
    const action = this.tileActions.get(actionId);
    if (!action) {
      this.context.logger.warn(`Unknown tile action: ${actionId}`);
      return false;
    }

    const tile = this.getTileAt(x, y);
    if (!tile) {
      this.context.logger.warn(`Invalid tile coordinates: ${x}, ${y}`);
      return false;
    }

    // Validate action if validator exists
    if (action.validate && !action.validate(tile, this.context)) {
      this.context.logger.debug(`Action ${actionId} validation failed for tile at ${x}, ${y}`);
      return false;
    }

    // Execute action if executor exists
    if (action.execute) {
      try {
        action.execute(tile, this.context);
        this.context.events.publish('tile.action.executed', {
          action: actionId,
          tile,
          success: true
        });
        return true;
      } catch (error) {
        this.context.logger.error(`Action ${actionId} execution failed:`, error);
        this.context.events.publish('tile.action.executed', {
          action: actionId,
          tile,
          success: false,
          error
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Get available actions for a tile
   */
  getAvailableActions(x: number, y: number): TileAction[] {
    const tile = this.getTileAt(x, y);
    if (!tile) return [];

    return Array.from(this.tileActions.values()).filter(action => {
      return !action.validate || action.validate(tile, this.context);
    });
  }

  /**
   * Get neighbors of a tile
   */
  getNeighbors(x: number, y: number, includeDiagonals: boolean = false): TileData[] {
    const neighbors: TileData[] = [];

    // Cardinal directions
    const directions = [
      [0, -1], // North
      [1, 0],  // East
      [0, 1],  // South
      [-1, 0]  // West
    ];

    // Diagonal directions
    if (includeDiagonals) {
      directions.push(
        [-1, -1], // Northwest
        [1, -1],  // Northeast
        [1, 1],   // Southeast
        [-1, 1]   // Southwest
      );
    }

    for (const [dx, dy] of directions) {
      if (dx !== undefined && dy !== undefined) {
        const nx = x + dx;
        const ny = y + dy;
        const neighbor = this.getTileAt(nx, ny);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Find all tiles of a specific type
   */
  findTilesByType(type: string): TileData[] {
    const tiles: TileData[] = [];
    
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.getTileAt(x, y);
        if (tile && tile.type === type) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  /**
   * Iterate through all tiles
   */
  forEachTile(callback: (tile: TileData) => void): void {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.getTileAt(x, y);
        if (tile) {
          callback(tile);
        }
      }
    }
  }

  private onMapInitialized(data: any): void {
    if (data.width && data.height) {
      this.setMapSize(data.width, data.height);
    }
  }

  private onMapResized(data: any): void {
    if (data.width && data.height) {
      this.setMapSize(data.width, data.height);
      // Clear selection if it's now out of bounds
      if (this.selectedTile && 
          !this.isInBounds(this.selectedTile.x, this.selectedTile.y)) {
        this.clearSelection();
      }
    }
  }
}
