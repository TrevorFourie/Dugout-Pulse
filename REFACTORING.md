# Dugout Pulse Refactoring Tracker

Last updated: 2026-10-22

This tracker stays in the repository so the refactoring is not accidentally treated as complete after an unrelated bug fix or successful app startup.

## Completed

- [x] Split GameContext initial storage restoration into `useGameRestore.ts`.
- [x] Split ongoing localStorage writes into `useGamePersistence.ts`.
- [x] Extract preset lists, renaming, and derived lists into `useGamePresets.ts`.
- [x] Extract opponent lists and opponent-team actions into `useGameOpponents.ts`.
- [x] Extract player-team management into `usePlayerTeams.ts`.
- [x] Extract player-profile management into `useGameProfiles.ts`.
- [x] Extract inning and fielding-position management into `useInningManagement.ts`.
- [x] Extract play creation, editing, ordering, and undo actions into `useGamePlayActions.ts`.
- [x] Extract game start/save/edit/reopen/discard lifecycle into `useGameLifecycle.ts`.
- [x] Extract settings updates, backup import/reset, and first-time setup completion into `useGameDataManagement.ts`.
- [x] Split all five setup wizard steps into focused components under `src/components/setup/`.
- [x] Restore a separate collapsible Legal group at the bottom of the navigation drawer, with Terms and Conditions and Privacy Policy entries.
- [x] Move ScoreTab's primary batting, catcher fielding, and runner classification sets into `scoreTabConstants.ts`.

## Still open

- [ ] Review the remaining responsibilities in `ScoreTab.tsx` (still a large component); continue extracting focused UI and logic modules without changing scoring behavior.
- [ ] Review `SettingsModal.tsx` for remaining section UI that should be split into focused panels.
- [ ] Review the other large source files and only refactor where it meaningfully improves separation of responsibilities.
- [ ] Confirm the Legal policy destinations with the owner, then connect the Terms and Conditions and Privacy Policy entries. They intentionally remain inactive until approved destinations are known.
- [ ] Complete a final source review for accidental behavior changes and missing imports/exports.
- [ ] Have the owner run the app locally and report results before marking the refactoring complete.

## Working agreements

- Work directly on GitHub `main`.
- Preserve current UI and behavior unless a change is explicitly requested.
- Keep changes coherent and rollbackable.
- Do not trigger builds, tests, linting, type-checks, or automated validation. The owner runs local verification.
- Do not mark the overall refactoring complete until all open items are resolved and local verification is confirmed.
