// Kingdom by the Sea - Content Definitions
// This demonstrates how game-specific content would be defined using the new systems

import type { 
  BuildingType, 
  TileTypeDefinition, 
  UpgradeDefinition,
  ResourceType
} from '../../engine/systems';

// KBTS Resource Types
export const KBTS_RESOURCES: ResourceType[] = [
  {
    id: 'gold',
    name: 'Gold',
    description: 'Currency for buildings and upgrades',
    category: 'currency',
    min: 0,
    defaultValue: 3
  },
  {
    id: 'food',
    name: 'Food',
    description: 'Sustains population growth',
    category: 'basic',
    min: 0,
    defaultValue: 3
  },
  {
    id: 'wood',
    name: 'Wood',
    description: 'Construction material',
    category: 'material',
    min: 0,
    defaultValue: 2
  },
  {
    id: 'people',
    name: 'People',
    description: 'Population count',
    category: 'population',
    min: 0,
    defaultValue: 3
  },
  {
    id: 'actions',
    name: 'Actions',
    description: 'Turn-based action points',
    category: 'action',
    min: 0,
    max: 10,
    defaultValue: 3
  }
];

// KBTS Tile Types
export const KBTS_TILE_TYPES: TileTypeDefinition[] = [
  {
    id: 'water',
    name: 'Water',
    category: 'tile',
    description: 'Deep ocean water',
    traversable: false,
    buildable: false
  },
  {
    id: 'grass',
    name: 'Grassland',
    category: 'tile',
    description: 'Base buildable terrain',
    traversable: true,
    buildable: true
  },
  {
    id: 'forest',
    name: 'Forest',
    category: 'tile',
    description: 'Dense woodland that can be cleared for wood',
    traversable: true,
    buildable: false,
    resources: { wood: 2 }
  },
  {
    id: 'hill',
    name: 'Hills',
    category: 'tile',
    description: 'Rocky terrain suitable for mining',
    traversable: true,
    buildable: true
  },
  {
    id: 'mountain',
    name: 'Mountain',
    category: 'tile',
    description: 'High peaks rich in minerals',
    traversable: false,
    buildable: true
  },
  {
    id: 'burnt',
    name: 'Burnt Land',
    category: 'tile',
    description: 'Fire-damaged terrain',
    traversable: true,
    buildable: false
  },
  {
    id: 'rubble',
    name: 'Rubble',
    category: 'tile',
    description: 'Destroyed building remains',
    traversable: true,
    buildable: false
  }
];

// KBTS Building Types
export const KBTS_BUILDINGS: BuildingType[] = [
  {
    id: 'farm',
    name: 'Farm',
    category: 'building',
    description: 'Produces food each turn',
    cost: { wood: 1 },
    buildTime: 1,
    provides: ['food_production'],
    requires: ['grass'],
    placement: [
      { type: 'on_tile', target: 'grass' }
    ]
  },
  {
    id: 'hut',
    name: 'Hut',
    category: 'building',
    description: 'Basic housing for population',
    cost: { wood: 1 },
    buildTime: 1,
    provides: ['housing'],
    requires: ['grass'],
    placement: [
      { type: 'on_tile', target: 'grass' },
      { type: 'not_adjacent', target: 'house', distance: 1 }
    ]
  },
  {
    id: 'house',
    name: 'House',
    category: 'building',
    description: 'Improved housing with gold generation',
    cost: { gold: 1, wood: 1 },
    buildTime: 1,
    provides: ['housing', 'gold_production'],
    requires: ['grass'],
    placement: [
      { type: 'on_tile', target: 'grass' },
      { type: 'not_adjacent', target: 'house', distance: 1 }
    ]
  },
  {
    id: 'mansion',
    name: 'Mansion',
    category: 'building',
    description: 'Large residence generating significant gold',
    cost: { gold: 2 },
    buildTime: 2,
    provides: ['housing', 'gold_production'],
    requires: ['grass']
  },
  {
    id: 'palace',
    name: 'Palace',
    category: 'building',
    description: 'Royal residence with high gold output',
    cost: { gold: 3 },
    buildTime: 2,
    provides: ['housing', 'gold_production'],
    requires: ['grass']
  },
  {
    id: 'castle',
    name: 'Castle',
    category: 'building',
    description: 'Fortified palace with maximum gold generation',
    cost: { gold: 4 },
    buildTime: 3,
    provides: ['housing', 'gold_production', 'defense'],
    requires: ['grass']
  },
  {
    id: 'mine',
    name: 'Mine',
    category: 'building',
    description: 'Extracts gold from rocky terrain',
    cost: { gold: 1 },
    buildTime: 1,
    provides: ['gold_production'],
    requires: ['hill', 'mountain'],
    placement: [
      { type: 'on_tile', target: 'hill' },
      { type: 'on_tile', target: 'mountain' }
    ]
  },
  {
    id: 'dock',
    name: 'Dock',
    category: 'building',
    description: 'Coastal structure for fishing and trade',
    cost: { wood: 1 },
    buildTime: 1,
    provides: ['food_production', 'gold_production'],
    requires: ['water'],
    placement: [
      { type: 'adjacent', target: 'water', distance: 1 }
    ]
  }
];

