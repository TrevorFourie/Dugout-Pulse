import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { rm } from 'node:fs/promises';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const buildId = `${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return {
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      react(),
      tailwindcss(),
      {
        // AI-agent guidance belongs in the repository only, never in web assets copied
        // into Capacitor's Android APK/AAB.
        name: 'exclude-ai-agent-instructions',
        apply: 'build',
        async closeBundle() {
          const outDir = path.resolve(__dirname, 'dist');
          for (const file of [
            'AGENTS.md',
            'CLAUDE.md',
            'GEMINI.md',
            '.github/copilot-instructions.md',
          ]) {
            await rm(path.join(outDir, file), { force: true, recursive: true });
          }
        },
      },
      {
        // The splash-source/*.png originals are only used by the browser-only web splash
        // (skipped on native). Android's native splash is generated from the files on disk by
        // build-apk.ps1, so keep these ~10 MB of PNGs out of the production bundle (APK/AAB).
        name: 'exclude-splash-source-images',
        apply: 'build',
        enforce: 'pre',
        resolveId(id: string) {
          if (/splash-source\/[^/]+\.(png|jpe?g|webp|gif|avif|svg)$/i.test(id)) return '\0empty-splash-image';
          return null;
        },
        load(id: string) {
          if (id === '\0empty-splash-image') return 'export default "";';
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      // The HTML bootstrap reads Vite's structured compile error, then replaces the raw
      // overlay with Dugout Pulse's unified diagnostic modal.
      hmr: process.env.DISABLE_HMR === 'true' ? false : { overlay: true },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});