import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { createDiagnosticReport, installGlobalDiagnosticHandlers, recordDiagnosticError, showDiagnosticScreen } from './utils/errorDiagnostics';
import './index.css';
import mobileSplashSrc from '../splash-source/splash-mobile.jpg';
import tabletSplashSrc from '../splash-source/splash-tablet.jpg';
import largeSplashSrc from '../splash-source/splash-large.jpg';

const root = document.getElementById('root')!;

function renderLocalStartupFallback(reference: string): void {
  const darkTheme = document.documentElement.classList.contains('dark');
  const panel = document.createElement('main');
  panel.setAttribute('role', 'alert');
  panel.setAttribute('aria-live', 'assertive');
  panel.style.cssText = 'box-sizing:border-box;min-height:100vh;padding:32px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:' + (darkTheme ? '#101419' : '#F4F6F8') + ';color:' + (darkTheme ? '#FAFAFA' : '#18212D') + ';font-family:system-ui,sans-serif;text-align:center;';

  const title = document.createElement('h1');
  title.textContent = 'Dugout Pulse needs to restart';
  title.style.cssText = 'margin:0;font-size:24px;font-weight:700;';
  const message = document.createElement('p');
  message.textContent = 'Something went wrong while starting the app. Please restart it to try again. If the problem happens again, share the diagnostic report so it can be investigated. Please keep the app installed and avoid clearing its data for now.';
  message.style.cssText = 'max-width:480px;margin:0;line-height:1.6;';
  const referenceText = document.createElement('p');
  referenceText.textContent = 'Error reference: ' + (reference || 'unavailable');
  referenceText.style.cssText = 'margin:0;font-size:13px;';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:10px;';
  const restart = document.createElement('button');
  restart.type = 'button';
  restart.textContent = 'Restart app';
  restart.style.cssText = 'border:0;border-radius:12px;padding:12px 20px;background:#00BFA5;color:#18212D;font-weight:700;cursor:pointer;';
  restart.addEventListener('click', () => window.location.reload());

  const reportButton = document.createElement('button');
  reportButton.type = 'button';
  reportButton.textContent = 'Show diagnostic report';
  reportButton.setAttribute('aria-expanded', 'false');
  reportButton.style.cssText = 'border:1px solid #64748B;border-radius:12px;padding:12px 20px;background:transparent;color:inherit;font-weight:700;cursor:pointer;';

  const reportPanel = document.createElement('div');
  reportPanel.hidden = true;
  reportPanel.style.cssText = 'width:100%;max-width:640px;text-align:left;';
  const reportLabel = document.createElement('p');
  reportLabel.textContent = 'Review the report before sharing it. Select and copy the text if you need to send it for help.';
  reportLabel.style.cssText = 'font-size:13px;line-height:1.5;';
  const reportText = document.createElement('textarea');
  reportText.setAttribute('aria-label', 'Sanitised diagnostic report');
  reportText.readOnly = true;
  reportText.rows = 12;
  reportText.style.cssText = 'box-sizing:border-box;width:100%;padding:12px;border:1px solid #64748B;border-radius:8px;background:' + (darkTheme ? '#1A2028' : '#FFFFFF') + ';color:' + (darkTheme ? '#E2E8F0' : '#18212D') + ';font-family:monospace;font-size:12px;';
  try {
    reportText.value = createDiagnosticReport(reference || undefined);
  } catch {
    reportText.value = 'The diagnostic report could not be prepared. Error reference: ' + (reference || 'unavailable');
  }
  reportText.addEventListener('focus', () => reportText.select());
  reportButton.addEventListener('click', () => {
    const show = reportPanel.hidden;
    reportPanel.hidden = !show;
    reportButton.setAttribute('aria-expanded', String(show));
    reportButton.textContent = show ? 'Hide diagnostic report' : 'Show diagnostic report';
    if (show) reportText.focus();
  });

  reportPanel.append(reportLabel, reportText);
  actions.append(restart, reportButton);
  panel.append(title, message, referenceText, actions, reportPanel);
  root.replaceChildren(panel);
}

