// Simple pub/sub event bus implementation

import type { EventBus } from '../contracts/plugins';

export class SimpleEventBus implements EventBus {
  private listeners: Map<string, Array<(payload: any) => void>> = new Map();
  private onceListeners: Map<string, Array<(payload: any) => void>> = new Map();

  publish<T = unknown>(topic: string, payload?: T): void {
    // Handle regular listeners
    const topicListeners = this.listeners.get(topic);
    if (topicListeners) {
      // Make a copy to avoid issues if listeners are modified during iteration
      const listenersCopy = [...topicListeners];
      for (const listener of listenersCopy) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for topic "${topic}":`, error);
        }
      }
    }

    // Handle once listeners
    const onceListeners = this.onceListeners.get(topic);
    if (onceListeners && onceListeners.length > 0) {
      const listenersCopy = [...onceListeners];
      // Clear once listeners before calling them
      this.onceListeners.set(topic, []);
      
      for (const listener of listenersCopy) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in once event listener for topic "${topic}":`, error);
        }
      }
    }
  }

  subscribe<T = unknown>(topic: string, handler: (payload: T) => void): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, []);
    }
    
    const topicListeners = this.listeners.get(topic)!;
    topicListeners.push(handler as (payload: any) => void);

    // Return unsubscribe function
    return () => {
      const index = topicListeners.indexOf(handler as (payload: any) => void);
      if (index > -1) {
        topicListeners.splice(index, 1);
      }
    };
  }

  once<T = unknown>(topic: string, handler: (payload: T) => void): () => void {
    if (!this.onceListeners.has(topic)) {
      this.onceListeners.set(topic, []);
    }
    
    const topicListeners = this.onceListeners.get(topic)!;
    topicListeners.push(handler as (payload: any) => void);

    // Return unsubscribe function
    return () => {
      const index = topicListeners.indexOf(handler as (payload: any) => void);
      if (index > -1) {
        topicListeners.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  // Debug utilities
  getTopics(): string[] {
    const allTopics = new Set([
      ...this.listeners.keys(),
      ...this.onceListeners.keys()
    ]);
    return Array.from(allTopics);
  }

  getListenerCount(topic: string): number {
    const regular = this.listeners.get(topic)?.length || 0;
    const once = this.onceListeners.get(topic)?.length || 0;
    return regular + once;
  }
}
