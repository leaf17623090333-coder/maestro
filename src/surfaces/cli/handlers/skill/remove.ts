/**
 * maestro skill-remove -- remove an installed skill.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineCommand } from 'citty';
import { output } from '../../../../infra/utils/output.ts';
import { MaestroError } from '../../../../domain/errors.ts';
import { handleCommandError } from '../../error-handler.ts';

export default defineCommand({
  meta: { name: 'skill-remove', description: 'Remove an installed skill\n\nExamples:\n  maestro skill-remove --name my-workflow\n  maestro skill-remove --name maestro:design --json' },
  args: {
    name: {
      type: 'string',
      description: 'Skill name to remove',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const projectRoot = process.cwd();
      const slug = args.name.toLowerCase().replace(/[^a-z0-9-:]/g, '-').replace(/-+/g, '-');
      const skillDir = path.join(projectRoot, '.maestro', 'skills', slug);
      if (!fs.existsSync(skillDir)) {
        throw new MaestroError(`Skill '${args.name}' not found at ${skillDir}`, ['Use maestro skill-list to see available skills.']);
      }
      fs.rmSync(skillDir, { recursive: true });
      output({ removed: args.name }, () => `[ok] removed skill '${args.name}'`);
    } catch (err) {
      handleCommandError('skill-remove', err);
    }
  },
});
