# Wisdom: Improve Design Workflow

## Conventions Discovered
- Agent definition files (`.claude/agents/`) use `## Section Name` headers for logical grouping
- Plan format strings in design.md are single-line escaped strings embedded in Task() prompts — hard for agents to edit reliably
- Plan template skill uses markdown code fences to wrap the template content

## Successful Approaches
- Spawning 3 parallel spark workers for independent single-file edits worked well
- Sequential dependency chain (Task 1 → Task 2) for same-file edits prevented conflicts
- Direct verification of each completed task caught cases where workers reported completion without actually saving changes

## Failed Approaches to Avoid
- Delegating edits inside markdown code fences to spark agents — they struggle with the edit boundaries. Better to apply these directly when the content is templated
- Trusting worker completion reports without file verification — two tasks reported done but hadn't been saved

## Technical Gotchas
- Grep is case-sensitive by default — verification commands should match the actual casing used in the content
- Spark agents can have trouble with Edit tool when the old_string spans markdown code fence boundaries
- When multiple agents edit the same file sequentially, always re-read the file between edits to get current line numbers
