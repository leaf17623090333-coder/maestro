# Session Plan Injection

**Goal**: Inject the active plan name into Claude's context after `/compact` or `/clear` so the user can manually resume work without losing track of which plan was in progress.
**Architecture**: A new `PreCompact` hook injects active plan context into the compaction summary (surviving `/compact`). The existing `SessionStart` hook is enhanced to highlight actively executing/designing plans (covering `/clear` and fresh sessions). The handoff lifecycle gains a new `"executing"` status written by `/work` to distinguish in-progress plans from completed ones.
**Tech Stack**: Bash, jq, Claude Code hooks (PreCompact, SessionStart)

## Objective
After `/compact` or `/clear`, Claude's context includes the name and status of the active plan so the user can say "continue" or run `/work --resume` to pick up where they left off.

## Scope
**In**:
- New `PreCompact` hook script that injects active plan context into compact summaries
- Enhanced `session-start.sh` to highlight active plans from handoff files
- New `"executing"` handoff status in `/work` SKILL.md lifecycle
- Registration of PreCompact hook in `hooks.json`
- Tests for the new hook script and enhanced session-start behavior
- Documentation updates to CLAUDE.md hooks table

**Out**:
- Auto-resume behavior (user manually decides when to resume)
- Auto-suggest next action after context recovery
- Changes to `/design` workflow (it already writes `status: "designing"`)
- Changes to `/compact` or `/clear` themselves (these are Claude Code built-ins)

## Tasks

