/// <reference types="node" />
import {VitePWA} from 'vite-plugin-pwa'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const httpsConfig =
    mode === 'https'
      ? {
          https: {
            key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
          },
        }
      : {}

  return {
    base: './',
    server: {
      ...httpsConfig,
      proxy: {
        '/api': {
          target: 'http://localhost:5100',
          rewrite: (path) => path.replace(/^\/api/, ''),
          changeOrigin: true,
          secure: mode === 'https',
        },
        '/socket.io': {
          target: 'http://localhost:5100',
          changeOrigin: true,
          secure: mode === 'https',
          ws: true,
        },
      },
    },
    define: {
      ENV_GIT_COMMIT: JSON.stringify(process.env.RENDER_GIT_COMMIT ?? 'unknown'),
    },
    build: {
      outDir: 'dist',
    },
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', {}]],
        },
      }),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: false,

        pwaAssets: {
          disabled: false,
          config: true,
        },

        manifest: {
          name: 'ciphernotes',
          short_name: 'ciphernotes',
          description:
            'A local-first note-taking app with end-to-end encryption for your private thoughts and data.',
          theme_color: '#1864ab',
          background_color: '#000000',
          icons: [
            {
              src: '/web-app-manifest-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/web-app-manifest-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },

        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,txt}'],
        },

        devOptions: {
          enabled: false,
          navigateFallback: 'index.html',
          suppressWarnings: true,
          type: 'module',
        },
      }),
    ],
  }
})
