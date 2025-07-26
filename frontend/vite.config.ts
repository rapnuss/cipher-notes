/// <reference types="node" />
import {VitePWA} from 'vite-plugin-pwa'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {comlink} from 'vite-plugin-comlink'
import license from 'rollup-plugin-license'
import fs from 'fs'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  server: {
    https: {
      key: isDev ? fs.readFileSync(path.resolve(__dirname, 'key.pem')) : undefined,
      cert: isDev ? fs.readFileSync(path.resolve(__dirname, 'cert.pem')) : undefined,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5100',
        rewrite: (path) => path.replace(/^\/api/, ''),
        changeOrigin: true,
        secure: true,
      },
      '/socket.io': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
  define: {
    ENV_GIT_COMMIT: JSON.stringify(process.env.RENDER_GIT_COMMIT ?? 'unknown'),
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      plugins: [
        license({
          thirdParty: {
            output: {
              file: 'dist/licenses.html',
              template: (dependencies) => `
<html lang="en">
<head>
  <title>Third Party Licenses - ciphernotes</title>
  <meta charset="utf-8">
  <style>
    html {
      font-family: sans-serif;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <nav><a href="/">Back to the app</a></nav>
  <h1>Third Party Licenses - ciphernotes</h1>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Version</th>
          <th>License</th>
          <th>Private</th>
          <th>Description</th>
          <th>Repository</th>
          <th>Author</th>
          <th>License Copyright</th>
        </tr>
      </thead>
      <tbody>
        ${dependencies
          .map(
            (dep) => `
              <tr>
                <td>${dep.name}</td>
                <td>${dep.version}</td>
                <td>${dep.license}</td>
                <td>${dep.private}</td>
                <td>${dep.description}</td>
                <td>${dep.repository}</td>
                <td>${dep.author}</td>
                <td><pre>${dep.licenseText}</pre></td>
              </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`,
            },
          },
        }) as any,
      ],
    },
  },
  plugins: [
    comlink(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    VitePWA({
      strategies: 'injectManifest',
      includeAssets: ['robots.txt', 'sitemap.xml'],
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
          'A end-to-end encrypted note taking alternative to Google Keep. Offline and cloud synchronized.',
        theme_color: '#1864ab',
        background_color: '#000000',
        icons: [
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/se (0).png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/screenshots/se (1).png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/screenshots/se (2).png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/screenshots/se (3).png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/screenshots/se (4).png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/screenshots-wide/1200p (0).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (1).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (2).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (3).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (4).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (5).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (6).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: '/screenshots-wide/1200p (7).png',
            sizes: '1600x1200',
            type: 'image/png',
            form_factor: 'wide',
          },
        ],
      },

      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,xml}'],
      },

      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    }),
  ],
  worker: {
    plugins: () => [comlink()],
  },
})
