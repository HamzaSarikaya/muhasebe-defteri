import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BookOpen} from 'lucide-react';
import sharp from 'sharp';

// Reuse the application's Lucide mark, keeping all content inside the maskable safe zone.
const mark = renderToStaticMarkup(createElement(BookOpen, {
  x: 144, y: 144, width: 224, height: 224, color: '#f8fafc', strokeWidth: 1.75
}));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b0f17"/>${mark}</svg>`;
await mkdir(new URL('../public/icons/', import.meta.url), {recursive: true});
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)));
}
await writeFile(new URL('../public/icons/mark.svg', import.meta.url), svg);
