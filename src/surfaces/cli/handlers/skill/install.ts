/**
 * maestro skill-install -- install a skill from a directory.
 */

import { defineCommand } from 'citty';
import { installSkill } from '../../../../app/skills/install.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../error-handler.ts';

export default defineCommand({
  meta: { name: 'skill-install', description: 'Install a skill from a local directory\n\nExamples:\n  maestro skill-install --source ./my-skill\n  maestro skill-install --source /path/to/skill --json' },
  args: {
    source: {
      type: 'string',
      description: 'Path to skill directory containing SKILL.md',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const projectRoot = process.cwd();
      const result = installSkill(args.source, projectRoot);
      output(result, (r) => `[ok] installed skill '${r.name}'\n  path: ${r.path}`);
    } catch (err) {
      handleCommandError('skill-install', err);
    }
  },
});
