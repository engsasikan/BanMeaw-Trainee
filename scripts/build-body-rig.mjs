// Builds dist/models/body-rig.bin: a 17-bone skeleton and skin weights for the body models,
// reduced from MakeHuman's CC0 default rig (makehuman/data/rigs/default.mhskel + default_weights.mhw).
// Usage: node scripts/build-body-rig.mjs <makehuman/data folder>
//
// Joints follow the person's own shape at runtime: each joint is stored as a set of nearby body
// vertices plus an offset from their centroid (in units of body height).
// Output (little endian, 4-byte aligned):
//   'RIG1', boneCount u32, vertexCount u32
//   per bone: parent i32 (-1 root), nameLength u32, name (ASCII, padded), ringCount u32, ring u16[ringCount] (padded), offset f32[3]
//   bone index u8[n*4], weight u8[n*4] (0..255, sums to ~255)
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const data = process.argv[2];
if (!data) throw Error('usage: node scripts/build-body-rig.mjs <makehuman/data folder>');
const skel = JSON.parse(readFileSync(join(data, 'rigs/default.mhskel'), 'utf8'));
const mhw = JSON.parse(readFileSync(join(data, 'rigs/default_weights.mhw'), 'utf8')).weights;

// Same vertex selection as build-body-models.mjs: vertices used by the 'body' group, in index order.
const verts = [], bodyFaces = [];
let group = '';
for (const line of readFileSync(join(data, '3dobjs/base.obj'), 'utf8').split('\n')) {
  if (line.startsWith('v ')) verts.push(line.split(/\s+/).slice(1, 4).map(Number));
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ') && group === 'body') bodyFaces.push(line.split(/\s+/).slice(1).filter(Boolean).map(t => Number(t.split('/')[0]) - 1));
}
const used = [...new Set(bodyFaces.flat())].sort((a, b) => a - b), remap = new Map(used.map((v, i) => [v, i])), n = used.length;
let minY = Infinity, maxY = -Infinity;
for (const v of used) { minY = Math.min(minY, verts[v][1]); maxY = Math.max(maxY, verts[v][1]); }
const height = maxY - minY;

// Reduced skeleton: [name, parent, MakeHuman bone whose head is this joint].
const sides = s => [
  [`clavicle.${s}`, 'chest', `clavicle.${s}`], [`upperarm.${s}`, `clavicle.${s}`, `upperarm01.${s}`], [`lowerarm.${s}`, `upperarm.${s}`, `lowerarm01.${s}`],
  [`hand.${s}`, `lowerarm.${s}`, `wrist.${s}`], [`upperleg.${s}`, 'hips', `upperleg01.${s}`], [`lowerleg.${s}`, `upperleg.${s}`, `lowerleg01.${s}`],
  [`foot.${s}`, `lowerleg.${s}`, `foot.${s}`],
];
const BONES = [['hips', null, 'root'], ['spineLow', 'hips', 'spine04'], ['chest', 'spineLow', 'spine02'], ['neck', 'chest', 'neck01'], ['head', 'neck', 'head'], ...sides('L'), ...sides('R')];
const index = new Map(BONES.map(([name], i) => [name, i])), anchor = new Map(BONES.map(([name, , mh]) => [mh, name]));
// Every MakeHuman bone moves with its nearest reduced ancestor.
const reduced = mh => { for (let b = mh; b; b = skel.bones[b].parent) if (anchor.has(b)) return index.get(anchor.get(b)); return 0; };

const jointPos = name => { const ids = skel.joints[name]; return [0, 1, 2].map(a => ids.reduce((s, i) => s + verts[i][a], 0) / ids.length); };
const RING = 40;
const bones = BONES.map(([name, parent, mh]) => {
  const p = jointPos(skel.bones[mh].head);
  const ring = used.map((v, i) => [i, Math.hypot(...verts[v].map((x, a) => x - p[a]))]).sort((a, b) => a[1] - b[1]).slice(0, RING).map(([i]) => i);
  const c = [0, 1, 2].map(a => ring.reduce((s, i) => s + verts[used[i]][a], 0) / ring.length);
  return {name, parent: parent == null ? -1 : index.get(parent), ring, offset: p.map((x, a) => (x - c[a]) / height)};
});

// Skin weights: sum per reduced bone, keep the 4 largest, normalise to 255.
const acc = Array.from({length: n}, () => new Map());
for (const [mh, list] of Object.entries(mhw)) {
  if (!skel.bones[mh]) continue;
  const b = reduced(mh);
  for (const [v, w] of list) if (remap.has(v)) { const m = acc[remap.get(v)]; m.set(b, (m.get(b) || 0) + w); }
}
const boneIdx = new Uint8Array(n * 4), boneW = new Uint8Array(n * 4);
let unweighted = 0;
for (let i = 0; i < n; i++) {
  let top = [...acc[i]].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!top.length) { unweighted++; top = [[index.get('chest'), 1]]; }
  const sum = top.reduce((s, [, w]) => s + w, 0);
  let left = 255;
  top.forEach(([b, w], k) => { const q = k === top.length - 1 ? left : Math.floor(w / sum * 255); boneIdx[i * 4 + k] = b; boneW[i * 4 + k] = q; left -= q; });
}

const pad = len => (len + 3) & ~3;
let size = 12;
for (const b of bones) size += 8 + pad(b.name.length) + 4 + pad(b.ring.length * 2) + 12;
size += n * 8;
const buf = new ArrayBuffer(size), view = new DataView(buf);
new Uint8Array(buf, 0, 4).set([82, 73, 71, 49]); // 'RIG1'
view.setUint32(4, bones.length, true); view.setUint32(8, n, true);
let o = 12;
for (const b of bones) {
  view.setInt32(o, b.parent, true); view.setUint32(o + 4, b.name.length, true); o += 8;
  new Uint8Array(buf, o, b.name.length).set([...b.name].map(ch => ch.charCodeAt(0))); o += pad(b.name.length);
  view.setUint32(o, b.ring.length, true); o += 4;
  new Uint16Array(buf, o, b.ring.length).set(b.ring); o += pad(b.ring.length * 2);
  for (const x of b.offset) { view.setFloat32(o, x, true); o += 4; }
}
new Uint8Array(buf, o, n * 4).set(boneIdx); o += n * 4;
new Uint8Array(buf, o, n * 4).set(boneW);
writeFileSync('dist/models/body-rig.bin', new Uint8Array(buf));
console.log(`body-rig.bin: ${bones.length} bones, ${n} vertices, ${unweighted} unweighted, ${size} bytes`);
for (const b of bones) console.log(b.name.padEnd(12), jointPos(skel.bones[BONES[index.get(b.name)][2]].head).map(x => x.toFixed(2)).join(' '));
