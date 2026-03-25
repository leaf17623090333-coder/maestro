# OMC Feature Adoption

**Goal**: Adopt 25 high-value features from oh-my-claudecode into Maestro, organized into 4 independently-shippable phases that progressively enhance worker reliability, model efficiency, session awareness, and coordination.

**Architecture**: Features are implemented as shell/node hook scripts (`.claude/scripts/`), agent definition updates (`.claude/agents/`), skill workflow updates (`.claude/skills/`), and new library files (`.claude/lib/`). No new build systems or runtime dependencies -- everything stays within Maestro's existing markdown + shell architecture.

**Tech Stack**: Bash scripts, Node.js scripts (via `node -e` or standalone `.mjs`), JSON, Markdown, existing Claude Code hook system.

## Objective

Cherry-pick 25 features from OMC that improve Maestro's worker reliability, token efficiency, verification rigor, and session awareness -- while preserving Maestro's plan-centric, opinionated, simple philosophy.

## Scope

**In**:
- Phase 1: Worker reliability hooks (stop hook, error detection, evidence staleness, verification checklist, ecomode, proactive model selection, build-fixer agent) -- 9 features
- Phase 2: Session intelligence (magic keywords, session restore, dynamic skill injection, remember tags, worker persistence loop, file ownership, complexity scoring, critic agent, skill learning) -- 9 features
- Phase 3: Advanced coordination (background agent manager, pipeline mode, consensus planning, rate limit resume, worker heartbeats) -- 5 features
- Phase 4: Architecture extensions (SQLite task coordination, layered skill composition) -- 2 features (design-only in this plan)

**Out**:
- HUD statusline (requires TypeScript build system, terminal rendering)
- OMC's 28+ agent definitions (Maestro's 7+new are sufficient)
- Token cost analytics / usage tracking
- Multilingual keyword detection (English-only for keywords)
- OMC's specific branding/naming (ralph, ultrawork, boulder)

## Tasks

### Phase 1: Worker Reliability & Model Efficiency (9 features)

- [ ] Task 1: Create stop hook for worker persistence
  - **Agent**: kraken
  - **Acceptance criteria**: A `Stop` hook in `.claude/hooks/hooks.json` that runs `.claude/scripts/worker-persistence.sh`. The script reads stdin JSON, checks if the agent is a Maestro worker (kraken/spark/build-fixer). If the agent is a worker, the hook outputs `{"decision": "block", "reason": "Tasks may remain incomplete. Continue working -- use TaskList() to find remaining tasks."}`. Otherwise allows stop. The env vars `MAESTRO_MAX_ITERATIONS` and `MAESTRO_SESSION_START` are OPTIONAL safeguards -- if set (by the orchestrator in Step 4 spawn), the hook respects them; if NOT set, the hook still blocks workers (safe default). NOTE: The `Stop` hook schema (`agent_type` in stdin, `decision`/`block` in output) is based on Claude Code's documented hook behavior. The `bash -n` check validates syntax only; real integration testing requires running in a Claude Code session with an active team.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/worker-persistence.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Create `/Users/reinamaccredy/Code/maestro/.claude/scripts/worker-persistence.sh`:
       ```bash
       #!/bin/bash
       # Stop hook - prevents worker agents from stopping while tasks remain
       # Hook: Stop
       set -euo pipefail
       input=$(cat)
       agent_type=$(printf '%s' "$input" | jq -r '.agent_type // empty' 2>/dev/null) || true
       # Only intercept Maestro worker agents
       case "$agent_type" in
         kraken|spark|build-fixer) ;;
         *) exit 0 ;;
       esac
       # Check iteration count (OPTIONAL -- set by orchestrator via env)
       # If not set, default to 0 (will not trigger max-iteration exit)
       max_iterations="${MAESTRO_MAX_ITERATIONS:-10}"
       iteration="${MAESTRO_ITERATION:-0}"
       if [ "$iteration" -ge "$max_iterations" ]; then
         exit 0  # Allow stop after max iterations
       fi
       # Check session staleness (OPTIONAL -- set by orchestrator via env)
       # If not set, skip staleness check (safe default: keep blocking)
       session_start="${MAESTRO_SESSION_START:-}"
       if [ -n "$session_start" ]; then
         now=$(date +%s)
         elapsed=$(( now - session_start ))
         if [ "$elapsed" -gt 7200 ]; then
           exit 0  # Allow stop after 2 hours
         fi
       fi
       # Block stop -- worker should keep going
       cat <<'EOF'
       {"decision":"block","reason":"Tasks may remain incomplete. Continue working -- use TaskList() to find remaining tasks."}
       EOF
       ```
    2. Add `Stop` hook entry to `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
    3. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/worker-persistence.sh` -- expect exit 0
    4. Verify: `cat /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json | jq .` -- expect valid JSON with Stop hook
    5. Commit

