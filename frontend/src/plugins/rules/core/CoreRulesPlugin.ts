import type { 
  EnginePlugin,
  EngineContext 
} from "../../../engine/contracts/plugins";
import type { 
  Cell, 
  UpgradeSpec,
  State 
} from "../../../engine/contracts/types";
import { 
  T, 
  HOUSELINE, 
  DIRS, 
  BASE
} from "../../../engine/constants";

interface TurnResult {
  resources: {
    G: number;
    F: number; 
    W: number;
    P: number;
  };
  events: string[];
}

export class CoreRulesPlugin implements EnginePlugin {
  public readonly id = 'kbts.rules.core.v1';
  public readonly version = '1.0.0';

  private context!: EngineContext;
  private state!: State;
  private rngService!: any;

  // Building specifications (extracted from kbts.ts)
  private readonly SPEC: Record<string, UpgradeSpec[]> = {
    [T.GRASS]: [
      { to: T.FARM as any, cost: { W: 1 }, duration: 1, perTurn: { F: 1 } },
    ],
    [T.FARM]: [
      {
        to: T.HOUSE as any,
        cost: { G: 1, W: 1 },
        duration: 1,
        instant: { P: 1 },
        pre: (x: number, y: number) => this.noHouseNearby(x, y),
        req: "needs 1-tile spacing from other houses",
      },
    ],
    [T.FOREST]: [
      { to: T.GRASS as any, cost: {}, duration: 1, instant: { W: 2 } },
    ],
    [T.HILL]: [
      { to: T.MINE as any, cost: { G: 1 }, duration: 1, perTurn: { G: 1 } },
    ],
    [T.WATER]: [
      {
        to: T.DOCK as any,
        cost: { W: 1 },
        duration: 1,
        perTurn: { F: 1, G: 1 },
        pre: (x: number, y: number) => this.isCoast(x, y),
        req: "coast required",
      },
    ],
    [T.HUT]: [
      {
        to: T.HOUSE as any,
        cost: { G: 1, W: 1 },
        duration: 1,
        pre: (x: number, y: number) => this.noHouseNearby(x, y),
        req: "needs 1-tile spacing from other houses",
      },
    ],
    [T.HOUSE]: [
      { to: T.MANSION as any, cost: { G: 2 }, duration: 2, perTurn: { G: 1 } },
    ],
    [T.MANSION]: [
      { to: T.PALACE as any, cost: { G: 3 }, duration: 2, perTurn: { G: 2 } },
    ],
    [T.PALACE]: [
      { to: T.CASTLE as any, cost: { G: 4 }, duration: 3, perTurn: { G: 3 } },
    ],
    [T.BURNT]: [{ to: T.GRASS as any, cost: { W: 1 }, duration: 1 }],
    [T.RUBBLE]: [{ to: T.HUT as any, cost: { W: 1 }, duration: 1 }],
  };

  private readonly EXPLORE = { RISK: 0.25, FOOD: 1 };

  // Plugin lifecycle
  init(context: EngineContext): void {
    this.context = context;
    
    // Get services
    const gameStateService = context.services.get('gameState') as any;
    this.state = gameStateService.getState();
    this.rngService = context.services.get('rng') as any;
    
    // Register this plugin as a service
    context.services.provide('rules', this);
    
    context.logger.info('CoreRulesPlugin initialized');
  }

  start?(context: EngineContext): void {
    this.context.logger.info('CoreRulesPlugin started');
  }

  update?(ctx: EngineContext, deltaTime: number): void {
    // Rules plugin is turn-based, no per-frame updates needed
  }

  stop?(context: EngineContext): void {
    this.context.logger.info('CoreRulesPlugin stopped');
  }

  dispose?(context: EngineContext): void {
    this.context.logger.info('CoreRulesPlugin disposed');
  }

  // Building System API
  afford(cost: any): boolean {
    return (
      (!("G" in cost) || this.state.gold >= cost.G) &&
      (!("W" in cost) || this.state.wood >= cost.W) &&
      (!("P" in cost) || this.state.people >= cost.P) &&
      (!("F" in cost) || this.state.food >= cost.F)
    );
  }