- [ ] Task 1: Add "executing" status to /work SKILL.md handoff lifecycle
  - **Agent**: spark
  - **Acceptance criteria**: `/work` SKILL.md Step 2 (Create Your Team) area includes writing a handoff file with `status: "executing"` after team creation, and Step 8.5 (Archive Plan) transitions it away. The handoff JSON schema now includes `"executing"` as a valid status.
  - **Dependencies**: none
  - **Files**: Modify `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
    2. Add a new Step 1.8 (Write Execution Handoff) between Step 1.7 (Worktree) and Step 2 (Create Team) that writes/updates `.maestro/handoff/{plan-slug}.json` with:
       ```json
       {
         "topic": "{plan-slug}",
         "status": "executing",
         "started": "{ISO timestamp}",
         "plan_destination": ".maestro/plans/{plan-slug}.md"
       }
       ```
       If a handoff file already exists for this plan (e.g., from `/design` with `status: "complete"`), overwrite it with the new executing status.
    3. In Step 8.5 (Archive Plan), add instruction to update the handoff file status to `"archived"`:
       ```json
       {
         "topic": "{plan-slug}",
         "status": "archived",
         "started": "{original timestamp}",
         "completed": "{ISO timestamp}",
         "plan_destination": ".maestro/archive/{plan-slug}.md"
       }
       ```
    4. Verify the SKILL.md is valid markdown by reading it back
    5. Commit

- [ ] Task 2: Create plan-context-injector.sh for PreCompact hook
  - **Agent**: kraken
  - **Acceptance criteria**: New script at `.claude/scripts/plan-context-injector.sh` that reads handoff files, finds any with `status: "executing"` or `status: "designing"`, and outputs the active plan context as plain text (stdout) that gets appended to the compact system prompt. Exits silently (no output) when no active plan exists. Script is executable.
  - **Dependencies**: none
  - **Files**: Create `/Users/reinamaccredy/Code/maestro/.claude/scripts/plan-context-injector.sh`
  - **Steps**:
    1. Write the following script to `/Users/reinamaccredy/Code/maestro/.claude/scripts/plan-context-injector.sh`:
       ```bash
       #!/bin/bash
       # plan-context-injector.sh
       # PreCompact hook - injects active plan context into compaction summary
       # so the active plan name survives /compact and auto-compact.
       #
       # PreCompact hooks: stdout is appended to the system prompt for the compact call.
       # Exit 0 with empty stdout = proceed normally.
       # Exit 0 with stdout = append content to compact system prompt.
       #
       # Also receives CONVERSATION_CONTEXT env var with the full conversation text.

       set -euo pipefail

       PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
       HANDOFF_DIR="$PROJECT_DIR/.maestro/handoff"

       # Exit silently if no handoff directory
       [[ -d "$HANDOFF_DIR" ]] || exit 0

       active_plans=""

       for handoff in "$HANDOFF_DIR"/*.json; do
         [[ -f "$handoff" ]] || continue
         status=$(jq -r '.status // empty' "$handoff" 2>/dev/null) || continue
         topic=$(jq -r '.topic // empty' "$handoff" 2>/dev/null) || continue
         plan_dest=$(jq -r '.plan_destination // empty' "$handoff" 2>/dev/null) || continue

         case "$status" in
           executing)
             if [[ -n "$active_plans" ]]; then
               active_plans="$active_plans\n- EXECUTING plan: $topic (file: $plan_dest)"
             else
               active_plans="- EXECUTING plan: $topic (file: $plan_dest)"
             fi
             ;;
           designing)
             if [[ -n "$active_plans" ]]; then
               active_plans="$active_plans\n- DESIGNING plan: $topic (file: $plan_dest)"
             else
               active_plans="- DESIGNING plan: $topic (file: $plan_dest)"
             fi
             ;;
         esac
       done

       # Exit silently if no active plans
       [[ -z "$active_plans" ]] && exit 0

       # Output context for the compact system prompt
       printf 'IMPORTANT — Active Maestro plan context (preserve in summary):\n%b\nThe user may want to resume this plan after compaction. Retain the plan name and status in the summary.' "$active_plans"
       ```
    2. Make the script executable: `chmod +x /Users/reinamaccredy/Code/maestro/.claude/scripts/plan-context-injector.sh`
    3. Run the test added in Task 4 to verify
    4. Commit

- [ ] Task 3: Enhance session-start.sh to highlight active plans from handoff files
  - **Agent**: spark
  - **Acceptance criteria**: `session-start.sh` reads `.maestro/handoff/*.json` files and, for any with `status: "executing"` or `status: "designing"`, prepends a prominent line like `ACTIVE PLAN: {topic} (status: executing)` before the existing context. Existing behavior (listing plans, skills, wisdom) is preserved. Exits silently if no active plans and no other content.
  - **Dependencies**: none
  - **Files**: Modify `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/scripts/session-start.sh`
    2. After `context_parts=()` (line 10) and before section `# 1. Available Maestro commands` (line 13), add a new section that scans handoff files:
       ```bash
       # 0. Active plan detection from handoff files
       handoff_dir="$PROJECT_DIR/.maestro/handoff"
       if [[ -d "$handoff_dir" ]]; then
         for handoff in "$handoff_dir"/*.json; do
           [[ -f "$handoff" ]] || continue
           status=$(jq -r '.status // empty' "$handoff" 2>/dev/null) || continue
           topic=$(jq -r '.topic // empty' "$handoff" 2>/dev/null) || continue
           case "$status" in
             executing)
               context_parts+=("ACTIVE PLAN: $topic (status: executing) — Run /work --resume to continue")
               ;;
             designing)
               context_parts+=("ACTIVE PLAN: $topic (status: designing) — Run /design to continue")
               ;;
           esac
         done
       fi
       ```
    3. Verify the script still produces valid JSON output by running it with `CLAUDE_PROJECT_DIR` pointing to a temp directory with test fixtures
    4. Commit

- [ ] Task 4: Register PreCompact hook in hooks.json
  - **Agent**: spark
  - **Acceptance criteria**: `hooks.json` has a new `PreCompact` entry that runs `plan-context-injector.sh`. The entry follows the existing pattern with `"$CLAUDE_PROJECT_DIR"` prefix. Existing hooks are unchanged.
  - **Dependencies**: Task 2
  - **Files**: Modify `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json`
    2. Add a new `PreCompact` entry after the existing `PostToolUse` section:
       ```json
       "PreCompact": [
         {
           "matcher": "*",
           "hooks": [
             { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/scripts/plan-context-injector.sh" }
           ]
         }
       ]
       ```
    3. Validate the JSON is well-formed: `cat .claude/hooks/hooks.json | jq .`
    4. Commit

- [ ] Task 5: Add tests for new hook behavior
  - **Agent**: kraken
  - **Acceptance criteria**: `scripts/test-hooks.sh` has 3 new tests (updating TOTAL from 12 to 15):
    - Test 13: `plan-context-injector.sh` outputs active plan context when an "executing" handoff exists
    - Test 14: `plan-context-injector.sh` exits silently when no active handoff exists
    - Test 15: `session-start.sh` includes ACTIVE PLAN line when "executing" handoff exists
    All 15 tests pass.
  - **Dependencies**: Task 2, Task 3
  - **Files**: Modify `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
    2. Update `TOTAL=12` to `TOTAL=15`
    3. Add the following tests before the Summary section:
       ```bash
       # -------------------------------------------------------
       # Test 13: plan-context-injector.sh outputs context for executing plan
       # -------------------------------------------------------
       bold "Test 13: plan-context-injector.sh outputs context for executing plan"
       setup_project
       mkdir -p "$TMPDIR/.maestro/handoff"
       cat > "$TMPDIR/.maestro/handoff/my-feature.json" <<'HANDOFF'
       {
         "topic": "my-feature",
         "status": "executing",
         "started": "2026-01-01T00:00:00Z",
         "plan_destination": ".maestro/plans/my-feature.md"
       }
       HANDOFF

       output=$(CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPTS_DIR/plan-context-injector.sh" < /dev/null 2>&1) || true
       if [[ "$output" == *"EXECUTING plan: my-feature"* ]]; then
         pass "plan-context-injector.sh outputs context for executing plan"
       else
         fail "plan-context-injector.sh executing" "Expected EXECUTING plan reference, got: $output"
       fi

       # -------------------------------------------------------
       # Test 14: plan-context-injector.sh exits silently when no active handoff
       # -------------------------------------------------------
       bold "Test 14: plan-context-injector.sh exits silently with no active handoff"
       setup_project
       mkdir -p "$TMPDIR/.maestro/handoff"
       cat > "$TMPDIR/.maestro/handoff/old.json" <<'HANDOFF'
       {
         "topic": "old",
         "status": "complete",
         "started": "2026-01-01T00:00:00Z",
         "completed": "2026-01-01T01:00:00Z",
         "plan_destination": ".maestro/plans/old.md"
       }
       HANDOFF

       output=$(CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPTS_DIR/plan-context-injector.sh" < /dev/null 2>&1) || true
       if [[ -z "$output" ]]; then
         pass "plan-context-injector.sh exits silently with no active handoff"
       else
         fail "plan-context-injector.sh silent" "Expected no output, got: $output"
       fi

       # -------------------------------------------------------
       # Test 15: session-start.sh includes ACTIVE PLAN for executing handoff
       # -------------------------------------------------------
       bold "Test 15: session-start.sh includes ACTIVE PLAN for executing handoff"
       setup_project
       mkdir -p "$TMPDIR/.maestro/handoff"
       cat > "$TMPDIR/.maestro/handoff/my-feature.json" <<'HANDOFF'
       {
         "topic": "my-feature",
         "status": "executing",
         "started": "2026-01-01T00:00:00Z",
         "plan_destination": ".maestro/plans/my-feature.md"
       }
       HANDOFF

       output=$(CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPTS_DIR/session-start.sh" < /dev/null 2>&1) || true
       if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' > /dev/null 2>&1; then
         context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')
         if [[ "$context" == *"ACTIVE PLAN: my-feature"* ]]; then
           pass "session-start.sh includes ACTIVE PLAN for executing handoff"
         else
           fail "session-start.sh active plan" "Missing ACTIVE PLAN in: $context"
         fi
       else
         fail "session-start.sh active plan JSON" "Output: $output"
       fi
       ```
    4. Run all tests: `bash /Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh`
    5. Verify all 15 tests pass
    6. Commit

- [ ] Task 6: Update CLAUDE.md hooks documentation table
  - **Agent**: spark
  - **Acceptance criteria**: The hooks table in `CLAUDE.md` includes a new row for `plan-context-injector.sh` with trigger `PreCompact` and description of what it enforces. The table is properly formatted.
  - **Dependencies**: Task 2, Task 4
  - **Files**: Modify `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
    2. In the Hooks table, add a new row after the `wisdom-injector.sh` row:
       ```
       | `plan-context-injector.sh` | PreCompact | Injects active plan name into compact summary so it survives /compact |
       ```
    3. Verify the markdown table is properly formatted
    4. Commit

## Verification
- [ ] `bash /Users/reinamaccredy/Code/maestro/scripts/test-hooks.sh` — all 15 tests pass (was 12, now 15)
- [ ] `cat /Users/reinamaccredy/Code/maestro/.claude/hooks/hooks.json | jq .` — valid JSON with PreCompact entry
- [ ] `CLAUDE_PROJECT_DIR=/Users/reinamaccredy/Code/maestro bash /Users/reinamaccredy/Code/maestro/.claude/scripts/plan-context-injector.sh` — exits silently (no active executing handoff in current state)
- [ ] Manual: Create a test handoff with `status: "executing"`, run `plan-context-injector.sh`, verify it outputs "EXECUTING plan: {name}"
- [ ] Manual: Create a test handoff with `status: "executing"`, run `session-start.sh`, verify output includes "ACTIVE PLAN: {name}"

## Notes

### Technical Decisions

1. **PreCompact hook output format**: The `PreCompact` hook uses plain text stdout (not JSON). Per the official docs, PreCompact stdout is appended to the system prompt for the compact call. This is different from PostToolUse/SessionStart which use `hookSpecificOutput.additionalContext` JSON. The script outputs instructional text telling the compaction model to preserve the plan name in its summary.

2. **Both "executing" and "designing" are surfaced**: Since the handoff lifecycle already has `status: "designing"` from `/design`, both hooks surface it alongside the new `"executing"` status. This covers context loss during both design and execution phases.

3. **No new handoff fields**: The handoff JSON schema stays minimal — only the `status` field value changes. No new fields are added, maintaining backward compatibility.

4. **Graceful degradation**: If no handoff directory exists or no active handoffs are found, both scripts exit silently. No errors, no empty context injection.

5. **PreCompact matcher**: Uses `"*"` matcher since PreCompact fires globally (not per-tool). The script itself handles the logic of whether to inject content.

### PreCompact Hook Behavior (from official docs)
- Exit 0 with empty stdout: Proceed with compaction normally
- Exit 0 with stdout: Append stdout content to the system prompt for the compact call
- Non-zero exit: Error shown to user, compaction is skipped
- Receives `CONVERSATION_CONTEXT` env var with the full conversation text (we don't use this)

### /clear Limitation
There is no "PreClear" or "PostClear" hook event. `/clear` does a full conversation wipe. The only recovery mechanism is the `SessionStart` hook, which fires when a new session begins. Since `/clear` effectively starts a fresh conversation within the same session, the `SessionStart` hook should fire. The enhanced `session-start.sh` will surface active plans in this case.

If `SessionStart` does NOT fire after `/clear` (it may only fire on actual new sessions, not in-session clears), then the fallback is that the user sees the plan listed in the generic "Active plans" section, and the handoff file with `status: "executing"` persists on disk for `/work --resume` to find.

## Prior Wisdom
Key learnings from past hook work (from `.maestro/wisdom/hooks-improvement.md`):
- Hook scripts live in `.claude/scripts/`, non-hook utilities stay in `scripts/`
- All hook commands in `hooks.json` use `"$CLAUDE_PROJECT_DIR"/.claude/scripts/...` for portability
- PostToolUse/SessionStart/SubagentStart context injection uses `hookSpecificOutput.additionalContext`
- SessionStart hook must NOT be async — context must be injected before the agent starts
- `$CLAUDE_PROJECT_DIR` defaults to `.` when unset — always use `${CLAUDE_PROJECT_DIR:-.}` pattern
- Graceful degradation: all hooks exit 0 on error paths so sessions never fail
- `hooks.json` uses plugin format: `{"description": "...", "hooks": {...}}` wrapper
- `set -euo pipefail` in hooks must be used carefully with jq — use `|| true` after jq commands that might fail
