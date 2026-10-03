// Builds dist/models/body-{male,female}.bin from MakeHuman CC0 assets
// (https://github.com/makehumancommunity/makehuman, makehuman/data):
//   3dobjs/base.obj
//   targets/macrodetails/{caucasian,african,asian}-{male,female}-young.target
//   targets/macrodetails/universal-{male,female}-young-{min,average,max}muscle-{min,average,max}weight.target
//   targets/armslegs/{l,r}-{upperarm,lowerarm,upperleg,lowerleg}-{fat,muscle}-{decr,incr}.target
//   targets/armslegs/{l,r}-upperarm-shoulder-muscle-{decr,incr}.target
//   targets/torso/torso-muscle-{dorsi,pectoral}-{decr,incr}.target
//   targets/stomach/stomach-{pregnant,tone}-{decr,incr}.target
//   targets/measure/measure-{bust,waist,hips,upperarm,thigh,calf}-circ-{decr,incr}.target
//   targets/measure/measure-shoulder-dist-{decr,incr}.target
// Usage: node scripts/build-body-models.mjs <folder with those files>
//
// Output format (little endian, 4-byte aligned):
//   'BMB2', vertexCount u32, indexCount u32, targetCount u32
//   positions f32[n*3] (base mesh with the sex/age macro applied, MakeHuman units)
//   segments u8[n] (0 trunk, 1 left arm, 2 right arm, 3 left leg, 4 right leg, 5 head)
//   indices u16[indexCount]
//   per target: muscle u32 (0 min, 2 max), weight u32 (0 min, 2 max), count u32,
//               vertex u16[count], delta i16[count*3] (units of 0.001)
//   localCount u32, then per local target: nameLength u32, name (ASCII, padded), count u32,
//               vertex u16[count], delta i16[count*3]
//   'ANAT', region u8[n], fibre direction i8[n*3], flags u8[n] (see scripts/body-anatomy.mjs)
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {muscleMap} from './body-anatomy.mjs';

