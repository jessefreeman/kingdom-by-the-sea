// Three.js 3D renderer for Kingdom by the Sea
// Uses CDN imports to avoid build dependencies
// 
// Debug Camera Controls:
// - Left click: Select tiles
// - Right click + drag: Rotate camera (respects axis toggles)
// - Middle click + drag: Pan camera target
// - Mouse wheel: Zoom in/out
// - D key: Toggle debug overlay and control buttons
// - R key: Reset camera to default position
// - C key: Center camera on map
// - P key: Print current values to console
// - 1,2,3 keys: Toggle X, Y, Z axis rotation
// - WASD: Fine angle adjustment
// - Q/E: Distance adjustment
// - Arrow keys: Precise angle adjustment
// - +/- keys: Zoom in/out

import { tileAtlas } from '../tileAtlas';

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
  private isDragging: boolean = false;
  private isRotating: boolean = false;
  private lastMousePosition = { x: 0, y: 0 };
  private mouseDownTime = 0;
  private mouseDownPosition = { x: 0, y: 0 };
  private cameraTarget = { x: 0, y: 0, z: 0 };
  private cameraDistance = 25; // Increased for perspective camera
  private cameraAngleX = 0.74; // 42.4° - isometric view angle
  private cameraAngleY = 0.84; // 48.1° - isometric rotation
  private animationFrameId: number | null = null;
  private needsRender = false;
  private debugMode = true; // Enable debug mode
  private debugElement: HTMLElement | null = null;
  public inited = false;

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
      this.container = document.getElementById('threeContainer');
      if (!this.container) return;

      // Scene setup
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#061021');

      // Use full container dimensions
      const containerWidth = this.container.clientWidth;
      const containerHeight = this.container.clientHeight;
      
      // Camera setup - perspective for natural depth perception
      const aspect = containerWidth / containerHeight;
      const fov = 60; // Field of view in degrees - good for isometric-style view
      this.camera = new THREE.PerspectiveCamera(
        fov,
        aspect,
        0.1,   // Near clipping plane
        1000   // Far clipping plane
      );

      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(containerWidth, containerHeight);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';

      // Clear container and add renderer
      this.container.innerHTML = '';
      this.container.appendChild(this.renderer.domElement);

      // Add visualization helpers
      this.addVisualizationHelpers();

      // Add mouse controls directly to the canvas
      this.renderer.domElement.addEventListener('click', (e: MouseEvent) => {
        this.handleClick(e);
      });

      this.renderer.domElement.addEventListener('mousedown', (e: MouseEvent) => {
        this.handleMouseDown(e);
      });

      this.renderer.domElement.addEventListener('mousemove', (e: MouseEvent) => {
        this.handleMouseMove(e);
      });

      this.renderer.domElement.addEventListener('mouseup', (e: MouseEvent) => {
        this.handleMouseUp(e);
      });

      this.renderer.domElement.addEventListener('wheel', (e: WheelEvent) => {
        this.handleWheel(e);
      });

      // Prevent context menu on right click
      this.renderer.domElement.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault();
      });

      // Reset drag states when mouse leaves the canvas
      this.renderer.domElement.addEventListener('mouseleave', () => {
        this.isRotating = false;
        this.isDragging = false;
        this.renderer.domElement.style.cursor = 'default';
      });

      // Add keyboard controls for camera
      document.addEventListener('keydown', (e: KeyboardEvent) => {
        this.handleKeyboard(e);
      });

      // Set initial camera position
      this.updateCameraPosition();

      // Create debug overlay
      this.createDebugOverlay();

      // Start the render loop
      this.startRenderLoop();

      this.inited = true;
      this.createTiles();
      this.centerCameraOnMap(); // Ensure camera is centered on the map
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

  private createTileTexture(tileType: string, isCoast = false, isDiscovered = true, isSelected = false, label = '', hasSynergy = false): any {
    const K = (window as any).KBTS;
    const { T, C, LABEL } = K;
    const THREE = window.THREE;
    
    // Determine the actual tile type for atlas lookup
    let atlasType = tileType;
    if (tileType === T.WATER) {
      atlasType = isCoast ? 'coast' : 'water';
    }
    
    // Try to get texture from atlas first
    if (tileAtlas.isLoaded()) {
      const useLetters = true; // Use letter layer during development
      const useFog = !isDiscovered;
      
      const texture = tileAtlas.getThreeTexture(atlasType, useLetters, useFog);
      if (texture) {
        // If we have atlas texture, we might still need to add overlays
        if (isSelected || hasSynergy) {
          // Create a composite texture for overlays
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 16;
          const ctx = canvas.getContext('2d')!;
          
          // Draw the base tile
          const baseCanvas = tileAtlas.getTileCanvas(atlasType, useLetters, useFog);
          if (baseCanvas) {
            ctx.drawImage(baseCanvas, 0, 0);
          }
          
          // Add selection border
          if (isSelected) {
            ctx.strokeStyle = '#7bdff6';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, 16, 16);
          }
          
          // Add synergy indicator
          if (hasSynergy && isDiscovered) {
            ctx.save();
            ctx.font = 'bold 8px ui-monospace, Menlo';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.9;
            ctx.fillText('+', 14, 1);
            ctx.restore();
          }
          
          const compositeTexture = new THREE.CanvasTexture(canvas);
          compositeTexture.magFilter = THREE.NearestFilter;
          compositeTexture.minFilter = THREE.NearestFilter;
          return compositeTexture;
        }
        
        return texture;
      }
    }
    
    // Fallback to procedural generation if atlas not available
    const canvas = document.createElement('canvas');
    const size = 16; // Use 16x16 to match atlas
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
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, size, size);
    }

    // Label
    if (label && isDiscovered) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = `bold 8px ui-monospace, Menlo`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, size / 2, size / 2);
      ctx.restore();
    }

    // Farm synergy indicator
    if (hasSynergy && isDiscovered) {
      ctx.save();
      ctx.font = `bold 6px ui-monospace, Menlo`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.fillText('+', size - 1, 1);
      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  private handleClick(e: MouseEvent) {
    // Only process left clicks
    if (e.button !== 0) return;
    
    // Don't process clicks if we were dragging or rotating
    if (this.isDragging || this.isRotating) return;
    
    // Check if this was a quick click (not a drag)
    const clickTime = Date.now() - this.mouseDownTime;
    const clickDistance = Math.sqrt(
      Math.pow(e.clientX - this.mouseDownPosition.x, 2) + 
      Math.pow(e.clientY - this.mouseDownPosition.y, 2)
    );
    
    // Only register as click if it was quick and didn't move much
    if (clickTime > 300 || clickDistance > 5) return;
    
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
      // Find the tile coordinates from mesh position (now using X and Z)
      const x = Math.round(mesh.position.x + K.state.size.w/2 - 0.5);
      const y = Math.round(mesh.position.z + K.state.size.h/2 - 0.5);
      
      if (K.inBounds(x, y)) {
        K.state.sel = K.idx(x, y);
        K.draw(); // This will update both renderers
        K.openPanel?.(x, y);
      }
    }
  }

  private handleMouseDown(e: MouseEvent) {
    this.mouseDownTime = Date.now();
    this.mouseDownPosition = { x: e.clientX, y: e.clientY };
    
    if (e.button === 2) { // Right mouse button for rotation
      this.isRotating = true;
      this.lastMousePosition = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
      e.preventDefault();
    } else if (e.button === 1) { // Middle mouse button for panning
      this.isDragging = true;
      this.lastMousePosition = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'move';
      e.preventDefault();
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isRotating && !this.isDragging) return;

    const deltaX = e.clientX - this.lastMousePosition.x;
    const deltaY = e.clientY - this.lastMousePosition.y;

    if (this.isRotating) {
      // Isometric-style rotation: primarily around Y-axis with limited tilt
      this.cameraAngleY -= deltaX * 0.01; // Horizontal rotation around map (primary control)
      this.cameraAngleX += deltaY * 0.005; // Limited tilt adjustment (slower)
      
      // Constrain X angle to maintain isometric feel (30-60 degrees)
      this.cameraAngleX = Math.max(0.52, Math.min(1.05, this.cameraAngleX)); // ~30-60°
      
      this.updateCameraPosition();
    } else if (this.isDragging) {
      // Pan: move the center point that we're orbiting around
      const panSpeed = 0.03;
      
      // Calculate screen-relative movement vectors (XZ plane)
      const rightX = Math.cos(this.cameraAngleY + Math.PI * 0.5);
      const rightZ = Math.sin(this.cameraAngleY + Math.PI * 0.5);
      const forwardX = Math.cos(this.cameraAngleY);
      const forwardZ = Math.sin(this.cameraAngleY);
      
      // Pan the orbit center on the XZ plane
      this.cameraTarget.x += (deltaX * rightX + deltaY * forwardX) * panSpeed;
      this.cameraTarget.z += (deltaX * rightZ + deltaY * forwardZ) * panSpeed;
      
      this.updateCameraPosition();
    }

    this.lastMousePosition = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }

  private handleMouseUp(e: MouseEvent) {
    if (e.button === 2) { // Right mouse button
      this.isRotating = false;
    } else if (e.button === 1) { // Middle mouse button
      this.isDragging = false;
    }
    
    // Reset cursor if no longer dragging/rotating
    if (!this.isRotating && !this.isDragging) {
      this.renderer.domElement.style.cursor = 'default';
    }
    
    e.preventDefault();
  }

  private handleWheel(e: WheelEvent) {
    // More responsive zoom with linear scaling
    const zoomSpeed = 1.5;
    
    if (e.deltaY > 0) {
      // Zoom out
      this.cameraDistance = Math.min(50, this.cameraDistance + zoomSpeed);
    } else {
      // Zoom in - keep a reasonable minimum distance to avoid getting inside geometry
      this.cameraDistance = Math.max(3, this.cameraDistance - zoomSpeed);
    }
    
    this.updateCameraPosition();
    this.updateDebugInfo(); // Update debug info immediately to see the change
    e.preventDefault();
  }

  private updateCameraPosition() {
    if (!this.camera) return;

    // Calculate camera position based on spherical coordinates around the target
    // Y is now the vertical axis, X and Z are horizontal
    const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraAngleX) * Math.cos(this.cameraAngleY);
    const z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraAngleX) * Math.sin(this.cameraAngleY);
    const y = this.cameraTarget.y + this.cameraDistance * Math.cos(this.cameraAngleX);

    // Ensure camera stays above ground level (y >= 0.5)
    const finalY = Math.max(0.5, y);

    this.camera.position.set(x, finalY, z);
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);
    
    // Update debug info
    this.updateDebugInfo();
    
    // Mark that we need to render
    this.needsRender = true;
  }

  private createDebugOverlay() {
    if (!this.debugMode) return;
    
    this.debugElement = document.createElement('div');
    
    // Position relative to the 3D container
    const containerRect = this.container?.getBoundingClientRect();
    const containerRight = containerRect ? containerRect.right : window.innerWidth;
    const containerBottom = containerRect ? containerRect.bottom : window.innerHeight;
    
    this.debugElement.style.cssText = `
      position: fixed;
      bottom: ${window.innerHeight - containerBottom + 15}px;
      right: ${window.innerWidth - containerRight + 15}px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.4;
      border-radius: 6px;
      z-index: 1000;
      pointer-events: auto;
      min-width: 300px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    document.body.appendChild(this.debugElement);
    this.updateDebugInfo();
  }

  private addVisualizationHelpers() {
    if (!this.scene) return;
    const THREE = window.THREE;
    const K = (window as any).KBTS;

    // Add axis helper to show X, Y, Z directions
    const axisHelper = new THREE.AxesHelper(10);
    this.scene.add(axisHelper);

    // Add a ground plane grid to show the floor (XZ plane at Y=0)
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.position.y = 0; // Place at ground level (Y=0)
    this.scene.add(gridHelper);

    // Add a large ocean plane that extends far beyond the map
    const oceanSize = 200; // Much larger than the map to create ocean horizon
    const oceanGeometry = new THREE.PlaneGeometry(oceanSize, oceanSize);
    
    // Get the deep water color from the game constants - same logic as tile creation
    let deepWaterColor = '#0c3b66'; // fallback
    if (K?.C && K?.T) {
      deepWaterColor = K.C[K.T.WATER] || '#0c3b66';
    }
    
    const oceanMaterial = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color(deepWaterColor),
      side: THREE.DoubleSide 
    });
    
    const oceanPlane = new THREE.Mesh(oceanGeometry, oceanMaterial);
    oceanPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal (XZ plane)
    oceanPlane.position.y = -0.2; // Slightly below the tiles to avoid z-fighting
    this.scene.add(oceanPlane);

    console.log('Added visualization helpers: axis helper, grid, and ocean plane');
  }

  private updateDebugInfo() {
    if (!this.debugElement || !this.camera) return;
    
    const pos = this.camera.position;
    const target = this.cameraTarget;
    const angleXDeg = (this.cameraAngleX * 180 / Math.PI).toFixed(1);
    const angleYDeg = (this.cameraAngleY * 180 / Math.PI).toFixed(1);
    
    this.debugElement.innerHTML = `
      <strong>Camera Debug Controls</strong><br><br>
      
      <div style="margin-bottom: 10px;">
        <strong>Target Position (what we're looking at):</strong><br>
        X: <input type="number" id="targetX" value="${target.x.toFixed(2)}" step="0.1" style="width: 60px; background: #333; color: white; border: 1px solid #555; padding: 2px;">
        Y: <input type="number" id="targetY" value="${target.y.toFixed(2)}" step="0.1" style="width: 60px; background: #333; color: white; border: 1px solid #555; padding: 2px;">
        Z: <input type="number" id="targetZ" value="${target.z.toFixed(2)}" step="0.1" style="width: 60px; background: #333; color: white; border: 1px solid #555; padding: 2px;">
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>Camera Angles:</strong><br>
        Angle X: <input type="number" id="angleX" value="${this.cameraAngleX.toFixed(3)}" step="0.01" style="width: 80px; background: #333; color: white; border: 1px solid #555; padding: 2px;"> (${angleXDeg}°) - <span style="color: #aaa;">isometric tilt</span><br>
        Angle Y: <input type="number" id="angleY" value="${this.cameraAngleY.toFixed(3)}" step="0.01" style="width: 80px; background: #333; color: white; border: 1px solid #555; padding: 2px;"> (${angleYDeg}°) - <span style="color: #aaa;">rotate around map</span>
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>Distance:</strong> <input type="number" id="distance" value="${this.cameraDistance.toFixed(2)}" step="0.5" style="width: 80px; background: #333; color: white; border: 1px solid #555; padding: 2px;"> <span style="color: #aaa;">- zoom level</span>
      </div>
      
      <div style="font-size: 10px; color: #ccc; margin-bottom: 8px;">
        <strong>Camera Position:</strong> (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
        <strong>Height above ground:</strong> ${pos.y.toFixed(1)} units
      </div>
      
      <div style="font-size: 10px; color: #888;">
        🟥=X axis, 🟩=Y axis, 🟦=Z axis<br>
        Grid shows ground plane (Y=0)
      </div>
    `;
    
    // Add event listeners for the input fields
    this.setupDebugInputs();
  }

  private setupDebugInputs() {
    // Set up event listeners for the debug input fields
    const targetX = document.getElementById('targetX') as HTMLInputElement;
    const targetY = document.getElementById('targetY') as HTMLInputElement;
    const targetZ = document.getElementById('targetZ') as HTMLInputElement;
    const angleX = document.getElementById('angleX') as HTMLInputElement;
    const angleY = document.getElementById('angleY') as HTMLInputElement;
    const distance = document.getElementById('distance') as HTMLInputElement;

    if (targetX) {
      targetX.addEventListener('change', () => {
        this.cameraTarget.x = parseFloat(targetX.value) || 0;
        this.updateCameraPosition();
      });
      targetX.addEventListener('input', () => {
        this.cameraTarget.x = parseFloat(targetX.value) || 0;
        this.updateCameraPosition();
      });
    }
    
    if (targetY) {
      targetY.addEventListener('change', () => {
        this.cameraTarget.y = parseFloat(targetY.value) || 0;
        this.updateCameraPosition();
      });
      targetY.addEventListener('input', () => {
        this.cameraTarget.y = parseFloat(targetY.value) || 0;
        this.updateCameraPosition();
      });
    }
    
    if (targetZ) {
      targetZ.addEventListener('change', () => {
        this.cameraTarget.z = parseFloat(targetZ.value) || 0;
        this.updateCameraPosition();
      });
      targetZ.addEventListener('input', () => {
        this.cameraTarget.z = parseFloat(targetZ.value) || 0;
        this.updateCameraPosition();
      });
    }
    
    if (angleX) {
      angleX.addEventListener('change', () => {
        this.cameraAngleX = parseFloat(angleX.value) || 0;
        this.updateCameraPosition();
      });
      angleX.addEventListener('input', () => {
        this.cameraAngleX = parseFloat(angleX.value) || 0;
        this.updateCameraPosition();
      });
    }
    
    if (angleY) {
      angleY.addEventListener('change', () => {
        this.cameraAngleY = parseFloat(angleY.value) || 0;
        this.updateCameraPosition();
      });
      angleY.addEventListener('input', () => {
        this.cameraAngleY = parseFloat(angleY.value) || 0;
        this.updateCameraPosition();
      });
    }
    
    if (distance) {
      distance.addEventListener('change', () => {
        this.cameraDistance = parseFloat(distance.value) || 1;
        this.updateCameraPosition();
        this.updateDebugInfo(); // Update debug display immediately
      });
      distance.addEventListener('input', () => {
        this.cameraDistance = parseFloat(distance.value) || 1;
        this.updateCameraPosition();
      });
    }
  }

  // Method to center the camera on the map
  private centerCameraOnMap() {
    const K = (window as any).KBTS;
    if (!K || !K.state) return;

    // Set camera target to the center of the map
    this.cameraTarget = {
      x: 0, // Map is centered at origin in our coordinate system
      y: 0,
      z: 0
    };
    
    this.updateCameraPosition();
  }

  private startRenderLoop() {
    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      
      // Only render if something has changed or we're actively moving
      if (this.needsRender || this.isDragging || this.isRotating) {
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
        this.needsRender = false;
      }
    };
    
    render();
  }

  private stopRenderLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private handleKeyboard(e: KeyboardEvent) {
    if (!this.camera) return;

    const K = (window as any).KBTS;
    if (!K) return;

    // Toggle debug mode with 'D' key
    if (e.key === 'd' || e.key === 'D') {
      this.debugMode = !this.debugMode;
      if (this.debugMode) {
        this.createDebugOverlay();
      } else {
        if (this.debugElement) {
          this.debugElement.remove();
          this.debugElement = null;
        }
      }
      e.preventDefault();
    }

    // Reset camera position with 'R' key
    if (e.key === 'r' || e.key === 'R') {
      this.cameraTarget = { x: 0, y: 0, z: 0 };
      this.cameraDistance = 20;
      this.cameraAngleX = 0.1; // Almost top-down (5.7°)
      this.cameraAngleY = -1.43; // -81.9° rotation
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
      this.updateCameraPosition();
      e.preventDefault();
    }

    // Fine control with WASD keys
    if (e.key === 'w' || e.key === 'W') {
      this.cameraAngleX -= 0.05;
      this.updateCameraPosition();
      e.preventDefault();
    }
    if (e.key === 's' || e.key === 'S') {
      this.cameraAngleX += 0.05;
      this.updateCameraPosition();
      e.preventDefault();
    }
    if (e.key === 'a' || e.key === 'A') {
      this.cameraAngleY -= 0.05;
      this.updateCameraPosition();
      e.preventDefault();
    }
    if (e.key === 'd' || e.key === 'D') {
      this.cameraAngleY += 0.05;
      this.updateCameraPosition();
      e.preventDefault();
    }

    // Distance control with Q/E
    if (e.key === 'q' || e.key === 'Q') {
      this.cameraDistance = Math.max(5, this.cameraDistance - 1);
      this.updateCameraPosition();
      e.preventDefault();
    }
    if (e.key === 'e' || e.key === 'E') {
      this.cameraDistance = Math.min(100, this.cameraDistance + 1);
      this.updateCameraPosition();
      e.preventDefault();
    }

    // Zoom controls with +/- keys
    if (e.key === '=' || e.key === '+') {
      this.cameraDistance = Math.max(5, this.cameraDistance * 0.8);
      this.updateCameraPosition();
      e.preventDefault();
    }

    if (e.key === '-' || e.key === '_') {
      this.cameraDistance = Math.min(100, this.cameraDistance * 1.25);
      this.updateCameraPosition();
      e.preventDefault();
    }

    // Arrow keys for precise angle adjustment
    if (e.key === 'ArrowLeft') {
      this.cameraAngleY -= 0.1;
      this.updateCameraPosition();
      e.preventDefault();
    }

    if (e.key === 'ArrowRight') {
      this.cameraAngleY += 0.1;
      this.updateCameraPosition();
      e.preventDefault();
    }

    if (e.key === 'ArrowUp') {
      this.cameraAngleX -= 0.05;
      this.updateCameraPosition();
      e.preventDefault();
    }

    if (e.key === 'ArrowDown') {
      this.cameraAngleX += 0.05;
      this.updateCameraPosition();
      e.preventDefault();
    }

    // Center camera on map with 'C' key
    if (e.key === 'c' || e.key === 'C') {
      this.centerCameraOnMap();
      e.preventDefault();
    }

    // Print current values to console with 'P' key
    if (e.key === 'p' || e.key === 'P') {
      console.log('Camera Debug Values:');
      console.log(`cameraAngleX: ${this.cameraAngleX} (${(this.cameraAngleX * 180 / Math.PI).toFixed(1)}°)`);
      console.log(`cameraAngleY: ${this.cameraAngleY} (${(this.cameraAngleY * 180 / Math.PI).toFixed(1)}°)`);
      console.log(`cameraDistance: ${this.cameraDistance}`);
      console.log(`cameraTarget:`, this.cameraTarget);
      console.log(`camera.position:`, this.camera.position);
      e.preventDefault();
    }
  }

  // Public method to focus camera on a specific tile
  public focusOnTile(x: number, y: number, animate: boolean = true) {
    if (!this.camera) return;

    const K = (window as any).KBTS;
    if (!K || !K.inBounds(x, y)) return;

    const targetPosition = {
      x: x - K.state.size.w/2 + 0.5,
      y: -(y - K.state.size.h/2 + 0.5),
      z: 0
    };

    if (animate) {
      // Smoothly move to the target position
      const steps = 30;
      const startTarget = { ...this.cameraTarget };
      let step = 0;
      
      const animateStep = () => {
        step++;
        const progress = step / steps;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        
        this.cameraTarget.x = startTarget.x + (targetPosition.x - startTarget.x) * easeProgress;
        this.cameraTarget.y = startTarget.y + (targetPosition.y - startTarget.y) * easeProgress;
        this.cameraTarget.z = startTarget.z + (targetPosition.z - startTarget.z) * easeProgress;
        
        this.updateCameraPosition();
        
        if (step < steps) {
          requestAnimationFrame(animateStep);
        }
      };
      
      animateStep();
    } else {
      // Instant move
      this.cameraTarget = { ...targetPosition };
      this.updateCameraPosition();
    }
  }

  // Public method to reset camera to default position
  public resetCamera() {
    if (!this.camera) return;

    this.cameraTarget = { x: 0, y: 0, z: 0 };
    this.cameraDistance = 20;
    this.cameraAngleX = Math.PI * 0.35; // Fixed isometric angle
    this.cameraAngleY = Math.PI * 0.25; // Default 45 degree side angle
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.updateCameraPosition();
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
        
        // Position mesh on the ground (XZ plane at Y=0)
        // Rotate the plane to lie flat on the ground
        mesh.rotation.x = -Math.PI / 2; // Rotate 90 degrees to be horizontal
        mesh.position.set(x - state.size.w/2 + 0.5, 0, (y - state.size.h/2 + 0.5));
        
        this.scene.add(mesh);
        this.tileMeshes.push(mesh);
      }
    }
    
    // Mark that we need to render the new tiles
    this.needsRender = true;
  }

  draw() {
    if (!this.inited || !this.scene || !this.camera || !this.renderer) return;
    
    this.createTiles(); // Recreate tiles to reflect state changes
    this.needsRender = true; // Mark that we need to render the new tiles
  }

  resize() {
    if (!this.inited || !this.camera || !this.renderer || !this.container) return;

    // Use full container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    // Update perspective camera aspect ratio
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.needsRender = true;
  }

  destroy() {
    // Stop the render loop
    this.stopRenderLoop();
    
    // Clean up debug overlay
    if (this.debugElement) {
      this.debugElement.remove();
      this.debugElement = null;
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
    this.controls = null;
    this.isDragging = false;
    this.isRotating = false;
    this.mouseDownTime = 0;
    this.needsRender = false;
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

  // Expose camera control methods
  focusOnTile(x: number, y: number, animate: boolean = true) {
    this.threeRenderer.focusOnTile(x, y, animate);
  }

  resetCamera() {
    this.threeRenderer.resetCamera();
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
  focusOnTile: (x: number, y: number, animate: boolean = true) => rendererManager.focusOnTile(x, y, animate),
  resetCamera: () => rendererManager.resetCamera(),
};

// Auto-initialize the Three.js overlay when the page loads
setTimeout(() => {
  rendererManager.autoInit().catch(console.error);
}, 100);

export { rendererManager };
