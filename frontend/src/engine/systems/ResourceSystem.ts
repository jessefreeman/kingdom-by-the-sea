// Core 4X Engine Systems - Generic resource management framework

import type { EngineContext } from '../contracts/plugins';

export interface ResourceType {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export interface ResourceTransaction {
  id: string;
  type: 'gain' | 'spend' | 'set';
  resources: Record<string, number>;
  reason?: string;
  source?: string;
  timestamp?: number;
}

export interface ResourceConstraint {
  id: string;
  resourceId: string;
  min?: number;
  max?: number;
  validate?: (value: number, context: EngineContext) => boolean;
}

export interface ResourceEvent {
  resources: Record<string, number>;
  transaction?: ResourceTransaction;
  constraint?: ResourceConstraint;
}

export class ResourceSystem {
  private context!: EngineContext;
  private resourceTypes: Map<string, ResourceType> = new Map();
  private constraints: Map<string, ResourceConstraint> = new Map();
  private transactions: ResourceTransaction[] = [];
  private maxTransactionHistory: number = 100;

  init(context: EngineContext): void {
    this.context = context;
    context.services.provide('resources', this);
  }

  /**
   * Register a new resource type
   */
  registerResourceType(resource: ResourceType): void {
    this.resourceTypes.set(resource.id, resource);
    
    // Initialize resource if it doesn't exist in state
    const state = this.context.state.get();
    if (!state.resources.hasOwnProperty(resource.id)) {
      const newResources = { ...state.resources };
      newResources[resource.id] = resource.defaultValue || 0;
      this.context.state.patch({ resources: newResources });
    }

    this.context.events.publish('resource.type.registered', { resource });
  }

  /**
   * Get all registered resource types
   */
  getResourceTypes(): ResourceType[] {
    return Array.from(this.resourceTypes.values());
  }

  /**
   * Get a specific resource type
   */
  getResourceType(id: string): ResourceType | undefined {
    return this.resourceTypes.get(id);
  }

  /**
   * Get current resource amounts
   */
  getResources(): Record<string, number> {
    const state = this.context.state.get();
    return { ...state.resources };
  }

  /**
   * Get amount of a specific resource
   */
  getResource(id: string): number {
    const state = this.context.state.get();
    return state.resources[id] || 0;
  }

  /**
   * Set resource amount directly
   */
  setResource(id: string, amount: number, reason?: string): boolean {
    const resourceType = this.resourceTypes.get(id);
    if (!resourceType) {
      this.context.logger.warn(`Unknown resource type: ${id}`);
      return false;
    }

    const clampedAmount = this.clampResourceValue(id, amount);
    
    if (!this.validateResourceChange(id, clampedAmount)) {
      return false;
    }

    const state = this.context.state.get();
    const oldAmount = state.resources[id] || 0;
    const newResources = { ...state.resources };
    newResources[id] = clampedAmount;

    this.context.state.patch({ resources: newResources });

    const transaction: ResourceTransaction = {
      id: `set_${id}_${Date.now()}`,
      type: 'set',
      resources: { [id]: clampedAmount },
      timestamp: Date.now()
    };

    if (reason) {
      transaction.reason = reason;
    }

    this.recordTransaction(transaction);

    this.context.events.publish('resource.changed', {
      resources: { [id]: clampedAmount },
      transaction
    } as ResourceEvent);

    return true;
  }

  /**
   * Add resources
   */
  addResources(resources: Record<string, number>, reason?: string): boolean {
    return this.modifyResources(resources, 'gain', reason);
  }

  /**
   * Spend resources
   */
  spendResources(resources: Record<string, number>, reason?: string): boolean {
    // Check if we can afford all resources first
    if (!this.canAfford(resources)) {
      this.context.events.publish('resource.insufficient', {
        resources,
        reason: reason || 'Insufficient resources'
      });
      return false;
    }

    // Convert to negative amounts for spending
    const spendAmounts: Record<string, number> = {};
    for (const [id, amount] of Object.entries(resources)) {
      spendAmounts[id] = -Math.abs(amount);
    }

    return this.modifyResources(spendAmounts, 'spend', reason);
  }

