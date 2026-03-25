# Layered Skill Composition

**Status**: Design Document (not yet implemented)
**Author**: Maestro Planning
**Context**: Extends Maestro's existing skill-registry.md and skill-matcher.md with a layered composition model.

## Problem Statement

Maestro currently treats all skills as equal -- they are discovered by the skill registry and matched by the skill matcher using keyword triggers. There is no concept of priority, mandatory injection, or conflict resolution between skills. This leads to:

1. **No guaranteed behaviors** -- critical skills (verification, error handling) are only injected if they match trigger keywords, meaning they can be silently skipped.
2. **No conditional injection** -- mode-specific behaviors (ecomode, deep thinking) require the user to manually activate them each time.
3. **No conflict resolution** -- if two skills give contradictory guidance (e.g., ecomode says "use haiku" but a security skill says "use opus"), there is no defined winner.
4. **Flat priority** -- all matched skills are injected equally, even when some should always take precedence.

## Proposed Solution: Three-Layer Model

### Layer 1: Guarantee Layer (Always Injected)

Skills in this layer are **always** injected into every worker prompt, regardless of task content or user preferences. They represent invariants that must never be skipped.

**Examples**:
- `verification-checklist` -- every worker must follow verification protocol
- `error-handling` -- every worker must handle errors consistently
- `security-baseline` -- every worker must validate inputs and sanitize outputs
- `file-ownership` -- every worker must respect file ownership boundaries

**Properties**:
- Injected unconditionally by the orchestrator at spawn time
- Cannot be overridden by other layers
- Minimal token footprint (keep them short to avoid bloating every prompt)
- Defined by a `layer: guarantee` field in SKILL.md frontmatter

### Layer 2: Enhancement Layer (Conditionally Injected)

Skills in this layer are injected **when a condition is met** -- a magic keyword, a flag, a task property, or a context signal. They modify worker behavior without changing core guarantees.

**Examples**:
- `ecomode` -- injected when `--eco` flag is set or `eco` keyword detected
- `deep-thinking` -- injected when `think`/`ultrathink` keyword detected
- `ultrawork` -- injected when `ultrawork`/`ulw` keyword detected
- `rate-limit-handling` -- injected when rate limit errors are detected in the session

**Properties**:
- Injected by the orchestrator based on session state, flags, or keyword detection
- Can be overridden by Guarantee layer (guarantee wins on conflict)
- Medium token footprint
- Defined by `layer: enhancement` and `condition:` fields in SKILL.md frontmatter

### Layer 3: Execution Layer (User-Activated)

Skills in this layer are activated **explicitly by the user** via `/command` invocation. They represent full workflows, not just behavioral modifications.

**Examples**:
- `/design` -- interview-driven planning
- `/work` -- plan execution with Agent Teams
- `/review` -- post-execution review
- `/pipeline` -- sequential agent chains

**Properties**:
- Activated only by user invocation
- Can reference Guarantee and Enhancement skills
- Full token footprint (complete workflow instructions)
- Defined by `layer: execution` (or implicitly, as any user-invocable skill)

## Composition Rules

### Injection Order

When composing a worker prompt, skills are injected in this order:

```
1. Guarantee skills (always present, injected first)
2. Enhancement skills (conditionally present, injected second)
3. Execution context (task-specific guidance from the plan, injected last)
```

Later layers can reference earlier layers but not override them.

### Conflict Resolution

When two skills from different layers give contradictory guidance:

| Conflict | Winner | Rationale |
|----------|--------|-----------|
| Guarantee vs Enhancement | Guarantee | Safety invariants are non-negotiable |
| Guarantee vs Execution | Guarantee | Same reason |
| Enhancement vs Enhancement | Last activated | User's most recent preference wins |
| Enhancement vs Execution | Enhancement | Mode settings apply across all tasks |

**Example conflict**: Ecomode (enhancement) says "use haiku for simple tasks." Security baseline (guarantee) says "use opus for any task touching authentication code." Resolution: guarantee wins -- auth tasks use opus even in ecomode.

