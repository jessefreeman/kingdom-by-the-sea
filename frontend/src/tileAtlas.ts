// Updated Tile Atlas System for Kingdom by the Sea
// Now uses preloaded individual textures combined into runtime atlas

import { tileAtlasPreloader, type AtlasPosition } from './tileAtlasPreloader';

export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TileAtlas {
  private atlas: HTMLCanvasElement | null = null;
  private loaded = false;

  // Updated tile mapping to use the new system
  private tileMapping: Record<string, string> = {
    'black': 'burnt',
    'water': 'water',
    'coast': 'coast', 
    'grass': 'grass',
    'forest': 'forest',
    'mountain': 'mountain',
    'hill': 'mountain', // Hills use mountain tiles
    'hut': 'building',
    'house': 'building',
    'mansion': 'building',
    'palace': 'building', 
    'castle': 'building',
    'farm': 'farm',
    'mine': 'mountain', // Mines use mountain base + overlay
    'dock': 'coast', // Docks use coast base + overlay
    'town': 'building',
    'burnt': 'burnt',
    'rubble': 'rubble'
  };

  async load(path: string = '/assets/map-tiles.png'): Promise<void> {
    // Use the preloader system instead of direct image loading
    this.atlas = await tileAtlasPreloader.loadAndBuildAtlas();
    this.loaded = true;
  }

  getTilePosition(tileType: string, useLetters: boolean = true, useFog: boolean = false): TilePosition {
    const mappedTile = this.tileMapping[tileType] || 'burnt';
    const position = tileAtlasPreloader.getTilePosition(mappedTile);
    
    if (!position) {
      // Fallback to burnt tile (column 0)
      return { x: 0, y: 0, width: 16, height: 16 };
    }

    return position;
  }

  // Extract a tile as canvas texture (for 2D rendering) with optional fog shading
  getTileCanvas(tileType: string, useLetters: boolean = true, useFog: boolean = false): HTMLCanvasElement | null {
    if (!this.loaded || !this.atlas) return null;

    const mappedTile = this.tileMapping[tileType] || 'burnt';
    let canvas = tileAtlasPreloader.getTileCanvas(mappedTile);
    
    // Apply fog of war shading programmatically
    if (useFog && canvas) {
      canvas = this.applyFogShadingToCanvas(canvas);
    }
    
    return canvas;
  }

  // Apply fog of war shading to a canvas
  private applyFogShadingToCanvas(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d')!;
    
    // Draw the original tile
    ctx.drawImage(sourceCanvas, 0, 0);
    
    // Apply fog overlay - dark semi-transparent overlay
    ctx.fillStyle = 'rgba(10, 13, 26, 0.8)'; // Dark blue-black fog
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return canvas;
  }

  // Create a Three.js texture from a specific tile with optional fog shading
  getThreeTexture(tileType: string, useLetters: boolean = true, useFog: boolean = false): any {
    if (!window.THREE) return null;
    
    const mappedTile = this.tileMapping[tileType] || 'burnt';
    let texture = tileAtlasPreloader.getTileThreeTexture(mappedTile);
    
    // Apply fog of war shading programmatically
    if (useFog && texture) {
      texture = this.applyFogShading(texture);
    }
    
    return texture;
  }

  // Apply fog of war shading to a Three.js texture
  private applyFogShading(texture: any): any {
    if (!window.THREE) return texture;
    
    const THREE = window.THREE;
    
    // Create a darker version of the texture
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    
    // Draw the original texture to canvas
    const img = texture.image || texture.source?.data;
    if (img) {
      ctx.drawImage(img, 0, 0, 16, 16);
      
      // Apply fog overlay - dark semi-transparent overlay
      ctx.fillStyle = 'rgba(10, 13, 26, 0.8)'; // Dark blue-black fog
      ctx.fillRect(0, 0, 16, 16);
      
      // Create new texture from fogged canvas
      const foggedTexture = new THREE.CanvasTexture(canvas);
      foggedTexture.magFilter = THREE.NearestFilter;
      foggedTexture.minFilter = THREE.NearestFilter;
      return foggedTexture;
    }
    
    return texture;
  }

  // Get overlay image for building types, workers, etc.
  getOverlayImage(overlayType: string): HTMLImageElement | null {
    return tileAtlasPreloader.getOverlayImage(overlayType);
  }

  // Get building overlay based on building type
  getBuildingOverlay(buildingType: string): HTMLImageElement | null {
    const overlayType = buildingType.toLowerCase();
    return this.getOverlayImage(overlayType);
  }

  // Helper to get canvas data for direct manipulation with optional fog shading
  getTileImageData(tileType: string, useLetters: boolean = true, useFog: boolean = false): ImageData | null {
    const canvas = this.getTileCanvas(tileType, useLetters, useFog);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getImage(): HTMLCanvasElement | null {
    return this.atlas;
  }

  // Get the full atlas for rendering
  getAtlas(): HTMLCanvasElement | null {
    return this.atlas;
  }

  // Get atlas-wide Three.js texture (for efficient batch rendering)
  getAtlasThreeTexture(): any {
    return tileAtlasPreloader.getThreeTexture();
  }
}

// Global singleton instance
export const tileAtlas = new TileAtlas();
