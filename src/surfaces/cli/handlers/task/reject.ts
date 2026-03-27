/**
 * maestro task-reject -- reject a task and request revision.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { resolveContentArg } from '../../resolve-content.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';

export default defineCommand({
  meta: { name: 'task-reject', description: 'Reject a task and request revision\n\nExamples:\n  maestro task-reject --task 01-setup --feedback "Tests missing"\n  maestro task-reject --task 01-setup --file /tmp/review.md --json' },
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
    feedback: {
      type: 'string',
      description: 'Rejection feedback for the worker',
    },
    file: {
      type: 'string',
      description: 'Read feedback from file',
    },
    stdin: {
      type: 'boolean',
      description: 'Read feedback from stdin',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [
        FEATURE_HINT,
      ]);

      const feedback = await resolveContentArg(args.feedback, args, 'feedback');

      const existing = await services.taskPort.get(featureName, args.task);
      if (!existing || existing.status !== 'review') {
        throw new MaestroError(`Task '${args.task}' is not in review state (current: ${existing?.status ?? 'not found'})`, ['Only tasks in review state can be rejected']);
      }
      const revisionCount = (existing.revisionCount ?? 0) + 1;
      const task = await services.taskPort.revision(featureName, args.task, feedback, revisionCount);
      output(task, () => `[ok] task '${args.task}' rejected --> revision`);
    } catch (err) {
      handleCommandError('task-reject', err);
    }
  },
});
