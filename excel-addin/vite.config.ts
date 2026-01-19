import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'fs';
import path from 'path';

const certDir = path.join(process.env.USERPROFILE || '', '.office-addin-dev-certs');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    strictPort: true,
    https: {
      key: fs.readFileSync(path.join(certDir, 'localhost.key')),
      cert: fs.readFileSync(path.join(certDir, 'localhost.crt')),
    },
    hmr: false, // Disable HMR completely for Office Add-ins
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  base: './',
});
