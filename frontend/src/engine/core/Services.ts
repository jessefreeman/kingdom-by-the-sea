// Simple dependency injection service locator

import type { ServiceLocator } from '../contracts/plugins';

export class SimpleServiceLocator implements ServiceLocator {
  private services: Map<string, unknown> = new Map();

  get<T>(id: string): T {
    if (!this.services.has(id)) {
      throw new Error(`Service "${id}" not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }
    return this.services.get(id) as T;
  }

  provide<T>(id: string, service: T): void {
    if (this.services.has(id)) {
      console.warn(`Service "${id}" is being replaced`);
    }
    this.services.set(id, service);
  }

  has(id: string): boolean {
    return this.services.has(id);
  }

  remove(id: string): boolean {
    return this.services.delete(id);
  }

  // Debug utilities
  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  getServiceCount(): number {
    return this.services.size;
  }
}
