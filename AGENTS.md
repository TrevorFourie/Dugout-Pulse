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


## 8. Protect unrelated existing functionality — mandatory non-regression rule

- A request authorizes only the change needed to satisfy that request and its necessary dependencies. It is not permission to change adjacent features, workflows, styling, data formats, defaults, navigation, or behavior.
- Before editing, identify the affected surface and explicitly list nearby behaviors that must remain unchanged. Inspect their implementation and dependencies.
- Do not remove, replace, simplify, rename, reorder, or silently alter existing behavior unrelated to the request—even if another approach seems cleaner. Do not do opportunistic cleanup or refactoring in the same change.
- If a necessary change could affect unrelated behavior, trace the impact, add/perform appropriate checks where possible, and preserve compatibility. If safe isolation cannot be established, stop and explain the specific risk before proceeding.
- Review the complete diff for unrelated changes before committing. Every changed line must have a clear relationship to the request, a required dependency, or a documented fix to a directly discovered defect. Revert incidental changes.
- Check adjacent workflows and consumers for regressions. Passing a narrow check of the edited line does not establish that unaffected behavior is preserved.
- Treat existing user data and established user workflows as protected. Never trade their safety or behavior for convenience or visual simplification.

## 9. Dugout Pulse core principle and priorities

Dugout Pulse is an **offline-first baseball scoring and game-record application**. Its primary responsibility is to let users score and manage games reliably on their device, preserve the integrity and availability of their records, and make important state and failures understandable. UI polish and convenience are secondary to correct scoring, dependable local data, and honest status reporting.

Apply these priorities in order:
1. **Protect user data and scoring integrity.** Do not lose, silently hide, corrupt, duplicate, or misassociate games, player/team records, profiles, settings, schedules, logos, or historical scoring. Treat apparent data disappearance as a serious defect even when the underlying storage keys still exist.
2. **Preserve reliable offline operation.** Core scoring, saved records, settings, and supported backup/restore workflows must not unexpectedly depend on internet or third-party service availability.
3. **Be accurate and honest about state.** A handoff, attempted write, queued action, or started operation is not proof of completion. Confirm persisted/read-back state where the existing storage design supports it. Report uncertainty and failures clearly; never manufacture success.
4. **Keep scoring and game records internally consistent.** Understand downstream effects before changing scoring, inning transitions, player/team identity, schedules, stats, imports/exports, or data migrations. Preserve historical data and expected calculations.
5. **Make failures recoverable and diagnosable.** Prefer safe failure behavior, clear actionable messages, and evidence that helps locate the real defect without exposing unnecessary personal or sensitive data.
6. **Only then optimize convenience and appearance**, while respecting established site styles and existing behavior.

A change that improves appearance but risks data integrity, scoring correctness, offline availability, or unrelated workflows is not acceptable.

## 10. Diagnostic accuracy and actionable issue detection

Diagnostics are part of the product's reliability and recovery mechanism, not decorative logging. Accuracy matters more than making the dashboard look healthy.

- Trace the real failure source and record the correct event/category, error type, message, and relevant safe context. Do not report a generic startup/import failure when the underlying error is a syntax error in another module. Do not log a symptom as if it were the root cause.
- Do not fabricate, infer without evidence, misclassify, suppress, duplicate, or silently downgrade errors and warnings. Preserve original causes and useful stack/context when safe and available.
- Distinguish clearly between an observed failure, a suspected cause, a recovery action, and an unverified possibility. User-facing diagnostics must not state a hypothesis as a confirmed cause.
- Test both detection and reporting paths where possible: the defect must be detected, classified correctly, associated with the relevant current build/session where required, and made available to the established diagnostics/export mechanism.
- Avoid stale errors being presented as current-build errors, and avoid false positives that imply the app is broken when it is not. Respect the project's current-build-only diagnostic requirements where applicable.
- Keep diagnostics privacy-conscious and offline-compatible. Do not expose user names, account identifiers, game/player/team names, full file paths, network addresses, or full user-agent strings in diagnostic exports unless the user has explicitly approved a justified requirement consistent with the app's privacy rules.
- Error handling must not conceal a failed operation behind a success toast or success modal. Ensure diagnostic-write/export failures themselves are handled honestly.
- When changing diagnostics, inspect the producer, storage, filtering, display, export, and error-page consumers. Validate end-to-end consistency rather than checking only the visible message.

