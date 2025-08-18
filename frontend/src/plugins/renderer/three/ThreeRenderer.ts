// Three.js renderer as an engine plugin

import type { RendererPlugin, EngineContext } from '../../../engine/contracts/plugins';
import type { GameState } from '../../../engine/contracts/types';

// Import the existing Three.js renderer dependencies
import { tileAtlas } from '../../../engine/services/tileAtlas';
import { getCoastOverlaysAt } from '../../../engine/utilities/autotile';

// Re-declare the existing ThreeRenderer interface from the legacy code
interface LegacyThreeRenderer {
  init(): Promise<void>;
  draw(): void;
  resize(): void;
  destroy(): void;
  inited: boolean;
}

declare global {
  interface Window {
    THREE: any;
    KBTS: any; // Legacy global game state
  }
}

export class ThreeRendererPlugin implements RendererPlugin {
  id = 'kbts.renderer.three.v1';
  version = '1.0.0';
  kind = 'renderer' as const;
  requires = ['state', 'logger'];

  private legacyRenderer: LegacyThreeRenderer | null = null;
  private targetElement: HTMLElement | null = null;
  private context: EngineContext | null = null;
  private isInitialized = false;

  async init(ctx: EngineContext): Promise<void> {
    this.context = ctx;
    ctx.logger.info('ThreeJS renderer plugin initializing...');

    // Create the legacy renderer instance
    this.legacyRenderer = new ThreeRendererImpl();
    
    ctx.logger.info('ThreeJS renderer plugin initialized');
  }

  start(ctx: EngineContext): void {
    ctx.logger.info('ThreeJS renderer plugin started');
  }

