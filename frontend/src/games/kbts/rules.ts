// Kingdom by the Sea - Game Rules Engine
// This demonstrates how game-specific rules would be implemented using the new systems

import type { EngineContext } from '../../engine/contracts/plugins';
import type { TurnEvent, TurnPhaseHandler } from '../../engine/systems';

export class KBTSRulesEngine {
  private context!: EngineContext;

  init(context: EngineContext): void {
    this.context = context;
    
    // Register turn phase handlers
    const turnSystem = context.services.get('turns');
    if (turnSystem) {
      turnSystem.registerPhaseHandler('start_turn', this.handleStartTurn.bind(this));
      turnSystem.registerPhaseHandler('production', this.handleProduction.bind(this));
      turnSystem.registerPhaseHandler('maintenance', this.handleMaintenance.bind(this));
      turnSystem.registerPhaseHandler('end_turn', this.handleEndTurn.bind(this));
    }

    // Register for resource events
    context.events.subscribe('resource.changed', this.onResourceChanged.bind(this));
  }

  /**
   * Handle start of turn phase
   */
  private handleStartTurn: TurnPhaseHandler = (context, turnData) => {
    this.context.logger.info(`KBTS: Starting turn ${turnData.turnNumber}`);
    
    // Reset action points
    const resourceSystem = context.services.get('resources');
    if (resourceSystem) {
      resourceSystem.setResource('actions', 3, 'Turn start');
    }

    // Publish turn start events
    context.events.publish('kbts.turn.started', {
      turn: turnData.turnNumber,
      year: this.getTurnAsYear(turnData.turnNumber)
    });
  };

  /**
   * Handle production phase - generate resources from buildings
   */
  private handleProduction: TurnPhaseHandler = (context, turnData) => {
    this.context.logger.debug(`KBTS: Processing production for turn ${turnData.turnNumber}`);
    
    const resourceSystem = context.services.get('resources');
    const tileSystem = context.services.get('tiles');
    const contentRegistry = context.services.get('content');
    
    if (!resourceSystem || !tileSystem || !contentRegistry) return;

    const production = this.calculateProduction();
    
    // Apply production
    if (Object.keys(production).length > 0) {
      resourceSystem.addResources(production, 'Turn production');
      
      context.events.publish('kbts.production.completed', {
        turn: turnData.turnNumber,
        production
      });
    }
  };

  /**
   * Handle maintenance phase - process ongoing effects
   */
  private handleMaintenance: TurnPhaseHandler = (context, turnData) => {
    this.context.logger.debug(`KBTS: Processing maintenance for turn ${turnData.turnNumber}`);
    
    // Process farm workers
    this.updateFarmWorkers();
    
    // Process construction progress
    this.updateConstructionProgress();
    
    // Check for random events
    if (this.shouldTriggerRandomEvent(turnData.turnNumber)) {
      this.triggerRandomEvent(turnData.turnNumber);
    }
  };

  /**
   * Handle end of turn phase
   */
  private handleEndTurn: TurnPhaseHandler = (context, turnData) => {
    this.context.logger.info(`KBTS: Ending turn ${turnData.turnNumber}`);
    
    // Update game year
    const state = context.state.get();
    const newYear = this.getTurnAsYear(turnData.turnNumber + 1);
    context.state.patch({
      game: {
        ...state.game,
        year: newYear
      }
    });

    context.events.publish('kbts.turn.ended', {
      turn: turnData.turnNumber,
      nextYear: newYear
    });
  };

  /**
   * Calculate production from all buildings
   */
  private calculateProduction(): Record<string, number> {
    const tileSystem = this.context.services.get('tiles');
    const contentRegistry = this.context.services.get('content');
    const production: Record<string, number> = {};

    if (!tileSystem || !contentRegistry) return production;

    // Iterate through all tiles to find buildings
    tileSystem.forEachTile((tile) => {
      const building = contentRegistry.getBuilding(tile.type);
      if (!building) return;

      // Check if building produces resources
      if (building.provides?.includes('food_production')) {
        production.food = (production.food || 0) + this.getFoodProduction(tile, building);
      }
      
      if (building.provides?.includes('gold_production')) {
        production.gold = (production.gold || 0) + this.getGoldProduction(tile, building);
      }
    });

    return production;
  }

  /**
   * Calculate food production for a specific building
   */
  private getFoodProduction(tile: any, building: any): number {
    let base = 1; // Base food production

    // Farm-specific logic
    if (building.id === 'farm') {
      // Check for workers
      const workers = tile.properties.wrk || 0;
      if (workers > 0) {
        base += workers; // Workers increase production
      }
      
      // Check for adjacency bonuses
      const adjacentFarms = this.countAdjacentFarms(tile.x, tile.y);
      if (adjacentFarms > 0) {
        base += Math.floor(adjacentFarms / 2); // Bonus for adjacent farms
      }
    }

    return base;
  }

  /**
   * Calculate gold production for a specific building
   */
  private getGoldProduction(tile: any, building: any): number {
    let base = 0;

    switch (building.id) {
      case 'house':
        base = 1;
        break;
      case 'mansion':
        base = 1;
        break;
      case 'palace':
        base = 2;
        break;
      case 'castle':
        base = 3;
        break;
      case 'mine':
        base = 1;
        break;
      case 'dock':
        base = 1;
        break;
    }

    return base;
  }

