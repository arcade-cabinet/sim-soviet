# System Overview

Print a comprehensive summary of all game systems in SimSoviet 1917 — key files, exports, test coverage, and the simulation tick order.

## Steps

1. Survey each major source directory and list key files:
   ```bash
   echo "=== ENGINE (src/engine/) ==="
   ls -1 src/engine/*.ts src/engine/*.tsx 2>/dev/null

   echo ""
   echo "=== GAME SYSTEMS (src/game/) ==="
   ls -1 src/game/*.ts src/game/*.tsx 2>/dev/null
   ls -1 src/game/minigames/*.ts 2>/dev/null

   echo ""
   echo "=== ECS (src/ecs/) ==="
   ls -1 src/ecs/*.ts src/ecs/*.tsx 2>/dev/null

   echo ""
   echo "=== SCENE (src/scene/) ==="
   ls -1 src/scene/*.ts src/scene/*.tsx 2>/dev/null

   echo ""
   echo "=== UI (src/ui/) ==="
   ls -1 src/ui/*.ts src/ui/*.tsx 2>/dev/null

   echo ""
   echo "=== HOOKS (src/hooks/) ==="
   ls -1 src/hooks/*.ts src/hooks/*.tsx 2>/dev/null

   echo ""
   echo "=== BRIDGE (src/bridge/) ==="
   ls -1 src/bridge/*.ts src/bridge/*.tsx 2>/dev/null

   echo ""
   echo "=== AUDIO (src/audio/) ==="
   ls -1 src/audio/*.ts src/audio/*.tsx 2>/dev/null

   echo ""
   echo "=== STORES (src/stores/) ==="
   ls -1 src/stores/*.ts src/stores/*.tsx 2>/dev/null
   ```

2. Count exports per directory:
   ```bash
   for dir in engine game ecs scene ui hooks bridge audio stores; do
     count=$(grep -r "^export " src/$dir/ 2>/dev/null | wc -l)
     echo "$dir: $count exports"
   done
   ```

3. Count test files and test cases:
   ```bash
   echo "=== TEST FILES ==="
   find __tests__ -name "*.test.*" 2>/dev/null | wc -l
   echo ""
   echo "=== TESTS BY AREA ==="
   for area in engine game ecs scene ui; do
     count=$(find __tests__ -name "*${area}*" -o -name "*$(echo $area | sed 's/./\U&/')*" 2>/dev/null | wc -l)
     echo "$area tests: $count files"
   done
   ```

4. Extract the SimulationEngine tick order:
   ```bash
   echo "=== SIMULATION ENGINE TICK ORDER ==="
   grep -A 2 "tick\|system\|step\|update" src/game/SimulationEngine.ts 2>/dev/null | head -60
   ```

5. Show the Content.tsx scene graph composition:
   ```bash
   echo "=== SCENE GRAPH (Content.tsx) ==="
   grep -E "<[A-Z]" src/Content.tsx 2>/dev/null | head -30
   ```

6. Present a formatted overview:
   ```
   ## SimSoviet 1917 — System Overview

   ### Engine (src/engine/) — Pure TS game logic
   - Files: X
   - Key: GameState, SimTick, BuildingTypes, GridTypes, ...

   ### Game Systems (src/game/) — ECS game systems
   - Files: X
   - Key: SimulationEngine, PersonnelFile, AchievementTracker, ...

   ### ECS (src/ecs/) — Entity-Component-System
   - Files: X
   - Key: archetypes, components, factories

   ### Scene (src/scene/) — R3F 3D components
   - Files: X
   - Key: TerrainGrid, BuildingRenderer, WeatherFX, ...

   ### UI (src/ui/) — React Native overlays
   - Files: X
   - Key: TopBar, Toolbar, QuotaHUD, SovietModal, ...

   ### Simulation Tick Order
   1. ...
   2. ...

   ### Scene Graph
   <Content>
     <TerrainGrid />
     <BuildingRenderer />
     ...
   </Content>
   ```
