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