// On Android the native launch window already shows the full-screen splash artwork
// behind the transparent WebView (see index.html), so painting a second web splash
// would only duplicate it. Browsers have no native splash, so paint the responsive
// artwork there before loading the application module.
if (!Capacitor.isNativePlatform()) {
  const splash = document.createElement('div');
  splash.setAttribute('aria-label', 'Loading Dugout Pulse');
  splash.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;overflow:hidden;background:#121923;';
  const picture = document.createElement('picture');
  picture.style.cssText = 'display:block;width:100%;height:100%;';
  const largeSource = document.createElement('source');
  largeSource.media = '(min-width: 1024px) and (min-height: 600px)';
  largeSource.srcset = largeSplashSrc;
  const tabletSource = document.createElement('source');
  tabletSource.media = '(min-width: 600px) and (min-height: 600px)';
  tabletSource.srcset = tabletSplashSrc;
  const image = document.createElement('img');
  image.src = mobileSplashSrc;
  image.alt = 'Dugout Pulse';
  image.fetchPriority = 'high';
  image.decoding = 'sync';
  image.draggable = false;
  image.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
  picture.append(largeSource, tabletSource, image);
  splash.append(picture);
  root.replaceChildren(splash);
}

// Capture runtime failures before the React app is imported. If Vite fails before
// this module can execute, the inline HTML bootstrap displays a separate fallback.
installGlobalDiagnosticHandlers();

// App.tsx keeps the splash (native or web) visible until stored data has loaded.
// Resolve from Vite's project root explicitly. This avoids a malformed relative URL
// if the dev server's document/base URL is not a directory URL.
void import('/src/App.tsx').then(({ default: App }) => {
  createRoot(root).render(<App />);
}).catch(async (error: unknown) => {
  // A failed module import can be a generic browser rejection. Ask Vite for the
  // transformed module response so the shared diagnostic screen can show the
  // actionable parser/import error rather than a generic startup message.
  let diagnosticError: unknown = error;
  let startupDiagnosticDetails = '';
  try {
    const response = await fetch(`/src/App.tsx?diagnostic=${Date.now()}`, { cache: 'no-store' });
    const body = await response.text();
    const readableBody = body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ');
    // Preserve all concise compiler/error lines exposed by Vite, not only the
    // first message used as the event title. The report sanitizer removes paths
    // and common secrets before this context is exported.
    startupDiagnosticDetails = readableBody.split(/\s(?=(?:Error:|SyntaxError:|TypeError:|ReferenceError:|Failed to resolve import|Unexpected token|Expected\b|\[plugin:|\[PARSE_ERROR\]))/i)
      .filter((part) => /(?:Error:|SyntaxError:|TypeError:|ReferenceError:|Failed to resolve import|Unexpected token|Expected\b|\[plugin:|\[PARSE_ERROR\]|\.tsx?:\d+:\d+)/i.test(part))
      .slice(0, 12)
      .join('\n')
      .slice(0, 12000);
    const actionableError = readableBody.match(
      /(?:Expected corresponding JSX closing tag[^.]{0,180}\.?|Adjacent JSX elements must be wrapped in an enclosing tag\.?|Unterminated JSX contents\.?|Unexpected token[^.]{0,180}\.?|Failed to resolve import[^.]{0,180}\.?|Failed to parse source for import analysis[^.]{0,180}\.?|The following error occurred while transforming[^.]{0,180}\.?)/i,
    );
    const sourceLocation = readableBody.match(/(?:src[\\/])?[^\s"'<>:]+\.tsx?:\d+:\d+/i);
    if (actionableError?.[0]) {
      diagnosticError = new SyntaxError(
        `${actionableError[0].trim()}${sourceLocation?.[0] ? ` (${sourceLocation[0]})` : ''}`,
      );
    } else if (!response.ok && readableBody.length > 0) {
      diagnosticError = new Error(readableBody.slice(0, 220));
    }
  } catch {
    // Keep the original module rejection if Vite's diagnostic response is unavailable.
  }
  let reference = 'unavailable';
  try {
    reference = recordDiagnosticError('app_startup', diagnosticError, startupDiagnosticDetails || undefined);
  } catch {
    // Keep the original startup failure visible even if recording diagnostics fails.
  }
  root.replaceChildren();
  if (!showDiagnosticScreen(reference)) {
    renderLocalStartupFallback(reference);
  }
});
