/**
 * Game State Service - Centralized game state management
 * 
 * This service handles:
 * - Game state initialization and management
 * - Map operations and utilities (idx, inBounds, each)
 * - Canvas and rendering state
 * - Game progression (year, resources, actions)
 * - State persistence and restoration
 * - Grid operations and cell access
 */

import type { Cell, State } from "../contracts/types";
import { rngService } from "./RNGService";
import { GameUtils } from "../utilities/GameUtils";
import { T } from "../constants";

export class GameStateService {
  private static instance: GameStateService;
  
  // Core game state
  private gameState: State;
  
  // Canvas and rendering context
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  
  private constructor() {
    // Initialize default game state
    this.gameState = this.createDefaultState();
  }
  
  static getInstance(): GameStateService {
    if (!GameStateService.instance) {
      GameStateService.instance = new GameStateService();
    }
    return GameStateService.instance;
  }
  
  /**
   * Create a fresh default game state
   */
  private createDefaultState(): State {
    return {
      seed: 0,
      rng: null,
      size: {
        w: 10,
        h: 8,
        t: this.getTileSize()
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
  }
  
  /**
   * Get tile size from CSS custom property
   */
  private getTileSize(): number {
    try {
      return parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--tile"),
        10
      ) || 24;
    } catch {
      return 24; // Fallback for non-browser environments
    }
  }
  
  /**
   * Get the current game state
   */
  getState(): State {
    return this.gameState;
  }
  
  /**
   * Set the entire game state (for loading saves, tests, etc.)
   */
  setState(newState: State): void {
    this.gameState = newState;
  }
  
  /**
   * Update specific state properties
   */
  updateState(updates: Partial<State>): void {
    Object.assign(this.gameState, updates);
  }
  
  /**
   * Reset state to defaults
   */
  resetState(): void {
    this.gameState = this.createDefaultState();
  }
  
  // ===== Map Operations =====
  
  /**
   * Convert x,y coordinates to array index
   */
  idx(x: number, y: number): number {
    return y * this.gameState.size.w + x;
  }
  
  /**
   * Check if coordinates are within map bounds
   */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.gameState.size.w && y < this.gameState.size.h;
  }
  
  /**
   * Iterate over all cells in the map
   */
  each(fn: (x: number, y: number, cell: Cell) => void): void {
    for (let y = 0; y < this.gameState.size.h; y++) {
      for (let x = 0; x < this.gameState.size.w; x++) {
        fn(x, y, this.gameState.map[this.idx(x, y)] as Cell);
      }
    }
  }
  
  /**
   * Get cell at coordinates
   */
  getCell(x: number, y: number): Cell | null {
    if (!this.inBounds(x, y)) return null;
    return this.gameState.map[this.idx(x, y)] as Cell;
  }
  
  /**
   * Set cell at coordinates
   */
  setCell(x: number, y: number, cell: Cell): boolean {
    if (!this.inBounds(x, y)) return false;
    this.gameState.map[this.idx(x, y)] = cell;
    return true;
  }
  
  /**
   * Create a new cell of the specified type
   */
  createCell(type: string): Cell {
    return GameUtils.Cell.createCell(type);
  }
  
  // ===== Canvas and Rendering =====
  
