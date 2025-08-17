// Time service for the engine

import type { Time } from '../contracts/plugins';

export class EngineTime implements Time {
  private startTime: number;
  private currentTick: number = 0;
  private lastTickTime: number;
  private timestepMs: number;

  constructor(timestepMs: number = 33.333) { // 30 Hz default
    this.timestepMs = timestepMs;
    this.startTime = performance.now();
    this.lastTickTime = this.startTime;
  }

  now(): number {
    return performance.now();
  }

  tick(): number {
    return this.currentTick;
  }

  delta(): number {
    return this.now() - this.lastTickTime;
  }

  tickDelta(): number {
    return this.timestepMs;
  }

  // Internal methods for engine use
  advanceTick(): void {
    this.currentTick++;
    this.lastTickTime = this.now();
  }

  getElapsedTime(): number {
    return this.now() - this.startTime;
  }

  reset(): void {
    this.startTime = performance.now();
    this.currentTick = 0;
    this.lastTickTime = this.startTime;
  }

  setTimestep(timestepMs: number): void {
    this.timestepMs = timestepMs;
  }
}
