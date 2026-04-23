# Design Documents - Agent Index

Use `docs/DESIGN.md` for the top-level product map and this directory for the
deeper domain docs.

## Priority Read Order

1. `../DESIGN.md`
2. `README.md`
3. Domain doc relevant to the current task
4. Supporting design doc if the change crosses political, leadership, or ECS boundaries

## Domain Coverage

- `overview.md` - identity and core loop
- `eras.md` - historical campaign structure
- `economy.md` - planned economy and quotas
- `workers.md` - labor behavior and self-organization
- `demographics.md` - population and household model
- `political.md` - party, KGB, military, and punishment systems
- `scoring.md` - completion and score logic
- `ui-ux.md` - player-facing UI and flow
- `minigames.md` - event interaction surfaces
- `dialog-bible.md` - tone and writing voice

## Scope Rule

Do not treat archived future systems as active design. If a change would imply
space, deep-future, or multi-settlement scope, it is outside the current 1.0
product unless the repo-wide product docs change first.
