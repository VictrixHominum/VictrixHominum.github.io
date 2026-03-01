import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_GITHUB_CLIENT_ID': JSON.stringify(
      process.env.VITE_GITHUB_CLIENT_ID || ''
    ),
    'import.meta.env.VITE_OAUTH_WORKER_URL': JSON.stringify(
      process.env.VITE_OAUTH_WORKER_URL || ''
    ),
    'import.meta.env.VITE_GITHUB_OWNER': JSON.stringify(
      process.env.VITE_GITHUB_OWNER || 'VictrixHominum'
    ),
    'import.meta.env.VITE_GITHUB_REPO': JSON.stringify(
      process.env.VITE_GITHUB_REPO || 'VictrixHominum.github.io'
    ),
  },
});