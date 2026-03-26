/**
 * Shared constants for cross-cutting concerns.
 * Centralizes magic numbers previously scattered across adapters.
 */

/** Default timeout (ms) for subprocess detection commands (cli-detect, toolbox loader). */
export const DETECT_TIMEOUT_MS = 5000;

/** Default char limit for memory content previews in handoffs and DCP scoring. */
export const MEMORY_PREVIEW_CHARS = 500;

/** Max bytes of build output captured for verification reports. */
export const MAX_BUILD_OUTPUT_BYTES = 2048;

/** Minimum length for task completion summaries. */
export const MIN_SUMMARY_LENGTH = 20;
