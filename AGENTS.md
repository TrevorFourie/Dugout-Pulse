# Mandatory repository instructions for every coding agent

These are mandatory acceptance criteria, not suggestions. Read this file before inspecting or changing code. If a task conflicts with these rules or an existing project convention, stop and resolve the conflict before editing. Writing code is not proof of completion.

## 1. Follow the existing code

- Inspect the actual current implementation on `main` before editing. Read the target file, callers/consumers, shared components, hooks/utilities, types, relevant tests/configuration, and related storage paths.
- Trace dependencies and every usage of changed interfaces. Check state ownership, read/write paths, error/cancel paths, effect/listener cleanup, async failures, and resource leaks.
- Reuse established components, utilities, naming, architecture, state patterns, error handling, and interaction flows. Extend the existing abstraction when needed; do not invent a parallel or one-off implementation.
- Make the smallest complete change. Preserve unrelated behavior and user workflows. Do not silently broaden scope, remove functionality, add dependencies, or refactor unrelated areas.
- Preserve saved-data keys, schemas, and compatibility. Never rename, migrate, clear, overwrite, or reinterpret user data unless explicitly required and accompanied by a safe, validated migration/recovery path.
- Follow existing component/file boundaries. Search all usages before changing shared APIs. Do not suppress type errors or introduce `any` to make work appear complete.
- Do not guess about code that has not been inspected. If a requirement is materially ambiguous, ask one focused question rather than inventing behavior.

## 2. Framework and technology standards

Use the actual project stack and versions in `package.json`: React 19, TypeScript, Vite 8, Tailwind CSS 4, Capacitor 7, and `lucide-react`. Match installed APIs/configuration; do not assume older syntax.

- Use React function components, existing hooks/context, project TypeScript types, and existing utilities.
- Use Tailwind v4 utility classes consistent with the current setup. Put genuinely shared tokens/styles in established theme/CSS files, not one-off overrides.
- Use `lucide-react` for interface icons. Do not add an icon library or substitute emoji/hand-drawn icons for established UI icons.
- Keep the app offline-first; core functionality must not depend on network access.
- Do not add packages, frameworks, scripts, build steps, or config changes unless necessary and within the requested scope.
- Respect Capacitor's web/native boundary and existing storage/file APIs; check native compatibility before relying on browser-only behavior.
- AI instruction files are development-only. Never copy `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md` into `public/`, `dist/`, Capacitor web assets, or Android resources. Preserve the existing packaging safeguard.

## 3. Site styles and interaction standards

Before styling, inspect `src/index.css` and an existing equivalent component. Match the established Dugout Pulse visual language; do not create a one-off design.

- Preserve brand/theme tokens: Pulse Teal `#00BFA5` (light) / `#00D7BC` (dark), Midnight Slate `#18212D`, dark surfaces `#1A2028`, `#252D38`, `#2D3643`, and existing slate borders, typography, spacing, radii, shadows, and icon/button sizing.
- Respect light, dark, and system theme behavior. Check contrast, focus, disabled, hover/pressed states, and small-screen layouts. Never ship a light-only or dark-only treatment.
- All dropdowns must follow **Stats → Filter stats**, whose source of truth is `src/components/ThemedDropdown.tsx`. Prefer that shared component. Do not add native HTML `<select>` controls for app UI or one-off dropdown styles. Extend the shared component if a capability is missing. Editable/searchable comboboxes must retain typing, filtering, create/delete, selection, and keyboard behavior while matching shared field/menu styling.
- Reuse existing modal, toast, banner, button, input, card, and alert components/patterns. Match their behavior, semantics, dismissal, accessibility, and theme styling instead of creating lookalikes.
- **Toast:** brief, non-blocking feedback only; no decision buttons, no required decision, and no unsupported success claim. Use the established toast pattern, accessible status announcement, and auto-dismiss behavior.
- **Modal:** blocking; use only when a real confirmation/response is required or for persistent/actionable errors. Never show a modal for routine successful handoff or before the user has had an opportunity to perform the action being described.
- Inline status/banner messages are not toasts. Do not replace a required toast with a persistent inline banner and call it a toast.
- Never claim an action completed when it only started or handed off to another system. For backup export, share/download handoff is not proof that an external copy was saved. Do not claim “Backup file created,” externally saved, or safe unless that outcome is established. Preserve appropriate failure, cancellation, and actionable warning paths.
- Use established semantic alert styles/variants. Do not introduce yellow/amber warning styling or a new alert palette where it conflicts with established site standards.
- User-facing text must be friendly, clear, concise, and written for app users—not developers, robots, or AI. Avoid aggressive commands, implementation jargon, and unsupported assurances.
- Accessibility is part of the implementation: semantic controls/roles, accessible names, keyboard support, visible focus, appropriate `aria-live`, and correct modal semantics.

## 4. Required workflow — before, during, and after every change

### Before editing
1. Read this file and applicable AI-agent instructions.
2. Inspect current code, callers, shared components, equivalent UI, CSS/theme, types, storage/data flows, and relevant test/configuration files.
3. Convert the request and existing constraints into explicit acceptance criteria, including code conventions, framework/site styles, behavior, failure/cancel paths, accessibility, and regression risks.
4. Identify the smallest complete change. Resolve material ambiguity before inventing behavior.

### While editing
5. Follow existing code/architecture and reuse or extend shared abstractions.
6. Keep scope tight; preserve workflows, error handling, cancellation, data integrity, and cleanup.
7. Work directly on `main`; do not create branches. **Do not trigger builds**; the user builds/tests locally.

### Before committing
8. Review the complete diff against every acceptance criterion; search all usages of changed APIs and obsolete/duplicate paths.
9. Check success, failure, cancellation, and warning paths as applicable, plus light/dark/system styling, responsive layout, accessibility, and consistency with existing components.
10. Run only appropriate non-build checks that are authorized. Never trigger a build. If a check cannot be performed, mark it unverified.
11. If a criterion fails or is unverified, do not report completion. Fix what is safely fixable and disclose remaining blockers.

### After committing
12. Keep each coherent change in one commit where practical. Fetch committed files back from `main` and verify the actual saved content and commit.
13. Report what changed, exact checks performed and observed results, what was not checked, and what still needs runtime/regression testing.
14. Never describe source inspection as runtime verification, targeted checks as a full audit, or an unrun build as successful.

## 5. Mandatory evidence gate

A task is complete only when every applicable acceptance criterion has evidence. Intention, code-writing, or an unsubstantiated checklist is not evidence. Report these levels separately:
- **Source verified:** committed code was fetched back and checked against named criteria.
- **Static checks verified:** a specific non-build check was run and its result observed.
- **Runtime verified:** behavior was exercised in a running app.
- **Regression verified:** related workflows were tested.

Never imply a stronger level than the evidence supports. Be honest about failures and uncertainty. Do not promise perfection; enforce this gate.

## 6. Canonical dropdown styling reference

`src/components/ThemedDropdown.tsx` defines canonical dropdown visuals: rounded-xl corners, subtle slate border, white light-mode / `#252D38` dark-mode surface, compact semibold text, teal focus ring, shadow and chevron; menu uses slate borders, rounded-xl, shadow-xl, compact padded options, slate hover (`#F1F5F9` / `#2D3643`) and teal selected state (`#00BFA5` / `#00D7BC`) with checkmark where appropriate. Do not create a separate palette or styling implementation.

## 7. AI instruction files and packaging

Every coding agent must read and follow this `AGENTS.md`. `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are development-time guidance only and must never be packaged into app assets.
