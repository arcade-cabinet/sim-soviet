---
title: Pravda Headline Generator
type: reference
status: active
implementation:
  - src/ai/agents/narrative/pravda/PravdaSystem.ts
  - src/ai/agents/narrative/pravda/
tests:
  - __tests__/game/PravdaSystem.test.ts
last_verified: 2026-04-23
coverage: full
---

# Pravda Headline Generator

Pravda is the procedural propaganda ticker for the historical Soviet campaign.
It turns routine simulation state, resource shortages, events, and crises into
confident public copy while keeping the grim truth in debug/reality fields.

The system is strictly grounded to the 1917-1991 campaign plus local free play.
It can satirize foreign threats, but those threats are never gameplay actors and
the language is era-aware.

## Runtime Shape

| Layer | Responsibility |
|-------|----------------|
| Word pools | Reusable nouns, verbs, institutions, threat objects, euphemisms, and realities |
| Generic generators | Ambient production, leader, culture, weather, resource, and threat headlines |
| Contextual generators | State-reactive lines for starvation, low treasury, quota pressure, power loss, population collapse, and post-1991 free play |
| Event spin | Reframes `GameEvent` effects into propaganda subtext |
| `PravdaSystem` | Public API, history, anti-repetition, front-page formatting |

## Era Awareness

Threat copy adapts to the campaign year:

| Period | Security service | Adversary language |
|--------|------------------|--------------------|
| 1917-1921 | Cheka | White Guards, foreign interventionists, imperialist powers |
| 1922-1933 | OGPU | Foreign agitators, bourgeois infiltrators, imperialist agents |
| 1934-1945 | NKVD | Saboteurs, spies, reactionary elements, interventionists |
| 1946-1953 | MGB | Western spies, American propagandists, British intelligence |
| 1954-1991 | KGB | Cold War language, including NATO/CIA/Pentagon terms where historically appropriate |

The 1917 startup state must not produce Cold War terms such as NATO, CIA, the
Pentagon, West Germany, the UN, satellites, missiles, or the KGB. This is covered
by `__tests__/game/PravdaSystem.test.ts`.

## External Threats

Threat headlines are propaganda filler and distraction. They do not imply a
global alternate-history simulation or real external threat system.

Examples by period:

| Year | Example |
|------|---------|
| 1917 | `WHITE GUARD AGENTS ESPIONAGE RING FOILED BY VIGILANT CITIZENS` |
| 1937 | `NKVD REPORTS 17 FOREIGN AGITATORS ARRESTED IN HEROIC STING OPERATION` |
| 1964 | `NATO CAUGHT CONDUCTING SABOTAGE OPERATION NEAR BORDER` |

## Contextual Guards

Several contextual generators are intentionally guarded so the opening 1917
assignment state does not look broken or anachronistic.

| Condition | Guard |
|-----------|-------|
| `pop === 0` | Zero-citizen crime copy requires actual collapse-like food conditions |
| low treasury | Suppressed during the 1917 startup state and no longer says post-monetary |
| no buildings | Suppressed during the 1917 startup state |
| plan success | Uses Five-Year Plan language only from 1928 onward |
| external threat | Uses year-specific services, adversaries, weapons, and venues |

## Public API

```ts
new PravdaSystem(rng?: GameRng)
```

| Method | Purpose |
|--------|---------|
| `headlineFromEvent(event)` | Generate and record a headline from a game event |
| `generateAmbientHeadline(view)` | Generate a state-aware ambient headline subject to cooldown and repetition checks |
| `getRecentHeadlines(count?)` | Return recent headline history for UI |
| `formatFrontPage()` | Format recent headlines into the ticker/front-page string |
| `toJSON()` / `fromJSON()` | Persist and restore headline history |

## Categories

| Category | Source |
|----------|--------|
| `triumph` | Internal triumphs and reframed disasters |
| `production` | Factory output, quotas, building counts |
| `culture` | Sports, science, art, education |
| `weather` | Weather reports and seasonal filler |
| `editorial` | Editorials, corrections, classifieds, horoscopes |
| `threat` | Era-aware external propaganda only |
| `leader` | Leadership praise |
| `spin` | Direct resource-shortage euphemisms |
| `crisis` | Active historical crisis headlines |

## Event Spin

Event spin translates raw effects into propaganda text.

| Effect | Framing |
|--------|---------|
| money loss | voluntary fiscal contribution |
| food loss | patriotic ration discipline |
| population loss | remote assignment or optimization |
| vodka loss | morale fluid consumed in service |
| power loss | candlelight discipline |
| gains | spontaneous proof that planning works |

Catastrophic or bad events may be reframed as external-threat distractions, but
the underlying event remains local and historical.

## Anti-Repetition

`PravdaSystem` remembers recent categories and avoids showing the same category
three times in a row. Ambient headlines also use a cooldown so the ticker does
not churn faster than a player can read it.

## Verification

Current coverage includes:

- event-to-headline mapping;
- contextual startup guards;
- Five-Year Plan year gating;
- 1917 external-threat anachronism guard;
- event spin for resource gains/losses;
- serialization/history behavior.
