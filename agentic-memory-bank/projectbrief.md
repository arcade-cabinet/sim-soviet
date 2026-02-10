# Project Brief — SimSoviet 2000

## Overview

SimSoviet 2000 is a satirical isometric city-builder game set in the Soviet Union. The player assumes the role of a Soviet city planner managing resources, buildings, and citizens against 5-year plan quotas, starting in 1980.

The game is a darkly humorous take on centrally-planned economies — every system is designed to produce absurd bureaucratic situations, resource shortages, and propaganda-tinged feedback.

## Core Requirements

### Gameplay
- Isometric city-building on a 30x30 grid
- Building types: Coal Plant, Tenement, Kolkhoz (farm), Vodka Plant, Gulag, Roads
- Resources: Rubles, Food, Vodka, Power, Population
- 5-Year Plan quota system (food → vodka progression)
- Random event system with satirical disasters, political events, and absurdist humor
- Pravda newspaper ticker with propaganda-style headlines

### Platforms
- Primary: Web browser (PWA)
- Secondary: Android and iOS via Capacitor
- Must be touch-friendly (tap to build, pan/pinch for camera)

### Aesthetic
- Soviet brutalist visual style — concrete gray palette, CRT overlay effects, scanlines
- Retro monospace typography (VT323)
- Soviet-era music from public domain sources (marxists.org)
- Procedural sound effects via Tone.js
- Perpetual snow particle effect

## Scope

### In Scope
- Core city-building loop (build → produce → consume → grow)
- Event system with 50+ unique events
- Audio system with 40+ Soviet-era music tracks
- ECS architecture for scalable entity management
- Save/load system
- Responsive design for mobile and desktop
- E2E tests for gameplay and responsive layouts

### Out of Scope (Currently)
- Multiplayer
- 3D model loading (uses pre-baked isometric sprites from Blender)
- Full citizen AI simulation (Yuka integration is stubbed)
- Republic/SSR expansion mechanics (anthems are loaded but unused)

## Success Criteria
- Playable city-building loop with quota progression
- Smooth 60fps rendering on desktop and mobile
- Touch controls that don't conflict with camera movement
- Satirical tone maintained throughout all game text
