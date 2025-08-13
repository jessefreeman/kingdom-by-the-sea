import type { KBTSApi } from './types';

export function KB(): KBTSApi {
  return (window as any).KBTS as KBTSApi;
}
