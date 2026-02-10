---
title: UI Design System & Prototype Wiring
date: 2026-02-09
status: Complete
category: devlog
commits: 98bce2d..43ce8cf
---

# 003: UI Design System & Prototype Wiring

## What Was Built

- **Design token system**: `src/design/tokens.ts` with dual themes (concrete/parchment)
- **6 UI prototypes**, all approved and wired into the live game:
  1. **SovietHUD**: Top bar with settlement tier, date, resources, pause, speed, hamburger
  2. **DrawerPanel**: Slide-out command panel from right side
  3. **BottomStrip**: Pravda ticker + role/title display
  4. **RadialBuildMenu**: SVG pie menu (category ring -> building ring) replacing toolbar
  5. **SovietToastStack**: Severity-based notifications (event severity -> toast mapping)
  6. **SettlementUpgradeModal**: Parchment decree for tier transitions
- **FiveYearPlanModal**: Quota directive with production table on quota transitions
- **AnnualReportModal**: Pripiski falsification mechanic at quota deadlines
  - Player chooses honest, padded, or deflated reporting per resource
  - Detection risk scales with padding amount
- **Legacy type->defId migration**: LEGACY_TYPE_TO_SPRITE removed

## Key Decisions

- **Radial build menu over toolbar**: Pie menu on grid tap (NOT a fixed toolbar).
  Two rings: category selection then building selection. Better for mobile touch.
- **Grid fills viewport**: No cement borders, zoom locked, `100dvh` for mobile.
  This maximizes game real estate on phone screens.
- **callbacksRef pattern**: GameWorld.tsx stores callbacks in `useRef` to prevent
  inline objects as useEffect deps from killing the simulation interval on
  every re-render.
- **Deps added**: `@headlessui/react`, `lucide-react`, `@radix-ui/react-slider`,
  `clsx`, `tailwind-merge`, `framer-motion`

## Lessons Learned

- `notifyStateChange()` MUST be called after any ECS mutation that should trigger
  React re-renders -- easy to forget when wiring new modals.
- Miniplex predicate archetypes require `world.reindex(entity)` after mutation.
