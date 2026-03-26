/**
 * Regression tests: MCP tool annotations and recommender references.
 *
 * Fixed issues:
 * - maestro_skill was annotated READONLY despite having install/create/remove (mutating)
 * - maestro_stage had no annotations at all (missing from registration)
 * - maestro_memory used MUTATING instead of DESTRUCTIVE (has delete/archive)
 * - Workflow recommender referenced pre-merge tool names that don't exist
 *
 * These tests verify annotations match the tool's actual behavior and that
 * recommender references use the correct CLI-style syntax.
 */

import { describe, test, expect } from 'bun:test';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING, ANNOTATIONS_DESTRUCTIVE } from '../../surfaces/mcp/annotations.ts';
import { recommend, type RecommendationContext } from '../../app/workflow/recommender.ts';
import { WorkflowRegistry } from '../../app/workflow/registry.ts';
import { declareAllTools } from '../../app/workflow/tool-declarations.ts';

// ---------------------------------------------------------------------------
// 1. Annotation constants are distinct and correct
// ---------------------------------------------------------------------------
describe('annotation constants', () => {
  test('READONLY marks readOnly and idempotent', () => {
    expect(ANNOTATIONS_READONLY.readOnlyHint).toBe(true);
    expect(ANNOTATIONS_READONLY.destructiveHint).toBe(false);
    expect(ANNOTATIONS_READONLY.idempotentHint).toBe(true);
  });

  test('MUTATING is not readOnly and not destructive', () => {
    expect(ANNOTATIONS_MUTATING.readOnlyHint).toBe(false);
    expect(ANNOTATIONS_MUTATING.destructiveHint).toBe(false);
  });

  test('DESTRUCTIVE flags destructiveHint', () => {
    expect(ANNOTATIONS_DESTRUCTIVE.readOnlyHint).toBe(false);
    expect(ANNOTATIONS_DESTRUCTIVE.destructiveHint).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Handler annotation compliance -- removed in Phase 5b (handler files deleted)
// ---------------------------------------------------------------------------
// Handler files were deleted in Phase 5b. The annotation constants still exist in
// annotations.ts and are tested in section 1.

// ---------------------------------------------------------------------------
// 3. Recommender uses CLI-style tool references (not pre-merge MCP stale names)
// ---------------------------------------------------------------------------
describe('recommender tool name references', () => {
  function makeRegistry(): WorkflowRegistry {
    const reg = new WorkflowRegistry();
    declareAllTools(reg);
    return reg;
  }

  function makeContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
    return {
      stage: 'execution',
      taskReview: 0,
      taskRevision: 0,
      taskPending: 3,
      taskClaimed: 1,
      planExists: true,
      planApproved: true,
      memoryCount: 5,
      ...overrides,
    };
  }

  test('urgent review tools use CLI action syntax', () => {
    // Recommender uses CLI-style references (maestro task-accept) post CLI migration
    const rec = recommend(makeRegistry(), 'execution', makeContext({ taskReview: 2 }));
    for (const toolRef of rec.urgent) {
      if (toolRef.includes('accept') || toolRef.includes('reject')) {
        expect(toolRef).toMatch(/^maestro task-/);
      }
    }
  });

  test('urgent revision tools use CLI action syntax', () => {
    // Recommender uses CLI-style references (maestro task-claim) post CLI migration
    const rec = recommend(makeRegistry(), 'execution', makeContext({ taskRevision: 1 }));
    for (const toolRef of rec.urgent) {
      if (toolRef.includes('claim')) {
        expect(toolRef).toMatch(/^maestro task-/);
      }
    }
  });

  test('sync urgency uses CLI action syntax', () => {
    // Recommender uses CLI-style references (maestro task-sync) post CLI migration
    const rec = recommend(makeRegistry(), 'approval', makeContext({
      stage: 'approval',
      planApproved: true,
      taskPending: 0,
    }));
    for (const toolRef of rec.urgent) {
      if (toolRef.includes('sync')) {
        expect(toolRef).toMatch(/^maestro task-/);
      }
    }
  });

  test('no urgent references use old underscore-separated MCP tool names', () => {
    // Guard against regressions where someone re-introduces maestro_task_X style names
    // (those were pre-merge MCP stale names). CLI-style references use "maestro X-Y".
    const stages = ['discovery', 'research', 'planning', 'approval', 'execution', 'done'] as const;
    const registry = makeRegistry();

    for (const stage of stages) {
      const rec = recommend(registry, stage, makeContext({
        stage,
        taskReview: 1,
        taskRevision: 1,
        taskPending: 0,
      }));
      for (const toolRef of rec.urgent) {
        // Old-style MCP stale names had 2+ underscores (maestro_task_accept).
        // CLI-style names use a space + hyphen (maestro task-accept) -- no double underscores.
        const underscoreCount = (toolRef.match(/_/g) || []).length;
        expect(underscoreCount).toBeLessThanOrEqual(1);
      }
    }
  });
});