  /**
   * Check if we can afford a cost
   */
  canAfford(cost: Record<string, number>): boolean {
    const currentResources = this.getResources();
    
    for (const [resourceId, amount] of Object.entries(cost)) {
      const available = currentResources[resourceId] || 0;
      if (available < amount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get missing resources for a cost
   */
  getMissingResources(cost: Record<string, number>): Record<string, number> {
    const currentResources = this.getResources();
    const missing: Record<string, number> = {};

    for (const [resourceId, amount] of Object.entries(cost)) {
      const available = currentResources[resourceId] || 0;
      if (available < amount) {
        missing[resourceId] = amount - available;
      }
    }

    return missing;
  }

  /**
   * Process a resource transaction
   */
  processTransaction(transaction: ResourceTransaction): boolean {
    if (transaction.type === 'set') {
      // Set absolute values
      let success = true;
      for (const [id, amount] of Object.entries(transaction.resources)) {
        if (!this.setResource(id, amount, transaction.reason)) {
          success = false;
        }
      }
      return success;
    } else {
      // Gain or spend
      const multiplier = transaction.type === 'gain' ? 1 : -1;
      const adjustedResources: Record<string, number> = {};
      
      for (const [id, amount] of Object.entries(transaction.resources)) {
        adjustedResources[id] = amount * multiplier;
      }

      return this.modifyResources(adjustedResources, transaction.type, transaction.reason);
    }
  }

  /**
   * Register a resource constraint
   */
  registerConstraint(constraint: ResourceConstraint): void {
    this.constraints.set(constraint.id, constraint);
  }

  /**
   * Remove a resource constraint
   */
  removeConstraint(id: string): void {
    this.constraints.delete(id);
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(): ResourceTransaction[] {
    return [...this.transactions];
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this.transactions = [];
  }

  private modifyResources(
    resources: Record<string, number>, 
    type: 'gain' | 'spend', 
    reason?: string
  ): boolean {
    const state = this.context.state.get();
    const newResources = { ...state.resources };
    const changedResources: Record<string, number> = {};

    // Validate all changes first
    for (const [id, amount] of Object.entries(resources)) {
      const resourceType = this.resourceTypes.get(id);
      if (!resourceType) {
        this.context.logger.warn(`Unknown resource type: ${id}`);
        return false;
      }

      const currentAmount = newResources[id] || 0;
      const newAmount = currentAmount + amount;
      const clampedAmount = this.clampResourceValue(id, newAmount);

      if (!this.validateResourceChange(id, clampedAmount)) {
        return false;
      }

      newResources[id] = clampedAmount;
      changedResources[id] = clampedAmount;
    }

    // Apply all changes
    this.context.state.patch({ resources: newResources });

    const transaction: ResourceTransaction = {
      id: `${type}_${Date.now()}`,
      type,
      resources: changedResources,
      timestamp: Date.now()
    };

    if (reason) {
      transaction.reason = reason;
    }

    this.recordTransaction(transaction);

    this.context.events.publish('resource.changed', {
      resources: changedResources,
      transaction
    } as ResourceEvent);

    return true;
  }

  private clampResourceValue(resourceId: string, value: number): number {
    const resourceType = this.resourceTypes.get(resourceId);
    if (!resourceType) return value;

    let clampedValue = value;

    if (resourceType.min !== undefined) {
      clampedValue = Math.max(clampedValue, resourceType.min);
    }

    if (resourceType.max !== undefined) {
      clampedValue = Math.min(clampedValue, resourceType.max);
    }

    return clampedValue;
  }

  private validateResourceChange(resourceId: string, newValue: number): boolean {
    // Check resource type constraints
    const resourceType = this.resourceTypes.get(resourceId);
    if (resourceType) {
      if (resourceType.min !== undefined && newValue < resourceType.min) {
        return false;
      }
      if (resourceType.max !== undefined && newValue > resourceType.max) {
        return false;
      }
    }

    // Check registered constraints
    for (const constraint of this.constraints.values()) {
      if (constraint.resourceId === resourceId) {
        if (constraint.min !== undefined && newValue < constraint.min) {
          return false;
        }
        if (constraint.max !== undefined && newValue > constraint.max) {
          return false;
        }
        if (constraint.validate && !constraint.validate(newValue, this.context)) {
          return false;
        }
      }
    }

    return true;
  }

  private recordTransaction(transaction: ResourceTransaction): void {
    this.transactions.push(transaction);

    // Maintain transaction history limit
    if (this.transactions.length > this.maxTransactionHistory) {
      this.transactions = this.transactions.slice(-this.maxTransactionHistory);
    }
  }
}
