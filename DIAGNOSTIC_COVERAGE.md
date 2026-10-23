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

## Unavoidable coverage gaps

1. The browser cannot capture a native process crash, operating-system termination, device power loss or a WebView failure that occurs before any HTML/JavaScript diagnostic bootstrap executes.
2. The app cannot read VS Code's Problems panel or diagnostics generated only in the user's development environment. It can retain compiler details that Vite exposes to the running page.
3. Exceptions caught and then silently discarded by code that does not call the diagnostic reporter are not reliably observable from global handlers.
4. Native plugin failures are captured when they reject into the JavaScript promise/error flow or are explicitly reported by the calling code; failures that never reach JavaScript cannot be recorded.
5. If all persistent storage is unavailable, the diagnostic report may exist only in memory for the current page session. The app must not claim that such a report is safely persisted.
6. The standalone HTML screen has a separate bootstrap implementation because the bundled diagnostic module may not have loaded. Its report path therefore applies its own allowlist and sanitisation rather than relying on the React app.

## Verification status

- Source files and call paths were inspected on `main`; source-level checks were made for the diagnostic handlers, report sanitisation, startup fallback, error-boundary fallback, recovery dropdown and modal severity.
- No build was triggered, in accordance with the required workflow.
- This source inspection does not prove runtime behaviour in every browser/WebView. Local runtime regression testing remains necessary for actual uncaught errors, Hook-order failures, unavailable storage, Vite multi-error output and fallback rendering.
