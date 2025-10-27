import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      util: 'util/',
      assert: 'assert/',
      buffer: 'buffer/',
    },
  },
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
});
