import type { KBTSApi, Cell, State } from './engine/contracts/types';

// Minimal TS renderer facade that wraps the existing window-based renderer
export type Renderer = {
  init(): void | Promise<void>;
  draw(): void;
  resize(): void;
  destroy(): void;
};

class DebugRenderer implements Renderer {
  init() {}
  draw() {
    const KB = (window as any).KBTS as KBTSApi | undefined;
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN || !KB) return;
    RN._impls.debug.draw();
  }
  resize() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN) return;
    RN._impls.debug.resize?.();
  }
  destroy() {}
}

class ThreeRenderer implements Renderer {
  private inited = false;
  async init() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN) {
      console.warn('KBTS_Renderer not available, ThreeRenderer init skipped');
      return;
    }
    // The actual three.js renderer initialization is handled by the three.ts module
    // We just need to set it to use the three renderer
    if (typeof RN.set === 'function') {
      RN.set('three');
    }
    this.inited = true;
  }
  draw() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN || !this.inited) return;
    if (typeof RN.draw === 'function') {
      RN.draw();
    }
  }
  resize() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN || !this.inited) return;
    if (typeof RN.onResize === 'function') {
      RN.onResize();
    }
  }
  destroy() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN) return;
    // No specific destroy method needed - the renderer manager handles this
    this.inited = false;
  }
}

export class RendererManager {
  private current: 'debug' | 'three' = 'debug';
  private debug = new DebugRenderer();
  private three = new ThreeRenderer();

  set(name: 'debug' | 'three') {
    if (this.current === name) return;
    this.getInstance(this.current).destroy();
    this.current = name;
    this.getInstance(name).init();
  }
  get() { return this.current; }
  draw() { this.getInstance(this.current).draw(); }
  resize() { this.getInstance(this.current).resize(); }
  private getInstance(name: 'debug' | 'three') { return name === 'debug' ? this.debug : this.three; }
}

export const rendererManager = new RendererManager();
