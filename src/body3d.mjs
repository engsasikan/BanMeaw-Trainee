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
  return models[sex] ??= fetch(new URL(`./models/body-${sex}.bin?v=2`, import.meta.url)).then(r => { if (!r.ok) throw Error('model'); return r.arrayBuffer(); }).then(buf => {
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
    // Local per-segment targets (BMB2): muscle/fat per limb, torso, stomach, girth measures.
    const locals = new Map();
    if (view.getUint8(3) === 50) {
      const nl = view.getUint32(o, true); o += 4;
      for (let t = 0; t < nl; t++) {
        const len = view.getUint32(o, true); o += 4;
        const name = String.fromCharCode(...new Uint8Array(buf, o, len)); o += pad(len);
        const c = view.getUint32(o, true); o += 4;
        const ids = new Uint16Array(buf, o, c); o += pad(c * 2);
        const deltas = new Int16Array(buf, o, c * 3); o += pad(c * 6);
        locals.set(name, {ids, deltas});
      }
    }
    return {n, base, segments, indices, targets, locals};
  }).catch(error => { delete models[sex]; throw error; });
}

// MakeHuman macro values (0..1, 0.5 = average) from the measurements.
export function macros(r) {
  const sex = r.sex === 'female' ? 'female' : 'male', ref = REF[sex], weights = [];
  if (r.height && r.weight) { const bmi = r.weight / (r.height / 100) ** 2; weights.push(bmi <= 22 ? clamp((bmi - 16) / 12, 0, 0.5) : 0.5 + clamp((bmi - 22) / 26, 0, 0.5)); }
  if (r.body_fat) weights.push(r.body_fat <= ref.fat ? clamp(0.5 - (ref.fat - r.body_fat) / 24, 0, 0.5) : 0.5 + clamp((r.body_fat - ref.fat) / 34, 0, 0.5));
  let muscle = 0.5;
  const pcts = ['la', 'ra', 'trunk', 'll', 'rl'].map(s => r['musp_' + s]).filter(v => v != null);
  if (pcts.length) muscle = clamp(0.5 + (pcts.reduce((a, b) => a + b) / pcts.length - 100) / 60, 0, 1);
  else if (r.muscle && r.weight) muscle = clamp(0.5 + (r.muscle / r.weight - ref.smm) / ref.smmRange, 0, 1);
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
    const pct = r['musp_' + seg]; // % of standard from the InBody sheet
    if (pct != null) return clamp((pct - 80) / 40, 0, 1);
    const v = r['mus_' + seg];
    return v == null ? null : clamp((v / REF[sex].mus[seg] - 0.7) / 0.6, 0, 1);
  }
  return null;
}

const split = v => v < 0.5 ? [(0.5 - v) * 2, 1 - (0.5 - v) * 2, 0] : [0, 1 - (v - 0.5) * 2, (v - 0.5) * 2];
const median = (...v) => v.sort((a, b) => a - b)[v.length >> 1];
const perimeter = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

// Segment muscle level (-1..1) relative to the person's own average, so the global muscle
// macro handles overall muscularity and local targets show the distribution between parts.
function segmentDeviation(r, prefix, scale) {
  const segs = ['la', 'ra', 'trunk', 'll', 'rl'], vals = segs.map(s => r[prefix + s]);
  const known = vals.filter(v => v != null);
  if (!known.length) return null;
  const mean = known.reduce((a, b) => a + b) / known.length;
  return Object.fromEntries(segs.map((s, i) => [s, vals[i] == null ? 0 : clamp((vals[i] - mean) / scale, -1, 1)]));
}

