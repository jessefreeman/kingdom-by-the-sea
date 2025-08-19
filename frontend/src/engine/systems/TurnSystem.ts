// Core 4X Engine Systems - Generic turn management framework

import type { EngineContext } from '../contracts/plugins';

export interface TurnPhase {
  id: string;
  name: string;
  order: number;
}

export interface TurnEvent {
  phase: string;
  turnNumber: number;
  data?: any;
}

export interface TurnPhaseHandler {
  (context: EngineContext, turnData: TurnEvent): Promise<void> | void;
}

export class TurnSystem {
  private context!: EngineContext;
  private phases: Map<string, TurnPhase> = new Map();
  private handlers: Map<string, TurnPhaseHandler[]> = new Map();
  private currentTurn: number = 1;
  private currentPhase: string | null = null;
  private isProcessing: boolean = false;

  constructor() {
    // Default 4X turn phases
    this.registerPhase('start_turn', 'Start Turn', 10);
    this.registerPhase('movement', 'Movement', 20);
    this.registerPhase('actions', 'Actions', 30);
    this.registerPhase('production', 'Production', 40);
    this.registerPhase('maintenance', 'Maintenance', 50);
    this.registerPhase('end_turn', 'End Turn', 60);
  }

  init(context: EngineContext): void {
    this.context = context;
    context.services.provide('turns', this);
  }

  /**
   * Register a new turn phase
   */
  registerPhase(id: string, name: string, order: number): void {
    this.phases.set(id, { id, name, order });
  }

  /**
   * Register a handler for a specific turn phase
   */
  registerPhaseHandler(phaseId: string, handler: TurnPhaseHandler): void {
    if (!this.handlers.has(phaseId)) {
      this.handlers.set(phaseId, []);
    }
    this.handlers.get(phaseId)!.push(handler);
  }

  /**
   * Get current turn number
   */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): string | null {
    return this.currentPhase;
  }

  /**
   * Check if turn is currently being processed
   */
  isProcessingTurn(): boolean {
    return this.isProcessing;
  }

  /**
   * Process the next turn
   */
  async processTurn(): Promise<void> {
    if (this.isProcessing) {
      this.context.logger.warn('Turn already in progress');
      return;
    }

    this.isProcessing = true;
    this.context.events.publish('turn.started', { turnNumber: this.currentTurn });

    try {
      // Get sorted phases
      const sortedPhases = Array.from(this.phases.values())
        .sort((a, b) => a.order - b.order);

      // Execute each phase
      for (const phase of sortedPhases) {
        this.currentPhase = phase.id;
        await this.executePhase(phase.id);
      }

      this.currentTurn++;
      this.currentPhase = null;
      this.context.events.publish('turn.completed', { 
        turnNumber: this.currentTurn - 1,
        nextTurn: this.currentTurn 
      });

    } catch (error) {
      this.context.logger.error('Turn processing failed:', error);
      this.context.events.publish('turn.error', { 
        turnNumber: this.currentTurn, 
        error 
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a specific turn phase
   */
  async executePhase(phaseId: string): Promise<void> {
    const phase = this.phases.get(phaseId);
    if (!phase) {
      this.context.logger.warn(`Unknown turn phase: ${phaseId}`);
      return;
    }

    this.context.events.publish('turn.phase.started', { 
      phase: phaseId, 
      turnNumber: this.currentTurn 
    });

    const handlers = this.handlers.get(phaseId) || [];
    const turnEvent: TurnEvent = {
      phase: phaseId,
      turnNumber: this.currentTurn
    };

    // Execute all handlers for this phase
    for (const handler of handlers) {
      try {
        await handler(this.context, turnEvent);
      } catch (error) {
        this.context.logger.error(`Handler failed for phase ${phaseId}:`, error);
        // Continue with other handlers unless it's a critical error
      }
    }

    this.context.events.publish('turn.phase.completed', { 
      phase: phaseId, 
      turnNumber: this.currentTurn 
    });
  }

  /**
   * Skip current turn (for AI or automated players)
   */
  skipTurn(): void {
    if (!this.isProcessing) {
      this.processTurn();
    }
  }

  /**
   * Reset turn system to initial state
   */
  reset(): void {
    this.currentTurn = 1;
    this.currentPhase = null;
    this.isProcessing = false;
    this.context.events.publish('turn.reset', {});
  }

  /**
   * Get all registered phases
   */
  getPhases(): TurnPhase[] {
    return Array.from(this.phases.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Get handlers for a specific phase
   */
  getPhaseHandlers(phaseId: string): TurnPhaseHandler[] {
    return this.handlers.get(phaseId) || [];
  }
}
