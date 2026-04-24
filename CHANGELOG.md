# Changelog

## [1.4.0](https://github.com/arcade-cabinet/sim-soviet/compare/SimSoviet1917-v1.3.0...SimSoviet1917-v1.4.0) (2026-04-24)


### Features

* **events:** add 4+ dedicated reconstruction-era events (P1A-2) ([#67](https://github.com/arcade-cabinet/sim-soviet/issues/67)) ([3f1b463](https://github.com/arcade-cabinet/sim-soviet/commit/3f1b463dac0a8608b9d48bf91a02305e76e02175))
* **events:** add 6 dedicated collectivization-era events (P1A-1) ([#72](https://github.com/arcade-cabinet/sim-soviet/issues/72)) ([5f6a2ee](https://github.com/arcade-cabinet/sim-soviet/commit/5f6a2eeaf14bc8e71eea0b48999ca1f13d29eeff))
* **events:** add 7+ dedicated thaw-and-freeze era events (P1A-3) ([#63](https://github.com/arcade-cabinet/sim-soviet/issues/63)) ([e56c100](https://github.com/arcade-cabinet/sim-soviet/commit/e56c100af9dfb5661895da732e9883b6c33ae4b6))
* **narrative:** add classified archive entries for 3 era transitions ([#65](https://github.com/arcade-cabinet/sim-soviet/issues/65)) ([c612846](https://github.com/arcade-cabinet/sim-soviet/commit/c612846475e3533dad99fe248548d2d79f11d28b))
* **ui:** add GPW construction-freeze indicator in Gosplan tab ([#73](https://github.com/arcade-cabinet/sim-soviet/issues/73)) ([c0f518d](https://github.com/arcade-cabinet/sim-soviet/commit/c0f518d4f6b154435e82731eaf7dc8207d82d827))
* **ui:** polish wave 2 — MainMenu compact title, monochrome icons, taller Pravda ticker, post-campaign badge ([#85](https://github.com/arcade-cabinet/sim-soviet/issues/85)) ([0da88a4](https://github.com/arcade-cabinet/sim-soviet/commit/0da88a43d73a16f9fe63d1c08b4c57d8606abb7d))


### Bug Fixes

* **app:** defer notifyStateChange out of engine.tick callbacks (React [#185](https://github.com/arcade-cabinet/sim-soviet/issues/185)) ([#87](https://github.com/arcade-cabinet/sim-soviet/issues/87)) ([440fa23](https://github.com/arcade-cabinet/sim-soviet/commit/440fa2322b7acd2b9ab199bfac859c692e608ccb))
* **app:** defer onStateChange notifyStateChange/gameState.notify (React [#185](https://github.com/arcade-cabinet/sim-soviet/issues/185)) ([#88](https://github.com/arcade-cabinet/sim-soviet/issues/88)) ([bb8ec3d](https://github.com/arcade-cabinet/sim-soviet/commit/bb8ec3d96670bc09c79c88cd1e239bb07b3c7f10))
* **dev:** surface SQLite-unavailable warning in dev, suppress autosave spam ([#69](https://github.com/arcade-cabinet/sim-soviet/issues/69)) ([fb5076a](https://github.com/arcade-cabinet/sim-soviet/commit/fb5076adb3004db5aa09c30e94d515c59a33a202))
* **fonts:** make font base URL env-conditional to fix local dev OTS errors ([#48](https://github.com/arcade-cabinet/sim-soviet/issues/48)) ([c6044ec](https://github.com/arcade-cabinet/sim-soviet/commit/c6044ec16510815466ce6dfd7b669585620aec81))
* **game:** reconcile directive/tutorial first-instruction conflict (P1F-2) ([#66](https://github.com/arcade-cabinet/sim-soviet/issues/66)) ([ccb61c1](https://github.com/arcade-cabinet/sim-soviet/commit/ccb61c1a0e29b104d748f3b3e0d428f5dfaf28b7))
* **narrative:** voice drift, anachronisms, duplicates, content gaps ([#83](https://github.com/arcade-cabinet/sim-soviet/issues/83)) ([5691be2](https://github.com/arcade-cabinet/sim-soviet/commit/5691be2b18e37a364b67aea930f2abd6434efd03))
* **save:** enable SharedArrayBuffer on web via SW COOP/COEP header injection ([#50](https://github.com/arcade-cabinet/sim-soviet/issues/50)) ([407b7d3](https://github.com/arcade-cabinet/sim-soviet/commit/407b7d3d0fbe4fd5c90f1184fe18944a36c93ad0))
* **scene:** defer Pravda setState to prevent React 19 update depth crash ([#51](https://github.com/arcade-cabinet/sim-soviet/issues/51)) ([d21b53f](https://github.com/arcade-cabinet/sim-soviet/commit/d21b53fc18863aeeeec3a21e000f9ff44a29a953))
* **scene:** hide cursor tooltip after 2.5s of pointer idle ([#89](https://github.com/arcade-cabinet/sim-soviet/issues/89)) ([3bd4b0b](https://github.com/arcade-cabinet/sim-soviet/commit/3bd4b0b2ac2b56aacf69d474fe7a735c99851afd))
* **sim:** batch arrival toasts and slow turn-1 ramp (P1B-1) ([#76](https://github.com/arcade-cabinet/sim-soviet/issues/76)) ([f724119](https://github.com/arcade-cabinet/sim-soviet/commit/f724119884ad58bbb1a4c51415ba4a24c8b4d58f))
* **tutorial:** rewire milestones to toasts and align to revolution era ([#53](https://github.com/arcade-cabinet/sim-soviet/issues/53)) ([f37b2c1](https://github.com/arcade-cabinet/sim-soviet/commit/f37b2c1f270e74ba5c9d1dcea83c209f4a9a59ed))
* **tutorial:** welcome milestone does not pauseOnTrigger ([#86](https://github.com/arcade-cabinet/sim-soviet/issues/86)) ([58c79d3](https://github.com/arcade-cabinet/sim-soviet/commit/58c79d3c3743ef97b83a679b83f0682460f3b63d))
* **ui:** 9 visual polish fixes — Cyrillic clip, mobile TopBar overflow, toast leak, off-palette colors, tab readability, tooltip color, divider contrast, dead-black desktop, mobile button wrap ([#82](https://github.com/arcade-cabinet/sim-soviet/issues/82)) ([4bfa35c](https://github.com/arcade-cabinet/sim-soviet/commit/4bfa35cbf4fbcf990521c70711265148b786be23))
* **ui:** adopt IBM Plex Mono across in-game HUD (P1F-1) ([#68](https://github.com/arcade-cabinet/sim-soviet/issues/68)) ([1f0599d](https://github.com/arcade-cabinet/sim-soviet/commit/1f0599d432c01e309f6141950a183b267363c8f9))
* **ui:** gate tile inspector tooltip on pointer-over-canvas ([#49](https://github.com/arcade-cabinet/sim-soviet/issues/49)) ([180f0be](https://github.com/arcade-cabinet/sim-soviet/commit/180f0be2ad1741347774158ab4db3e50f86cf0b6))
* **ui:** migrate deprecated shadow/textShadow/useNativeDriver (P1E-1) ([#60](https://github.com/arcade-cabinet/sim-soviet/issues/60)) ([65dd8e0](https://github.com/arcade-cabinet/sim-soviet/commit/65dd8e0dbeee337bacc59def42520d88ed78c54f))
* **ui:** rescale Law Enforcement HQ tab to pgt tier ([#62](https://github.com/arcade-cabinet/sim-soviet/issues/62)) ([99f199d](https://github.com/arcade-cabinet/sim-soviet/commit/99f199d09aff235a3d2f177a055097497dd4b622))
* **ui:** restore persistent HQ button, QuotaHUD, and DirectiveHUD (P0-2) ([#52](https://github.com/arcade-cabinet/sim-soviet/issues/52)) ([3b74bda](https://github.com/arcade-cabinet/sim-soviet/commit/3b74bdadc01018367f4556aa8081f376a4dea92a))
* **ux:** 7 player-journey blockers — pause-on-tutorial, advisor routing, agency copy, HQ intro, directive feedback, and Gosplan accessibility ([#81](https://github.com/arcade-cabinet/sim-soviet/issues/81)) ([9e3aab7](https://github.com/arcade-cabinet/sim-soviet/commit/9e3aab7a7a03de07da7b47ed67745c9f34e0cb9f))


### Performance Improvements

* hot-path optimizations — O(n²)→O(n) dvor sync, scratch arrays, parallel CI ([#84](https://github.com/arcade-cabinet/sim-soviet/issues/84)) ([411866d](https://github.com/arcade-cabinet/sim-soviet/commit/411866d801b1cd278f59e3f85c8dca35f1096750))

## [1.3.0](https://github.com/arcade-cabinet/sim-soviet/compare/v1.2.0...v1.3.0) (2026-04-23)


### Features

* 9 gameplay polish fixes ([#14](https://github.com/arcade-cabinet/sim-soviet/issues/14)) ([9247d99](https://github.com/arcade-cabinet/sim-soviet/commit/9247d99cf6e18f66767b1cd362859be239289da0))
* autonomous collective — demand detection, auto-build, political cost ([#36](https://github.com/arcade-cabinet/sim-soviet/issues/36)) ([7a4d149](https://github.com/arcade-cabinet/sim-soviet/commit/7a4d1492245fcc64123537fff3316817c9b221e1))
* Buildings Are the UI + Game Completion + Allocation Engine design ([ef751c0](https://github.com/arcade-cabinet/sim-soviet/commit/ef751c0cae9c5df2c992943948b85cc42218dd76))
* historically-researched demographics overhaul (9 features) ([fc84fa4](https://github.com/arcade-cabinet/sim-soviet/commit/fc84fa4831798439ce84eec9f5408084b09a9d25))
* playthrough integration tests + 4 bug fixes ([#38](https://github.com/arcade-cabinet/sim-soviet/issues/38)) ([4b57211](https://github.com/arcade-cabinet/sim-soviet/commit/4b57211232a884a6cbed77f57979874ec932832a))
* wire PolitburoSystem, weather modifiers, biome terrain, leader UI, and fix simulation interval ([#4](https://github.com/arcade-cabinet/sim-soviet/issues/4)) ([a18fc65](https://github.com/arcade-cabinet/sim-soviet/commit/a18fc65149a0c7dc0034bce5e86f38052ea88b85))


### Bug Fixes

* CI/deploy workflows — convert pnpm to npm ([#18](https://github.com/arcade-cabinet/sim-soviet/issues/18)) ([c9d4ae0](https://github.com/arcade-cabinet/sim-soviet/commit/c9d4ae07cfa9fa872f71d30843b53ffab885059d))
* **ci:** correct pinned SHAs for release-please-action and setup-java ([#23](https://github.com/arcade-cabinet/sim-soviet/issues/23)) ([0239bed](https://github.com/arcade-cabinet/sim-soviet/commit/0239bed6874331004bf408db3e97077089e1d762))
* **ci:** fix release workflow — Pages ref + remove ABI splits ([#25](https://github.com/arcade-cabinet/sim-soviet/issues/25)) ([262c9fd](https://github.com/arcade-cabinet/sim-soviet/commit/262c9fd3c2ec62d3e6406905b60e9443a41f32c8))
* **ci:** upgrade upload-pages-artifact to v4.0.0 (pins upload-artifact SHA) ([#2](https://github.com/arcade-cabinet/sim-soviet/issues/2)) ([1792a70](https://github.com/arcade-cabinet/sim-soviet/commit/1792a70ca3152800f732e50cfcb91efebecf0b7f))
* comprehensive docs-vs-code alignment audit (83 findings) ([3cd62f9](https://github.com/arcade-cabinet/sim-soviet/commit/3cd62f9095685d7367bba64e9565b1985533be32))
* default audio to muted, add mute toggle button to DrawerPanel ([#8](https://github.com/arcade-cabinet/sim-soviet/issues/8)) ([b62f502](https://github.com/arcade-cabinet/sim-soviet/commit/b62f502a08f99b71bdfa42a5e1be1925a29e64aa))
* deploy workflow — mkdir before asset copy ([#21](https://github.com/arcade-cabinet/sim-soviet/issues/21)) ([cb1f34c](https://github.com/arcade-cabinet/sim-soviet/commit/cb1f34ce5553d8c5924cc34c4e9d87a08aa46e4f))
* E2E test suite — from 2.8 hours to ~2 minutes ([#11](https://github.com/arcade-cabinet/sim-soviet/issues/11)) ([62ebb11](https://github.com/arcade-cabinet/sim-soviet/commit/62ebb118af5d5b8634c9ce351e1896f71ffbd403))
* GitHub Pages assets — baseUrl-aware paths + static file copy ([#20](https://github.com/arcade-cabinet/sim-soviet/issues/20)) ([d9c3b47](https://github.com/arcade-cabinet/sim-soviet/commit/d9c3b47ef1a5dd276a20288d1b1befe5eefa02ad))
* GitHub Pages deployment — Expo baseUrl for subpath ([#19](https://github.com/arcade-cabinet/sim-soviet/issues/19)) ([2a02fbc](https://github.com/arcade-cabinet/sim-soviet/commit/2a02fbc8d30785230b040e1f94415ce72c3d7c88))
* NewGameFlow — wizard to single-page dossier + text contrast ([#16](https://github.com/arcade-cabinet/sim-soviet/issues/16)) ([6c3ca15](https://github.com/arcade-cabinet/sim-soviet/commit/6c3ca15e8218159bccea9df12003191fd5dd77eb))
* revert three/webgpu imports — fix 3D rendering on WebGL2 ([#31](https://github.com/arcade-cabinet/sim-soviet/issues/31)) ([445cf17](https://github.com/arcade-cabinet/sim-soviet/commit/445cf173d6d7f33414fb4db00a3161d5213052a5))
* revert WebGPU renderer — use WebGL2 for R3F compat ([#29](https://github.com/arcade-cabinet/sim-soviet/issues/29)) ([b4eeade](https://github.com/arcade-cabinet/sim-soviet/commit/b4eeade9cea40e0331c8e3b7eef66758f9930b38))
* use Vite BASE_URL for sprite and audio asset paths ([#3](https://github.com/arcade-cabinet/sim-soviet/issues/3)) ([e39929f](https://github.com/arcade-cabinet/sim-soviet/commit/e39929f2e7fa3fc2b7ecaf4da842807f72a0c987))
* visual verification — blat thresholds, terrain sprites, resource rounding ([#15](https://github.com/arcade-cabinet/sim-soviet/issues/15)) ([402124d](https://github.com/arcade-cabinet/sim-soviet/commit/402124d9db77b2e0a2d2972f1795a1e9108e14bf))

## [1.2.0](https://github.com/arcade-cabinet/sim-soviet/compare/v1.1.3...v1.2.0) (2026-03-03)


### Features

* autonomous collective — demand detection, auto-build, political cost ([#36](https://github.com/arcade-cabinet/sim-soviet/issues/36)) ([7a4d149](https://github.com/arcade-cabinet/sim-soviet/commit/7a4d1492245fcc64123537fff3316817c9b221e1))
* game completion — 22 features, universal controls, responsive UI, XR ([#40](https://github.com/arcade-cabinet/sim-soviet/issues/40)) ([4759ba4](https://github.com/arcade-cabinet/sim-soviet/commit/4759ba4186c1569f477242def4c5e7ecd0ea7ab6))
* historically-researched demographics overhaul (9 features) ([fc84fa4](https://github.com/arcade-cabinet/sim-soviet/commit/fc84fa4831798439ce84eec9f5408084b09a9d25))
* playthrough integration tests + 4 bug fixes ([#38](https://github.com/arcade-cabinet/sim-soviet/issues/38)) ([4b57211](https://github.com/arcade-cabinet/sim-soviet/commit/4b57211232a884a6cbed77f57979874ec932832a))

## [1.1.3](https://github.com/arcade-cabinet/sim-soviet/compare/v1.1.2...v1.1.3) (2026-02-28)


### Bug Fixes

* comprehensive docs-vs-code alignment audit (83 findings) ([3cd62f9](https://github.com/arcade-cabinet/sim-soviet/commit/3cd62f9095685d7367bba64e9565b1985533be32))

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