  whyNo(spec: UpgradeSpec, cell: Cell): string {
    const r: string[] = [];
    if ((cell as any).upg) r.push("already upgrading");
    if (this.state.actions <= 0) r.push("no actions left");
    const cc = spec.cost || {};
    if (cc.G && this.state.gold < cc.G) r.push("need G:" + cc.G);
    if (cc.W && this.state.wood < cc.W) r.push("need W:" + cc.W);
    if (cc.F && this.state.food < cc.F) r.push("need F:" + cc.F);
    if (cc.P && this.state.people < cc.P) r.push("need P:" + cc.P);
    return r.join(", ");
  }

  canUpgrade(x: number, y: number, spec: UpgradeSpec): boolean {
    const cell = this.getCellAt(x, y);
    if (!cell || !spec) return false;

    return (
      this.afford(spec.cost || {}) &&
      this.state.actions > 0 &&
      !(cell as any).upg &&
      this.uniqueAvailable(spec.to as string) &&
      (!spec.pre || spec.pre(x, y)) &&
      this.bufferOK(x, y, cell.type, spec.to as string)
    );
  }

  startUpgrade(x: number, y: number, spec: UpgradeSpec): void {
    const cell = this.getCellAt(x, y);
    if (!cell || !this.canUpgrade(x, y, spec)) return;

    this.pay(spec.cost || {});
    this.state.actions--;
    
    const total = spec.duration || 1;
    (cell as any).upg = { 
      to: spec.to, 
      left: total, 
      spec: spec, 
      total, 
      prog: 0 
    };
    
    if (total > 1) {
      (cell as any).upg.left--;
      (cell as any).upg.prog = 1;
    }

    this.reveal(x, y, 1);
    
    // Emit events
    this.context.events.publish('rules.upgrade.started', { x, y, spec });
  }

  // Helper methods
  private pay(cost: any): void {
    if (cost.G) this.state.gold -= cost.G;
    if (cost.W) this.state.wood -= cost.W;
    if (cost.F) this.state.food -= cost.F;
  }

  private getCellAt(x: number, y: number): Cell | null {
    if (!this.inBounds(x, y)) return null;
    return this.state.map[this.idx(x, y)] || null;
  }

  private idx(x: number, y: number): number {
    return y * this.state.size.w + x;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.state.size.w && y >= 0 && y < this.state.size.h;
  }

  private renderType(cell: Cell): string {
    return (cell as any).upg ? (cell as any).upg.to : cell.type;
  }

  private bufferOK(x: number, y: number, from: string, to: string): boolean {
    if (!this.houseNearby(x, y)) return true;
    if (to === T.FARM) return true;
    if (from === T.FOREST && to === T.GRASS) return true;
    return false;
  }

  private houseNearby(x: number, y: number): boolean {
    for (const d of DIRS) {
      const nx = x + d[0];
      const ny = y + d[1];
      if (!this.inBounds(nx, ny)) continue;
      const cell = this.getCellAt(nx, ny);
      if (cell && HOUSELINE.includes(this.renderType(cell) as any)) return true;
    }
    return false;
  }

  private noHouseNearby(x: number, y: number): boolean {
    return !this.houseNearby(x, y);
  }

  private reveal(x: number, y: number, radius: number): void {
    const cell = this.getCellAt(x, y);
    if (cell) {
      (cell as any).disc = true;
    }
  }

  // Public API for getting building specs
  getUpgradeSpecs(tileType: string): UpgradeSpec[] {
    return this.SPEC[tileType] || [];
  }

  // ===== Turn Processing =====

  /**
   * Process a complete turn: resource collection, upgrades, feeding, growth, events
   * Returns turn summary data with deltas and events
   */
  public processTurn(): TurnSummary {
    const state = this.context.state.get();
    const d: TurnSummary = { G: 0, F: 0, W: 0, P: 0, events: [] };

    // Collect base yields from all buildings
    this.eachCell((x, y, c) => {
      if (c.type === 'FARM') {
        if ((c.wrk || 0) > 0) {
          d.F += 2 + ((c.fx || 0) === 2 ? 1 : 0);
        }
      } else {
        const yld = BASE[c.type];
        if (yld) {
          for (const k in yld) {
            d[k as keyof TurnSummary] += (yld as any)[k];
          }
        }
      }
    });

    this.applyAdjacencyBonuses(d);
    this.processUpgrades(d);
    this.processFoodAndPopulation(d);
    this.processRandomEvent(d);
    this.updateFarmSynergy(d);

    // Update turn counter and available actions
    state.year++;
    state.actions = Math.max(0, state.people - this.farmWorkers());

    // Update state
    this.context.state.set(state);

    return d;
  }

