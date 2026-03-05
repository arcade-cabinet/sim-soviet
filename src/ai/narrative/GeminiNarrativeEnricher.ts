/**
 * @module ai/narrative/GeminiNarrativeEnricher
 *
 * Static lookup for pre-generated narrative enrichments.
 *
 * Enriched prose is generated offline via `pnpm run enrich-narratives`
 * (scripts/enrich-narratives.ts) using Gemini 2.5 Flash with structured output,
 * committed to narrativeEnrichments.json, and shipped as a static asset.
 *
 * Zero runtime API calls. Zero bundle size cost. Instant lookup.
 *
 * To add or update enrichments:
 *   GEMINI_API_KEY=your_key pnpm run enrich-narratives
 *   GEMINI_API_KEY=your_key pnpm run enrich-narratives -- --force
 *   GEMINI_API_KEY=your_key pnpm run enrich-narratives -- --milestone ancient_plague
 */

import enrichmentsData from '../../config/narrativeEnrichments.json';

interface EnrichmentEntry {
  scene: string;
  synopsis: string;
}

const enrichments = (
  enrichmentsData as { version: string; enrichments: Record<string, EnrichmentEntry> }
).enrichments;

/**
 * Return the pre-generated enriched scene prose for a milestone.
 * Returns null if the milestone has not yet been enriched.
 * Callers fall back to the static scene text from the timeline JSON.
 */
export function getEnrichedScene(milestoneId: string): string | null {
  return enrichments[milestoneId]?.scene ?? null;
}

/**
 * Return the pre-generated Pravda synopsis (≤25 words) for a milestone.
 * Returns null if not enriched.
 */
export function getEnrichedSynopsis(milestoneId: string): string | null {
  return enrichments[milestoneId]?.synopsis ?? null;
}
