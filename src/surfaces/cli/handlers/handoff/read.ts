/**
 * maestro handoff-read -- read a handoff document.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import { getHandoffPath } from '../../../../infra/utils/paths.ts';
import { readText } from '../../../../infra/utils/fs-io.ts';

export default defineCommand({
  meta: { name: 'handoff-read', description: 'Read a handoff document\n\nExamples:\n  maestro handoff-read --id maestro-1ab-implement-auth\n  maestro handoff-read --feature my-feat --id maestro-1ab-implement-auth --json' },
  args: {
    id: {
      type: 'string',
      description: 'Handoff ID (filename without .md)',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const feature = requireFeature(services, args.feature, [FEATURE_HINT]);
      const filePath = getHandoffPath(services.directory, feature, args.id);
      const content = readText(filePath);
      if (content === null) {
        throw new MaestroError(`Handoff not found: ${args.id}`, [`Looked at ${filePath}`]);
      }
      output({ feature, id: args.id, filePath, content }, (r) => r.content);
    } catch (err) {
      handleCommandError('handoff-read', err);
    }
  },
});
