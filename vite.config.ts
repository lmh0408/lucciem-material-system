import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { downloadSourceArchive } from './server/sourceDownload.mjs';
import { handleGoogleLedgerProxy } from './server/googleLedgerProxy.mjs';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'source-download-api',
        configureServer(server) {
          server.middlewares.use('/api/download-source', (request, response, next) => {
            downloadSourceArchive(request, response, next, process.cwd());
          });
          server.middlewares.use('/api/google-ledger', (request, response) => {
            handleGoogleLedgerProxy(request, response);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Security-Policy': "frame-ancestors 'self' https://*.google.com https://*.run.app https://aistudio.google.com;",
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
