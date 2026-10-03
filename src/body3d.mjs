// 3D body figure from the MakeHuman CC0 base mesh (dist/models/body-*.bin, built by
// scripts/build-body-models.mjs). Weight and muscle macros come from BMI, body fat and
// muscle mass; entered girths then fine-tune the trunk and limbs. Bundled to
// dist/body3d.js and loaded only on the profile page.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const REF = {
  male:   {fat: 18, smm: 0.42, smmRange: 0.2, mus: {la: 3.2, ra: 3.2, trunk: 26, ll: 9.5, rl: 9.5}},
  female: {fat: 28, smm: 0.36, smmRange: 0.16, mus: {la: 2.0, ra: 2.0, trunk: 19, ll: 7.0, rl: 7.0}},
};
const SEG = ['trunk', 'la', 'ra', 'll', 'rl', null];
const CLAY = new THREE.Color('#d8d2c8'), FAT = new THREE.Color('#ff6a1f'), LEAN = new THREE.Color('#f3e2c9'), MUSCLE = new THREE.Color('#4f8dff'), LOW = new THREE.Color('#b9b4ad');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GIRTHS = ['chest', 'waist', 'hip', 'arm', 'thigh', 'calf'];

const models = {};
function loadModel(sex) {
  return models[sex] ??= fetch(new URL(`./models/body-${sex}.bin?v=1`, import.meta.url)).then(r => { if (!r.ok) throw Error('model'); return r.arrayBuffer(); }).then(buf => {
    const view = new DataView(buf), pad = n => (n + 3) & ~3;
    const n = view.getUint32(4, true), ni = view.getUint32(8, true), nt = view.getUint32(12, true);
    let o = 16;
    const base = new Float32Array(buf, o, n * 3); o += n * 12;
    const segments = new Uint8Array(buf, o, n); o += pad(n);
    const indices = new Uint16Array(buf, o, ni); o += pad(ni * 2);
    const targets = [];
    for (let t = 0; t < nt; t++) {
      const m = view.getUint32(o, true), w = view.getUint32(o + 4, true), c = view.getUint32(o + 8, true); o += 12;
      const ids = new Uint16Array(buf, o, c); o += pad(c * 2);
      const deltas = new Int16Array(buf, o, c * 3); o += pad(c * 6);
      targets.push({m, w, ids, deltas});
    }
    return {n, base, segments, indices, targets};
  }).catch(error => { delete models[sex]; throw error; });
}

// MakeHuman macro values (0..1, 0.5 = average) from the measurements.
export function macros(r) {
  const sex = r.sex === 'female' ? 'female' : 'male', ref = REF[sex], weights = [];
  if (r.height && r.weight) { const bmi = r.weight / (r.height / 100) ** 2; weights.push(bmi <= 22 ? clamp((bmi - 16) / 12, 0, 0.5) : 0.5 + clamp((bmi - 22) / 26, 0, 0.5)); }
  if (r.body_fat) weights.push(r.body_fat <= ref.fat ? clamp(0.5 - (ref.fat - r.body_fat) / 24, 0, 0.5) : 0.5 + clamp((r.body_fat - ref.fat) / 34, 0, 0.5));
  let muscle = 0.5;
  if (r.muscle && r.weight) muscle = clamp(0.5 + (r.muscle / r.weight - ref.smm) / ref.smmRange, 0, 1);
  else {
    const ratios = ['la', 'ra', 'trunk', 'll', 'rl'].filter(s => r['mus_' + s] != null).map(s => r['mus_' + s] / ref.mus[s]);
    if (ratios.length) muscle = clamp(0.5 + (ratios.reduce((a, b) => a + b) / ratios.length - 1) * 1.2, 0, 1);
  }
  return {sex, weight: weights.length ? weights.reduce((a, b) => a + b) / weights.length : 0.5, muscle};
}

// 0..1 intensity for a segment in the chosen mode, or null when there is no data.
export function segmentLevel(r, seg, mode) {
  const sex = r.sex === 'female' ? 'female' : 'male';
  if (mode === 'fat') {
    const v = r['fat_' + seg]; // % of standard (100 = standard)
    if (v != null) return clamp((v - 60) / 140, 0, 1);
    return r.body_fat == null ? null : clamp((r.body_fat - (sex === 'female' ? 18 : 10)) / 25, 0, 1);
  }
  if (mode === 'muscle') {
    const v = r['mus_' + seg];
    return v == null ? null : clamp((v / REF[sex].mus[seg] - 0.7) / 0.6, 0, 1);
  }
  return null;
}

const split = v => v < 0.5 ? [(0.5 - v) * 2, 1 - (0.5 - v) * 2, 0] : [0, 1 - (v - 0.5) * 2, (v - 0.5) * 2];
const perimeter = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

