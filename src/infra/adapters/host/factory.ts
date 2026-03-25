/**
 * Host backend factory -- creates the appropriate adapter based on detected host type.
 */

import type { HostType } from '../../utils/host-detect.ts';
import type { HostBackend } from '../../../domain/ports/host.ts';
import { ClaudeCodeHostBackend } from './claude-code.ts';
import { CodexHostBackend } from './codex.ts';

/**
 * Create a host backend for the detected environment.
 * Returns null for standalone (no host integration).
 */
export function createHostBackend(hostType: HostType, projectRoot: string): HostBackend | null {
  switch (hostType) {
    case 'claude-code':
      return new ClaudeCodeHostBackend(projectRoot);
    case 'codex':
      return new CodexHostBackend(projectRoot);
    case 'standalone':
      return null;
  }
}
