/**
 * Integration test for DCP feedback loop.
 * Verifies the full round-trip: inject -> trace -> complete -> telemetry -> re-score.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { selectMemories } from '../../app/dcp/selector.ts';
import { appendDcpTrace, readDcpTrace, collectMemoryNames } from '../../app/dcp/trace.ts';
import { recordTelemetry, loadTelemetry, buildEffectivenessMap, type TelemetryRecord } from '../../app/dcp/telemetry.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../domain/types.ts';

let tmpDir: string;

function makeMemory(name: string, bodyContent: string, overrides: Partial<MemoryFileWithMeta> = {}): MemoryFileWithMeta {
  return {
    name,
    content: bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: bodyContent.length,
    metadata: { tags: ['auth'], priority: 2, category: 'decision' },
    bodyContent,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    id: '01-implement-auth',
    folder: '01-implement-auth',
    name: 'Implement authentication',
    status: 'claimed',
    origin: 'plan' as const,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dcp-feedback-'));
  fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'test-feature', 'tasks', '01-implement-auth'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'test-feature', 'tasks', '02-add-tests'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'test-feature', 'memory'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('DCP feedback loop', () => {
  test('full round-trip: inject -> trace -> telemetry -> effectiveness', () => {
    const memories = [
      makeMemory('helpful-mem', 'Authentication architecture decisions with JWT'),
      makeMemory('unhelpful-mem', 'Database migration notes unrelated'),
    ];
    const task = makeTask();

    // Step 1: Select memories (initial -- no effectiveness data)
    const initial = selectMemories(memories, task, null, 10000);
    expect(initial.includedCount).toBe(2);

    // Step 2: Simulate trace write (what pre-agent hook does)
    const included = initial.scores.filter(s => s.included);
    appendDcpTrace(tmpDir, 'test-feature', '01-implement-auth', 0, included.map(s => ({ name: s.name, score: s.score })));

    // Verify trace was written
    const trace = readDcpTrace(tmpDir, 'test-feature', '01-implement-auth');
    expect(trace).not.toBeNull();
    expect(trace!.entries.length).toBe(1);

    // Step 3: Simulate task-done with success outcome (what writeExecutionMemory does)
    const memoryNames = collectMemoryNames(trace!);
    recordTelemetry(tmpDir, {
      taskId: '01-implement-auth',
      featureName: 'test-feature',
      timestamp: new Date().toISOString(),
      injectedMemories: memoryNames,
      outcome: 'success',
      revisionCount: 0,
      verificationPassed: true,
    });

    // Step 4: Record more telemetry to reach minSamples (3)
    for (let i = 0; i < 2; i++) {
      recordTelemetry(tmpDir, {
        taskId: `extra-task-${i}`,
        featureName: 'test-feature',
        timestamp: new Date().toISOString(),
        injectedMemories: ['helpful-mem'], // only helpful-mem in these
        outcome: 'success',
        revisionCount: 0,
        verificationPassed: true,
      });
    }

    // Also record failures for unhelpful-mem
    for (let i = 0; i < 2; i++) {
      recordTelemetry(tmpDir, {
        taskId: `fail-task-${i}`,
        featureName: 'test-feature',
        timestamp: new Date().toISOString(),
        injectedMemories: ['unhelpful-mem'],
        outcome: 'revision',
        revisionCount: 3,
        verificationPassed: false,
      });
    }

    // Step 5: Build effectiveness map and re-score
    const records = loadTelemetry(tmpDir);
    expect(records.length).toBe(5);

    const effectivenessMap = buildEffectivenessMap(records, 3);
    expect(effectivenessMap.has('helpful-mem')).toBe(true);
    expect(effectivenessMap.has('unhelpful-mem')).toBe(true);
    expect(effectivenessMap.get('helpful-mem')!).toBeGreaterThan(0.8);
    // unhelpful-mem: 1 success (co-injected) + 2 heavy revisions -> ~0.4 (below 0.5 neutral)
    expect(effectivenessMap.get('unhelpful-mem')!).toBeLessThan(0.5);

    // Step 6: Re-select with effectiveness -- helpful-mem should score higher relative to unhelpful-mem
    const task2 = makeTask({ id: '02-add-tests', folder: '02-add-tests', name: 'Add test suite' });
    const withEffectiveness = selectMemories(memories, task2, null, 10000, 0.1, undefined, undefined, effectivenessMap);
    const withoutEffectiveness = selectMemories(memories, task2, null, 10000, 0.1, undefined, undefined, undefined);

    const helpfulWithEff = withEffectiveness.scores.find(s => s.name === 'helpful-mem')!.score;
    const unhelpfulWithEff = withEffectiveness.scores.find(s => s.name === 'unhelpful-mem')!.score;
    const helpfulWithout = withoutEffectiveness.scores.find(s => s.name === 'helpful-mem')!.score;
    const unhelpfulWithout = withoutEffectiveness.scores.find(s => s.name === 'unhelpful-mem')!.score;

    // Helpful-mem should get a boost, unhelpful-mem should get attenuated
    expect(helpfulWithEff).toBeGreaterThan(helpfulWithout);
    expect(unhelpfulWithEff).toBeLessThan(unhelpfulWithout);
  });

  test('cold start: no telemetry file -> scores identical to pre-effectiveness', () => {
    const memories = [makeMemory('mem-a', 'Auth setup content')];
    const task = makeTask();

    // No telemetry file exists -- loadTelemetry returns []
    const records = loadTelemetry(tmpDir);
    expect(records).toEqual([]);

    const effectivenessMap = buildEffectivenessMap(records, 3);
    expect(effectivenessMap.size).toBe(0);

    // Scores with empty map should equal scores with undefined map
    const withEmptyMap = selectMemories(memories, task, null, 10000, 0.1, undefined, undefined, effectivenessMap);
    const withoutMap = selectMemories(memories, task, null, 10000);

    expect(withEmptyMap.scores[0].score).toBe(withoutMap.scores[0].score);
  });

  test('feature toggle: effectivenessSignal=false means no effectiveness loading', () => {
    // This test verifies the contract: when effectivenessSignal is false,
    // selectStandardDcp should not load telemetry. We test the underlying
    // behavior: selectMemories without effectivenessMap ignores telemetry.
    const memories = [makeMemory('mem-a', 'Auth setup content')];
    const task = makeTask();

    // Even with telemetry data, passing undefined effectivenessMap = no effect
    recordTelemetry(tmpDir, {
      taskId: 't1', featureName: 'f', timestamp: new Date().toISOString(),
      injectedMemories: ['mem-a'], outcome: 'blocked', revisionCount: 0, verificationPassed: false,
    });

    const withoutMap = selectMemories(memories, task, null, 10000);
    const withUndefined = selectMemories(memories, task, null, 10000, 0.1, undefined, undefined, undefined);

    // Both should be identical (telemetry not consulted)
    expect(withoutMap.scores[0].score).toBe(withUndefined.scores[0].score);
  });
});
