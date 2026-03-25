# Test Skill Interop

## Objective
Verify that the web-design-guidelines skill gets injected into worker prompts.

## Scope
**In**: One small UI-related task to trigger skill matching
**Out**: Actual implementation (just testing the injection)

## Tasks

- [ ] Task 1: Review UI accessibility
  - **Description**: Check the docs/SKILL-INTEROP.md file for accessibility best practices
  - **Agent**: spark

## Verification

- [ ] Worker prompt includes `## SKILL GUIDANCE` section
- [ ] `web-design-guidelines` skill content appears in the prompt

## Notes

This is a test plan to verify skill interop works. The task mentions "UI" and "accessibility" which should trigger matching with the `web-design-guidelines` skill.
