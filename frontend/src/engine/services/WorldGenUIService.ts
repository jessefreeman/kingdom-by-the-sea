import { IslandWorldgenPlugin } from '../../plugins/worldgen/islands/IslandWorldgen';
import { type RNGService } from './RNGService';
import { type WorldGenService } from './WorldGenService';

/**
 * Service for world generation UI, configuration, and plugin management.
 * Handles create mode, generation parameters, and plugin initialization.
 */
export class WorldGenUIService {
  private rngService: RNGService;
  private worldGenService: WorldGenService;

  constructor(rngService: RNGService, worldGenService: WorldGenService) {
    this.rngService = rngService;
    this.worldGenService = worldGenService;
  }

  /**
   * Access world generation configuration through service
   */
  getCreateMode(): boolean {
    return this.worldGenService.getCreateMode();
  }

  setCreateMode(enabled: boolean): void {
    this.worldGenService.setCreateMode(enabled);
  }

  getGenParams(): any {
    return this.worldGenService.getGenParams();
  }

  setGenParams(params: any): void {
    this.worldGenService.setGenParams(params);
  }

  getOrgParams(): any {
    return this.worldGenService.getOrgParams();
  }

  setOrgParams(params: any): void {
    this.worldGenService.setOrgParams(params);
  }

  /**
   * Initialize worldgen plugin for use with legacy generate function
   */
  async initWorldgenPlugin(state: any): Promise<any> {
    // Create a minimal engine context for the plugin
    const engineContext = {
      rng: {
        next: () => this.rngService.worldGen(),
        seed: (newSeed: number) => {
          // Re-initialize the worldgen RNG with new seed
          this.rngService.setGenerationSeed(newSeed);
        }
      },
      events: {
        publish: (event: string, data: any) => {
          console.log(`Worldgen event: ${event}`, data);
        }
      },
      state: {
        get: () => ({ 
          map: {
            cells: state.map,  // Plugin expects cells array
            width: state.size.w,
            height: state.size.h
          }, 
          size: state.size, 
          seed: state.seed 
        }),
        set: (newState: any) => {
          // If the plugin modified map.cells, copy it back to legacy state.map
          if (newState.map && newState.map.cells) {
            state.map = newState.map.cells;
          }
          // Copy other properties except 'map' which we handled above
          const { map, ...otherProps } = newState;
          Object.assign(state, otherProps);
        }
      },
      services: {
        provide: (id: string, service: any) => {
          console.log(`Service "${id}" provided`);
        },
        get: (id: string) => {
          throw new Error(`Service "${id}" not available in legacy mode`);
        }
      },
      logger: {
        info: (msg: string) => console.log(`[Worldgen] ${msg}`),
        warn: (msg: string) => console.warn(`[Worldgen] ${msg}`),
        error: (msg: string) => console.error(`[Worldgen] ${msg}`)
      }
    };

    const plugin = new IslandWorldgenPlugin();
    await plugin.init(engineContext as any);
    plugin.start(engineContext as any);
    return plugin;
  }

  /**
   * Generate a new world using the WorldGenService
   */
  async generate(
    state: any,
    seed = Date.now(),
    size: "small" | "medium" | "large" = "medium"
  ): Promise<void> {
    // Use WorldGenService for world generation
    await this.worldGenService.generate(state, seed, size);
  }

  /**
   * Reveal tiles around a center point
   */
  reveal(state: any, cx: number, cy: number, r: number): void {
    this.worldGenService.reveal(state, cx, cy, r);
  }

  /**
   * Ensure starting resources at a location
   */
  ensureStartResources(state: any, sx: number, sy: number): void {
    this.worldGenService.ensureStartResources(state, sx, sy);
  }

  /**
   * Compute height map for the world
   */
  computeHeightMap(state: any): void {
    this.worldGenService.computeHeightMap(state);
  }

  /**
   * Create a deterministic sub-RNG for specific operations
   */
  createSubRng(baseSeed: number, operation: string, x?: number, y?: number): () => number {
    return this.worldGenService.createSubRng(baseSeed, operation, x, y);
  }
}
