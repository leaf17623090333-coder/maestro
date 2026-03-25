# /plan:maestro Skill

**Goal**: Create a universal `/plan:maestro` skill that delivers interview-driven planning without Agent Teams, using only subagents (Task tool) so it works identically on Claude Code, Codex, and Amp Code.
**Architecture**: A single SKILL.md orchestrator lives in `.claude/skills/plan-maestro/` alongside a `reference/planner-prompt.md`. The orchestrator spawns background subagents for upfront research, then spawns a self-contained planner subagent that interviews the user via AskUserQuestion, writes the plan to a draft file, and returns. The orchestrator reads the draft, presents a summary, and saves to `.maestro/plans/` on approval. No TeamCreate, no SendMessage relay.
**Tech Stack**: Markdown, YAML frontmatter, Claude Code Task tool (= Codex spawn_agent = Amp subagent)

## Objective
Create `.claude/skills/plan-maestro/SKILL.md` and `.claude/skills/plan-maestro/reference/planner-prompt.md` implementing cross-platform interview-driven planning via subagent-only patterns.

## Scope
**In**:
- `.claude/skills/plan-maestro/SKILL.md` — orchestrator skill with YAML frontmatter and full workflow
- `.claude/skills/plan-maestro/reference/planner-prompt.md` — planner subagent prompt template
- Update `.claude/skills/maestro/SKILL.md` trigger table to include `/plan:maestro` row

**Out**:
- No changes to `/design`, `/work`, or any existing skill
- No entries in `.agents/skills/` (that directory is for external plugins only)
- No new agents in `.claude/agents/`
- No hook changes
- No execution phase — planning only

## Tasks

- [ ] Task 1: Create plan-maestro skill directory and SKILL.md
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/skills/plan-maestro/SKILL.md` exists with valid YAML frontmatter; `head -6 .claude/skills/plan-maestro/SKILL.md` shows name, description, triggers fields
  - **Dependencies**: none
  - **Files**:
    - `.claude/skills/plan-maestro/SKILL.md` (create)
  - **Steps**:
    1. Create directory `.claude/skills/plan-maestro/`
    2. Write `.claude/skills/plan-maestro/SKILL.md` with this exact content:

```
---
name: plan-maestro
description: "Universal interview-driven planning for Claude Code, Codex, and Amp Code. Uses subagents only -- no Agent Teams required."
triggers:
  - "/plan:maestro"
  - "$plan:maestro"
metadata:
  short-description: "Cross-platform interview-driven planning"
---

# You Are The Plan:Maestro Orchestrator

## Invocation

- Claude Code: `/plan:maestro <request> [--quick]`
- Codex: `$plan:maestro <request> [--quick]`
- Amp Code: `amp skill run plan:maestro <request> [--quick]`

## Codex Tool Mapping

| Claude Code | Codex | Amp |
|-------------|-------|-----|
| `Task(...)` | `spawn_agent(...)` | subagent |
| `Read` | `exec_command (read-only)` | read_file |
| `Write` | `apply_patch` / `exec_command (write)` | write_file |
| `Bash` | `exec_command` | exec |
| `AskUserQuestion` | `request_user_input` | prompt_user |
| `Glob` | `exec_command: find` | list_files |

## Design Request

`$ARGUMENTS`

---

## Core Principle

Spawn subagents for research. Spawn a single planner subagent that interviews the user directly (via AskUserQuestion) and writes the plan. You save the result. No Agent Teams, no message relay.

---

## Workflow

### Step 1: Mode Detection

Detect mode from `$ARGUMENTS`:
- `--quick` flag present → **Quick mode** (1-2 questions, focused)
- Default → **Full mode** (3-5 questions, thorough)

Derive a short topic slug from `$ARGUMENTS` (kebab-case, max 4 words, strip flags).

### Step 2: Write Handoff File

Write `.maestro/handoff/{topic}.json`:

```json
{
  "topic": "{topic}",
  "status": "designing",
  "skill": "plan-maestro",
  "started": "{ISO timestamp}",
  "plan_destination": ".maestro/plans/{topic}.md"
}
```

