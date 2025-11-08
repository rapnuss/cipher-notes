#!/usr/bin/env node

/**
 * Copies the built frontend assets into the TWA project so they can be bundled
 * directly with the Android wrapper (e.g. for an offline build).
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const distDir = join(frontendRoot, 'dist');
const twaAssetsDir = resolve(frontendRoot, '..', 'twa', 'app', 'src', 'main', 'assets', 'www');

if (!existsSync(distDir)) {
  console.error('dist/ was not found. Run `yarn build` first to generate the frontend bundle.');
  process.exit(1);
}

// Ensure the destination exists and is clean.
rmSync(twaAssetsDir, { recursive: true, force: true });
mkdirSync(twaAssetsDir, { recursive: true });

cpSync(distDir, twaAssetsDir, { recursive: true });

console.log(`Copied ${distDir} -> ${twaAssetsDir}`);
