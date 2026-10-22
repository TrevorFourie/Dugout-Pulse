import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { createDiagnosticReport, installGlobalDiagnosticHandlers, recordDiagnosticError } from './utils/errorDiagnostics';
import './index.css';
import mobileSplashSrc from '../splash-source/splash-mobile.jpg';
import tabletSplashSrc from '../splash-source/splash-tablet.jpg';
import largeSplashSrc from '../splash-source/splash-large.jpg';

const root = document.getElementById('root')!;

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
  // Dynamic-import rejections are generic; Vite's failed module response contains
  // the actual transform/parser error. Extract readable diagnostics from either
  // plain-text or HTML responses, and retain the source location when present.
  let diagnosticError: unknown = error;
  try {
    const response = await fetch(\`/src/App.tsx?diagnostic=\${Date.now()}\`, { cache: 'no-store' });
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
    const actionableError = readableBody.match(
      /(?:Expected corresponding JSX closing tag[^.]{0,180}\.?|Adjacent JSX elements must be wrapped in an enclosing tag\.?|Unterminated JSX contents\.?|Unexpected token[^.]{0,180}\.?|Failed to parse source for import analysis[^.]{0,180}\.?|The following error occurred while transforming[^.]{0,180}\.?)/i,
    );
    const sourceLocation = readableBody.match(/(?:src\/)?App\.tsx:\d+:\d+/i);
    if (actionableError?.[0]) {
      diagnosticError = new SyntaxError(
        \`\${actionableError[0].trim()}\${sourceLocation?.[0] ? \` (\${sourceLocation[0]})\` : ''}\`,
      );
    } else if (!response.ok && readableBody.length > 0) {
      diagnosticError = new Error(readableBody.slice(0, 220));
    }
  } catch {
    // Preserve the original rejection if the server's diagnostic response is unavailable.
  }
  const reference = recordDiagnosticError('app_startup', diagnosticError);
  root.replaceChildren();

  const shell = document.createElement('main');
  shell.style.cssText = 'min-height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:24px;background:#121923;color:#f8fafc;font-family:system-ui,sans-serif;';
  const card = document.createElement('section');
  card.style.cssText = 'width:100%;max-width:480px;padding:24px;border:1px solid #354050;border-radius:18px;background:#1a2028;';
  const heading = document.createElement('h1');
  heading.textContent = "Dugout Pulse couldn't start";
  heading.style.cssText = 'font-size:22px;font-weight:700;margin:0 0 10px;';
  const message = document.createElement('p');
  message.textContent = 'The app ran into a startup problem. Please restart it. Your saved data has not been intentionally deleted.';
  message.style.cssText = 'font-size:14px;line-height:1.6;color:#d1d5db;';
  const referenceText = document.createElement('p');
  referenceText.textContent = `Error reference: ${reference}`;
  referenceText.style.cssText = 'font-size:12px;color:#9ca3af;';
  const reportButton = document.createElement('button');
  reportButton.type = 'button';
  reportButton.textContent = 'Show diagnostic report';
  reportButton.style.cssText = 'margin-top:12px;padding:10px 14px;border-radius:10px;background:#00d7bc;color:#101419;font-weight:600;';
  const report = document.createElement('textarea');
  report.readOnly = true;
  report.value = createDiagnosticReport();
  report.rows = 12;
  report.hidden = true;
  report.setAttribute('aria-label', 'Sanitised diagnostic report');
  report.style.cssText = 'box-sizing:border-box;width:100%;margin-top:12px;padding:10px;border-radius:8px;color:#111827;background:#fff;font:11px monospace;';
  reportButton.addEventListener('click', () => {
    report.hidden = !report.hidden;
    reportButton.textContent = report.hidden ? 'Show diagnostic report' : 'Hide diagnostic report';
    if (!report.hidden) {
      // Refresh at the moment the report is opened: the HTML bootstrap may capture
      // Vite's original parser error just after this dynamic-import rejection fires.
      report.value = createDiagnosticReport();
      report.select();
    }
  });
  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = 'Restart app';
  reloadButton.style.cssText = 'margin:12px 0 0 8px;padding:10px 14px;border-radius:10px;border:1px solid #526071;color:#f8fafc;font-weight:600;';
  reloadButton.addEventListener('click', () => window.location.reload());
  const note = document.createElement('p');
  note.textContent = 'The report stays on this device. Review it and choose whether to copy or share it; nothing is sent automatically.';
  note.style.cssText = 'margin-top:14px;font-size:12px;line-height:1.5;color:#9ca3af;';
  card.append(heading, message, referenceText, reportButton, reloadButton, report, note);
  shell.append(card);
  root.append(shell);
});
