// Thin TypeScript adapter around the existing global KBTS game for gradual migration
import { rendererManager } from './renderer/three';

export function setRenderer(name: 'debug' | 'three') {
  const RN = (window as any).KBTS_Renderer as any;
  if (RN && typeof RN.set === 'function') RN.set(name);
  rendererManager.set(name);
}

export function draw() { rendererManager.draw(); }
export function resize() { rendererManager.resize(); }
