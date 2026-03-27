/**
 * Shared content resolution for CLI handlers.
 *
 * Most commands accept content via --content/--file/--stdin with identical
 * cascade logic. This utility extracts that pattern.
 */

import * as fs from 'fs';
import { MaestroError } from '../../domain/errors.ts';
import { readStdinText } from '../../infra/utils/stdin.ts';

/**
 * Resolve content from the standard --content / --file / --stdin cascade.
 *
 * @param contentFromArg - The primary content arg value (may be named --summary, --body, --rule, etc.)
 * @param args - Object with optional `file` and `stdin` fields
 * @param label - Human-readable label for error messages (e.g. 'summary', 'feedback')
 * @returns The resolved content string
 * @throws MaestroError if no content source provides a value
 */
export async function resolveContentArg(
  contentFromArg: string | undefined,
  args: { file?: string; stdin?: boolean },
  label = 'content',
): Promise<string> {
  if (contentFromArg) return contentFromArg;
  if (args.file) return fs.readFileSync(args.file, 'utf-8');
  if (args.stdin) return await readStdinText();
  throw new MaestroError(`No ${label} provided`, [
    `Pass --${label === 'content' ? 'content' : label} "..." or --file <path> or --stdin`,
  ]);
}
