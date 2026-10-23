# Dugout Pulse diagnostic coverage and limitations

This document describes the diagnostic/error-handling paths present in the source on `main`. It is a source-level inventory, not a claim that the application has passed a local runtime test.

## Capture paths

| Failure type | Capture path | Behaviour and limits |
| --- | --- | --- |
| Uncaught JavaScript errors | `window.error` in `src/utils/errorDiagnostics.ts` | Records the error and opens the standalone diagnostic screen when available. Resource-load failures are recorded without forcing a modal for every failed image/resource. |
| Unhandled promise rejections | `unhandledrejection` in `src/utils/errorDiagnostics.ts` | Records unhandled rejection reasons. Expected `AbortError` cancellation is ignored. |
| React render failures | `src/components/ErrorBoundary.tsx` | Records the exception, React component stack and error stack. If the document-level screen cannot be shown, a local fallback offers restart and a sanitised report preview. |
| React Hook-order errors | Console capture in `src/utils/errorDiagnostics.ts` | Preserves React's previous/next Hook comparison and associates it with the subsequent render error where possible. |
| Startup/module failures | `index.html` and `src/main.tsx` | The inline bootstrap can show an error screen before React starts. Vite overlay capture retains multiple concise compiler diagnostic lines where exposed; the module-import handler also extracts available error lines from Vite's response. |
| Browser storage failures | Storage wrappers installed by `installGlobalDiagnosticHandlers` | Attempts to record thrown `getItem`, `setItem`, `removeItem` and `clear` errors while rethrowing the original exception. Prototype wrapping can be unavailable in restricted WebViews. |
| Fetch/network failures | Wrapped `window.fetch` in `src/utils/errorDiagnostics.ts` | Captures thrown fetch failures, rejected fetch promises and non-OK HTTP responses. Request URLs and query strings are not included in the report. Aborted requests are excluded. |
| Caught operation errors | Operation-specific `reportFailure` / `recordDiagnosticError` call sites | Backup, import/export, recovery, logo and storage operations record failures where the relevant code explicitly reports them. A caught exception that is swallowed without reporting cannot be inferred reliably by the global handlers. |
| Timers, callbacks and asynchronous code | Global error/rejection handlers plus operation-specific reporting | Uncaught callback exceptions and unhandled asynchronous rejections are covered. Handled errors must be reported by their catch/operation code to be retained. |

## Report quality and privacy

- Reports are intentionally limited to the latest actionable error for the current build unless a specific error reference is requested.
- Timestamps retain millisecond precision; build identification is included when the running bundle exposes it.
- Reports rebuild events from an allowlist, sanitise stored error messages and details, constrain stack frames to source basenames and line/column numbers, and exclude the full user-agent, account identifiers, game contents, player/team names, network addresses and full filesystem paths by design.
- Startup errors captured by the HTML bootstrap before the application bundle runs use build `unknown`, because the normal build identifier is not available at that point.
- Diagnostic storage can itself be blocked, unavailable or full. The implementation falls back to session storage and then in-memory events where possible. In-memory events cannot survive a page reload or process termination.
- Sanitisation is a safeguard, not a guarantee that every arbitrary third-party error string is free of user-supplied text. Review a report before sharing it.

## User-facing failure presentation

- Critical, persistent or actionable failures use the established `ConfirmationModal` pattern rather than disappearing toast notifications.
- Settings backup creation/cancellation, logo processing, and errors reported by the settings child panels are routed through the settings modal alert.
- Setup-screen backup import catches both reader failures and asynchronous import exceptions. Failed imports use a modal; when a verified pre-import checkpoint exists, automatic persistence is paused.
- Scheduled-game and opposition-team local-storage arrays are now validated item-by-item before use. Empty strings, malformed JSON, non-array values and malformed entries raise a diagnostic and show a modal; scheduled-game mutations and reminder synchronization are paused for that component session so a fallback empty list cannot overwrite or act on the unreadable saved list. The original stored value is not rewritten. Saved-game reopen failures use a modal with a diagnostic reference.
- Scheduled-game storage/recovery failures and opposition-team write failures use modal alerts. Notification-permission retry feedback remains inside its active permission dialog.
- When automatic saving is paused, the recovery alert offers a direct route to Settings → Data & About → Recovery Journal, including when the separate localStorage snapshot is unavailable or does not cover the affected files.
- Inline errors remain for ordinary form validation. Brief success confirmations may use status banners/toasts.
- The app entry point now wraps the app in an outer error boundary in addition to the app-level boundary, so an error thrown by the inner boundary's fallback can be caught by a parent boundary.

## Source-audit scope

