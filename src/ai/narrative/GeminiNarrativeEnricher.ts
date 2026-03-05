/**
 * @module ai/narrative/GeminiNarrativeEnricher
 *
 * Optional Gemini Flash integration for enriching narrative event scene prose.
 *
 * When `EXPO_PUBLIC_GEMINI_API_KEY` is set, this module calls Gemini 2.0 Flash
 * to expand the static scene text from worldTimeline.json / spaceTimeline.json
 * into richer, 3-4 paragraph dramatic prose grounded in Soviet bureaucratic aesthetics.
 *
 * Design principles:
 * - **Graceful degradation**: If the key is absent, the promise resolves with null
 *   and the caller falls back to the static scene text.
 * - **Session cache**: Each milestoneId is only enriched once per session. The
 *   Map is cleared on game reset.
 * - **No bundler dependency**: Uses native fetch (available in Expo web + React Native),
 *   never imports the Google GenAI SDK (which can bloat the bundle).
 * - **Dev/prod parity**: The enrichment is purely additive — it never blocks the
 *   timeline or narrative choice resolution logic.
 */

import type { NarrativeEvent } from '../../game/timeline/TimelineLayer';

// ─── Constants ──────────────────────────────────────────────────────────────

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.0-flash';
const REQUEST_TIMEOUT_MS = 12000;

// ─── Session Cache ───────────────────────────────────────────────────────────

/** Session-level cache: milestoneId → enriched prose. */
const enrichmentCache = new Map<string, string>();

/** Clear enrichment cache (call on game reset). */
export function clearEnrichmentCache(): void {
  enrichmentCache.clear();
}

// ─── Prompt Template ────────────────────────────────────────────────────────

/**
 * Build a Gemini prompt for enriching a narrative scene.
 *
 * The prompt emphasizes:
 * - Soviet bureaucratic language + on-the-ground eyewitness tone
 * - Historical/scientific grounding (no anachronisms)
 * - Moral weight and dread appropriate for a Soviet survival sim
 * - 3-4 short paragraphs, output only prose (no headers/bullets)
 */
function buildPrompt(event: NarrativeEvent): string {
  return `You are writing atmospheric prose for SimSoviet 1917 — a Soviet bureaucrat survival simulation. The player is a chairman (predsedatel) of a remote collective settlement. The game spans from 1917 to the far future with alternate history.

A critical event has just triggered in the ${event.timelineId} timeline:

TITLE: ${event.title}
HEADLINE: ${event.headline}

ORIGINAL SCENE (expand this):
${event.scene}

CHOICES THE PLAYER WILL FACE:
${event.choices.map((c) => `- ${c.label}: ${c.description}`).join('\n')}

TASK:
Rewrite this as 3-4 short paragraphs of dramatic prose. Use Soviet bureaucratic language mixed with eyewitness dispatch tone. Ground it in real history or science (this event is: ${event.milestoneId.replace(/_/g, ' ')}). Create moral weight — the player is a small cog in a vast machine, and this moment matters. The choices above are the player's options; foreshadow them without naming them directly. Do NOT include titles, headers, or bullet points. Output ONLY the prose paragraphs.`;
}

// ─── Gemini Response Shape ──────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: { code: number; message: string };
}

// ─── Core Enrichment Function ────────────────────────────────────────────────

/**
 * Enrich a narrative event's scene prose via Gemini Flash.
 *
 * Returns the enriched prose string, or null if:
 * - No API key is configured
 * - The request fails or times out
 * - The response is empty
 *
 * Results are cached per milestoneId for the session.
 *
 * @param event - The NarrativeEvent to enrich
 * @returns Enriched scene prose, or null on failure
 */
export async function enrichSceneWithGemini(event: NarrativeEvent): Promise<string | null> {
  // Check session cache first
  const cached = enrichmentCache.get(event.milestoneId);
  if (cached !== undefined) return cached;

  // Check for API key (Expo public env)
  const apiKey =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEMINI_API_KEY) ||
    '';

  if (!apiKey) {
    enrichmentCache.set(event.milestoneId, ''); // cache miss → don't retry
    return null;
  }

  try {
    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: buildPrompt(event) }] }],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 512,
        responseMimeType: 'text/plain',
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.warn(`[GeminiNarrative] API error ${response.status} for ${event.milestoneId}`);
      return null;
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      console.warn(`[GeminiNarrative] ${data.error.code}: ${data.error.message}`);
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) return null;

    enrichmentCache.set(event.milestoneId, text);
    return text;
  } catch (err) {
    // Timeout, network error, or JSON parse failure — all silent
    console.warn(`[GeminiNarrative] Enrichment failed for ${event.milestoneId}:`, err);
    return null;
  }
}
