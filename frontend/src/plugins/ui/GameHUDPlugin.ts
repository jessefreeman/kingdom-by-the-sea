// GameHUDPlugin.ts - Extracted HUD and turn management functionality from kbts.ts
// Handles HUD updates, turn summary, win/lose conditions, and game state display

import { EngineContext } from "../../engine/contracts/plugins";
import { GameUtils } from "../../engine/utilities/GameUtils";

interface GameHUDContext {
  state: any;
  coreRulesPlugin: any;
  draw: () => void;
  showStart: () => void;
  each: (fn: (x: number, y: number, cell: any) => void) => void;
  T: any;
}

export class GameHUDPlugin {
  private context!: EngineContext;
  private gameContext!: GameHUDContext;
  private isInitialized = false;

  constructor() {}

  async init(context: EngineContext): Promise<void> {
    this.context = context;
    this.isInitialized = true;
  }

  setGameContext(gameContext: GameHUDContext): void {
    this.gameContext = gameContext;
  }

  // ===== HUD Management =====
  updateHUD(): void {
    if (!this.gameContext) return;
    
    const { $ } = GameUtils.DOM;
    const { state } = this.gameContext;
    
    const yearEl = $("y");
    const goldEl = $("g");
    const foodEl = $("f");
    const woodEl = $("w");
    const peopleEl = $("p");
    const actionsEl = $("a");
    
    if (yearEl) yearEl.textContent = String(state.year);
    if (goldEl) goldEl.textContent = String(state.gold);
    if (foodEl) foodEl.textContent = String(state.food);
    if (woodEl) woodEl.textContent = String(state.wood);
    if (peopleEl) peopleEl.textContent = String(state.people);
    if (actionsEl) actionsEl.textContent = String(state.actions);
  }

  // ===== Turn Management =====
  endTurn(): any {
    if (!this.gameContext) return null;
    
    // Delegate to CoreRulesPlugin for turn processing
    const result = this.gameContext.coreRulesPlugin.processTurn();
    
    // Update UI
    this.updateHUD();
    this.gameContext.draw();
    this.showSummary(result);
    this.checkWinLose();
    
    return result;
  }

  // ===== Turn Summary =====
  showSummary(d: any): void {
    if (!this.gameContext) return;
    
    const { esc, ov } = GameUtils.DOM;
    const { state } = this.gameContext;
    
    const deltas = "Δ G:" + d.G + " F:" + d.F + " W:" + d.W + " P:" + d.P;
    const evHtml =
      d.events && d.events.length
        ? '<div class="section">' +
          d.events
            .filter(Boolean)
            .map((s: string) => "<div>• " + esc(s) + "</div>")
            .join("") +
          "</div>"
        : '<div class="section hint">No notable events.</div>';
    
    ov(
      '<div class="title">End of Year ' +
        (state.year - 1) +
        "</div>" +
        '<div class="section">' +
        deltas +
        "</div>" +
        evHtml +
        '<button class="btn primary" id="ok">Continue</button>',
      (box, wrap) => {
        const okBtn = box.querySelector("#ok") as HTMLButtonElement;
        if (okBtn) {
          okBtn.onclick = () => wrap.remove();
        }
      }
    );
  }

  // ===== Win/Lose Logic =====
  checkWinLose(): void {
    if (!this.gameContext) return;
    
    const { state, each, T } = this.gameContext;
    
    let win = false;
    each((x: number, y: number, c: any) => {
      if (c && c.type === T.CASTLE) win = true;
    });
    
    if (state.people <= 0) {
      this.showGameOver(false, "Your people are gone.");
    } else if (win) {
      this.showGameOver(true, "You raised a CASTLE!");
    }
  }

  showGameOver(win: boolean, msg: string): void {
    if (!this.gameContext) return;
    
    const { esc, ov } = GameUtils.DOM;
    const { state, showStart } = this.gameContext;
    
    ov(
      '<div class="title">' +
        (win ? "Victory" : "Game Over") +
        '</div><div class="section">' +
        esc(msg) +
        '</div><div class="section">Years:' +
        state.year +
        " • People:" +
        state.people +
        " • Gold:" +
        state.gold +
        '</div><button class="btn primary" id="again">New Run</button>',
      (box, wrap) => {
        const againBtn = box.querySelector("#again") as HTMLButtonElement;
        if (againBtn) {
          againBtn.onclick = () => {
            wrap.remove();
            showStart();
          };
        }
      }
    );
  }

  // ===== Public API =====
  isReady(): boolean {
    return this.isInitialized && !!this.gameContext;
  }
}
