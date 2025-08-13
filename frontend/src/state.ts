import type { State, Cell } from './types';
import { KB } from './compat';

export const state = (): State => KB().state;
export const idx = (x: number, y: number) => KB().idx(x, y);
export const inBounds = (x: number, y: number) => KB().inBounds(x, y);
export const each = (fn: (x: number, y: number, cell: Cell) => void) => KB().each(fn);
