/**
 * Workflow metadata declarations for all CLI commands.
 * Centralized registry population -- called once during server startup.
 */

import type { WorkflowRegistry } from './registry.ts';

/**
 * Register workflow metadata for all CLI commands.
 */
export function declareAllTools(registry: WorkflowRegistry): void {
  // =========================================================================
  // Feature commands
  // =========================================================================
  registry.register('maestro feature-create', { stages: ['discovery'], category: 'primary' });
  registry.register('maestro feature-complete', { stages: ['done'], category: 'primary' });
  registry.register('maestro feature-list', { stages: [], category: 'meta' });
  registry.register('maestro feature-info', { stages: [], category: 'meta' });
  registry.register('maestro feature-active', { stages: [], category: 'meta' });

  // =========================================================================
  // Plan commands
  // =========================================================================
  registry.register('maestro plan-write', { stages: ['planning'], category: 'primary' });
  registry.register('maestro plan-approve', { stages: ['planning'], category: 'primary' });
  registry.register('maestro plan-read', { stages: ['planning'], category: 'meta' });
  registry.register('maestro plan-revoke', { stages: ['planning'], category: 'utility' });
  registry.register('maestro plan-comment', { stages: ['planning'], category: 'utility' });

  // =========================================================================
  // Task commands
  // =========================================================================
  registry.register('maestro task-sync', { stages: ['approval'], category: 'primary', prerequisites: ['maestro plan-approve'] });
  registry.register('maestro task-claim', { stages: ['execution'], category: 'primary' });
  registry.register('maestro task-done', { stages: ['execution'], category: 'primary' });
  registry.register('maestro task-next', { stages: ['execution'], category: 'meta' });
  registry.register('maestro task-list', { stages: ['execution'], category: 'meta' });
  registry.register('maestro task-info', { stages: ['execution'], category: 'meta' });
  registry.register('maestro task-block', { stages: ['execution'], category: 'utility' });
  registry.register('maestro task-unblock', { stages: ['execution'], category: 'utility' });
  registry.register('maestro task-accept', { stages: ['execution'], category: 'utility' });
  registry.register('maestro task-reject', { stages: ['execution'], category: 'utility' });

  // =========================================================================
  // Memory commands
  // =========================================================================
  registry.register('maestro memory-write', { stages: ['discovery', 'research', 'done'], category: 'primary' });
  registry.register('maestro memory-read', { stages: [], category: 'meta' });
  registry.register('maestro memory-list', { stages: [], category: 'meta' });
  registry.register('maestro memory-compile', { stages: [], category: 'meta' });
  registry.register('maestro memory-delete', { stages: [], category: 'utility' });
  registry.register('maestro memory-promote', { stages: ['done'], category: 'utility' });

  // =========================================================================
  // Doctrine commands
  // =========================================================================
  registry.register('maestro doctrine-write', { stages: ['done'], category: 'primary' });
  registry.register('maestro doctrine-list', { stages: [], category: 'meta' });
  registry.register('maestro doctrine-read', { stages: [], category: 'meta' });
  registry.register('maestro doctrine-approve', { stages: ['done'], category: 'utility' });

  // =========================================================================
  // Skill commands
  // =========================================================================
  registry.register('maestro skill', { stages: [], category: 'meta' });
  registry.register('maestro skill-list', { stages: [], category: 'meta' });

  // =========================================================================
  // Graph commands (conditional: requires bv)
  // =========================================================================
  registry.register('maestro graph-insights', { stages: ['execution'], category: 'conditional', requires: 'bv' });
  registry.register('maestro graph-next', { stages: ['execution'], category: 'conditional', requires: 'bv' });

  // =========================================================================
  // Search commands (conditional: requires cass)
  // =========================================================================
  registry.register('maestro search-sessions', { stages: ['discovery', 'research'], category: 'conditional', requires: 'cass' });
  registry.register('maestro search-related', { stages: ['discovery', 'research'], category: 'conditional', requires: 'cass' });

  // =========================================================================
  // Handoff commands (conditional: requires agent-mail)
  // =========================================================================
  registry.register('maestro handoff-send', { stages: ['execution'], category: 'conditional', requires: 'agent-mail' });
  registry.register('maestro handoff-receive', { stages: ['execution'], category: 'conditional', requires: 'agent-mail' });

  // =========================================================================
  // Visual command
  // =========================================================================
  registry.register('maestro visual', { stages: [], category: 'meta' });

  // =========================================================================
  // DCP command
  // =========================================================================
  registry.register('maestro dcp-preview', { stages: [], category: 'utility' });

  // =========================================================================
  // Config commands
  // =========================================================================
  registry.register('maestro config-get', { stages: [], category: 'meta' });
  registry.register('maestro config-set', { stages: [], category: 'utility' });

  // =========================================================================
  // Meta / standalone commands
  // =========================================================================
  registry.register('maestro status', { stages: ['discovery', 'research', 'planning', 'approval', 'execution', 'done'], category: 'meta' });
  registry.register('maestro ping', { stages: [], category: 'meta' });
  registry.register('maestro doctor', { stages: [], category: 'meta' });
  registry.register('maestro init', { stages: [], category: 'utility' });
  registry.register('maestro execution-insights', { stages: ['done'], category: 'meta' });
  registry.register('maestro history', { stages: [], category: 'meta' });
}
