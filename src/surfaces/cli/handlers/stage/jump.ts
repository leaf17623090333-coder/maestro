/**
 * maestro stage-jump -- jump to a specific pipeline stage.
 */

import { defineCommand } from 'citty';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { buildPlaybook } from '../../../../app/workflow/playbook.ts';
import type { PipelineStage } from '../../../../app/workflow/stages.ts';

const ALL_STAGES: PipelineStage[] = ['discovery', 'research', 'planning', 'approval', 'execution', 'done'];

export default defineCommand({
  meta: { name: 'stage-jump', description: 'Jump to a specific pipeline stage\n\nExamples:\n  maestro stage-jump --target execution --current-stage planning\n  maestro stage-jump --target research --current-stage discovery --json' },
  args: {
    target: {
      type: 'string',
      description: `Target stage to jump to (${ALL_STAGES.join(', ')})`,
      required: true,
    },
    'current-stage': {
      type: 'string',
      description: `Current pipeline stage (${ALL_STAGES.join(', ')})`,
      required: true,
    },
  },
  async run({ args }) {
    try {
      const current = args['current-stage'] as PipelineStage;
      const currentIdx = ALL_STAGES.indexOf(current);
      if (currentIdx === -1) {
        throw new Error(`Unknown stage: ${current}. Valid: ${ALL_STAGES.join(', ')}`);
      }

      const target = args.target as PipelineStage;
      if (!ALL_STAGES.includes(target)) {
        throw new Error(`Invalid target: ${target}. Valid: ${ALL_STAGES.join(', ')}`);
      }

      const playbook = buildPlaybook(target);
      output({ previousStage: current, newStage: target, playbook }, (r) =>
        `[ok] jumped from '${r.previousStage}' to '${r.newStage}'`,
      );
    } catch (err) {
      handleCommandError('stage-jump', err);
    }
  },
});
