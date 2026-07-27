import { mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();

const staticAssets = [
  {
    source: 'public/el-triunfo-logo.png.png',
    output: 'public/el-triunfo-logo.webp',
    width: 900,
    quality: 90,
  },
];

async function convert({ source, output, width, quality = 86 }) {
  const sourcePath = join(root, source);
  const outputPath = join(root, output);

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(outputPath);
}

async function optimizeCatalogImages() {
  const publicDir = join(root, 'public');
  const files = await readdir(publicDir);
  const productImages = files.filter((file) => /^AB-.+\.png$/i.test(file));

  await Promise.all(
    productImages.map((file) =>
      convert({
        source: join('public', file),
        output: join('public', `${basename(file, extname(file))}.webp`),
        width: 720,
      }),
    ),
  );
}

await Promise.all(staticAssets.map(convert));
await optimizeCatalogImages();
