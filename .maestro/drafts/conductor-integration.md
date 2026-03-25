# Project Context Scaffolding — /setup Command

**Goal**: Add a `/setup` command that interviews the user to scaffold persistent project context documents (product definition, tech stack, guidelines), stored in `.maestro/context/`, and automatically surfaced to all Maestro agents via hook-based injection.

**Architecture**: A new `/setup` skill that guides the user through an interactive interview (brownfield/greenfield detection, product definition, tech stack, guidelines) producing markdown files in `.maestro/context/`. The existing `subagent-context.sh` hook is extended to detect and inject these files into every agent's context. The `session-start.sh` hook surfaces context availability at session start.

**Tech Stack**: Bash (hooks), Markdown (skill definitions, context files)

## Objective

Add a `/setup` command inspired by Conductor's project scaffolding that creates persistent project context documents, making all Maestro agents aware of the host project's purpose, tech stack, and guidelines.

## Scope

**In**:
- New `/setup` skill with interactive interview flow
- `.maestro/context/` directory with `product.md`, `tech-stack.md`, `guidelines.md`
- Hook extension: `subagent-context.sh` injects context file summaries into agent context
- Hook extension: `session-start.sh` surfaces context availability
- Documentation updates: CLAUDE.md, maestro SKILL.md, status SKILL.md

**Out**:
- `/revert` command (separate future work)
- Spec/plan separation (Maestro plans stay as-is)
- Conductor's `workflow.md` file (Maestro already handles this via agent definitions and skill files)
- Conductor's track registry (`tracks.md`) — Maestro uses `.maestro/plans/` instead
- Changes to `/design` or `/work` SKILL.md (hook injection is sufficient)

## Tasks