## 11. Detect issues and report findings instead of ignoring them

- During relevant code inspection, actively look for directly related defects, broken imports/exports, undefined names, stale or duplicate state, invalid lifecycle handling, incorrect error classification, data compatibility risks, unsafe writes, missing failure paths, accessibility regressions, and obvious performance problems.
- Follow evidence: reproduce or trace a suspected issue before describing it as confirmed. Separate confirmed defects from risks, hypotheses, and optional improvements.
- Fix a newly discovered issue only when it is directly within the requested scope or is a necessary prerequisite for a safe implementation. Do not quietly expand the task to fix unrelated findings.
- If an unrelated but material issue is discovered, do not change it without authorization. Report it separately with evidence, impact, severity/priority, and a recommended next action.
- Never ignore a directly relevant issue just because it is inconvenient or makes the task larger. Explain the blocker and what is required to complete the requested work safely.
- Do not claim an audit was performed unless the stated scope was actually inspected. Name the areas checked and the areas not checked.

## 12. Scope discipline: no doing your own thing

- The user's explicit request, constraints, and established project rules define the scope. Do not substitute your own preferred design, interaction, wording, architecture, refactor, or success criteria.
- Do not invent extra user steps, confirmation dialogs, banners, settings, persistence behavior, data migrations, dependencies, or UI components unless they are requested or demonstrably required. If an extra step seems necessary, explain why and obtain clarification before adding it when it changes user experience or scope.
- Do not reinterpret a requirement to make implementation easier. For example, do not replace a required toast with an inline banner or blocking modal; do not replace a shared component with a custom lookalike; do not replace a verified data flow with a newly invented flow.
- Do not declare the task complete based on a partial interpretation. Translate the user's request and relevant prior agreements into acceptance criteria and check each one.
- If you believe an additional change or improvement would help, separate it from the requested implementation and recommend it rather than silently implementing it.

## 13. Performance and improvement recommendations

- While inspecting code for the requested change, note concrete performance, maintainability, reliability, accessibility, and UX improvements that are clearly supported by the code and relevant to the affected area.
- Recommendations must be evidence-based and specific: identify the observed pattern/problem, its user or technical impact, the proposed improvement, and any trade-offs or regression risks. Avoid generic advice and speculative “optimizations.”
- Do not implement optional improvements outside the request without explicit authorization. Required fixes to complete the requested task safely are different from optional enhancements; explain the distinction.
- Prioritize data integrity, scoring correctness, diagnostic accuracy, offline reliability, and regressions above micro-optimizations.
- Where useful, include a short “Additional findings / recommendations” section in the completion report. Label each item as confirmed issue, potential risk, or optional improvement. If no material evidence-based recommendation was found in the inspected scope, say so rather than inventing one.
- Do not perform risky optimizations without measurement or a clear correctness argument. Preserve behavior first; benchmark or validate changes where possible.

## 14. Expanded pre-commit acceptance checklist

Before committing any code change, explicitly check:
- [ ] The requested behavior is implemented, and all user-stated requirements and prior applicable agreements are represented.
- [ ] Existing code patterns, architecture, framework versions, and shared components were followed.
- [ ] Established site styles, themes, interaction rules, and accessibility patterns are respected.
- [ ] Unrelated existing functionality and data formats are unchanged; the diff contains no opportunistic work.
- [ ] Core offline operation, scoring correctness, saved data, backup/restore, and historical records are not put at risk.
- [ ] Success, failure, cancellation, warning, and recovery paths behave honestly and consistently.
- [ ] Diagnostic events and messages remain accurate, correctly classified, privacy-conscious, and useful where relevant.
- [ ] Relevant issues were actively investigated; confirmed findings were handled within scope and out-of-scope findings reported separately.
- [ ] Concrete performance/improvement recommendations were considered without silently expanding scope.
- [ ] The actual committed files were fetched back and checked.
- [ ] Unrun checks—including builds, runtime behavior, and regression tests—are clearly marked unverified, not passed.

If any applicable item fails, do not claim completion. If any item cannot be checked, disclose that limitation explicitly.