- [ ] Task 2: Create post-tool error detection hook
  - **Agent**: kraken
  - **Acceptance criteria**: A `PostToolUse` hook matching `Bash` that runs `.claude/scripts/error-detector.sh`. The script reads stdin JSON, extracts the `stdout` and `stderr` fields from the tool result, checks exit code. If the exit code is non-zero OR stderr contains error patterns (`error:`, `Error:`, `ENOENT`, `command not found`, `Permission denied`, `fatal:`, `FAILED`), it injects a context message: `"Command failed (exit N). Investigate before proceeding. Error: {first 200 chars of stderr}"`. Does NOT block -- just injects context.
  - **Dependencies**: Task 1 (hooks.json contention)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/error-detector.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Create `/Users/reinamaccredy/Code/maestro/.claude/scripts/error-detector.sh`:
       ```bash
       #!/bin/bash
       # PostToolUse(Bash) - detects command failures and injects investigation reminder
       set -euo pipefail
       input=$(cat)
       exit_code=$(printf '%s' "$input" | jq -r '.tool_result.exit_code // "0"' 2>/dev/null) || exit_code="0"
       stderr=$(printf '%s' "$input" | jq -r '.tool_result.stderr // empty' 2>/dev/null) || stderr=""
       # Check for failure indicators
       is_error=false
       if [ "$exit_code" != "0" ]; then
         is_error=true
       elif printf '%s' "$stderr" | grep -qiE '(error:|Error:|ENOENT|command not found|Permission denied|fatal:|FAILED|panic|Traceback)'; then
         is_error=true
       fi
       if $is_error; then
         # Truncate stderr to 200 chars for context
         short_err=$(printf '%s' "$stderr" | head -c 200)
         printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Command failed (exit %s). Investigate the error before proceeding. Error: %s"}}' "$exit_code" "$short_err"
       fi
       ```
    2. Add `PostToolUse` hook for `Bash` matcher to hooks.json
    3. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/error-detector.sh`
    4. Commit

- [ ] Task 3: Create bash history mirroring hook
  - **Agent**: spark
  - **Acceptance criteria**: A `PostToolUse` hook matching `Bash` that runs `.claude/scripts/bash-history.sh`. On successful Bash commands (exit code 0), appends the command string to `~/.bash_history`. Skips commands that are read-only (cat, ls, grep, head, tail) or contain secrets patterns (password, token, secret, key=). Max 500 chars per command.
  - **Dependencies**: Task 2 (hooks.json contention)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/bash-history.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Create `/Users/reinamaccredy/Code/maestro/.claude/scripts/bash-history.sh`:
       ```bash
       #!/bin/bash
       # PostToolUse(Bash) - mirrors successful commands to user's bash history
       set -euo pipefail
       input=$(cat)
       exit_code=$(printf '%s' "$input" | jq -r '.tool_result.exit_code // "0"' 2>/dev/null) || exit_code="0"
       command_str=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null) || command_str=""
       # Only mirror successful commands
       [ "$exit_code" != "0" ] && exit 0
       [ -z "$command_str" ] && exit 0
       # Skip read-only commands
       if printf '%s' "$command_str" | grep -qE '^\s*(cat|ls|grep|head|tail|wc|file|stat|which|type|echo|pwd) '; then
         exit 0
       fi
       # Skip commands containing secrets
       if printf '%s' "$command_str" | grep -qiE '(password|token|secret|key=|api_key|apikey|credential)'; then
         exit 0
       fi
       # Truncate to 500 chars and append
       short_cmd=$(printf '%s' "$command_str" | head -c 500)
       printf '%s\n' "$short_cmd" >> ~/.bash_history
       ```
    2. Add to hooks.json under PostToolUse Bash matcher (alongside error-detector)
    3. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/bash-history.sh`
    4. Commit

- [ ] Task 4: Create session drift detection in session-start hook
  - **Agent**: spark
  - **Acceptance criteria**: The existing `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh` is extended to check for drift between the plugin's CLAUDE.md instructions and the project's CLAUDE.md. Specifically: reads the plugin version from `.claude-plugin/plugin.json` (field `version`), checks if the project's CLAUDE.md contains the expected Maestro section markers (`## Project Overview`, `## Commands`). If CLAUDE.md is missing Maestro sections, adds a context warning: `"Maestro plugin installed but CLAUDE.md may be outdated. Run /setup to refresh."` Does NOT block.
  - **Dependencies**: none
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
  - **Steps**:
    1. Add drift detection after the existing context gathering in session-start.sh
    2. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
    3. Commit

- [ ] Task 5: Create fresh evidence verification hook
  - **Agent**: spark
  - **Acceptance criteria**: Replace the current simple reminder in `/Users/reinamaccredy/Code/maestro/.claude/scripts/verification-injector.sh` with a staleness-aware version. The new script: (1) still injects the verification reminder, (2) additionally checks if the tool result contains timestamps and warns if evidence is older than 5 minutes, (3) adds specific guidance: `"VERIFICATION REQUIRED: Read files claimed modified, run tests, check for errors. Evidence older than 5 minutes is STALE -- re-run verification commands for fresh output."` The enhanced message replaces the current one-liner.
  - **Dependencies**: none
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/scripts/verification-injector.sh`
  - **Steps**:
    1. Read the current file at `/Users/reinamaccredy/Code/maestro/.claude/scripts/verification-injector.sh`
    2. Replace the simple reminder with the enhanced staleness-aware version
    3. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/verification-injector.sh`
    4. Commit