Create `.maestro/handoff/` if it does not exist.

### Step 3: Load Priority Context

Read `.maestro/notepad.md` if it exists. Extract any `[P0]` or `[P1]` tagged items and any `## Working Memory` entries from the last 7 days. Inject into the planner prompt as `## Priority Context`.

Read `.maestro/wisdom/` — list any files matching the topic slug and include summaries as `## Prior Wisdom`.

### Step 4: Discover Available Skills

Run:
```bash
find .claude/skills -L -name "SKILL.md" -type f 2>/dev/null
find .agents/skills -L -name "SKILL.md" -type f 2>/dev/null
find ~/.claude/skills -L -name "SKILL.md" -type f 2>/dev/null
```

For each SKILL.md found, extract `name` and `description` from YAML frontmatter. Build a skill summary block. If none found, omit the block.

### Step 5: Spawn Background Research Subagents

**Always spawn explore** (read-only codebase search). In full mode, also spawn oracle (strategic analysis).

Spawn explore as a background Task:

```
Task(
  description: "Codebase research for {topic}",
  prompt: "Research the codebase for: {original $ARGUMENTS}

Find and report:
1. Existing patterns and architecture relevant to this request
2. Files likely to need changes
3. Related tests and testing patterns
4. Similar existing implementations
5. Relevant dependencies and imports

Write your complete findings to: .maestro/drafts/{topic}-research.md

Structure the file as:
# Research Log: {topic}

## Codebase Findings (explore)
{your findings}

Use Glob, Grep, and Read tools. Be thorough but concise.",
  run_in_background: true
)
```

In full mode, also spawn oracle as a background Task:

```
Task(
  description: "Strategic analysis for {topic}",
  prompt: "Analyze this design request strategically: {original $ARGUMENTS}

Read the codebase research from: .maestro/drafts/{topic}-research.md
(If the file does not yet exist, wait up to 30 seconds and retry once.)

Provide:
1. Key architectural tradeoffs
2. Potential risks and pitfalls
3. Recommended approach with justification
4. Suggested task breakdown
5. Edge cases and constraints

Append your analysis to .maestro/drafts/{topic}-research.md under:
## Strategic Analysis (oracle)
{your analysis}",
  run_in_background: true
)
```

### Step 6: Collect Research

Wait for background subagents to complete. Poll `.maestro/drafts/{topic}-research.md` with Read every 10 seconds, up to 60 seconds total. After 60 seconds, read whatever exists and continue.

Read `.maestro/drafts/{topic}-research.md` and pass its content inline to the planner prompt.

### Step 7: Spawn Planner Subagent

Read `.claude/skills/plan-maestro/reference/planner-prompt.md`. Substitute all `{placeholder}` values with actual content, then spawn:

```
Task(
  description: "Interview and plan for {topic}",
  prompt: "{substituted planner prompt}"
)
```

Wait for this Task to complete. The planner writes the completed plan to `.maestro/drafts/{topic}-plan-draft.md` and returns "PLAN WRITTEN".

### Step 8: Read and Present Plan

Read `.maestro/drafts/{topic}-plan-draft.md`.

Display a structured summary to the user:
- Title (first `# ` line)
- Objective (first sentence under `## Objective`)
- Task count and agents (count `- [ ] Task N:` lines, group by `**Agent**:` value)
- Dependency chain (from `## Dependency Chain` section)

Then ask:

```
AskUserQuestion(
  questions: [{
    question: "The plan is ready. How would you like to proceed?",
    header: "Plan Review",
    options: [
      { label: "Approve", description: "Save plan to .maestro/plans/{topic}.md" },
      { label: "Revise", description: "Provide feedback for the planner to revise" },
      { label: "Cancel", description: "Discard the draft and exit" }
    ],
    multiSelect: false
  }]
)
```

**On Approve**: Continue to Step 9.

