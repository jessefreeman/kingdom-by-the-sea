// Core 4X Engine Systems - Content definition and registry framework

import type { EngineContext } from '../contracts/plugins';

export interface ContentType {
  id: string;
  name: string;
  category: string;
  description?: string;
  properties?: Record<string, any>;
  dependencies?: string[];
  conflicts?: string[];
}

export interface BuildingType extends ContentType {
  category: 'building';
  cost?: Record<string, number>;
  buildTime?: number;
  provides?: string[];
  requires?: string[];
  maxCount?: number;
  placement?: PlacementRule[];
}

export interface TileTypeDefinition extends ContentType {
  category: 'tile';
  traversable?: boolean;
  buildable?: boolean;
  resources?: Record<string, number>;
  upgrades?: string[];
}

export interface UpgradeDefinition extends ContentType {
  category: 'upgrade';
  from: string;
  to: string;
  cost?: Record<string, number>;
  duration?: number;
  instant?: Record<string, number>;
  perTurn?: Record<string, number>;
  requirements?: UpgradeRequirement[];
}

export interface PlacementRule {
  type: 'adjacent' | 'not_adjacent' | 'on_tile' | 'near_resource' | 'custom';
  target?: string;
  distance?: number;
  validate?: (x: number, y: number, context: EngineContext) => boolean;
}

export interface UpgradeRequirement {
  type: 'resource' | 'building' | 'technology' | 'custom';
  target?: string;
  amount?: number;
  validate?: (context: EngineContext) => boolean;
  message?: string;
}

export interface ContentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ContentRegistry {
  private context!: EngineContext;
  private content: Map<string, Map<string, ContentType>> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();

  constructor() {
    // Initialize category maps
    this.content.set('tile', new Map());
    this.content.set('building', new Map());
    this.content.set('upgrade', new Map());
    this.content.set('technology', new Map());
    this.content.set('resource', new Map());
  }

  init(context: EngineContext): void {
    this.context = context;
    context.services.provide('content', this);
  }

  /**
   * Register content of any type
   */
  register(category: string, id: string, definition: ContentType): boolean {
    // Validate the content definition
    const validation = this.validateContent(definition);
    if (!validation.isValid) {
      this.context.logger.error(`Content validation failed for ${category}:${id}:`, validation.errors);
      return false;
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      this.context.logger.warn(`Content warnings for ${category}:${id}:`, validation.warnings);
    }

    // Ensure category exists
    if (!this.content.has(category)) {
      this.content.set(category, new Map());
    }

    // Store the content
    const categoryMap = this.content.get(category)!;
    categoryMap.set(id, definition);

    // Track dependencies
    if (definition.dependencies) {
      this.dependencies.set(`${category}:${id}`, new Set(definition.dependencies));
    }

    this.context.events.publish('content.registered', {
      category,
      id,
      definition
    });

    this.context.logger.debug(`Registered ${category}: ${id}`);
    return true;
  }

  /**
   * Get content by category and id
   */
  get<T extends ContentType>(category: string, id: string): T | undefined {
    const categoryMap = this.content.get(category);
    return categoryMap?.get(id) as T | undefined;
  }

  /**
   * Get all content in a category
   */
  getByCategory<T extends ContentType>(category: string): T[] {
    const categoryMap = this.content.get(category);
    return categoryMap ? Array.from(categoryMap.values()) as T[] : [];
  }

  /**
   * Get building type definition
   */
  getBuilding(id: string): BuildingType | undefined {
    return this.get<BuildingType>('building', id);
  }

  /**
   * Get tile type definition
   */
  getTileType(id: string): TileTypeDefinition | undefined {
    return this.get<TileTypeDefinition>('tile', id);
  }

  /**
   * Get upgrade definition
   */
  getUpgrade(id: string): UpgradeDefinition | undefined {
    return this.get<UpgradeDefinition>('upgrade', id);
  }

  /**
   * Get all buildings
   */
  getBuildings(): BuildingType[] {
    return this.getByCategory<BuildingType>('building');
  }

  /**
   * Get all tile types
   */
  getTileTypes(): TileTypeDefinition[] {
    return this.getByCategory<TileTypeDefinition>('tile');
  }

  /**
   * Get all upgrades
   */
  getUpgrades(): UpgradeDefinition[] {
    return this.getByCategory<UpgradeDefinition>('upgrade');
  }

