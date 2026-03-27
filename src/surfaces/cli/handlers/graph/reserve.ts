/**
 * maestro graph-reserve -- claim a batch of tasks for parallel execution.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'graph-reserve', description: 'Claim a batch of tasks for parallel execution\n\nExamples:\n  maestro graph-reserve --tasks "task-01,task-02,task-03"\n  maestro graph-reserve --tasks "task-01,task-02" --feature my-feat --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    tasks: {
      type: 'string',
      description: 'Comma-separated task IDs to claim',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);

      const taskIds = args.tasks.split(',').map(t => t.trim()).filter(Boolean);
      const claimed: string[] = [];
      const failed: Array<{ id: string; reason: string }> = [];

      for (const taskId of taskIds) {
        try {
          await services.taskPort.claim(featureName, taskId, 'parallel-agent');
          claimed.push(taskId);
        } catch (err) {
          failed.push({ id: taskId, reason: err instanceof Error ? err.message : String(err) });
        }
      }

      output({ feature: featureName, claimed, failed }, (r) => {
        const lines = [`[ok] reserved ${r.claimed.length}/${taskIds.length} task(s) in '${r.feature}'`];
        if (r.claimed.length > 0) lines.push(`  Claimed: ${r.claimed.join(', ')}`);
        if (r.failed.length > 0) {
          lines.push(`  Failed (${r.failed.length}):`);
          for (const f of r.failed) lines.push(`    - ${f.id}: ${f.reason}`);
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('graph-reserve', err);
    }
  },
});
