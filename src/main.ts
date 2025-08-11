// Boot the TypeScript KBTS engine and then wire renderer control helpers
import './engine/kbts';
import './renderer/three'; // Load Three.js renderer
import { setRenderer, draw, resize } from './game';

// Wire up renderer switching for dev
(window as any).KBTS_TS = { setRenderer, draw, resize };

window.addEventListener('resize', () => resize());

// Default to debug; allow switching in console: KBTS_TS.setRenderer('three')
setRenderer('debug');