**On Revise**: Ask the user for specific feedback (AskUserQuestion with free-text). Re-spawn the planner Task with the existing draft content prepended as `## Current Draft` and the feedback as `## Revision Request`. Loop up to 2 times, then proceed to Step 9 regardless.

**On Cancel**: Delete `.maestro/drafts/{topic}-plan-draft.md`. Update handoff `status` to `"cancelled"`. Stop.

### Step 9: Save Plan

Write the plan to its final destination:
```
Write(
  file_path: ".maestro/plans/{topic}.md",
  content: {plan content from draft file}
)
```

Auto-capture design decisions: read the `## Notes` section. If it has content, append up to 5 decisions as timestamped entries to `.maestro/notepad.md` under `## Working Memory`:
```
- [{ISO date}] [plan-maestro:{topic}] {decision}
```
Create `.maestro/notepad.md` if it does not exist.

### Step 10: Update Handoff

Update `.maestro/handoff/{topic}.json`:
```json
{
  "topic": "{topic}",
  "status": "complete",
  "skill": "plan-maestro",
  "started": "{original timestamp}",
  "completed": "{ISO timestamp}",
  "plan_destination": ".maestro/plans/{topic}.md"
}
```

### Step 11: Hand Off

Tell the user:
```
Plan saved to: .maestro/plans/{topic}.md

To execute:
  Claude Code / Codex: /work
  Amp Code:            amp skill run work

/work auto-detects this plan and will suggest it for execution.
```

---

## Anti-Patterns

| Anti-Pattern | Do This Instead |
|--------------|-----------------|
| Using TeamCreate or SendMessage | Use Task (subagents) only |
| Interviewing the user yourself | Spawn the planner subagent — it owns the interview |
| Researching codebase yourself | Spawn explore/oracle background subagents |
| Skipping the handoff file | Always write .maestro/handoff/ before spawning |
| Polling indefinitely for research | Max 60s wait, then proceed with whatever exists |
| Writing plan draft yourself | Planner subagent writes the draft — you only save it |
```

    3. Run `head -6 .claude/skills/plan-maestro/SKILL.md` — confirm frontmatter shows name, description, triggers
    4. Commit: `git add .claude/skills/plan-maestro/SKILL.md && git commit -m "feat(skills): add plan-maestro orchestrator SKILL.md"`

- [ ] Task 2: Create planner reference prompt
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/skills/plan-maestro/reference/planner-prompt.md` exists; contains AskUserQuestion interview instructions, plan format, and completion protocol; `head -5 .claude/skills/plan-maestro/reference/planner-prompt.md` returns content
  - **Dependencies**: Task 1
  - **Files**:
    - `.claude/skills/plan-maestro/reference/planner-prompt.md` (create)
  - **Steps**:
    1. Create directory `.claude/skills/plan-maestro/reference/`
    2. Write `.claude/skills/plan-maestro/reference/planner-prompt.md` with this exact content:

```
# Planner Subagent Prompt — plan:maestro

This file is a prompt template. The orchestrator reads it, substitutes all `{placeholder}` values, and passes the result as the `prompt` argument to a Task subagent call.

## Prompt Template

```
## Design Request
{original $ARGUMENTS}

## Mode
{mode_line}

## Topic Slug
{topic}

## Upfront Research
{content of .maestro/drafts/{topic}-research.md, or "No research available yet."}

## Priority Context
{notepad P0/P1 items and Working Memory entries from last 7 days, or "None"}

## Prior Wisdom
{wisdom file summaries matching topic slug, or "None"}

{skill summary block — omit entirely if no skills found}

---

You are a planning subagent. Your job is to conduct an interview with the user, research the codebase, and produce a complete implementation plan.

You interact with the user DIRECTLY via AskUserQuestion. You do NOT relay through any orchestrator.

## Interview Protocol

### How to Ask Questions

Call AskUserQuestion once per question. Wait for the answer before proceeding.

