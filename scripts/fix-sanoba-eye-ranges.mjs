// Repair pass for the sanoba eye-range fix.
//
// The first pass removed non-eye layers (accessory / blush / clothing
// fragments) from the eye ranges but only deleted their manifest
// entries — and the character loader slices the manifest ARRAY by range
// ids, i.e. it assumes layer_id == manifest index with contiguous ids.
// Deleting entries shifted every later layer_id off its array index, so
// meguru / nao / tsumugi eye (and face) ranges fell outside
// len(manifest) and were skipped wholesale: renders showed a bare body.
//
// This pass renumbers every sanoba theme back to contiguous ids
// (placeholder 0, lass, eye, face in manifest order), renames the webp
// files to match, and recomputes the lass/eye/face ranges by category
// counts. Idempotent: themes already contiguous are skipped.

import fs from 'node:fs';

const themes = fs.readdirSync('assets/theme').filter(d => d.startsWith('sanoba-'));
let repaired = 0;

for (const theme of themes) {
  const dir = `assets/theme/${theme}`;
  const cfg = JSON.parse(fs.readFileSync(`${dir}/config.json`, 'utf8'));
  const ren = JSON.parse(fs.readFileSync(`${dir}/ren.json`, 'utf8'));

  const contiguous = ren.every((l, i) => l.layer_id === i);
  if (contiguous) continue;

  // Sanity: after the first pass only eye-range entries were removed, so
  // the ids must be strictly increasing — otherwise bail out loudly.
  for (let i = 1; i < ren.length; i++) {
    if (ren[i].layer_id <= ren[i - 1].layer_id) {
      console.error(`${theme}: unexpected non-increasing ids, aborting`);
      process.exit(1);
    }
  }

  // Renumber in manifest order, renaming files through a two-phase pass
  // (all copies to <id>.webp.renumber first, then swap over the old
  // names, so a target id that equals another source id can't clobber).
  const staged = [];
  ren.forEach((l, newId) => {
    const oldId = l.layer_id;
    l.layer_id = newId;
    l.group_layer_id = newId;
    if (oldId !== newId) {
      const src = `${dir}/ren/${oldId}.webp`;
      const tmp = `${dir}/ren/${newId}.webp.renumber`;
      fs.copyFileSync(src, tmp);
      staged.push({ src, tmp, dst: `${dir}/ren/${newId}.webp` });
    }
  });

  // Category counts by entry name prefix, in manifest order.
  const count = pre => ren.filter(l => l.name.startsWith(pre)).length;
  const lassN = count('lass');
  const eyeN = count('eye');
  const faceN = count('face');
  cfg.ranges = {
    lass: { first: 1, last: lassN },
    eye: { first: 1 + lassN, last: lassN + eyeN },
    ...(faceN > 0 ? { face: { first: 1 + lassN + eyeN, last: lassN + eyeN + faceN } } : {}),
  };

  if (process.argv.includes('--write')) {
    for (const s of staged) {
      fs.rmSync(s.dst, { force: true });
      fs.renameSync(s.tmp, s.dst);
    }
    fs.writeFileSync(`${dir}/ren.json`, JSON.stringify(ren, null, 2) + '\n');
    fs.writeFileSync(`${dir}/config.json`, JSON.stringify(cfg, null, 2) + '\n');
    console.log(`${theme}: renumbered to ${ren.length} contiguous ids; ranges ${JSON.stringify(cfg.ranges)}`);
    repaired++;
  } else {
    console.log(`${theme}: needs renumber (${ren.length} ids), ranges would be ${JSON.stringify(cfg.ranges)}`);
  }
}
if (process.argv.includes('--write')) console.log(`repaired: ${repaired}`);
else console.log('dry-run: pass --write to apply');
