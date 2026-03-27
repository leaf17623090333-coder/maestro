/**
 * maestro memory-connect -- create a typed relationship between two memory files.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../../../services.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';
import { requireFeature, FEATURE_HINT } from '../../../../infra/utils/resolve.ts';
import type { MemoryRelation } from '../../../../domain/types.ts';

export default defineCommand({
  meta: { name: 'memory-connect', description: 'Create a typed relationship between two memory files\n\nExamples:\n  maestro memory-connect --name api-findings --target arch-decisions --relation extends\n  maestro memory-connect --name old-approach --target new-approach --relation supersedes --json' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (defaults to active feature)',
    },
    name: {
      type: 'string',
      description: 'Source memory file name',
      required: true,
    },
    target: {
      type: 'string',
      description: 'Target memory file name',
      required: true,
    },
    relation: {
      type: 'string',
      description: 'Relation type: related, supersedes, contradicts, extends',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      const featureName = requireFeature(services, args.feature, [FEATURE_HINT]);

      services.memoryAdapter.connect(featureName, args.name, args.target, args.relation as MemoryRelation);

      output({ feature: featureName, source: args.name, target: args.target, relation: args.relation }, () =>
        `[ok] connected '${args.name}' --[${args.relation}]--> '${args.target}'`,
      );
    } catch (err) {
      handleCommandError('memory-connect', err);
    }
  },
});
