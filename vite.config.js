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
});