### Composition Syntax

Skills declare their layer and any override rules in frontmatter:

```yaml
---
name: verification-checklist
description: Standard verification protocol for workers
layer: guarantee
priority: 100
overrides: []
---
```

```yaml
---
name: ecomode
description: Cost-efficient model routing
layer: enhancement
priority: 50
condition: flag:--eco OR keyword:eco,ecomode
overrides: []
conflicts_with: [deep-thinking]
---
```

When `conflicts_with` is specified, only the most recently activated skill is used. If both `ecomode` and `deep-thinking` are active, the last one activated takes precedence.

## Implementation Approach

### Changes to skill-registry.md

Add layer awareness to the discovery process:

1. Parse the `layer` field from SKILL.md frontmatter (default: `execution`)
2. Group discovered skills by layer
3. Return a structured index with layer information:

```json
{
  "guarantee": [
    {"name": "verification-checklist", "priority": 100, ...}
  ],
  "enhancement": [
    {"name": "ecomode", "priority": 50, "condition": "flag:--eco", ...}
  ],
  "execution": [
    {"name": "design", "priority": 0, ...},
    {"name": "work", "priority": 0, ...}
  ]
}
```

### Changes to skill-matcher.md

Add layer-aware matching:

1. **Guarantee skills**: Always included in results, no matching needed
2. **Enhancement skills**: Match against active session conditions (flags, keywords, detected states)
3. **Execution skills**: Match against task description keywords (current behavior)

Add conflict resolution step after matching:

1. Collect all matched skills from all layers
2. Check `conflicts_with` declarations
3. Resolve conflicts using the priority rules above
4. Return final skill set with injection order

### Changes to work SKILL.md

Update Step 4 (Spawn Teammates) to inject layered skills:

```markdown
When spawning a worker:
1. Inject all guarantee-layer skills (from skill registry)
2. Check session state for active enhancements (flags, keywords)
3. Inject matching enhancement-layer skills
4. Inject task-specific execution context from the plan
5. Resolve any conflicts (guarantee wins, then priority order)
```

### Changes to orchestrator.md

Add awareness of the layered model:

```markdown
## Skill Composition
When delegating tasks, compose worker prompts using the three-layer model:
- Guarantee layer: Always include (verification, security, error handling)
- Enhancement layer: Include based on session flags and keywords
- Execution layer: Include based on task type and plan context
Use the orchestrator's local conflict rules section for conflict resolution.
```

## Frontmatter Schema Extension

New optional fields for SKILL.md frontmatter:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `layer` | string | `execution` | One of: `guarantee`, `enhancement`, `execution` |
| `priority` | number | `0` | Higher priority wins in conflicts (guarantee: 100+, enhancement: 50+, execution: 0+) |
| `condition` | string | `null` | When to inject (enhancement layer only). Format: `flag:--name` or `keyword:word1,word2` |
| `conflicts_with` | string[] | `[]` | Skill names that conflict with this one |
| `max_tokens` | number | `null` | Token budget hint for injection (helps manage prompt size) |

## Migration Notes

- All existing skills default to `layer: execution` -- no breaking changes
- Guarantee and enhancement skills are opt-in via frontmatter
- The skill matcher's current keyword matching continues to work for execution-layer skills
- Enhancement injection via hooks (keyword-detector.sh) works alongside this system -- hooks handle detection, the orchestrator handles injection

## Open Questions

1. **Token budgeting**: Should we enforce `max_tokens` limits to prevent prompt bloat from too many guarantee skills?
2. **Per-agent layers**: Should different agent types (kraken vs spark) have different guarantee sets?
3. **Dynamic enhancement**: Can enhancement skills be activated/deactivated mid-session, or only at session start?
4. **Nested composition**: Can an enhancement skill itself reference other skills (skill chains)?
5. **Visibility**: Should workers know which layer each skill came from, or just see a flat prompt?
