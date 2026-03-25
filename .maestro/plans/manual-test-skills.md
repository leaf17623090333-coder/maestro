# Manual Skill Injection Test

## Objective
Verify that skills (web-design-guidelines, frontend-design) get injected into worker prompts for UI tasks.

## Scope
**In**: One UI task to trigger skill matching
**Out**: Actual implementation — just verifying skill injection

## Tasks

- [ ] Task 1: Create a simple login form component
  - **Description**: Build a login form with email and password fields, styled with modern CSS
  - **Keywords**: frontend, UI, design, component
  - **Agent**: spark
  - **Expected**: Worker prompt should include `## SKILL GUIDANCE` with frontend-design and/or web-design-guidelines content

## Verification

- [ ] When spark worker is spawned, check that the prompt includes `## SKILL GUIDANCE` section
- [ ] Verify skill content (frontend-design aesthetic guidelines or web-design-guidelines) appears
- [ ] If no SKILL GUIDANCE section appears, check Step 3.5 discovery output

## Notes

**What to look for in the orchestrator output:**

1. Step 3.5 should show discovered skills:
   ```
   Discovered skills:
   - maestro (project)
   - web-design-guidelines (project)
   - frontend-design (plugin)
   ...
   ```

2. When spawning the spark worker, the prompt should include:
   ```
   ## SKILL GUIDANCE

   ### frontend-design
   [Content about distinctive, production-grade frontend interfaces...]

   ### web-design-guidelines
   [Content about Web Interface Guidelines compliance...]
   ```

**Keywords that trigger matching:**
- frontend, UI, design, component, form, login → should match frontend-design
- UI, accessibility, design, UX → should match web-design-guidelines
