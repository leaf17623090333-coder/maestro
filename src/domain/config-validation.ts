/**
 * Shared validation for settings key writes (used by both CLI and MCP surfaces).
 */

import { MaestroError } from './errors.ts';

/** Top-level keys from MaestroSettings that are valid write targets. */
export const WRITABLE_KEY_PREFIXES = [
  'toolbox', 'agentTools', 'dcp', 'verification',
  'doctrine', 'tasks', 'agents', 'host',
] as const;

const PROTOTYPE_POLLUTION_PATTERN = /(__proto__|constructor|prototype)/;

/**
 * Validate a settings key before writing.
 * Rejects prototype pollution vectors and unknown top-level sections.
 */
export function validateSettingsKey(key: string): void {
  if (PROTOTYPE_POLLUTION_PATTERN.test(key)) {
    throw new MaestroError(
      `Invalid config key: "${key}" contains a disallowed segment`,
      ['Keys must not contain __proto__, constructor, or prototype.'],
    );
  }

  const topLevelKey = key.split('.')[0];
  if (!WRITABLE_KEY_PREFIXES.includes(topLevelKey as typeof WRITABLE_KEY_PREFIXES[number])) {
    throw new MaestroError(
      `Unknown config section: "${topLevelKey}"`,
      [`Valid top-level sections: ${WRITABLE_KEY_PREFIXES.join(', ')}`],
    );
  }
}
