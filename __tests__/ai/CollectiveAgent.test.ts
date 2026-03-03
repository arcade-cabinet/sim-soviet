import {
  CANDIDATE_LIMIT,
  CollectiveAgent,
  type CollectiveAgentState,
  FOOD_CRISIS_THRESHOLD,
  FOOD_CRITICAL_THRESHOLD,
  FOOD_DEMAND_THRESHOLD,
  FOOD_FOCUS_MULTIPLIER,
  HOUSING_OCCUPANCY_THRESHOLD,
  MAX_PLACEMENT_DISTANCE,
  REPAIR_THRESHOLD,
} from '../../src/ai/agents/infrastructure/CollectiveAgent';

describe('CollectiveAgent', () => {
  // ── Instantiation ──────────────────────────────────────────────────────────

  it('can be instantiated with name CollectiveAgent', () => {
    const agent = new CollectiveAgent();
    expect(agent.name).toBe('CollectiveAgent');
  });

  it('starts with balanced focus', () => {
    const agent = new CollectiveAgent();
    expect(agent.getFocus()).toBe('balanced');
  });

  it('can set and get focus', () => {
    const agent = new CollectiveAgent();
    agent.setFocus('food');
    expect(agent.getFocus()).toBe('food');
    agent.setFocus('construction');
    expect(agent.getFocus()).toBe('construction');
    agent.setFocus('production');
    expect(agent.getFocus()).toBe('production');
    agent.setFocus('balanced');
    expect(agent.getFocus()).toBe('balanced');
  });

  // ── Governor: Priority Evaluation ─────────────────────────────────────────

  describe('evaluateWorkerPriority', () => {
    const makeResources = (food: number, population: number) => ({
      food,
      population,
      vodka: 100,
      power: 100,
      rubles: 1000,
      smog: 0,
    });

    const makeWorkerStats = () => ({
      morale: 80,
      loyalty: 80,
      skill: 50,
      vodkaDependency: 0,
      ticksSinceVodka: 0,
      name: 'Ivan',
      assignmentDuration: 0,
      assignmentSource: 'auto' as const,
    });

    it('returns survive when food per capita is critically low', () => {
      const agent = new CollectiveAgent();
      const worker = { citizen: { hunger: 0, age: 25, class: 'worker', assignment: null } } as any;
      // food = 1 for 10 people = 0.1 per capita (below FOOD_CRISIS_THRESHOLD = 2.0)
      const resources = makeResources(1, 10);
      const result = agent.evaluateWorkerPriority(worker, makeWorkerStats(), resources, 'balanced');
      expect(result).toBe('survive');
    });

    it('returns survive when individual hunger is critically high', () => {
      const agent = new CollectiveAgent();
      // hunger >= 60 (HUNGER_CRISIS_THRESHOLD) triggers survive
      const worker = { citizen: { hunger: 70, age: 25, class: 'worker', assignment: null } } as any;
      const resources = makeResources(10000, 10); // plenty of food otherwise
      const result = agent.evaluateWorkerPriority(worker, makeWorkerStats(), resources, 'balanced');
      expect(result).toBe('survive');
    });

    it('food focus triples the food threshold for crisis detection', () => {
      const agent = new CollectiveAgent();
      const worker = { citizen: { hunger: 0, age: 25, class: 'worker', assignment: null } } as any;
      // foodPerCapita = 4.0 — above balanced threshold (2.0) but below food-focus threshold (6.0)
      const resources = makeResources(40, 10);
      const balancedResult = agent.evaluateWorkerPriority(worker, makeWorkerStats(), resources, 'balanced');
      expect(balancedResult).not.toBe('survive');

      const foodResult = agent.evaluateWorkerPriority(worker, makeWorkerStats(), resources, 'food');
      expect(foodResult).toBe('survive');
    });

    it('returns private when nothing is urgent', () => {
      const agent = new CollectiveAgent();
      const worker = { citizen: { hunger: 0, age: 25, class: 'worker', assignment: null } } as any;
      // abundant food, no construction, no producers, no damaged buildings
      const resources = makeResources(10000, 10);
      const result = agent.evaluateWorkerPriority(worker, makeWorkerStats(), resources, 'balanced');
      // Without ECS world data, hasOperationalProducers and hasDamagedBuildings return false
      // so should be 'private'
      expect(result).toBe('private');
    });
  });

  describe('runGovernor', () => {
    const makeResources = (food: number, population: number) => ({
      food,
      population,
      vodka: 100,
      power: 100,
      rubles: 1000,
      smog: 0,
    });

    it('returns null for children under 14', () => {
      const agent = new CollectiveAgent();
      const child = { citizen: { hunger: 0, age: 10, class: 'worker', assignment: null } } as any;
      const stats = {
        assignmentSource: 'auto' as const,
        morale: 50,
        loyalty: 50,
        skill: 50,
        vodkaDependency: 0,
        ticksSinceVodka: 0,
        name: 'Kolya',
        assignmentDuration: 0,
      };
      const result = agent.runGovernor(child, stats, makeResources(100, 10));
      expect(result).toBeNull();
    });

    it('returns null for forced-assigned workers', () => {
      const agent = new CollectiveAgent();
      const worker = { citizen: { hunger: 0, age: 25, class: 'worker', assignment: null } } as any;
      const stats = {
        assignmentSource: 'forced' as const,
        morale: 50,
        loyalty: 50,
        skill: 50,
        vodkaDependency: 0,
        ticksSinceVodka: 0,
        name: 'Pavel',
        assignmentDuration: 0,
      };
      const result = agent.runGovernor(worker, stats, makeResources(1, 10)); // even food crisis
      expect(result).toBeNull();
    });

    it('returns null for player-assigned workers', () => {
      const agent = new CollectiveAgent();
      const worker = { citizen: { hunger: 0, age: 25, class: 'worker', assignment: null } } as any;
      const stats = {
        assignmentSource: 'player' as const,
        morale: 50,
        loyalty: 50,
        skill: 50,
        vodkaDependency: 0,
        ticksSinceVodka: 0,
        name: 'Misha',
        assignmentDuration: 0,
      };
      const result = agent.runGovernor(worker, stats, makeResources(1, 10)); // even food crisis
      expect(result).toBeNull();
    });
  });

  // ── Demand System: Shortage Detection ─────────────────────────────────────

  describe('detectConstructionDemands', () => {
    it('detects critical food demand when food per capita < 1.5', () => {
      const agent = new CollectiveAgent();
      const demands = agent.detectConstructionDemands(10, 20, { food: 10, vodka: 100, power: 100 });
      // food / population = 10/10 = 1.0 < FOOD_CRITICAL_THRESHOLD (1.5) → critical
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeDefined();
      expect(foodDemand?.priority).toBe('critical');
    });

    it('detects urgent food demand when food per capita is between 1.5 and 3.0', () => {
      const agent = new CollectiveAgent();
      // food/pop = 2.0, between 1.5 and 3.0
      const demands = agent.detectConstructionDemands(10, 20, { food: 20, vodka: 100, power: 100 });
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeDefined();
      expect(foodDemand?.priority).toBe('urgent');
    });

    it('does not generate food demand when food is sufficient', () => {
      const agent = new CollectiveAgent();
      // food/pop = 5.0 > 3.0 threshold
      const demands = agent.detectConstructionDemands(10, 20, { food: 50, vodka: 100, power: 100 });
      const foodDemand = demands.find((d) => d.category === 'food_production');
      expect(foodDemand).toBeUndefined();
    });

    it('detects critical housing demand when population exceeds capacity', () => {
      const agent = new CollectiveAgent();
      // pop=15 > housingCapacity=10
      const demands = agent.detectConstructionDemands(15, 10, { food: 100, vodka: 100, power: 100 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand?.priority).toBe('critical');
    });

    it('detects urgent housing demand at 80% occupancy', () => {
      const agent = new CollectiveAgent();
      // pop=8 / capacity=10 = 0.8 = exactly HOUSING_OCCUPANCY_THRESHOLD
      const demands = agent.detectConstructionDemands(8, 10, { food: 100, vodka: 100, power: 100 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeDefined();
      expect(housingDemand?.priority).toBe('urgent');
    });

    it('does not generate housing demand below 80% occupancy', () => {
      const agent = new CollectiveAgent();
      // pop=5 / capacity=10 = 0.5 < threshold
      const demands = agent.detectConstructionDemands(5, 10, { food: 100, vodka: 100, power: 100 });
      const housingDemand = demands.find((d) => d.category === 'housing');
      expect(housingDemand).toBeUndefined();
    });

    it('detects critical vodka demand when vodka per capita < 0.3', () => {
      const agent = new CollectiveAgent();
      // vodka/pop = 0.2 < VODKA_CRITICAL_THRESHOLD (0.3)
      const demands = agent.detectConstructionDemands(10, 20, { food: 100, vodka: 2, power: 100 });
      const vodkaDemand = demands.find((d) => d.category === 'vodka_production');
      expect(vodkaDemand).toBeDefined();
      expect(vodkaDemand?.priority).toBe('critical');
    });

    it('returns no demands when all resources are sufficient', () => {
      const agent = new CollectiveAgent();
      // Sufficient food, housing, vodka — power detection requires ECS world
      const demands = agent.detectConstructionDemands(5, 20, { food: 100, vodka: 100, power: 100 });
      // Only power might trigger from ECS world (none in test environment)
      const nonPowerDemands = demands.filter((d) => d.category !== 'power');
      expect(nonPowerDemands).toHaveLength(0);
    });

    it('returns empty demands for population=0', () => {
      const agent = new CollectiveAgent();
      const demands = agent.detectConstructionDemands(0, 0, { food: 0, vodka: 0, power: 0 });
      // All per-capita checks guard against population=0
      expect(demands.filter((d) => d.category !== 'power')).toHaveLength(0);
    });
  });

  // ── CollectivePlanner: Queue Generation ────────────────────────────────────

  describe('generateQueue', () => {
    it('returns empty queue with no mandates and no demands', () => {
      const agent = new CollectiveAgent();
      const queue = agent.generateQueue(null, []);
      expect(queue).toHaveLength(0);
    });

    it('includes unfulfilled mandates with sortPriority=10', () => {
      const agent = new CollectiveAgent();
      const mandateState = {
        mandates: [{ defId: 'power-station', label: 'Power Station', required: 2, fulfilled: 0 }],
      };
      const queue = agent.generateQueue(mandateState, []);
      expect(queue).toHaveLength(2); // one per remaining unit
      expect(queue[0]!.sortPriority).toBe(10);
      expect(queue[0]!.source).toBe('mandate');
    });

    it('skips fully fulfilled mandates', () => {
      const agent = new CollectiveAgent();
      const mandateState = {
        mandates: [{ defId: 'power-station', label: 'Power Station', required: 1, fulfilled: 1 }],
      };
      const queue = agent.generateQueue(mandateState, []);
      expect(queue).toHaveLength(0);
    });

    it('places critical demands (priority=0) before mandates (priority=10)', () => {
      const agent = new CollectiveAgent();
      const mandateState = {
        mandates: [{ defId: 'guard-post', label: 'Guard Post', required: 1, fulfilled: 0 }],
      };
      const demands = [
        {
          category: 'food_production' as const,
          priority: 'critical' as const,
          suggestedDefIds: ['collective-farm-hq'],
          reason: 'Food crisis',
        },
      ];
      const queue = agent.generateQueue(mandateState, demands);
      expect(queue[0]!.sortPriority).toBe(0); // critical demand first
      expect(queue[0]!.source).toBe('demand');
      expect(queue[1]!.sortPriority).toBe(10); // mandate second
    });

    it('deduplicates: skips demand if mandate already covers the defId', () => {
      const agent = new CollectiveAgent();
      const mandateState = {
        mandates: [{ defId: 'collective-farm-hq', label: 'Farm', required: 1, fulfilled: 0 }],
      };
      const demands = [
        {
          category: 'food_production' as const,
          priority: 'critical' as const,
          suggestedDefIds: ['collective-farm-hq'],
          reason: 'Food crisis',
        },
      ];
      const queue = agent.generateQueue(mandateState, demands);
      // collective-farm-hq appears only once (from mandate, not from demand)
      const farmRequests = queue.filter((r) => r.defId === 'collective-farm-hq');
      expect(farmRequests).toHaveLength(1);
      expect(farmRequests[0]!.source).toBe('mandate');
    });

    it('urgent demands get sortPriority=20, normal demands get 30', () => {
      const agent = new CollectiveAgent();
      const demands = [
        {
          category: 'housing' as const,
          priority: 'urgent' as const,
          suggestedDefIds: ['workers-house-a'],
          reason: 'Near capacity',
        },
        {
          category: 'vodka_production' as const,
          priority: 'normal' as const,
          suggestedDefIds: ['vodka-distillery'],
          reason: 'Could use more vodka',
        },
      ];
      const queue = agent.generateQueue(null, demands);
      const housingReq = queue.find((r) => r.defId === 'workers-house-a');
      const vodkaReq = queue.find((r) => r.defId === 'vodka-distillery');
      expect(housingReq?.sortPriority).toBe(20);
      expect(vodkaReq?.sortPriority).toBe(30);
    });

    it('merges multiple mandates and demands into sorted queue', () => {
      const agent = new CollectiveAgent();
      const mandateState = {
        mandates: [
          { defId: 'barracks', label: 'Barracks', required: 1, fulfilled: 0 },
          { defId: 'hospital', label: 'Hospital', required: 1, fulfilled: 0 },
        ],
      };
      const demands = [
        {
          category: 'food_production' as const,
          priority: 'critical' as const,
          suggestedDefIds: ['collective-farm-hq'],
          reason: 'Critical food shortage',
        },
        {
          category: 'housing' as const,
          priority: 'urgent' as const,
          suggestedDefIds: ['workers-house-a', 'workers-house-b'],
          reason: 'Near capacity',
        },
      ];
      const queue = agent.generateQueue(mandateState, demands);
      // Priority: critical(0) < mandate(10) < urgent(20)
      expect(queue[0]!.sortPriority).toBe(0); // food demand
      expect(queue[1]!.sortPriority).toBe(10); // barracks mandate
      expect(queue[2]!.sortPriority).toBe(10); // hospital mandate
      // housing demands at 20
      const urgentItems = queue.filter((r) => r.sortPriority === 20);
      expect(urgentItems.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Focus Modifier ─────────────────────────────────────────────────────────

  describe('food focus modifier', () => {
    it('food focus multiplies food threshold by 3.0', () => {
      // Verify the exported constant matches the expected multiplier
      expect(FOOD_FOCUS_MULTIPLIER).toBe(3.0);
      // Verify the combined threshold under food focus
      expect(FOOD_CRISIS_THRESHOLD * FOOD_FOCUS_MULTIPLIER).toBe(6.0);
    });

    it('food focus makes survive trigger at much higher food levels', () => {
      const agent = new CollectiveAgent();
      // foodPerCapita = 4.0 — safe under balanced (threshold=2.0) but crisis under food focus (threshold=6.0)
      const worker = { citizen: { hunger: 0, age: 25, class: 'worker', assignment: null } } as any;
      const stats = {
        assignmentSource: 'auto' as const,
        morale: 50,
        loyalty: 50,
        skill: 50,
        vodkaDependency: 0,
        ticksSinceVodka: 0,
        name: 'Test',
        assignmentDuration: 0,
      };
      const resources = { food: 40, population: 10, vodka: 100, power: 100, rubles: 1000, smog: 0 };

      const balancedPriority = agent.evaluateWorkerPriority(worker, stats, resources, 'balanced');
      const foodPriority = agent.evaluateWorkerPriority(worker, stats, resources, 'food');

      expect(balancedPriority).not.toBe('survive');
      expect(foodPriority).toBe('survive');
    });
  });

  // ── Constants Verification ─────────────────────────────────────────────────

  describe('exported constants', () => {
    it('has correct food threshold constants', () => {
      expect(FOOD_CRITICAL_THRESHOLD).toBe(1.5);
      expect(FOOD_DEMAND_THRESHOLD).toBe(3.0);
      expect(FOOD_CRISIS_THRESHOLD).toBe(2.0);
    });

    it('has correct housing threshold constant', () => {
      expect(HOUSING_OCCUPANCY_THRESHOLD).toBe(0.8);
    });

    it('has correct auto-builder constants', () => {
      expect(MAX_PLACEMENT_DISTANCE).toBe(4);
      expect(CANDIDATE_LIMIT).toBe(20);
    });

    it('has correct repair threshold', () => {
      expect(REPAIR_THRESHOLD).toBe(50);
    });
  });

  // ── Serialization ──────────────────────────────────────────────────────────

  describe('serialization round-trip', () => {
    it('getState returns serializable snapshot', () => {
      const agent = new CollectiveAgent();
      agent.setFocus('construction');

      const state = agent.getState();
      expect(state).toHaveProperty('focus', 'construction');
      expect(state).toHaveProperty('lastBuildTick');
      expect(state).toHaveProperty('buildQueue');
      expect(state).toHaveProperty('pendingDemands');
      expect(Array.isArray(state.buildQueue)).toBe(true);
      expect(Array.isArray(state.pendingDemands)).toBe(true);
    });

    it('loadState restores focus and build queue', () => {
      const agent = new CollectiveAgent();

      const savedState: CollectiveAgentState = {
        focus: 'production',
        lastBuildTick: 42,
        buildQueue: [
          {
            defId: 'power-station',
            source: 'mandate',
            label: 'Power Station',
            sortPriority: 10,
            reason: '5-Year Plan mandate: build Power Station',
          },
        ],
        pendingDemands: [
          {
            category: 'food_production',
            priority: 'critical',
            suggestedDefIds: ['collective-farm-hq'],
            reason: 'Food crisis',
          },
        ],
      };

      agent.loadState(savedState);

      expect(agent.getFocus()).toBe('production');
      const queue = agent.getBuildQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]!.defId).toBe('power-station');
      expect(queue[0]!.source).toBe('mandate');
      const demands = agent.getPendingDemands();
      expect(demands).toHaveLength(1);
      expect(demands[0]!.category).toBe('food_production');
    });

    it('round-trip preserves all state fields', () => {
      const agent1 = new CollectiveAgent();
      agent1.setFocus('food');

      // Simulate generating a queue manually
      const demands = agent1.detectConstructionDemands(15, 10, { food: 10, vodka: 5, power: 0 });
      const queue = agent1.generateQueue(
        { mandates: [{ defId: 'guard-post', label: 'Guard Post', required: 2, fulfilled: 1 }] },
        demands,
      );

      // Save state
      const state = { focus: agent1.getFocus(), lastBuildTick: 100, buildQueue: queue, pendingDemands: demands };

      // Load into a new agent
      const agent2 = new CollectiveAgent();
      agent2.loadState(state);

      expect(agent2.getFocus()).toBe('food');
      expect(agent2.getBuildQueue()).toHaveLength(queue.length);
      expect(agent2.getPendingDemands()).toHaveLength(demands.length);
    });

    it('getState returns a copy (mutation does not affect agent)', () => {
      const agent = new CollectiveAgent();
      const state1 = agent.getState();
      state1.focus = 'production' as any;

      const state2 = agent.getState();
      expect(state2.focus).toBe('balanced'); // unchanged
    });

    it('getBuildQueue returns a copy (mutation does not affect agent)', () => {
      const agent = new CollectiveAgent();
      const queue1 = agent.getBuildQueue();
      queue1.push({ defId: 'hack', source: 'demand', label: 'hack', sortPriority: 0, reason: '' });

      const queue2 = agent.getBuildQueue();
      expect(queue2).toHaveLength(0); // unchanged
    });
  });
});
