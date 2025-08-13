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

  // Debug method to display the generated atlas
  showAtlasDebug(scale: number = 4): void {
    if (!this.atlas) {
      console.warn('Atlas not loaded yet');
      return;
    }

    // Remove existing debug atlas if present
    const existingDebug = document.getElementById('atlas-debug');
    if (existingDebug) {
      existingDebug.remove();
    }

    // Create debug overlay
    const debugDiv = document.createElement('div');
    debugDiv.id = 'atlas-debug';
    debugDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.8);
      padding: 10px;
      border-radius: 5px;
      color: white;
      font-family: monospace;
      font-size: 12px;
    `;

    // Create title
    const title = document.createElement('div');
    title.textContent = 'Generated Tile Atlas';
    title.style.marginBottom = '5px';
    debugDiv.appendChild(title);

    // Create scaled canvas display
    const displayCanvas = document.createElement('canvas');
    const atlasSize = this.config?.metadata.atlasSize || 128;
    displayCanvas.width = atlasSize * scale;
    displayCanvas.height = atlasSize * scale;
    displayCanvas.style.cssText = `
      border: 1px solid #fff;
      image-rendering: pixelated;
      image-rendering: -moz-crisp-edges;
      image-rendering: crisp-edges;
    `;

    const displayCtx = displayCanvas.getContext('2d')!;
    displayCtx.imageSmoothingEnabled = false;
    displayCtx.drawImage(this.atlas, 0, 0, atlasSize * scale, atlasSize * scale);

    debugDiv.appendChild(displayCanvas);

    // Add tile info
    const info = document.createElement('div');
    info.style.marginTop = '5px';
    info.innerHTML = `
      <div>Size: ${atlasSize}x${atlasSize}</div>
      <div>Tiles: ${this.tileMap.size}</div>
      <div>Overlays: ${this.overlayMap.size}</div>
      <div>Scale: ${scale}x</div>
      <div style="margin-top: 5px; font-size: 10px;">
        Click to close
      </div>
    `;
    debugDiv.appendChild(info);

    // Add close functionality
    debugDiv.addEventListener('click', () => {
      debugDiv.remove();
    });

    document.body.appendChild(debugDiv);
    console.log('Atlas debug display shown. Click to close.');
  }

  // Console method to log atlas information
  logAtlasInfo(): void {
    if (!this.config || !this.atlas) {
      console.warn('Atlas not loaded yet');
      return;
    }

    console.log('=== Tile Atlas Debug Info ===');
    console.log('Config:', this.config.metadata);
    console.log('Atlas canvas:', this.atlas);
    console.log('Tile mappings:');
    this.tileMap.forEach((position, key) => {
      console.log(`  ${key}:`, position);
    });
    console.log('Loaded overlays:', Array.from(this.overlayMap.keys()));
    console.log('Source images:', Array.from(this.sourceImages.keys()));
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
