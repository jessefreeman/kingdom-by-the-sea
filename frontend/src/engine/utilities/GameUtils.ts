// Game Utilities for Kingdom by the Sea
// Extracted from kbts.ts for better modularity

import type { Cell, State } from '../contracts/types';

/**
 * Collection of DOM helper utilities
 */
export class DOMUtils {
  /**
   * Get element by ID with non-null assertion
   */
  static $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  /**
   * Escape HTML characters for safe insertion
   */
  static esc(s: any): string {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Create overlay dialog with content
   */
  static ov(
    html: string,
    hook?: (box: HTMLElement, wrap: HTMLElement) => void
  ): HTMLElement {
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
  }
}

/**
 * Random Number Generation utilities
 */
export class RNGUtils {
  /**
   * Create a seeded RNG using xorshift32 algorithm
   */
  static rng32(initialSeed: number): () => number {
    let seed = initialSeed >>> 0; // Ensure it's a 32-bit unsigned integer
    return () => {
      // xorshift32 algorithm - simple and effective PRNG
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      seed = seed >>> 0; // Keep as 32-bit unsigned
      return seed / 4294967296; // Convert to [0, 1)
    };
  }
}

/**
 * Grid/Map coordinate utilities
 */
export class GridUtils {
  /**
   * Convert 2D coordinates to 1D array index
   */
  static idx(x: number, y: number, width: number): number {
    return y * width + x;
  }

  /**
   * Check if coordinates are within bounds
   */
  static inBounds(x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && y >= 0 && x < width && y < height;
  }

  /**
   * Iterate over all grid positions
   */
  static each(
    width: number, 
    height: number, 
    map: Cell[], 
    fn: (x: number, y: number, cell: Cell) => void
  ): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        fn(x, y, map[GridUtils.idx(x, y, width)] as Cell);
      }
    }
  }
}

/**
 * Cell creation and manipulation utilities
 */
export class CellUtils {
  /**
   * Create a new cell with default properties
   */
  static createCell(type: string): Cell {
    return {
      type: type as any,
      disc: false,
      upg: null,
      wrk: 0,
      fx: 0,
      h: 0,
    };
  }

  /**
   * Get the render type of a cell (considering upgrades)
   */
  static renderType(cell: any): string | null {
    return cell ? (cell.upg ? cell.upg.to : cell.type) : null;
  }

  /**
   * Check if there's a house nearby (within 1 tile)
   */
  static houseNearby(
    x: number, 
    y: number, 
    map: Cell[], 
    width: number, 
    height: number,
    houselineTypes: readonly string[]
  ): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!GridUtils.inBounds(nx, ny, width, height)) continue;
        const t = CellUtils.renderType(map[GridUtils.idx(nx, ny, width)]);
        if (t && houselineTypes.includes(t)) return true;
      }
    }
    return false;
  }

  /**
   * Check if there's no house nearby (inverse of houseNearby)
   */
  static noHouseNearby(
    x: number, 
    y: number, 
    map: Cell[], 
    width: number, 
    height: number,
    houselineTypes: readonly string[]
  ): boolean {
    return !CellUtils.houseNearby(x, y, map, width, height, houselineTypes);
  }
}

/**
 * Debug and development utilities
 */
export class DebugUtils {
  /**
   * Get single-letter label for a tile type
   */
  static getLabel(type: string | null, labelMap: Record<string, string>): string {
    if (!type) return "?";
    const lbl = labelMap[type];
    if (lbl && lbl.length === 1) return lbl;
    if (type === "water") return "W";
    const first = lbl ? lbl[0] : type && type.length ? type[0] : "?";
    return String(first).toUpperCase();
  }

  /**
   * Generate markdown table dump of the game map
   */
  static debugDump(
    state: State, 
    labelMap: Record<string, string>
  ): string {
    const W = state.size.w, H = state.size.h;
    
    const letterOf = (t: string | null): string => DebugUtils.getLabel(t, labelMap);
    
    const header = [" ", ...Array.from({ length: W }, (_, i) => String(i))].join(" | ");
    const sep = Array(W + 1).fill("---").join(" | ");
    const lines: string[] = [];
    lines.push(`| ${header} |`);
    lines.push(`| ${sep} |`);
    
    for (let y = 0; y < H; y++) {
      const row = [String(y)];
      for (let x = 0; x < W; x++) {
        const c = state.map[GridUtils.idx(x, y, W)] as any;
        const t = CellUtils.renderType(c);
        const h = (c && typeof c.h === "number") ? c.h : 0;
        const discovered = c && c.disc;
        const letter = letterOf(t);
        const cellContent = discovered ? `${letter}${h}` : "??";
        row.push(cellContent);
      }
      lines.push(`| ${row.join(" | ")} |`);
    }
    
    return lines.join("\n");
  }

  /**
   * Get display label for a cell (used in UI)
   */
  static cellLabel(cell: any, labelMap: Record<string, string>): string {
    const t = CellUtils.renderType(cell);
    return t ? (labelMap[t] || t.charAt(0).toUpperCase()) : "";
  }
}

/**
 * Main utilities collection - provides unified access to all utility classes
 */
export class GameUtils {
  static DOM = DOMUtils;
  static RNG = RNGUtils;
  static Grid = GridUtils;
  static Cell = CellUtils;
  static Debug = DebugUtils;
}
