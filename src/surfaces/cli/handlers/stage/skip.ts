/**
 * maestro stage-skip -- advance one stage in the pipeline.
 */

import { defineCommand } from 'citty';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';
import { buildPlaybook } from '../../../../app/workflow/playbook.ts';
import type { PipelineStage } from '../../../../app/workflow/stages.ts';

const ALL_STAGES: PipelineStage[] = ['discovery', 'research', 'planning', 'approval', 'execution', 'done'];

export default defineCommand({
  meta: { name: 'stage-skip', description: 'Advance one stage forward in the pipeline\n\nExamples:\n  maestro stage-skip --current-stage research\n  maestro stage-skip --current-stage planning --json' },
  args: {
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
      if (currentIdx >= ALL_STAGES.length - 1) {
        throw new Error('Already at the last stage (done)');
      }

      const targetStage = ALL_STAGES[currentIdx + 1];
      const playbook = buildPlaybook(targetStage);
      output({ previousStage: current, newStage: targetStage, playbook }, (r) =>
        `[ok] advanced from '${r.previousStage}' to '${r.newStage}'`,
      );
    } catch (err) {
      handleCommandError('stage-skip', err);
    }
  },
});