```
AskUserQuestion(
  questions: [{
    question: "{your question text}",
    header: "Planning: {topic}",
    options: [
      { label: "(Recommended) {option 1 label}", description: "{tradeoff description}" },
      { label: "{option 2 label}", description: "{tradeoff description}" },
      { label: "{option 3 label}", description: "{tradeoff description}" }
    ],
    multiSelect: false
  }]
)
```

After calling AskUserQuestion, the tool returns the user's selected answer. Use that answer to inform the next question or your plan decisions. Do not ask the same question twice.

### Interview Rules

1. One question at a time — one AskUserQuestion call, then wait
2. Multiple-choice preferred — 2-4 options, recommended first with '(Recommended)'
3. Present tradeoffs for each option
4. Research before asking — use Glob, Grep, Read to check the codebase first
5. YAGNI ruthlessly — strip unnecessary scope
6. Full mode: ask 3-5 questions. Quick mode: ask 1-2 questions only.

### Inline Follow-up Research

Between questions, use Read, Glob, Grep, WebSearch, or WebFetch to gather facts. Do not ask the user what the codebase can tell you.

## Clearance Checklist

ALL must be answered before writing the plan:
- [ ] Core objective defined?
- [ ] Scope boundaries established?
- [ ] Codebase research complete?
- [ ] Technical approach decided?
- [ ] Test strategy confirmed?

## Plan Format

Write the plan with these exact sections:

# {Plan Name}