- [ ] Task 6: Create standard verification checklist library
  - **Agent**: kraken
  - **Acceptance criteria**: Create `.claude/lib/verification-checklist.md` that defines a standard verification protocol for workers. Contains: (1) A checklist table with 7 standard checks: BUILD (code compiles), TEST (tests pass), LINT (no lint errors), FUNCTIONALITY (features work as described), TODO (zero pending tasks), ERROR_FREE (no unaddressed errors), ARCHITECT (team lead verified). (2) Each check has: id, name, description, evidence_type, required flag. (3) Instructions for workers on how to report evidence: include the exact command run, its output timestamp, and pass/fail status. (4) A "stale evidence" policy: command output must be from within the last 5 minutes. Workers should reference this checklist when marking tasks complete. The orchestrator's work SKILL.md should reference this checklist in its verification step.
  - **Dependencies**: Task 5 (content dependency), Task 8 (work SKILL.md contention)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/lib/verification-checklist.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md` (add reference in Step 6: Monitor & Verify)
  - **Steps**:
    1. Create the verification checklist library file
    2. Add a reference to it in the work SKILL.md's Step 6 section, after "TEAMMATES CAN MAKE MISTAKES. ALWAYS VERIFY."
    3. Verify both files are syntactically valid markdown
    4. Commit

- [ ] Task 7: Add ecomode flag to /work skill
  - **Agent**: spark
  - **Acceptance criteria**: The work SKILL.md accepts an `--eco` flag in its arguments section. When `--eco` is present: (1) The orchestrator spawns workers preferring `model: haiku` for spark tasks and `model: sonnet` for kraken tasks (instead of sonnet for both). (2) Oracle/leviathan are not spawned in eco mode. (3) A note is logged: `"Ecomode: using cost-efficient model routing (haiku for simple, sonnet for complex)"`. The flag is documented in the Arguments section alongside `--resume`.
  - **Dependencies**: Task 6 (work SKILL.md contention)
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Read the current work SKILL.md
    2. Add `--eco` to the Arguments section documentation
    3. Add eco mode logic in Step 4 (Spawn Teammates) -- when eco flag is set, add `model: haiku` to spark spawns
    4. Verify the markdown renders correctly
    5. Commit

- [ ] Task 8: Add proactive model selection guidance to orchestrator
  - **Agent**: spark
  - **Acceptance criteria**: The orchestrator agent definition (`.claude/agents/orchestrator.md`) and the work SKILL.md Step 4 include guidance for proactive model selection. The orchestrator should analyze each task's complexity BEFORE spawning a worker and choose the model tier. Add a "Model Selection Guide" section to the orchestrator agent definition with these rules: (1) Tasks containing architecture/refactor/redesign keywords → prefer opus via oracle. (2) Tasks with single-file scope and simple verbs (fix, update, add) → prefer haiku via spark. (3) Multi-file TDD tasks → sonnet via kraken (default). (4) Tasks with "debug", "investigate", "root cause" → prefer sonnet with extended context. This is guidance, not enforcement -- the orchestrator uses judgment.
  - **Dependencies**: Task 7 (work SKILL.md contention)
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/orchestrator.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Add "Model Selection Guide" section to orchestrator.md
    2. Add model selection guidance paragraph to Step 4 of work SKILL.md
    3. Commit

- [ ] Task 9: Create build-fixer agent
  - **Agent**: kraken
  - **Acceptance criteria**: A new agent definition at `.claude/agents/build-fixer.md` with: name `build-fixer`, model `sonnet`, tools matching spark (Read, Write, Edit, Grep, Glob, Bash, TaskList, TaskGet, TaskUpdate, SendMessage), disallowed tools matching spark (Task, TeamCreate, TeamDelete). The agent's identity: specialist for resolving build/compile/lint errors ONLY. Work process: (1) Run the failing command to reproduce, (2) Read error output carefully, (3) Fix the specific error, (4) Re-run to verify, (5) Do NOT expand scope beyond the error. The orchestrator agent definition and work SKILL.md teammate table should include build-fixer as an option alongside spark. Use build-fixer when: build/compile errors, lint failures, type check errors, dependency resolution issues.
  - **Dependencies**: Task 8 (orchestrator.md + work SKILL.md contention)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/agents/build-fixer.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/orchestrator.md` (add to teammate table)
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md` (add to teammate table in Steps 4)
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh` (add build-fixer to known agents)
    - Modify: `/Users/reinamaccredy/Code/maestro/CLAUDE.md` (add to Agents table)
  - **Steps**:
    1. Create the build-fixer agent definition
    2. Add build-fixer to orchestrator.md teammate table
    3. Add build-fixer to work SKILL.md teammate tables
    4. Add `build-fixer` to the case statement in subagent-context.sh
    5. Add build-fixer to the Agents table in CLAUDE.md
    6. Verify all files parse correctly
    7. Commit

