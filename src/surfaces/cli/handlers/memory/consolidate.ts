/**
 * maestro memory-consolidate -- consolidate feature memories.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { consolidateMemories } from '../../../../app/memory/consolidate.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'memory-consolidate', description: 'Consolidate memories: merge duplicates, compress stale, identify promotions\n\nExamples:\n  maestro memory-consolidate --feature my-feat\n  maestro memory-consolidate --feature my-feat --auto-promote --dry-run' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    'auto-promote': {
      type: 'boolean',
      description: 'Auto-promote qualifying memories to global',
      default: false,
    },
    'dry-run': {
      type: 'boolean',
      description: 'Preview changes without modifying files',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);
      const { memoryAdapter } = services;
      const result = consolidateMemories(memoryAdapter, featureName, {
        autoPromote: args['auto-promote'],
        dryRun: args['dry-run'],
      });

      output(result, (r) => {
        const lines = [`[ok] Consolidated memories for '${featureName}'${args['dry-run'] ? ' (dry run)' : ''}`, ''];
        lines.push(`  Total: ${r.stats.total} --> ${r.stats.afterConsolidation}`);
        if (r.merged.length > 0) {
          lines.push(`  Merged: ${r.merged.length}`);
          for (const m of r.merged) lines.push(`    - removed '${m.removed}' (kept '${m.kept}', ${m.reason})`);
        }
        if (r.compressed.length > 0) {
          lines.push(`  Compressed (stale): ${r.compressed.length}`);
          for (const c of r.compressed) lines.push(`    - ${c}`);
        }
        if (r.promoted.length > 0) {
          lines.push(`  Promoted to global: ${r.promoted.length}`);
          for (const p of r.promoted) lines.push(`    - ${p}`);
        }
        if (r.promotionCandidates.length > 0 && r.promoted.length === 0) {
          lines.push(`  Promotion candidates: ${r.promotionCandidates.length}`);
          for (const p of r.promotionCandidates) lines.push(`    - ${p} (use --auto-promote to promote)`);
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('memory-consolidate', err);
    }
  },
});