  /**
   * Check if content exists
   */
  has(category: string, id: string): boolean {
    const categoryMap = this.content.get(category);
    return categoryMap?.has(id) || false;
  }

  /**
   * Remove content
   */
  remove(category: string, id: string): boolean {
    const categoryMap = this.content.get(category);
    if (categoryMap?.has(id)) {
      categoryMap.delete(id);
      this.dependencies.delete(`${category}:${id}`);
      
      this.context.events.publish('content.removed', {
        category,
        id
      });

      return true;
    }
    return false;
  }

  /**
   * Get available upgrades for a tile type
   */
  getAvailableUpgrades(fromType: string): UpgradeDefinition[] {
    return this.getUpgrades().filter(upgrade => upgrade.from === fromType);
  }

  /**
   * Get buildings that can be placed on a tile type
   */
  getBuildingsForTile(tileType: string): BuildingType[] {
    return this.getBuildings().filter(building => {
      return !building.requires || building.requires.includes(tileType);
    });
  }

  /**
   * Validate placement rules for a building
   */
  validatePlacement(buildingId: string, x: number, y: number): { valid: boolean; reason?: string } {
    const building = this.getBuilding(buildingId);
    if (!building) {
      return { valid: false, reason: 'Unknown building type' };
    }

    if (!building.placement) {
      return { valid: true };
    }

    for (const rule of building.placement) {
      const result = this.validatePlacementRule(rule, x, y);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * Validate upgrade requirements
   */
  validateUpgradeRequirements(upgradeId: string): { valid: boolean; reason?: string } {
    const upgrade = this.getUpgrade(upgradeId);
    if (!upgrade) {
      return { valid: false, reason: 'Unknown upgrade type' };
    }

    if (!upgrade.requirements) {
      return { valid: true };
    }

    for (const requirement of upgrade.requirements) {
      const result = this.validateUpgradeRequirement(requirement);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * Get content dependency graph
   */
  getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.dependencies);
  }

  /**
   * Validate content dependencies
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [contentId, deps] of this.dependencies) {
      for (const depId of deps) {
        if (!this.hasContentById(depId)) {
          errors.push(`${contentId} depends on missing content: ${depId}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateContent(definition: ContentType): ContentValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!definition.id || definition.id.trim() === '') {
      errors.push('Content must have a non-empty id');
    }

    if (!definition.name || definition.name.trim() === '') {
      errors.push('Content must have a non-empty name');
    }

    if (!definition.category || definition.category.trim() === '') {
      errors.push('Content must have a category');
    }

    // Category-specific validation
    if (definition.category === 'building') {
      const building = definition as BuildingType;
      if (building.maxCount !== undefined && building.maxCount < 1) {
        errors.push('Building maxCount must be greater than 0');
      }
    }

    if (definition.category === 'upgrade') {
      const upgrade = definition as UpgradeDefinition;
      if (!upgrade.from || !upgrade.to) {
        errors.push('Upgrade must specify both from and to types');
      }
      if (upgrade.from === upgrade.to) {
        warnings.push('Upgrade from and to types are the same');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validatePlacementRule(rule: PlacementRule, x: number, y: number): { valid: boolean; reason?: string } {
    if (rule.validate) {
      return rule.validate(x, y, this.context) ? 
        { valid: true } : 
        { valid: false, reason: 'Custom placement rule failed' };
    }

    // Handle built-in placement rule types
    switch (rule.type) {
      case 'on_tile':
        // Implementation would depend on tile system
        return { valid: true };
      
      case 'adjacent':
      case 'not_adjacent':
        // Implementation would depend on tile system and neighbors
        return { valid: true };
      
      default:
        return { valid: true };
    }
  }

  private validateUpgradeRequirement(requirement: UpgradeRequirement): { valid: boolean; reason?: string } {
    if (requirement.validate) {
      return requirement.validate(this.context) ? 
        { valid: true } : 
        { valid: false, reason: requirement.message || 'Custom requirement failed' };
    }

    // Handle built-in requirement types
    switch (requirement.type) {
      case 'resource':
        // Implementation would depend on resource system
        return { valid: true };
      
      case 'building':
        // Implementation would depend on building count system
        return { valid: true };
      
      default:
        return { valid: true };
    }
  }

  private hasContentById(contentId: string): boolean {
    const parts = contentId.split(':');
    if (parts.length !== 2) return false;
    
    const [category, id] = parts;
    if (!category || !id) return false;
    
    return this.has(category, id);
  }
}
