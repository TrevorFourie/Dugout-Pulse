import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './index.css';
import mobileSplashSrc from '../splash-source/splash-mobile.png';
import tabletSplashSrc from '../splash-source/splash-tablet.png';
import largeSplashSrc from '../splash-source/splash-large.png';

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

// App.tsx keeps the splash (native or web) visible until stored data has loaded.
void import('./App.tsx').then(({ default: App }) => {
  createRoot(root).render(<App />);
});
