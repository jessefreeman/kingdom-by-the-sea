// GameBusinessLogicPlugin.ts - Extracted business logic from kbts.ts
// Handles farm workforce management, tile panels, exploration, and upgrade logic

import { EngineContext } from "../../engine/contracts/plugins";
import { GameUtils } from "../../engine/utilities/GameUtils";

interface GameBusinessLogicContext {
  state: any;
  coreRulesPlugin: any;
  idx: (x: number, y: number) => number;
  inBounds: (x: number, y: number) => boolean;
  each: (fn: (x: number, y: number, cell: any) => void) => void;
  hud: () => void;
  draw: () => void;
  getCreateMode: () => boolean;
  BASE: any;
  T: any;
  DIRS: any;
  EXPLORE: any;
  rt: (c: any) => any;
  houseNearbyLocal: (x: number, y: number) => boolean;
}

export class GameBusinessLogicPlugin {
  private context!: EngineContext;
  private gameContext!: GameBusinessLogicContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GameBusinessLogicContext): void {
    this.gameContext = gameContext;
  }

  // ===== Rules / UI Logic =====
  afford(c: any): boolean {
    return this.gameContext.coreRulesPlugin.afford(c);
  }

  whyNo(spec: any, cell: any): string {
    return this.gameContext.coreRulesPlugin.whyNo(spec, cell);
  }

  fmtCost(c: any): string {
    return Object.entries(c || {})
      .filter((p) => p[0] !== "Y")
      .map((p) => p[0] + ":" + p[1])
      .join(" ");
  }

  fmtYield(y: any): string {
    return !y
      ? ""
      : Object.entries(y)
          .map((p) => p[0] + ":+" + p[1] + "/t")
          .join(" ");
  }

  upgradeName(from: string, to: string): string {
    const { T } = this.gameContext;
    return from === T.BURNT
      ? "CLEAR"
      : from === T.RUBBLE
      ? "REBUILD"
      : String(to).toUpperCase();
  }

  tileInfo(c: any): { yield: string; status: string } {
    const { BASE, T } = this.gameContext;
    const y = BASE[c.type];
    const needs = c.type === T.FARM && !(c.wrk > 0);
    return {
      yield: needs ? "— (needs worker)" : y ? this.fmtYield(y) : "—",
      status: c.upg
        ? "Upgrading → " +
          this.upgradeName(c.type, c.upg.to) +
          " • " +
          c.upg.left +
          "t left"
        : "—",
    };
  }

  canExplore(x: number, y: number): boolean {
    return this.gameContext.coreRulesPlugin.canExplore(x, y);
  }

  whyNoExplore(x: number, y: number): string {
    return this.gameContext.coreRulesPlugin.whyNoExplore(x, y);
  }

  explore(x: number, y: number): void {
    const success = this.gameContext.coreRulesPlugin.explore(x, y);
    if (success) {
      this.gameContext.hud();
      this.gameContext.draw();
    }
  }

  isCoast(x: number, y: number): boolean {
    const { inBounds, idx, state, rt, T, DIRS } = this.gameContext;
    if (!inBounds(x, y)) return false;
    const c = state.map[idx(x, y)] as any;
    if (!c || rt(c) !== T.WATER) return false;
    return DIRS.some((d: any) => {
      const nx = x + d[0],
        ny = y + d[1];
      return inBounds(nx, ny) && rt(state.map[idx(nx, ny)] as any) !== T.WATER;
    });
  }

  countType(t: string): number {
    return this.gameContext.coreRulesPlugin.countType(t);
  }

  uniqueAvailable(to: string): boolean {
    return this.gameContext.coreRulesPlugin.uniqueAvailable(to);
  }

  bufferOK(x: number, y: number, from: string, to: string): boolean {
    const { T, houseNearbyLocal } = this.gameContext;
    if (!houseNearbyLocal(x, y)) return true;
    if (to === T.FARM) return true;
    if (from === T.FOREST && to === T.GRASS) return true;
    return false;
  }

  // ===== Workforce/Farm synergy =====
  farmWorkers(): number {
    const { each, T } = this.gameContext;
    let n = 0;
    each((x: number, y: number, c: any) => {
      if (c.type === T.FARM) n += c.wrk | 0;
    });
    return n;
  }

  setFarmWorkers(x: number, y: number, delta: number): void {
    const { idx, state, T, hud, draw } = this.gameContext;
    const i = idx(x, y),
      c = state.map[i] as any;
    if (!c || c.type !== T.FARM) return;
    const cur = c.wrk | 0;
    if (delta > 0) {
      if (state.actions <= 0 || cur >= 1) return;
      c.wrk = cur + 1;
      state.actions = Math.max(0, state.actions - 1);
    } else {
      if (cur <= 0) return;
      c.wrk = cur - 1;
      state.actions = Math.min(state.people - this.farmWorkers(), state.actions + 1);
    }
    hud();
    draw();
    this.openPanel(x, y);
  }

  updateFarmSynergy(d?: any): void {
    const { each, state, T, DIRS, inBounds, idx } = this.gameContext;
    const hasArr = new Array(state.size.w * state.size.h).fill(false);
    each((x: number, y: number, c: any) => {
      if (c.type !== T.FARM || (c.wrk | 0) <= 0) return;
      for (const dxy of DIRS) {
        const nx = x + dxy[0],
          ny = y + dxy[1];
        if (!inBounds(nx, ny)) continue;
        const n = state.map[idx(nx, ny)] as any;
        if (n && n.type === T.FARM && (n.wrk | 0) > 0) {
          hasArr[idx(x, y)] = true;
          break;
        }
      }
    });
    each((x: number, y: number, c: any) => {
      if (c.type !== T.FARM) {
        if (c.fx) c.fx = 0;
        return;
      }
      const prev = c.fx | 0,
        has = hasArr[idx(x, y)];
      if (has) {
        c.fx = prev === 0 ? 1 : prev === 1 ? 2 : 2;
        if (c.fx === 2 && prev !== 2) {
          if (d) d.events.push(`Farm synergy active at (${x},${y})`);
        }
      } else {
        c.fx = 0;
      }
    });
  }

  // ===== Panel Management =====
  openPanel(x: number, y: number): void {
    const { getCreateMode, idx, state, T, EXPLORE } = this.gameContext;
    const { $, esc } = GameUtils.DOM;
    
    if (getCreateMode()) { 
      const panel = $("panel");
      if (panel) panel.innerHTML = ""; 
      return; 
    }
    
    const c = state.map[idx(x, y)] as any,
      P = $("panel");
    if (!P || !c) {
      if (P) P.innerHTML = "";
      return;
    }
    
    if (!c.disc) {
      const can = this.canExplore(x, y),
        why = can ? "" : this.whyNoExplore(x, y),
        dis = can ? "" : `disabled title="${esc(why)}"`;
      P.innerHTML = `<div class="card"><div class="title">Unknown @ (${x},${y})</div><div class="section">Explore: adjacent (4-dir) only • uses 1A + 1F • ${Math.round(
        EXPLORE.RISK * 100
      )}% risk −1P</div><button class="btn primary" ${dis} id="e">Explore</button></div>`;
      const b = $("e");
      if (b)
        (b as HTMLButtonElement).onclick = () => {
          this.explore(x, y);
          this.openPanel(x, y);
        };
      return;
    }
    
    const info = this.tileInfo(c),
      opts = this.gameContext.coreRulesPlugin.getUpgradeSpecs(c.type);
    const farmCtrl =
      c.type === T.FARM
        ? `<div class="section"><div><b>Workers</b> ${
            c.wrk | 0
          }/1 <span class="hint">(ties up 1 Action)</span></div><div style="display:flex;gap:6px"><button class="btn" id="wMinus" ${
            (c.wrk | 0) <= 0 ? "disabled" : ""
          }>− Remove</button><button class="btn" id="wPlus" ${
            state.actions <= 0 || (c.wrk | 0) >= 1 ? "disabled" : ""
          }>+ Assign</button></div></div>`
        : "";
    const rows = opts.length
      ? opts
          .map((o: any, i: number) => {
            const baseOK = this.afford(o.cost) && state.actions > 0 && !c.upg,
              bufOK = this.bufferOK(x, y, c.type, o.to as any),
              siteOK =
                (!o.pre || o.pre(x, y)) && this.uniqueAvailable(o.to as any) && bufOK,
              can = baseOK && siteOK;
            const whyParts: string[] = [];
            if (!baseOK) whyParts.push(this.whyNo(o, c));
            if (baseOK && !siteOK) {
              if (!bufOK) whyParts.push("residence buffer (farm-only)");
              if (o.pre && !o.pre(x, y))
                whyParts.push(o.req || "site requirement not met");
              if (!this.uniqueAvailable(o.to as any))
                whyParts.push("unique limit reached");
            }
            const why = can ? "" : whyParts.filter(Boolean).join("; "),
              yd = [this.fmtYield((o as any).perTurn), this.fmtYield(o.instant as any)]
                .filter(Boolean)
                .join(" • "),
              dis = can ? "" : `disabled title="${esc(why)}"`;
            return `<div class="section"><div><b>Upgrade → ${this.upgradeName(
              c.type,
              o.to as any
            )}</b> <span class="hint">${
              o.duration
            }t</span></div><div>Cost: ${this.fmtCost(o.cost)}${
              yd ? " • " + yd : ""
            }</div><button class="btn primary" ${dis} data-u="${i}">Start (−1A)</button></div>`;
          })
          .join("")
      : '<div class="hint">No upgrades available.</div>';
    P.innerHTML = `<div class="card"><div class="title">${c.type.toUpperCase()} @ (${x},${y})</div><div class="section"><div><b>Yield</b> ${
      info["yield"]
    }</div><div><b>Status</b> ${info.status}</div></div>${farmCtrl}${rows}</div>`;
    P.querySelectorAll("[data-u]").forEach((b) => {
      (b as HTMLButtonElement).onclick = () => {
        const idxStr = (b as HTMLElement).getAttribute("data-u");
        if (idxStr == null) return;
        const uIndex = parseInt(idxStr, 10);
        const specList = this.gameContext.coreRulesPlugin.getUpgradeSpecs(c.type);
        const upg = specList[uIndex];
        if (!upg) return;
        this.startUpgrade(x, y, c, upg);
        this.openPanel(x, y);
      };
    });
    if (c.type === T.FARM) {
      const add = P.querySelector("#wPlus") as HTMLButtonElement | null,
        rem = P.querySelector("#wMinus") as HTMLButtonElement | null;
      if (add) add.onclick = () => this.setFarmWorkers(x, y, +1);
      if (rem) rem.onclick = () => this.setFarmWorkers(x, y, -1);
    }
  }

  startUpgrade(x: number, y: number, c: any, s: any): void {
    if (this.gameContext.coreRulesPlugin.canUpgrade(x, y, s)) {
      this.gameContext.coreRulesPlugin.startUpgrade(x, y, s);
      this.gameContext.hud();
      this.gameContext.draw();
    }
  }

  // ===== Public API =====
  isReady(): boolean {
    return this.isInitialized && !!this.gameContext;
  }
}
