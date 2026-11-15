import { cp, mkdir } from 'node:fs/promises';
const folders = ['brand', 'fonts', 'icons', 'catalog/photos', 'catalog/thumbs'];
for (const folder of folders) {
  await mkdir(`public/media/${folder}`, { recursive: true });
  await cp(`assets/${folder}`, `public/media/${folder}`, { recursive: true });
}
console.log('Local brand assets and product photographs are ready.');
