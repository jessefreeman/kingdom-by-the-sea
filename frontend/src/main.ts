// Boot the TypeScript KBTS engine and then wire renderer control helpers
import "./engine/kbts";
import "./renderer/three"; // Load Three.js renderer
import { setRenderer, draw, resize } from "./game";

// Import new engine tests
import { testRNGDeterminism } from "./tests/rng.determinism.tests";
import { testEngineBasics } from "./tests/engine.basic.tests";
import { testRendererPlugins } from "./tests/renderer.plugins.tests";
import { testWorldgenPlugin } from "./tests/worldgen.plugins.tests";

// Wire up renderer switching for dev
(window as any).KBTS_TS = { setRenderer, draw, resize };

// Add engine tests to window for debugging
(window as any).KBTS_ENGINE_TESTS = {
  testRNGDeterminism,
  testEngineBasics,
  testRendererPlugins,
  testWorldgenPlugin,
};

window.addEventListener("resize", () => resize());

// Default to three; allow switching in console: KBTS_TS.setRenderer('debug')
setRenderer("three");

console.log('🚀 KBTS loaded. Engine tests available via KBTS_ENGINE_TESTS');
console.log('📦 New worldgen plugin test: KBTS_ENGINE_TESTS.testWorldgenPlugin()');
