# Product Context — SimSoviet 2000

## Why This Project Exists

SimSoviet 2000 is part of the `arcade-cabinet` collection — a set of retro-styled games. This entry is a Soviet-themed city builder that uses dark humor and absurdist satire to create a unique gameplay experience. It exists as both a playable game and a technical showcase for combining BabylonJS 3D rendering with React UI overlays via Reactylon.

## Problems It Solves

1. **Entertainment**: A comedic city-builder that doesn't take itself seriously
2. **Technical exploration**: Demonstrates the BabylonJS + React integration pattern using Reactylon, ECS architecture with Miniplex, and cross-platform deployment with Capacitor
3. **Arcade cabinet portfolio**: Adds a strategy/builder game to the collection

## How It Should Work

### Player Experience Flow
1. Player sees intro modal with Soviet propaganda-style welcome
2. Advisor tells player to build a Coal Plant first, then Housing
3. Player places buildings on the isometric grid by selecting tools from the bottom toolbar
4. Resources tick every second (SimulationEngine runs on 1s interval)
5. Random events fire periodically — disasters, political incidents, absurdist occurrences
6. Pravda ticker scrolls satirical headlines across the bottom of the screen
7. 5-Year Plan quotas create mid-term goals (food first, then vodka)
8. Failing a quota triggers a "game over" message but lets the player continue "in shame"

### User Experience Goals
- **Immediate clarity**: Player should understand what to build and why within 30 seconds
- **Constant humor**: Every tooltip, event, and headline should be darkly funny
- **Tactile feedback**: Building placement should feel snappy with procedural SFX
- **Mobile-first touch**: Tap to build, pan to move camera — no accidental placements
- **Atmosphere**: CRT overlay, snow, Soviet music create an immersive retro feel

## Target Audience
- Casual gamers who enjoy city builders
- Fans of dark/absurdist humor
- People nostalgic for retro game aesthetics
- Mobile browser game players
