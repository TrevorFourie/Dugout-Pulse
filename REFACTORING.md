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
- [x] Extract the Batting, Pitching, and Fielding mode tabs and mode-specific setup/status panels into `ScoreModeTabs.tsx`, `BattingModePanel.tsx`, `PitchingModePanel.tsx`, and `FieldingModePanel.tsx` under `src/components/score/`, keeping game-state orchestration in `ScoreTab.tsx`.

## Still open

- [x] Decompose the major `ScoreTab.tsx` UI responsibilities into `NewGameForm.tsx`, `GameDetailsModal.tsx`, a `PrimaryActionBoard.tsx` orchestrator with separate `BattingActionBoard.tsx`, `PitchingActionBoard.tsx`, and `FieldingActionBoard.tsx`, plus `ScoreModeTabs.tsx`, mode-specific status panels, `usePlayPresentation.ts`, `PlayHistoryCard.tsx`, `PlayHistoryList.tsx`, and `PlaysHistoryModal.tsx`. The file is now 2709 lines (down from 4,341); existing play-flow and drag-reorder hooks remain separate. The stateful runner/pitching event orchestration stays in `ScoreTab` to avoid a risky behaviour rewrite.
- [x] Split the settings UI into focused player details, team management, master presets, venue management, player profiles, and backup/data panels under `src/components/settings/`, alongside the existing scoring, theme, and notifications panels. `SettingsModal.tsx` is now a 234-line composition component rather than a 1,590-line monolith.
- [x] Review `App.tsx`, `StatsTab.tsx`, `GamesTab.tsx`, `DashboardTab.tsx`, `UpcomingGames.tsx`, `GameContext.tsx`, `HelpModal.tsx`, `Navigation.tsx`, and `SettingsNavigationDrawer.tsx`. They already delegate major responsibilities to focused components/hooks or serve cohesive app-shell roles; further splitting was not justified without adding churn.
- [ ] Confirm the Legal policy destinations with the owner, then connect the Terms and Conditions and Privacy Policy entries. They intentionally remain inactive until approved destinations are known.
- [x] Define shared dropdown-control styling in `ThemedDropdown.tsx` and reuse it in the searchable opposition-team, tournament, and custom-value comboboxes while preserving their input/search behavior.
- [x] Keep startup errors user-friendly while exposing sanitized technical error details only through the diagnostic report; prefer a nearby Vite compile/parser error over the downstream dynamic-import failure when routing diagnostics.
- [x] Complete a source-level review of the extracted component boundaries, parent-local references, callback wiring, dropdown style reuse, and import cleanup. Local runtime verification remains an owner step.
- [ ] Have the owner run the app locally and report results before marking the refactoring complete.

## Working agreements

- Work directly on GitHub `main`.
- Preserve current UI and behavior unless a change is explicitly requested.
- Keep changes coherent and rollbackable.
- Do not trigger builds, tests, linting, type-checks, or automated validation. The owner runs local verification.
- Do not mark the overall refactoring complete until all open items are resolved and local verification is confirmed.
