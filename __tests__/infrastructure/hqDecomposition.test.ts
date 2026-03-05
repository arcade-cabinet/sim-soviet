import {
  getHQFunctions,
  checkDecompositionTriggers,
  decomposeFunction,
  HQ_FUNCTION_THRESHOLDS,
  type DecompositionResult,
  type HQFunction,
} from '@/ai/agents/infrastructure/hqDecomposition';

// ── getHQFunctions ──────────────────────────────────────────────────────────

describe('getHQFunctions', () => {
  it('returns all six HQ functions', () => {
    const fns = getHQFunctions();
    expect(fns).toEqual([
      'administration',
      'storage',
      'clinic',
      'canteen',
      'school',
      'militia_post',
    ]);
  });

  it('returns a fresh array each call (no mutation risk)', () => {
    const a = getHQFunctions();
    const b = getHQFunctions();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ── checkDecompositionTriggers ──────────────────────────────────────────────

describe('checkDecompositionTriggers', () => {
  const allFunctions: HQFunction[] = [
    'administration',
    'storage',
    'clinic',
    'canteen',
    'school',
    'militia_post',
  ];

  it('returns empty array when population is below all thresholds', () => {
    const result = checkDecompositionTriggers(10, allFunctions);
    expect(result).toEqual([]);
  });

  it('triggers storage split at population > 30', () => {
    const result = checkDecompositionTriggers(31, allFunctions);
    expect(result).toEqual(['storage']);
  });

  it('does NOT trigger storage at exactly 30 (strict >)', () => {
    const result = checkDecompositionTriggers(30, allFunctions);
    expect(result).toEqual([]);
  });

  it('triggers clinic at pop > 50', () => {
    const result = checkDecompositionTriggers(51, allFunctions);
    expect(result).toContain('clinic');
    expect(result).toContain('storage');
  });

  it('triggers canteen at pop > 75', () => {
    const result = checkDecompositionTriggers(76, allFunctions);
    expect(result).toContain('canteen');
  });

  it('triggers school at pop > 100', () => {
    const result = checkDecompositionTriggers(101, allFunctions);
    expect(result).toContain('school');
  });

  it('triggers militia_post at pop > 150', () => {
    const result = checkDecompositionTriggers(151, allFunctions);
    expect(result).toContain('militia_post');
    // All non-admin functions should be triggered
    expect(result).toHaveLength(5);
  });

  it('never triggers administration (it IS the HQ)', () => {
    const result = checkDecompositionTriggers(10000, allFunctions);
    expect(result).not.toContain('administration');
  });

  it('only triggers functions still hosted by HQ', () => {
    // Storage already split off — should not appear in triggers
    const remaining: HQFunction[] = ['administration', 'clinic', 'canteen', 'school', 'militia_post'];
    const result = checkDecompositionTriggers(200, remaining);
    expect(result).not.toContain('storage');
    expect(result).toContain('clinic');
  });

  it('returns empty when all splittable functions already removed', () => {
    const onlyAdmin: HQFunction[] = ['administration'];
    const result = checkDecompositionTriggers(500, onlyAdmin);
    expect(result).toEqual([]);
  });

  it('returns triggers in threshold order (ascending population)', () => {
    const result = checkDecompositionTriggers(200, allFunctions);
    const order = ['storage', 'clinic', 'canteen', 'school', 'militia_post'];
    expect(result).toEqual(order);
  });
});

// ── decomposeFunction ───────────────────────────────────────────────────────

describe('decomposeFunction', () => {
  const makeHQBuilding = (functions?: HQFunction[]) => ({
    defId: 'government-hq',
    functions: functions ?? [...getHQFunctions()],
    gridX: 10,
    gridY: 10,
  });

  it('removes the function from HQ and returns a new building def', () => {
    const hq = makeHQBuilding();
    const result = decomposeFunction(hq, 'storage');

    expect(result.success).toBe(true);
    expect(result.removedFunction).toBe('storage');
    expect(result.remainingFunctions).not.toContain('storage');
    expect(result.remainingFunctions).toContain('administration');
    expect(result.newBuildingDefId).toBe('warehouse');
  });

  it('maps clinic to polyclinic building', () => {
    const hq = makeHQBuilding();
    const result = decomposeFunction(hq, 'clinic');
    expect(result.newBuildingDefId).toBe('polyclinic');
  });

  it('maps school to school building', () => {
    const hq = makeHQBuilding();
    const result = decomposeFunction(hq, 'school');
    expect(result.newBuildingDefId).toBe('school');
  });

  it('maps militia_post to guard-post building', () => {
    const hq = makeHQBuilding();
    const result = decomposeFunction(hq, 'militia_post');
    expect(result.newBuildingDefId).toBe('guard-post');
  });

  it('maps canteen to bread-factory building', () => {
    const hq = makeHQBuilding();
    const result = decomposeFunction(hq, 'canteen');
    expect(result.newBuildingDefId).toBe('bread-factory');
  });

  it('fails when function is not hosted by HQ', () => {
    const hq = makeHQBuilding(['administration', 'clinic']);
    const result = decomposeFunction(hq, 'storage');
    expect(result.success).toBe(false);
    expect(result.remainingFunctions).toEqual(['administration', 'clinic']);
  });

  it('fails when trying to decompose administration', () => {
    const hq = makeHQBuilding();
    const result = decomposeFunction(hq, 'administration');
    expect(result.success).toBe(false);
  });

  it('does not mutate the input building functions array', () => {
    const hq = makeHQBuilding();
    const originalFunctions = [...hq.functions];
    decomposeFunction(hq, 'storage');
    expect(hq.functions).toEqual(originalFunctions);
  });
});

// ── HQ_FUNCTION_THRESHOLDS ─────────────────────────────────────────────────

describe('HQ_FUNCTION_THRESHOLDS', () => {
  it('has correct population thresholds', () => {
    expect(HQ_FUNCTION_THRESHOLDS.storage).toBe(30);
    expect(HQ_FUNCTION_THRESHOLDS.clinic).toBe(50);
    expect(HQ_FUNCTION_THRESHOLDS.canteen).toBe(75);
    expect(HQ_FUNCTION_THRESHOLDS.school).toBe(100);
    expect(HQ_FUNCTION_THRESHOLDS.militia_post).toBe(150);
  });

  it('does not have a threshold for administration', () => {
    expect(HQ_FUNCTION_THRESHOLDS).not.toHaveProperty('administration');
  });
});
