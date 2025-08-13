// Tile Atlas System for Kingdom by the Sea
// Handles loading and managing the 128x128 PNG tile atlas with 16x16 tiles

export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Tile atlas layout: 8x8 grid of 16x16 tiles
// Row 0: Solid colors (for debugging)
// Row 1: Letters on colors (for development)
// Row 2: Final tile graphics with fog overlay
export class TileAtlas {
  private image: HTMLImageElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private loaded = false;

  // Tile mapping based on your description:
  // Column 0: Black, 1: Deep water (D), 2: Coastal water (W), 3: Grass (G)
  // Column 4: Trees/Forest (T), 5: Mountains (M), 6: Buildings/Houses (H), 7: Farm (F)
  private tileMapping: Record<string, { col: number; hasLetter: boolean }> = {
    'black': { col: 0, hasLetter: false },
    'water': { col: 1, hasLetter: true }, // Deep water with 'D'
    'coast': { col: 2, hasLetter: true }, // Coastal water with 'W'
    'grass': { col: 3, hasLetter: true }, // Grass with 'G'
    'forest': { col: 4, hasLetter: true }, // Trees with 'T'
    'mountain': { col: 5, hasLetter: true }, // Mountains with 'M'
    'hill': { col: 5, hasLetter: true }, // Hills use mountain tiles with 'M'
    'hut': { col: 6, hasLetter: true }, // Buildings with 'H'
    'house': { col: 6, hasLetter: true },
    'mansion': { col: 6, hasLetter: true },
    'palace': { col: 6, hasLetter: true },
    'castle': { col: 6, hasLetter: true },
    'farm': { col: 7, hasLetter: true }, // Farm with 'F'
    'mine': { col: 5, hasLetter: true }, // Mines use mountain tiles
    'dock': { col: 2, hasLetter: true }, // Docks use coastal water with 'D'
    'town': { col: 6, hasLetter: true }, // Towns use building tiles
    'burnt': { col: 0, hasLetter: false }, // Black tiles
    'rubble': { col: 0, hasLetter: false } // Black tiles
  };

  async load(path: string = '/assets/map-tiles.png'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.image = new Image();
      this.image.onload = () => {
        this.loaded = true;
        this.setupCanvas();
        resolve();
      };
      this.image.onerror = () => {
        reject(new Error(`Failed to load tile atlas: ${path}`));
      };
      this.image.src = path;
    });
  }

  private setupCanvas(): void {
    // Create a working canvas for tile extraction
    this.canvas = document.createElement('canvas');
    this.canvas.width = 16;
    this.canvas.height = 16;
    this.ctx = this.canvas.getContext('2d');
  }

  getTilePosition(tileType: string, useLetters: boolean = true, useFog: boolean = false): TilePosition {
    const mapping = this.tileMapping[tileType] || this.tileMapping['black']!;
    const col = mapping.col;
    
    // Determine row based on mode
    let row = 0; // Default to solid colors
    if (useFog) {
      row = 2; // Fog layer
    } else if (useLetters && mapping.hasLetter) {
      row = 1; // Letter layer
    }

    return {
      x: col * 16,
      y: row * 16,
      width: 16,
      height: 16
    };
  }

  // Extract a tile as canvas texture (for 2D rendering)
  getTileCanvas(tileType: string, useLetters: boolean = true, useFog: boolean = false): HTMLCanvasElement | null {
    if (!this.loaded || !this.image || !this.canvas || !this.ctx) return null;

    const pos = this.getTilePosition(tileType, useLetters, useFog);
    
    // Clear the working canvas
    this.ctx.clearRect(0, 0, 16, 16);
    
    // Draw the tile from the atlas
    this.ctx.drawImage(
      this.image,
      pos.x, pos.y, pos.width, pos.height, // Source
      0, 0, 16, 16 // Destination
    );

    // Return a copy of the canvas
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = 16;
    resultCanvas.height = 16;
    const resultCtx = resultCanvas.getContext('2d')!;
    resultCtx.drawImage(this.canvas, 0, 0);
    
    return resultCanvas;
  }

  // Create a Three.js texture from a tile
  getThreeTexture(tileType: string, useLetters: boolean = true, useFog: boolean = false): any {
    if (!window.THREE) return null;
    
    const canvas = this.getTileCanvas(tileType, useLetters, useFog);
    if (!canvas) return null;

    const texture = new (window.THREE as any).CanvasTexture(canvas);
    texture.magFilter = (window.THREE as any).NearestFilter; // Pixel art style
    texture.minFilter = (window.THREE as any).NearestFilter;
    return texture;
  }

  // Helper to get canvas data for direct manipulation
  getTileImageData(tileType: string, useLetters: boolean = true, useFog: boolean = false): ImageData | null {
    if (!this.loaded || !this.image || !this.canvas || !this.ctx) return null;

    const pos = this.getTilePosition(tileType, useLetters, useFog);
    
    // Clear and draw tile
    this.ctx.clearRect(0, 0, 16, 16);
    this.ctx.drawImage(
      this.image,
      pos.x, pos.y, pos.width, pos.height,
      0, 0, 16, 16
    );

    return this.ctx.getImageData(0, 0, 16, 16);
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getImage(): HTMLImageElement | null {
    return this.image;
  }
}

// Global singleton instance
export const tileAtlas = new TileAtlas();
