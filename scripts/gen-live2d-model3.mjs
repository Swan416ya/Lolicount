// Generates a Cubism 3 .model3.json manifest for a raw BanG Dream model dir
// (which ships .moc + physics.json + textures/ + motions/ + expressions/ but
// NO .model3.json). Scans the dir and emits the manifest the
// untitled-pixi-live2d-engine expects (FileReferences + Motions + Expressions).
//
// Usage: node gen-model3.mjs <modelDir> <modelDirName> <outFile>
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const [modelDir, modelDirName, outFile] = process.argv.slice(2);
if (!modelDir) { console.error('usage: node gen-model3.mjs <modelDir> <modelDirName> <outFile>'); process.exit(1); }

function list(dir, pred = () => true) {
  try {
    return readdirSync(dir)
      .filter(n => { const p = join(dir, n); return pred(n) && statSync(p).isFile(); })
      .sort();
  } catch { return []; }
}

// .moc file (Cubism 3) — the first .moc in the model dir
const mocs = list(modelDir, n => n.endsWith('.moc'));
if (!mocs.length) { console.error('no .moc found in', modelDir); process.exit(1); }
const moc = mocs[0];
const mocBase = moc.replace(/\.moc$/, '');

// textures: textures/texture_NN.png, sorted so index order is stable
const texDir = join(modelDir, 'textures');
const textures = list(texDir, n => /\.(png|jpg|jpeg)$/.test(n)).map(n => 'textures/' + n);

// physics
const physics = list(modelDir, n => n.endsWith('.physics.json')).map(n => n)[0] || null;

// motions: motions/*.mtn grouped by prefix (idle, smile, ...) — the BD models
// name them <group><NN>.mtn, so the group is the name minus the trailing NN.
const motionFiles = list(join(modelDir, 'motions'), n => n.endsWith('.mtn')).map(n => 'motions/' + n);
// group by the part before the trailing "NN" digits (e.g. idle01 -> idle)
const groups = {};
for (const f of motionFiles) {
  const base = f.split('/').pop().replace(/\.mtn$/, '');
  const g = base.replace(/_\d+$/, '').replace(/\d+$/, '') || base;
  (groups[g] = groups[g] || []).push({ File: f, Name: base });
}

// expressions: expressions/*.exp.json
const expressions = list(join(modelDir, 'expressions'), n => n.endsWith('.exp.json'))
  .map(n => ({ Name: n.replace(/\.exp\.json$/, ''), File: 'expressions/' + n }));

const setting = {
  Version: 3,
  FileReferences: {
    Moc: moc,
    Textures: textures,
    Physics: physics,
    Pose: null,
    DisplayInfo: null,
    Layout: null,
    Group: null,
    Background: null,
  },
  Groups: [
    { Target: 'Parameter', Name: 'LipSync', Ids: ['PARAM_MOUTH_OPEN_Y'] },
  ],
  Motions: Object.fromEntries(Object.entries(groups).map(([g, items]) => [g, items])),
  Expressions: expressions,
};

writeFileSync(outFile, JSON.stringify(setting, null, 2));
console.log('wrote', outFile);
console.log('  moc:', moc, 'textures:', textures.length, 'motions:', Object.keys(groups).length, 'expr:', expressions.length, 'physics:', physics);