- [ ] Task 10: Phase 1 verification
  - **Agent**: spark
  - **Acceptance criteria**: All Phase 1 scripts pass `bash -n` syntax check. hooks.json validates with `jq .`. All modified markdown files have valid structure. The new Stop hook, PostToolUse(Bash) hooks, and verification changes are correctly wired. Specific validations: (1) Each `.sh` script: `bash -n` exits 0. (2) hooks.json: `jq .` exits 0, contains `"Stop"`, `"Bash"` matcher entries, `"UserPromptSubmit"` is NOT yet present (that's Phase 2). (3) Agent frontmatter: build-fixer.md has `---` delimiters, contains `name:`, `description:`, `tools:`, `model:` fields. (4) CLAUDE.md: Agents table contains `build-fixer` row. (5) subagent-context.sh: case statement includes `build-fixer`.
  - **Dependencies**: Tasks 1-9
  - **Files**: (verification only, no new files)
  - **Steps**:
    1. Run `for f in /Users/reinamaccredy/Code/maestro/.claude/scripts/*.sh; do bash -n "$f" && echo "OK: $f" || echo "FAIL: $f"; done`
    2. Run `jq . /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
    3. Run `head -10 /Users/reinamaccredy/Code/maestro/.claude/agents/build-fixer.md` -- verify frontmatter has name, description, tools, model
    4. Run `grep 'build-fixer' /Users/reinamaccredy/Code/maestro/CLAUDE.md` -- expect match in Agents table
    5. Run `grep 'build-fixer' /Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh` -- expect match in case statement
    6. Run `./scripts/validate-links.sh` if available
    7. Commit any fixes
    8. Final commit with message: `feat(omc): Phase 1 -- worker reliability and model efficiency`

### Phase 2: Session Intelligence & Deeper Coordination (9 features)

- [ ] Task 11: Create magic keyword detection hook
  - **Agent**: kraken
  - **Acceptance criteria**: A `UserPromptSubmit` hook in hooks.json that runs `.claude/scripts/keyword-detector.sh`. The script reads stdin JSON, extracts the user's prompt text, checks for magic keywords (case-insensitive, outside code blocks). Supported keywords and their actions: (1) `eco`/`ecomode` → injects `"[ECOMODE] Use cost-efficient models. Prefer haiku for simple tasks, sonnet for complex."` (2) `ultrawork`/`ulw` → injects `"[ULTRAWORK] Maximum thoroughness. Use parallel agents, verify everything, delegate aggressively."` (3) `think`/`ultrathink` → injects `"[DEEP THINKING] Take extra time to reason through this. Consider multiple approaches, edge cases, and risks before acting."` The script strips code blocks (``` delimited) before keyword detection to avoid false positives.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/keyword-detector.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Create `/Users/reinamaccredy/Code/maestro/.claude/scripts/keyword-detector.sh`:
       ```bash
       #!/bin/bash
       # UserPromptSubmit - detects magic keywords and injects mode context
       set -euo pipefail
       input=$(cat)
       # Extract prompt text from message parts
       prompt=$(printf '%s' "$input" | jq -r '[.message.content[]? | select(.type=="text") | .text] | join(" ")' 2>/dev/null) || prompt=""
       [ -z "$prompt" ] && exit 0
       # Strip code blocks to avoid false positives
       clean_prompt=$(printf '%s' "$prompt" | sed '/^```/,/^```/d')
       context=""
       # Check for ecomode keywords
       if printf '%s' "$clean_prompt" | grep -qiE '\b(eco|ecomode)\b'; then
         context="[ECOMODE] Use cost-efficient models. Prefer haiku for simple tasks, sonnet for complex."
       fi
       # Check for ultrawork keywords
       if printf '%s' "$clean_prompt" | grep -qiE '\b(ultrawork|ulw)\b'; then
         context="[ULTRAWORK] Maximum thoroughness. Use parallel agents, verify everything, delegate aggressively."
       fi
       # Check for think keywords
       if printf '%s' "$clean_prompt" | grep -qiE '\b(ultrathink|think)\b'; then
         context="[DEEP THINKING] Take extra time to reason through this. Consider multiple approaches, edge cases, and risks before acting."
       fi
       if [ -n "$context" ]; then
         printf '%s' "$context" | jq -Rs '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: .}}'
       fi
       ```
    2. Add UserPromptSubmit hook to hooks.json
    3. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/keyword-detector.sh`
    4. Commit

- [ ] Task 12: Create session restore hook
  - **Agent**: kraken
  - **Acceptance criteria**: Extend the existing `session-start.sh` OR create a new companion script `.claude/scripts/session-restore.sh` that runs on `SessionStart`. The script checks for: (1) Active handoff files with `status: "executing"` -- injects `"ACTIVE EXECUTION: Plan {topic} was in progress. Run /work --resume to continue."` (2) Active handoff files with `status: "designing"` -- injects `"ACTIVE DESIGN: Plan {topic} was being designed. Run /design to continue."` (3) Stale handoff files (status executing but started > 24 hours ago) -- injects `"STALE SESSION: Plan {topic} started over 24 hours ago. Run /reset to clean up, or /work --resume to continue."` This enhances the existing session-start.sh which already does handoff detection but doesn't check staleness.
  - **Dependencies**: none
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
  - **Steps**:
    1. Read current session-start.sh
    2. Add staleness detection (compare ISO timestamp to current time) in the handoff loop
    3. Add richer context messages for each handoff state
    4. Verify: `bash -n .claude/scripts/session-start.sh`
    5. Commit

- [ ] Task 13: Create dynamic skill injection at prompt time
  - **Agent**: kraken
  - **Acceptance criteria**: A `UserPromptSubmit` hook that runs `.claude/scripts/skill-injector.sh`. The script: (1) Reads the user's prompt from stdin JSON, (2) Scans `.claude/skills/*/SKILL.md` frontmatter for `triggers` arrays, (3) If any trigger keyword appears in the user's prompt (case-insensitive), injects the skill's description as context: `"Relevant skill available: {name} -- {description}. Use /{name} to activate."` (4) Only injects for skills with triggers defined -- skills without triggers are skipped. This gives the AI awareness of available skills based on what the user is asking about.
  - **Dependencies**: Task 11 (hooks.json contention)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/skill-injector.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Create `/Users/reinamaccredy/Code/maestro/.claude/scripts/skill-injector.sh`:
       ```bash
       #!/bin/bash
       # UserPromptSubmit - injects relevant skill descriptions based on prompt keywords
       set -euo pipefail
       input=$(cat)
       prompt=$(printf '%s' "$input" | jq -r '[.message.content[]? | select(.type=="text") | .text] | join(" ")' 2>/dev/null) || prompt=""
       [ -z "$prompt" ] && exit 0
       PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
       skills_dir="$PROJECT_DIR/.claude/skills"
       [ -d "$skills_dir" ] || exit 0
       lower_prompt=$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')
       matched_skills=""
       for manifest in "$skills_dir"/*/SKILL.md; do
         [ -f "$manifest" ] || continue
         # Parse triggers from YAML frontmatter
         triggers=""
         in_frontmatter=false
         while IFS= read -r line; do
           if [ "$line" = "---" ]; then
             if $in_frontmatter; then break; else in_frontmatter=true; continue; fi
           fi
           if $in_frontmatter; then
             case "$line" in
               triggers:*) triggers="${line#triggers:}" ;;
               name:*) skill_name="${line#name: }" ; skill_name="${skill_name#\"}" ; skill_name="${skill_name%\"}" ;;
               description:*) skill_desc="${line#description: }" ; skill_desc="${skill_desc#\"}" ; skill_desc="${skill_desc%\"}" ;;
             esac
           fi
         done < "$manifest"
         [ -z "$triggers" ] && continue
         # Check each trigger against prompt
         for trigger in $(printf '%s' "$triggers" | tr -d '[]",' | tr ' ' '\n'); do
           if printf '%s' "$lower_prompt" | grep -qi "\b${trigger}\b" 2>/dev/null; then
             matched_skills="${matched_skills}Relevant skill: ${skill_name} -- ${skill_desc}. Use /${skill_name} to activate.\n"
             break
           fi
         done
       done
       if [ -n "$matched_skills" ]; then
         printf '%s' "$matched_skills" | jq -Rs '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: .}}'
       fi
       ```
    2. Add to UserPromptSubmit hook in hooks.json (alongside keyword-detector)
    3. Verify: `bash -n /Users/reinamaccredy/Code/maestro/.claude/scripts/skill-injector.sh`
    4. Commit

- [ ] Task 14: Add remember tag support to worker agents
  - **Agent**: kraken
  - **Acceptance criteria**: (1) Create `.claude/lib/remember-tags.md` documenting the `<remember>` tag protocol: workers can emit `<remember category="learning|decision|issue">content</remember>` in their output. (2) Create `.claude/scripts/remember-extractor.sh` as a `PostToolUse(Task)` hook that scans agent output for `<remember>` tags and appends extracted content to `.maestro/wisdom/{active-plan}.md` under the appropriate category heading. (3) Update kraken.md and spark.md agent definitions to mention they can use `<remember>` tags to persist findings. The tag content is appended with a timestamp.
  - **Dependencies**: Task 13 (hooks.json contention), Task 14 also modifies kraken.md and spark.md (no contention with other Phase 2 tasks on those files)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/lib/remember-tags.md`
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/scripts/remember-extractor.sh`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/kraken.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/spark.md`
  - **Steps**:
    1. Create the remember-tags library documentation
    2. Create the remember-extractor.sh script
    3. Add PostToolUse(Task) hook for remember extraction (alongside verification-injector)
    4. Add `<remember>` tag documentation to kraken.md and spark.md
    5. Verify all scripts and JSON
    6. Commit

