/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works under any GitHub Pages path (/Chess/ or a custom domain).
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Opening Trainer',
        short_name: 'Openings',
        description: 'Build your opening repertoire and drill it with spaced repetition.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1f1d1a',
        theme_color: '#1f1d1a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
