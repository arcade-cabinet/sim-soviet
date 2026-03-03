/**
 * @fileoverview Tests for timeline DB schema tables.
 *
 * Validates table structure, column names, types, foreign key references,
 * and that schema.ts re-exports the new tables.
 */

import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { divergencePoints, timelineEvents } from '@/db/timeline';

// ─── timelineEvents table ────────────────────────────────────────────────────

describe('timelineEvents table', () => {
  const columns = getTableColumns(timelineEvents);

  it('has table name "timeline_events"', () => {
    expect(getTableName(timelineEvents)).toBe('timeline_events');
  });

  it('has all expected columns', () => {
    const columnNames = Object.keys(columns);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id',
        'saveId',
        'eventId',
        'crisisType',
        'startYear',
        'endYear',
        'isHistorical',
        'parameters',
        'outcomes',
        'parentEventId',
        'divergenceDecision',
        'recordedTick',
      ]),
    );
    expect(columnNames).toHaveLength(12);
  });

  it('has id as integer primary key with autoIncrement', () => {
    expect(columns.id!.dataType).toBe('number');
    expect(columns.id!.primary).toBe(true);
  });

  it('has saveId as not-null integer referencing saves.id', () => {
    expect(columns.saveId!.dataType).toBe('number');
    expect(columns.saveId!.notNull).toBe(true);
  });

  it('has eventId as not-null text', () => {
    expect(columns.eventId!.dataType).toBe('string');
    expect(columns.eventId!.notNull).toBe(true);
  });

  it('has crisisType as not-null text', () => {
    expect(columns.crisisType!.dataType).toBe('string');
    expect(columns.crisisType!.notNull).toBe(true);
  });

  it('has startYear as not-null integer', () => {
    expect(columns.startYear!.dataType).toBe('number');
    expect(columns.startYear!.notNull).toBe(true);
  });

  it('has endYear as nullable integer', () => {
    expect(columns.endYear!.dataType).toBe('number');
    expect(columns.endYear!.notNull).toBe(false);
  });

  it('has isHistorical as boolean-mode integer defaulting to true', () => {
    expect(columns.isHistorical!.dataType).toBe('boolean');
    expect(columns.isHistorical!.hasDefault).toBe(true);
  });

  it('has parameters as nullable text (JSON)', () => {
    expect(columns.parameters!.dataType).toBe('string');
    expect(columns.parameters!.notNull).toBe(false);
  });

  it('has outcomes as nullable text (JSON)', () => {
    expect(columns.outcomes!.dataType).toBe('string');
    expect(columns.outcomes!.notNull).toBe(false);
  });

  it('has parentEventId as nullable text', () => {
    expect(columns.parentEventId!.dataType).toBe('string');
    expect(columns.parentEventId!.notNull).toBe(false);
  });

  it('has divergenceDecision as nullable text', () => {
    expect(columns.divergenceDecision!.dataType).toBe('string');
    expect(columns.divergenceDecision!.notNull).toBe(false);
  });

  it('has recordedTick as not-null integer', () => {
    expect(columns.recordedTick!.dataType).toBe('number');
    expect(columns.recordedTick!.notNull).toBe(true);
  });
});

// ─── divergencePoints table ──────────────────────────────────────────────────

describe('divergencePoints table', () => {
  const columns = getTableColumns(divergencePoints);

  it('has table name "divergence_points"', () => {
    expect(getTableName(divergencePoints)).toBe('divergence_points');
  });

  it('has all expected columns', () => {
    const columnNames = Object.keys(columns);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id',
        'saveId',
        'year',
        'month',
        'historicalContext',
        'playerChoice',
        'stateSnapshot',
        'divergenceTick',
      ]),
    );
    expect(columnNames).toHaveLength(8);
  });

  it('has id as integer primary key with autoIncrement', () => {
    expect(columns.id!.dataType).toBe('number');
    expect(columns.id!.primary).toBe(true);
  });

  it('has saveId as not-null integer referencing saves.id', () => {
    expect(columns.saveId!.dataType).toBe('number');
    expect(columns.saveId!.notNull).toBe(true);
  });

  it('has year as not-null integer', () => {
    expect(columns.year!.dataType).toBe('number');
    expect(columns.year!.notNull).toBe(true);
  });

  it('has month as not-null integer', () => {
    expect(columns.month!.dataType).toBe('number');
    expect(columns.month!.notNull).toBe(true);
  });

  it('has historicalContext as nullable text', () => {
    expect(columns.historicalContext!.dataType).toBe('string');
    expect(columns.historicalContext!.notNull).toBe(false);
  });

  it('has playerChoice as nullable text', () => {
    expect(columns.playerChoice!.dataType).toBe('string');
    expect(columns.playerChoice!.notNull).toBe(false);
  });

  it('has stateSnapshot as nullable text (JSON)', () => {
    expect(columns.stateSnapshot!.dataType).toBe('string');
    expect(columns.stateSnapshot!.notNull).toBe(false);
  });

  it('has divergenceTick as not-null integer', () => {
    expect(columns.divergenceTick!.dataType).toBe('number');
    expect(columns.divergenceTick!.notNull).toBe(true);
  });
});

// ─── schema re-exports ───────────────────────────────────────────────────────

describe('schema re-exports', () => {
  it('exports timelineEvents from schema.ts', () => {
    expect(schema.timelineEvents).toBeDefined();
    expect(schema.timelineEvents).toBe(timelineEvents);
  });

  it('exports divergencePoints from schema.ts', () => {
    expect(schema.divergencePoints).toBeDefined();
    expect(schema.divergencePoints).toBe(divergencePoints);
  });

  it('still exports existing tables', () => {
    expect(schema.saves).toBeDefined();
    expect(schema.resources).toBeDefined();
    expect(schema.chronology).toBeDefined();
    expect(schema.quotas).toBeDefined();
    expect(schema.buildings).toBeDefined();
    expect(schema.settings).toBeDefined();
  });
});