const src = process.argv[2];
if (!src) throw Error('usage: node scripts/build-body-models.mjs <makehuman data folder>');
const lines = readFileSync(join(src, 'base.obj'), 'utf8').split('\n');
const verts = [], bodyFaces = [], groups = new Map();
let group = '';
for (const line of lines) {
  if (line.startsWith('v ')) verts.push(line.split(/\s+/).slice(1, 4).map(Number));
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) {
    const idx = line.split(/\s+/).slice(1).filter(Boolean).map(t => Number(t.split('/')[0]) - 1);
    if (group === 'body') bodyFaces.push(idx);
    if (!groups.has(group)) groups.set(group, new Set());
    for (const i of idx) groups.get(group).add(i);
  }
}
const readTarget = name => {
  const map = new Map();
  for (const line of readFileSync(join(src, name), 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [i, x, y, z] = line.trim().split(/\s+/).map(Number);
    map.set(i, [x, y, z]);
  }
  return map;
};

// Keep only vertices used by the body group, reindexed.
const used = [...new Set(bodyFaces.flat())].sort((a, b) => a - b);
const remap = new Map(used.map((v, i) => [v, i]));
const indices = [];
for (const f of bodyFaces) for (let k = 1; k + 1 < f.length; k++) indices.push(remap.get(f[0]), remap.get(f[k]), remap.get(f[k + 1]));
if (used.length > 65535) throw Error('too many vertices for u16 indices');

for (const sex of ['male', 'female']) {
  // Sex/age macro: average of the three ethnic targets (MakeHuman's default 1/3 each).
  const full = verts.map(v => v.slice());
  for (const ethnic of ['caucasian', 'african', 'asian'])
    for (const [i, d] of readTarget(`${ethnic}-${sex}-young.target`)) for (let a = 0; a < 3; a++) full[i][a] += d[a] / 3;

  const centroid = name => { const ids = [...groups.get(name)]; return [0, 1, 2].map(a => ids.reduce((s, i) => s + full[i][a], 0) / ids.length); };
  const J = n => centroid('joint-' + n);
  const chains = [
    [0, ['pelvis', 'spine-4', 'spine-3', 'spine-2', 'spine-1', 'neck'].map(J)],
    [1, ['l-shoulder', 'l-elbow', 'l-hand', 'l-hand-3'].map(J)],
    [2, ['r-shoulder', 'r-elbow', 'r-hand', 'r-hand-3'].map(J)],
    [3, ['l-upper-leg', 'l-knee', 'l-ankle', 'l-foot-2'].map(J)],
    [4, ['r-upper-leg', 'r-knee', 'r-ankle', 'r-foot-2'].map(J)],
  ];
  const neckY = J('neck')[1], hipY = (J('l-upper-leg')[1] + J('r-upper-leg')[1]) / 2;
  const segDist = (p, a, b) => { const ab = b.map((v, k) => v - a[k]), ap = p.map((v, k) => v - a[k]); const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return Math.hypot(...ap.map((v, k) => v - t * ab[k])); };
  const chainDist = (p, pts) => { let d = Infinity; for (let k = 0; k + 1 < pts.length; k++) d = Math.min(d, segDist(p, pts[k], pts[k + 1])); return d; };

  const n = used.length, positions = new Float32Array(n * 3), segments = new Uint8Array(n);
  used.forEach((v, i) => {
    const p = full[v]; positions.set(p, i * 3);
    if (p[1] > neckY + 0.15) { segments[i] = 5; return; }
    let best = 0, bestD = Infinity;
    for (const [id, pts] of chains) {
      if (id >= 3 && p[1] > hipY + 0.3) continue; // legs only below the hips
      const d = chainDist(p, pts) * (id === 0 ? 0.55 : 1); // the trunk is wide: favour it
      if (d < bestD) { bestD = d; best = id; }
    }
    segments[i] = best;
  });

  const targets = [];
  for (const [m, mName] of [[0, 'minmuscle'], [1, 'averagemuscle'], [2, 'maxmuscle']])
    for (const [w, wName] of [[0, 'minweight'], [1, 'averageweight'], [2, 'maxweight']]) {
      if (m === 1 && w === 1) continue;
      const t = readTarget(`universal-${sex}-young-${mName}-${wName}.target`), ids = [], deltas = [];
      for (const [i, d] of t) if (remap.has(i)) { ids.push(remap.get(i)); deltas.push(...d.map(x => Math.round(x * 1000))); }
      targets.push({m, w, ids, deltas});
    }

  // Local shape targets (same for both sexes), applied per body segment at runtime.
  const locals = [];
  for (const side of ['l', 'r']) {
    for (const part of ['upperarm', 'lowerarm', 'upperleg', 'lowerleg']) for (const kind of ['fat', 'muscle']) for (const dir of ['decr', 'incr']) locals.push(`${side}-${part}-${kind}-${dir}`);
    for (const dir of ['decr', 'incr']) locals.push(`${side}-upperarm-shoulder-muscle-${dir}`);
  }
  for (const m of ['dorsi', 'pectoral']) for (const dir of ['decr', 'incr']) locals.push(`torso-muscle-${m}-${dir}`);
  for (const m of ['pregnant', 'tone']) for (const dir of ['decr', 'incr']) locals.push(`stomach-${m}-${dir}`);
  for (const m of ['bust', 'waist', 'hips', 'upperarm', 'thigh', 'calf']) for (const dir of ['decr', 'incr']) locals.push(`measure-${m}-circ-${dir}`);
  for (const dir of ['decr', 'incr']) locals.push(`measure-shoulder-dist-${dir}`);
  const localTargets = locals.map(name => {
    const ids = [], deltas = [];
    for (const [i, d] of readTarget(name + '.target')) if (remap.has(i)) { ids.push(remap.get(i)); deltas.push(...d.map(x => Math.round(x * 1000))); }
    return {name, ids, deltas};
  });

  const pad = len => (len + 3) & ~3;
  let size = 16 + n * 12 + pad(n) + pad(indices.length * 2);
  for (const t of targets) size += 12 + pad(t.ids.length * 2) + pad(t.deltas.length * 2);
  const anatomy = muscleMap({positions, indices, segments, J});
  size += 4;
  for (const t of localTargets) size += 8 + pad(t.name.length) + pad(t.ids.length * 2) + pad(t.deltas.length * 2);
  size += 4 + pad(n) + pad(n * 3) + pad(n);
  const buf = new ArrayBuffer(size), view = new DataView(buf);
  let o = 0;
  new Uint8Array(buf, 0, 4).set([66, 77, 66, 50]); o = 4; // 'BMB2'
  for (const v of [n, indices.length, targets.length]) { view.setUint32(o, v, true); o += 4; }
  new Float32Array(buf, o, n * 3).set(positions); o += n * 12;
  new Uint8Array(buf, o, n).set(segments); o += pad(n);
  new Uint16Array(buf, o, indices.length).set(indices); o += pad(indices.length * 2);
  for (const t of targets) {
    for (const v of [t.m, t.w, t.ids.length]) { view.setUint32(o, v, true); o += 4; }
    new Uint16Array(buf, o, t.ids.length).set(t.ids); o += pad(t.ids.length * 2);
    new Int16Array(buf, o, t.deltas.length).set(t.deltas); o += pad(t.deltas.length * 2);
  }
  view.setUint32(o, localTargets.length, true); o += 4;
  for (const t of localTargets) {
    view.setUint32(o, t.name.length, true); o += 4;
    new Uint8Array(buf, o, t.name.length).set([...t.name].map(c => c.charCodeAt(0))); o += pad(t.name.length);
    view.setUint32(o, t.ids.length, true); o += 4;
    new Uint16Array(buf, o, t.ids.length).set(t.ids); o += pad(t.ids.length * 2);
    new Int16Array(buf, o, t.deltas.length).set(t.deltas); o += pad(t.deltas.length * 2);
  }
  new Uint8Array(buf, o, 4).set([65, 78, 65, 84]); o += 4; // 'ANAT'
  new Uint8Array(buf, o, n).set(anatomy.region); o += pad(n);
  new Int8Array(buf, o, n * 3).set(anatomy.fiber); o += pad(n * 3);
  new Uint8Array(buf, o, n).set(anatomy.flags); o += pad(n);
  if (o !== size) throw Error(`size mismatch ${o} != ${size}`);
  mkdirSync('dist/models', {recursive: true});
  writeFileSync(`dist/models/body-${sex}.bin`, new Uint8Array(buf));
  const counts = [0, 0, 0, 0, 0, 0]; for (const s of segments) counts[s]++;
  console.log(sex, {vertices: n, triangles: indices.length / 3, targets: targets.length, locals: localTargets.length, regions: anatomy.regions, bytes: size, segments: counts});
}
