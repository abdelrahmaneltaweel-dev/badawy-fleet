import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// مسار نسبي لدعم GitHub Pages على المسار الفرعي (/badawy-fleet/)
export default defineConfig({
  base: './',
  plugins: [preact()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  resolve: {
    alias: {
      '@badawi/logic': path.resolve(__dirname, '../../packages/logic/src/index.ts')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact']
        }
      }
    }
  }
});