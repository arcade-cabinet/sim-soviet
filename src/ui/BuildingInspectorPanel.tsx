/**
 * Re-export shim — keeps all existing import paths working.
 *
 * The implementation has been decomposed into:
 *   src/ui/building-inspector/BuildingInspectorPanel.tsx  (thin parent)
 *   src/ui/building-inspector/BuildingDossier.tsx         (Records Ring)
 *   src/ui/building-inspector/BuildingStats.tsx           (Production Ring)
 *   src/ui/building-inspector/BuildingWorkerPanel.tsx     (Demographic Ring)
 *   src/ui/building-inspector/BuildingRepairPanel.tsx     (demolish action)
 *   src/ui/building-inspector/shared.tsx                  (primitives + helpers)
 *   src/ui/building-inspector/styles.ts                   (shared styles)
 */

export type { BuildingInspectorPanelProps } from './building-inspector/BuildingInspectorPanel';
export { BuildingInspectorPanel } from './building-inspector/BuildingInspectorPanel';