  private eachCell(callback: (x: number, y: number, c: any) => void): void {
    const state = this.context.state.get();
    for (let y = 0; y < state.size.h; y++) {
      for (let x = 0; x < state.size.w; x++) {
        const idx = y * state.size.w + x;
        const cell = state.map[idx];
        if (cell) {
          callback(x, y, cell);
        }
      }
    }
  }

  private applyAdjacencyBonuses(d: TurnSummary): void {
    this.eachCell((x, y, c) => {
      if (HOUSELINE.includes(c.type as any) && this.hasAdjType(x, y, 'FARM')) {
        d.G += 1;
      }
      if (c.type === 'DOCK') {
        if (this.hasAdjType(x, y, 'FARM')) d.F += 1;
        if (HOUSELINE.some(t => this.hasAdjType(x, y, t))) {
          d.G += 1;
        }
      }
    });
  }

  private processUpgrades(d: TurnSummary): void {
    this.eachCell((x, y, c) => {
      if (c && c.upg) {
        if (--c.upg.left <= 0) {
          const to = c.upg.to;
          const spec = c.upg.spec;
          c.type = to;
          
          if (spec && spec.instant) {
            for (const k in spec.instant) {
              const v = (spec.instant as any)[k];
              if (k === 'P') {
                d.P += v;
              } else {
                d[k as keyof TurnSummary] += v;
              }
            }
          }
          
          c.upg = null;
          this.reveal(x, y, 1);
          d.events.push(`Completed ${String(to).toUpperCase()} at (${x},${y})`);
        } else if (c.upg.total > 1) {
          c.upg.prog = c.upg.total - c.upg.left;
        }
      }
    });
  }

  private processFoodAndPopulation(d: TurnSummary): void {
    const state = this.context.state.get();
    
    // Apply resource gains
    state.gold += d.G;
    state.food += d.F;
    state.wood += d.W;

    // Feed population
    const need = state.people;
    const fed = Math.min(state.food, need);
    state.food -= fed;
    
    if (fed === need) {
      d.events.push(`All ${need} people fed (−${need} F).`);
    } else {
      const deficit = need - fed;
      d.events.push(`Shortage: needed ${need} F, had ${fed} F (${deficit} unfed).`);
      
      if (state.people > 0) {
        state.people--;
        d.P--;
        d.events.push('Starvation: −1 Person due to shortage.');
      }
      state.food = 0;
    }

    // Population growth
    const growth = Math.floor(state.food / 10);
    if (growth > 0) {
      state.people += growth;
      d.P += growth;
      state.food -= growth * 10;
      d.events.push(`Population growth: +${growth} (used ${growth * 10} F).`);
    } else {
      d.events.push(`Food stored: ${state.food}/10 toward next person.`);
    }

    // Apply population delta
    if (d.P > 0) {
      state.people += d.P;
    }
  }

  private processRandomEvent(d: TurnSummary): void {
    const state = this.context.state.get();
    if ((state as any).noEvents) return;

    const rngService = this.context.services.get('rng') as any;
    // For backward compatibility with tests: if state.rng is manually set and different
    // from our service's gameplay RNG, use state.rng for events too
    const useStateRng = state.rng && state.rng !== rngService.getGameplayRng();
    const eventRng = useStateRng ? () => (state.rng as any)() : () => rngService.event();

    const EV = [
      { n: 'Fire', w: 25 },
      { n: 'Pirates', w: 20 },
      { n: 'Plague', w: 15 },
      { n: 'Storm', w: 25 },
      { n: 'Treasure', w: 8 },
    ];
    
    const tot = EV.reduce((s, e) => s + e.w, 0);
    let r = eventRng() * tot;
    let pick: string = EV[0]!.n;
    
    for (const e of EV) {
      r -= e.w;
      if (r < 0) {
        pick = e.n;
        break;
      }
    }

    this.executeRandomEvent(pick, d, eventRng);
  }