- [ ] Task 15: Add worker persistence loop to /work skill
  - **Agent**: kraken
  - **Acceptance criteria**: The work SKILL.md Step 6 (Monitor & Verify) is enhanced with a "Completion Gate" protocol inspired by OMC's Ralph loop. Before declaring all tasks complete, the orchestrator MUST: (1) Run `TaskList()` and confirm zero pending/in_progress tasks, (2) Run the plan's verification commands from the `## Verification` section, (3) If ANY verification fails, message the responsible worker to fix it (or spawn a new build-fixer), (4) Only after all verifications pass can the orchestrator proceed to Step 7 (Extract Wisdom). Add a "Completion Checklist" to the orchestrator: `[ ] All tasks completed`, `[ ] All verification commands pass`, `[ ] No build/lint errors`, `[ ] No test failures`. This prevents premature completion.
  - **Dependencies**: Task 6
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Read current work SKILL.md
    2. Add Completion Gate protocol between Step 6 and Step 7
    3. Add Completion Checklist to orchestrator's verification section
    4. Commit

- [ ] Task 16: Add file ownership tracking to task delegation
  - **Agent**: spark
  - **Acceptance criteria**: The work SKILL.md Step 3 (Create Tasks) is enhanced to include file ownership in task descriptions. When creating tasks from plan checkboxes, the orchestrator should: (1) Extract file paths mentioned in each task's Files section, (2) Include a `**Owned files**: file1.ts, file2.ts` line in the task description, (3) When assigning tasks (Step 5), avoid giving two workers tasks that share owned files simultaneously. Add a "File Ownership" note to the orchestrator: `"Avoid assigning tasks with overlapping file paths to different workers simultaneously. If overlap is unavoidable, assign them sequentially."` This is advisory guidance, not enforcement.
  - **Dependencies**: Task 15 (work SKILL.md contention)
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Add file ownership guidance to Step 3 and Step 5 of work SKILL.md
    2. Commit

- [ ] Task 17: Create complexity scoring library
  - **Agent**: kraken
  - **Acceptance criteria**: Create `.claude/lib/complexity-scoring.md` that documents a complexity scoring system for the orchestrator to use when selecting models. The library defines: (1) **Lexical signals**: word count (>200 = +2), file path count (>=2 = +1), architecture keywords (refactor, redesign, etc. = +3), debugging keywords (root cause, investigate = +2), simple keywords (find, list, show = -2), risk keywords (production, critical, migration = +2). (2) **Structural signals**: estimated subtasks (>3 = +3), cross-file dependencies (+2), system-wide impact (+3). (3) **Scoring thresholds**: score >= 8 → HIGH (opus), score >= 4 → MEDIUM (sonnet), score < 4 → LOW (haiku). (4) **Usage instructions**: The orchestrator reads this library and applies the scoring when deciding which model to assign to each worker task. This is a reference document, not executable code.
  - **Dependencies**: Task 9 (orchestrator.md contention -- Task 9 is last Phase 1 task modifying orchestrator.md)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/lib/complexity-scoring.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/orchestrator.md` (reference the library)
  - **Steps**:
    1. Create the complexity scoring library
    2. Add a reference in orchestrator.md's Model Selection Guide
    3. Commit

- [ ] Task 18: Create critic agent
  - **Agent**: kraken
  - **Acceptance criteria**: A new agent definition at `.claude/agents/critic.md` with: name `critic`, model `opus`, tools (Read, Grep, Glob, Bash, TaskList, TaskGet, TaskUpdate, SendMessage), disallowed tools (Write, Edit, Task, TeamCreate, TeamDelete). The critic is distinct from leviathan: leviathan reviews PLANS before execution, critic reviews IMPLEMENTATION after execution. The critic's job: (1) Read files that workers created/modified, (2) Run tests and build, (3) Check for common issues (error handling, edge cases, security, test coverage), (4) Report issues as a structured verdict: APPROVE/REVISE with specific file:line references. The orchestrator and work SKILL.md are updated to optionally spawn a critic for final review before Step 7 (Wisdom extraction). The critic is spawned when the plan has >5 tasks or touches >5 files.
  - **Dependencies**: Task 16 (work SKILL.md contention), Task 17 (orchestrator.md contention)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/agents/critic.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/orchestrator.md` (add to teammate table)
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md` (add optional critic step)
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/scripts/subagent-context.sh` (add critic to known agents)
    - Modify: `/Users/reinamaccredy/Code/maestro/CLAUDE.md` (add to Agents table)
  - **Steps**:
    1. Create critic agent definition
    2. Update orchestrator teammate table
    3. Add optional critic review step to work SKILL.md between Step 6 and Step 7
    4. Add critic to subagent-context.sh case statement
    5. Add critic to CLAUDE.md Agents table
    6. Commit

