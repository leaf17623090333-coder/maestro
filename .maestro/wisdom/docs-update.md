# Wisdom: Documentation Update

## Conventions Discovered
- README.md Agents table format: `| agent-name | Purpose | Model | Team Lead? |`
- Validation scripts exist at `./scripts/validate-links.sh` and `./scripts/validate-anchors.sh`
- Redirect-only doc files (like docs/AGENTS.md) add maintenance burden without value

## Successful Approaches
- Used REFERENCE.md and docs/ARCHITECTURE.md as source of truth for agent details
- Ran validation script after changes to confirm no broken links
- Small focused tasks completed quickly by spark agent

## Failed Approaches to Avoid
- N/A - straightforward execution

## Technical Gotchas
- When adding agents to README table, also check REFERENCE.md and ARCHITECTURE.md for consistency
- Before removing doc files, verify no other files link to them
