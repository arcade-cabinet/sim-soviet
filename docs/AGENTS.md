# Documentation - Agent Index

Treat `docs/` as the canonical written contract for the shipped game.

## Product Scope

Every active document in this tree must describe **SimSoviet 1917 1.0** as:

- a historical Soviet campaign from **1917 through 1991**;
- a **grounded same-settlement continuation** after the 1991 campaign summary;
- a game with **no deep-future, space, Kardashev, multi-settlement, or post-scarcity runtime scope**.

## Read Order

1. `../CLAUDE.md` - repository-wide operating rules and commands
2. `../AGENTS.md` - repo navigation
3. `README.md` - canonical documentation index
4. `STATE.md` - current shipped state and what changed recently
5. `PRODUCTION.md` - remaining work and launch runway
6. `DESIGN.md` - product pillars and domain-document map
7. `ARCHITECTURE.md` / `TESTING.md` / `RELEASE.md` - implementation and ship process

## Canonical Docs

| Document | Purpose |
| --- | --- |
| `README.md` | Entry point into the docs set |
| `STATE.md` | Current shipped state, recent merges, and live surfaces |
| `PRODUCTION.md` | Single source of truth for remaining work |
| `DESIGN.md` | Product identity and pillar-by-pillar design map |
| `ARCHITECTURE.md` | Runtime architecture, directories, and data flow |
| `TESTING.md` | Test strategy, browser/E2E harnesses, diagnostics |
| `RELEASE.md` | CI, release, and CD workflow |
| `GAME_VISION.md` | Short product statement |
| `GDD-master.md` | Condensed gameplay reference |

## Directory Rules

- `design/` contains the detailed per-domain design documents.
- `reference/` contains supporting reference material, not product-scope authority.
- `plans/archive/` and `devlog/` are historical records only.
- If an active doc contradicts the historical-only scope, rewrite or delete it.
