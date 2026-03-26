/**
 * Regression tests for deep audit findings (2026-03-26).
 *
 * Two bugs found by real CLI/MCP testing that bun test missed:
 *
 * FIX-1: Config key validation was only in the MCP handler. The CLI handler
 *        allowed __proto__, constructor, prototype, and arbitrary top-level
 *        sections. Root cause: validation added to one surface without a
 *        shared extraction.
 *
 * FIX-2: Plan parser only accepted ### headings for tasks. Agents commonly
 *        write #### under ### Phase headings. task-sync silently produced
 *        0 tasks with no error. Root cause: strict heading-level regex.
 *
 * Test categories:
 * 1. Surface parity -- config validation rejects the same keys on CLI
 * 2. Config key whitelist -- prototype pollution, unknown sections, all valid sections
 * 3. Parser heading tolerance -- ###, ####, #####, mixed, and invalid levels
 * 4. Plan-write taskCount consistency -- write and sync agree on task count
 * 5. Exit code contract -- MaestroError=2, Error=1, success=0
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { createTestHarness, getErrorText, type TestHarness } from '../mocks/test-harness.ts';
import { parseTasksFromPlan } from '../../app/plans/parser.ts';
import { validateSettingsKey, WRITABLE_KEY_PREFIXES } from '../../domain/config-validation.ts';
import { MaestroError } from '../../domain/errors.ts';

let harness: TestHarness;

afterEach(async () => {
  if (harness) await harness.cleanup();
});

// ===========================================================================
// 1. Surface parity: config validation on CLI (FIX-1 exact reproduction)
// ===========================================================================
describe('regression: config key validation on CLI surface (FIX-1)', () => {
  // Regression: FIX-1 -- validateSettingsKey was only in MCP handler.
  // CLI config-set had zero key validation, allowing prototype pollution
  // and writes to arbitrary settings sections.

  test('CLI rejects __proto__ key with exit code 2', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', '__proto__.polluted', '--value', 'true');
    expect(result.exitCode).toBe(2);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('disallowed');
    expect(parsed.hints).toBeDefined();
    expect(parsed.hints[0]).toContain('__proto__');
  });

  test('CLI rejects constructor key', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', 'constructor.prototype', '--value', '{}');
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).error).toContain('disallowed');
  });

  test('CLI rejects prototype key', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', 'prototype.x', '--value', 'true');
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).error).toContain('disallowed');
  });

  test('CLI rejects unknown top-level section', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', 'hacker.inject', '--value', 'true');
    expect(result.exitCode).toBe(2);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.error).toContain('Unknown config section');
    expect(parsed.hints).toBeDefined();
    expect(parsed.hints[0]).toContain('Valid top-level sections');
  });

  test('CLI rejects bare key without section prefix', async () => {
    // Before FIX-1, `config-set --key buildCommand --value "rm -rf /"` would succeed
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', 'buildCommand', '--value', '"rm -rf /"');
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).error).toContain('Unknown config section');
  });

  test('CLI accepts all valid top-level sections', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    // Every section in WRITABLE_KEY_PREFIXES must be accepted
    for (const section of WRITABLE_KEY_PREFIXES) {
      const result = await harness.run('config-set', '--key', `${section}.testKey`, '--value', 'true');
      expect(result.exitCode).toBe(0);
    }
  });
});

// ===========================================================================
// 2. Shared validator unit tests (boundary variants for FIX-1)
// ===========================================================================
describe('regression: validateSettingsKey boundaries', () => {
  // These catch the category siblings: any new prototype pollution vector
  // or section whitelist bypass.

  test('rejects __proto__ anywhere in key path', () => {
    expect(() => validateSettingsKey('__proto__')).toThrow(MaestroError);
    expect(() => validateSettingsKey('tasks.__proto__')).toThrow(MaestroError);
    expect(() => validateSettingsKey('dcp.__proto__.x')).toThrow(MaestroError);
    expect(() => validateSettingsKey('__proto__.tasks')).toThrow(MaestroError);
  });

  test('rejects constructor anywhere in key path', () => {
    expect(() => validateSettingsKey('constructor')).toThrow(MaestroError);
    expect(() => validateSettingsKey('tasks.constructor')).toThrow(MaestroError);
    expect(() => validateSettingsKey('constructor.assign')).toThrow(MaestroError);
  });

  test('rejects prototype anywhere in key path', () => {
    expect(() => validateSettingsKey('prototype')).toThrow(MaestroError);
    expect(() => validateSettingsKey('prototype.hasOwnProperty')).toThrow(MaestroError);
  });

  test('rejects unknown top-level keys', () => {
    const invalidKeys = ['unknown', 'settings', 'config', 'env', 'debug', 'internal', 'system'];
    for (const key of invalidKeys) {
      expect(() => validateSettingsKey(`${key}.x`)).toThrow(MaestroError);
    }
  });

  test('accepts every valid section with nested keys', () => {
    for (const section of WRITABLE_KEY_PREFIXES) {
      expect(() => validateSettingsKey(`${section}.a`)).not.toThrow();
      expect(() => validateSettingsKey(`${section}.a.b`)).not.toThrow();
      expect(() => validateSettingsKey(`${section}.a.b.c`)).not.toThrow();
    }
  });

  test('error includes hint listing valid sections', () => {
    try {
      validateSettingsKey('invalid.key');
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(MaestroError);
      expect((e as MaestroError).hints.length).toBeGreaterThan(0);
      expect((e as MaestroError).hints[0]).toContain('toolbox');
      expect((e as MaestroError).hints[0]).toContain('dcp');
    }
  });
});

// ===========================================================================
// 3. Parser heading tolerance (FIX-2 exact reproduction + variants)
// ===========================================================================
describe('regression: plan parser heading tolerance (FIX-2)', () => {
  // Regression: FIX-2 -- parser only matched /^###\s+\d+\.\s+/
  // Agents commonly write #### under ### Phase headings. task-sync
  // silently produced 0 tasks.

  test('parses ### headings (standard)', () => {
    const plan = '### 1. Setup\nDo setup.\n\n### 2. Build\nDo build.';
    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].order).toBe(1);
    expect(tasks[1].order).toBe(2);
  });

  test('parses #### headings under phase sections (FIX-2 exact reproduction)', () => {
    // This is the exact scenario that broke: tasks under a ### Phase heading
    const plan = [
      '## Phase 1: Auth',
      '',
      '#### 1. Add JWT validation [depends: none]',
      'Validate tokens in middleware.',
      '',
      '#### 2. Add rate limiting [depends: 1]',
      'Token-bucket algorithm.',
    ].join('\n');

    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].order).toBe(1);
    expect(tasks[0].name).toContain('JWT validation');
    expect(tasks[1].order).toBe(2);
    expect(tasks[1].dependsOnNumbers).toEqual([1]);
  });

  test('parses ##### headings (deep nesting)', () => {
    const plan = '##### 1. Deep task\nDeeply nested task description.';
    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Deep task');
  });

  test('parses ###### headings (maximum depth)', () => {
    const plan = '###### 1. Max depth task\nAt heading level 6.';
    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(1);
  });

  test('parses mixed ### and #### headings together', () => {
    const plan = [
      '### 1. Top-level task',
      'Description A.',
      '',
      '#### 2. Nested task',
      'Description B.',
      '',
      '### 3. Back to top level',
      'Description C.',
    ].join('\n');

    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(3);
    expect(tasks.map(t => t.order)).toEqual([1, 2, 3]);
  });

  test('rejects ## headings (too shallow -- these are section headers)', () => {
    const plan = '## 1. Not a task\nThis should not be parsed as a task.';
    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(0);
  });

  test('rejects # headings (document title)', () => {
    const plan = '# 1. Not a task\nDocument title.';
    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(0);
  });

  test('rejects ####### headings (beyond h6)', () => {
    const plan = '####### 1. Too deep\nBeyond markdown spec.';
    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(0);
  });

  test('non-numbered headings at any level are not tasks', () => {
    const plan = [
      '### Phase Overview',
      'This is a section, not a task.',
      '',
      '#### Implementation Notes',
      'These are notes.',
      '',
      '#### 1. Actual task',
      'This is the only task.',
    ].join('\n');

    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Actual task');
  });

  test('preserves dependency parsing at all heading levels', () => {
    const plan = [
      '#### 1. Foundation [depends: none]',
      'Base setup.',
      '',
      '#### 2. Core [depends: 1]',
      'Main work.',
      '**Depends on**: 1',
      '',
      '#### 3. Polish [depends: 1, 2]',
      'Final touches.',
    ].join('\n');

    const tasks = parseTasksFromPlan(plan);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].dependsOnNumbers).toEqual([]);
    expect(tasks[1].dependsOnNumbers).toEqual([1]);
    expect(tasks[2].dependsOnNumbers).toEqual([1, 2]);
  });
});

// ===========================================================================
// 4. Plan-write taskCount + task-sync consistency (category sibling)
// ===========================================================================
describe('regression: plan-write taskCount matches task-sync', () => {
  // Category sibling: if the parser and the write-time counter use different
  // regexes, they silently disagree. Both must use #{3,6}.

  test('plan-write reports correct taskCount for #### headings', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');
    await harness.run('feature-create', 'taskcount-test');

    const plan = [
      '## Discovery',
      '',
      'Thorough investigation revealed multiple areas need work across the auth layer, rate limiting, and input validation modules.',
      '',
      '## Non-Goals',
      '- None',
      '',
      '## Ghost Diffs',
      '- None',
      '',
      '## Phase 1',
      '',
      '#### 1. Task Alpha [depends: none]',
      'Do alpha.',
      '',
      '#### 2. Task Beta [depends: 1]',
      'Do beta.',
      '',
      '## Phase 2',
      '',
      '#### 3. Task Gamma [depends: none]',
      'Do gamma.',
    ].join('\n');

    const writeResult = await harness.run('plan-write', '--feature', 'taskcount-test', '--content', plan);
    expect(writeResult.exitCode).toBe(0);
    const writeData = JSON.parse(writeResult.stdout);
    expect(writeData.taskCount).toBe(3);

    await harness.run('plan-approve', '--feature', 'taskcount-test');

    const syncResult = await harness.run('task-sync', '--feature', 'taskcount-test');
    expect(syncResult.exitCode).toBe(0);
    const syncData = JSON.parse(syncResult.stdout);
    expect(syncData.created).toHaveLength(3);
  });

  test('plan-write reports 0 tasks for plan with no numbered headings', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');
    await harness.run('feature-create', 'notask-test');

    const plan = [
      '## Discovery',
      '',
      'We investigated thoroughly across multiple dimensions including auth, database, and API layers to understand the full scope.',
      '',
      '## Non-Goals',
      '- None',
      '',
      '## Ghost Diffs',
      '- None',
      '',
      '## Overview',
      'No numbered task headings here.',
    ].join('\n');

    const writeResult = await harness.run('plan-write', '--feature', 'notask-test', '--content', plan);
    expect(writeResult.exitCode).toBe(0);
    const writeData = JSON.parse(writeResult.stdout);
    expect(writeData.taskCount).toBe(0);
  });
});

// ===========================================================================
// 5. Exit code contract (category sibling for FIX-1)
// ===========================================================================
describe('regression: exit code contract', () => {
  // Config validation errors are MaestroError (exit 2), not plain Error.
  // This matters for agent retry logic.

  test('config-set validation error exits 2 (MaestroError)', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', 'bogus.key', '--value', 'x');
    expect(result.exitCode).toBe(2);
  });

  test('config-set prototype pollution exits 2 (MaestroError)', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', '__proto__.x', '--value', 'y');
    expect(result.exitCode).toBe(2);
  });

  test('config-set valid key exits 0 (success)', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');

    const result = await harness.run('config-set', '--key', 'dcp.enabled', '--value', 'true');
    expect(result.exitCode).toBe(0);
  });

  test('plan-write validation error exits 2 (MaestroError)', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('config-set', '--key', 'tasks.backend', '--value', 'fs');
    await harness.run('feature-create', 'exit-test');

    // Missing ## Discovery section -> MaestroError
    const result = await harness.run('plan-write', '--feature', 'exit-test', '--content', 'No discovery section');
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).error).toContain('Discovery');
  });
});