**Goal**: [One sentence — what we're building and why]
**Architecture**: [2-3 sentences — how the pieces fit together]
**Tech Stack**: [Relevant technologies, frameworks, tools]

## Objective
[One sentence summary]

## Scope
**In**: [What we're doing]
**Out**: [What we're explicitly not doing]

## Tasks

- [ ] Task 1: [Short title]
  - **Agent**: kraken | spark
  - **Acceptance criteria**: [Objectively verifiable outcomes]
  - **Dependencies**: none | Task N
  - **Files**: [Exact paths to create/modify/test]
  - **Steps**:
    1. Write failing test (if applicable)
    2. Run test — expect failure
    3. Implement the change
    4. Run tests — expect pass
    5. Commit

## Dependency Chain
> T1: {title} [`agent`]
> T2: {title} [`agent`]
> T3: {title} [`agent`] — blocked by T1, T2

## Execution Phases
> **Phase 1** — T1: {short title} [`agent`], T2: {short title} [`agent`]
> **Phase 2** — T3: {short title} [`agent`]

## Verification
- [ ] `exact command` — expected output or behavior

## Notes
[Technical decisions, research findings, constraints discovered during interview]

## Plan Output Standards
1. Zero-context plans — document every file path, code snippet, and test approach
2. Single-action tasks — one action per task
3. Files section per task — exact paths to create, modify, and test
4. Complete code/diffs — full snippets, never vague instructions
5. Exact commands with expected output for verification
6. TDD and frequent commits
7. Security-sensitive plans — add `## Security` section for auth, user input, API endpoints, secrets, data access

## Revision Handling

If the prompt includes a `## Revision Request` section:
- Read the `## Current Draft` section for the existing plan
- Apply ONLY the changes specified in `## Revision Request`
- Do not re-interview the user unless the revision requires new information
- Write the revised plan and complete as normal

## Completion

When the plan passes all clearance checklist items:
1. Write the complete plan markdown to: `.maestro/drafts/{topic}-plan-draft.md`
2. Verify the file was written by reading the first 10 lines
3. Output: "PLAN WRITTEN"
```

```

    3. Run `head -5 .claude/skills/plan-maestro/reference/planner-prompt.md` — confirm file exists and has content
    4. Commit: `git add .claude/skills/plan-maestro/reference/planner-prompt.md && git commit -m "feat(skills): add plan-maestro planner reference prompt"`

- [ ] Task 3: Update maestro skill trigger table
  - **Agent**: spark
  - **Acceptance criteria**: `.claude/skills/maestro/SKILL.md` trigger table includes a `/plan:maestro` row; `grep "plan:maestro" .claude/skills/maestro/SKILL.md` returns a match
  - **Dependencies**: Task 1
  - **Files**:
    - `.claude/skills/maestro/SKILL.md` (modify)
  - **Steps**:
    1. Read `.claude/skills/maestro/SKILL.md`
    2. Locate the Triggers table. Find the row:
       `| \`/design <request>\` | Start Prometheus interview mode (supports \`--quick\`) |`
    3. Insert this row immediately after it:
       `| \`/plan:maestro [<request>] [--quick]\` | Universal cross-platform interview-driven planning (subagents only, no Agent Teams) |`
    4. Run `grep "plan:maestro" .claude/skills/maestro/SKILL.md` — confirm the row appears
    5. Commit: `git add .claude/skills/maestro/SKILL.md && git commit -m "docs(skills): add plan:maestro to maestro trigger table"`

- [ ] Task 4: Validate plugin manifest and run validation scripts
  - **Agent**: spark
  - **Acceptance criteria**: `cat .claude-plugin/plugin.json | jq .` exits 0; `./scripts/validate-links.sh` exits 0; `./scripts/validate-anchors.sh` exits 0
  - **Dependencies**: Task 2, Task 3
  - **Files**:
    - `.claude-plugin/plugin.json` (read-only verify)
  - **Steps**:
    1. Run `cat .claude-plugin/plugin.json | jq .` — confirm valid JSON, exit 0
    2. Run `./scripts/validate-links.sh` — confirm exits 0
    3. Run `./scripts/validate-anchors.sh` — confirm exits 0
    4. If any script fails: read the error output, identify which file has broken links/anchors, fix the specific markdown in the new skill files, re-run the failing script
    5. Confirm all three pass before marking complete

## Dependency Chain
> T1: Create plan-maestro SKILL.md [`spark`]
> T2: Create planner reference prompt [`spark`] — blocked by T1
> T3: Update maestro trigger table [`spark`] — blocked by T1
> T4: Validate plugin manifest and scripts [`spark`] — blocked by T2, T3

## Execution Phases
> **Phase 1** — T1: Create plan-maestro SKILL.md [`spark`]
> **Phase 2** — T2: Create planner reference prompt [`spark`], T3: Update maestro trigger table [`spark`]
> **Phase 3** — T4: Validate plugin manifest and scripts [`spark`]

## Verification
- [ ] `head -6 .claude/skills/plan-maestro/SKILL.md` — shows valid YAML frontmatter with name: plan-maestro
- [ ] `head -5 .claude/skills/plan-maestro/reference/planner-prompt.md` — returns file content
- [ ] `grep "plan:maestro" .claude/skills/maestro/SKILL.md` — returns trigger table row
- [ ] `cat .claude-plugin/plugin.json | jq .` — exits 0, valid JSON
- [ ] `./scripts/validate-links.sh` — exits 0
- [ ] `./scripts/validate-anchors.sh` — exits 0

## Notes

### Decision: Files go directly in .claude/skills/ (not .agents/skills/)
`.agents/skills/` is for external plugins only. All first-party Maestro skills are plain directories under `.claude/skills/`. No symlinks needed.

### Decision: Subagent-only, no Agent Teams
Task tool is the cross-platform common denominator: Task = spawn_agent (Codex) = subagent (Amp). No TeamCreate, TeamDelete, or SendMessage anywhere in the skill.

### Decision: Planner subagent uses AskUserQuestion directly
The planner is a general-purpose Task subagent (not a Plan-type agent). General-purpose subagents can call AskUserQuestion and interact with the user directly. The orchestrator does not relay questions — it just spawns the planner, waits for completion, then reads the draft file.

### Decision: Plan handoff via draft file
The planner writes `.maestro/drafts/{topic}-plan-draft.md` on completion. The orchestrator reads this file after the Task returns. This avoids Task return value truncation for large plans and gives the orchestrator a file to re-read on resume.

### Decision: T2 and T3 are parallel (both blocked only by T1)
Task 2 (planner prompt) and Task 3 (trigger table update) are independent — both only require T1 to exist. They can run in parallel in Phase 2.
