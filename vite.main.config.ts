import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/main/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['better-sqlite3'],
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  resolve: {
    alias: {
      'better-sqlite3': 'better-sqlite3',
    },
  },
});
