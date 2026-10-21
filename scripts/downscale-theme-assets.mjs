// Downscale oversized theme art to the display envelope.
//
// The render pipeline lays every layer out in the theme's canvas
// coordinate space and maps the visible region to the ~400px display
// size, while the embedded bitmaps ship at their source resolution —
// up to 5313px for a 400px render, so a single view can carry 1.6MB.
// This script rescales themes whose VISIBLE region exceeds --target so
// the composed output keeps ~4x display detail (enough for the 1600px
// frame download) while the shipped bytes drop accordingly.
//
// Per theme:
// - character themes (ren.json present) scale UNIFORMLY: every
//   ren/*.webp, all ren.json left/top/width/height, config.json
//   canvasW/H and the canvas-space display.json crop move by the same
//   factor f, so parts stay aligned. f comes from the visible crop
//   region (falling back to the full canvas) so canvas margins don't
//   dilute the reduction. display.json `size` is output space and stays
//   untouched. Part rects are re-derived from the resized bitmap
//   headers by the loader, so the JSON scaling only has to keep the
//   coordinate system self-consistent.
// - frame themes scale per file: layout derives from each file's own
//   aspect ratio, so resizing is layout-safe.
//
// Files already within the target, non-webp images and animated webp
// (multi-page) files are left alone and reported. Dry-run by default;
// pass --write to apply.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const write = args.includes('--write');
const targetIdx = args.indexOf('--target');
const TARGET = targetIdx >= 0 ? Number(args[targetIdx + 1]) : 1600;
const QUALITY = 90;
const ALPHA_QUALITY = 90;
const ROOT = 'assets/theme';

if (!Number.isInteger(TARGET) || TARGET < 200) {
  console.error(`invalid --target: ${args[targetIdx + 1]} (expected integer >= 200)`);
  process.exit(1);
}

const sc = (v, f) => Math.max(1, Math.round(v * f));

async function fileLongestEdge(p) {
  const m = await sharp(p).metadata();
  return { long: Math.max(m.width, m.height), pages: m.pages ?? 1, w: m.width, h: m.height };
}

async function resizeTo(p, f) {
  const m = await sharp(p).metadata();
  const width = Math.max(1, Math.round(m.width * f));
  const out = sharp(p).resize({ width });
  await out.webp({ quality: QUALITY, alphaQuality: ALPHA_QUALITY }).toFile(p + '.tmp');
  fs.renameSync(p + '.tmp', p);
}

let themesScanned = 0, themesChanged = 0, bytesBefore = 0, bytesAfter = 0;
const skipped = [];

async function sizeOf(p) {
  return (await fs.promises.stat(p)).size;
}

for (const name of fs.readdirSync(ROOT).sort()) {
  const dir = path.join(ROOT, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  themesScanned++;
  const renJson = path.join(dir, 'ren.json');

  if (fs.existsSync(renJson)) {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    const displayPath = path.join(dir, 'display.json');
    const display = fs.existsSync(displayPath) ? JSON.parse(fs.readFileSync(displayPath, 'utf8')) : null;
    if (!cfg.canvasW || !cfg.canvasH) {
      skipped.push(`${name}: character theme without canvasW/H in config.json`);
      continue;
    }
    const crop = display?.crop;
    const visible = crop ? Math.max(crop.width, crop.height) : Math.max(cfg.canvasW, cfg.canvasH);
    const f = Math.min(1, TARGET / visible);
    if (f >= 1) continue;

    let before = 0, after = 0;
    const renDir = path.join(dir, 'ren');
    for (const file of fs.readdirSync(renDir)) {
      if (!file.endsWith('.webp')) { skipped.push(`${name}/ren/${file}: non-webp layer left as-is`); continue; }
      const p = path.join(renDir, file);
      const info = await fileLongestEdge(p);
      if (info.pages > 1) { skipped.push(`${name}/ren/${file}: animated webp left as-is`); continue; }
      const b = await sizeOf(p);
      if (!write) { before += b; after += Math.round(b * f * f); continue; }
      await resizeTo(p, f);
      const a = await sizeOf(p);
      before += b; after += a;
    }

    if (write) {
      const ren = JSON.parse(fs.readFileSync(renJson, 'utf8'));
      for (const layer of ren) {
        for (const k of ['left', 'top', 'width', 'height']) {
          if (typeof layer[k] === 'number') layer[k] = sc(layer[k], f);
        }
      }
      fs.writeFileSync(renJson, JSON.stringify(ren, null, 2) + '\n');
      cfg.canvasW = sc(cfg.canvasW, f);
      cfg.canvasH = sc(cfg.canvasH, f);
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
      if (display?.crop) {
        for (const k of ['left', 'top', 'width', 'height']) display.crop[k] = sc(display.crop[k], f);
        fs.writeFileSync(displayPath, JSON.stringify(display, null, 2) + '\n');
      }
    }
    themesChanged++;
    bytesBefore += before; bytesAfter += after;
    console.log(`${name}: f=${f.toFixed(3)} visible=${visible}px ren bytes ${before} -> ~${after}${write ? '' : ' (dry-run)'}`);
  } else {
    // frame theme: per-file factor, layout derives from each file's aspect
    let touched = false;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.webp')) { if (!file.startsWith('.')) skipped.push(`${name}/${file}: non-webp frame left as-is`); continue; }
      const p = path.join(dir, file);
      const info = await fileLongestEdge(p);
      if (info.pages > 1) { skipped.push(`${name}/${file}: animated webp left as-is`); continue; }
      const f = Math.min(1, TARGET / info.long);
      if (f >= 1) continue;
      const b = await sizeOf(p);
      let a = b;
      if (write) {
        await resizeTo(p, f);
        a = await sizeOf(p);
      } else {
        a = Math.round(b * f * f);
      }
      bytesBefore += b; bytesAfter += a;
      touched = true;
      console.log(`${name}/${file}: f=${f.toFixed(3)} ${info.w}x${info.h} ${b} -> ${a} bytes${write ? '' : ' (est.)'}`);
    }
    if (touched) themesChanged++;
  }
}

console.log(`\nthemes scanned: ${themesScanned}, themes touched: ${themesChanged}`);
if (write) {
  console.log(`bytes: ${bytesBefore} -> ${bytesAfter} (saved ${Math.round((bytesBefore - bytesAfter) / 1048576 * 10) / 10}MB)`);
}
if (skipped.length) console.log(`skipped:\n  ${skipped.join('\n  ')}`);
if (!write) console.log('\ndry-run: pass --write to apply');
