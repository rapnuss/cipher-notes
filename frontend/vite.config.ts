/// <reference types="node" />
import {VitePWA} from 'vite-plugin-pwa'
import {defineConfig, type Plugin} from 'vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import {comlink} from 'vite-plugin-comlink'
import {createRequire} from 'module'
import {licensePlugin} from 'rolldown-license-plugin'
import fs from 'fs'
import path from 'path'
import {licensesTemplate, type LicenseDependency} from './licensesTemplate'

const isDev = process.env.NODE_ENV === 'development'
const isPreview = process.env.PREVIEW === 'true'
const require = createRequire(import.meta.url)
const collectedLicenses = new Map<string, LicenseDependency>()

type RolldownLicenseInfo = {
  name: string
  version: string
  license: string
  licenseText: string
}

type PackageManifest = {
  private?: boolean
  description?: string
  repository?: string | {url?: string}
  author?: string | {name?: string; email?: string}
}

const loadLicenseDependency = (dependency: RolldownLicenseInfo): LicenseDependency => {
  try {
    const packagePath = require.resolve(`${dependency.name}/package.json`)
    const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageManifest
    const author = typeof manifest.author === 'string' ? {name: manifest.author} : manifest.author

    return {
      ...dependency,
      private: manifest.private,
      description: manifest.description,
      repository:
        typeof manifest.repository === 'string' ? manifest.repository
        : typeof manifest.repository === 'object' ? manifest.repository?.url
        : '',
      author,
    }
  } catch {
    return dependency
  }
}

const collectLicenses = (dependencies: RolldownLicenseInfo[]) => {
  for (const dependency of dependencies) {
    const hydratedDependency = loadLicenseDependency(dependency)
    collectedLicenses.set(
      `${hydratedDependency.name}@${hydratedDependency.version}`,
      hydratedDependency,
    )
  }
}

const writeLicensesFilePlugin = (): Plugin => ({
  name: 'write-licenses-file',
  apply: 'build',
  sharedDuringBuild: true,
  buildStart() {
    collectedLicenses.clear()
  },
  closeBundle() {
    const outputPath = path.resolve(__dirname, 'dist/licenses.html')
    fs.mkdirSync(path.dirname(outputPath), {recursive: true})
    fs.writeFileSync(
      outputPath,
      licensesTemplate(
        [...collectedLicenses.values()].sort((left, right) => left.name.localeCompare(right.name)),
      ),
    )
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: true,
    https: {
      key: isDev || isPreview ? fs.readFileSync(path.resolve(__dirname, 'key.pem')) : undefined,
      cert: isDev || isPreview ? fs.readFileSync(path.resolve(__dirname, 'cert.pem')) : undefined,
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
    ENV_HOSTING_MODE: JSON.stringify(process.env.HOSTING_MODE ?? 'central'),
    ENV_HCAPTCHA_SITE_KEY: JSON.stringify(process.env.HCAPTCHA_SITE_KEY ?? ''),
    ENV_API_URL: JSON.stringify(process.env.API_URL ?? '/api'),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 9999999999999,
    rolldownOptions: {
      plugins: [
        licensePlugin({
          done(dependencies) {
            collectLicenses(dependencies)
          },
        }),
      ],
    },
  },
  plugins: [
    writeLicensesFilePlugin(),
    comlink(),
    react(),
    babel({presets: [reactCompilerPreset()]}),
    VitePWA({
      strategies: 'injectManifest',
      includeAssets: ['robots.txt', 'sitemap.xml'],
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,

      pwaAssets: {
        disabled: true,
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
