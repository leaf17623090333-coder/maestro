# Code Styleguides — CLAUDE.md Injection

**Goal**: Add language-specific code style guides to Maestro that auto-detect a project's languages and inject relevant style guidance into the project's `CLAUDE.md`, so every Claude Code session produces more consistent, idiomatic code.

**Architecture**: Style guide templates (cloned from conductor) live in Maestro's `.claude/lib/styleguides/`. A new `/styleguide` skill detects the target project's languages from config files and file extensions, then generates a consolidated code style section and injects it into the project's `CLAUDE.md` using HTML comment markers for idempotency. The `/work` orchestrator can also trigger this automatically at the start of execution.

**Tech Stack**: Markdown templates, shell-based language detection, HTML comment markers for idempotent injection

## Objective

Clone all 9 language style guide templates from the [conductor project](https://github.com/gemini-cli-extensions/conductor/tree/main/templates/code_styleguides) into Maestro, and create a `/styleguide` command that auto-detects project languages and injects matching style guidance into the project's `CLAUDE.md`.

## Scope

**In**:
- Create `.claude/lib/styleguides/` with all 9 language guide template files
- Create `.claude/skills/styleguide/SKILL.md` — a user-invocable skill (`/styleguide`) that detects languages and injects into CLAUDE.md
- Language detection algorithm (config files + file extensions)
- Idempotent injection using `<!-- maestro:code-styleguides:start -->` / `<!-- maestro:code-styleguides:end -->` markers
- Integration point in `/work` to auto-run styleguide injection at execution start
- Works on any project — creates CLAUDE.md if it doesn't exist, appends if it does

**Out**:
- Changes to agent definitions (kraken.md, spark.md, etc.)
- Changes to hooks
- Custom style guide editor/UI
- New dependencies or build steps
- Modifications to the skill injection pipeline (this goes directly into CLAUDE.md, not `## SKILL GUIDANCE`)

## Tasks

- [ ] Task 1: Create styleguide template files in `.claude/lib/styleguides/`
  - **Agent**: kraken
  - **Acceptance criteria**:
    - Directory `.claude/lib/styleguides/` exists
    - All 9 files exist: `general.md`, `javascript.md`, `typescript.md`, `python.md`, `go.md`, `cpp.md`, `csharp.md`, `dart.md`, `html-css.md`
    - Each file contains conductor content with attribution comment at top
    - Files are valid markdown
  - **Dependencies**: none
  - **Files**:
    - Create: `.claude/lib/styleguides/general.md`
    - Create: `.claude/lib/styleguides/javascript.md`
    - Create: `.claude/lib/styleguides/typescript.md`
    - Create: `.claude/lib/styleguides/python.md`
    - Create: `.claude/lib/styleguides/go.md`
    - Create: `.claude/lib/styleguides/cpp.md`
    - Create: `.claude/lib/styleguides/csharp.md`
    - Create: `.claude/lib/styleguides/dart.md`
    - Create: `.claude/lib/styleguides/html-css.md`
  - **Steps**:
    1. Create directory: `mkdir -p .claude/lib/styleguides`
    2. Fetch each file from `https://raw.githubusercontent.com/gemini-cli-extensions/conductor/main/templates/code_styleguides/{filename}` using WebFetch
    3. Write each file to `.claude/lib/styleguides/{filename}` with attribution comment at top: `<!-- Source: https://github.com/gemini-cli-extensions/conductor/tree/main/templates/code_styleguides -->`
    4. Verify all 9 files exist and are non-empty
    5. Commit: `feat(styleguides): add 9 language guide templates from conductor`

- [ ] Task 2: Create `/styleguide` skill with language detection and CLAUDE.md injection
  - **Agent**: kraken
  - **Acceptance criteria**:
    - `.claude/skills/styleguide/SKILL.md` exists with valid YAML frontmatter
    - Skill is user-invocable via `/styleguide`
    - Contains complete language detection algorithm (config files + file extensions)
    - Contains CLAUDE.md injection logic with idempotent markers
    - Handles: CLAUDE.md exists (append/replace), CLAUDE.md doesn't exist (create)
    - `general.md` is always included alongside language-specific guides
    - Running twice produces the same result (idempotent)
    - Supports `--remove` argument to strip the injected section
  - **Dependencies**: Task 1
  - **Files**:
    - Create: `/Users/reinamaccredy/Code/maestro/.claude/skills/styleguide/SKILL.md`
  - **Steps**:
    1. Create directory:
       ```bash
       mkdir -p /Users/reinamaccredy/Code/maestro/.claude/skills/styleguide
       ```
    2. Create `/Users/reinamaccredy/Code/maestro/.claude/skills/styleguide/SKILL.md` with the following content. This is the complete skill specification — write it verbatim:

       ````markdown
       ---
       name: styleguide
       description: Detect project languages and inject code style guides into CLAUDE.md. Provides consistent coding conventions for all Claude Code interactions.
       argument-hint: "[--remove]"
       allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
       disable-model-invocation: true
       ---

       # Styleguide — Code Style Guide Injection

       > Detect project languages, select matching style guides, and inject them into the host project's `CLAUDE.md`.

       ## Arguments

       `$ARGUMENTS`

       - `--remove`: Remove the injected code style section from `CLAUDE.md` and exit.
       - Default (no args): Detect languages and inject/update style guides.

       ## Step 1: Handle --remove

       If `$ARGUMENTS` contains `--remove`:

       1. Read the project's `CLAUDE.md`
       2. Find the markers `<!-- maestro:code-styleguides:start -->` and `<!-- maestro:code-styleguides:end -->`
       3. If found, remove everything between and including the markers (plus any surrounding blank lines)
       4. Write the updated file
       5. Report: "Removed code style guides from CLAUDE.md"
       6. Stop.

       If markers not found, report: "No code style guides found in CLAUDE.md" and stop.

       ## Step 2: Detect Project Languages

       Scan the project root for configuration files to determine which languages are used. Collect ALL matches — a project can use multiple languages.

       **Detection rules** (check all, collect matches):

       | Config File | Language | Guide File |
       |-------------|----------|------------|
       | `package.json` | JavaScript | `javascript.md` |
       | `tsconfig.json` OR `tsconfig*.json` | TypeScript | `typescript.md` |
       | `pyproject.toml` OR `setup.py` OR `requirements.txt` OR `Pipfile` | Python | `python.md` |
       | `go.mod` | Go | `go.md` |
       | `CMakeLists.txt` OR `*.cpp`/`*.cc`/`*.cxx` in `src/` | C++ | `cpp.md` |
       | `*.csproj` OR `*.sln` | C# | `csharp.md` |
       | `pubspec.yaml` | Dart | `dart.md` |
       | `*.html` in root or `src/` OR `*.css`/`*.scss` in root or `src/` | HTML/CSS | `html-css.md` |

       Use Glob to check for each config file. Run these checks in parallel where possible:
       ```
       Glob(pattern: "package.json")
       Glob(pattern: "tsconfig*.json")
       Glob(pattern: "pyproject.toml")
       Glob(pattern: "setup.py")
       Glob(pattern: "requirements.txt")
       Glob(pattern: "Pipfile")
       Glob(pattern: "go.mod")
       Glob(pattern: "CMakeLists.txt")
       Glob(pattern: "*.csproj")
       Glob(pattern: "*.sln")
       Glob(pattern: "pubspec.yaml")
       ```

       **TypeScript refinement**: If `package.json` is found, also check for `tsconfig.json`. If both exist, include both JavaScript AND TypeScript guides. If only `package.json` exists (no tsconfig), include only JavaScript.

       **If no languages detected**: Ask the user which languages to include:

       ```
       AskUserQuestion(
         questions: [{
           question: "No language config files detected. Which languages does this project use?",
           header: "Select Languages",
           options: [
             { label: "JavaScript", description: "Google JavaScript Style Guide" },
             { label: "TypeScript", description: "Google TypeScript Style Guide" },
             { label: "Python", description: "Google Python Style Guide" },
             { label: "Go", description: "Effective Go" },
             { label: "C++", description: "Google C++ Style Guide" },
             { label: "C#", description: "Google C# Style Guide" },
             { label: "Dart", description: "Effective Dart" },
             { label: "HTML/CSS", description: "Google HTML/CSS Style Guide" }
           ],
           multiSelect: true
         }]
       )
       ```

       ## Step 3: Confirm with User

       Present the detected languages and ask for confirmation:

       ```
       AskUserQuestion(
         questions: [{
           question: "Detected languages: {list}. Inject these style guides into CLAUDE.md?",
           header: "Confirm Style Guides",
           options: [
             { label: "Yes, inject", description: "Add style guides for detected languages + general principles" },
             { label: "Customize", description: "Let me choose which languages to include" },
             { label: "Cancel", description: "Do not modify CLAUDE.md" }
           ],
           multiSelect: false
         }]
       )
       ```

       **On "Customize"**: Show the multi-select language picker from Step 2's fallback.
       **On "Cancel"**: Stop without modifying anything.

       ## Step 4: Assemble Style Guide Section

       Build the injection content:

       1. Start with the opening marker: `<!-- maestro:code-styleguides:start -->`
       2. Add a section header: `## Code Style Guidelines`
       3. Add a note: `<!-- Auto-generated by Maestro /styleguide. Do not edit manually. Re-run /styleguide to update. -->`
       4. Add attribution: `> Source: [conductor style guides](https://github.com/gemini-cli-extensions/conductor/tree/main/templates/code_styleguides)`
       5. Read and append `general.md` from the Maestro plugin's styleguides library
       6. For each detected language, read and append the corresponding guide file
       7. End with the closing marker: `<!-- maestro:code-styleguides:end -->`

       **Locating the guide files**: The guide templates live in the Maestro plugin's `.claude/lib/styleguides/` directory. To find them:

       ```bash
       # Try project path first (if Maestro is the current project)
       ls .claude/lib/styleguides/ 2>/dev/null

       # Fall back to global plugin path
       find ~/.claude/plugins/marketplaces -path "*/maestro/.claude/lib/styleguides" -type d 2>/dev/null
       ```

       Try the project path first, then fall back to the global plugin path.

       **Assembled content example**:
       ```markdown
       <!-- maestro:code-styleguides:start -->
       ## Code Style Guidelines

       <!-- Auto-generated by Maestro /styleguide. Do not edit manually. Re-run /styleguide to update. -->

       > Source: [conductor style guides](https://github.com/gemini-cli-extensions/conductor/tree/main/templates/code_styleguides)

       {content of general.md}

       {content of typescript.md}

       {content of python.md}
       <!-- maestro:code-styleguides:end -->
       ```

       ## Step 5: Inject into CLAUDE.md

       **If `CLAUDE.md` exists in the project root**:

       1. Read the file
       2. Check if markers already exist (`<!-- maestro:code-styleguides:start -->` and `<!-- maestro:code-styleguides:end -->`)
          - **If markers found**: Replace everything between and including the markers with the new assembled content
          - **If no markers**: Append the assembled content at the end of the file, preceded by a blank line
       3. Write the updated file

       **If `CLAUDE.md` does not exist**:

       1. Create `CLAUDE.md` with a minimal header and the assembled content:
          ```markdown
          # Project

          {assembled style guide content}
          ```

       ## Step 6: Report

       Output a summary:
       ```
       ## Style Guides Injected

       **Languages**: {list of languages}
       **File**: CLAUDE.md
       **Guides included**:
       - General Code Style Principles
       - {Language 1} Style Guide
       - {Language 2} Style Guide
       - ...

       To update: `/styleguide`
       To remove: `/styleguide --remove`
       ```
       ````

    3. Verify the skill is discoverable:
       ```bash
       find /Users/reinamaccredy/Code/maestro/.claude/skills -L -name "SKILL.md" -type f 2>/dev/null | grep styleguide
       ```
       Expected: path to `styleguide/SKILL.md`
    4. Verify YAML frontmatter parses:
       ```bash
       head -10 /Users/reinamaccredy/Code/maestro/.claude/skills/styleguide/SKILL.md
       ```
       Expected: valid YAML frontmatter between `---` markers
    5. Commit: `feat(styleguide): add /styleguide command with language detection and CLAUDE.md injection`

- [ ] Task 3: Add styleguide suggestion to `/work` skill
  - **Agent**: spark
  - **Acceptance criteria**:
    - Work skill (`/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`) has a non-blocking suggestion in Step 1.5
    - If `CLAUDE.md` exists but has no `<!-- maestro:code-styleguides:start -->` marker, log a tip suggesting `/styleguide`
    - The suggestion does NOT block execution — it is informational only
    - Existing `/work` behavior is completely unchanged
  - **Dependencies**: Task 2
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md`
    2. In **Step 1.5: Validate & Confirm**, after the plan validation table (the one with `## Objective`, `## Tasks`, `## Verification` rows) and before the "Show plan summary" paragraph, add this non-blocking check:

       ```markdown
       **Check for code style guides** in the host project's `CLAUDE.md`:

       ```bash
       grep -q "maestro:code-styleguides:start" CLAUDE.md 2>/dev/null
       ```

       If the marker is NOT found (grep exits non-zero), log a non-blocking suggestion:
       > Tip: Run `/styleguide` to inject language-specific code style guides into your project's CLAUDE.md. This helps all agents produce consistent, idiomatic code.

       Do NOT block execution or prompt the user. This is informational only — proceed to the next step regardless.
       ```

    3. Verify the edit:
       ```bash
       grep -c "maestro:code-styleguides" /Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md
       ```
       Expected: at least `1`
    4. Verify the work skill still has all required structure (Step 1 through Step 9):
       ```bash
       grep -c "### Step" /Users/reinamaccredy/Code/maestro/.claude/skills/work/SKILL.md
       ```
       Expected: same count as before the edit, or +0 (the check is added inline, not as a new step)
    5. Commit: `feat(work): add /styleguide suggestion to plan validation step`

- [ ] Task 4: Update Maestro CLAUDE.md, maestro skill, and docs
  - **Agent**: spark
  - **Acceptance criteria**:
    - `/Users/reinamaccredy/Code/maestro/CLAUDE.md` lists `/styleguide` in the Commands section
    - `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md` lists `/styleguide` in the Triggers table
    - `/Users/reinamaccredy/Code/maestro/docs/SKILL-INTEROP.md` mentions code styleguides
    - No broken markdown links or anchors
  - **Dependencies**: Task 3
  - **Files**:
    - Modify: `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md`
    - Modify: `/Users/reinamaccredy/Code/maestro/docs/SKILL-INTEROP.md`
  - **Steps**:
    1. Read `/Users/reinamaccredy/Code/maestro/CLAUDE.md`
    2. In the `## Commands` section, add a new row after `/review`:
       ```
       - `/styleguide` — Detect project languages and inject code style guides into CLAUDE.md
       ```
    3. Read `/Users/reinamaccredy/Code/maestro/.claude/skills/maestro/SKILL.md`
    4. In the `## Triggers` table, add a new row:
       ```
       | `/styleguide` | Inject code style guides into project CLAUDE.md |
       ```
    5. Read `/Users/reinamaccredy/Code/maestro/docs/SKILL-INTEROP.md`
    6. In the "Recommended Skills" table, add a row:
       ```
       | `code-styleguides` | Language-specific coding conventions injected into CLAUDE.md via `/styleguide` |
       ```
    7. Verify links:
       ```bash
       cd /Users/reinamaccredy/Code/maestro && ./scripts/validate-links.sh
       ```
    8. Verify anchors:
       ```bash
       cd /Users/reinamaccredy/Code/maestro && ./scripts/validate-anchors.sh
       ```
    9. Commit: `docs(styleguide): add /styleguide to commands, triggers, and skill-interop docs`

- [ ] Task 5: End-to-end validation
  - **Agent**: spark
  - **Acceptance criteria**:
    - All 9 template files exist and are non-empty in `.claude/lib/styleguides/`
    - `/styleguide` skill is discoverable
    - Plugin manifest validates: `cat .claude-plugin/plugin.json | jq .`
    - Anchor validation passes
    - Link validation passes
  - **Dependencies**: Task 4
  - **Files**: None (validation only)
  - **Steps**:
    1. Verify templates: `ls .claude/lib/styleguides/` → 9 files
    2. Verify skill: `find .claude/skills -L -name "SKILL.md" -type f | grep styleguide`
    3. Verify plugin manifest: `cat .claude-plugin/plugin.json | jq .`
    4. Run `./scripts/validate-anchors.sh`
    5. Run `./scripts/validate-links.sh`
    6. Commit fixes if needed

## Verification

- [ ] `ls .claude/lib/styleguides/ | wc -l` — outputs `9`
- [ ] `find .claude/skills -L -name "SKILL.md" -type f | grep styleguide` — returns path to styleguide skill
- [ ] `grep "maestro:code-styleguides:start" .claude/skills/styleguide/SKILL.md` — confirms idempotent marker logic exists
- [ ] `grep "Step 1.5" .claude/skills/work/SKILL.md` — confirms work skill integration
- [ ] `grep "/styleguide" CLAUDE.md` — confirms docs updated
- [ ] `cat .claude-plugin/plugin.json | jq .` — valid JSON
- [ ] `./scripts/validate-links.sh` — no broken links
- [ ] `./scripts/validate-anchors.sh` — no broken anchors

## Notes

### Architecture Decision: CLAUDE.md Injection (Not Skill-Based Worker Injection)

The user chose CLAUDE.md injection over skill-based `## SKILL GUIDANCE` injection because:
1. **Universal coverage** — every Claude Code session benefits, not just Maestro `/work`
2. **Simpler mental model** — style guides live where users expect project instructions
3. **No orchestrator changes** — no need to modify skill injection pipeline or add sub-guide selection
4. **User-visible** — users can see and edit the injected style guides in their CLAUDE.md

### Idempotency via HTML Comment Markers

Using `<!-- maestro:code-styleguides:start -->` and `<!-- maestro:code-styleguides:end -->` markers allows:
- **Re-running**: `/styleguide` replaces existing content between markers
- **Clean removal**: Delete everything between markers to remove
- **Non-destructive**: Existing CLAUDE.md content outside markers is untouched

### Relationship to project-conventions

| Concern | Source | Example |
|---------|--------|---------|
| General language best practices | `/styleguide` → CLAUDE.md | "Use `const` by default in TypeScript" |
| Project-specific conventions | `project-conventions` skill | "This project uses Biome, not ESLint" |

Both coexist. The style guide section in CLAUDE.md provides baseline best practices. Project-specific conventions (whether from the skill or manually written in CLAUDE.md) take precedence when they conflict.

### Content Source

All 9 guide files cloned from [gemini-cli-extensions/conductor](https://github.com/gemini-cli-extensions/conductor/tree/main/templates/code_styleguides) with attribution. The guides are distillations of:
- Google JavaScript Style Guide
- Google TypeScript Style Guide
- Google Python Style Guide
- Effective Go
- Google C++ Style Guide
- Google C# Style Guide
- Effective Dart
- Google HTML/CSS Style Guide
- General coding principles

## Prior Wisdom

Key learnings from past cycles:
- Skill Interoperability: Discovery logic in `.claude/lib/skill-registry.md`, matching in `.claude/lib/skill-matcher.md`. Skills inject into worker prompts as `## SKILL GUIDANCE` sections.
- Prometheus Skills: Context7 + Web Research integration for external docs
- Session Plan Injection: Plans injected into session context
- Hooks Improvement: Hook scripts enforce workflow invariants
- Review Auto-Fix: Auto-fix capabilities in review workflow