  /**
   * Count adjacent farms for bonus calculation
   */
  private countAdjacentFarms(x: number, y: number): number {
    const tileSystem = this.context.services.get('tiles');
    if (!tileSystem) return 0;

    const neighbors = tileSystem.getNeighbors(x, y, false);
    return neighbors.filter(neighbor => neighbor.type === 'farm').length;
  }

  /**
   * Update farm workers (KBTS-specific mechanic)
   */
  private updateFarmWorkers(): void {
    const tileSystem = this.context.services.get('tiles');
    if (!tileSystem) return;

    // Find all farms and update worker assignments
    const farms = tileSystem.findTilesByType('farm');
    
    farms.forEach(farm => {
      // Example worker logic - this would be more complex in the real game
      if (!farm.properties.wrk) {
        // Auto-assign workers to farms without them
        farm.properties.wrk = 1;
      }
    });
  }

  /**
   * Update construction progress
   */
  private updateConstructionProgress(): void {
    const tileSystem = this.context.services.get('tiles');
    if (!tileSystem) return;

    // Find tiles with ongoing construction
    tileSystem.forEachTile((tile) => {
      if (tile.properties.upg) {
        const upgrade = tile.properties.upg;
        if (upgrade.left > 0) {
          upgrade.left--;
          
          if (upgrade.left <= 0) {
            // Construction complete
            this.completeConstruction(tile, upgrade);
          }
        }
      }
    });
  }

  /**
   * Complete a construction/upgrade
   */
  private completeConstruction(tile: any, upgrade: any): void {
    const resourceSystem = this.context.services.get('resources');
    const contentRegistry = this.context.services.get('content');
    
    if (!resourceSystem || !contentRegistry) return;

    const upgradeSpec = contentRegistry.getUpgrade(upgrade.spec.id);
    if (!upgradeSpec) return;

    // Change tile type
    tile.type = upgradeSpec.to;
    tile.properties.upg = null;

    // Apply instant effects
    if (upgradeSpec.instant) {
      resourceSystem.addResources(upgradeSpec.instant, 'Construction completion');
    }

    this.context.events.publish('kbts.construction.completed', {
      tile,
      upgrade: upgradeSpec
    });
  }

  /**
   * Check if a random event should trigger
   */
  private shouldTriggerRandomEvent(turnNumber: number): boolean {
    const rng = this.context.rng;
    return turnNumber > 3 && rng.chance(0.1); // 10% chance after turn 3
  }

  /**
   * Trigger a random event
   */
  private triggerRandomEvent(turnNumber: number): void {
    const rng = this.context.rng;
    const events = ['fire', 'pirates', 'storm', 'treasure'];
    const selectedEvent = rng.pick(events);

    this.context.events.publish('kbts.random_event', {
      turn: turnNumber,
      event: selectedEvent
    });

    // Execute event effects
    switch (selectedEvent) {
      case 'fire':
        this.handleFireEvent();
        break;
      case 'pirates':
        this.handlePirateEvent();
        break;
      // Add other events
    }
  }

  /**
   * Handle fire random event
   */
  private handleFireEvent(): void {
    const tileSystem = this.context.services.get('tiles');
    const rng = this.context.rng;
    
    if (!tileSystem) return;

    // Find all burnable tiles
    const burnableTiles = [];
    tileSystem.forEachTile((tile) => {
      if (['grass', 'farm', 'forest'].includes(tile.type)) {
        burnableTiles.push(tile);
      }
    });

    if (burnableTiles.length > 0) {
      const targetTile = rng.pick(burnableTiles);
      targetTile.type = 'burnt';
      
      this.context.events.publish('kbts.fire_event', {
        x: targetTile.x,
        y: targetTile.y,
        message: `Fire destroyed ${targetTile.type} at (${targetTile.x}, ${targetTile.y})!`
      });
    }
  }

  /**
   * Handle pirate random event
   */
  private handlePirateEvent(): void {
    const resourceSystem = this.context.services.get('resources');
    if (!resourceSystem) return;

    const goldLoss = Math.floor(resourceSystem.getResource('gold') * 0.3);
    if (goldLoss > 0) {
      resourceSystem.spendResources({ gold: goldLoss }, 'Pirate raid');
      
      this.context.events.publish('kbts.pirate_event', {
        goldLost: goldLoss,
        message: `Pirates raided and stole ${goldLoss} gold!`
      });
    }
  }

  /**
   * Convert turn number to game year
   */
  private getTurnAsYear(turnNumber: number): number {
    return turnNumber; // Simple 1:1 mapping, could be more complex
  }

  /**
   * Handle resource changes
   */
  private onResourceChanged(event: any): void {
    // React to resource changes if needed
    // For example, check win/lose conditions
    
    const resources = event.resources;
    if (resources.people !== undefined && resources.people <= 0) {
      this.context.events.publish('kbts.game_over', {
        reason: 'No population remaining',
        type: 'defeat'
      });
    }
  }
}
