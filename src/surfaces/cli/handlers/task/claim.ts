/**
 * maestro task-claim -- claim a task for an agent.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'task-claim', description: 'Claim a task for an agent\n\nExamples:\n  maestro task-claim --task 01-setup --agent-id worker-1\n  maestro task-claim --task 01-setup --agent-id worker-1 --json' },
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
    'agent-id': {
      type: 'string',
      description: 'Agent identifier claiming this task',
      required: true,
      alias: 'agentId',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [
        FEATURE_HINT,
      ]);

      const task = await services.taskPort.claim(featureName, args.task, args['agent-id']);
      output(task, () => `[ok] claimed '${args.task}' for agent '${args['agent-id']}'`);
    } catch (err) {
      handleCommandError('task-claim', err);
    }
  },
});
