// GameUIPlugin.ts - Extracted UI management functionality from kbts.ts
// Handles save/load, start screen, and worldgen debug panel

import { EngineContext } from "../../engine/contracts/plugins";
import { GameUtils } from "../../engine/utilities/GameUtils";

interface GameUIContext {
  state: any;
  gameStateService: any;
  rngService: any;
  worldGenUIService: any;
  generate: (seed?: number, size?: string) => Promise<void>;
  getGenParams: () => any;
  setGenParams: (params: any) => void;
  getOrgParams: () => any;
  setOrgParams: (params: any) => void;
  resize: () => void;
  hud: () => void;
  draw: () => void;
  endTurn: () => any;
  rng32: (seed: number) => () => number;
}

export class GameUIPlugin {
  private context!: EngineContext;
  private gameContext!: GameUIContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GameUIContext): void {
    this.gameContext = gameContext;
  }

  // ===== Save / Load =====
  save(): void {
    if (!this.gameContext) return;
    localStorage.setItem("kbts-save", JSON.stringify(this.gameContext.state));
  }

  load(): void {
    if (!this.gameContext) return;
    const raw = localStorage.getItem("kbts-save");
    if (!raw) return;
    
    Object.assign(this.gameContext.state, JSON.parse(raw));
    this.gameContext.state.rng = this.gameContext.rng32(this.gameContext.state.seed);
    this.gameContext.resize();
    this.gameContext.hud();
    this.gameContext.draw();
    
    const seedOut = GameUtils.DOM.$("seedOut");
    const mapOut = GameUtils.DOM.$("mapOut");
    if (seedOut) seedOut.textContent = String(this.gameContext.state.seed);
    if (mapOut) mapOut.textContent = `${this.gameContext.state.size.w}×${this.gameContext.state.size.h}`;
  }

  // ===== UI Management =====
  clearOverlays(): void {
    document.querySelectorAll(".overlay").forEach((el) => el.remove());
    const panel = GameUtils.DOM.$("panel");
    if (panel) panel.innerHTML = "";
  }

  showStart(): void {
    if (!this.gameContext) return;
    
    const { ov, esc } = GameUtils.DOM;
    this.clearOverlays();
    
    ov(
      '<div class="title">New Game</div>' +
        '<div class="section"><label>Map Size' +
        '<select id="sz">' +
    '<option value="small">Small (16×12)</option>' +
    '<option value="medium" selected>Medium (20×16)</option>' +
    '<option value="large">Large (30×20)</option>' +
        "</select>" +
        "</label></div>" +
        '<div class="section"><label>Seed (optional)' +
        '<input id="sd" type="number" placeholder="random" style="width:100%" />' +
        "</label></div>" +
      '<div class="section">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><label>Forests</label><b id="forestOut">' +
      Math.round(this.gameContext.getGenParams().forest*100) + '%</b></div>' +
      '<input id="forest" type="range" min="0" max="100" step="5" value="' + Math.round(this.gameContext.getGenParams().forest*100) + '" />' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0 6px"><label>Mountains</label><b id="mountOut">' +
      Math.round(this.gameContext.getGenParams().mountains*100) + '%</b></div>' +
      '<input id="mount" type="range" min="0" max="50" step="5" value="' + Math.round(this.gameContext.getGenParams().mountains*100) + '" />' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0 6px"><label>Villages</label><b id="villOut">' +
      Math.round(this.gameContext.getGenParams().villages*100) + '%</b></div>' +
      '<input id="vill" type="range" min="0" max="30" step="5" value="' + Math.round(this.gameContext.getGenParams().villages*100) + '" />' +
      '<div class="hint" style="margin-top:6px">Forests ~1 level above grass; Mountains ~2+. Ranges raise nearby land. Values apply per new map.</div>' +
      "</div>" +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn" id="cancelNew">Cancel</button>' +
        '<button class="btn primary" id="startNew">Start</button>' +
        "</div>",
      (box, wrap) => {
        const cancelBtn = box.querySelector("#cancelNew") as HTMLButtonElement;
        const startBtn = box.querySelector("#startNew") as HTMLButtonElement;
        
        if (cancelBtn) {
          cancelBtn.onclick = () => wrap.remove();
        }
        
        if (startBtn) {
          startBtn.onclick = async () => {
            const sizeSelect = box.querySelector("#sz") as HTMLSelectElement;
            const seedInput = box.querySelector("#sd") as HTMLInputElement;
            
            const size = sizeSelect.value as any;
            const sd = parseInt(seedInput.value, 10);
            
            // Read sliders and update defaults for this run
            const forestSlider = box.querySelector('#forest') as HTMLInputElement;
            const mountSlider = box.querySelector('#mount') as HTMLInputElement;
            const villSlider = box.querySelector('#vill') as HTMLInputElement;
            
            const fPct = parseInt(forestSlider?.value || "0", 10) || 0;
            const mPct = parseInt(mountSlider?.value || "0", 10) || 0;
            const vPct = parseInt(villSlider?.value || "0", 10) || 0;
            
            this.gameContext.setGenParams({ 
              forest: Math.max(0, Math.min(1, fPct/100)), 
              mountains: Math.max(0, Math.min(1, mPct/100)), 
              villages: Math.max(0, Math.min(1, vPct/100)) 
            });
            
            await this.gameContext.generate(Number.isFinite(sd) ? sd : Date.now(), size);
            wrap.remove();
          };
        }
        
        // Live update labels
        const forest = box.querySelector('#forest') as HTMLInputElement;
        const mount = box.querySelector('#mount') as HTMLInputElement;
        const vill = box.querySelector('#vill') as HTMLInputElement;
        const forestOut = box.querySelector('#forestOut') as HTMLElement;
        const mountOut = box.querySelector('#mountOut') as HTMLElement;
        const villOut = box.querySelector('#villOut') as HTMLElement;
        
        forest?.addEventListener('input', () => { if (forestOut) forestOut.textContent = forest.value + '%'; });
        mount?.addEventListener('input', () => { if (mountOut) mountOut.textContent = mount.value + '%'; });
        vill?.addEventListener('input', () => { if (villOut) villOut.textContent = vill.value + '%'; });
      }
    );
  }

  // ===== Boot Bindings =====
  setupBootBindings(): void {
    if (!this.gameContext) return;
    
    const { $ } = GameUtils.DOM;
    
    // Window resize
    (window as any).addEventListener("resize", () => {
      try {
        const RN = (window as any).KBTS_Renderer;
        RN?.onResize?.();
      } catch {}
    });
    
    // Button bindings
    const endBtn = $("end") as HTMLButtonElement;
    if (endBtn) {
      endBtn.onclick = () => this.gameContext.endTurn();
      endBtn.disabled = false;
    }
    
    const saveBtn = $("save");
    if (saveBtn) saveBtn.addEventListener("click", () => this.save());
    
    const loadBtn = $("load");
    if (loadBtn) loadBtn.addEventListener("click", () => this.load());
    
    const resetBtn = $("reset");
    if (resetBtn) resetBtn.addEventListener("click", () => this.showStart());
  }

  // ===== Worldgen Debug Panel =====
  setupWorldgenDebugPanel(): void {
    if (!this.gameContext) return;
    
    const { $ } = GameUtils.DOM;
    
    const seedIn = $("seedIn") as HTMLInputElement | null;
    const prevSeed = $("prevSeed") as HTMLButtonElement | null;
    const nextSeed = $("nextSeed") as HTMLButtonElement | null;
    const randomSeed = $("randomSeed") as HTMLButtonElement | null;
    const regenNow = $("regenNow") as HTMLButtonElement | null;
    const sizeSel = $("sizeSel") as HTMLSelectElement | null;
    const f = $("forestSlider") as HTMLInputElement | null;
    const m = $("mountSlider") as HTMLInputElement | null;
    const v = $("villSlider") as HTMLInputElement | null;
    const fOut = $("forestOut2");
    const mOut = $("mountOut2");
    const vOut = $("villOut2");
    const erIter = $("erodeIter") as HTMLInputElement | null;
    const erPct = $("erodePct") as HTMLInputElement | null;
    const lakePct = $("lakePct") as HTMLInputElement | null;
    const coastMargin = $("coastMargin") as HTMLInputElement | null;
    const minLakeDist = $("minLakeDist") as HTMLInputElement | null;
    const maxLakeFlood = $("maxLakeFlood") as HTMLInputElement | null;
    const erIterOut = $("erodeIterOut");
    const erPctOut = $("erodePctOut");
    const lakePctOut = $("lakePctOut");
    const coastMarginOut = $("coastMarginOut");
    const minLakeDistOut = $("minLakeDistOut");
    const maxLakeFloodOut = $("maxLakeFloodOut");

    // Initialize inputs from current config
    if (seedIn) seedIn.value = String(this.gameContext.rngService.getOriginalSeed() || this.gameContext.state.seed || "");
    if (sizeSel) {
      // pick closest match
      const cur = `${this.gameContext.state.size.w}x${this.gameContext.state.size.h}`;
      sizeSel.value = this.gameContext.state.size.w === 16 && this.gameContext.state.size.h === 12 ? "small" : this.gameContext.state.size.w === 30 && this.gameContext.state.size.h === 20 ? "large" : "medium";
    }
    const genParams = this.gameContext.getGenParams();
    const orgParams = this.gameContext.getOrgParams();
    if (f && fOut) { f.value = String(Math.round(genParams.forest * 100)); fOut.textContent = f.value + "%"; }
    if (m && mOut) { m.value = String(Math.round(genParams.mountains * 100)); mOut.textContent = m.value + "%"; }
    if (v && vOut) { v.value = String(Math.round(genParams.villages * 100)); vOut.textContent = v.value + "%"; }
    if (erIter && erIterOut) { erIter.value = String(orgParams.erodeIterations); erIterOut.textContent = erIter.value; }
    if (erPct && erPctOut) { erPct.value = String(Math.round(orgParams.erodePercent * 100)); erPctOut.textContent = erPct.value + "%"; }
    if (lakePct && lakePctOut) { lakePct.value = String(Math.round(orgParams.lakePercent * 100)); lakePctOut.textContent = lakePct.value + "%"; }
    if (coastMargin && coastMarginOut) { coastMargin.value = String(orgParams.coastMargin); coastMarginOut.textContent = coastMargin.value; }
    if (minLakeDist && minLakeDistOut) { minLakeDist.value = String(orgParams.minLakeDistToSea); minLakeDistOut.textContent = minLakeDist.value; }
    if (maxLakeFlood && maxLakeFloodOut) { maxLakeFlood.value = String(orgParams.maxLakeFlood); maxLakeFloodOut.textContent = maxLakeFlood.value; }

    // Live labels
    f?.addEventListener("input", () => { if (fOut) fOut.textContent = f.value + "%"; });
    m?.addEventListener("input", () => { if (mOut) mOut.textContent = m.value + "%"; });
    v?.addEventListener("input", () => { if (vOut) vOut.textContent = v.value + "%"; });
    erIter?.addEventListener("input", () => { if (erIterOut) erIterOut.textContent = erIter.value; });
    erPct?.addEventListener("input", () => { if (erPctOut) erPctOut.textContent = erPct.value + "%"; });
    lakePct?.addEventListener("input", () => { if (lakePctOut) lakePctOut.textContent = lakePct.value + "%"; });
    coastMargin?.addEventListener("input", () => { if (coastMarginOut) coastMarginOut.textContent = coastMargin.value; });
    minLakeDist?.addEventListener("input", () => { if (minLakeDistOut) minLakeDistOut.textContent = minLakeDist.value; });
    maxLakeFlood?.addEventListener("input", () => { if (maxLakeFloodOut) maxLakeFloodOut.textContent = maxLakeFlood.value; });

    // Helpers
    const parseSize = (): "small" | "medium" | "large" => {
      const v = sizeSel?.value as any;
      return v === "small" || v === "large" ? v : "medium";
    };
    
    const readParams = () => {
      // Update configs from sliders before regen
      const currentGenParams = this.gameContext.getGenParams();
      const currentOrgParams = this.gameContext.getOrgParams();
      
      if (f) currentGenParams.forest = Math.max(0, Math.min(1, (parseInt(f.value, 10) || 0) / 100));
      if (m) currentGenParams.mountains = Math.max(0, Math.min(1, (parseInt(m.value, 10) || 0) / 100));
      if (v) currentGenParams.villages = Math.max(0, Math.min(1, (parseInt(v.value, 10) || 0) / 100));
      this.gameContext.setGenParams(currentGenParams);
      
      if (erIter) currentOrgParams.erodeIterations = Math.max(0, Math.min(32, parseInt(erIter.value, 10) || 0));
      if (erPct) currentOrgParams.erodePercent = Math.max(0, Math.min(1, (parseInt(erPct.value, 10) || 0) / 100));
      if (lakePct) currentOrgParams.lakePercent = Math.max(0, Math.min(1, (parseInt(lakePct.value, 10) || 0) / 100));
      if (coastMargin) currentOrgParams.coastMargin = Math.max(0, Math.min(6, parseInt(coastMargin.value, 10) || 0));
      if (minLakeDist) currentOrgParams.minLakeDistToSea = Math.max(0, Math.min(20, parseInt(minLakeDist.value, 10) || 0));
      if (maxLakeFlood) currentOrgParams.maxLakeFlood = Math.max(0, Math.min(999, parseInt(maxLakeFlood.value, 10) || 0));
      this.gameContext.setOrgParams(currentOrgParams);
    };
    
    const doRegen = async (seed: number, size?: any) => {
      readParams();
      await this.gameContext.generate(seed, size || parseSize());
      if (seedIn) seedIn.value = String(seed);
    };

    // Buttons
    prevSeed?.addEventListener("click", async () => {
      const cur = parseInt(seedIn?.value || String(this.gameContext.rngService.getOriginalSeed() || this.gameContext.state.seed || 0), 10) || 0;
      await doRegen(cur - 1);
    });
    nextSeed?.addEventListener("click", async () => {
      const cur = parseInt(seedIn?.value || String(this.gameContext.rngService.getOriginalSeed() || this.gameContext.state.seed || 0), 10) || 0;
      await doRegen(cur + 1);
    });
    randomSeed?.addEventListener("click", async () => {
      await doRegen(Date.now());
    });
    regenNow?.addEventListener("click", async () => {
      const sz = parseSize();
      const val = parseInt(seedIn?.value || "", 10);
      await doRegen(Number.isFinite(val) ? val : Date.now(), sz);
    });
  }

  // ===== Public API =====
  isReady(): boolean {
    return this.isInitialized && !!this.gameContext;
  }
}
