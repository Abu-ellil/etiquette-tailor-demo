import { defineConfig } from 'vite';
import { version } from './package.json';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  root: '.',
  build: {
    outDir: '.vite/renderer/main_window',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});
