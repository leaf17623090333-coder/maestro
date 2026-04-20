import { MaestroError } from "@/shared/errors.js";

export function agentSkillNotFound(agentType: string): MaestroError {
  return new MaestroError(`Agent skill '${agentType}' not found`, [
    `Create skill at .maestro/skills/${agentType}/SKILL.md`,
    `Or add a built-in skill at skills/built-in/${agentType}/SKILL.md`,
    "Skills define the agent's behavior, report format, and handoff protocol",
  ]);
}