  async mount(target: HTMLElement): Promise<void> {
    if (!this.legacyRenderer || !this.context) {
      throw new Error('ThreeJS renderer not initialized');
    }

    this.targetElement = target;
    
    // Ensure the target has the expected container structure
    let threeContainer = target.querySelector('#threeContainer') as HTMLElement;
    if (!threeContainer) {
      threeContainer = document.createElement('div');
      threeContainer.id = 'threeContainer';
      threeContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      `;
      target.appendChild(threeContainer);
    }

    try {
      // Initialize the legacy renderer
      await this.legacyRenderer.init();
      this.isInitialized = true;
      
      this.context.logger.info('ThreeJS renderer mounted and initialized');

      // Subscribe to state changes to trigger redraws
      this.context.state.subscribe((state: GameState) => {
        if (this.isInitialized && this.legacyRenderer) {
          this.legacyRenderer.draw();
        }
      });

    } catch (error) {
      this.context.logger.error('Failed to mount ThreeJS renderer:', error);
      throw error;
    }
  }

  render(ctx: EngineContext, alpha: number): void {
    // The legacy renderer handles its own render loop, so we don't need to do anything here
    // In a more sophisticated implementation, we'd sync with the engine's render loop
  }

  resize(w?: number, h?: number): void {
    if (this.legacyRenderer && this.isInitialized) {
      this.legacyRenderer.resize();
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    const container = document.getElementById('threeContainer');
    if (container) {
      return container.querySelector('canvas');
    }
    return null;
  }

  stop(ctx: EngineContext): void {
    ctx.logger.info('ThreeJS renderer plugin stopped');
  }

  dispose(ctx: EngineContext): void {
    if (this.legacyRenderer && this.isInitialized) {
      this.legacyRenderer.destroy();
    }
    this.legacyRenderer = null;
    this.targetElement = null;
    this.context = null;
    this.isInitialized = false;
    
    ctx.logger.info('ThreeJS renderer plugin disposed');
  }
}

// Legacy ThreeRenderer implementation (extracted and cleaned up from existing code)
class ThreeRendererImpl implements LegacyThreeRenderer {
  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private tileMeshes: any[] = [];
  private waterPlane: any = null;
  private container: HTMLElement | null = null;
  private controls: any = null;
  private isDragging: boolean = false;
  private isRotating: boolean = false;
  private lastMousePosition = { x: 0, y: 0 };
  private mouseDownTime = 0;
  private mouseDownPosition = { x: 0, y: 0 };
  private cameraTarget = { x: 0, y: 0, z: 0 };
  private cameraDistance = 25;
  private cameraAngleX = 0.520; // Fixed at 29.8°
  private cameraAngleY = 0.84; // 48.1° - isometric rotation
  private animationFrameId: number | null = null;
  private needsRender = false;
  private debugMode = false;
  private debugElement: HTMLElement | null = null;
  public inited = false;
  private static readonly HEIGHT_PER_LEVEL = 0.5;
  
  // Animation system
  private isAnimating = false;
  private animationStartTime = 0;
  private animationDuration = 2000;
  private activeTweens: Array<{
    mesh: any;
    startY: number;
    targetY: number;
    startTime: number;
    duration: number;
    completed: boolean;
    sideFaces: any[];
    x: number;
    y: number;
    targetHeight: number;
  }> = [];

  async init() {
    const K = (window as any).KBTS;
    if (!K) return;

    try {
      // Load Three.js from CDN if not already loaded
      if (!window.THREE) {
        await this.loadThreeJS();
      }

      // Load tile atlas
      await tileAtlas.load();

      const THREE = window.THREE;

      // Use dedicated container for Three.js
      this.container = document.getElementById("threeContainer");
      if (!this.container) return;

      // Scene setup
      this.scene = new THREE.Scene();

      // Create tiled deep water background
      if (tileAtlas.isLoaded()) {
        this.createTiledBackground();
      } else {
        this.scene.background = new THREE.Color("#061021");
      }

      // Use full container dimensions
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;

      // Camera setup - perspective for natural depth perception
      const aspect = containerWidth / containerHeight;
      const fov = 60;
      this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);

      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(containerWidth, containerHeight);
      this.renderer.domElement.style.width = "100%";
      this.renderer.domElement.style.height = "100%";
      this.renderer.domElement.style.display = "block";

      // Clear container and add renderer
      this.container.innerHTML = "";
      this.container.appendChild(this.renderer.domElement);

      // Add visualization helpers
      this.addVisualizationHelpers();

      // Add event listeners
      this.setupEventListeners();

      // Set initial camera position
      this.updateCameraPosition();

      // Create debug overlay
      this.createDebugOverlay();

      // Start the render loop
      this.startRenderLoop();

      this.inited = true;
      this.createTiles();
      this.centerCameraOnMap();
    } catch (error) {
      console.error("Failed to initialize Three.js renderer:", error);
    }
  }

  private async loadThreeJS(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/three@0.152.0/build/three.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Three.js"));
      document.head.appendChild(script);
    });
  }

  private createTiledBackground() {
    // Implementation for tiled background (simplified for now)
    const THREE = window.THREE;
    this.scene.background = new THREE.Color("#061021");
  }

  private addVisualizationHelpers() {
    // Add any visualization helpers (grid, axes, etc.)
  }

  private setupEventListeners() {
    if (!this.renderer) return;

    this.renderer.domElement.addEventListener("click", (e: MouseEvent) => {
      this.handleClick(e);
    });

    this.renderer.domElement.addEventListener("mousedown", (e: MouseEvent) => {
      this.handleMouseDown(e);
    });

    this.renderer.domElement.addEventListener("mousemove", (e: MouseEvent) => {
      this.handleMouseMove(e);
    });

    this.renderer.domElement.addEventListener("mouseup", (e: MouseEvent) => {
      this.handleMouseUp(e);
    });

    this.renderer.domElement.addEventListener("wheel", (e: WheelEvent) => {
      this.handleWheel(e);
    });

    this.renderer.domElement.addEventListener("contextmenu", (e: Event) => {
      e.preventDefault();
    });

    this.renderer.domElement.addEventListener("mouseleave", () => {
      this.isRotating = false;
      this.isDragging = false;
      this.renderer.domElement.style.cursor = "default";
    });

    document.addEventListener("keydown", (e: KeyboardEvent) => {
      this.handleKeyboard(e);
    });
  }

  private handleClick(e: MouseEvent) {
    // Basic click handling (simplified)
    console.log('Three.js renderer: Click at', e.clientX, e.clientY);
  }

  private handleMouseDown(e: MouseEvent) {
    this.mouseDownTime = Date.now();
    this.mouseDownPosition = { x: e.clientX, y: e.clientY };
    
    if (e.button === 2) { // Right click
      this.isRotating = true;
      this.renderer.domElement.style.cursor = "grab";
    } else if (e.button === 1) { // Middle click
      this.isDragging = true;
      this.renderer.domElement.style.cursor = "move";
    }
    
    this.lastMousePosition = { x: e.clientX, y: e.clientY };
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isRotating && !this.isDragging) return;

    const deltaX = e.clientX - this.lastMousePosition.x;
    const deltaY = e.clientY - this.lastMousePosition.y;

    if (this.isRotating) {
      this.cameraAngleY += deltaX * 0.01;
      this.updateCameraPosition();
      this.needsRender = true;
    }

    if (this.isDragging) {
      // Pan camera target
      const factor = 0.01;
      this.cameraTarget.x -= deltaX * factor;
      this.cameraTarget.z += deltaY * factor;
      this.updateCameraPosition();
      this.needsRender = true;
    }

    this.lastMousePosition = { x: e.clientX, y: e.clientY };
  }

  private handleMouseUp(e: MouseEvent) {
    this.isRotating = false;
    this.isDragging = false;
    this.renderer.domElement.style.cursor = "default";
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomSpeed = 0.001;
    this.cameraDistance += e.deltaY * zoomSpeed;
    this.cameraDistance = Math.max(5, Math.min(50, this.cameraDistance));
    this.updateCameraPosition();
    this.needsRender = true;
  }

  private handleKeyboard(e: KeyboardEvent) {
    switch (e.key.toLowerCase()) {
      case 'd':
        this.debugMode = !this.debugMode;
        this.updateDebugOverlay();
        break;
      case 'r':
        this.resetCamera();
        break;
      case 'c':
        this.centerCameraOnMap();
        break;
    }
  }

  private updateCameraPosition() {
    if (!this.camera) return;

    const x = this.cameraTarget.x + Math.cos(this.cameraAngleY) * this.cameraDistance;
    const z = this.cameraTarget.z + Math.sin(this.cameraAngleY) * this.cameraDistance;
    const y = this.cameraTarget.y + Math.sin(this.cameraAngleX) * this.cameraDistance;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);
  }

  private resetCamera() {
    this.cameraAngleX = 0.520;
    this.cameraAngleY = 0.84;
    this.cameraDistance = 25;
    this.cameraTarget = { x: 0, y: 0, z: 0 };
    this.updateCameraPosition();
    this.needsRender = true;
  }

  private centerCameraOnMap() {
    const K = (window as any).KBTS;
    if (!K) return;

    const mapCenterX = K.size.w / 2;
    const mapCenterZ = K.size.h / 2;
    this.cameraTarget = { x: mapCenterX, y: 0, z: mapCenterZ };
    this.updateCameraPosition();
    this.needsRender = true;
  }

  private createDebugOverlay() {
    // Create debug overlay (simplified)
    this.updateDebugOverlay();
  }

  private updateDebugOverlay() {
    if (this.debugMode && !this.debugElement) {
      this.debugElement = document.createElement('div');
      this.debugElement.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
      `;
      document.body.appendChild(this.debugElement);
    } else if (!this.debugMode && this.debugElement) {
      this.debugElement.remove();
      this.debugElement = null;
    }

    if (this.debugElement) {
      this.debugElement.innerHTML = `
        <div>Camera Distance: ${this.cameraDistance.toFixed(2)}</div>
        <div>Camera Angle Y: ${(this.cameraAngleY * 180 / Math.PI).toFixed(1)}°</div>
        <div>Camera Target: ${this.cameraTarget.x.toFixed(1)}, ${this.cameraTarget.y.toFixed(1)}, ${this.cameraTarget.z.toFixed(1)}</div>
      `;
    }
  }

