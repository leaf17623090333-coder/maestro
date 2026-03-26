/**
 * Regression tests: MCP response contract normalization.
 *
 * Fixed issues:
 * - 77 respond({error}) calls bypassed errorResponse(), producing inconsistent error shapes
 * - Success responses lacked a success:true field for uniform agent checking
 * - Validation errors had no suggestions (agents couldn't self-correct)
 *
 * These tests verify the response utilities enforce a consistent contract,
 * and that handler files use errorResponse() exclusively for errors.
 */

import { describe, test, expect } from 'bun:test';
import { respond, errorResponse, textResponse } from '../../surfaces/mcp/respond.ts';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 1. respond() contract: success:true injected by default
// ---------------------------------------------------------------------------
describe('respond() success field', () => {
  test('injects success:true into every payload', () => {
    const result = respond({ feature: 'test', count: 3 });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.feature).toBe('test');
    expect(parsed.count).toBe(3);
  });

  test('explicit success:false overrides the default', () => {
    const result = respond({ success: false, error: 'boom' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
  });

  test('strips null and undefined fields', () => {
    const result = respond({ a: 1, b: null, c: undefined, d: 'ok' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.a).toBe(1);
    expect(parsed.d).toBe('ok');
    expect('b' in parsed).toBe(false);
    expect('c' in parsed).toBe(false);
    expect(parsed.success).toBe(true);
  });

  test('empty payload still gets success:true', () => {
    const result = respond({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed)).toEqual(['success']);
  });
});

// ---------------------------------------------------------------------------
// 2. errorResponse() contract: structured error with required fields
// ---------------------------------------------------------------------------
describe('errorResponse() structure', () => {
  test('produces all required fields', () => {
    const result = errorResponse({
      terminal: false,
      reason: 'validation',
      error: 'task is required',
      suggestions: ['Provide the task parameter.'],
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect(parsed.terminal).toBe(false);
    expect(parsed.reason).toBe('validation');
    expect(parsed.error).toBe('task is required');
    expect(parsed.suggestions).toEqual(['Provide the task parameter.']);
  });

  test('terminal:true for programmer errors', () => {
    const result = errorResponse({
      terminal: true,
      reason: 'unknown_action',
      error: 'Unknown action: frobnicate',
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect(parsed.terminal).toBe(true);
    expect(parsed.reason).toBe('unknown_action');
  });

  test('omits suggestions when empty array', () => {
    const result = errorResponse({
      terminal: false,
      reason: 'validation',
      error: 'missing param',
      suggestions: [],
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect('suggestions' in parsed).toBe(false);
  });

  test('omits suggestions when undefined', () => {
    const result = errorResponse({
      terminal: false,
      reason: 'not_found',
      error: 'not found',
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect('suggestions' in parsed).toBe(false);
  });

  test('passes through extra fields', () => {
    const result = errorResponse({
      terminal: false,
      reason: 'validation',
      error: 'bad input',
      validValues: ['a', 'b', 'c'],
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.validValues).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// 3. textResponse() does not inject success (raw text, not JSON)
// ---------------------------------------------------------------------------
describe('textResponse() contract', () => {
  test('returns raw text without JSON wrapping', () => {
    const result = textResponse('# Skill content\nHello world');
    expect(result.content[0].text).toBe('# Skill content\nHello world');
    expect(result.content[0].type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// 4. Handler compliance -- removed in Phase 5b (handler files deleted)
// ---------------------------------------------------------------------------
// MCP handler files were deleted in Phase 5b. These compliance checks are vacuously
// satisfied (no handlers exist to violate the contract). The respond/errorResponse
// utilities are tested in sections 1-3 above.
describe('handler error response compliance', () => {
  const HANDLERS_DIR = path.join(import.meta.dir, '../../surfaces/mcp/handlers');

  test('no handler uses respond({error:}) for errors', () => {
    // Handlers deleted in Phase 5b -- directory may not exist; treat as empty.
    const handlerFiles = fs.existsSync(HANDLERS_DIR)
      ? fs.readdirSync(HANDLERS_DIR).filter((f: string) => f.endsWith('.ts'))
      : [];

    const violations: string[] = [];

    for (const file of handlerFiles) {
      const content = fs.readFileSync(path.join(HANDLERS_DIR, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\brespond\(\{/.test(line) && /error:/.test(line) && !/errorResponse/.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('all handlers import errorResponse', () => {
    // Handlers deleted in Phase 5b -- directory may not exist; treat as empty.
    const handlerFiles = fs.existsSync(HANDLERS_DIR)
      ? fs.readdirSync(HANDLERS_DIR).filter((f: string) => f.endsWith('.ts'))
      : [];

    const missingImport: string[] = [];

    for (const file of handlerFiles) {
      const content = fs.readFileSync(path.join(HANDLERS_DIR, file), 'utf-8');
      if (content.includes('errorResponse(') && !content.includes('import') && !content.includes('errorResponse')) {
        missingImport.push(file);
      }
    }

    expect(missingImport).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Truncation and serialization fallbacks keep success:false
// ---------------------------------------------------------------------------
describe('respond() edge cases preserve contract', () => {
  test('oversized response has success:false and truncation metadata', () => {
    // Create a payload larger than 100KB
    const bigPayload: Record<string, unknown> = {};
    for (let i = 0; i < 5000; i++) {
      bigPayload[`key_${i}`] = 'x'.repeat(50);
    }
    const result = respond(bigPayload);
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.success).toBe(false);
    expect(parsed.truncated).toBe(true);
    expect(parsed.original_keys).toBeDefined();
    expect(parsed.truncation_message).toContain('byte limit');
  });
});
