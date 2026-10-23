# Instructions for GitHub Copilot

**Mandatory:** Before any code inspection or edit, read and follow the complete repository-wide [`AGENTS.md`](../AGENTS.md). It defines acceptance criteria, not optional guidance. Do not proceed by inventing your own interpretation.

## Non-negotiable project principles

- **Follow the code:** inspect the current implementation, callers, shared components, framework setup, styles, types, storage paths and relevant failure paths. Reuse the established architecture and shared abstractions; do not invent parallel implementations.
- **Protect unrelated functionality:** only change what the request requires and necessary dependencies. Do not opportunistically refactor, alter adjacent workflows, change saved-data formats, or silently change behavior unrelated to the task. Review the full diff for regressions.
- **Protect the core product:** Dugout Pulse is an offline-first baseball scoring and game-record app. Scoring correctness, local-data integrity/availability, reliable offline behavior, and honest state reporting outrank convenience or visual polish.
- **Diagnostic accuracy is critical:** trace the actual failure source; do not misclassify, invent, suppress, or report symptoms as root causes. Distinguish confirmed facts from hypotheses, preserve useful safe context, respect privacy, and validate the diagnostic producer-to-display/export path when relevant.
- **Stay in scope:** do not add unrequested UI, confirmations, dependencies, refactors, migrations, or workflows. Ask before making a material product/behavior choice not established by the request and existing code.
- **Detect and report issues:** investigate relevant defects and risks. Fix directly related issues needed for safe completion; report material out-of-scope findings separately with evidence and recommended next steps.
- **Recommend improvements without taking over:** identify concrete evidence-based performance, reliability, maintainability, accessibility, and UX improvements in the affected area. Do not silently implement optional enhancements; label confirmed issues, potential risks, and optional recommendations separately.
- **Match the site:** use the existing React 19, TypeScript, Vite 8, Tailwind CSS 4, Capacitor 7 and lucide-react stack and established site styles, theme tokens, light/dark/system behavior, accessibility and interaction patterns.
- **Dropdowns:** all dropdowns follow Stats → Filter stats as defined by `src/components/ThemedDropdown.tsx`. Do not introduce native `<select>` UI or one-off styling. Preserve existing editable-combobox behavior.
- **Toasts and modals:** toast = temporary, accessible, non-blocking feedback; modal = blocking interaction only when genuinely required. Never use a modal for routine handoff or claim a backup was saved merely because share/download handoff started.
- **Workflow:** work directly on `main`, create no branches, and do not trigger builds. Before committing, check acceptance criteria, the complete diff, unrelated behavior, error/cancel paths, styles, accessibility and relevant diagnostics. After committing, fetch the committed files back and verify them.
- **Evidence:** distinguish source verification, static checks, runtime verification and regression testing. Never claim a build, runtime test, full audit or completion unless that level of checking actually happened. If a requirement is unverified, state that clearly.

If any applicable requirement fails or cannot be checked, do not claim the task is complete. The full process and expanded pre-commit checklist are in `AGENTS.md`.