  private startRenderLoop() {
    if (this.animationFrameId) return;

    const renderLoop = () => {
      if (!this.inited) return;

      if (this.needsRender) {
        this.renderFrame();
        this.needsRender = false;
      }

      this.animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  private stopRenderLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private renderFrame() {
    if (!this.scene || !this.camera || !this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  private createTiles() {
    const K = (window as any).KBTS;
    if (!K || !this.scene) return;

    // Clear existing tiles
    this.tileMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.tileMeshes = [];

    // Create new tiles based on current state
    // This is a simplified version - the full implementation would handle
    // all the tile types, heights, animations, etc.
    const THREE = window.THREE;
    
    for (let y = 0; y < K.size.h; y++) {
      for (let x = 0; x < K.size.w; x++) {
        const cell = K.map[y * K.size.w + x];
        if (!cell) continue;

        // Create a simple colored cube for each tile
        const geometry = new THREE.BoxGeometry(1, 0.1, 1);
        const material = new THREE.MeshBasicMaterial({ 
          color: this.getTileColor(cell.type) 
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(x, cell.h * ThreeRendererImpl.HEIGHT_PER_LEVEL, y);
        
        this.scene.add(mesh);
        this.tileMeshes.push(mesh);
      }
    }

    this.needsRender = true;
  }

  private getTileColor(type: string): number {
    const colors: Record<string, number> = {
      water: 0x0c3b66,
      grass: 0x2e7d32,
      forest: 0x1f5f24,
      hill: 0x7c6f4a,
      mountain: 0x5f5750,
      farm: 0xc68f39,
      mine: 0x8a7f78,
      hut: 0x9b5d2e,
      house: 0xb97a3f,
      mansion: 0xd29a5a,
      palace: 0xe2b874,
      castle: 0xe5d09a,
      burnt: 0x3a2d2d,
      rubble: 0x4a4a4a,
      dock: 0x2563eb,
    };
    return colors[type] || 0x888888;
  }

  draw() {
    if (!this.inited || !this.scene || !this.camera || !this.renderer) return;
    this.createTiles();
    this.needsRender = true;
  }

  resize() {
    if (!this.inited || !this.camera || !this.renderer || !this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.needsRender = true;
  }

  destroy() {
    this.stopRenderLoop();

    if (this.debugElement) {
      this.debugElement.remove();
      this.debugElement = null;
    }

    this.tileMeshes.forEach(mesh => {
      if (this.scene) this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.tileMeshes = [];

    if (this.waterPlane && this.scene) {
      this.scene.remove(this.waterPlane);
      if (this.waterPlane.geometry) this.waterPlane.geometry.dispose();
      if (this.waterPlane.material) this.waterPlane.material.dispose();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.container = null;
    this.inited = false;
  }
}
