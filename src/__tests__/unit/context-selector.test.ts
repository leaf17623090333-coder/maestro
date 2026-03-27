import { describe, test, expect } from 'bun:test';
import { selectMemories } from '../../app/dcp/selector.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../domain/types.ts';

function makeMemory(name: string, bodyContent: string, overrides: Partial<MemoryFileWithMeta> = {}): MemoryFileWithMeta {
  const content = overrides.content ?? bodyContent;
  return {
    name,
    content,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(content),
    metadata: { tags: [], priority: 2, category: 'research' },
    bodyContent,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '01-setup-auth',
    name: 'Setup authentication module',
    status: 'claimed',
    origin: 'plan',
    ...overrides,
  };
}

describe('selectMemories', () => {
  test('returns empty for 0 memories', () => {
    const result = selectMemories([], makeTask(), null, 4096);
    expect(result.memories).toHaveLength(0);
    expect(result.includedCount).toBe(0);
    expect(result.droppedCount).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.scores).toEqual([]);
  });

  test('returns empty for 0 budget', () => {
    const memories = [makeMemory('test', 'Content')];
    const result = selectMemories(memories, makeTask(), null, 0);
    expect(result.memories).toHaveLength(0);
    expect(result.includedCount).toBe(0);
    expect(result.droppedCount).toBe(1);
  });

  test('includes all when everything fits', () => {
    const memories = [
      makeMemory('a', 'Short content A'),
      makeMemory('b', 'Short content B'),
    ];
    const result = selectMemories(memories, makeTask(), null, 10000);
    expect(result.includedCount).toBe(2);
    expect(result.droppedCount).toBe(0);
  });

  test('enforces budget -- drops memories that exceed', () => {
    const bigContent = 'x'.repeat(3000);
    const memories = [
      makeMemory('big1', bigContent),
      makeMemory('big2', bigContent),
    ];
    // Budget only fits one (3000 chars / 4 = 750 tokens each, budget 800 fits one)
    const result = selectMemories(memories, makeTask(), null, 800);
    expect(result.includedCount).toBe(1);
    expect(result.droppedCount).toBe(1);
    expect(result.totalTokens).toBeLessThanOrEqual(800);
  });

  test('orders by relevance score descending', () => {
    const memories = [
      makeMemory('auth-notes', 'Authentication setup decisions', {
        metadata: { tags: ['auth'], priority: 0, category: 'decision' },
      }),
      makeMemory('db-notes', 'Database migration scripts', {
        metadata: { tags: ['database'], priority: 3, category: 'research' },
      }),
    ];
    const task = makeTask({ name: 'Setup authentication', folder: '01-setup-auth' });
    const result = selectMemories(memories, task, null, 10000);

    // Auth memory should be first (higher relevance to auth task)
    expect(result.memories[0].name).toBe('auth-notes');
  });

  test('keeps top-1 even when all below threshold', () => {
    const memories = [makeMemory('unrelated', 'Totally unrelated content about cooking recipes')];
    const task = makeTask();
    const result = selectMemories(memories, task, null, 10000, 0.99);

    // Even with absurdly high threshold, top-1 is always included
    expect(result.includedCount).toBe(1);
  });

  test('filters by relevance threshold (except top-1)', () => {
    const memories = [
      makeMemory('relevant', 'Authentication setup', {
        metadata: { tags: ['auth'], priority: 0, category: 'decision' },
      }),
      makeMemory('irrelevant', 'Cooking recipe notes', {
        metadata: { tags: ['cooking'], priority: 4, category: 'research' },
      }),
    ];
    const task = makeTask({ name: 'Setup authentication', folder: '01-setup-auth' });
    // High threshold to filter the irrelevant one
    const result = selectMemories(memories, task, null, 10000, 0.5);

    // The relevant one should be included; irrelevant may be filtered
    const included = result.scores.filter(s => s.included);
    expect(included.length).toBeGreaterThanOrEqual(1);
    expect(included.some(s => s.name === 'relevant')).toBe(true);
  });

  test('diagnostics: scores array includes all memories with correct included flag', () => {
    const memories = [
      makeMemory('a', 'Content A'),
      makeMemory('b', 'Content B'),
    ];
    const result = selectMemories(memories, makeTask(), null, 10000);

    expect(result.scores).toHaveLength(2);
    expect(result.scores.every(s => typeof s.score === 'number')).toBe(true);
    expect(result.scores.every(s => typeof s.included === 'boolean')).toBe(true);
    expect(result.scores.every(s => typeof s.name === 'string')).toBe(true);
  });

  test('negative budget returns empty', () => {
    const memories = [makeMemory('test', 'Content')];
    const result = selectMemories(memories, makeTask(), null, -100);
    expect(result.includedCount).toBe(0);
    expect(result.droppedCount).toBe(1);
  });

  test('effectivenessMap influences selection order', () => {
    // Two memories with similar base relevance but different effectiveness
    const memories = [
      makeMemory('low-eff', 'Authentication setup decisions', {
        metadata: { tags: ['auth'], priority: 1, category: 'decision' },
      }),
      makeMemory('high-eff', 'Authentication module configuration', {
        metadata: { tags: ['auth'], priority: 1, category: 'decision' },
      }),
    ];
    const task = makeTask({ name: 'Setup authentication', folder: '01-setup-auth' });

    // high-eff gets a big boost, low-eff gets attenuated
    const effectivenessMap = new Map([
      ['high-eff', 1.0],
      ['low-eff', 0.0],
    ]);

    const result = selectMemories(memories, task, null, 10000, 0.1, undefined, undefined, effectivenessMap);

    // high-eff should score higher due to effectiveness boost
    const highEffScore = result.scores.find(s => s.name === 'high-eff')!.score;
    const lowEffScore = result.scores.find(s => s.name === 'low-eff')!.score;
    expect(highEffScore).toBeGreaterThan(lowEffScore);
  });

  test('selectMemories without effectivenessMap behaves identically to undefined', () => {
    const memories = [makeMemory('a', 'Auth setup content', {
      metadata: { tags: ['auth'], priority: 1, category: 'decision' },
    })];
    const task = makeTask();

    const without = selectMemories(memories, task, null, 10000);
    const withUndefined = selectMemories(memories, task, null, 10000, 0.1, undefined, undefined, undefined);

    expect(without.scores[0].score).toBe(withUndefined.scores[0].score);
  });
});
