/**
 * Regression tests for agent-friendly CLI/MCP improvements.
 *
 * These e2e tests exercise real CLI commands against temporary project dirs.
 * Each test guards against a specific regression:
 *
 * - Dry-run on task-sync/plan-write/memory-delete must not mutate state
 * - stdin support on content commands must pipe content correctly
 * - Idempotent state transitions return success on already-in-target-state
 * - CLI --help includes usage examples
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { createTestHarness, type TestHarness } from '../mocks/test-harness.ts';

let harness: TestHarness;

afterEach(async () => {
  if (harness) await harness.cleanup();
});

const SIMPLE_PLAN = [
  '## Discovery',
  'We investigated thoroughly and found the current codebase needs a new logging subsystem to support observability requirements across the platform.',
  '',
  '## Non-Goals',
  '- Performance optimization',
  '',
  '## Ghost Diffs',
  '- No ghost diffs expected',
  '',
  '### 1. Setup logging',
  '- **Depends on**: none',
  'Add the logging infrastructure',
  '',
  '### 2. Wire handlers',
  'Connect logging to existing request handlers',
].join('\n');

async function setupFeature(h: TestHarness, featureName = 'test-feature') {
  await h.run('init');
  await h.run('config-set', '--key', 'tasks.backend', '--value', 'fs');
  await h.run('feature-create', featureName);
  return featureName;
}

async function setupWithTasks(h: TestHarness, featureName = 'test-feature') {
  await setupFeature(h, featureName);
  await h.run('plan-write', '--feature', featureName, '--content', SIMPLE_PLAN);
  await h.run('plan-approve', '--feature', featureName);
  const syncResult = await h.run('task-sync', '--feature', featureName);
  return JSON.parse(syncResult.stdout);
}

// ---------------------------------------------------------------------------
// Dry-run: task-sync
// ---------------------------------------------------------------------------
describe('dry-run: task-sync', () => {
  test('does not create or remove tasks when --dry-run is set', async () => {
    harness = await createTestHarness();
    const sync = await setupWithTasks(harness);
    expect(sync.created).toHaveLength(2);

    // Now dry-run re-sync -- should report what would happen but not change anything
    const dryResult = await harness.run('task-sync', '--feature', 'test-feature', '--dry-run');
    expect(dryResult.exitCode).toBe(0);

    // Verify task list is unchanged
    const listResult = await harness.run('task-list', '--feature', 'test-feature');
    const tasks = JSON.parse(listResult.stdout);
    expect(Array.isArray(tasks) ? tasks : tasks.tasks).toHaveLength(2);
  });

  test('dry-run after plan change shows would-create without creating', async () => {
    harness = await createTestHarness();
    await setupWithTasks(harness);

    // Rewrite plan with a different task set
    const newPlan = SIMPLE_PLAN.replace('### 2. Wire handlers', '### 2. Add metrics');
    await harness.run('plan-write', '--feature', 'test-feature', '--content', newPlan);
    await harness.run('plan-approve', '--feature', 'test-feature');

    // Dry-run sync
    const dryResult = await harness.run('task-sync', '--feature', 'test-feature', '--dry-run');
    const dry = JSON.parse(dryResult.stdout);
    expect(dryResult.exitCode).toBe(0);
    // Dry-run reports changes that WOULD happen
    expect(dry.created.length + dry.removed.length + dry.kept.length).toBeGreaterThan(0);

    // But actual tasks remain the original set
    const listResult = await harness.run('task-list', '--feature', 'test-feature');
    const tasks = JSON.parse(listResult.stdout);
    // Original tasks still exist (not removed/replaced)
    const taskList = Array.isArray(tasks) ? tasks : tasks.tasks;
    expect(taskList).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Dry-run: plan-write
// ---------------------------------------------------------------------------
describe('dry-run: plan-write', () => {
  test('does not overwrite plan when --dry-run is set', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', SIMPLE_PLAN);

    // Read original plan
    const original = await harness.run('plan-read', '--feature', 'test-feature');
    expect(original.exitCode).toBe(0);

    // Dry-run write with different content (must include required sections)
    const altPlan = '## Discovery\nWe investigated thoroughly and found the system needs a completely different approach to handle the scale requirements.\n\n## Non-Goals\n- None\n\n## Ghost Diffs\n- None\n\n### 1. Rewrite everything\nReplace all modules.';
    const dryResult = await harness.run('plan-write', '--feature', 'test-feature',
      '--content', altPlan,
      '--dry-run');
    expect(dryResult.exitCode).toBe(0);

    // Plan should be unchanged
    const after = await harness.run('plan-read', '--feature', 'test-feature');
    const afterPlan = JSON.parse(after.stdout);
    expect(afterPlan.content).toContain('Setup logging');
  });
});

// ---------------------------------------------------------------------------
// Dry-run: memory-delete
// ---------------------------------------------------------------------------
describe('dry-run: memory-delete', () => {
  test('does not delete memory when --dry-run is set', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('memory-write', '--feature', 'test-feature', '--name', 'finding', '--content', 'Important finding');

    // Dry-run delete
    const dryResult = await harness.run('memory-delete', '--feature', 'test-feature', '--name', 'finding', '--dry-run');
    expect(dryResult.exitCode).toBe(0);
    const dry = JSON.parse(dryResult.stdout);
    expect(dry.wouldDelete).toBe(true);

    // Memory should still exist
    const readResult = await harness.run('memory-read', '--feature', 'test-feature', '--name', 'finding');
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout).toContain('Important finding');
  });
});

// ---------------------------------------------------------------------------
// stdin support
// ---------------------------------------------------------------------------
describe('stdin content piping', () => {
  test('memory-write --stdin reads content from pipe', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    // Pipe content via stdin by writing to a temp file and using shell redirection
    const { dir } = harness;
    const fs = require('fs');
    const path = require('path');

    // Write content to a temp file and pipe it
    const contentFile = path.join(dir, '_stdin_content.txt');
    fs.writeFileSync(contentFile, 'Content from stdin pipe');

    const proc = Bun.spawn(
      ['sh', '-c', `cat ${contentFile} | bun ${path.join(import.meta.dir, '../../surfaces/cli/index.ts')} --json memory-write --feature test-feature --name piped-mem --stdin`],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: process.env.HOME } },
    );
    await proc.exited;

    // Verify content was written
    const readResult = await harness.run('memory-read', '--feature', 'test-feature', '--name', 'piped-mem');
    expect(readResult.exitCode).toBe(0);
    expect(readResult.stdout).toContain('Content from stdin pipe');
  });
});

// ---------------------------------------------------------------------------
// Idempotent state transitions (fs backend)
// ---------------------------------------------------------------------------
describe('idempotent state transitions', () => {
  test('claim same task by same agent twice succeeds', async () => {
    harness = await createTestHarness();
    const sync = await setupWithTasks(harness);
    const task = sync.created[0];

    // First claim
    const first = await harness.run('task-claim', '--feature', 'test-feature', '--task', task, '--agent-id', 'agent-1');
    expect(first.exitCode).toBe(0);

    // Second claim by same agent -- should succeed (idempotent)
    const second = await harness.run('task-claim', '--feature', 'test-feature', '--task', task, '--agent-id', 'agent-1');
    expect(second.exitCode).toBe(0);
    const parsed = JSON.parse(second.stdout);
    expect(parsed.already).toBe(true);
    expect(parsed.status).toBe('claimed');
  });

  test('claim same task by different agent fails', async () => {
    harness = await createTestHarness();
    const sync = await setupWithTasks(harness);
    const task = sync.created[0];

    await harness.run('task-claim', '--feature', 'test-feature', '--task', task, '--agent-id', 'agent-1');

    // Different agent tries to steal -- should fail
    const steal = await harness.run('task-claim', '--feature', 'test-feature', '--task', task, '--agent-id', 'agent-2');
    expect(steal.exitCode).toBe(1);
  });

  test('done on already-done task returns idempotent success', async () => {
    harness = await createTestHarness();
    const sync = await setupWithTasks(harness);
    const task = sync.created[0];

    await harness.run('task-claim', '--feature', 'test-feature', '--task', task, '--agent-id', 'agent-1');
    await harness.run('task-done', '--feature', 'test-feature', '--task', task, '--summary', 'Done once');

    // Second done -- should succeed (idempotent)
    const second = await harness.run('task-done', '--feature', 'test-feature', '--task', task, '--summary', 'Done again');
    expect(second.exitCode).toBe(0);
    const parsed = JSON.parse(second.stdout);
    expect(parsed.already).toBe(true);
  });

  test('unblock on non-blocked (pending) task returns idempotent success', async () => {
    harness = await createTestHarness();
    const sync = await setupWithTasks(harness);
    const task = sync.created[0];

    // Task is pending (target state of unblock) -- should succeed idempotently
    const result = await harness.run('task-unblock', '--feature', 'test-feature', '--task', task, '--decision', 'Not blocked');
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.already).toBe(true);
  });

  test('block on already-blocked task returns idempotent success', async () => {
    harness = await createTestHarness();
    const sync = await setupWithTasks(harness);
    const task = sync.created[0];

    // Block the task
    await harness.run('task-block', '--feature', 'test-feature', '--task', task, '--reason', 'Needs clarification');

    // Block again -- should succeed idempotently
    const second = await harness.run('task-block', '--feature', 'test-feature', '--task', task, '--reason', 'Still blocked');
    expect(second.exitCode).toBe(0);
    const parsed = JSON.parse(second.stdout);
    expect(parsed.already).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CLI --help includes examples
// ---------------------------------------------------------------------------
describe('CLI help examples (description strings)', () => {
  // These tests verify command descriptions include Examples sections.
  // Spawning processes for --help is unreliable in bun test, so we verify
  // the source description strings directly from the command definitions.
  //
  // The root cause was citty lacking meta.examples, so examples are appended
  // to meta.description. If someone removes them, these tests catch it.
  const fs = require('fs');
  const path = require('path');
  const handlersDir = path.join(import.meta.dir, '../../surfaces/cli/handlers');

  function readHandlerSource(relPath: string): string {
    return fs.readFileSync(path.join(handlersDir, relPath), 'utf-8');
  }

  test('task-claim description includes Examples', () => {
    const src = readHandlerSource('task/claim.ts');
    expect(src).toContain('Examples:');
    expect(src).toContain('maestro task-claim');
  });

  test('memory-write description includes Examples', () => {
    const src = readHandlerSource('memory/write.ts');
    expect(src).toContain('Examples:');
    expect(src).toContain('maestro memory-write');
  });

  test('plan-write description includes Examples', () => {
    const src = readHandlerSource('plan/write.ts');
    expect(src).toContain('Examples:');
    expect(src).toContain('maestro plan-write');
  });

  test('feature-create description includes Examples', () => {
    const src = readHandlerSource('feature/create.ts');
    expect(src).toContain('Examples:');
    expect(src).toContain('maestro feature-create');
  });

  test('status description includes Examples', () => {
    const src = readHandlerSource('status.ts');
    expect(src).toContain('Examples:');
    expect(src).toContain('maestro status');
  });
});