  /**
   * Initialize canvas and rendering context
   */
  initializeCanvas(canvasElement?: HTMLCanvasElement): void {
    if (canvasElement) {
      this.canvas = canvasElement;
    } else {
      // Try to find canvas by ID (for backward compatibility)
      try {
        this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
      } catch {
        // No canvas available (e.g., in tests)
        return;
      }
    }
    
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.resize();
    }
  }
  
  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
  
  /**
   * Get canvas rendering context
   */
  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }
  
  /**
   * Resize canvas to match current map size
   */
  resize(): void {
    if (!this.canvas) return;
    
    this.canvas.width = this.gameState.size.w * this.gameState.size.t;
    this.canvas.height = this.gameState.size.h * this.gameState.size.t;
    
    // Notify external renderer if it exists
    try {
      const RN = (window as any).KBTS_Renderer;
      RN?.onResize?.();
    } catch {
      /* noop */
    }
  }
  
  // ===== Resource Management =====
  
  /**
   * Get current resources
   */
  getResources(): { gold: number; food: number; wood: number; people: number } {
    return {
      gold: this.gameState.gold,
      food: this.gameState.food,
      wood: this.gameState.wood,
      people: this.gameState.people
    };
  }
  
  /**
   * Update resources
   */
  updateResources(updates: Partial<{ gold: number; food: number; wood: number; people: number }>): void {
    if (updates.gold !== undefined) this.gameState.gold = updates.gold;
    if (updates.food !== undefined) this.gameState.food = updates.food;
    if (updates.wood !== undefined) this.gameState.wood = updates.wood;
    if (updates.people !== undefined) this.gameState.people = updates.people;
  }
  
  /**
   * Add resources
   */
  addResources(delta: Partial<{ gold: number; food: number; wood: number; people: number }>): void {
    if (delta.gold) this.gameState.gold += delta.gold;
    if (delta.food) this.gameState.food += delta.food;
    if (delta.wood) this.gameState.wood += delta.wood;
    if (delta.people) this.gameState.people += delta.people;
  }
  
  // ===== Game Progression =====
  
  /**
   * Get current year
   */
  getYear(): number {
    return this.gameState.year;
  }
  
  /**
   * Advance to next year
   */
  nextYear(): void {
    this.gameState.year++;
  }
  
  /**
   * Get remaining actions
   */
  getActions(): number {
    return this.gameState.actions;
  }
  
  /**
   * Set actions
   */
  setActions(actions: number): void {
    this.gameState.actions = actions;
  }
  
  /**
   * Use an action
   */
  useAction(): boolean {
    if (this.gameState.actions > 0) {
      this.gameState.actions--;
      return true;
    }
    return false;
  }
  
  // ===== Selection Management =====
  
  /**
   * Get current selection
   */
  getSelection(): number | null {
    return this.gameState.sel;
  }
  
  /**
   * Set selection by index
   */
  setSelection(index: number | null): void {
    this.gameState.sel = index;
  }
  
  /**
   * Set selection by coordinates
   */
  setSelectionAt(x: number, y: number): void {
    if (this.inBounds(x, y)) {
      this.gameState.sel = this.idx(x, y);
    }
  }
  
  /**
   * Clear selection
   */
  clearSelection(): void {
    this.gameState.sel = null;
  }
  
  // ===== RNG Integration =====
  
  /**
   * Initialize RNG streams and link to state
   */
  initializeRNG(baseSeed: number): void {
    rngService.initializeStreams(baseSeed);
    this.gameState.rng = rngService.getGameplayRng();
    this.gameState.seed = baseSeed;
  }
  
  /**
   * Get random number using state RNG
   */
  random(): number {
    return rngService.rand();
  }
  
  // ===== Map Initialization =====
  
  /**
   * Initialize map with specified dimensions and fill type
   */
  initializeMap(width: number, height: number, fillType: string = T.WATER): void {
    this.gameState.size.w = width;
    this.gameState.size.h = height;
    
    // Create new map filled with specified type
    this.gameState.map = Array(width * height)
      .fill(0)
      .map(() => this.createCell(fillType));
      
    // Resize canvas to match new dimensions
    this.resize();
  }
  
  /**
   * Get debug information about current state
   */
  getDebugInfo(): Record<string, any> {
    return {
      seed: this.gameState.seed,
      size: `${this.gameState.size.w}x${this.gameState.size.h}`,
      year: this.gameState.year,
      resources: this.getResources(),
      actions: this.gameState.actions,
      selection: this.gameState.sel,
      mapSize: this.gameState.map.length,
      fogEnabled: this.gameState.fogEnabled
    };
  }
  
  // ===== Fog of War =====
  
  /**
   * Get fog enabled state
   */
  isFogEnabled(): boolean {
    return this.gameState.fogEnabled ?? true;
  }
  
  /**
   * Set fog enabled state
   */
  setFogEnabled(enabled: boolean): void {
    this.gameState.fogEnabled = enabled;
  }
}

// Export singleton instance for convenience
export const gameStateService = GameStateService.getInstance();
