import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// GitHub Pages serves the site from /smart-roster/. Override with VITE_BASE_PATH
// if the repository is renamed or deployed elsewhere.
export default defineConfig({
    base: process.env.VITE_BASE_PATH || '/smart-roster/',
    plugins: [react()],
});
