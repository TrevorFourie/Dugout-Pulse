import { createRoot } from 'react-dom/client';
import './index.css';
import mobileSplashSrc from '../splash-source/splash-mobile.png';
import tabletSplashSrc from '../splash-source/splash-tablet.png';
import largeSplashSrc from '../splash-source/splash-large.png';

// Paint the responsive splash into the HTML root before loading the application
// module. This avoids leaving the WebView's initial document blank while App.tsx
// and its dependency tree are downloaded and evaluated.
const root = document.getElementById('root')!;
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

// Keep that first-painted artwork in place until the app module is ready to
// render. App.tsx then keeps its matching splash visible until stored data loads.
void import('./App.tsx').then(({ default: App }) => {
  createRoot(root).render(<App />);
});