  private executeRandomEvent(pick: string, d: TurnSummary, eventRng: () => number): void {
    const state = this.context.state.get();

    if (pick === 'Fire') {
      const targets: Array<{x: number, y: number, type: string}> = [];
      this.eachCell((x, y, c) => {
        if (c && c.disc && (c.type === 'FOREST' || c.type === 'FARM')) {
          targets.push({ x, y, type: c.type });
        }
      });
      
      if (targets.length) {
        const t = targets[Math.floor(eventRng() * targets.length)]!;
        const ci = this.getCellAt(t.x, t.y);
        if (!ci) return;
        
        let deathNote = '';
        
        if (ci.type === 'FARM') {
          if ((ci.wrk || 0) > 0 && state.people > 0) {
            state.people--;
            d.P--;
            deathNote = ' — worker died (−1P)';
          }
          ci.wrk = 0;
          ci.fx = 0;
        }
        
        ci.type = 'BURNT';
        d.events.push(`Fire destroyed a ${t.type.toUpperCase()} at (${t.x},${t.y}) → BURNT${deathNote}`);
      }
    } else if (pick === 'Pirates') {
      if (state.gold > 0) {
        state.gold--;
        d.G--;
        d.events.push('Pirates stole 1 gold');
      }
    } else if (pick === 'Plague') {
      if (state.people > 1) {
        state.people--;
        d.P--;
        d.events.push('Plague took 1 person');
      }
    } else if (pick === 'Storm') {
      const targets: Array<{x: number, y: number, type: string}> = [];
      this.eachCell((x, y, c) => {
        if (c && c.disc && ['HOUSE', 'MANSION', 'PALACE', 'CASTLE', 'MINE', 'FARM'].includes(c.type)) {
          targets.push({ x, y, type: c.type });
        }
      });
      
      if (targets.length) {
        const t = targets[Math.floor(eventRng() * targets.length)]!;
        const ci = this.getCellAt(t.x, t.y);
        if (!ci) return;
        
        const notes: string[] = [];
        
        if (HOUSELINE.includes(ci.type as any) && state.people > 0) {
          state.people--;
          d.P--;
          notes.push('resident died −1P');
        }
        
        if (ci.type === 'FARM' && (ci.wrk || 0) > 0) {
          if (state.people > 0) {
            state.people--;
            d.P--;
          }
          ci.wrk = 0;
          ci.fx = 0;
          notes.push('worker died −1P');
        }
        
        ci.type = 'RUBBLE';
        d.events.push(`Storm reduced ${t.type.toUpperCase()} at (${t.x},${t.y}) → RUBBLE${(notes.length ? ' — ' + notes.join('; ') : '')}`);
      }
    } else {
      state.gold++;
      d.G++;
      d.events.push('Found hidden treasure (+1 gold)');
    }
  }

  private farmWorkers(): number {
    let n = 0;
    this.eachCell((x, y, c) => {
      if (c.type === 'FARM') n += c.wrk || 0;
    });
    return n;
  }

