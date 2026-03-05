# Design Corrections — User Directives (2026-03-05)

## CRITICAL: These override any previous implementation assumptions.

### 1. NO BOOTSTRAP — Settlement forms organically
- earlyGameBootstrap REMOVED (commit 2c363d8)
- Dvory arrive, evaluate terrain resources (water, soil, minerals, atmosphere)
- Seek shelter first → then production
- SAME algorithm for Earth 1917, Moon, Mars, Dyson swarm
- CollectiveAgent.tickAutonomous() is the ONE pipeline for ALL settlements

### 2. Moscow Promotion is NOT a cold branch
- It's a GAME FEATURE triggered by sustained settlement success
- Moscow notices your progress → "rewards" with more responsibility
- Should be avoidable with bribes (risk of getting caught)
- Triggers multi-settlement management (minimap + settlement selector)

### 3. Resettlement is a DIFFERENT mechanic
- Forced relocation with WARNING period
- During warning: can enact policies to disassemble and gather resources
- Like an overreaching form of the HQ displacement mechanism but for entire settlement
- Also avoidable with bribes (risky)
- On hostile planet: requires prefabs + provisioned resources

### 4. EVERY location has resource composition
- Historical 1917 Earth is NOT a special case
- Must have: mineral composition, soil value, weather systems, breathable atmosphere, fresh/salt water
- Agents use these to algorithmically decide initial steps
- celestialBodies.json already defines this for each body
- Need to also define it for the SPECIFIC SETTLEMENT LOCATION on the body

### 5. Morale is NOT a centralized metric
- Player should NOT have a single morale gauge to watch
- Morale is PER-CITIZEN, varying by household
- The SYSTEM detects issues: political officer, KGB, neighbor informants
- Player learns about morale problems THROUGH the political system, not a number
- Making morale central to player focus is an antipattern — the player is a BUREAUCRAT, not a therapist

### 6. Celestial viewport replaces default view
- Player's settlement sits ON a celestial body
- Zoom out: see the planet sphere
- Zoom in: sphere flattens to settlement grid
- This is the ONLY viewport — not a separate mode
- Earth, Moon, Mars, Dyson — all use the same viewport, different body type
