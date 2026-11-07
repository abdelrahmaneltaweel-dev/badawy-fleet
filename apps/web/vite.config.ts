import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function traccarProxyPlugin() {
  return {
    name: 'traccar-dynamic-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/traccar-proxy', async (req: any, res: any) => {
        try {
          // Read target URL dynamically from header, environment variable, or fallback
          const rawTarget =
            (req.headers['x-traccar-target'] as string) ||
            process.env.TRACCAR_URL ||
            'http://196.221.144.183:8080';

          const targetUrl = rawTarget.trim().replace(/\/+$/, '');
          let finalSubUrl = subUrl;
          const rawAuth = (req.headers['authorization'] as string) || '';

          // Forward authentication and essential headers
          const headers: Record<string, string> = {
            Accept: 'application/json'
          };

          if (rawAuth.startsWith('Bearer ')) {
            const token = rawAuth.slice(7).trim();
            if (token && !finalSubUrl.includes('token=')) {
              const sep = finalSubUrl.includes('?') ? '&' : '?';
              finalSubUrl = `${finalSubUrl}${sep}token=${encodeURIComponent(token)}`;
            }
            // Traccar 4.x expects token in query parameter and crashes on Bearer headers
          } else if (rawAuth) {
            headers['Authorization'] = rawAuth;
          }

          const destination = `${targetUrl}${finalSubUrl.startsWith('/') ? finalSubUrl : `/${finalSubUrl}`}`;

          if (req.headers['cookie']) {
            headers['Cookie'] = req.headers['cookie'];
          }
          if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type'];
          }

          const fetchOptions: RequestInit = {
            method: req.method || 'GET',
            headers
          };

          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: any[] = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            if (chunks.length > 0) {
              fetchOptions.body = Buffer.concat(chunks);
            }
          }

          const response = await fetch(destination, fetchOptions);

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
          res.statusCode = response.status;

          const arrayBuf = await response.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
        } catch (err: any) {
          console.warn('[Traccar Dynamic Proxy Warn]:', err.message);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: 'تعذر الاتصال بسيرفر Traccar عبر البروكسي الداخلي',
              details: err?.message || String(err)
            })
          );
        }
      });
    }
  };
}

// مسار نسبي لدعم GitHub Pages على المسار الفرعي (/badawy-fleet/)
export default defineConfig({
  base: './',
  plugins: [
    preact({
      prefreshEnabled: false,
      devToolsEnabled: false
    }),
    traccarProxyPlugin()
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true
  },
  optimizeDeps: {
    include: [
      'preact',
      'preact/hooks',
      'preact/compat',
      'preact/jsx-runtime',
      'preact/jsx-dev-runtime',
      'preact/debug'
    ]
  },
  resolve: {
    alias: {
      '@badawi/logic': path.resolve(__dirname, '../../packages/logic/src/index.ts')
    },
    dedupe: ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime', 'preact/jsx-dev-runtime', 'preact/debug']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', 'preact/hooks']
        }
      }
    }
  }
});