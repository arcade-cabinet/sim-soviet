---
title: Release Flow
updated: 2026-04-23
status: current
domain: release
---

# Release Flow

This repo uses the same top-level workflow ordering as `mean-streets`.

## Workflow Chain

1. `automerge.yml`
2. `ci.yml`
3. `release.yml`
4. `cd.yml`

## What Each Workflow Does

### `automerge.yml`

- Auto-approves and auto-squash-merges Dependabot PRs.
- Auto-approves and auto-squash-merges release-please PRs.

### `ci.yml`

Runs on pull requests and blocks merge if the game does not build or the core
verification lanes fail:

- typecheck;
- lint;
- node tests;
- build;
- Vitest browser lane in headed Chrome under `xvfb-run`;
- build smoke and diagnostic artifact upload.

### `release.yml`

Runs on `main` pushes and workflow dispatch:

- executes release-please;
- when a release tag is created, builds and uploads an Android APK;
- builds an iOS simulator artifact for the created tag.

### `cd.yml`

Runs on `main` pushes:

- reruns release checks;
- deploys the static web build to GitHub Pages;
- publishes the Android debug APK artifact.

## Current Public Surface

- Pages: [arcade-cabinet.github.io/sim-soviet](https://arcade-cabinet.github.io/sim-soviet/)
- GitHub Releases: tag-driven via `release.yml`

## Merge Policy

- Normal feature work should land by PR.
- Review feedback should be resolved on-branch before merge.
- Merge mode is squash, matching the automation and prior shipped PRs.

## Release Rehearsal (P1D-4)

Before cutting a `v1.0.0` tag, the release chain should be walked end-to-end
with a release candidate so any workflow gaps surface while they're cheap to
fix.

### Procedure

1. Confirm main is green. All P0 + P1 batch PRs merged, CI passing, smoke
   passing.
2. Wait for release-please to open its next release PR (#54 at time of writing)
   and verify the generated CHANGELOG entries + version bump look correct.
3. Merge the release-please PR. This pushes a new tag like `v1.4.0`.
4. Observe `release.yml` on the tag:
   - Android debug APK uploaded?
   - iOS simulator artifact generated?
   - GitHub Release entry created with the tag?
5. Observe `cd.yml` on main after the tag:
   - GitHub Pages deploy succeeds?
   - Live URL updates within a few minutes?
6. Manually open [arcade-cabinet.github.io/sim-soviet](https://arcade-cabinet.github.io/sim-soviet/)
   and walk the first minute of the game. Save works (OPFS + SW), fonts
   render, HQ button visible, tutorial fires.

### What to look for

- release-please PRs that don't group commits correctly (missing Conventional
  Commits in a feature branch squash title)
- CD workflow timeouts or missing artifact steps
- Pages deploy picking up stale `dist/` contents
- Any COOP/COEP regression from the service worker under a fresh origin

### Recording findings

Any workflow issue found during rehearsal should be fixed in a follow-up PR
referenced here. Append a dated section below per rehearsal iteration:

```
### YYYY-MM-DD rehearsal
- tag: vX.Y.Z
- outcome: green / fix-needed
- fixes:
  - <PR#> <topic>
```
