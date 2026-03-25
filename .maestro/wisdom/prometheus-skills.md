# Wisdom: Prometheus Skills — Context7 + Web Research

## Conventions Discovered
- Skills follow a consistent pattern: YAML frontmatter (name, description, triggers, priority) + markdown body
- Agent tool lists are comma-separated in the `tools:` frontmatter line
- Design command prompt strings can be extended with additional `## Key Context` sections
- Context7 recommends an "Add a Rule" integration pattern — skill files map perfectly to this

## Successful Approaches
- Parallel spark workers for independent file edits (3 workers, tasks 1-3 simultaneously)
- Workers self-claimed dependent tasks after completing initial assignments (spark-1 auto-claimed task 4, spark-3 auto-claimed task 5)
- Conditional/smart activation over mandatory flags — lets the agent decide per-session whether web research adds value

## Failed Approaches to Avoid
- macOS `find` doesn't support `-L` with `-type f` in all cases — use without `-L` or without `-type f` on macOS

## Technical Gotchas
- Idle teammates may miss task assignments if they go idle between receiving a completion message and the next assignment — re-send the assignment message to wake them
- Agent Teams idle notifications are automatic and don't mean the worker is done — check TaskList for actual status
