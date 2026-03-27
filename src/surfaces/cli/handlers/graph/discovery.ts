/**
 * maestro graph-discovery -- show all runnable tasks with their specs.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'graph-discovery', description: 'Show all runnable tasks with their specs\n\nExamples:\n  maestro graph-discovery\n  maestro graph-discovery --feature my-feat --json' },
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

      const runnable = await services.taskPort.getRunnable(featureName);
      const tasks = await Promise.all(
        runnable.map(async (task) => {
          const spec = await services.taskPort.readSpec(featureName, task.id);
          return { id: task.id, name: task.name, status: task.status, dependsOn: task.dependsOn, spec };
        }),
      );

      output({ feature: featureName, count: tasks.length, tasks }, (r) => {
        if (r.count === 0) return `No runnable tasks in feature '${r.feature}'`;
        const lines = [`[ok] ${r.count} runnable task(s) in '${r.feature}'`, ''];
        for (const t of r.tasks) {
          lines.push(`  ${t.id}  ${t.name}  [${t.status}]`);
          if (t.dependsOn && t.dependsOn.length > 0) {
            lines.push(`    depends on: ${t.dependsOn.join(', ')}`);
          }
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('graph-discovery', err);
    }
  },
});
