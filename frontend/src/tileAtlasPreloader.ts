// Tile Atlas Preloader System for Kingdom by the Sea
// Loads individual textures and builds runtime atlas for optimal performance

export interface TileConfig {
  uid: string;
  path: string;
  atlasColumn: number;
  atlasRow?: number;
  tileType: 'terrain' | 'structure' | 'destroyed' | 'overlay' | 'effect';
  description: string;
}

export interface TileConfigFile {
  metadata: {
    version: string;
    atlasSize: number;
    tileSize: number;
    columns: number;
    rows: number;
    description: string;
  };
  tiles: Record<string, TileConfig>;
  overlays: Record<string, TileConfig>;
  effects: Record<string, TileConfig>;
}

export interface AtlasPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TileAtlasPreloader {
  private config: TileConfigFile | null = null;
  private atlas: HTMLCanvasElement | null = null;
  private tileMap: Map<string, AtlasPosition> = new Map();
  private overlayMap: Map<string, HTMLImageElement> = new Map();
  private sourceImages: Map<string, HTMLImageElement> = new Map();
  private loaded = false;

  async loadConfig(configPath: string = '/assets/tiles/tile-config.json'): Promise<TileConfigFile> {
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(`Failed to load tile config: ${response.statusText}`);
    }
    this.config = await response.json();
    if (!this.config) {
      throw new Error('Invalid tile configuration file');
    }
    return this.config;
  }

  private async loadImage(path: string): Promise<HTMLImageElement> {
    // Check if we already loaded this image
    if (this.sourceImages.has(path)) {
      return this.sourceImages.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sourceImages.set(path, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
      img.src = path;
    });
  }

  async loadAndBuildAtlas(configPath?: string): Promise<HTMLCanvasElement> {
    // Load configuration
    await this.loadConfig(configPath);
    if (!this.config) throw new Error('Failed to load tile configuration');

    const { metadata, tiles, overlays, effects } = this.config;
    const { atlasSize, tileSize } = metadata;

    // Create atlas canvas
    this.atlas = document.createElement('canvas');
    this.atlas.width = atlasSize;
    this.atlas.height = atlasSize;
    const ctx = this.atlas.getContext('2d')!;

    // Load all unique source images first
    const uniquePaths = new Set<string>();
    Object.values(tiles).forEach(tile => uniquePaths.add(tile.path));
    
    await Promise.all(
      Array.from(uniquePaths).map(path => this.loadImage(path))
    );

    // Build atlas from tiles
    Object.entries(tiles).forEach(([key, config]) => {
      const sourceImage = this.sourceImages.get(config.path)!;
      
      // Calculate source position in the source image
      const sourceX = config.atlasColumn * tileSize;
      const sourceY = (config.atlasRow || 0) * tileSize;
      
      // For now, use the same position in the output atlas
      // Later we can rearrange tiles as needed
      const destX = config.atlasColumn * tileSize;
      const destY = (config.atlasRow || 0) * tileSize;
      
      // Draw tile from source to atlas
      ctx.drawImage(
        sourceImage,
        sourceX, sourceY, tileSize, tileSize, // source rect
        destX, destY, tileSize, tileSize       // dest rect
      );
      
      // Store position mapping
      this.tileMap.set(key, {
        x: destX,
        y: destY, 
        width: tileSize,
        height: tileSize
      });
    });

    // Load overlay images separately (for future use)
    // For now, most overlays don't exist as separate files
    const overlayEntries = Object.entries(overlays).filter(([key, config]) => {
      // Only try to load overlays that don't reference the main texture
      return !config.path.includes('map-tiles.png');
    });

    await Promise.all(
      overlayEntries.map(async ([key, config]) => {
        try {
          const image = await this.loadImage(config.path);
          this.overlayMap.set(key, image);
        } catch (error) {
          // Overlay doesn't exist yet, that's ok
          console.log(`Overlay ${key} not found, will use base tile: ${error}`);
        }
      })
    );

    this.loaded = true;
    console.log(`Tile atlas loaded: ${this.tileMap.size} tiles, ${this.overlayMap.size} overlays`);
    return this.atlas;
  }

  getTilePosition(tileKey: string): AtlasPosition | null {
    return this.tileMap.get(tileKey) || null;
  }

  getOverlayImage(overlayKey: string): HTMLImageElement | null {
    return this.overlayMap.get(overlayKey) || null;
  }

  getAtlas(): HTMLCanvasElement | null {
    return this.atlas;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getTileKeys(): string[] {
    return Array.from(this.tileMap.keys());
  }

  getOverlayKeys(): string[] {
    return Array.from(this.overlayMap.keys());
  }

  getConfig(): TileConfigFile | null {
    return this.config;
  }

  // Create a Three.js texture from the atlas
  getThreeTexture(): any {
    if (!window.THREE || !this.atlas) return null;
    
    const texture = new (window.THREE as any).CanvasTexture(this.atlas);
    texture.magFilter = (window.THREE as any).NearestFilter;
    texture.minFilter = (window.THREE as any).NearestFilter;
    return texture;
  }

  // Get tile canvas for 2D rendering
  getTileCanvas(tileKey: string): HTMLCanvasElement | null {
    if (!this.atlas) return null;
    
    const position = this.getTilePosition(tileKey);
    if (!position) return null;

    const canvas = document.createElement('canvas');
    canvas.width = position.width;
    canvas.height = position.height;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
      this.atlas,
      position.x, position.y, position.width, position.height,
      0, 0, position.width, position.height
    );

    return canvas;
  }

  // Get Three.js texture for a specific tile
  getTileThreeTexture(tileKey: string): any {
    if (!window.THREE) return null;
    
    const canvas = this.getTileCanvas(tileKey);
    if (!canvas) return null;

    const texture = new (window.THREE as any).CanvasTexture(canvas);
    texture.magFilter = (window.THREE as any).NearestFilter;
    texture.minFilter = (window.THREE as any).NearestFilter;
    return texture;
  }
}

// Global singleton instance
export const tileAtlasPreloader = new TileAtlasPreloader();