function shapeBody(model, r) {
  const {n, base, segments, targets, locals} = model, {sex, weight, muscle} = macros(r), ref = REF[sex];
  const pos = Float32Array.from(base), wm = split(muscle), ww = split(weight);
  for (const t of targets) {
    const k = wm[t.m] * ww[t.w] / 1000; if (!k) continue;
    for (let i = 0; i < t.ids.length; i++) { const v = t.ids[i] * 3; pos[v] += t.deltas[i * 3] * k; pos[v + 1] += t.deltas[i * 3 + 1] * k; pos[v + 2] += t.deltas[i * 3 + 2] * k; }
  }
  // Apply a local target pair: positive weight uses '-incr', negative uses '-decr'.
  const apply = (into, name, w, scale = 1) => {
    if (!w) return;
    const t = locals.get(name + (w > 0 ? '-incr' : '-decr')); if (!t) return;
    const k = Math.abs(w) * scale / 1000;
    for (let i = 0; i < t.ids.length; i++) { const v = t.ids[i] * 3; into[v] += t.deltas[i * 3] * k; into[v + 1] += t.deltas[i * 3 + 1] * k; into[v + 2] += t.deltas[i * 3 + 2] * k; }
  };
  // Per-segment muscle (InBody segmental lean %, or kg vs. reference) and fat (% of standard).
  const musPct = segmentDeviation(r, 'musp_', 12);
  const musKg = musPct ? null : segmentDeviation(Object.fromEntries(['la', 'ra', 'trunk', 'll', 'rl'].map(s => ['m_' + s, r['mus_' + s] == null ? null : r['mus_' + s] / ref.mus[s] * 100])), 'm_', 12);
  const mus = musPct || musKg, fat = segmentDeviation(r, 'fat_', 40);
  for (const [side, arm, leg] of [['l', 'la', 'll'], ['r', 'ra', 'rl']]) {
    if (mus) {
      for (const part of ['upperarm', 'lowerarm']) apply(pos, `${side}-${part}-muscle`, mus[arm]);
      apply(pos, `${side}-upperarm-shoulder-muscle`, mus[arm]);
      for (const part of ['upperleg', 'lowerleg']) apply(pos, `${side}-${part}-muscle`, mus[leg]);
    }
    if (fat) {
      for (const part of ['upperarm', 'lowerarm']) apply(pos, `${side}-${part}-fat`, fat[arm]);
      for (const part of ['upperleg', 'lowerleg']) apply(pos, `${side}-${part}-fat`, fat[leg]);
    }
  }
  if (mus) { apply(pos, 'torso-muscle-pectoral', mus.trunk); apply(pos, 'torso-muscle-dorsi', mus.trunk); }
  // Belly from visceral fat level (1-9 normal) and trunk fat; abdominal tone from body fat.
  // The 'pregnant' target is strong, so keep it subtle: level 16 -> ~0.35.
  const belly = (r.visceral != null ? clamp((r.visceral - 9) / 20, -0.2, 0.5) : 0) + (fat ? fat.trunk * 0.25 : 0);
  apply(pos, 'stomach-pregnant', clamp(belly, -0.3, 0.6));
  if (r.body_fat != null) apply(pos, 'stomach-tone', clamp((ref.fat - r.body_fat) / 12, -1, 1));

  // Scale to the person's height (metres), feet on the ground.
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) { minY = Math.min(minY, pos[i]); maxY = Math.max(maxY, pos[i]); }
  const H = (r.height || (sex === 'female' ? 160 : 172)) / 100, s = H / (maxY - minY);
  for (let i = 0; i < pos.length; i += 3) { pos[i] *= s; pos[i + 1] = (pos[i + 1] - minY) * s; pos[i + 2] *= s; }

  // Girth measurement on 1%-of-height slices of one or more segments (cm).
  // Arms hang at an angle, so their horizontal slices are stretched in x: use depth (z) only.
  const girth = (p, segs, from, to, pick, depthOnly = false) => {
    const BINS = 100, ext = segs.map(() => Array.from({length: BINS}, () => [Infinity, -Infinity, Infinity, -Infinity, 0]));
    for (let i = 0; i < n; i++) {
      const k = segs.indexOf(segments[i]); if (k < 0) continue;
      const b = Math.floor(p[i * 3 + 1] / H * BINS); if (b < from || b > to) continue;
      const e = ext[k][b], x = p[i * 3], z = p[i * 3 + 2];
      e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], z); e[3] = Math.max(e[3], z); e[4]++;
    }
    const per = ext.map(bins => { const g = bins.slice(from, to + 1).filter(e => e[4] > 3).map(e => (depthOnly ? perimeter((e[3] - e[2]) / 2, (e[3] - e[2]) / 2) : perimeter((e[1] - e[0]) / 2, (e[3] - e[2]) / 2)) * 100); return g.length ? pick(...g) : 0; });
    return per.reduce((a, b) => a + b) / per.length;
  };
  // Fit each entered tape measurement with MakeHuman's measure targets (deltas scaled to metres).
  const fits = [
    ['hip', 'measure-hips-circ', [0], 45, 55, Math.max],
    ['waist', 'measure-waist-circ', [0], 56, 67, Math.min],
    ['chest', 'measure-bust-circ', [0], 68, 76, Math.max],
    ['arm', 'measure-upperarm-circ', [1, 2], 69, 73, median],
    ['thigh', 'measure-thigh-circ', [3, 4], 38, 47, Math.max],
    ['calf', 'measure-calf-circ', [3, 4], 12, 26, Math.max],
  ];
  // Two passes: neighbouring measures (waist/hip/bust) affect each other.
  for (let pass = 0; pass < 2; pass++) for (const [key, name, segs, from, to, pick] of fits) {
    const target = r[key]; if (!target) continue;
    const depthOnly = key === 'arm', g0 = girth(pos, segs, from, to, pick, depthOnly); if (!g0 || Math.abs(target - g0) < 0.5) continue;
    const dir = target > g0 ? 1 : -1, probe = Float32Array.from(pos);
    apply(probe, name, dir, s);
    const g1 = girth(probe, segs, from, to, pick, depthOnly);
    if (Math.abs(g1 - g0) < 0.1) continue;
    apply(pos, name, dir * clamp((target - g0) / (g1 - g0), 0, 4), s);
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
