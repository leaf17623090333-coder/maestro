/**
 * MaestroError and formatting helpers for CLI output.
 */

import { getOutputMode } from '../infra/utils/output.ts';

export class MaestroError extends Error {
  readonly hints: string[];

  constructor(message: string, hints: string[] = []) {
    super(message);
    this.name = "MaestroError";
    this.hints = hints;
  }
}

export function formatError(context: string, message: string): string {
  return `[error] ${context}: ${message}`;
}

export function formatWarning(message: string): string {
  return `[warn] ${message}`;
}

export function formatSuggestion(message: string): string {
  return `[suggestion] ${message}`;
}

export function formatHint(message: string): string {
  return `[hint] ${message}`;
}

/**
 * Standard error handler for command `run()` blocks.
 *
 * In text mode: prints formatted error + hints to stderr, exits 1.
 * In json mode: prints structured JSON to stdout (matching MCP contract), exits 1.
 */
export function handleCommandError(command: string, err: unknown): never {
  if (getOutputMode() === 'json') {
    const error = err instanceof Error ? err.message : String(err);
    const hints = err instanceof MaestroError ? err.hints : [];
    console.log(JSON.stringify({
      success: false,
      command,
      error,
      ...(hints.length > 0 && { hints }),
    }));
    process.exit(1);
  }

  if (err instanceof MaestroError) {
    console.error(formatError(command, err.message));
    err.hints.forEach(h => console.error(formatHint(h)));
    process.exit(1);
  }
  if (err instanceof Error) {
    console.error(formatError(command, err.message));
    process.exit(1);
  }
  throw err;
}
