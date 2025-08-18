// Boot the TypeScript KBTS engine and then wire renderer control helpers
import "./engine/kbts";
import "./renderer/three"; // Load Three.js renderer
import { rendererManager } from "./renderer";

// Import new engine tests
import { runRngTests } from "./tests/rng.tests";

// Wire up renderer switching for dev
(window as any).KBTS_TS = { 
  setRenderer: (name: 'debug' | 'three') => rendererManager.set(name), 
  draw: () => rendererManager.draw(), 
  resize: () => rendererManager.resize() 
};

// Add engine tests to window for debugging
(window as any).KBTS_ENGINE_TESTS = {
  runRngTests,
};

window.addEventListener("resize", () => rendererManager.resize());

// Default to three; allow switching in console: KBTS_TS.setRenderer('debug')
rendererManager.set("three");

console.log('🚀 KBTS loaded. Engine tests available via KBTS_ENGINE_TESTS');
