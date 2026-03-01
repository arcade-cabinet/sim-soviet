# Memory Bank — Agent Navigation

> Cline-style memory bank adapted for multi-agent development on SimSoviet 1917.

## Purpose

The memory bank provides persistent project context so agents never start from zero. Instead of reading the entire codebase, agents read these files to understand the project's identity, architecture, patterns, and current state.

## Reading Order

**Always read in this order:**

1. **`projectbrief.md`** — What is this project? (2 min)
2. **`productContext.md`** — Why does it exist? What does the player experience? (3 min)
3. **`techContext.md`** — Tech stack, architecture, build pipeline, gotchas (5 min)
4. **`systemPatterns.md`** — Code patterns, ECS conventions, system design (5 min)
5. **`activeContext.md`** — What's happening right now? (2 min)
6. **`progress.md`** — What's done, in progress, and planned? (2 min)

## Rules

1. **Read `AGENTS.md` first** before any other memory-bank file
2. **Update `activeContext.md`** after significant development work
3. **Update `progress.md`** when features are completed or new work begins
4. **Don't duplicate CLAUDE.md** — memory bank provides context, CLAUDE.md provides operational instructions
5. **Keep files concise** — these are reference docs, not narratives

## Coordination

When multiple agents work on the project:
- Each agent reads the memory bank before starting work
- The lead agent updates `activeContext.md` when the development focus changes
- Agents update `progress.md` when completing significant features
- Conflicting updates should be resolved by the lead agent
