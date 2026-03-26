/**
 * maestro skill-create -- scaffold a new skill with a SKILL.md template.
 */

import { defineCommand } from 'citty';
import { createSkill } from '../../../../app/skills/create.ts';
import { output } from '../../../../infra/utils/output.ts';
import { handleCommandError } from '../../../../domain/errors.ts';

export default defineCommand({
  meta: { name: 'skill-create', description: 'Scaffold a new skill with a SKILL.md template\n\nExamples:\n  maestro skill-create --name my-workflow\n  maestro skill-create --name my-workflow --stage execution --json' },
  args: {
    name: {
      type: 'string',
      description: 'Skill name (e.g. my-workflow or maestro:design)',
      required: true,
    },
    stage: {
      type: 'string',
      description: 'Pipeline stage for the new skill (e.g. execution, planning)',
    },
  },
  async run({ args }) {
    try {
      const projectRoot = process.cwd();
      const result = createSkill(args.name, projectRoot, args.stage);
      output(result, (r) => `[ok] created skill '${r.name}'\n  path: ${r.path}`);
    } catch (err) {
      handleCommandError('skill-create', err);
    }
  },
});