- [ ] Task 19: Add automated skill learning to wisdom extraction
  - **Agent**: spark
  - **Acceptance criteria**: The work SKILL.md Step 7 (Extract Wisdom) is enhanced to include automated pattern capture. After all tasks complete, the orchestrator should: (1) Scan the git diff for common patterns (new test patterns, new error handling patterns, new API usage patterns), (2) If the plan involved a technology/library not previously seen in wisdom files, add a "Technology Notes" section, (3) Record which agent types were most effective for which task types (e.g., "build-fixer resolved 3/3 lint tasks in <1 min each"). This builds on the existing wisdom extraction -- just makes it more structured.
  - **Dependencies**: Task 18 (work SKILL.md contention)
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Enhance Step 7 wisdom template with automated patterns section
    2. Commit

- [ ] Task 20: Phase 2 verification
  - **Agent**: spark
  - **Acceptance criteria**: All Phase 2 scripts pass `bash -n`. hooks.json validates. New agent definitions have valid frontmatter. All SKILL.md modifications maintain required sections. Specific validations: (1) Each new `.sh` script: `bash -n` exits 0. (2) hooks.json: `jq .` exits 0, now contains `"UserPromptSubmit"` entries for keyword-detector and skill-injector, `"Task"` matcher has remember-extractor alongside verification-injector. (3) Agent frontmatter: critic.md has `---` delimiters, contains `name: critic`, `model: opus`, `tools:` includes Read/Grep/Glob/Bash, `disallowedTools:` includes Write/Edit. (4) work SKILL.md: still contains all three required sections (`## Objective` or intro, `## Tasks` equivalent, verification references). Contains new sections for Completion Gate, file ownership, heartbeat. (5) CLAUDE.md: Agents table contains `critic` row.
  - **Dependencies**: Tasks 11-19
  - **Files**: (verification only)
  - **Steps**:
    1. Run `for f in /Users/reinamaccredy/Code/maestro/.claude/scripts/*.sh; do bash -n "$f" && echo "OK: $f" || echo "FAIL: $f"; done`
    2. Run `jq . /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
    3. Run `head -10 /Users/reinamaccredy/Code/maestro/.claude/agents/critic.md` -- verify frontmatter
    4. Run `grep -c 'UserPromptSubmit' /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json` -- expect >= 1
    5. Run `grep 'critic' /Users/reinamaccredy/Code/maestro/CLAUDE.md` -- expect match
    6. Commit fixes if needed
    7. Final commit with message: `feat(omc): Phase 2 -- session intelligence and coordination`

### Phase 3: Advanced Coordination (5 features)

- [ ] Task 21: Add background agent manager guidance
  - **Agent**: spark
  - **Acceptance criteria**: Create `.claude/lib/background-agent-guide.md` documenting how to manage 5+ concurrent background tasks. Contents: (1) Spawn pattern: use `Task(run_in_background=true)` for independent work, (2) Polling pattern: check `TaskList()` every 30 seconds for updates, (3) Wave spawning: spawn in batches of 3-5, wait for completions, spawn replacements, (4) Failure handling: if a background agent fails, log the error and spawn a replacement, (5) Maximum concurrent agents: respect Claude Code's background task limit (currently 5). Update the orchestrator agent definition and work SKILL.md to reference this guide when spawning >3 workers.
  - **Dependencies**: Task 18 (orchestrator.md contention -- last Phase 2 task modifying it)
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/lib/background-agent-guide.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/orchestrator.md`
  - **Steps**:
    1. Create the background agent guide
    2. Add reference in orchestrator.md
    3. Commit

- [ ] Task 22: Create pipeline mode skill
  - **Agent**: kraken
  - **Acceptance criteria**: A new skill at `.claude/skills/pipeline/SKILL.md` that enables sequential agent chains with context passing. The skill: (1) Accepts a pipeline definition as argument: `agent1 -> agent2 -> agent3 "task description"`, (2) Supports model specification per stage: `explore:haiku -> architect:opus -> kraken:sonnet`, (3) Built-in presets: `review` (explore → leviathan → kraken), `implement` (explore → kraken), `debug` (explore → build-fixer), (4) Maintains pipeline state in `.maestro/handoff/pipeline-{id}.json` with per-stage output, (5) Each stage receives context from all previous stages in a structured `## Previous Stages` section, (6) The skill creates a team, runs stages sequentially, passes context, and cleans up. Include the SKILL.md frontmatter with `name: pipeline`, `description: Sequential agent chains with context passing`, `argument-hint: "<preset> | agent1 -> agent2 'task'"`.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/skills/pipeline/SKILL.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/CLAUDE.md` (add /pipeline to Commands)
  - **Steps**:
    1. Create the pipeline skill SKILL.md with full workflow
    2. Add /pipeline to CLAUDE.md Commands section
    3. Commit

- [ ] Task 23: Add consensus planning mode to /design
  - **Agent**: kraken
  - **Acceptance criteria**: The design SKILL.md is enhanced with an optional `--consensus` flag. When active: (1) After prometheus generates the plan, spawn leviathan for structural review, (2) Then spawn a critic for strategic review, (3) If either returns REVISE, prometheus incorporates feedback and regenerates, (4) Loop up to 3 times until both approve, (5) If no consensus after 3 rounds, present the best version with unresolved issues noted. This is an extension of the existing full mode (which already spawns leviathan) -- consensus adds the critic loop.
  - **Dependencies**: Task 18 (critic agent)
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md`
  - **Steps**:
    1. Read current design SKILL.md
    2. Add `--consensus` flag documentation to Arguments
    3. Add consensus loop after plan generation (between leviathan review and user approval)
    4. Commit

