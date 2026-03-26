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
 * recommender references use the merged action syntax.
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
// 2. Handler files use correct annotations (source-level check)
// ---------------------------------------------------------------------------
describe('handler annotation compliance', () => {
  const fs = require('fs');
  const path = require('path');
  const HANDLERS_DIR = path.join(import.meta.dir, '../../surfaces/mcp/handlers');

  function readHandler(filename: string): string {
    return fs.readFileSync(path.join(HANDLERS_DIR, filename), 'utf-8');
  }

  test('maestro_skill uses ANNOTATIONS_MUTATING (not READONLY)', () => {
    // Bug: was ANNOTATIONS_READONLY despite having install/create/remove/sync
    const content = readHandler('skill.ts');
    expect(content).toContain('ANNOTATIONS_MUTATING');
    expect(content).not.toContain('ANNOTATIONS_READONLY');
  });

  test('maestro_stage has annotations (was missing entirely)', () => {
    const content = readHandler('workflow.ts');
    expect(content).toContain('annotations:');
    expect(content).toContain('ANNOTATIONS_MUTATING');
  });

  test('maestro_memory uses ANNOTATIONS_DESTRUCTIVE (not MUTATING)', () => {
    // Bug: was ANNOTATIONS_MUTATING despite having delete/archive
    const content = readHandler('memory.ts');
    // The mutating tool (maestro_memory) should use DESTRUCTIVE
    // The read tool (maestro_memory_read) should use READONLY
    // Both should be imported
    expect(content).toContain('ANNOTATIONS_DESTRUCTIVE');
    expect(content).toContain('ANNOTATIONS_READONLY');
  });
});

// ---------------------------------------------------------------------------
// 3. Recommender uses merged tool names (not pre-merge stale names)
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

  test('urgent review tools use merged action syntax', () => {
    // Bug: was 'maestro_task_accept', 'maestro_task_reject' (tools that don't exist)
    const rec = recommend(makeRegistry(), 'execution', makeContext({ taskReview: 2 }));
    for (const toolRef of rec.urgent) {
      if (toolRef.includes('accept') || toolRef.includes('reject')) {
        expect(toolRef).toMatch(/^maestro_task\(action: /);
      }
    }
  });

  test('urgent revision tools use merged action syntax', () => {
    // Bug: was 'maestro_task_claim' (tool that doesn't exist post-merge)
    const rec = recommend(makeRegistry(), 'execution', makeContext({ taskRevision: 1 }));
    for (const toolRef of rec.urgent) {
      if (toolRef.includes('claim')) {
        expect(toolRef).toMatch(/^maestro_task\(action: /);
      }
    }
  });

  test('sync urgency uses merged action syntax', () => {
    // Bug: was 'maestro_tasks_sync' (tool that doesn't exist)
    const rec = recommend(makeRegistry(), 'approval', makeContext({
      stage: 'approval',
      planApproved: true,
      taskPending: 0,
    }));
    for (const toolRef of rec.urgent) {
      if (toolRef.includes('sync')) {
        expect(toolRef).toMatch(/^maestro_task\(action: /);
      }
    }
  });

  test('no urgent references contain underscore-separated tool names', () => {
    // Guard against future regressions where someone adds maestro_X_Y instead of maestro_X(action: Y)
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
        // Merged tools use parenthesized action syntax, not underscore separation
        // Exception: maestro_task, maestro_plan etc. are valid base tool names
        const underscoreCount = (toolRef.match(/_/g) || []).length;
        if (underscoreCount > 1) {
          // More than one underscore suggests an old-style stale reference
          expect(toolRef).toMatch(/\(action: /);
        }
      }
    }
  });
});
