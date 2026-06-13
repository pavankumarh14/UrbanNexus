import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'suppress-ws-proxy-errors',
      configureServer(server) {
        // Vite's proxy middleware logs EPIPE/ECONNRESET through server.config.logger
        // after the server is initialised — patch it here, no createLogger import needed.
        const _error = server.config.logger.error.bind(server.config.logger);
        server.config.logger.error = (msg, opts) => {
          if (typeof msg === 'string' && msg.includes('ws proxy socket error')) return;
          _error(msg, opts);
        };

        // Also silence the raw TCP socket error on the upgrade path.
        server.httpServer?.on('upgrade', (_req, socket) => {
          socket.on('error', () => {});
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001',   ws: true },
    },
  },
});
