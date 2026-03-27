/**
 * maestro task-accept -- accept a task after code review.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import { writeExecutionMemory } from '../../../../app/memory/execution/writer.ts';

export default defineCommand({
  meta: { name: 'task-accept', description: 'Accept a task after code review\n\nExamples:\n  maestro task-accept --task 01-setup\n  maestro task-accept --task 01-setup --feature auth-refactor --json' },
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

      const existing = await services.taskPort.get(featureName, args.task);
      if (!existing) {
        throw new MaestroError(`Task '${args.task}' not found`, ['Check task ID with maestro task-list']);
      }
      if (existing.status === 'done') {
        output(existing, () => `[ok] task '${args.task}' already accepted (done)`);
        return;
      }
      if (existing.status !== 'review') {
        throw new MaestroError(`Task '${args.task}' is not in review state (current: ${existing.status})`, ['Only tasks in review state can be accepted']);
      }
      const summary = existing.summary ?? '';
      let report = null;
      try { report = await services.taskPort.readVerification(featureName, args.task); } catch { /* advisory */ }
      await writeExecutionMemory({
        memoryAdapter: services.memoryAdapter, featureName,
        taskFolder: args.task, task: existing, summary,
        projectRoot: services.directory, verificationReport: report,
      });
      const task = await services.taskPort.done(featureName, args.task, summary);
      output(task, () => `[ok] task '${args.task}' accepted`);
    } catch (err) {
      handleCommandError('task-accept', err);
    }
  },
});
