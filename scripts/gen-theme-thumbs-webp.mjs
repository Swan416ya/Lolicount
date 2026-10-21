// Convert the pre-rendered gallery thumbnail SVGs (cmd/gen-theme-thumbs)
// into card-sized WebP files, then remove the source SVGs.
//
// The gallery cards display thumbnails at max-h-24 (96px); the webp is
// rendered at 256px height (2.5x for retina) with aspect ratio preserved.
// The full-resolution SVGs average ~176KB (91MB across all themes), while
// the card-sized webp files land at a few KB each, so the SSG ships tiny
// images and the browser decodes them instantly.
//
// Pipeline trap (do not "simplify" back to feeding the svg straight into
// sharp): sharp's SVG loader (librsvg) cannot decode webp data URIs nested
// inside <image> elements — it silently paints a fully transparent canvas,
// and every thumb compresses to a ~200-byte blank. The generator embeds
// the theme's own webp bytes, so this script first decodes each embedded
// image, re-encodes it as lossless PNG, and swaps it back into the svg
// before rendering. Geometry (positions, nested <svg> viewBox mapping)
// stays in the svg so librsvg does the compositing; no text layers exist
// in thumbs because the generator renders with unshowFont=true.
//
// Usage (from repo root, after `go run ./cmd/gen-theme-thumbs`):
//   node scripts/gen-theme-thumbs-webp.mjs
//   node scripts/gen-theme-thumbs-webp.mjs --keep-svg   keep the .svg sources
//   node scripts/gen-theme-thumbs-webp.mjs --quality 80
//
// Stale .webp files without a matching .svg in the same directory are
// removed, mirroring the Go generator's cleanStale behavior.
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const THUMB_DIR = join(repoRoot, 'web/public/images/theme-thumbs');

// Card display height is 96px (max-h-24); render at 2.5x for retina.
const TARGET_HEIGHT = 256;

// A real 256px thumb never encodes below this; blank renders (~200B) do.
// Guards against the librsvg webp trap described above resurfacing.
const MIN_WEBP_BYTES = 500;

const CONCURRENCY = 8;

const args = process.argv.slice(2);
const keepSvg = args.includes('--keep-svg');
const qi = args.indexOf('--quality');
const quality = qi >= 0 ? Number(args[qi + 1]) : 85;
if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
  console.error('invalid --quality, expected 1-100');
  process.exit(1);
}

const list = (await readdir(THUMB_DIR)).sort();
const svgs = list.filter((f) => f.endsWith('.svg'));
if (svgs.length === 0) {
  console.error(`no .svg thumbs found in ${THUMB_DIR} — run: go run ./cmd/gen-theme-thumbs`);
  process.exit(1);
}

// Webp filenames that a full conversion produces; everything else in the
// directory is stale. Computed from the pristine svg list — the worker
// pool below consumes its own queue copy, never this array.
const expectedWebps = new Set(svgs.map((f) => f.replace(/\.svg$/, '.webp')));

let done = 0;
let bytesBefore = 0;
let bytesAfter = 0;
const errors = [];

const decodeDataUri = (uri) => Buffer.from(uri.replace(/^data:[^;]+;base64,/, ''), 'base64');

// Re-encode every embedded raster in the svg as lossless PNG, deduped by
// uri. Each image is pre-shrunk to TARGET_HEIGHT before re-encoding: the
// final render never exceeds that height, and full-res PNGs would blow
// past libxml2's per-text-node size limit inside the base64 attribute
// (e.g. manosaba-anan embeds a 2416x3507 render). The single-pass replace
// rebuilds each xlink:href in place; the svg is machine-generated
// (gen-theme-thumbs), so the element grammar is fixed.
const inlineRasterImages = async (svg) => {
  const uris = [...svg.matchAll(/xlink:href="(data:image\/[a-z]+;base64,[^"]+)"/g)].map((m) => m[1]);
  if (uris.length === 0) {
    throw new Error('no embedded data:image found — regenerate the svg sources');
  }
  const pngByUri = new Map();
  for (const uri of uris) {
    if (!pngByUri.has(uri)) {
      pngByUri.set(
        uri,
        await sharp(decodeDataUri(uri), { limit: 0 })
          .resize({ height: TARGET_HEIGHT, fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer(),
      );
    }
  }
  return svg.replace(/xlink:href="(data:image\/[a-z]+;base64,[^"]+)"/g, (m, uri) => {
    const png = pngByUri.get(uri);
    return png ? `xlink:href="data:image/png;base64,${png.toString('base64')}"` : m;
  });
};

// convert one svg to a card-sized webp (aspect preserved, alpha kept).
const convert = async (name) => {
  const svgPath = join(THUMB_DIR, name);
  const webpPath = join(THUMB_DIR, name.replace(/\.svg$/, '.webp'));
  const input = await readFile(svgPath, 'utf8');
  const svg = await inlineRasterImages(input);
  const out = await sharp(Buffer.from(svg), { limit: 0 })
    .resize({ height: TARGET_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  if (out.data.length < MIN_WEBP_BYTES) {
    throw new Error(`suspiciously small output (${out.data.length}B) — likely a blank render`);
  }
  await writeFile(webpPath, out.data);
  bytesBefore += Buffer.byteLength(input);
  bytesAfter += out.data.length;
};

// Fixed-size worker pool draining one shared queue (a copy, so the
// pristine `svgs` list stays intact for stale cleanup and svg removal).
const run = async (queue, workerId) => {
  while (queue.length > 0) {
    const name = queue.shift();
    try {
      await convert(name);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      continue;
    }
    done++;
    if (done % 100 === 0) console.log(`converted ${done}/${svgs.length}`);
    void workerId;
  }
};

const queue = [...svgs];
await Promise.all(Array.from({ length: CONCURRENCY }, () => run(queue)));

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  console.error(`${errors.length} conversion(s) failed`);
  process.exit(1);
}

// Remove webp files that are not backed by an svg in this run's set.
let removed = 0;
for (const f of list) {
  if (f.endsWith('.webp') && !expectedWebps.has(f)) {
    await unlink(join(THUMB_DIR, f));
    removed++;
  }
}

if (!keepSvg) {
  for (const f of svgs) await unlink(join(THUMB_DIR, f));
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(
  `converted ${done} thumb(s) to ${TARGET_HEIGHT}px webp (q${quality}): ` +
    `${mb(bytesBefore)}MB svg -> ${mb(bytesAfter)}MB webp` +
    (removed ? `, removed ${removed} stale webp(s)` : '') +
    (keepSvg ? ', kept svg sources' : ', removed svg sources'),
);
