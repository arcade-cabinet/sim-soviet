# Changelog

## [1.1.2](https://github.com/arcade-cabinet/sim-soviet/compare/v1.1.1...v1.1.2) (2026-02-28)


### Bug Fixes

* revert three/webgpu imports — fix 3D rendering on WebGL2 ([#31](https://github.com/arcade-cabinet/sim-soviet/issues/31)) ([445cf17](https://github.com/arcade-cabinet/sim-soviet/commit/445cf173d6d7f33414fb4db00a3161d5213052a5))

## [1.1.1](https://github.com/arcade-cabinet/sim-soviet/compare/v1.1.0...v1.1.1) (2026-02-28)


### Bug Fixes

* revert WebGPU renderer — use WebGL2 for R3F compat ([#29](https://github.com/arcade-cabinet/sim-soviet/issues/29)) ([b4eeade](https://github.com/arcade-cabinet/sim-soviet/commit/b4eeade9cea40e0331c8e3b7eef66758f9930b38))

## [1.1.0](https://github.com/arcade-cabinet/sim-soviet/compare/v1.0.0...v1.1.0) (2026-02-28)


### Features

* WebGPU cross-platform migration — renderer, assets, native, XR ([#27](https://github.com/arcade-cabinet/sim-soviet/issues/27)) ([f24c4d0](https://github.com/arcade-cabinet/sim-soviet/commit/f24c4d045563402b01ebc9758f89c17a274c5b1f))


### Bug Fixes

* **ci:** fix release workflow — Pages ref + remove ABI splits ([#25](https://github.com/arcade-cabinet/sim-soviet/issues/25)) ([262c9fd](https://github.com/arcade-cabinet/sim-soviet/commit/262c9fd3c2ec62d3e6406905b60e9443a41f32c8))

## 1.0.0 (2026-02-28)


### Features

* 9 gameplay polish fixes ([#14](https://github.com/arcade-cabinet/sim-soviet/issues/14)) ([9247d99](https://github.com/arcade-cabinet/sim-soviet/commit/9247d99cf6e18f66767b1cd362859be239289da0))
* Canvas 2D migration, CI/CD setup, and systems overhaul ([#1](https://github.com/arcade-cabinet/sim-soviet/issues/1)) ([f8bd2ef](https://github.com/arcade-cabinet/sim-soviet/commit/f8bd2ef447bb19cef71332a21761a1718046135f))
* character sprites, transport system, and gameplay polish ([#9](https://github.com/arcade-cabinet/sim-soviet/issues/9)) ([0afbe8d](https://github.com/arcade-cabinet/sim-soviet/commit/0afbe8d26962463ff4e0e3f6902c8a2f390b67df))
* complete all game systems — economy, era, workers, political, minigames, scoring, dialogue, tutorial, save/load ([#5](https://github.com/arcade-cabinet/sim-soviet/issues/5)) ([9d25417](https://github.com/arcade-cabinet/sim-soviet/commit/9d25417767cb82bdc6b7ffbdbbfa262a5225744e))
* full game completion — 12 features, playtest fixes ([#17](https://github.com/arcade-cabinet/sim-soviet/issues/17)) ([50f3da7](https://github.com/arcade-cabinet/sim-soviet/commit/50f3da7df2d49f72f6113e71d4e42502597f2082))
* R3F migration — 3D engine, ECS, full UI, CI/CD pipeline ([#22](https://github.com/arcade-cabinet/sim-soviet/issues/22)) ([8a65d12](https://github.com/arcade-cabinet/sim-soviet/commit/8a65d12efe48a80ae403a19ccf43cff5e6a35c2e))
* remaining game systems — economy, accessibility, marketplace, disease ([#12](https://github.com/arcade-cabinet/sim-soviet/issues/12)) ([98a80dc](https://github.com/arcade-cabinet/sim-soviet/commit/98a80dc9ad26a0d5fd3a2d05c1dc24e1e0512eb2))
* wire PolitburoSystem, weather modifiers, biome terrain, leader UI, and fix simulation interval ([#4](https://github.com/arcade-cabinet/sim-soviet/issues/4)) ([a18fc65](https://github.com/arcade-cabinet/sim-soviet/commit/a18fc65149a0c7dc0034bce5e86f38052ea88b85))


### Bug Fixes

* CI/deploy workflows — convert pnpm to npm ([#18](https://github.com/arcade-cabinet/sim-soviet/issues/18)) ([c9d4ae0](https://github.com/arcade-cabinet/sim-soviet/commit/c9d4ae07cfa9fa872f71d30843b53ffab885059d))
* **ci:** correct pinned SHAs for release-please-action and setup-java ([#23](https://github.com/arcade-cabinet/sim-soviet/issues/23)) ([0239bed](https://github.com/arcade-cabinet/sim-soviet/commit/0239bed6874331004bf408db3e97077089e1d762))
* **ci:** upgrade upload-pages-artifact to v4.0.0 (pins upload-artifact SHA) ([#2](https://github.com/arcade-cabinet/sim-soviet/issues/2)) ([1792a70](https://github.com/arcade-cabinet/sim-soviet/commit/1792a70ca3152800f732e50cfcb91efebecf0b7f))
* default audio to muted, add mute toggle button to DrawerPanel ([#8](https://github.com/arcade-cabinet/sim-soviet/issues/8)) ([b62f502](https://github.com/arcade-cabinet/sim-soviet/commit/b62f502a08f99b71bdfa42a5e1be1925a29e64aa))
* deploy workflow — mkdir before asset copy ([#21](https://github.com/arcade-cabinet/sim-soviet/issues/21)) ([cb1f34c](https://github.com/arcade-cabinet/sim-soviet/commit/cb1f34ce5553d8c5924cc34c4e9d87a08aa46e4f))
* E2E test suite — from 2.8 hours to ~2 minutes ([#11](https://github.com/arcade-cabinet/sim-soviet/issues/11)) ([62ebb11](https://github.com/arcade-cabinet/sim-soviet/commit/62ebb118af5d5b8634c9ce351e1896f71ffbd403))
* GitHub Pages assets — baseUrl-aware paths + static file copy ([#20](https://github.com/arcade-cabinet/sim-soviet/issues/20)) ([d9c3b47](https://github.com/arcade-cabinet/sim-soviet/commit/d9c3b47ef1a5dd276a20288d1b1befe5eefa02ad))
* GitHub Pages deployment — Expo baseUrl for subpath ([#19](https://github.com/arcade-cabinet/sim-soviet/issues/19)) ([2a02fbc](https://github.com/arcade-cabinet/sim-soviet/commit/2a02fbc8d30785230b040e1f94415ce72c3d7c88))
* NewGameFlow — wizard to single-page dossier + text contrast ([#16](https://github.com/arcade-cabinet/sim-soviet/issues/16)) ([6c3ca15](https://github.com/arcade-cabinet/sim-soviet/commit/6c3ca15e8218159bccea9df12003191fd5dd77eb))
* use Vite BASE_URL for sprite and audio asset paths ([#3](https://github.com/arcade-cabinet/sim-soviet/issues/3)) ([e39929f](https://github.com/arcade-cabinet/sim-soviet/commit/e39929f2e7fa3fc2b7ecaf4da842807f72a0c987))
* visual verification — blat thresholds, terrain sprites, resource rounding ([#15](https://github.com/arcade-cabinet/sim-soviet/issues/15)) ([402124d](https://github.com/arcade-cabinet/sim-soviet/commit/402124d9db77b2e0a2d2972f1795a1e9108e14bf))
