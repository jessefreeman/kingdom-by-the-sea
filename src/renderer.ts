import type { KBTSApi, Cell, State } from './types';

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
    if (!RN) return;
    await RN._impls.three.init();
    this.inited = true;
  }
  draw() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN || !this.inited) return;
    RN._impls.three.draw();
  }
  resize() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN || !this.inited) return;
    RN._impls.three.resize();
  }
  destroy() {
    const RN = (window as any).KBTS_Renderer as any;
    if (!RN) return;
    RN._impls.three.destroy();
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