A broad source-pattern scan of the 78 TypeScript React component files is useful for finding likely alert, toast, status, error and catch paths, but it is not proof that every path has been reviewed against the requirements. A follow-up review found additional omissions despite that scan: backup export could silently substitute defaults for unreadable setup metadata or filter malformed preset-list entries; diagnostic report export did not guard its own report-generation path with a catch; destructive reset could clear some storage keys, encounter a later removal failure, and still report success while publishing empty in-memory state; scoring-screen/runner-workflow persistence failures were only written to the console rather than shown to the user; scheduled-game/opposition-team storage reads accepted malformed entries or treated an empty stored string as an absent list; venue renaming wrote scheduled-game storage directly without the protected-write/read-back safeguard; live-play scoring actions wrote the authoritative live-game key directly, swallowing write errors and still updating in-memory state; and the custom-logo library treated unreadable metadata as an empty list, allowing a logo rename/add or backup export to omit or overwrite the existing library. These are corrected in the current source: backup export stops on invalid metadata, diagnostic export has a guarded modal fallback, reset verifies each key removal before publishing empty state and reports an unconfirmed reset without claiming nothing changed, scoring-state persistence failures now use a modal with plain-language guidance, scheduled-game/opposition-team arrays are shape-validated before they are used, mutation/reminder synchronization is paused after an invalid read, venue renaming validates the stored schedule and uses the protected verified write before updating the venue list, all live-play create/edit/undo/reorder actions now write through the protected storage helper before publishing the changed game state; and logo-library mutations, backup export, and logo restore use a strict validated read so malformed metadata cannot be treated as an empty library. If a live-game write cannot be verified, the in-memory change is blocked and automatic storage writes are paused. This is evidence that pattern scanning alone is insufficient; this document does not claim every user-facing message or every asynchronous operation has been exhaustively verified end-to-end.

Deeper path inspection covered the startup bootstrap, diagnostic recorder, app and settings boundaries, storage persistence/restore, private recovery journal, JSON backup import/export, scheduled games, opposition-team management, notification failures and recap export. The current review is source-level only and does not include a local build or runtime execution.

## Unavoidable coverage gaps

1. The browser cannot capture a native process crash, operating-system termination, device power loss or a WebView failure that occurs before any HTML/JavaScript diagnostic bootstrap executes.
2. The app cannot read VS Code's Problems panel or diagnostics generated only in the user's development environment. It can retain compiler details that Vite exposes to the running page.
3. Exceptions caught and then silently discarded by code that does not call the diagnostic reporter are not reliably observable from global handlers.
4. Native plugin failures are captured when they reject into the JavaScript promise/error flow or are explicitly reported by the calling code; failures that never reach JavaScript cannot be recorded.
5. If all persistent storage is unavailable, the diagnostic report may exist only in memory for the current page session. The app must not claim that such a report is safely persisted.
6. The standalone HTML screen has a separate bootstrap implementation because the bundled diagnostic module may not have loaded. Its report path therefore applies its own allowlist and sanitisation rather than relying on the React app.

## Verification status

- The current `main` sources were fetched again after the changes and checked for the expected hook order, modal routing, scheduled-game validation, import failure handling and outer error-boundary placement.
- Backup export now stops if the setup-completed flag cannot be read/validated, and stops rather than silently filtering non-string entries from saved preset lists.
- Diagnostic report export now catches exceptions thrown while building or handing off the report, attempts to record the failure, and falls back to a modal plus the manual report preview.
- Destructive reset now checks every app-data key removal by reading it back, preserves diagnostics and recovery snapshots, and only clears in-memory state after verified removal. If a removal fails, reset reports failure and retains recovery copies rather than claiming success.
- Scoring-screen and runner-workflow state persistence failures now open a modal and record the failure, instead of relying only on `console.error`.
- Live-game play mutations no longer call `localStorage.setItem` directly. They use the protected, read-back-verified storage helper before updating the in-memory game, and are blocked after storage protection has failed.
- The shared persistence runner now catches thrown errors from checkpoint creation or write/serialization callbacks, records the failure when possible, and pauses later storage writes instead of relying solely on an unhandled-rejection handler.
- The custom-logo library now distinguishes a missing key from a blank/corrupt value, validates every entry, surfaces read failures in a modal, and uses protected read-back-verified writes for rename/add/delete operations. Backup creation fails rather than exporting a silently empty logo library; restore validates the current library before writing restored image files.
- The settings backup success/cancel/failure paths were rechecked: actionable outcomes use the settings confirmation modal rather than the green inline status banner.
- The reported `SettingsModal` Hook-order defect was fixed by moving all hooks before the closed-modal early return. The earlier `App.tsx` hook-order correction remains in place.
- Source-level checks are not compile or runtime tests. No build was triggered, in accordance with the required workflow; the existing `userMessages.test.ts` test file was not executed in this remote-source review. The message-style audit is not yet a complete path-by-path proof that no other actionable failures are shown inline or as toasts; the earlier broad pattern scan did not prevent the missed backup-success path, so that requirement remains only partially verified.
- Local regression testing is still required for React Hook order, startup/module failures, restricted/full storage, recovery restore and rollback, backup imports, and native WebView behaviour.
- A failed backup import after a verified pre-import checkpoint pauses automatic persistence and does not publish the imported game/profile/settings state before direct scheduled-game/opposition-team/setup-flag writes succeed. Logo files or the logo-library key may already have been written before a later operation fails; the pre-import checkpoint is retained for explicit recovery, but those earlier logo writes are not automatically rolled back by the import handler.
