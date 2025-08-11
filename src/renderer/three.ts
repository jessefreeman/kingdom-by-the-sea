// Three.js 3D renderer for Kingdom by the Sea
// Uses CDN imports to avoid build dependencies

// Declare global THREE from CDN
declare global {
  interface Window {
    THREE: any;
  }
}

interface RendererInterface {
  init(): Promise<void>;
  draw(): void;
  resize(): void;
  destroy(): void;
}

class ThreeRenderer implements RendererInterface {
  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private tileMeshes: any[] = [];
  private container: HTMLElement | null = null;
  private controls: any = null;
  public inited = false;

  async init() {
    const K = (window as any).KBTS;
    if (!K) return;

    try {
      // Load Three.js from CDN if not already loaded
      if (!window.THREE) {
        await this.loadThreeJS();
      }

      const THREE = window.THREE;

      // Use dedicated container for Three.js
      this.container = document.getElementById('threeContainer');
      if (!this.container) return;

      // Scene setup
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#061021');

      // Use full container dimensions
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;
      
      // Camera setup - orthographic for flat view
      const aspect = containerWidth / containerHeight;
      const size = 10;
      this.camera = new THREE.OrthographicCamera(
        -size * aspect, size * aspect,
        size, -size,
        0.1, 100
      );
      this.camera.position.set(5, 5, 10);
      this.camera.lookAt(0, 0, 0);

      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(containerWidth, containerHeight);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';

      // Clear container and add renderer
      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);

      // Add click handling to Three.js canvas
      this.renderer.domElement.addEventListener('click', (e: MouseEvent) => {
        this.handleClick(e);
      });

      // Load orbit controls (optional - don't fail if it doesn't load)
      try {
        await this.loadOrbitControls();
        if (window.THREE.OrbitControls) {
          this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
          this.controls.enableDamping = true;
          this.controls.dampingFactor = 0.05;
          this.controls.enableZoom = true;
          this.controls.enableRotate = true;
          this.controls.enablePan = true;
        }
      } catch (error) {
        console.warn('OrbitControls not available, proceeding without controls:', error);
      }

      this.inited = true;
      this.createTiles();
    } catch (error) {
      console.error('Failed to initialize Three.js renderer:', error);
    }
  }

  private async loadThreeJS(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/three@0.152.0/build/three.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Three.js'));
      document.head.appendChild(script);
    });
  }

  private async loadOrbitControls(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if OrbitControls is already available
      if (window.THREE && window.THREE.OrbitControls) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://threejs.org/examples/js/controls/OrbitControls.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OrbitControls'));
      document.head.appendChild(script);
    });
  }

  private createTileTexture(tileType: string, isCoast = false, isDiscovered = true, isSelected = false, label = '', hasSynergy = false): any {
    const K = (window as any).KBTS;
    const { T, C, LABEL } = K;
    const THREE = window.THREE;
    
    const canvas = document.createElement('canvas');
    const size = 64; // Higher res than the original 24px
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Fill base color
    let fillColor = '#333';
    if (tileType === T.WATER) {
      fillColor = isCoast ? (C.coast || '#155d96') : (C[T.WATER] || '#0c3b66');
    } else {
      fillColor = C[tileType] || '#333';
    }
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, size, size);

    // Fog overlay for undiscovered tiles
    if (!isDiscovered) {
      ctx.fillStyle = C.fog || '#0a0d1a';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
    }

    // Selection border
    if (isSelected) {
      ctx.strokeStyle = '#7bdff6';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, size - 4, size - 4);
    }

    // Label
    if (label && isDiscovered) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = `bold ${Math.floor(size * 0.3)}px ui-monospace, Menlo`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, size / 2, size / 2);
      ctx.restore();
    }

    // Farm synergy indicator
    if (hasSynergy && isDiscovered) {
      ctx.save();
      ctx.font = `bold ${Math.floor(size * 0.25)}px ui-monospace, Menlo`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.fillText('+', size - 4, 4);
      ctx.restore();
    }

    return new THREE.CanvasTexture(canvas);
  }

  private handleClick(e: MouseEvent) {
    if (!this.renderer || !this.camera || !this.scene) return;

    const K = (window as any).KBTS;
    if (!K) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1) 
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1
    };

    // Create raycaster
    const THREE = window.THREE;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Find intersections with tile meshes
    const intersects = raycaster.intersectObjects(this.tileMeshes);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      // Find the tile coordinates from mesh position
      const x = Math.round(mesh.position.x + K.state.size.w/2 - 0.5);
      const y = Math.round(-mesh.position.y + K.state.size.h/2 - 0.5);
      
      if (K.inBounds(x, y)) {
        K.state.sel = K.idx(x, y);
        K.draw(); // This will update both renderers
        K.openPanel?.(x, y);
      }
    }
  }

  private createTiles() {
    if (!this.scene || !window.THREE) return;

    const K = (window as any).KBTS;
    if (!K) return;

    const { state, idx, inBounds, T, LABEL } = K;
    const THREE = window.THREE;

    // Clear existing tiles
    this.tileMeshes.forEach(mesh => {
      this.scene!.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.tileMeshes = [];

    // Create tile meshes
    for (let y = 0; y < state.size.h; y++) {
      for (let x = 0; x < state.size.w; x++) {
        const cell = state.map[idx(x, y)];
        if (!cell) continue;

        const rt = (c: any) => c ? (c.upg ? c.upg.to : c.type) : null;
        const t = rt(cell);
        
        // Check if coast
        let isCoast = false;
        if (t === T.WATER) {
          const dirs = [[1,0], [-1,0], [0,1], [0,-1]] as const;
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (inBounds(nx, ny)) {
              const neighbor = state.map[idx(nx, ny)];
              if (neighbor && rt(neighbor) !== T.WATER) {
                isCoast = true;
                break;
              }
            }
          }
        }

        // Get label
        const tt = cell.upg ? rt(cell) : cell.type;
        const label = cell.disc ? (LABEL[tt] || String(tt).slice(0, 2).toUpperCase()) : '?';
        
        // Check selection
        const isSelected = state.sel === idx(x, y);
        
        // Check farm synergy
        const hasSynergy = cell.type === T.FARM && (cell.fx || 0) === 2 && cell.disc;

        // Create texture
        const texture = this.createTileTexture(t || T.WATER, isCoast, cell.disc, isSelected, label, hasSynergy);
        
        // Create mesh
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position mesh
        mesh.position.set(x - state.size.w/2 + 0.5, -(y - state.size.h/2 + 0.5), 0);
        
        this.scene.add(mesh);
        this.tileMeshes.push(mesh);
      }
    }
  }

  draw() {
    if (!this.inited || !this.scene || !this.camera || !this.renderer) return;
    
    this.createTiles(); // Recreate tiles to reflect state changes
    
    if (this.controls) {
      this.controls.update();
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.inited || !this.camera || !this.renderer || !this.container) return;

    // Use full container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;
    const size = 10;

    this.camera.left = -size * aspect;
    this.camera.right = size * aspect;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  destroy() {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    this.tileMeshes.forEach(mesh => {
      if (this.scene) this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.tileMeshes = [];

    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
      this.renderer = null;
    }

    // Clear the three container
    if (this.container) {
      this.container.innerHTML = '';
    }

    this.scene = null;
    this.camera = null;
    this.container = null;
    this.inited = false;
  }
}

// Global renderer manager
class RendererManager {
  private current: 'debug' | 'three' = 'debug';
  private threeRenderer = new ThreeRenderer();

  async set(name: 'debug' | 'three') {
    this.current = name;
    
    if (name === 'three') {
      await this.threeRenderer.init();
    } else {
      this.threeRenderer.destroy();
    }
  }

  get() {
    return this.current;
  }

  draw() {
    // Always draw the debug canvas
    const K = (window as any).KBTS;
    if (K?.drawCanvas) K.drawCanvas();
    
    // Also draw Three.js if it's initialized
    if (this.threeRenderer.inited) {
      this.threeRenderer.draw();
    }
  }

  resize() {
    if (this.threeRenderer.inited) {
      this.threeRenderer.resize();
    }
  }

  // Auto-initialize Three.js overlay
  async autoInit() {
    await this.threeRenderer.init();
  }
}

// Create global renderer instance
const rendererManager = new RendererManager();

// Expose global KBTS_Renderer for backward compatibility
(window as any).KBTS_Renderer = {
  set: (name: string) => rendererManager.set(name as any),
  get: () => rendererManager.get(),
  draw: () => rendererManager.draw(),
  onResize: () => rendererManager.resize(),
};

// Auto-initialize the Three.js overlay when the page loads
setTimeout(() => {
  rendererManager.autoInit().catch(console.error);
}, 100);

export { rendererManager };