- [ ] Task 1: Create /setup skill file
  - **Agent**: spark
  - **Acceptance criteria**:
    - File exists at `.claude/skills/setup/SKILL.md`
    - YAML frontmatter has `name: setup`, `description`, `allowed-tools` including `AskUserQuestion`
    - Skill implements the full interview flow described in the Steps section below
  - **Dependencies**: none
  - **Files**:
    - Create: `.claude/skills/setup/SKILL.md`
  - **Steps**:
    1. Create the file with the complete skill content (provided below)
    2. Verify the file exists and frontmatter parses: `head -5 .claude/skills/setup/SKILL.md`
    3. Commit: `git add .claude/skills/setup/SKILL.md && git commit -m "feat(setup): add /setup skill for project context scaffolding"`

  **Full file content for `.claude/skills/setup/SKILL.md`**:

  ````markdown
  ---
  name: setup
  description: Scaffold persistent project context — product definition, tech stack, and guidelines. Interviews you about your project and generates context files that all Maestro agents reference.
  argument-hint: "[--reset]"
  allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
  disable-model-invocation: true
  ---

  # Setup — Project Context Scaffolding

  > Inspired by [Conductor](https://github.com/gemini-cli-extensions/conductor). Adapted for Maestro's architecture.

  Interview the user to create persistent project context documents that all Maestro agents reference for deeper project understanding.

  ## Arguments

  `$ARGUMENTS`

  - `--reset`: Delete all existing context files and start fresh.
  - Default (no args): Run setup interview. If context already exists, offer to update or skip.

  ## Step 1: Handle --reset

  If `$ARGUMENTS` contains `--reset`:

  1. Check if `.maestro/context/` exists
  2. If it does, confirm with the user:
     ```
     AskUserQuestion(
       questions: [{
         question: "This will delete all project context files in .maestro/context/. Are you sure?",
         header: "Reset Context",
         options: [
           { label: "Yes, reset", description: "Delete all context files and start fresh" },
           { label: "Cancel", description: "Keep existing context" }
         ],
         multiSelect: false
       }]
     )
     ```
  3. If confirmed: `rm -rf .maestro/context/` and report "Context reset. Run `/setup` to create new context."
  4. Stop.

  ## Step 2: Check Existing Context

  ```
  Glob(pattern: ".maestro/context/*.md")
  ```

  If context files already exist, ask the user:

  ```
  AskUserQuestion(
    questions: [{
      question: "Project context already exists. What would you like to do?",
      header: "Existing Context",
      options: [
        { label: "Update", description: "Re-run setup and overwrite existing files" },
        { label: "View", description: "Show current context files and exit" },
        { label: "Cancel", description: "Keep existing context unchanged" }
      ],
      multiSelect: false
    }]
  )
  ```

  **On View**: Read and display each file in `.maestro/context/`, then stop.
  **On Cancel**: Stop.
  **On Update**: Continue to Step 3.

  ## Step 3: Detect Project Maturity

  Classify the project as **Brownfield** (existing) or **Greenfield** (new).

  **Brownfield indicators** (check in order, stop at first match):
  1. `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.gradle`, `pom.xml` exists
  2. `src/`, `app/`, or `lib/` directory contains code files
  3. `.git` directory exists with commits (`git log --oneline -1` succeeds)

  **Greenfield**: None of the above indicators found.

  **For Brownfield projects**:
  1. Announce: "Detected an existing project. I'll analyze it before asking questions."
  2. Read key files to infer context:
     - `README.md` (if exists) — project purpose
     - `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` — dependencies and tech stack
     - `CLAUDE.md` (if exists) — existing conventions
  3. Store inferences for use in subsequent questions.

  **For Greenfield projects**:
  1. Announce: "New project detected. I'll help you define the project context from scratch."

  ## Step 4: Create Context Directory

  ```bash
  mkdir -p .maestro/context
  ```

  ## Step 5: Product Definition Interview

  Generate `product.md` — what the project is, who it's for, and what it does.

  **For Brownfield**: Pre-fill answers from Step 3 analysis. Ask the user to confirm or correct.

  Ask questions sequentially (one at a time). Limit to 3 questions max.

  **Question 1** — Project purpose:
  ```
  AskUserQuestion(
    questions: [{
      question: "What does this project do? (one sentence)",
      header: "Product Definition",
      options: [
        { label: "{inferred purpose if brownfield}", description: "Based on README/package.json analysis" },
        { label: "Other", description: "Type your own description" }
      ],
      multiSelect: false
    }]
  )
  ```

  For greenfield, omit the inferred option — just ask the open-ended question.

  **Question 2** — Target users:
  ```
  AskUserQuestion(
    questions: [{
      question: "Who are the primary users?",
      header: "Target Users",
      options: [
        { label: "Developers", description: "Library, CLI tool, or developer-facing API" },
        { label: "End users", description: "Web app, mobile app, or consumer-facing product" },
        { label: "Internal team", description: "Internal tool, admin dashboard, or ops tooling" },
        { label: "Other", description: "Type your own" }
      ],
      multiSelect: false
    }]
  )
  ```

  **Question 3** — Key features (optional — skip if brownfield with clear README):
  ```
  AskUserQuestion(
    questions: [{
      question: "What are the 2-3 most important features or capabilities?",
      header: "Key Features",
      options: [
        { label: "Auto-generate from analysis", description: "I'll infer from the codebase" },
        { label: "Other", description: "Type your own list" }
      ],
      multiSelect: false
    }]
  )
  ```

  **Draft and write `product.md`**:

  ```markdown
  # Product Definition

  ## Purpose
  {user's answer to Q1}

  ## Target Users
  {user's answer to Q2}

  ## Key Features
  {user's answer to Q3, or inferred list}
  ```

  Write to `.maestro/context/product.md`.

  ## Step 6: Tech Stack Interview

  Generate `tech-stack.md` — languages, frameworks, tools.

  **For Brownfield**: Infer the tech stack from config files (Step 3). Present for confirmation.

  ```
  AskUserQuestion(
    questions: [{
      question: "Is this your tech stack?\n\n{inferred stack summary}",
      header: "Tech Stack",
      options: [
        { label: "Yes, correct", description: "Use the detected tech stack" },
        { label: "Needs changes", description: "Let me correct or add to it" },
        { label: "Other", description: "Type the full tech stack manually" }
      ],
      multiSelect: false
    }]
  )
  ```

  **For Greenfield**: Ask directly:

  ```
  AskUserQuestion(
    questions: [{
      question: "What tech stack will this project use? (languages, frameworks, database, etc.)",
      header: "Tech Stack",
      options: [
        { label: "Other", description: "Type your tech stack" }
      ],
      multiSelect: false
    }]
  )
  ```

  **Draft and write `tech-stack.md`**:

  ```markdown
  # Tech Stack

  ## Languages
  - {language 1}
  - {language 2}

  ## Frameworks
  - {framework 1}
  - {framework 2}

  ## Tools & Infrastructure
  - Package manager: {manager}
  - Database: {db, if applicable}
  - CI/CD: {ci, if applicable}
  ```

  Write to `.maestro/context/tech-stack.md`.

  ## Step 7: Guidelines Interview

  Generate `guidelines.md` — coding conventions, design principles, non-functional requirements.

  ```
  AskUserQuestion(
    questions: [{
      question: "Any specific guidelines or principles for this project?",
      header: "Project Guidelines",
      options: [
        { label: "Auto-generate from analysis", description: "I'll infer from CLAUDE.md, linter configs, and conventions" },
        { label: "TDD-first", description: "Test-driven development, high coverage" },
        { label: "Move fast", description: "Ship quickly, iterate later" },
        { label: "Security-first", description: "Input validation, audit logging, secure defaults" },
        { label: "Other", description: "Type your own guidelines" }
      ],
      multiSelect: true
    }]
  )
  ```

  **Draft and write `guidelines.md`**:

  ```markdown
  # Project Guidelines

  ## Development Principles
  - {selected principles}

  ## Conventions
  - {inferred from CLAUDE.md or user input}

  ## Non-Functional Requirements
  - {performance, security, accessibility, etc.}
  ```

  Write to `.maestro/context/guidelines.md`.

  ## Step 8: Summary and Commit

  1. Display a summary of all generated files:

  ```
  ## Project Context Created

  **Files**:
  - `.maestro/context/product.md` — Product definition
  - `.maestro/context/tech-stack.md` — Technology stack
  - `.maestro/context/guidelines.md` — Project guidelines

  These files will be automatically injected into all Maestro agent contexts.

  To update: `/setup`
  To reset: `/setup --reset`
  To view: `/setup` → View
  ```

  2. Commit the context files:
  ```bash
  git add .maestro/context/
  git commit -m "chore(setup): scaffold project context files"
  ```
  ````

- [ ] Task 2: Extend subagent-context.sh to inject project context
  - **Agent**: spark
  - **Acceptance criteria**:
    - `subagent-context.sh` detects `.maestro/context/*.md` files
    - For each context file found, the first line (title) is extracted and included in the injected context string
    - Context injection appears as `Project context: product (Product Definition); tech-stack (Tech Stack); guidelines (Project Guidelines)` in the output
    - Existing plan and wisdom injection still works unchanged
  - **Dependencies**: none
  - **Files**:
    - Modify: `.claude/scripts/subagent-context.sh`
  - **Steps**:
    1. Read the current file
    2. Add a new section (section 3) after the wisdom injection (section 2) that scans `.maestro/context/*.md`
    3. For each `.md` file found, extract the filename (without extension) and the first non-empty line (title), then append to `context_parts`
    4. Verify the script is valid: `bash -n .claude/scripts/subagent-context.sh`
    5. Commit: `git add .claude/scripts/subagent-context.sh && git commit -m "feat(hooks): inject project context into subagent context"`

  **Exact diff to apply** — add this block after the closing `fi` of section `# 2. Wisdom file titles` (after line 91) and before the `# If no context was gathered` check:

  ```bash
  # 3. Project context file titles
  context_dir="$PROJECT_DIR/.maestro/context"
  if [[ -d "$context_dir" ]]; then
    pctx=""
    for cfile in "$context_dir"/*.md; do
      [[ -f "$cfile" ]] || continue
      basename_c="$(basename "$cfile")"
      c_name="${basename_c%.md}"
      title=""
      while IFS= read -r line; do
        line="${line#"${line%%[! ]*}"}"
        [[ -z "$line" ]] && continue
        title="${line#\# }"
        break
      done < "$cfile"
      if [[ -n "$pctx" ]]; then
        pctx="$pctx; $c_name ($title)"
      else
        pctx="$c_name ($title)"
      fi
    done
    if [[ -n "$pctx" ]]; then
      context_parts+=("Project context: $pctx")
    fi
  fi
  ```

- [ ] Task 3: Extend session-start.sh to surface context availability
  - **Agent**: spark
  - **Acceptance criteria**:
    - `session-start.sh` checks for `.maestro/context/` directory
    - If context files exist, adds a line like `Project context: 3 files (.maestro/context/)` to session context
    - If no context files exist, no output is added (graceful degradation)
    - Existing session start behavior unchanged
  - **Dependencies**: none
  - **Files**:
    - Modify: `.claude/scripts/session-start.sh`
  - **Steps**:
    1. Read the current file
    2. Add a new section (section 1.5) between the commands line (section 1) and skills scanning (section 2) that counts files in `.maestro/context/`
    3. Verify the script is valid: `bash -n .claude/scripts/session-start.sh`
    4. Commit: `git add .claude/scripts/session-start.sh && git commit -m "feat(hooks): surface project context in session start"`

  **Exact diff to apply** — add this block after `context_parts+=("Maestro commands: /design, /work, /status, /review, /reset, /plan-template")` (line 31) and before `# 2. Skills` (line 33):

  ```bash
  # 1.5 Project context availability
  context_dir="$PROJECT_DIR/.maestro/context"
  if [[ -d "$context_dir" ]]; then
    ctx_count=0
    for cfile in "$context_dir"/*.md; do
      [[ -f "$cfile" ]] || continue
      ctx_count=$((ctx_count + 1))
    done
    if [[ $ctx_count -gt 0 ]]; then
      context_parts+=("Project context: $ctx_count files (.maestro/context/) — run /setup to update")
    fi
  fi
  ```

- [ ] Task 4: Update session-start.sh commands line to include /setup
  - **Agent**: spark
  - **Acceptance criteria**:
    - The Maestro commands line in `session-start.sh` includes `/setup`
    - The line reads: `Maestro commands: /design, /work, /setup, /status, /review, /reset, /plan-template`
  - **Dependencies**: Task 3
  - **Files**:
    - Modify: `.claude/scripts/session-start.sh`
  - **Steps**:
    1. Edit the commands line to add `/setup` after `/work`
    2. Verify: `bash -n .claude/scripts/session-start.sh`
    3. Commit: `git add .claude/scripts/session-start.sh && git commit -m "docs(hooks): add /setup to session start commands list"`

  **Exact edit**:
  - Old: `context_parts+=("Maestro commands: /design, /work, /status, /review, /reset, /plan-template")`
  - New: `context_parts+=("Maestro commands: /design, /work, /setup, /status, /review, /reset, /plan-template")`

- [ ] Task 5: Update CLAUDE.md documentation
  - **Agent**: spark
  - **Acceptance criteria**:
    - `/setup` appears in the Commands section of `CLAUDE.md`
    - `.maestro/context/` appears in the Runtime State section
  - **Dependencies**: none
  - **Files**:
    - Modify: `CLAUDE.md`
  - **Steps**:
    1. Read `CLAUDE.md`
    2. Add `/setup` to the Commands section: `- /setup` — Scaffold project context (product, tech stack, guidelines)`
    3. Add `context/` to the Runtime State tree: `├── context/    # Project context files (product, tech stack, guidelines)`
    4. Commit: `git add CLAUDE.md && git commit -m "docs(setup): add /setup command and context directory to CLAUDE.md"`

  **Exact edits**:

  In the Commands section, after `- /styleguide` line, add:
  ```
  - `/setup` — Scaffold project context (product definition, tech stack, guidelines)
  ```

  In the Runtime State tree, after `├── drafts/     # Interview drafts (created during /design)`, add:
  ```
  ├── context/    # Project context files (product, tech stack, guidelines)
  ```

- [ ] Task 6: Update maestro SKILL.md documentation
  - **Agent**: spark
  - **Acceptance criteria**:
    - `/setup` appears in the Triggers table
    - `/setup` appears in the Quick Reference section
    - `.maestro/context/` appears in the State Directory section
  - **Dependencies**: none
  - **Files**:
    - Modify: `.claude/skills/maestro/SKILL.md`
  - **Steps**:
    1. Read `.claude/skills/maestro/SKILL.md`
    2. Add `/setup` row to Triggers table: `| /setup | Scaffold project context (product, tech stack, guidelines) |`
    3. Add `context/` to State Directory tree
    4. Add `/setup` to Quick Reference section
    5. Commit: `git add .claude/skills/maestro/SKILL.md && git commit -m "docs(setup): add /setup to maestro skill reference"`

  **Exact edits**:

  In the Triggers table, after the `/styleguide` row, add:
  ```
  | `/setup` | Scaffold project context (product, tech stack, guidelines) |
  ```

  In the State Directory tree, after `├── wisdom/    # Accumulated learnings`, add:
  ```
  ├── context/   # Project context (product, tech stack, guidelines)
  ```

  In the Quick Reference section, add:
  ```
  - **Setup**: `/setup`
  ```

- [ ] Task 7: Update status SKILL.md to include context files
  - **Agent**: spark
  - **Acceptance criteria**:
    - A new "Context" section exists in the status skill between "Plans" and "Drafts"
    - The section lists files in `.maestro/context/` with name and first line
    - If empty, reports "No project context. Run `/setup` to create."
    - The output summary table includes a Context row
  - **Dependencies**: none
  - **Files**:
    - Modify: `.claude/skills/status/SKILL.md`
  - **Steps**:
    1. Read `.claude/skills/status/SKILL.md`
    2. Add a new section `### 1.6. Context` after Archive (section 1.5) and before Drafts (section 2)
    3. Add a Context row to the summary table
    4. Commit: `git add .claude/skills/status/SKILL.md && git commit -m "feat(status): show project context files in /status output"`

  **Exact additions**:

  After `### 1.5. Archive` section and before `### 2. Drafts`, add:

  ```markdown
  ### 1.6. Context

  List all files in `.maestro/context/`:
  - File name
  - First line (title)
  - Last modified date

  If empty, report "No project context. Run `/setup` to create."
  ```

  In the summary table, add between Archive and Drafts:
  ```
  | Context | N | <name> |
  ```

  In the Next Steps table, add a new row:
  ```
  | No context files exist | "Run `/setup` to scaffold project context (product, tech stack, guidelines)." |
  ```

- [ ] Task 8: Verify all changes work together
  - **Agent**: spark
  - **Acceptance criteria**:
    - `bash -n .claude/scripts/subagent-context.sh` exits 0
    - `bash -n .claude/scripts/session-start.sh` exits 0
    - `head -5 .claude/skills/setup/SKILL.md` shows valid YAML frontmatter
    - `cat .claude-plugin/plugin.json | jq .` still parses
    - `./scripts/validate-links.sh` passes (if it exists and is executable)
    - `grep -q '/setup' CLAUDE.md` finds the command
    - `grep -q 'context/' CLAUDE.md` finds the directory
    - `grep -q '/setup' .claude/skills/maestro/SKILL.md` finds the trigger
  - **Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7
  - **Files**: (read-only verification)
  - **Steps**:
    1. Run all verification commands listed above
    2. Report results
    3. Commit any fixes if needed

## Verification

- [ ] `bash -n .claude/scripts/subagent-context.sh` — script syntax is valid
- [ ] `bash -n .claude/scripts/session-start.sh` — script syntax is valid
- [ ] `head -5 .claude/skills/setup/SKILL.md` — YAML frontmatter present
- [ ] `grep -q '/setup' CLAUDE.md && echo PASS` — /setup documented in CLAUDE.md
- [ ] `grep -q 'context/' CLAUDE.md && echo PASS` — context directory documented
- [ ] `grep -q '/setup' .claude/skills/maestro/SKILL.md && echo PASS` — /setup in maestro skill
- [ ] `grep -q 'context' .claude/skills/status/SKILL.md && echo PASS` — context in status skill
- [ ] `cat .claude-plugin/plugin.json | jq .` — plugin manifest still valid

## Notes

1. **Conductor adaptation, not port** — Conductor's `/setup` generates 5+ files with extensive multi-round interviews (up to 5 questions per section). Maestro's `/setup` is streamlined to 3 files with 1-3 questions per section, respecting the "YAGNI ruthlessly" principle. We omit Conductor's `workflow.md` (Maestro handles this via agent definitions) and `product-guidelines.md` is merged into `guidelines.md`.

2. **Hook-based injection over explicit loading** — Rather than modifying `/design` and `/work` skills, we extend the existing `subagent-context.sh` hook. This means ALL Maestro agents automatically get project context awareness with zero changes to skill files. The hook injects lightweight summaries (file name + title); agents can `Read()` the full files when they need deeper context.

3. **Brownfield detection** — The setup command auto-detects existing projects and pre-fills answers from config files (package.json, README.md, etc.), reducing user effort. This mirrors Conductor's brownfield/greenfield distinction.

4. **No state file** — Unlike Conductor's `setup_state.json` for resume support, Maestro's `/setup` is idempotent. Running it again lets you update or view existing context. This is simpler and aligns with Maestro's existing patterns.

5. **Context directory location** — `.maestro/context/` was chosen over alternatives like `.maestro/project/` or a top-level `conductor/` directory because it follows Maestro's existing `.maestro/` namespace convention and is descriptive of its purpose.

## Prior Wisdom

Prior learnings from past cycles:
- Code Styleguides — CLAUDE.md Injection: Styleguides already ported from Conductor
- Hooks Improvement: Hook scripts should be defensive (set -euo pipefail, check dirs exist)
- Session Plan Injection: Session hooks successfully inject context; follow same pattern
- Skill Interoperability: Skills auto-discovered and injected; context files follow similar pattern
