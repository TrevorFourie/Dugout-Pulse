# GitHub Copilot instructions

Before inspecting or editing code, read and follow the complete mandatory repository standards in [`AGENTS.md`](../AGENTS.md). They are acceptance criteria, not suggestions.

Follow the existing implementation and architecture: inspect callers, shared components, framework configuration, styles/theme, types, storage/data paths and failure cases before editing. Use the installed React 19, TypeScript, Vite 8, Tailwind CSS 4, Capacitor 7 and lucide-react stack. Match established site styles, brand tokens, light/dark/system themes, accessibility and interaction patterns; reuse shared components instead of inventing one-off implementations.

All dropdowns follow Stats → Filter stats via `src/components/ThemedDropdown.tsx`. Avoid native `<select>` UI and one-off dropdown styles. Editable comboboxes must preserve existing input behavior while matching the shared field/menu/hover/selected/focus styling.

Follow the mandatory workflow in `AGENTS.md`: define acceptance criteria before editing; inspect and trace code; check applicable success/failure/cancel paths before committing; fetch committed files back from `main`; and report only evidence-backed verification. Work directly on `main`, create no branches, and do not trigger builds. Never claim runtime verification, full audit, or completion beyond the evidence actually obtained.
