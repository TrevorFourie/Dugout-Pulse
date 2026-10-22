import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { installGlobalDiagnosticHandlers, recordDiagnosticError, showDiagnosticScreen } from './utils/errorDiagnostics';
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
  // A failed module import can be a generic browser rejection. Ask Vite for the
  // transformed module response so the shared diagnostic screen can show the
  // actionable parser/import error rather than a generic startup message.
  let diagnosticError: unknown = error;
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
  const reference = recordDiagnosticError('app_startup', diagnosticError);
  root.replaceChildren();
  showDiagnosticScreen(reference);
});
