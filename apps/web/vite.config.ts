import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// مسار نسبي لدعم GitHub Pages على المسار الفرعي (/badawy-fleet/)
export default defineConfig({
  base: './',
  plugins: [preact()],
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