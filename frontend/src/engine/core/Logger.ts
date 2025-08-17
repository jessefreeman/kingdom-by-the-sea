// Simple console logger implementation

import type { Logger } from '../contracts/plugins';

export class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(prefix: string = 'KBTS') {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.prefix}:DEBUG]`, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.prefix}:INFO]`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}:WARN]`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}:ERROR]`, message, ...args);
  }
}
