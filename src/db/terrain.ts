import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const terrainTiles = sqliteTable('terrain_tiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  terrainType: text('terrain_type').notNull().default('grass'),
  fertility: integer('fertility').notNull().default(50),
  contamination: integer('contamination').notNull().default(0),
  moisture: integer('moisture').notNull().default(50),
  forestAge: integer('forest_age').notNull().default(0),
  erosionLevel: integer('erosion_level').notNull().default(0),
  elevation: integer('elevation').notNull().default(0),
  hasRoad: integer('has_road', { mode: 'boolean' }).notNull().default(false),
  hasPipe: integer('has_pipe', { mode: 'boolean' }).notNull().default(false),
  modifiedYear: integer('modified_year').notNull().default(1917),
});

export type TerrainTileType = 'forest' | 'steppe' | 'marsh' | 'tundra' | 'water' | 'mountain' | 'urban' | 'rubble' | 'crater' | 'contaminated' | 'grass';
