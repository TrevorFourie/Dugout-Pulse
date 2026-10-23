# Instructions for Gemini

Before inspecting or editing code, read and follow the complete mandatory repository standards in [`AGENTS.md`](AGENTS.md). They are acceptance criteria, not suggestions.

Follow the actual existing code and architecture: inspect callers, shared components, framework configuration, site styles, types, data/storage paths and failure cases before edits. Use the installed React 19, TypeScript, Vite 8, Tailwind CSS 4, Capacitor 7 and lucide-react stack. Match established styles, tokens, light/dark/system themes, accessibility and interaction patterns. Reuse shared components rather than inventing one-off implementations.

All dropdowns follow Stats → Filter stats via `src/components/ThemedDropdown.tsx`; do not introduce native `<select>` UI or one-off dropdown styles. Preserve existing combobox behavior. Follow the mandatory before-edit, before-commit, and after-commit verification workflow in `AGENTS.md`. Work directly on `main`, create no branches, and do not trigger builds. Never claim runtime verification, full audit, or completion beyond the evidence actually obtained.
