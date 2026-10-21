// Split the two senren-mako themes by pose orientation.
//
// Both themes had mixed content: senren-mako held straight-front AND
// twisted/side poses, and senren-mako-b (the ninja-outfit set) mixed
// them too. Per the requested split:
//   - senren-mako  = front-facing poses (mako 1,2,4,5,6,7,8 + mako-b 1,2,3,4,5)
//   - senren-mako-b = side-leaning poses  (mako 3,9,10,11   + mako-b 6,7,8)
//
// The eye/expression ranges of each theme are positionally compatible
// with every body (both head positions coincide), so they stay put.
// senren-mako-b's face-blob (93) becomes its single blush overlay; the
// misaligned mask layers (94,95,96 — variant B rendered the mask offset
// on ~half of all draws) and the second blob are removed: the ninja
// bodies show their bare faces under the scarf, because a mask overlay
// range cannot be scoped to ninja bodies only under the flat
// one-candidate-per-range system (it would draw the cloth on normal
// outfits too). Display crops are recomputed from the kept layers.
//
// Dry-run by default; pass --write to apply.

import fs from 'node:fs';
import path from 'node:path';

const write = process.argv.includes('--write');
const ROOT = 'assets/theme';
const MAKO = path.join(ROOT, 'senren-mako');
const MAKOB = path.join(ROOT, 'senren-mako-b');

const frontMako = [1, 2, 4, 5, 6, 7, 8];
const frontMakoB = [1, 2, 3, 4, 5];
const sideMako = [3, 9, 10, 11];
const sideMakoB = [6, 7, 8];

const load = (dir) => ({
  cfg: JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')),
  display: JSON.parse(fs.readFileSync(path.join(dir, 'display.json'), 'utf8')),
  ren: JSON.parse(fs.readFileSync(path.join(dir, 'ren.json'), 'utf8')),
});
const mako = load(MAKO);
const makob = load(MAKOB);
const makoById = new Map(mako.ren.map(l => [l.layer_id, l]));
const makobById = new Map(makob.ren.map(l => [l.layer_id, l]));

const placeholder = { name: 'placeholder', left: 1, top: 1, width: 1, height: 1, visible: 1, layer_id: 0, group_layer_id: 0 };

// Build a theme body from layers in order: renumber ids from startId,
// copy ren/<old>.webp -> ren/<new>.webp (or delete when leaving).
function planBodies(layers, startId) {
  return layers.map((l, i) => ({ layer: l, newId: startId + i }));
}

function bbox(layers) {
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
  for (const l of layers) {
    minx = Math.min(minx, l.left); miny = Math.min(miny, l.top);
    maxx = Math.max(maxx, l.left + l.width); maxy = Math.max(maxy, l.top + l.height);
  }
  return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
}

// ---- senren-mako (front) ----
const makoFrontBodies = [
  ...frontMako.map(id => makoById.get(id)),
  ...frontMakoB.map(id => makobById.get(id)),
];
const makoEyes = mako.ren.filter(l => l.layer_id >= 12 && l.layer_id <= 95);
const makoFaces = mako.ren.filter(l => l.layer_id >= 96 && l.layer_id <= 97);
const makoNew = [placeholder, ...planBodies(makoFrontBodies, 1).map(p => ({ ...p.layer, layer_id: p.newId, group_layer_id: p.newId })),
  ...makoEyes.map((l, i) => ({ ...l, layer_id: 13 + i, group_layer_id: 13 + i })),
  ...makoFaces.map((l, i) => ({ ...l, layer_id: 97 + i, group_layer_id: 97 + i }))];
const makoCfg = {
  canvasW: mako.cfg.canvasW, canvasH: mako.cfg.canvasH,
  ranges: { lass: { first: 1, last: makoFrontBodies.length }, eye: { first: 13, last: 12 + makoEyes.length }, face: { first: 97, last: 98 } },
};
const makoCrop = bbox([...makoFrontBodies, ...makoEyes, ...makoFaces]);

// ---- senren-mako-b (side) ----
const makobSideBodies = [
  ...sideMakoB.map(id => makobById.get(id)),
  ...sideMako.map(id => makoById.get(id)),
];
const makobEyes = makob.ren.filter(l => l.layer_id >= 9 && l.layer_id <= 92);
const makobBlob = makob.ren.filter(l => l.layer_id === 93);
const makobNew = [placeholder, ...planBodies(makobSideBodies, 1).map(p => ({ ...p.layer, layer_id: p.newId, group_layer_id: p.newId })),
  ...makobEyes.map((l, i) => ({ ...l, layer_id: 8 + i, group_layer_id: 8 + i })),
  ...makobBlob.map((l, i) => ({ ...l, layer_id: 92 + i, group_layer_id: 92 + i }))];
const makobCfg = {
  canvasW: makob.cfg.canvasW, canvasH: makob.cfg.canvasH,
  ranges: { lass: { first: 1, last: makobSideBodies.length }, eye: { first: 8, last: 7 + makobEyes.length }, face: { first: 92, last: 92 } },
};
const makobCrop = bbox([...makobSideBodies, ...makobEyes, ...makobBlob]);

