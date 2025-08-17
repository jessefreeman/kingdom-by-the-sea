// Simple state store with serialization and subscription

import type { StateStore } from '../contracts/plugins';

export class SimpleStateStore<T> implements StateStore<T> {
  private state: T;
  private listeners: Array<(state: T) => void> = [];

  constructor(initialState: T) {
    this.state = initialState;
  }

  get(): T {
    // Return a deep copy to prevent external mutations
    return JSON.parse(JSON.stringify(this.state));
  }

  set(state: T): void {
    this.state = JSON.parse(JSON.stringify(state)); // Deep copy
    this.notifyListeners();
  }

  patch(updates: Partial<T>): void {
    // Simple shallow merge - for deep merging, would need more sophisticated logic
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  snapshot(): string {
    return JSON.stringify(this.state);
  }

  restore(snapshot: string): void {
    try {
      this.state = JSON.parse(snapshot);
      this.notifyListeners();
    } catch (error) {
      throw new Error(`Failed to restore state from snapshot: ${error}`);
    }
  }

  subscribe(handler: (state: T) => void): () => void {
    this.listeners.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(handler);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const stateCopy = this.get();
    for (const listener of this.listeners) {
      try {
        listener(stateCopy);
      } catch (error) {
        console.error('Error in state store listener:', error);
      }
    }
  }

  // Debug utilities
  getListenerCount(): number {
    return this.listeners.length;
  }
}
