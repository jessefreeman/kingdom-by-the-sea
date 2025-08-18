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

  private countType(type: string): number {
    let count = 0;
    for (let y = 0; y < this.state.size.h; y++) {
      for (let x = 0; x < this.state.size.w; x++) {
        const cell = this.getCellAt(x, y);
        if (cell && this.renderType(cell) === type) count++;
      }
    }
    return count;
  }

  private uniqueAvailable(to: string): boolean {
    return !(to === T.PALACE && this.countType(T.PALACE) >= 1) &&
           !(to === T.CASTLE && this.countType(T.CASTLE) >= 1);
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

  private isCoast(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const cell = this.getCellAt(x, y);
    if (!cell || this.renderType(cell) !== T.WATER) return false;
    
    return DIRS.some((d) => {
      const nx = x + d[0];
      const ny = y + d[1];
      if (!this.inBounds(nx, ny)) return false;
      const neighbor = this.getCellAt(nx, ny);
      return neighbor && this.renderType(neighbor) !== T.WATER;
    });
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
}
