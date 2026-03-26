/**
 * maestro task-brief -- get compiled worker context for a task.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import { taskBrief } from '../../../../app/tasks/task-brief.ts';

export default defineCommand({
  meta: { name: 'task-brief', description: 'Get compiled worker context for a task\n\nExamples:\n  maestro task-brief --task 01-setup --json\n  maestro task-brief --task 01-setup --budget 4096 --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    task: {
      type: 'string',
      description: 'Task ID (folder name)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [
        FEATURE_HINT,
      ]);

      const result = await taskBrief({
        taskPort: services.taskPort,
        featureAdapter: services.featureAdapter,
        memoryAdapter: services.memoryAdapter,
        settingsPort: services.settingsPort,
        directory: services.directory,
        graphPort: services.graphPort,
        doctrinePort: services.doctrinePort,
      }, featureName, args.task);
      const guidance = services.agentToolsRegistry.assembleProtocol('code-intelligence') ?? undefined;
      const briefResult = { ...result, agentToolsGuidance: guidance };
      output(briefResult, (r) => JSON.stringify(r, null, 2));
    } catch (err) {
      handleCommandError('task-brief', err);
    }
  },
});
