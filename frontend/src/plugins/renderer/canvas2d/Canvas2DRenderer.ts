// Simple Canvas2D renderer plugin

import type { RendererPlugin, EngineContext } from '../../../engine/contracts/plugins';
import type { GameState } from '../../../engine/contracts/types';

export class Canvas2DRendererPlugin implements RendererPlugin {
  id = 'kbts.renderer.canvas2d.v1';
  version = '1.0.0';
  kind = 'renderer' as const;
  requires = ['state', 'logger'];

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private targetElement: HTMLElement | null = null;
  private context: EngineContext | null = null;
  private tileSize = 32;

  async init(ctx: EngineContext): Promise<void> {
    this.context = ctx;
    ctx.logger.info('Canvas2D renderer plugin initializing...');
    ctx.logger.info('Canvas2D renderer plugin initialized');
  }

  start(ctx: EngineContext): void {
    ctx.logger.info('Canvas2D renderer plugin started');
  }

  async mount(target: HTMLElement): Promise<void> {
    if (!this.context) {
      throw new Error('Canvas2D renderer not initialized');
    }

    this.targetElement = target;

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'canvas2d-renderer';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      image-rendering: pixelated;
    `;

    // Get 2D context
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get 2D canvas context');
    }

    // Clear target and add canvas
    target.innerHTML = '';
    target.appendChild(this.canvas);

    // Set initial size
    this.resize();

    // Subscribe to state changes
    this.context.state.subscribe((state: GameState) => {
      this.draw(state);
    });

    // Initial draw
    const initialState = this.context.state.get() as GameState;
    this.draw(initialState);

    this.context.logger.info('Canvas2D renderer mounted');
  }

  render(ctx: EngineContext, alpha: number): void {
    // Draw on every render frame
    const state = ctx.state.get() as GameState;
    this.draw(state);
  }

  resize(w?: number, h?: number): void {
    if (!this.canvas || !this.targetElement) return;

    const width = w || this.targetElement.clientWidth;
    const height = h || this.targetElement.clientHeight;

    // Set canvas size
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Redraw with new size
    if (this.context) {
      const state = this.context.state.get() as GameState;
      this.draw(state);
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  private draw(state: GameState): void {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.fillStyle = '#061021'; // Dark blue background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate tile size and offset to center the map
    const mapWidth = state.map.width;
    const mapHeight = state.map.height;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Scale to fit the map in the canvas with some padding
    const scaleX = (canvasWidth * 0.8) / mapWidth;
    const scaleY = (canvasHeight * 0.8) / mapHeight;
    const scale = Math.min(scaleX, scaleY);
    
    this.tileSize = Math.max(8, Math.floor(scale));

    // Center the map
    const totalMapWidth = mapWidth * this.tileSize;
    const totalMapHeight = mapHeight * this.tileSize;
    const offsetX = (canvasWidth - totalMapWidth) / 2;
    const offsetY = (canvasHeight - totalMapHeight) / 2;

    // Draw tiles
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const index = y * mapWidth + x;
        const cell = state.map.cells[index];
        
        if (cell) {
          const pixelX = offsetX + x * this.tileSize;
          const pixelY = offsetY + y * this.tileSize;
          
          // Get tile color
          const color = this.getTileColor(cell.type);
          this.ctx.fillStyle = color;
          
          // Draw tile
          this.ctx.fillRect(pixelX, pixelY, this.tileSize, this.tileSize);
          
          // Draw height indicator (simple shadow effect)
          if (cell.h > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            const heightOffset = Math.min(cell.h * 2, this.tileSize / 4);
            this.ctx.fillRect(pixelX + heightOffset, pixelY + heightOffset, this.tileSize, this.tileSize);
            
            // Redraw tile on top
            this.ctx.fillStyle = color;
            this.ctx.fillRect(pixelX, pixelY, this.tileSize, this.tileSize);
          }
          
          // Draw border for visibility
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(pixelX, pixelY, this.tileSize, this.tileSize);
        }
      }
    }

    // Draw UI overlay
    this.drawUI(state);
  }

  private drawUI(state: GameState): void {
    if (!this.ctx) return;

    // Draw resources in top-left corner
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 200, 80);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px monospace';
    
    let y = 30;
    this.ctx.fillText(`Year: ${state.game.year}`, 20, y);
    y += 18;
    this.ctx.fillText(`Gold: ${state.resources.gold}`, 20, y);
    y += 18;
    this.ctx.fillText(`Food: ${state.resources.food}`, 20, y);
    y += 18;
    this.ctx.fillText(`Wood: ${state.resources.wood}`, 20, y);

    // Draw selection indicator
    if (state.game.sel !== null) {
      const mapWidth = state.map.width;
      const selX = state.game.sel % mapWidth;
      const selY = Math.floor(state.game.sel / mapWidth);
      
      const canvasWidth = this.canvas!.width;
      const canvasHeight = this.canvas!.height;
      const totalMapWidth = mapWidth * this.tileSize;
      const totalMapHeight = state.map.height * this.tileSize;
      const offsetX = (canvasWidth - totalMapWidth) / 2;
      const offsetY = (canvasHeight - totalMapHeight) / 2;
      
      const pixelX = offsetX + selX * this.tileSize;
      const pixelY = offsetY + selY * this.tileSize;
      
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pixelX, pixelY, this.tileSize, this.tileSize);
    }

    // Draw tick counter in bottom-right
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.canvas!.width - 120, this.canvas!.height - 40, 110, 30);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`Tick: ${state.tick}`, this.canvas!.width - 110, this.canvas!.height - 20);
  }

  private getTileColor(type: string): string {
    const colors: Record<string, string> = {
      water: '#0c3b66',
      grass: '#2e7d32',
      forest: '#1f5f24',
      hill: '#7c6f4a',
      mountain: '#5f5750',
      farm: '#c68f39',
      mine: '#8a7f78',
      hut: '#9b5d2e',
      house: '#b97a3f',
      mansion: '#d29a5a',
      palace: '#e2b874',
      castle: '#e5d09a',
      burnt: '#3a2d2d',
      rubble: '#4a4a4a',
      dock: '#2563eb',
    };
    return colors[type] || '#888888';
  }

  stop(ctx: EngineContext): void {
    ctx.logger.info('Canvas2D renderer plugin stopped');
  }

  dispose(ctx: EngineContext): void {
    if (this.canvas && this.targetElement) {
      this.targetElement.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.ctx = null;
    this.targetElement = null;
    this.context = null;
    
    ctx.logger.info('Canvas2D renderer plugin disposed');
  }
}
