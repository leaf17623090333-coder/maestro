/**
 * maestro memory-insights -- show memory health: duplicates and compression candidates.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import { findDuplicates } from '../../../../app/dcp/dedup.ts';

export default defineCommand({
  meta: { name: 'memory-insights', description: 'Show memory health: duplicates and compression candidates\n\nExamples:\n  maestro memory-insights\n  maestro memory-insights --feature my-feat --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);

      const memories = services.memoryAdapter.listWithMeta(featureName);
      const stats = services.memoryAdapter.stats(featureName);
      const duplicates = findDuplicates(memories);
      const compressionCandidates = memories
        .filter(m => m.sizeBytes > 2000 && !services.memoryAdapter.isCompressed(featureName, m.name))
        .map(m => ({ name: m.name, sizeBytes: m.sizeBytes }));

      output({ feature: featureName, stats, duplicates, compressionCandidates }, (r) => {
        const lines = [`[ok] Memory insights for '${r.feature}'`, ''];
        lines.push(`  Total files: ${r.stats.count}`);
        lines.push(`  Total size: ${r.stats.totalBytes} bytes`);
        if (r.duplicates.length > 0) {
          lines.push('');
          lines.push(`  Duplicates (${r.duplicates.length}):`);
          for (const d of r.duplicates) lines.push(`    - '${d.a}' <--> '${d.b}' (overlap: ${Math.round(d.overlap * 100)}%)`);
        }
        if (r.compressionCandidates.length > 0) {
          lines.push('');
          lines.push(`  Compression candidates (${r.compressionCandidates.length}):`);
          for (const c of r.compressionCandidates) lines.push(`    - ${c.name} (${c.sizeBytes} bytes)`);
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('memory-insights', err);
    }
  },
});