  private updateFarmSynergy(d?: TurnSummary): void {
    const state = this.context.state.get();
    const hasArr = new Array(state.size.w * state.size.h).fill(false);
    
    // Check for farm adjacency
    this.eachCell((x, y, c) => {
      if (c.type !== 'FARM' || (c.wrk || 0) <= 0) return;
      
      for (const dxy of DIRS) {
        const nx = x + dxy[0];
        const ny = y + dxy[1];
        if (!this.inBounds(nx, ny)) continue;
        
        const n = this.getCellAt(nx, ny);
        if (n && n.type === 'FARM' && (n.wrk || 0) > 0) {
          const idx = y * state.size.w + x;
          hasArr[idx] = true;
          break;
        }
      }
    });
    
    // Apply synergy effects
    this.eachCell((x, y, c) => {
      if (c.type !== 'FARM') {
        if (c.fx) c.fx = 0;
        return;
      }
      
      const prev = c.fx || 0;
      const idx = y * state.size.w + x;
      const has = hasArr[idx];
      
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

  private hasAdjType(x: number, y: number, type: string): boolean {
    for (const dxy of DIRS) {
      const nx = x + dxy[0];
      const ny = y + dxy[1];
      if (this.inBounds(nx, ny)) {
        const c = this.getCellAt(nx, ny);
        if (c && c.type === type) return true;
      }
    }
    return false;
  }

  // ===== Exploration System =====

  /**
   * Check if a tile can be explored
   */
  public canExplore(x: number, y: number): boolean {
    const state = this.context.state.get();
    const cell = this.getCellAt(x, y);
    
    return !!(
      cell &&
      !cell.disc &&
      this.isAdjacentToDiscovered(x, y) &&
      state.actions > 0 &&
      state.people > 0 &&
      state.food >= this.EXPLORE.FOOD
    );
  }

  /**
   * Get reason why exploration is not possible
   */
  public whyNoExplore(x: number, y: number): string {
    const state = this.context.state.get();
    const reasons: string[] = [];
    const cell = this.getCellAt(x, y);
    
    if (!cell) reasons.push('invalid');
    else if (cell.disc) reasons.push('already visible');
    if (!this.isAdjacentToDiscovered(x, y)) reasons.push('adjacent required');
    if (state.actions <= 0) reasons.push('no actions');
    if (state.people <= 0) reasons.push('no people');
    if (state.food < this.EXPLORE.FOOD) reasons.push('need F:1');
    
    return reasons.join(', ');
  }

  /**
   * Explore a tile (reveal it and apply costs/risks)
   */
  public explore(x: number, y: number): boolean {
    if (!this.canExplore(x, y)) return false;
    
    const state = this.context.state.get();
    
    // Pay costs
    state.actions--;
    state.food = Math.max(0, state.food - this.EXPLORE.FOOD);
    
    // Apply exploration risk (reduced in early years)
    const risk = state.year <= 5 ? 0.15 : this.EXPLORE.RISK;
    const rngService = this.context.services.get('rng') as any;
    
    if (rngService.exploration() < risk && state.people > 0) {
      state.people--;
    }
    
    // Reveal the tile
    this.reveal(x, y, 1);
    
    // Update state
    this.context.state.set(state);
    
    return true;
  }

  /**
   * Check if tile is adjacent to any discovered tile
   */
  private isAdjacentToDiscovered(x: number, y: number): boolean {
    for (const dxy of DIRS) {
      const nx = x + dxy[0];
      const ny = y + dxy[1];
      if (!this.inBounds(nx, ny)) continue;
      
      const neighbor = this.getCellAt(nx, ny);
      if (neighbor && neighbor.disc) return true;
    }
    return false;
  }

  /**
   * Check if tile is coastal (water adjacent to land)
   */
  public isCoast(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    
    const cell = this.getCellAt(x, y);
    if (!cell || this.renderType(cell) !== 'WATER') return false;
    
    return DIRS.some((dxy) => {
      const nx = x + dxy[0];
      const ny = y + dxy[1];
      if (!this.inBounds(nx, ny)) return false;
      
      const neighbor = this.getCellAt(nx, ny);
      return neighbor && this.renderType(neighbor) !== 'WATER';
    });
  }

  /**
   * Count tiles of a specific type
   */
  public countType(tileType: string): number {
    let count = 0;
    this.eachCell((x, y, c) => {
      if (c && this.renderType(c) === tileType) count++;
    });
    return count;
  }

  /**
   * Check if unique building can be built (Palace/Castle limit)
   */
  public uniqueAvailable(buildingType: string): boolean {
    if (buildingType === 'PALACE' && this.countType('PALACE') >= 1) return false;
    if (buildingType === 'CASTLE' && this.countType('CASTLE') >= 1) return false;
    return true;
  }
}

// Type definitions for turn processing
interface TurnSummary {
  G: number;
  F: number;
  W: number;
  P: number;
  events: string[];
  [key: string]: number | string[];
}
