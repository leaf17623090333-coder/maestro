/**
 * Agent tool manifest loader and detection.
 */

import { execFileSync } from 'node:child_process';
import type { AgentToolManifest, AgentToolStatus } from './types.ts';
import { AGENT_TOOL_MANIFESTS } from './agent-data.generated.ts';

/**
 * Return agent tool manifests embedded at build time.
 */
export function scanAgentTools(): AgentToolManifest[] {
  return AGENT_TOOL_MANIFESTS;
}

const detectCache = new Map<string, { installed: boolean; version?: string; error?: string }>();

/**
 * Detect whether an agent tool is installed.
 */
export function detectAgentTool(manifest: AgentToolManifest): AgentToolStatus {
  const cached = detectCache.get(manifest.name);
  if (cached) {
    return { manifest, installed: cached.installed, version: cached.version, detectError: cached.error };
  }

  try {
    const output = execFileSync('sh', ['-c', manifest.detect], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const version = output.toString().trim().split('\n')[0] || undefined;
    detectCache.set(manifest.name, { installed: true, version });
    return { manifest, installed: true, version };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'detection failed';
    detectCache.set(manifest.name, { installed: false, error });
    return { manifest, installed: false, detectError: error };
  }
}

export function clearAgentToolCache(): void {
  detectCache.clear();
}
