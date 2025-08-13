import { KB } from './compat';
import type { UpgradeSpec } from './types';

export const SPEC = () => KB().SPEC;
export const BASE = () => KB().BASE;
export const afford = (c: any) => KB().afford(c);
export const whyNo = (s: any, cell: any) => KB().whyNo(s, cell);
export const uniqueAvailable = (to: any) => KB().uniqueAvailable(to);
export const applyAdjacencyBonuses = (d: any) => KB().applyAdjacencyBonuses(d);
export const startUpgrade = (x: number, y: number, c: any, s: UpgradeSpec) => KB().startUpgrade(x, y, c, s as any);
export const endTurn = () => KB().endTurn();
