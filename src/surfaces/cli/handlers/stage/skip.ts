/**
 * maestro stage-skip -- advance one stage in the pipeline.
 */

import { defineCommand } from 'citty';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { buildPlaybook } from '../../../../app/workflow/playbook.ts';
import { PIPELINE_STAGES, type PipelineStage } from '../../../../app/workflow/stages.ts';

export default defineCommand({
  meta: { name: 'stage-skip', description: 'Advance one stage forward in the pipeline\n\nExamples:\n  maestro stage-skip --current-stage research\n  maestro stage-skip --current-stage planning --json' },
  args: {
    'current-stage': {
      type: 'string',
      description: `Current pipeline stage (${PIPELINE_STAGES.join(', ')})`,
      required: true,
    },
  },
  async run({ args }) {
    try {
      const current = args['current-stage'] as PipelineStage;
      const currentIdx = PIPELINE_STAGES.indexOf(current);
      if (currentIdx === -1) {
        throw new MaestroError(`Unknown stage: ${current}`, [`Valid stages: ${PIPELINE_STAGES.join(', ')}`]);
      }
      if (currentIdx >= PIPELINE_STAGES.length - 1) {
        throw new MaestroError('Already at the last stage (done)');
      }

      const targetStage = PIPELINE_STAGES[currentIdx + 1];
      const playbook = buildPlaybook(targetStage);
      output({ previousStage: current, newStage: targetStage, playbook }, (r) =>
        `[ok] advanced from '${r.previousStage}' to '${r.newStage}'`,
      );
    } catch (err) {
      handleCommandError('stage-skip', err);
    }
  },
});
