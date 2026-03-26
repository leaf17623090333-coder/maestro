/**
 * Shared worker rules constant.
 * Used by pre-agent hook injection and DCP preview.
 */

export const WORKER_RULES = `
## Worker Rules
- Run \`maestro task-done --task <id> --file <summary> --json\` when your work is complete.
- Run \`maestro task-block --task <id> --reason "..." --json\` if you are stuck and need a decision.
- Do not start or claim other tasks.
- Focus exclusively on the task described in this spec.
`.trim();
