import { AgentManager } from '../../src/ai/AgentManager';

describe('AgentManager', () => {
  it('can be instantiated', () => {
    const manager = new AgentManager();
    expect(manager).toBeDefined();
  });

  it('updates all agents on tick', () => {
    const manager = new AgentManager();
    // Should not throw with no agents registered
    manager.update(1.0);
  });

  it('exposes chairman agent when autopilot enabled', () => {
    const manager = new AgentManager();
    expect(manager.getChairman()).toBeNull();
    manager.enableAutopilot();
    expect(manager.getChairman()).not.toBeNull();
  });

  it('disables autopilot', () => {
    const manager = new AgentManager();
    manager.enableAutopilot();
    expect(manager.getChairman()).not.toBeNull();
    manager.disableAutopilot();
    expect(manager.getChairman()).toBeNull();
  });

  it('serializes and deserializes', () => {
    const manager = new AgentManager();
    manager.enableAutopilot();
    const json = manager.toJSON();
    expect(json.autopilot).toBe(true);

    const manager2 = new AgentManager();
    manager2.fromJSON(json);
    expect(manager2.isAutopilot()).toBe(true);
  });

  it('enableAutopilot is idempotent', () => {
    const manager = new AgentManager();
    manager.enableAutopilot();
    const chairman1 = manager.getChairman();
    manager.enableAutopilot(); // Second call should be no-op
    expect(manager.getChairman()).toBe(chairman1);
  });

  it('disableAutopilot is idempotent', () => {
    const manager = new AgentManager();
    // Should not throw when disabling without enabling
    manager.disableAutopilot();
    expect(manager.getChairman()).toBeNull();
  });
});
