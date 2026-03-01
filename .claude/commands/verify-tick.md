# Verify Tick

Run a quick simulation tick verification by executing tests related to the SimulationEngine and simTick, then report the results.

## Steps

1. Run SimulationEngine and simTick tests:
   ```bash
   npm test -- --testPathPattern="SimulationEngine|simTick" --silent 2>&1
   ```

2. If the above passes, also run related system tests for completeness:
   ```bash
   npm test -- --testPathPattern="demographic|Worker|Personnel|Achievement|Settlement|Scoring" --silent 2>&1 | tail -15
   ```

3. Report results:
   - If all tests pass: "Simulation tick verified. All X test suites passed with Y tests."
   - If any tests fail: List failing test names and error summaries. Recommend investigating the failures before making further changes to tick-related code.

4. Optionally show the tick order for reference:
   ```bash
   grep -n "tick\|system\|step" src/game/SimulationEngine.ts 2>/dev/null | head -20
   ```
