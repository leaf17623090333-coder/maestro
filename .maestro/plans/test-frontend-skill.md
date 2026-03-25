# Test Frontend-Design Skill Injection

## Objective
Verify that the frontend-design plugin skill is discovered and injected into worker prompts for UI tasks.

## Scope
**In**: One UI task to trigger frontend-design skill matching
**Out**: Actual implementation quality — just verifying skill injection works

## Tasks

- [ ] Task 1: Build a hero section component
  - **Description**: Create a visually striking hero section with a headline, subtext, and CTA button. Use modern CSS with gradients and animations.
  - **Keywords**: frontend, UI, design, component, hero, visual
  - **Agent**: spark
  - **Expected**: Worker prompt should include `## SKILL GUIDANCE` with both:
    - `frontend-design` (plugin skill about distinctive aesthetics)
    - `web-design-guidelines` (project skill about UI compliance)

## Verification

- [ ] Step 3.5 shows plugin discovery: `find ~/.claude/plugins/marketplaces -name "SKILL.md"` returns frontend-design
- [ ] Worker prompt includes `## SKILL GUIDANCE` section
- [ ] `frontend-design` skill content appears (about "distinctive, production-grade frontend interfaces")
- [ ] `web-design-guidelines` skill content appears (about "Web Interface Guidelines compliance")

## Notes

**What the orchestrator should do:**

1. **Step 3.5 — Skill Discovery** should run:
   ```bash
   find .claude/skills -L -name "SKILL.md" -type f 2>/dev/null
   find .agents/skills -L -name "SKILL.md" -type f 2>/dev/null
   find ~/.claude/skills -name "SKILL.md" 2>/dev/null
   find ~/.claude/plugins/marketplaces -name "SKILL.md" 2>/dev/null
   ```

2. **Expected skills found:**
   - Project: maestro, plan-template, project-conventions, web-design-guidelines
   - Plugin: frontend-design, claude-automation-recommender, etc.

3. **Keyword matching:**
   - "frontend, UI, design, component" → should match both frontend-design AND web-design-guidelines

4. **Worker prompt format:**
   ```
   ## SKILL GUIDANCE

   ### frontend-design
   This skill guides creation of distinctive, production-grade frontend interfaces...

   ### web-design-guidelines
   Review UI code for Web Interface Guidelines compliance...
   ```

**Success criteria**: Both skills discovered and injected into the spark worker prompt.