// KBTS Upgrade Paths
export const KBTS_UPGRADES: UpgradeDefinition[] = [
  // Terrain clearing
  {
    id: 'clear_forest',
    name: 'Clear Forest',
    category: 'upgrade',
    description: 'Clear forest to create grassland',
    from: 'forest',
    to: 'grass',
    cost: {},
    duration: 1,
    instant: { wood: 2 }
  },
  {
    id: 'restore_burnt',
    name: 'Restore Burnt Land',
    category: 'upgrade',
    description: 'Restore burnt land to grassland',
    from: 'burnt',
    to: 'grass',
    cost: { wood: 1 },
    duration: 1
  },
  {
    id: 'clear_rubble',
    name: 'Clear Rubble',
    category: 'upgrade',
    description: 'Clear rubble to build a hut',
    from: 'rubble',
    to: 'hut',
    cost: { wood: 1 },
    duration: 1
  },

  // Building upgrades
  {
    id: 'farm_to_house',
    name: 'Build House on Farm',
    category: 'upgrade',
    description: 'Replace farm with house',
    from: 'farm',
    to: 'house',
    cost: { gold: 1, wood: 1 },
    duration: 1,
    instant: { people: 1 },
    requirements: [
      {
        type: 'custom',
        message: 'needs 1-tile spacing from other houses',
        validate: (context) => {
          // Custom validation logic would go here
          return true;
        }
      }
    ]
  },
  {
    id: 'hut_to_house',
    name: 'Upgrade Hut to House',
    category: 'upgrade',
    description: 'Improve hut into house',
    from: 'hut',
    to: 'house',
    cost: { gold: 1, wood: 1 },
    duration: 1,
    requirements: [
      {
        type: 'custom',
        message: 'needs 1-tile spacing from other houses',
        validate: (context) => {
          // Custom validation logic would go here
          return true;
        }
      }
    ]
  },
  {
    id: 'house_to_mansion',
    name: 'Upgrade House to Mansion',
    category: 'upgrade',
    description: 'Expand house into mansion',
    from: 'house',
    to: 'mansion',
    cost: { gold: 2 },
    duration: 2,
    perTurn: { gold: 1 }
  },
  {
    id: 'mansion_to_palace',
    name: 'Upgrade Mansion to Palace',
    category: 'upgrade',
    description: 'Transform mansion into palace',
    from: 'mansion',
    to: 'palace',
    cost: { gold: 3 },
    duration: 2,
    perTurn: { gold: 2 }
  },
  {
    id: 'palace_to_castle',
    name: 'Upgrade Palace to Castle',
    category: 'upgrade',
    description: 'Fortify palace into castle',
    from: 'palace',
    to: 'castle',
    cost: { gold: 4 },
    duration: 3,
    perTurn: { gold: 3 }
  }
];

// Content pack definition
export const KBTS_CONTENT_PACK = {
  id: 'kbts.base.v1',
  name: 'Kingdom by the Sea - Base Content',
  version: '1.0.0',
  resources: KBTS_RESOURCES,
  tileTypes: KBTS_TILE_TYPES,
  buildings: KBTS_BUILDINGS,
  upgrades: KBTS_UPGRADES
};
