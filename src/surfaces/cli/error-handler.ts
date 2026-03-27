/**
 * Standard error handler for CLI command `run()` blocks.
 *
 * Moved from domain/errors.ts to surfaces/cli/ because it depends on
 * the output mode (JSON vs text) which is a presentation concern.
 */

import { getOutputMode } from '../../infra/utils/output.ts';
import { MaestroError, formatError, formatHint } from '../../domain/errors.ts';

/**
 * Exit codes:
 *   2 = user/input error (MaestroError -- bad args, missing resource, validation failure)
 *   1 = system error (unexpected exceptions, I/O failures, service unavailable)
 *
 * Agents use this to distinguish retryable-with-different-args (2) from retry-later (1).
 */
const EXIT_USER_ERROR = 2;
const EXIT_SYSTEM_ERROR = 1;

/**
 * Standard error handler for command `run()` blocks.
 *
 * In text mode: prints formatted error + hints to stderr.
 * In json mode: prints structured JSON to stdout (matching MCP contract).
 * Exit code: 2 for MaestroError (user/input error), 1 for system errors.
 */
export function handleCommandError(command: string, err: unknown): never {
  const isUserError = err instanceof MaestroError;
  const exitCode = isUserError ? EXIT_USER_ERROR : EXIT_SYSTEM_ERROR;

  if (getOutputMode() === 'json') {
    const error = err instanceof Error ? err.message : String(err);
    const hints = isUserError ? (err as MaestroError).hints : [];
    console.log(JSON.stringify({
      success: false,
      command,
      error,
      ...(hints.length > 0 && { hints }),
    }));
    process.exit(exitCode);
  }

  if (isUserError) {
    console.error(formatError(command, (err as MaestroError).message));
    (err as MaestroError).hints.forEach(h => console.error(formatHint(h)));
    process.exit(exitCode);
  }
  if (err instanceof Error) {
    console.error(formatError(command, err.message));
    process.exit(exitCode);
  }
  throw err;
}