console.log('senren-mako (front):', makoFrontBodies.length, 'bodies,', makoEyes.length, 'eyes,', makoFaces.length, 'faces | crop', JSON.stringify(makoCrop));
console.log('senren-mako-b (side):', makobSideBodies.length, 'bodies,', makobEyes.length, 'eyes,', makobBlob.length, 'blob | crop', JSON.stringify(makobCrop));

// File operation plan: (srcTheme, srcId, dstTheme, dstId) — copied then
// sources pruned.
const fileOps = [];
for (const [i, id] of frontMako.entries()) fileOps.push({ from: path.join(MAKO, 'ren', id + '.webp'), to: path.join(MAKO, 'ren', (1 + i) + '.webp') });
for (const [i, id] of frontMakoB.entries()) fileOps.push({ from: path.join(MAKOB, 'ren', id + '.webp'), to: path.join(MAKO, 'ren', (1 + frontMako.length + i) + '.webp') });
for (const [i, l] of makoEyes.entries()) fileOps.push({ from: path.join(MAKO, 'ren', l.layer_id + '.webp'), to: path.join(MAKO, 'ren', (13 + i) + '.webp') });
for (const [i, l] of makoFaces.entries()) fileOps.push({ from: path.join(MAKO, 'ren', l.layer_id + '.webp'), to: path.join(MAKO, 'ren', (97 + i) + '.webp') });
for (const [i, id] of sideMakoB.entries()) fileOps.push({ from: path.join(MAKOB, 'ren', id + '.webp'), to: path.join(MAKOB, 'ren', (1 + i) + '.webp') });
for (const [i, id] of sideMako.entries()) fileOps.push({ from: path.join(MAKO, 'ren', id + '.webp'), to: path.join(MAKOB, 'ren', (1 + sideMakoB.length + i) + '.webp') });
for (const [i, l] of makobEyes.entries()) fileOps.push({ from: path.join(MAKOB, 'ren', l.layer_id + '.webp'), to: path.join(MAKOB, 'ren', (8 + i) + '.webp') });
for (const [i, l] of makobBlob.entries()) fileOps.push({ from: path.join(MAKOB, 'ren', l.layer_id + '.webp'), to: path.join(MAKOB, 'ren', (92 + i) + '.webp') });

// Files that end up unused: mako-b blob 94, masks 95/96, and every source
// file whose layer left its theme (bodies moved across themes).
const keepMako = new Set(fileOps.filter(o => o.to.startsWith(MAKO)).map(o => o.to));
const keepMakoB = new Set(fileOps.filter(o => o.to.startsWith(MAKOB)).map(o => o.to));
const remove = [];
for (const id of [...mako.ren.map(l => l.layer_id), ...makob.ren.map(l => l.layer_id)]) {
  for (const dir of [MAKO, MAKOB]) {
    const p = path.join(dir, 'ren', id + '.webp');
    if (!fs.existsSync(p)) continue;
    const kept = dir === MAKO ? keepMako.has(p) : keepMakoB.has(p);
    if (!kept) remove.push(p);
  }
}

console.log('file ops:', fileOps.length, '| files removed:', remove.length);
if (write) {
  // Two-phase to avoid id collisions (e.g. mako 4.webp -> 2.webp while
  // 2.webp is itself a move source): stage every op through a temp name.
  const staged = [];
  for (const [i, op] of fileOps.entries()) {
    const tmp = op.to + '.split-tmp';
    fs.copyFileSync(op.from, tmp);
    staged.push({ tmp, to: op.to, from: op.from });
  }
  for (const op of fileOps) if (fs.existsSync(op.from)) fs.rmSync(op.from);
  for (const s of staged) { fs.rmSync(s.to, { force: true }); fs.renameSync(s.tmp, s.to); }
  for (const p of remove) if (fs.existsSync(p)) fs.rmSync(p);

  fs.writeFileSync(path.join(MAKO, 'ren.json'), JSON.stringify(makoNew, null, 2) + '\n');
  fs.writeFileSync(path.join(MAKO, 'config.json'), JSON.stringify(makoCfg, null, 2) + '\n');
  const makoDisplay = { size: mako.display.size, crop: { left: makoCrop.x, top: makoCrop.y, width: makoCrop.w, height: makoCrop.h } };
  fs.writeFileSync(path.join(MAKO, 'display.json'), JSON.stringify(makoDisplay, null, 2) + '\n');

  fs.writeFileSync(path.join(MAKOB, 'ren.json'), JSON.stringify(makobNew, null, 2) + '\n');
  fs.writeFileSync(path.join(MAKOB, 'config.json'), JSON.stringify(makobCfg, null, 2) + '\n');
  const makobDisplay = { size: makob.display.size, crop: { left: makobCrop.x, top: makobCrop.y, width: makobCrop.w, height: makobCrop.h } };
  fs.writeFileSync(path.join(MAKOB, 'display.json'), JSON.stringify(makobDisplay, null, 2) + '\n');
  console.log('applied');
} else {
  console.log('dry-run: pass --write to apply');
}