- [ ] Task 24: Create rate limit auto-resume guidance
  - **Agent**: spark
  - **Acceptance criteria**: Create `.claude/lib/rate-limit-handling.md` documenting strategies for handling API rate limits during long-running `/work` sessions. Contents: (1) Detection: watch for `429` errors or `rate_limit_exceeded` in Bash output, (2) Backoff strategy: wait 60 seconds on first hit, double on each subsequent (max 5 minutes), (3) Worker guidance: when rate-limited, workers should pause, log the event, and retry after backoff, (4) Orchestrator guidance: if multiple workers hit rate limits simultaneously, pause all spawning for 2 minutes. This is a guidance document referenced by the orchestrator, not an automated system.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/lib/rate-limit-handling.md`
  - **Steps**:
    1. Create the rate limit handling guide
    2. Commit

- [ ] Task 25: Add worker heartbeat protocol to work skill
  - **Agent**: kraken
  - **Acceptance criteria**: The work SKILL.md Step 6 (Monitor & Verify) is enhanced with a heartbeat protocol. The orchestrator should: (1) Expect workers to update their task description with a timestamp every 5 minutes (via `TaskUpdate(taskId, description: "...\\nHeartbeat: {ISO timestamp}")`), (2) If a task has been in_progress for >10 minutes with no heartbeat update, the orchestrator considers the worker stalled, (3) Stalled worker handling: send a status check message, wait 2 minutes, then reassign the task if no response. Add heartbeat instructions to kraken.md and spark.md: "While working on long tasks (>5 minutes), update your task description with a heartbeat timestamp every 5 minutes."
  - **Dependencies**: Task 21 (work SKILL.md contention via orchestrator.md), Task 14 (kraken.md + spark.md contention)
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/kraken.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/agents/spark.md`
  - **Steps**:
    1. Add heartbeat protocol to work SKILL.md Step 6
    2. Add heartbeat instructions to kraken.md and spark.md
    3. Commit

- [ ] Task 26: Phase 3 verification
  - **Agent**: spark
  - **Acceptance criteria**: All Phase 3 additions are syntactically valid. New skill has proper frontmatter. Library files are well-structured markdown. All cross-references in CLAUDE.md are accurate. Specific validations: (1) Pipeline SKILL.md: has `---` frontmatter with `name: pipeline`, `description:`, `argument-hint:`. Contains workflow steps. (2) Library files: each `.md` in `.claude/lib/` has a top-level `#` heading and structured content. (3) CLAUDE.md: Commands section lists `/pipeline`. (4) design SKILL.md: contains `--consensus` flag documentation. (5) work SKILL.md: contains heartbeat protocol section. (6) kraken.md and spark.md: contain heartbeat instructions.
  - **Dependencies**: Tasks 21-25
  - **Files**: (verification only)
  - **Steps**:
    1. Run `head -5 /Users/reinamaccredy/Code/maestro/.claude/skills/pipeline/SKILL.md` -- verify frontmatter
    2. Run `for f in /Users/reinamaccredy/Code/maestro/.claude/lib/*.md; do head -1 "$f"; done` -- verify each has heading
    3. Run `grep 'pipeline' /Users/reinamaccredy/Code/maestro/CLAUDE.md` -- expect match in Commands
    4. Run `grep 'consensus' /Users/reinamaccredy/Code/maestro/.claude/skills/design/SKILL.md` -- expect match
    5. Run `grep -i 'heartbeat' /Users/reinamaccredy/Code/maestro/.claude/agents/kraken.md` -- expect match
    6. Commit fixes
    7. Final commit with message: `feat(omc): Phase 3 -- advanced coordination`

### Phase 4: Architecture Extensions (2 features, design-only)

- [ ] Task 27: Design SQLite task coordination
  - **Agent**: spark
  - **Acceptance criteria**: Create `.maestro/plans/sqlite-task-coordination.md` as a DESIGN DOCUMENT (not implementation). The document describes: (1) How Maestro would use SQLite for atomic task claiming instead of TaskList/TaskUpdate, (2) Schema: tasks table (id, description, status, claimed_by, claimed_at, completed_at, result, error), heartbeats table, session table, (3) API: claimTask(), completeTask(), failTask(), heartbeat(), cleanupStaleClaims(), (4) Integration points: how the orchestrator and workers would use the SQLite API, (5) Migration path from current Agent Teams task system, (6) Pros/cons vs current approach. This is a future-looking design document, NOT an implementation task.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.maestro/plans/sqlite-task-coordination.md`
  - **Steps**:
    1. Write the design document based on OMC's swarm implementation at `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/commands/swarm.md`
    2. Commit

- [ ] Task 28: Design layered skill composition
  - **Agent**: spark
  - **Acceptance criteria**: Create `.maestro/plans/layered-skill-composition.md` as a DESIGN DOCUMENT. The document describes: (1) Three-layer skill model: Guarantee Layer (always injected -- verification, error handling), Enhancement Layer (conditionally injected based on context -- ecomode, deep thinking), Execution Layer (user-activated via /commands), (2) How layers compose: guarantee wraps enhancement wraps execution, (3) Conflict resolution: when two layers contradict (e.g., ecomode says haiku, guarantee says opus for security), guarantee wins, (4) Implementation approach: enhance the existing skill-registry.md and skill-matcher.md with layer awareness.
  - **Dependencies**: none
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.maestro/plans/layered-skill-composition.md`
  - **Steps**:
    1. Write the design document
    2. Commit

## Verification