function shapeBody(model, r) {
  const {n, base, segments, targets} = model, {weight, muscle} = macros(r);
  const pos = Float32Array.from(base), wm = split(muscle), ww = split(weight);
  for (const t of targets) {
    const k = wm[t.m] * ww[t.w] / 1000; if (!k) continue;
    for (let i = 0; i < t.ids.length; i++) { const v = t.ids[i] * 3; pos[v] += t.deltas[i * 3] * k; pos[v + 1] += t.deltas[i * 3 + 1] * k; pos[v + 2] += t.deltas[i * 3 + 2] * k; }
  }
  // Scale to the person's height (metres), feet on the ground.
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) { minY = Math.min(minY, pos[i]); maxY = Math.max(maxY, pos[i]); }
  const H = (r.height || (r.sex === 'female' ? 160 : 172)) / 100, s = H / (maxY - minY);
  for (let i = 0; i < pos.length; i += 3) { pos[i] *= s; pos[i + 1] = (pos[i + 1] - minY) * s; pos[i + 2] *= s; }

  // Slice helpers: per segment, 1%-of-height bins with centroid and x/z extents.
  const BINS = 100, bin = y => clamp(Math.floor(y / H * BINS), 0, BINS - 1);
  const slices = Array.from({length: 5}, () => Array.from({length: BINS}, () => ({n: 0, x: 0, z: 0, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity})));
  for (let i = 0; i < n; i++) {
    const seg = segments[i]; if (seg > 4) continue;
    const b = slices[seg][bin(pos[i * 3 + 1])], x = pos[i * 3], z = pos[i * 3 + 2];
    b.n++; b.x += x; b.z += z; b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
  }
  for (const seg of slices) for (const b of seg) if (b.n) { b.x /= b.n; b.z /= b.n; }
  const girthAt = (seg, i) => { const b = slices[seg][i]; return b.n > 3 ? perimeter((b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2) * 100 : 0; };
  const widest = (seg, from, to) => { let best = 0, at = from; for (let i = from; i <= to; i++) { const g = girthAt(seg, i); if (g > best) { best = g; at = i; } } return [best, at]; };
  const narrowest = (seg, from, to) => { let best = Infinity, at = from; for (let i = from; i <= to; i++) { const g = girthAt(seg, i); if (g && g < best) { best = g; at = i; } } return [best === Infinity ? 0 : best, at]; };

  const factor = (target, measured) => target && measured ? clamp(target / measured, 0.7, 1.45) : 1;
  // Trunk anchors: hip (widest 45-55%), waist (narrowest 56-67%), chest (widest 68-76%).
  const [hipG, hipB] = widest(0, 45, 55), [waistG, waistB] = narrowest(0, 56, 67), [chestG, chestB] = widest(0, 68, 76);
  const anchors = [[hipB - 6, 1], [hipB, factor(r.hip, hipG)], [waistB, factor(r.waist, waistG)], [chestB, factor(r.chest, chestG)], [chestB + 7, 1]];
  const trunkFactor = b => {
    if (b <= anchors[0][0]) return anchors[0][1];
    for (let k = 1; k < anchors.length; k++) if (b <= anchors[k][0]) { const [b0, f0] = anchors[k - 1], [b1, f1] = anchors[k]; return f0 + (f1 - f0) * (b - b0) / Math.max(1, b1 - b0); }
    return 1;
  };
  const armF = [1, 2].map(seg => factor(r.arm, widest(seg, 62, 76)[0]));
  const thighF = [3, 4].map(seg => factor(r.thigh, widest(seg, 38, 47)[0]));
  const calfF = [3, 4].map(seg => factor(r.calf, widest(seg, 12, 26)[0]));
  for (let i = 0; i < n; i++) {
    const seg = segments[i]; if (seg > 4) continue;
    const b = bin(pos[i * 3 + 1]), c = slices[seg][b];
    let f = 1;
    if (seg === 0) f = trunkFactor(b);
    else if (seg <= 2) f = b > 48 ? armF[seg - 1] : 1 + (armF[seg - 1] - 1) * 0.5;
    else { const t = clamp((b - 26) / 6, 0, 1); f = calfF[seg - 3] + (thighF[seg - 3] - calfF[seg - 3]) * t; }
    if (f !== 1) { pos[i * 3] = c.x + (pos[i * 3] - c.x) * f; pos[i * 3 + 2] = c.z + (pos[i * 3 + 2] - c.z) * f; }
  }
  return {pos, H};
}

export function mountBody(container) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#fff4e8', '#3a3530', 1.5));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffb27a', 1.3); rim.position.set(-3, 2, -3); scene.add(rim);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {enablePan: false, enableDamping: true, autoRotate: true, autoRotateSpeed: 1.6, minDistance: 1.6, maxDistance: 7});
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.72, metalness: 0});
  let mesh = null, frame = 0, request = 0;

  async function update(record = {}, mode = 'shape') {
    const r = record, sex = r.sex === 'female' ? 'female' : 'male', ticket = ++request;
    const model = await loadModel(sex);
    if (ticket !== request) return {estimated: GIRTHS.filter(k => !r[k])};
    const {pos, H} = shapeBody(model, r), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setIndex(new THREE.BufferAttribute(model.indices, 1));
    const colors = new Float32Array(model.n * 3), levels = SEG.map(seg => seg ? segmentLevel(r, seg, mode) : null);
    const palette = levels.map(level => level == null ? CLAY : mode === 'fat' ? LEAN.clone().lerp(FAT, level) : LOW.clone().lerp(MUSCLE, level));
    for (let i = 0; i < model.n; i++) { const c = palette[model.segments[i]]; colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
    controls.target.set(0, H * 0.53, 0);
    if (!camera.userData.placed) { camera.position.set(H * 0.55, H * 0.7, H * 2.05); camera.userData.placed = true; }
    controls.update();
    return {estimated: GIRTHS.filter(k => !r[k])};
  }

  const resize = () => { const w = container.clientWidth || 300, h = container.clientHeight || 360; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  const loop = () => { frame = requestAnimationFrame(loop); if (document.hidden || !container.isConnected || container.offsetParent === null) return; controls.update(); renderer.render(scene, camera); };
  loop();
  return {
    update,
    dispose() { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); mesh?.geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
