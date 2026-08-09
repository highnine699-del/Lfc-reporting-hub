/**
 * Generates pwa-192x192.png, pwa-512x512.png, and apple-touch-icon.png
 * from public/favicon.svg using the @resvg/resvg-js package.
 *
 * Run: node scripts/generate-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'favicon.svg');
const svg = readFileSync(svgPath, 'utf8');

const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(255,255,255,1)',
  });
  const png = resvg.render().asPng();
  const outPath = join(root, 'public', name);
  writeFileSync(outPath, png);
  console.log(`✓ ${name} (${size}x${size})`);
}

console.log('Done.');