- [ ] `bash -n .claude/scripts/*.sh` -- All scripts pass syntax check
- [ ] `jq . .claude/hooks/hooks.json` -- Hooks file is valid JSON
- [ ] `ls .claude/agents/` -- Contains: build-fixer.md, critic.md (plus existing agents)
- [ ] `ls .claude/lib/` -- Contains: verification-checklist.md, complexity-scoring.md, remember-tags.md, background-agent-guide.md, rate-limit-handling.md
- [ ] `ls .claude/skills/pipeline/` -- Contains SKILL.md
- [ ] `grep -c 'build-fixer\|critic' .claude/agents/orchestrator.md` -- Both new agents referenced
- [ ] `grep -c 'Stop' .claude/hooks/hooks.json` -- Stop hook registered
- [ ] `grep -c 'UserPromptSubmit' .claude/hooks/hooks.json` -- UserPromptSubmit hook registered
- [ ] `grep 'eco' .claude/skills/work/SKILL.md` -- Ecomode flag documented

## Notes

### Design Decisions

1. **Shell scripts over TypeScript**: OMC uses TypeScript for many features (model routing, verification, etc.). Maestro intentionally stays with shell scripts and markdown to avoid build systems and runtime dependencies. The complexity scoring is a markdown reference doc that the orchestrator reads and applies, not executable code.

2. **Guidance over enforcement**: Several features (file ownership, model selection, heartbeats) are implemented as orchestrator guidance rather than hard enforcement via hooks. This matches Maestro's philosophy of trusting the AI to follow instructions rather than building elaborate enforcement systems.

3. **Phases are independent**: Each phase can ship and provide value without the others. Phase 1 immediately improves worker reliability. Phase 2 adds intelligence. Phase 3 adds coordination. Phase 4 is design-only for future consideration.

4. **No new build dependencies**: Everything uses bash, jq (already required), and node (already available in Claude Code). No npm install, no TypeScript compilation, no SQLite binaries.

5. **Critic vs Leviathan**: Leviathan reviews plans BEFORE execution (structural + strategic). Critic reviews implementation AFTER execution (code quality + correctness). They serve different phases of the workflow.

### Parallelization Guide

Each phase has file contention constraints that dictate which tasks must run sequentially. Tasks not in a dependency chain can run in parallel.

**Phase 1 (Tasks 1-9):**
- Sequential chain A (hooks.json): Task 1 → Task 2 → Task 3
- Sequential chain B (work SKILL.md + orchestrator.md): Task 6 → Task 7 → Task 8 → Task 9
- Independent: Task 4 (session-start.sh only), Task 5 (verification-injector.sh only)
- Verification: Task 10 (waits for all)
- **Max parallelism**: Chains A and B can run concurrently with Tasks 4 and 5. Up to 4 workers active simultaneously.

**Phase 2 (Tasks 11-19):**
- Sequential chain A (hooks.json): Task 11 → Task 13 → Task 14
- Sequential chain B (work SKILL.md): Task 15 → Task 16 → Task 18 → Task 19
- Sequential chain C (orchestrator.md): Task 17 → Task 18
- Independent: Task 12 (session-start.sh only)
- Verification: Task 20 (waits for all)
- **Max parallelism**: Chains A and B can run concurrently with Tasks 12 and 17 (until Task 17 feeds into chain B at Task 18). Up to 3-4 workers active simultaneously.

**Phase 3 (Tasks 21-25):**
- Sequential chain A (work SKILL.md + orchestrator.md): Task 21 → Task 25
- Independent: Task 22 (new pipeline skill), Task 23 (design SKILL.md), Task 24 (new lib file)
- Verification: Task 26 (waits for all)
- **Max parallelism**: Tasks 22, 23, 24 can all run in parallel with chain A. Up to 4 workers active simultaneously.

**Phase 4 (Tasks 27-28):**
- Fully independent: Task 27 and Task 28 create new files with no overlap. Run in parallel.

### Cross-Phase Dependencies

Phase 2 depends on Phase 1 completion for several reasons:
- Task 15 depends on Task 6 (work SKILL.md contention chain: 6→7→8→9 must complete before 15→16→18→19 begins)
- Task 17 depends on Task 9 (orchestrator.md contention: Task 9 is last Phase 1 modifier)
- Task 14 depends on Task 13 which depends on Task 11 (hooks.json chain starts fresh in Phase 2, no Phase 1 dependency on this file)

Phase 3 depends on Phase 2:
- Task 21 depends on Task 18 (orchestrator.md contention)
- Task 25 depends on Task 21 (work SKILL.md contention) and Task 14 (kraken.md/spark.md contention)
- Task 23 depends on Task 18 (critic agent must exist)

Phase 4 has no dependencies on prior phases (creates new standalone design documents).

### OMC Reference Files

Key OMC files consulted during design:
- Model routing: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/src/features/model-routing/` (scorer.ts, router.ts, signals.ts, types.ts)
- Verification: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/src/features/verification/` (index.ts, types.ts)
- Ralph persistence: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/commands/ralph.md`
- Ecomode: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/commands/ecomode.md`
- Swarm/SQLite: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/commands/swarm.md`
- Pipeline: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/commands/pipeline.md`
- Magic keywords: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/src/features/magic-keywords.ts`
- Notepad wisdom: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/src/features/notepad-wisdom/index.ts`
- Delegation enforcer: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/src/features/delegation-enforcer.ts`
- Hooks: `/Users/reinamaccredy/Code/maestro/tmp/oh-my-claudecode/hooks/hooks.json`

## Prior Wisdom

Wisdom topics from past cycles: Hooks Improvement, Improve Design Workflow, Planless Work Mode, Skill Interop, Review Improvement, Plan Cleanup, Work Plan Autoload, Prometheus Skills, Git Worktree Multiplan, Review No Plan, Context7 Integration, Session Plan Injection, Plan Visual Summary, Review Autofix, Code Styleguides, Conductor Integration
