import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Custom Vite plugin to append version timestamp to all local script & stylesheet links
function cacheBustHtmlPlugin() {
  return {
    name: 'cache-bust-html-plugin',
    transformIndexHtml(html: string) {
      // Format timestamp like YYYYMMDDHHMMSS based on current date
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      
      let updatedHtml = html;

      // Replace link href attribute if it points to a local stylesheet (ends with .css) and doesn't already have query params
      updatedHtml = updatedHtml.replace(/(href)="([^"]+\.css)"/g, (match, attr, pathStr) => {
        if (pathStr.startsWith('http') || pathStr.startsWith('//') || pathStr.includes('?')) {
          return match;
        }
        return `${attr}="${pathStr}?v=${timestamp}"`;
      });

      // Replace script src attribute if it points to a local JS asset (ends with .js or .ts or .tsx) and doesn't already have query params
      updatedHtml = updatedHtml.replace(/(src)="([^"]+\.(js|ts|tsx))"/g, (match, attr, pathStr) => {
        if (pathStr.startsWith('http') || pathStr.startsWith('//') || pathStr.includes('?')) {
          return match;
        }
        return `${attr}="${pathStr}?v=${timestamp}"`;
      });

      return updatedHtml;
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), cacheBustHtmlPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
