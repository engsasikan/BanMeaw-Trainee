// 3D body figure from the MakeHuman CC0 base mesh (dist/models/body-*.bin, built by
// scripts/build-body-models.mjs). Weight and muscle macros come from BMI, body fat and
// muscle mass; entered girths then fine-tune the trunk and limbs. Bundled to
// dist/body3d.js and loaded only on the profile page.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { predictGirths } from './girth-model.mjs';

const REF = {
  male:   {fat: 18, smm: 0.42, smmRange: 0.2, mus: {la: 3.2, ra: 3.2, trunk: 26, ll: 9.5, rl: 9.5}},
  female: {fat: 28, smm: 0.36, smmRange: 0.16, mus: {la: 2.0, ra: 2.0, trunk: 19, ll: 7.0, rl: 7.0}},
};
const SEG = ['trunk', 'la', 'ra', 'll', 'rl', null];
// Muscle per segment: diverging around the standard (100%) - blue below, neutral at, orange above.
const BELOW = new THREE.Color('#4f8dff'), STANDARD = new THREE.Color('#aaa49c'), ABOVE = new THREE.Color('#ff7028');
// Exercise focus: muscles the exercise works (primary / secondary) against neutral idle muscle.
const FOCUS_PRIMARY = new THREE.Color('#ff4d1f'), FOCUS_SECONDARY = new THREE.Color('#ffae73'), FOCUS_IDLE = new THREE.Color('#9b958e');
const CLAY = new THREE.Color('#d8d2c8'), FAT = new THREE.Color('#ff6a1f'), LEAN = new THREE.Color('#f3e2c9'), MUSCLE = new THREE.Color('#4f8dff'), LOW = new THREE.Color('#b9b4ad');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const GIRTHS = ['shoulder', 'chest', 'waist', 'hip', 'arm', 'thigh', 'calf'];

const models = {};
export function loadModel(sex) {
  return models[sex] ??= fetch(new URL(`./models/body-${sex}.bin?v=6`, import.meta.url)).then(r => { if (!r.ok) throw Error('model'); return r.arrayBuffer(); }).then(buf => {
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
    // Muscle map (ANAT): region, fibre direction and flags per vertex, as shader attributes.
    let anatomy = null;
    if (o + 4 <= buf.byteLength && String.fromCharCode(...new Uint8Array(buf, o, 4)) === 'ANAT') {
      o += 4;
      const region = new Uint8Array(buf, o, n); o += pad(n);
      const fiber = new Int8Array(buf, o, n * 3); o += pad(n * 3);
      const flags = new Uint8Array(buf, o, n); o += pad(n);
      // Distance to the nearest muscle boundary (mm, newer files); x of aAnat carries it in cm.
      const edge = o + n <= buf.byteLength ? new Uint8Array(buf, o, n) : null; if (edge) o += pad(n);
      const anat = new Float32Array(n * 3), tone = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        anat[i * 3] = edge ? edge[i] / 10 : (flags[i] & 1 ? 0.2 : 3); anat[i * 3 + 1] = (flags[i] >> 1) & 1; anat[i * 3 + 2] = (flags[i] >> 2) & 1;
        tone[i] = ((region[i] * 2654435761) >>> 0) % 1000 / 1000; // stable per-region shade
      }
      anatomy = {fiber: new THREE.BufferAttribute(fiber, 3, true), anat: new THREE.BufferAttribute(anat, 3), tone: new THREE.BufferAttribute(tone, 1), region};
      // Region names (RGNS): base muscle name per region id, e.g. 'pec-l' -> 'pec', 'abs2-r' -> 'abs'.
      if (o + 8 <= buf.byteLength && String.fromCharCode(...new Uint8Array(buf, o, 4)) === 'RGNS') {
        const len = view.getUint32(o + 4, true), names = new TextDecoder().decode(new Uint8Array(buf, o + 8, len)).split('\n');
        anatomy.muscleOf = ['', ...names.map(name => name.replace(/-[lr]$/, '').replace(/^abs\d$/, 'abs'))];
        o += 8 + pad(len);
      }
    }
    return {n, base, segments, indices, targets, locals, anatomy};
  }).catch(error => { delete models[sex]; throw error; });
}

// Skeleton + skin weights (dist/models/body-rig.bin, built by scripts/build-body-rig.mjs).
let rigPromise = null;
export function loadRig() {
  return rigPromise ??= fetch(new URL('./models/body-rig.bin?v=2', import.meta.url)).then(r => { if (!r.ok) throw Error('rig'); return r.arrayBuffer(); }).then(buf => {
    const view = new DataView(buf), pad = n => (n + 3) & ~3, nb = view.getUint32(4, true), n = view.getUint32(8, true), bones = [];
    let o = 12;
    for (let b = 0; b < nb; b++) {
      const parent = view.getInt32(o, true), len = view.getUint32(o + 4, true); o += 8;
      const name = String.fromCharCode(...new Uint8Array(buf, o, len)); o += pad(len);
      const c = view.getUint32(o, true); o += 4;
      const ring = new Uint16Array(buf, o, c); o += pad(c * 2);
      const offset = [0, 1, 2].map(k => view.getFloat32(o + k * 4, true)); o += 12;
      bones.push({name, parent, ring, offset});
    }
    const index = new Uint8Array(buf, o, n * 4), weight = new Uint8Array(buf, o + n * 4, n * 4);
    return {bones, byName: new Map(bones.map((b, i) => [b.name, i])), n, index, weight};
  }).catch(error => { rigPromise = null; throw error; });
}

// Exercise demonstrations, authored for this app. Each motion loops between two key poses.
// Limb poses are directions in the motion frame (x = the person's left, y = up, z = forward;
// lying and prone motions rotate that frame). Right limbs mirror the left ones unless a key
// gives its own '<limb>R' direction. Spine bones take Euler angles in degrees (x > 0 bends
// forward); 'foot' is an Euler angle against the shin, otherwise feet stay flat on the floor.
// Anchors: feet (both planted), footL (front foot planted), lying (back on a surface),
// hands (hanging from a fixed bar), plank (hands and toes on the floor), quadruped (hands and knees),
// seated (on a box, seatFoot planted).
const STAND = {upperarm: [0.1, -1, 0.02], lowerarm: [0.12, -1, 0.06], upperleg: [0.11, -1, 0.02], lowerleg: [0.12, -1, -0.06]};
const LEGS = {upperleg: STAND.upperleg, lowerleg: STAND.lowerleg};
const LYING_KNEES = {upperleg: [0.14, -0.5, 0.85], lowerleg: [0.04, -0.4, -0.92]};
const FOOT_DOWN = (leg, w = 'always') => ({leg, hold: 'start', y: 0.075, pole: [0, 1, 0], w}); // lying on the back, feet flat
const BENCH_LEGS = {upperleg: [0.28, -0.94, -0.18], lowerleg: [0.06, -0.12, -1]}; // lying on a bench, feet on the floor
const BENT_OVER = {hips: [62, 0, 0], neck: [-12, 0, 0], head: [-26, 0, 0], upperleg: [0.13, -1, 0.24], lowerleg: [0.12, -1, -0.16]};
const RIGHT_STAND = {upperlegR: [-0.11, -1, 0.02], lowerlegR: [-0.12, -1, -0.06]};
const ARMS_CROSSED = {upperarm: [-0.15, -0.7, 0.7], lowerarm: [-0.95, 0.2, 0.15], grip: 0.3}; // with armsWith: 'chest'
const HANDS_TOGETHER = {upperarm: [-0.22, -0.3, 0.93], lowerarm: [-0.45, -0.05, 0.89], grip: 0.6}; // with armsWith: 'chest'
const FLOOR_SIT = {hips: [-35, 0, 0], upperleg: [0.12, 0.45, 0.88], lowerleg: [0.05, -0.4, 0.92], foot: [0, 0, 0]};
const PLANK_LEGS = {upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], foot: [0, 0, 0]};
const PUSH_ARMS = {upperarm: [0.25, -0.05, 1], lowerarm: [0.06, 0.05, 1], hand: [0, 1, 0.1], grip: 0};
// Alternating patterns: the second key swaps left and right.
const mirrorKey = k => {
  const out = {}, flip = d => d && [-d[0], d[1], d[2]];
  for (const [key, v] of Object.entries(k)) {
    if (key.endsWith('R') && /^(upper|lower)(arm|leg)R$|^footR$/.test(key)) continue;
    const r = k[key + 'R'];
    if (/^(upper|lower)(arm|leg)$/.test(key)) { out[key] = r ? flip(r) : v; out[key + 'R'] = flip(v); }
    else if (key === 'foot' && k.footR) { out.foot = k.footR; out.footR = v; }
    else out[key] = v;
  }
  return out;
};
const RUN_A = {hips: [10, 0, 0], upperleg: [0.1, -0.25, 0.97], lowerleg: [0.05, -0.95, -0.3], upperlegR: [-0.1, -0.95, -0.3], lowerlegR: [-0.05, -0.55, -0.83],
  upperarm: [0.1, -0.8, -0.6], lowerarm: [0.05, 0.25, 0.97], upperarmR: [-0.1, -0.75, 0.66], lowerarmR: [-0.05, 0.65, 0.76], grip: 0.4};
const WALK_A = {upperleg: [0.1, -0.95, 0.3], lowerleg: [0.1, -1, 0.05], upperlegR: [-0.1, -0.97, -0.25], lowerlegR: [-0.1, -0.9, -0.4],
  upperarm: [0.1, -1, -0.25], lowerarm: [0.1, -1, -0.1], upperarmR: [-0.1, -1, 0.25], lowerarmR: [-0.1, -0.95, 0.3]};
const CYCLE_A = {hips: [25, 0, 0], upperleg: [0.12, 0.25, 0.97], lowerleg: [0.06, -0.9, 0.4], upperlegR: [-0.12, -0.6, 0.8], lowerlegR: [-0.06, -1, -0.1],
  upperarm: [0.15, -0.45, 0.88], lowerarm: [0.1, -0.25, 0.96], grip: 0.8};
const ROPES_A = {hips: [20, 0, 0], upperleg: [0.2, -0.85, 0.45], lowerleg: [0.15, -0.95, -0.25], upperarm: [0.15, -0.35, 0.92], lowerarm: [0.08, -0.2, 0.98],
  upperarmR: [-0.15, 0.15, 0.98], lowerarmR: [-0.08, 0.3, 0.95], grip: 1};
const DEAD_BUG_A = {upperarm: [0.1, 0.85, 0.5], lowerarm: [0.1, 0.85, 0.5], upperarmR: [-0.1, 0.1, 1], lowerarmR: [-0.1, 0.1, 1],
  upperleg: [0.08, -0.9, 0.4], lowerleg: [0.08, -0.95, 0.3], upperlegR: [-0.1, 0.05, 1], lowerlegR: [-0.05, -1, 0.05]};
const BICYCLE_A = {spineLow: [10, 0, 0], upperarm: [0.9, 0.35, -0.1], lowerarm: [-0.6, 0.5, -0.6], upperleg: [0.1, 0.5, 0.86], lowerleg: [0.05, -0.9, 0.4],
  upperlegR: [-0.08, -0.95, 0.3], lowerlegR: [-0.08, -0.95, 0.3]};
const SITTING = {upperleg: [0.12, 0, 1], lowerleg: [0.08, -1, 0.02], upperarm: [0.1, -0.9, 0.4], lowerarm: [0.05, -0.3, 0.95], grip: 0.2};
const MOTIONS = {
  squat: {anchor: 'feet', view: [55, 12, 0.5], keys: [
    {...STAND, upperleg: [0.2, -1, 0.02], lowerleg: [0.16, -1, -0.05], upperarm: [0.1, -1, 0.15], lowerarm: [0.1, -1, 0.2]},
    {hips: [38, 0, 0], spineLow: [-6, 0, 0], chest: [-4, 0, 0], head: [-22, 0, 0], upperleg: [0.36, -0.22, 0.9], lowerleg: [0.16, -0.93, -0.33], upperarm: [0.12, 0.08, 1], lowerarm: [0.04, 0.08, 1]},
  ]},
  bench: {anchor: 'lying', surface: 0.43, view: [38, 30, 0.3], props: ['bench', 'barbell'], keys: [
    {upperleg: [0.28, -0.94, -0.18], lowerleg: [0.06, -0.12, -1], upperarm: [0.36, -0.22, 0.9], lowerarm: [0.03, -0.05, 1], twist: 55},
    {upperleg: [0.28, -0.94, -0.18], lowerleg: [0.06, -0.12, -1], upperarm: [0.8, -0.42, -0.36], lowerarm: [-0.12, -0.08, 1], twist: 42},
  ]},
  row: {anchor: 'feet', view: [72, 10, 0.45], props: ['dumbbells'], keys: [
    {hips: [64, 0, 0], neck: [-12, 0, 0], head: [-26, 0, 0], upperleg: [0.13, -1, 0.24], lowerleg: [0.12, -1, -0.16], upperarm: [0.06, -1, 0.1], lowerarm: [0.04, -1, 0.04], twist: -16},
    {hips: [64, 0, 0], neck: [-12, 0, 0], head: [-26, 0, 0], upperleg: [0.13, -1, 0.24], lowerleg: [0.12, -1, -0.16], upperarm: [0.16, -0.3, -0.94], lowerarm: [0.03, -1, 0.02], twist: 6},
  ]},
  curl: {anchor: 'feet', view: [38, 8, 0.55], props: ['dumbbells'], keys: [
    {...STAND, upperarm: [0.08, -1, 0], lowerarm: [0.1, -1, 0.06], twist: -73},
    {...STAND, upperarm: [0.08, -1, 0.08], lowerarm: [0.06, 0.78, 0.62], twist: -93},
  ]},
  crunch: {anchor: 'lying', surface: 0.01, view: [70, 22, 0.18], props: ['mat'], reach: [FOOT_DOWN('L'), FOOT_DOWN('R')], keys: [
    {upperleg: [0.14, -0.5, 0.85], lowerleg: [0.04, -0.55, -0.83], upperarm: [0.22, -0.9, 0.3], lowerarm: [0.12, -0.95, 0.25]},
    {spineLow: [9, 0, 0], chest: [17, 0, 0], neck: [12, 0, 0], upperleg: [0.14, -0.5, 0.85], lowerleg: [0.04, -0.55, -0.83], upperarm: [0.2, -0.85, 0.48], lowerarm: [0.1, -0.85, 0.5]},
  ]},
  shoulderPress: {anchor: 'feet', view: [28, 6, 0.68, 1.15], props: ['dumbbells'], keys: [
    {...LEGS, upperarm: [0.96, -0.12, 0.25], lowerarm: [0.04, 1, 0.08], twist: -5},
    {...LEGS, upperarm: [0.3, 1, 0.06], lowerarm: [0.12, 1, 0.04], twist: -66},
  ]},
  lateralRaise: {anchor: 'feet', view: [12, 6, 0.58, 1.1], props: ['dumbbells'], keys: [
    {...LEGS, upperarm: [0.14, -1, 0.06], lowerarm: [0.2, -1, 0.12], twist: 16},
    {...LEGS, upperarm: [1, 0.04, 0.12], lowerarm: [1, -0.04, 0.2], twist: 16},
  ]},
  pushdown: {anchor: 'feet', view: [62, 8, 0.62, 1.15], props: ['cable'], keys: [
    {...LEGS, hips: [10, 0, 0], upperarm: [0.06, -1, 0.14], lowerarm: [-0.12, 0.35, 0.93], twist: 97},
    {...LEGS, hips: [10, 0, 0], upperarm: [0.06, -1, 0.14], lowerarm: [-0.04, -1, 0.1], twist: 96},
  ]},
  overheadExtension: {anchor: 'feet', view: [75, 6, 0.66, 1.1], props: ['onedumbbell'], keys: [
    {...LEGS, upperarm: [0.14, 1, 0.12], lowerarm: [-0.2, -0.5, -0.84]},
    {...LEGS, upperarm: [0.14, 1, 0.12], lowerarm: [-0.08, 1, 0.06]},
  ]},
  deadlift: {anchor: 'feet', view: [70, 8, 0.45], props: ['barbell'], keys: [
    {hips: [58, 0, 0], neck: [-10, 0, 0], head: [-26, 0, 0], upperleg: [0.14, -0.6, 0.79], lowerleg: [0.1, -0.95, -0.3], upperarm: [0.1, -1, 0.02], lowerarm: [0.06, -1, 0], twist: 78},
    {...STAND, upperarm: [0.1, -1, 0.04], lowerarm: [0.06, -1, 0.02], twist: 78},
  ]},
  // Back (right) leg reaches a spot 0.36 x height behind the front foot, on the ball of the foot (IK).
  lunge: {anchor: 'footL', view: [80, 8, 0.42], backFoot: 0.36, keys: [
    {upperleg: [0.1, -0.85, 0.5], lowerleg: [0.1, -1, 0], footR: [-10, 0, 0], upperarm: [0.14, -1, 0.04], lowerarm: [0.14, -1, 0.08]},
    {upperleg: [0.1, -0.3, 0.95], lowerleg: [0.08, -1, 0.04], footR: [-25, 0, 0], upperarm: [0.14, -1, 0.04], lowerarm: [0.14, -1, 0.08]},
  ]},
  pushup: {anchor: 'plank', view: [72, 18, 0.18], keys: [
    {upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], foot: [0, 0, 0], upperarm: [0.25, -0.05, 1], lowerarm: [0.06, 0.05, 1], hand: [0, 1, 0.1]},
    {upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], foot: [0, 0, 0], upperarm: [0.55, -0.5, -0.67], lowerarm: [0.02, 0.2, 1], hand: [0, 1, 0.1]},
  ]},
  pullup: {anchor: 'hands', view: [40, 4, 0.7, 1.3], props: ['pullbar'], keys: [
    {upperleg: [0.08, -1, 0.12], lowerleg: [0.06, -0.94, -0.33], foot: [30, 0, 0], upperarm: [0.38, 1, 0.02], lowerarm: [0.22, 1, 0.02], twist: -71},
    {upperleg: [0.08, -1, 0.12], lowerleg: [0.06, -0.94, -0.33], foot: [30, 0, 0], upperarm: [0.94, -0.35, -0.04], lowerarm: [0.05, 1, 0.02], twist: -17},
  ]},
  kettlebellSwing: {anchor: 'feet', view: [72, 8, 0.5, 1.15], props: ['kettlebell'], keys: [
    {hips: [62, 0, 0], neck: [-8, 0, 0], head: [-22, 0, 0], upperleg: [0.2, -0.82, 0.54], lowerleg: [0.16, -0.97, -0.18], upperarm: [-0.3, -0.85, -0.45], lowerarm: [-0.26, -0.8, -0.55], twist: 80},
    {upperleg: [0.2, -1, 0.02], lowerleg: [0.16, -1, -0.05], upperarm: [-0.3, 0.08, 1], lowerarm: [-0.26, 0.1, 1], twist: 80},
  ]},
  // Stretches: ease in, hold, release (hold: true). 'reach' bends an arm to hold a foot or elbow.
  hamstringStretch: {anchor: 'feet', hold: true, view: [75, 8, 0.45], keys: [
    {...STAND},
    {hips: [82, 0, 0], spineLow: [14, 0, 0], chest: [10, 0, 0], upperleg: [0.11, -1, 0.02], lowerleg: [0.12, -1, -0.06], upperarm: [0.06, -1, 0.08], lowerarm: [0.04, -1, 0.12]},
  ]},
  quadStretch: {anchor: 'footL', hold: true, view: [70, 8, 0.5], reach: [{arm: 'R', to: 'foot.R', offset: [0, 0.02, -0.02], pole: [-0.2, -0.3, -1]}], keys: [
    {...STAND},
    {upperleg: [0.11, -1, 0.02], lowerleg: [0.12, -1, -0.06], upperlegR: [-0.06, -1, -0.08], lowerlegR: [-0.06, 0.72, -0.7], footR: [-50, 0, 0], upperarm: [0.85, -0.5, 0.15], lowerarm: [0.9, -0.3, 0.3], grip: 0.8},
  ]},
  calfStretch: {anchor: 'footL', hold: true, backFoot: 0.4, backFootY: 0.08, view: [80, 8, 0.48], props: ['wall'], keys: [
    {hips: [18, 0, 0], upperleg: [0.1, -0.92, 0.38], lowerleg: [0.1, -1, 0.08], upperarm: [0.15, 0.2, 1], lowerarm: [0.1, 0.3, 1], hand: [0.05, 1, 0.1], grip: 0},
    {hips: [24, 0, 0], upperleg: [0.1, -0.8, 0.6], lowerleg: [0.1, -1, 0.3], upperarm: [0.15, 0.25, 1], lowerarm: [0.1, 0.35, 1], hand: [0.05, 1, 0.1], grip: 0},
  ]},
  chestStretch: {anchor: 'feet', hold: true, view: [60, 8, 0.6], keys: [
    {...STAND},
    {...LEGS, chest: [-10, 0, 0], head: [-6, 0, 0], upperarm: [0.2, -0.8, -0.56], lowerarm: [-0.42, -0.75, -0.5], grip: 0.6},
  ]},
  shoulderStretch: {anchor: 'feet', hold: true, view: [25, 6, 0.65], reach: [{arm: 'R', to: 'lowerarm.L', offset: [0, -0.01, 0.03], pole: [-0.2, -1, 0.2]}], keys: [
    {...STAND},
    {...LEGS, upperarm: [-0.92, 0.05, 0.38], lowerarm: [-1, 0, 0.1], upperarmR: [-0.1, -1, 0.02], lowerarmR: [-0.12, -1, 0.06], grip: 0.6},
  ]},
  tricepsStretch: {anchor: 'feet', hold: true, view: [35, 6, 0.68, 1.1], reach: [{arm: 'R', to: 'lowerarm.L', offset: [-0.01, 0.01, 0], pole: [-1, 0.2, 0.3]}], keys: [
    {...STAND},
    {...LEGS, upperarm: [0.1, 1, -0.05], lowerarm: [-0.45, -0.85, -0.25], upperarmR: [-0.1, -1, 0.02], lowerarmR: [-0.12, -1, 0.06], grip: 0.5},
  ]},
  sideStretch: {anchor: 'feet', hold: true, view: [8, 6, 0.62, 1.2], keys: [
    {...STAND},
    {...LEGS, spineLow: [0, 0, 12], chest: [0, 0, 16], neck: [0, 0, 6], upperarm: [-0.35, 1, 0], lowerarm: [-0.65, 0.75, 0], upperarmR: [-0.12, -1, 0.04], lowerarmR: [-0.14, -1, 0.06]},
  ]},
  neckStretch: {anchor: 'feet', hold: true, view: [10, 6, 0.75, 0.75], keys: [
    {...STAND},
    {...STAND, neck: [0, 0, 16], head: [0, 0, 18]},
  ]},
  // Glute and hip stretches. Lying ones use the lying frame: x = left, y = towards the head, z = up from the chest.
  kneeToChest: {anchor: 'lying', surface: 0.01, hold: true, view: [70, 22, 0.18], props: ['mat'],
    reach: [FOOT_DOWN('L', 'out'), FOOT_DOWN('R', 'out'), {arm: 'L', to: 'lowerleg.L', offset: [0.03, -0.01, 0.03], pole: [1, -0.3, 0]}, {arm: 'R', to: 'lowerleg.L', offset: [-0.03, -0.01, 0.03], pole: [-1, -0.3, 0]}], keys: [
    {...LYING_KNEES, upperarm: [0.2, -0.95, 0.1], lowerarm: [0.15, -0.95, 0.1]},
    {chest: [14, 0, 0], neck: [10, 0, 0], upperleg: [0.15, 0.75, 0.65], lowerleg: [0.05, -0.95, 0.1], upperlegR: [-0.1, -1, -0.1], lowerlegR: [-0.1, -1, -0.05], upperarm: [0.2, -0.95, 0.1], lowerarm: [0.15, -0.95, 0.1], grip: 0.7},
  ]},
  lyingFigure4: {anchor: 'lying', surface: 0.01, hold: true, view: [60, 24, 0.18], props: ['mat'],
    reach: [FOOT_DOWN('L', 'out'), FOOT_DOWN('R', 'out'), {leg: 'R', to: 'lowerleg.L', offset: [-0.02, 0.025, 0], pole: [-1, 0.2, 0]},
      {arm: 'L', to: 'lowerleg.L', offset: [0.03, -0.02, -0.06], pole: [1, -0.3, 0]}, {arm: 'R', to: 'lowerleg.L', offset: [-0.03, -0.02, -0.06], pole: [-1, -0.3, 0]}], keys: [
    {...LYING_KNEES, upperarm: [0.2, -0.95, 0.1], lowerarm: [0.15, -0.95, 0.1]},
    {chest: [12, 0, 0], neck: [10, 0, 0], upperleg: [0.1, 0.55, 0.83], lowerleg: [0.05, -0.95, 0.3], upperarm: [0.2, -0.95, 0.1], lowerarm: [0.15, -0.95, 0.1], grip: 0.7},
  ]},
  seatedFigure4: {anchor: 'seated', seatFoot: 'L', hold: true, view: [50, 10, 0.4], props: ['seat'],
    reach: [{leg: 'R', to: 'lowerleg.L', offset: [-0.02, 0.03, 0], pole: [-0.7, 1, 0]},
      {arm: 'R', to: 'lowerleg.R', offset: [0, 0.03, 0], pole: [-1, 0, -0.3]}, {arm: 'L', to: 'foot.R', offset: [0, 0.03, 0], pole: [1, 0, -0.3]}], keys: [
    {...SITTING},
    {...SITTING, hips: [24, 0, 0], grip: 0.6},
  ]},
  seatedHamstring: {anchor: 'seated', seatFoot: 'R', hold: true, view: [70, 10, 0.4], props: ['seat'],
    reach: [{arm: 'L', to: 'lowerleg.L', offset: [0.03, -0.02, 0.08], pole: [1, 0, 0]}, {arm: 'R', to: 'lowerleg.L', offset: [-0.03, -0.02, 0.08], pole: [-1, 0, 0]}], keys: [
    {...SITTING},
    {...SITTING, hips: [34, 0, 0], upperleg: [0.12, -0.15, 0.98], lowerleg: [0.1, -0.45, 0.89], grip: 0.5},
  ]},
  ironCross: {anchor: 'lying', surface: 0.01, hold: true, view: [20, 40, 0.15], props: ['mat'], keys: [
    {upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], upperarm: [1, 0, 0], lowerarm: [1, 0, 0]},
    {hips: [0, -32, 0], chest: [0, 26, 0], upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], upperlegR: [0.78, -0.55, -0.02], lowerlegR: [0.8, -0.55, -0.05], upperarm: [1, 0, 0], lowerarm: [1, 0, 0]},
  ]},
  rockingFrog: {anchor: 'quadruped', handsUp: 0.04, view: [75, 22, 0.18], keys: [
    {upperleg: [0.75, -0.05, 0.65], lowerleg: [0.35, -0.94, 0], foot: [0, 0, 0], upperarm: [0.15, 0.05, 1], lowerarm: [0.1, 0.05, 1], hand: [0, 1, 0.1], grip: 0},
    {upperleg: [0.7, 0.5, 0.5], lowerleg: [0.3, -0.95, -0.05], foot: [0, 0, 0], upperarm: [0.15, 0.75, 0.65], lowerarm: [0.1, 0.75, 0.65], hand: [0, 1, 0.1], grip: 0},
  ]},
  worldGreatest: {anchor: 'footL', backFoot: 0.42, hold: true, view: [35, 14, 0.38],
    reach: [{arm: 'R', to: 'foot.L', offset: [-0.07, -0.02, 0.04], pole: [-0.5, 0, 1], w: 'always'}, {arm: 'L', to: 'foot.L', offset: [0.07, -0.02, 0.04], pole: [1, 0, 0.3], w: 'out'}], keys: [
    {hips: [55, 0, 0], upperleg: [0.1, -0.3, 0.95], lowerleg: [0.08, -1, 0.04], upperarm: [0.2, 1, 0.1], lowerarm: [0.15, 1, 0.1], grip: 0},
    {hips: [55, 0, 0], chest: [0, 38, 0], spineLow: [0, 12, 0], upperleg: [0.1, -0.3, 0.95], lowerleg: [0.08, -1, 0.04], upperarm: [0.2, 1, 0.1], lowerarm: [0.15, 1, 0.1], grip: 0},
  ]},
  kneeCircles: {anchor: 'feet', view: [20, 10, 0.4],
    reach: [{arm: 'L', to: 'lowerleg.L', offset: [0, 0.01, 0.04], pole: [1, 0, -0.3], w: 'always'}, {arm: 'R', to: 'lowerleg.R', offset: [0, 0.01, 0.04], pole: [-1, 0, -0.3], w: 'always'}], keys: [
    {hips: [46, 0, 0], head: [-26, 0, 0], upperleg: [0.32, -0.85, 0.4], lowerleg: [-0.12, -0.95, -0.25], upperlegR: [0.2, -0.88, 0.4], lowerlegR: [-0.25, -0.92, -0.25], grip: 0.3},
    {hips: [46, 0, 0], head: [-26, 0, 0], upperleg: [-0.2, -0.88, 0.4], lowerleg: [0.25, -0.92, -0.25], upperlegR: [-0.32, -0.85, 0.4], lowerlegR: [0.12, -0.95, -0.25], grip: 0.3},
  ]},
  rollerBack: {anchor: 'lying', surface: 0.01, hold: true, view: [75, 20, 0.16], props: ['mat', 'roller'], reach: [FOOT_DOWN('L'), FOOT_DOWN('R')], keys: [
    {...LYING_KNEES, upperarm: [0.2, -0.95, 0.1], lowerarm: [0.15, -0.95, 0.1]},
    {...LYING_KNEES, chest: [-14, 0, 0], neck: [-8, 0, 0], upperarm: [0.25, 0.97, 0], lowerarm: [0.2, 0.97, 0.05]},
  ]},
  // ---- More patterns, so every exercise in the library has a demonstration. ----
  calfRaise: {anchor: 'feet', view: [70, 6, 0.35], props: ['dumbbells'], keys: [
    {...LEGS, upperarm: [0.06, -1, 0.06], lowerarm: [0.04, -1, 0.04], twist: -16, foot: [0, 0, 0]},
    {...LEGS, upperarm: [0.06, -1, 0.06], lowerarm: [0.04, -1, 0.04], twist: -16, foot: [30, 0, 0], lift: 0.085},
  ]},
  frontRaise: {anchor: 'feet', view: [60, 8, 0.6, 1.1], props: ['dumbbells'], keys: [
    {...LEGS, upperarm: [0.08, -1, 0.1], lowerarm: [0.06, -1, 0.12], twist: 78},
    {...LEGS, upperarm: [0.12, 0.05, 1], lowerarm: [0.1, 0.05, 1], twist: 78},
  ]},
  uprightRow: {anchor: 'feet', view: [30, 6, 0.62], props: ['barbell'], keys: [
    {...LEGS, upperarm: [0.06, -1, 0.12], lowerarm: [-0.1, -1, 0.1], twist: 78},
    {...LEGS, upperarm: [0.92, 0.15, 0.3], lowerarm: [-0.8, 0.4, 0.3], twist: 78},
  ]},
  reverseFly: {anchor: 'feet', view: [35, 14, 0.45], props: ['dumbbells'], keys: [
    {...BENT_OVER, upperarm: [0.06, -1, 0.08], lowerarm: [0.04, -1, 0.1], twist: -16},
    {...BENT_OVER, upperarm: [1, -0.12, 0], lowerarm: [1, -0.2, 0.08], twist: -16},
  ]},
  shrug: {anchor: 'feet', view: [25, 6, 0.65], props: ['dumbbells'], keys: [
    {...LEGS, upperarm: [0.06, -1, 0.04], lowerarm: [0.04, -1, 0.04], twist: -16},
    {...LEGS, upperarm: [0.06, -1, 0.04], lowerarm: [0.04, -1, 0.04], twist: -16, clavicle: [0, 0, 14]},
  ]},
  fly: {anchor: 'lying', surface: 0.43, view: [38, 30, 0.3], props: ['bench', 'dumbbells'], keys: [
    {...BENCH_LEGS, upperarm: [0.1, -0.05, 1], lowerarm: [0.04, -0.05, 1], twist: -35},
    {...BENCH_LEGS, upperarm: [1, -0.05, -0.2], lowerarm: [0.95, -0.05, 0.3], twist: -35},
  ]},
  cableFly: {anchor: 'feet', view: [30, 8, 0.6, 1.1], keys: [
    {...LEGS, hips: [12, 0, 0], upperarm: [0.9, 0.3, -0.25], lowerarm: [0.85, 0.2, 0.25], grip: 1},
    {...LEGS, hips: [12, 0, 0], upperarm: [0.3, -0.3, 0.9], lowerarm: [-0.2, -0.25, 0.95], grip: 1},
  ]},
  pullover: {anchor: 'lying', surface: 0.43, view: [70, 22, 0.3], props: ['bench', 'onedumbbell'], keys: [
    {...BENCH_LEGS, upperarm: [0.12, 0.95, -0.3], lowerarm: [0.08, 0.95, -0.3]},
    {...BENCH_LEGS, upperarm: [0.12, 0.1, 1], lowerarm: [0.06, 0.1, 1]},
  ]},
  dip: {anchor: 'hands', hang: 0.5, view: [55, 6, 0.62, 1.2], props: ['dipbars'], keys: [
    {upperarm: [0.14, -1, 0.02], lowerarm: [0.1, -1, 0.04], upperleg: [0.08, -1, 0.15], lowerleg: [0.06, -0.5, -0.86], foot: [30, 0, 0], twist: -16},
    {hips: [15, 0, 0], upperarm: [0.18, -0.45, -0.87], lowerarm: [0.08, -1, 0.06], upperleg: [0.08, -1, 0.15], lowerleg: [0.06, -0.5, -0.86], foot: [30, 0, 0], twist: -16},
  ]},
  skullCrusher: {anchor: 'lying', surface: 0.43, view: [70, 22, 0.32], props: ['bench', 'barbell'], keys: [
    {...BENCH_LEGS, upperarm: [0.1, 0.2, 0.98], lowerarm: [0.04, 0.2, 0.98], twist: 55},
    {...BENCH_LEGS, upperarm: [0.1, 0.2, 0.98], lowerarm: [0.03, 0.9, -0.42], twist: 55},
  ]},
  kickback: {anchor: 'feet', view: [80, 8, 0.45], props: ['dumbbells'], keys: [
    {...BENT_OVER, upperarm: [0.1, -0.4, -0.92], lowerarm: [0.05, -1, 0.05], twist: -16},
    {...BENT_OVER, upperarm: [0.1, -0.4, -0.92], lowerarm: [0.08, -0.4, -0.92], twist: -16},
  ]},
  wristCurl: {anchor: 'seated', seatFoot: 'L', view: [70, 14, 0.4], props: ['seat', 'dumbbells'], keys: [
    {...SITTING, hips: [28, 0, 0], upperarm: [0.12, -0.85, 0.5], lowerarm: [0.06, -0.05, 1], hand: [0.05, -0.6, 0.8], twist: -73, grip: 1},
    {...SITTING, hips: [28, 0, 0], upperarm: [0.12, -0.85, 0.5], lowerarm: [0.06, -0.05, 1], hand: [0.05, 0.55, 0.83], twist: -73, grip: 1},
  ]},
  legExtension: {anchor: 'seated', seatFoot: 'L', view: [75, 8, 0.38], props: ['seat'], keys: [
    {...SITTING, upperarm: [0.25, -1, 0], lowerarm: [0.2, -1, 0.1], grip: 0.7},
    {...SITTING, lowerleg: [0.08, 0, 1], upperarm: [0.25, -1, 0], lowerarm: [0.2, -1, 0.1], grip: 0.7},
  ]},
  lyingLegCurl: {anchor: 'prone', surface: 0.43, view: [80, 14, 0.3], props: ['bench'], keys: [
    {upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], foot: [0, 0, 0], upperarm: [0.45, 0.6, 0.35], lowerarm: [0.1, 0.45, 0.6], grip: 0.8},
    {upperleg: [0.08, -1, 0], lowerleg: [0.06, -0.15, -0.99], foot: [0, 0, 0], upperarm: [0.45, 0.6, 0.35], lowerarm: [0.1, 0.45, 0.6], grip: 0.8},
  ]},
  legPress: {anchor: 'lying', surface: 0.45, view: [75, 14, 0.35], props: ['bench'], keys: [
    {upperleg: [0.15, 0.35, 0.92], lowerleg: [0.1, -0.7, 0.7], upperarm: [0.25, -0.95, -0.1], lowerarm: [0.2, -0.95, 0], grip: 0.8},
    {upperleg: [0.12, -0.45, 0.88], lowerleg: [0.12, -0.45, 0.88], upperarm: [0.25, -0.95, -0.1], lowerarm: [0.2, -0.95, 0], grip: 0.8},
  ]},
  bridge: {anchor: 'shoulders', surface: 0.01, view: [75, 14, 0.18], props: ['mat'],
    reach: [FOOT_DOWN('L'), FOOT_DOWN('R')], keys: [
    {...LYING_KNEES, upperarm: [0.25, -0.95, -0.05], lowerarm: [0.2, -0.95, 0]},
    {...LYING_KNEES, hips: [-26, 0, 0], neck: [30, 0, 0], head: [8, 0, 0], upperarm: [0.25, -0.95, -0.05], lowerarm: [0.2, -0.95, 0]},
  ]},
  hipAbduction: {anchor: 'footR', view: [10, 6, 0.5], keys: [
    {...STAND, ...RIGHT_STAND},
    {...STAND, ...RIGHT_STAND, upperleg: [0.55, -0.83, 0.02], lowerleg: [0.55, -0.83, -0.02]},
  ]},
  hipExtension: {anchor: 'footR', view: [80, 6, 0.5], keys: [
    {...STAND, ...RIGHT_STAND},
    {...STAND, ...RIGHT_STAND, hips: [12, 0, 0], upperleg: [0.1, -0.8, -0.6], lowerleg: [0.1, -0.85, -0.5]},
  ]},
  backExtension: {anchor: 'feet', armsWith: 'chest', view: [80, 8, 0.45], keys: [
    {...LEGS, hips: [75, 0, 0], neck: [-10, 0, 0], ...ARMS_CROSSED},
    {...LEGS, hips: [-5, 0, 0], ...ARMS_CROSSED},
  ]},
  legRaise: {anchor: 'lying', surface: 0.01, view: [75, 18, 0.18], props: ['mat'], keys: [
    {upperleg: [0.08, -1, -0.1], lowerleg: [0.08, -1, -0.05], upperarm: [0.25, -0.95, -0.05], lowerarm: [0.2, -0.95, 0]},
    {upperleg: [0.06, 0.05, 1], lowerleg: [0.06, 0.05, 1], upperarm: [0.25, -0.95, -0.05], lowerarm: [0.2, -0.95, 0]},
  ]},
  hangingLegRaise: {anchor: 'hands', view: [60, 4, 0.7, 1.3], props: ['pullbar'], keys: [
    {upperarm: [0.38, 1, 0.02], lowerarm: [0.22, 1, 0.02], twist: -71, upperleg: [0.08, -1, 0.05], lowerleg: [0.06, -1, 0], foot: [20, 0, 0]},
    {upperarm: [0.38, 1, 0.02], lowerarm: [0.22, 1, 0.02], twist: -71, upperleg: [0.06, -0.05, 1], lowerleg: [0.06, -0.05, 1], foot: [20, 0, 0]},
  ]},
  russianTwist: {anchor: 'floorSit', armsWith: 'chest', view: [20, 20, 0.25], props: ['ball'], keys: [
    {...FLOOR_SIT, chest: [0, 35, 0], spineLow: [0, 10, 0], ...HANDS_TOGETHER},
    {...FLOOR_SIT, chest: [0, -35, 0], spineLow: [0, -10, 0], ...HANDS_TOGETHER},
  ]},
  sideBend: {anchor: 'feet', view: [10, 6, 0.55], props: ['dumbbells'], keys: [
    {...LEGS, upperarm: [0.08, -1, 0.02], lowerarm: [0.06, -1, 0.04], twist: -16},
    {...LEGS, spineLow: [0, 0, 12], chest: [0, 0, 14], upperarm: [0.08, -1, 0.02], lowerarm: [0.06, -1, 0.04], twist: -16},
  ]},
  plank: {anchor: 'plank', hold: true, view: [75, 16, 0.15], keys: [
    {...PLANK_LEGS, upperarm: [0.2, -0.05, 1], lowerarm: [0.05, 1, 0.05], hand: [0, 1, 0], grip: 0},
    {...PLANK_LEGS, hips: [8, 0, 0], upperarm: [0.2, -0.05, 1], lowerarm: [0.05, 1, 0.05], hand: [0, 1, 0], grip: 0},
  ]},
  mountainClimber: {anchor: 'plank', view: [75, 16, 0.18], keys: [
    {...PUSH_ARMS, foot: [0, 0, 0], upperleg: [0.1, 0.75, 0.55], lowerleg: [0.05, -0.95, 0.18], upperlegR: [-0.08, -1, 0], lowerlegR: [-0.08, -1, 0]},
    {...PUSH_ARMS, foot: [0, 0, 0], upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], upperlegR: [-0.1, 0.75, 0.55], lowerlegR: [-0.05, -0.95, 0.18]},
  ]},
  jumpingJack: {anchor: 'feet', hop: 0.07, view: [10, 6, 0.55, 1.15], keys: [
    {...STAND},
    {upperleg: [0.3, -0.95, 0.02], lowerleg: [0.3, -0.95, -0.02], upperarm: [0.55, 0.83, 0], lowerarm: [0.45, 0.9, 0]},
  ]},
  run: {anchor: 'ground', hop: 0.03, view: [75, 6, 0.5], keys: [RUN_A, mirrorKey(RUN_A)]},
  walk: {anchor: 'ground', view: [75, 6, 0.5], keys: [WALK_A, mirrorKey(WALK_A)]},
  farmerWalk: {anchor: 'ground', view: [60, 6, 0.5], props: ['dumbbells'], keys: [
    {...WALK_A, upperarm: [0.12, -1, 0.02], lowerarm: [0.08, -1, 0.02], upperarmR: undefined, lowerarmR: undefined, twist: -16},
    {...mirrorKey(WALK_A), upperarm: [0.12, -1, 0.02], lowerarm: [0.08, -1, 0.02], upperarmR: undefined, lowerarmR: undefined, twist: -16},
  ]},
  cycle: {anchor: 'seated', seatFoot: 'R', view: [80, 8, 0.4], props: ['seat'], keys: [CYCLE_A, mirrorKey(CYCLE_A)]},
  thruster: {anchor: 'feet', view: [60, 8, 0.55, 1.15], props: ['barbell'], keys: [
    {hips: [25, 0, 0], head: [-10, 0, 0], upperleg: [0.36, -0.22, 0.9], lowerleg: [0.16, -0.93, -0.33], upperarm: [0.3, -0.15, 0.94], lowerarm: [-0.45, 0.85, -0.25], twist: -5},
    {...LEGS, upperarm: [0.25, 1, 0.05], lowerarm: [0.12, 1, 0.04], twist: -66},
  ]},
  twist: {anchor: 'feet', armsWith: 'chest', view: [15, 10, 0.55], keys: [
    {...LEGS, chest: [0, 40, 0], spineLow: [0, 12, 0], ...HANDS_TOGETHER, grip: 0.9},
    {...LEGS, chest: [0, -40, 0], spineLow: [0, -12, 0], ...HANDS_TOGETHER, grip: 0.9},
  ]},
  rollout: {anchor: 'quadruped', handsUp: 0.09, view: [80, 14, 0.18], props: ['wheel'], keys: [
    {upperleg: [0.1, 0, 1], lowerleg: [0.05, -1, 0.05], foot: [0, 0, 0], upperarm: [0.12, 0.05, 1], lowerarm: [0.08, 0.05, 1], twist: 55, grip: 1},
    {upperleg: [0.1, 0.55, 0.83], lowerleg: [0.05, -1, 0.05], foot: [0, 0, 0], upperarm: [0.12, 0.9, 0.42], lowerarm: [0.1, 0.9, 0.42], twist: 55, grip: 1},
  ]},
  stepUp: {anchor: 'footL', plant: [0, 0.33, 0.28], view: [80, 8, 0.5], props: ['box'],
    reach: [{leg: 'R', at: [0, 0.08, -0.12], pole: [0, 0, 1], w: 'out'}], keys: [
    {upperleg: [0.1, -0.5, 0.86], lowerleg: [0.08, -1, 0.05], ...RIGHT_STAND, upperarm: STAND.upperarm, lowerarm: STAND.lowerarm},
    {...STAND, ...RIGHT_STAND},
  ]},
  battleRopes: {anchor: 'feet', view: [60, 8, 0.45], keys: [ROPES_A, mirrorKey(ROPES_A)]},
  slam: {anchor: 'feet', view: [70, 8, 0.5, 1.15], props: ['ball'], keys: [
    {...STAND, upperarm: [0.15, 1, 0.1], lowerarm: [0.1, 1, 0.15], grip: 0.4},
    {hips: [40, 0, 0], upperleg: [0.25, -0.6, 0.76], lowerleg: [0.15, -0.93, -0.3], upperarm: [0.12, -0.75, 0.65], lowerarm: [0.05, -0.85, 0.5], grip: 0.4},
  ]},
  chestPass: {anchor: 'feet', view: [65, 8, 0.6], props: ['ball'], keys: [
    {...LEGS, upperarm: [0.5, -0.75, -0.4], lowerarm: [-0.25, 0.1, 0.96], grip: 0.4},
    {...LEGS, upperarm: [0.15, 0.05, 1], lowerarm: [0.05, 0.05, 1], grip: 0.4},
  ]},
  cobra: {anchor: 'prone', surface: 0.01, hold: true, view: [75, 14, 0.15], props: ['mat'],
    reach: [{arm: 'L', hold: 'start', pole: [0.3, -0.6, -1], w: 'always'}, {arm: 'R', hold: 'start', pole: [-0.3, -0.6, -1], w: 'always'}], keys: [
    {upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], foot: [0, 0, 0], upperarm: [0.35, -0.7, -0.62], lowerarm: [0.05, 0.25, 0.97], hand: [0, 1, 0.1], grip: 0},
    {chest: [-30, 0, 0], spineLow: [-25, 0, 0], neck: [-10, 0, 0], upperleg: [0.08, -1, 0], lowerleg: [0.08, -1, 0], foot: [0, 0, 0], upperarm: [0.2, -0.2, 0.97], lowerarm: [0.1, 0, 1], hand: [0, 1, 0.1], grip: 0},
  ]},
  butterfly: {anchor: 'floorSit', hold: true, view: [20, 20, 0.25],
    reach: [{arm: 'L', to: 'foot.L', offset: [0, 0.02, 0.02], pole: [1, 0, 0], w: 'always'}, {arm: 'R', to: 'foot.R', offset: [0, 0.02, 0.02], pole: [-1, 0, 0], w: 'always'}], keys: [
    {upperleg: [0.75, 0.15, 0.65], lowerleg: [-0.55, -0.1, 0.83], foot: [0, 0, -30], grip: 0.6},
    {hips: [25, 0, 0], upperleg: [0.75, 0.15, 0.65], lowerleg: [-0.55, -0.1, 0.83], foot: [0, 0, -30], grip: 0.6},
  ]},
  nordic: {anchor: 'kneel', armsWith: 'chest', view: [80, 8, 0.35], keys: [
    {upperleg: [0.1, -1, 0.02], lowerleg: [0.05, -0.02, -1], foot: [60, 0, 0], ...ARMS_CROSSED},
    {hips: [40, 0, 0], upperleg: [0.1, -0.75, 0.66], lowerleg: [0.05, -0.02, -1], foot: [60, 0, 0], ...ARMS_CROSSED},
  ]},
  deadBug: {anchor: 'lying', surface: 0.01, view: [65, 22, 0.18], props: ['mat'], keys: [DEAD_BUG_A, mirrorKey(DEAD_BUG_A)]},
  bicycleCrunch: {anchor: 'lying', surface: 0.01, armsWith: 'chest', view: [65, 22, 0.18], props: ['mat'], keys: [
    {...BICYCLE_A, chest: [25, 25, 0]},
    {...mirrorKey(BICYCLE_A), chest: [25, -25, 0]},
  ]},
  vUp: {anchor: 'lying', surface: 0.01, view: [75, 18, 0.2], props: ['mat'], keys: [
    {upperleg: [0.08, -1, -0.1], lowerleg: [0.08, -1, -0.05], upperarm: [0.15, 0.98, -0.1], lowerarm: [0.1, 0.98, -0.1]},
    {spineLow: [25, 0, 0], chest: [35, 0, 0], neck: [10, 0, 0], upperleg: [0.06, 0.35, 0.94], lowerleg: [0.06, 0.35, 0.94], upperarm: [0.15, -0.3, 0.94], lowerarm: [0.1, -0.4, 0.9]},
  ]},
};
export const MOTION_IDS = Object.keys(MOTIONS);
// For tests: pose a body for one motion and read the joints (blend t: 0 = first key, 1 = second key).
export function demoJoints(rig, model, record, id, t) {
  const {pos, H} = shapeBody(model, record), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(model.indices, 1));
  const fig = rigFigure(rig, g, new THREE.MeshBasicMaterial(), pos, H, model.segments, MOTIONS[id]);
  fig.tick(t >= 1 ? 1.4 : t <= 0 ? 0 : 0.7); return fig.joints();
}
// Closing the hand: degrees per joint at full grip; where a handle sits (fraction wrist -> knuckles, distance off the palm / height).
const FINGER_CURL = [70, 95, 55], THUMB_CURL = [40, 30, 35], PALM_SIDE = 1, GRIP_ALONG = 0.95, GRIP_OUT = 0.018;
const LIMBS = [['upperarm', 'lowerarm'], ['lowerarm', 'hand'], ['upperleg', 'lowerleg'], ['lowerleg', 'foot']];
const SPINE = ['hips', 'spineLow', 'chest', 'neck', 'head'], ZERO = [0, 0, 0];
const ease = t => t * t * (3 - 2 * t);

// Rigged figure for one motion: returns {mesh, props, tick(seconds)}.
function rigFigure(rig, geometry, material, pos, H, segments, motion) {
  const heads = rig.bones.map(b => {
    const c = [0, 0, 0];
    for (const i of b.ring) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / b.ring.length;
    return c.map((x, k) => x + b.offset[k] * H);
  });
  const bones = rig.bones.map((b, i) => {
    const bone = new THREE.Bone(), p = heads[i], q = b.parent < 0 ? [0, 0, 0] : heads[b.parent];
    bone.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]); return bone;
  });
  rig.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); });
  geometry.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(rig.index, 4));
  geometry.setAttribute('skinWeight', new THREE.Uint8BufferAttribute(rig.weight, 4, true));
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false;

  const id = name => rig.byName.get(name), V = a => new THREE.Vector3(...a);
  const restDir = new Map();
  for (const side of ['L', 'R']) {
    for (const [a, b] of LIMBS) restDir.set(`${a}.${side}`, V(heads[id(`${b}.${side}`)]).sub(V(heads[id(`${a}.${side}`)])).normalize());
    restDir.set(`hand.${side}`, V(heads[id(`finger3-1.${side}`)]).sub(V(heads[id(`hand.${side}`)])).normalize());
  }
  // Hands: knuckle line (index -> little finger) and palm normal, from the left hand, mirrored for the right.
  const palm = {};
  {
    const P = n => V(heads[id(n + '.L')]), across = P('finger2-1').sub(P('finger5-1')).normalize();
    const along = P('finger2-1').add(P('finger5-1')).multiplyScalar(0.5).sub(P('hand')).normalize();
    const normal = new THREE.Vector3().crossVectors(along, across).normalize().multiplyScalar(PALM_SIDE);
    const m = v => new THREE.Vector3(-v.x, v.y, v.z);
    palm.L = {across, along, normal}; palm.R = {across: m(across), along: m(along), normal: m(normal)};
  }
  // Finger curl axes: across each phalanx, so a positive angle closes the finger towards the palm.
  const curlAxis = new Map();
  for (const side of ['L', 'R']) for (let f = 1; f <= 5; f++) for (let k = 1; k <= 3; k++) {
    const a = V(heads[id(`finger${f}-${Math.min(k, 2)}.${side}`)]), b = V(heads[id(`finger${f}-${Math.min(k, 2) + 1}.${side}`)]);
    curlAxis.set(`finger${f}-${k}.${side}`, new THREE.Vector3().crossVectors(b.sub(a).normalize(), f === 1 ? palm[side].along : palm[side].normal).normalize());
  }
  const anchor = motion.anchor, deg = Math.PI / 180;
  const BACK = ['lying', 'shoulders'], FRONT = ['plank', 'quadruped', 'prone'];
  const frame = new THREE.Quaternion().setFromEuler(new THREE.Euler(BACK.includes(anchor) ? -Math.PI / 2 : FRONT.includes(anchor) ? Math.PI / 2 : 0, 0, 0));
  // turn: extra whole-body rotation found by an anchor (planks pivot on the toes); limbs turn with it.
  const turn = new THREE.Quaternion(), limbFrame = new THREE.Quaternion(), limbFrameInv = new THREE.Quaternion();
  // How far the back (lying) or belly (prone) sticks out from the hip joint.
  let backDepth = 0, frontDepth = 0;
  { let minZ = Infinity, maxZ = -Infinity; for (let i = 0; i < segments.length; i++) if (segments[i] === 0) { minZ = Math.min(minZ, pos[i * 3 + 2]); maxZ = Math.max(maxZ, pos[i * 3 + 2]); } backDepth = heads[0][2] - minZ; frontDepth = maxZ - heads[0][2]; }
  const restHips = V(heads[0]), restFeet = V(heads[id('foot.L')]).add(V(heads[id('foot.R')])).multiplyScalar(0.5), restFootL = V(heads[id('foot.L')]);
  const plantSide = anchor === 'footR' ? 'R' : 'L', restPlant = V(heads[id('foot.' + plantSide)]).add(V(motion.plant || [0, 0, 0]));
  const worldQ = bones.map(() => new THREE.Quaternion()), worldP = bones.map(() => new THREE.Vector3());
  const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), euler = new THREE.Euler();
  const lerp3 = (a = [0, 0, 0], b = a, t) => a.map((x, k) => x + (b[k] - x) * t), lerpN = (a, b, t) => a + (b - a) * t;
  const HELD = ['dumbbells', 'onedumbbell', 'barbell', 'cable', 'pullbar', 'kettlebell'], baseGrip = (motion.props || []).some(p => HELD.includes(p)) ? 1 : 0.2;
  const mirror = d => d && [-d[0], d[1], d[2]];
  let over = null; // limb directions solved by IK, by bone name
  const keyFor = (key, base, side) => over?.[`${base}.${side}`] ?? (side === 'R' ? key[base + 'R'] ?? (base === 'foot' ? key.foot : mirror(key[base])) : key[base]);
  const avg = (a, b) => worldP[id(a)].clone().add(worldP[id(b)]).multiplyScalar(0.5);

  // Forward kinematics for blend t with the root at rootQ/rootP; fills worldQ/worldP.
  function fk(t, rootQ, rootP) {
    const [A, B] = motion.keys;
    rig.bones.forEach((b, i) => {
      const bone = bones[i], [base, side] = b.name.split('.');
      if (b.parent < 0) { bone.quaternion.copy(rootQ); bone.position.copy(rootP); worldQ[0].copy(rootQ); worldP[0].copy(rootP); return; }
      const parentQ = worldQ[b.parent];
      if (SPINE.includes(base)) {
        const e = lerp3(A[base] ?? ZERO, B[base] ?? ZERO, t);
        bone.quaternion.setFromEuler(euler.set(e[0] * deg, e[1] * deg, e[2] * deg));
      } else if (base === 'foot') {
        const a = keyFor(A, 'foot', side);
        if (a) { const e = lerp3(a, keyFor(B, 'foot', side), t); bone.quaternion.setFromEuler(euler.set(e[0] * deg, e[1] * deg, e[2] * deg)); }
        else bone.quaternion.copy(parentQ).invert(); // flat on the floor
      } else if (base === 'clavicle') {
        const e = lerp3(A.clavicle ?? ZERO, B.clavicle ?? ZERO, t), m = side === 'R' ? -1 : 1;
        bone.quaternion.setFromEuler(euler.set(e[0] * deg, e[1] * deg * m, e[2] * deg * m));
      } else if (base.startsWith('finger')) {
        // Close the hand: grip 0 = relaxed, 1 = wrapped around a handle.
        const g = lerpN(A.grip ?? baseGrip, B.grip ?? A.grip ?? baseGrip, t), f = +base[6], k = +base[8];
        bone.quaternion.setFromAxisAngle(curlAxis.get(b.name), (f === 1 ? THUMB_CURL : FINGER_CURL)[k - 1] * g * deg);
      } else if (keyFor(A, base, side)) {
        const a = keyFor(A, base, side), d = lerp3(a, keyFor(B, base, side) ?? a, t);
        const armFrame = motion.armsWith === 'chest' && ['upperarm', 'lowerarm', 'hand'].includes(base) && !over?.[b.name] ? worldQ[id('chest')] : limbFrame;
        tmpV.set(...d).normalize().applyQuaternion(armFrame).applyQuaternion(tmpQ.copy(parentQ).invert());
        bone.quaternion.setFromUnitVectors(restDir.get(b.name), tmpV);
        if (base === 'lowerarm') {
          // Forearm twist (degrees, + turns the left palm outwards; mirrored on the right).
          const tw = lerpN(A.twist ?? 0, B.twist ?? A.twist ?? 0, t) * deg * (side === 'R' ? -1 : 1);
          if (tw) bone.quaternion.premultiply(tmpQ.setFromAxisAngle(tmpV, tw));
        }
      } else bone.quaternion.identity();
      worldQ[i].copy(parentQ).multiply(bone.quaternion);
      worldP[i].copy(bone.position).applyQuaternion(parentQ).add(worldP[b.parent]);
    });
  }
  // Where each hand holds a handle: in front of the palm by the knuckles; axis along the knuckle line.
  function grips() {
    return ['L', 'R'].map(s => {
      const q = worldQ[id('hand.' + s)], knuckles = avg('finger2-1.' + s, 'finger5-1.' + s), wrist = worldP[id('hand.' + s)];
      const p = wrist.clone().lerp(knuckles, GRIP_ALONG).addScaledVector(palm[s].normal.clone().applyQuaternion(q), H * GRIP_OUT);
      p.axis = palm[s].across.clone().applyQuaternion(q); return p;
    });
  }
  const shiftAll = delta => { bones[0].position.add(delta); for (const p of worldP) p.add(delta); };
  let gripTarget = null, chestAt = null, kneesAt = null, seatShift = null;
  const held = new Map(); // reach targets fixed at the start of the motion
  function pose(t) {
    const e = lerp3(motion.keys[0].hips ?? ZERO, motion.keys[1].hips ?? ZERO, t);
    const rootQ = frame.clone().multiply(tmpQ.setFromEuler(euler.set(e[0] * deg, e[1] * deg, e[2] * deg)));
    turn.identity(); limbFrame.copy(frame); limbFrameInv.copy(frame).invert();
    fk(t, rootQ, restHips);
    if (anchor === 'feet') shiftAll(restFeet.clone().sub(avg('foot.L', 'foot.R')));
    else if (anchor === 'footL' || anchor === 'footR') shiftAll(restPlant.clone().sub(worldP[id('foot.' + plantSide)]));
    else if (anchor === 'lying') shiftAll(new THREE.Vector3(0, motion.surface + backDepth, H * 0.12).sub(worldP[0]));
    else if (anchor === 'prone') shiftAll(new THREE.Vector3(0, motion.surface + frontDepth, -H * 0.12).sub(worldP[0]));
    else if (anchor === 'shoulders') {
      // Bridges: the upper back stays on the floor while the hips rise.
      // Where the chest is when lying flat at the start (placed like 'lying').
      chestAt ??= worldP[id('chest')].clone().add(new THREE.Vector3(0, motion.surface + backDepth, H * 0.12).sub(worldP[0]));
      shiftAll(chestAt.clone().sub(worldP[id('chest')]));
    } else if (anchor === 'ground') {
      // Walking and running in place: the lower foot is on the floor.
      shiftAll(new THREE.Vector3(0, restFeet.y - Math.min(worldP[id('foot.L')].y, worldP[id('foot.R')].y), 0));
    } else if (anchor === 'floorSit') shiftAll(new THREE.Vector3(0, H * 0.055 - worldP[0].y, 0));
    else if (anchor === 'kneel') {
      kneesAt ??= new THREE.Vector3(0, 0.06, avg('lowerleg.L', 'lowerleg.R').z);
      shiftAll(kneesAt.clone().sub(avg('lowerleg.L', 'lowerleg.R')));
    }
    else if (anchor === 'hands') {
      // Bar height: hanging straight, feet clear the floor.
      const g = grips(), hold = g[0].clone().add(g[1]).multiplyScalar(0.5);
      if (!gripTarget) gripTarget = new THREE.Vector3(0, hold.y - avg('foot.L', 'foot.R').y + (motion.hang ?? 0.18), 0);
      shiftAll(gripTarget.clone().sub(hold));
    } else if (anchor === 'plank' || anchor === 'quadruped') {
      // Pivot around the toes (plank) or knees (all fours) until the hands reach the floor.
      // Heights above the floor: wrists ~4 cm, ankles on the toes ~10 cm, knees ~6 cm.
      const [j, dy, y0, z0] = anchor === 'plank' ? ['foot', -0.06, 0.1, -H * 0.5] : ['lowerleg', 0.01 + (motion.handsUp ?? 0), 0.06, -H * 0.18];
      const hands = avg('hand.L', 'hand.R'), far = anchor === 'plank' ? [j + '.L', j + '.R'].sort((a, b) => worldP[id(b)].distanceTo(hands) - worldP[id(a)].distanceTo(hands))[0] : null;
      const pivot = () => far ? worldP[id(far)].clone() : avg(j + '.L', j + '.R');
      const v = hands.sub(pivot()), r = Math.hypot(v.y, v.z);
      const wrap = x => Math.atan2(Math.sin(x), Math.cos(x)), c = Math.acos(clamp(dy / r, -1, 1)), phi = Math.atan2(v.z, v.y);
      const a = [wrap(c - phi), wrap(-c - phi)].sort((p, q) => Math.abs(p) - Math.abs(q))[0];
      // Planks are rigid, so the limbs turn with the body; on all fours the shins stay along the floor.
      turn.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
      if (anchor === 'plank') { limbFrame.copy(turn).multiply(frame); limbFrameInv.copy(limbFrame).invert(); }
      fk(t, turn.clone().multiply(rootQ), restHips);
      const p = pivot(); shiftAll(new THREE.Vector3(-avg(j + '.L', j + '.R').x, y0 - p.y, z0 - p.z));
    } else if (anchor === 'seated') {
      // Sitting: at the start the planted foot's ankle rests ~8 cm above the floor; the seat then stays put.
      seatShift ??= 0.08 - worldP[id('foot.' + motion.seatFoot)].y;
      shiftAll(new THREE.Vector3(0, seatShift, 0));
    }
    // Rising onto the toes (lift) and jumps (hop).
    const rise = lerpN(motion.keys[0].lift ?? 0, motion.keys[1].lift ?? 0, t) + (motion.hop ?? 0) * Math.sin(Math.PI * t);
    if (rise) shiftAll(new THREE.Vector3(0, rise, 0));
    // Two-bone IK, blended in by weight w: the back leg of a lunge, hands reaching a foot or elbow.
    const solved = {};
    const ik = (upper, lower, end, target, pole, w = 1) => {
      const root = worldP[id(upper)], mid0 = worldP[id(lower)], end0 = worldP[id(end)];
      const a = mid0.distanceTo(root), b = end0.distanceTo(mid0), u = target.clone().sub(root), d = Math.min(u.length(), (a + b) * 0.999); u.normalize();
      const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), p = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
      const mid = root.clone().addScaledVector(u, a * cosA).addScaledVector(p, a * Math.sqrt(1 - cosA * cosA)), tip = root.clone().addScaledVector(u, d);
      const mix = (from, to) => from.normalize().lerp(to.normalize(), w).normalize().applyQuaternion(limbFrameInv).toArray();
      solved[upper] = mix(mid0.clone().sub(root), mid.clone().sub(root)); solved[lower] = mix(end0.clone().sub(mid0), tip.sub(mid));
    };
    // Solved in order, re-running FK after each so later targets see earlier results (a hand holding an IK'd ankle).
    const rootQ1 = bones[0].quaternion.clone(), rootP1 = bones[0].position.clone(), V3 = a => new THREE.Vector3(...a);
    const solve = (upper, lower, end, target, pole, w) => { ik(upper, lower, end, target, pole, w); over = solved; fk(t, rootQ1, rootP1); };
    if (motion.backFoot) solve('upperleg.R', 'lowerleg.R', 'foot.R', V3([heads[id('foot.R')][0], motion.backFootY ?? 0.11, restFootL.z - H * motion.backFoot]), V3([0, -0.4, 1]), 1);
    for (const r of motion.reach || []) {
      // r.arm / r.leg: side; r.to: joint; r.offset: x height; r.w: 'in' (default, with the motion), 'out' or 'always'.
      const side = r.arm || r.leg, [u, l, e] = r.arm ? ['upperarm', 'lowerarm', 'hand'] : ['upperleg', 'lowerleg', 'foot'];
      let target;
      if (r.hold === 'start') { const k = `${e}.${side}`; if (!held.has(k)) held.set(k, worldP[id(k)].clone()); target = held.get(k).clone(); }
      else if (r.at) target = V3(r.at).add(new THREE.Vector3(heads[id(`${e}.${side}`)][0], 0, 0));
      else target = worldP[id(r.to)].clone().addScaledVector(V3(r.offset || [0, 0, 0]), H);
      if (r.y != null) target.y = r.y;
      solve(`${u}.${side}`, `${l}.${side}`, `${e}.${side}`, target, V3(r.pole), r.w === 'always' ? 1 : r.w === 'out' ? 1 - t : t);
    }
    over = null;
    return grips();
  }

  // Simple equipment; each piece follows the grips through its update(grips).
  const props = new THREE.Group(), metal = new THREE.MeshStandardMaterial({color: '#3a3a3c', metalness: 0.7, roughness: 0.35}), pad = new THREE.MeshStandardMaterial({color: '#262628', roughness: 0.8});
  const cyl = (r, len, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), m);
  const dumbbell = () => { const g = new THREE.Group(); g.add(cyl(0.016, 0.3, metal)); for (const y of [-0.11, 0.11]) { const w = cyl(0.055, 0.07, metal); w.position.y = y; g.add(w); } return g; };
  const barbell = () => { const g = new THREE.Group(), bar = cyl(0.014, 1.75, metal); bar.rotation.z = Math.PI / 2; g.add(bar); for (const x of [-0.68, 0.68]) { const w = cyl(0.16, 0.05, metal); w.rotation.z = Math.PI / 2; w.position.x = x; g.add(w); } return g; };
  const up = new THREE.Vector3(0, 1, 0);
  const mid = grips => grips[0].clone().add(grips[1]).multiplyScalar(0.5);
  const updates = [];
  for (const p of motion.props || []) {
    if (p === 'bench') {
      const z = anchor === 'prone' ? -H * 0.12 + 0.4 : H * 0.12 - 0.4; // under the trunk, towards the head
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 1.15), pad); b.position.set(0, motion.surface - 0.035, z); props.add(b);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, motion.surface - 0.07, 0.9), metal); leg.position.set(0, (motion.surface - 0.07) / 2, z); props.add(leg);
    }
    if (p === 'ball') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshStandardMaterial({color: '#5a4636', roughness: 0.8})); props.add(b); updates.push(grips => b.position.copy(mid(grips))); }
    if (p === 'wheel') { const w = cyl(0.09, 0.06, metal); w.rotation.z = Math.PI / 2; props.add(w); updates.push(grips => w.position.copy(mid(grips))); }
    if (p === 'box') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.42), pad); props.add(b);
      updates.push(() => { if (b.userData.placed) return; b.userData.placed = true; const f = worldP[id('foot.' + plantSide)], top = f.y - 0.065; b.scale.y = top; b.position.set(0, top / 2, f.z + 0.04); });
    }
    if (p === 'dipbars') {
      const g = new THREE.Group(); props.add(g);
      updates.push(grips => {
        if (g.userData.placed) return; g.userData.placed = true;
        for (const k of [0, 1]) { const bar = cyl(0.02, 0.7, metal); bar.rotation.x = Math.PI / 2; bar.position.copy(grips[k]); g.add(bar);
          for (const dz of [-0.3, 0.3]) { const post = cyl(0.025, grips[k].y, metal); post.position.set(grips[k].x, grips[k].y / 2, grips[k].z + dz); g.add(post); } }
      });
    }
    if (p === 'mat') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.01, 1.8), new THREE.MeshStandardMaterial({color: '#3d5a4a', roughness: 0.9})); m.position.set(0, 0.005, H * 0.12 - 0.25); props.add(m); }
    if (p === 'barbell') { const g = barbell(); props.add(g); updates.push(grips => g.position.copy(mid(grips))); }
    if (p === 'dumbbells') { const d = [dumbbell(), dumbbell()]; props.add(...d); updates.push(grips => d.forEach((x, k) => { x.position.copy(grips[k]); x.quaternion.setFromUnitVectors(up, grips[k].axis); })); }
    if (p === 'onedumbbell') { const d = dumbbell(); props.add(d); updates.push(grips => { d.position.copy(mid(grips)); d.quaternion.setFromUnitVectors(up, mid(grips).sub(avg('lowerarm.L', 'lowerarm.R')).normalize()); }); }
    if (p === 'kettlebell') {
      // Handle between both hands; the bell hangs off it along the arms.
      const g = new THREE.Group(), handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 10, 24, Math.PI), metal), bell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), metal);
      handle.rotation.z = Math.PI; bell.position.y = -0.13; g.add(handle, bell); props.add(g);
      updates.push(grips => { const fore = avg('hand.L', 'hand.R').sub(avg('lowerarm.L', 'lowerarm.R')).normalize(); g.position.copy(mid(grips)); g.quaternion.setFromUnitVectors(up, fore.negate()); });
    }
    if (p === 'cable') {
      // Short bar between the hands, cable up to a pulley in front of the head.
      const bar = cyl(0.017, 0.46, metal), wire = cyl(0.006, 1, metal), pulley = cyl(0.05, 0.03, metal), top = new THREE.Vector3(0, H * 1.18, H * 0.3);
      bar.rotation.z = Math.PI / 2; pulley.rotation.z = Math.PI / 2; pulley.position.copy(top); props.add(bar, wire, pulley);
      updates.push(grips => { const m = mid(grips), d = top.clone().sub(m); bar.position.copy(m); wire.position.copy(m).addScaledVector(d, 0.5); wire.scale.y = d.length(); wire.quaternion.setFromUnitVectors(up, d.normalize()); });
    }
    if (p === 'seat') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.4), pad); props.add(box);
      updates.push(() => { if (box.userData.placed) return; box.userData.placed = true; const top = worldP[0].y - H * 0.06; box.scale.y = top; box.position.set(0, top / 2, worldP[0].z + 0.12); });
    }
    if (p === 'roller') {
      const r = cyl(0.075, 0.9, new THREE.MeshStandardMaterial({color: '#3f6f8f', roughness: 0.7})); r.rotation.z = Math.PI / 2; props.add(r);
      updates.push(() => { if (r.userData.placed) return; r.userData.placed = true; r.position.set(0, 0.075, worldP[id('chest')].z); });
    }
    if (p === 'wall') {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.08), new THREE.MeshStandardMaterial({color: '#4a4744', roughness: 0.9})); props.add(w);
      updates.push(grips => { if (w.userData.placed) return; w.userData.placed = true; w.position.set(0, 1.1, Math.max(grips[0].z, grips[1].z) + 0.03 + 0.04); });
    }
    if (p === 'pullbar') {
      const g = new THREE.Group(), bar = cyl(0.016, 1.4, metal); bar.rotation.z = Math.PI / 2; g.add(bar); props.add(g);
      updates.push(() => {
        if (g.userData.placed) return; g.userData.placed = true; g.position.copy(gripTarget);
        for (const x of [-0.7, 0.7]) { const post = cyl(0.025, g.position.y, metal); post.position.set(x, -g.position.y / 2, 0); g.add(post); }
      });
    }
  }
  const place = grips => updates.forEach(u => u(grips));
  place(pose(0));
  // 3.6 s loop: move 1.4 s, pause, return 1.4 s, pause.
  return {mesh, props, joints: () => new Map(rig.bones.map((b, i) => [b.name, worldP[i].clone()])), tick(seconds) {
    // Stretches hold: ease in 1.6 s, hold 3.6 s, release 1.4 s, rest.
    const c = motion.hold ? (seconds % 7) / 7 : (seconds % 3.6) / 3.6, [i, h, o] = motion.hold ? [0.23, 0.74, 0.94] : [0.39, 0.5, 0.89];
    const t = c < i ? ease(c / i) : c < h ? 1 : c < o ? 1 - ease((c - h) / (o - h)) : 0;
    place(pose(t));
  }};
}

// MakeHuman macro values (0..1, 0.5 = average) from the measurements.
export function macros(r) {
  const sex = r.sex === 'female' ? 'female' : 'male', ref = REF[sex], weights = [];
  if (r.height && r.weight) { const bmi = r.weight / (r.height / 100) ** 2; weights.push(bmi <= 22 ? clamp((bmi - 16) / 12, 0, 0.5) : 0.5 + clamp((bmi - 22) / 40, 0, 0.5)); }
  if (r.body_fat) weights.push(r.body_fat <= ref.fat ? clamp(0.5 - (ref.fat - r.body_fat) / 24, 0, 0.5) : 0.5 + clamp((r.body_fat - ref.fat) / 50, 0, 0.5));
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
// Where fat usually collects first, so the yellow overlay lands where people actually carry it:
// men on the lower belly then the flanks; women on hips/thighs and the lower belly. A higher
// visceral fat level weights the belly more. Returns a per-vertex multiplier for fat thickness.
function fatPrior(model, pos, H, r) {
  const n = model.n, female = r.sex === 'female', prior = new Float32Array(n).fill(1);
  // Trunk centre depth per 2% height band, to tell the front of the belly from the back.
  const zSum = new Float32Array(50), zCnt = new Float32Array(50), band = y => Math.min(49, Math.max(0, Math.floor(y / H * 50)));
  for (let i = 0; i < n; i++) if (model.segments[i] === 0) { const b = band(pos[i * 3 + 1]); zSum[b] += pos[i * 3 + 2]; zCnt[b]++; }
  const belly = 1 + clamp(((r.visceral ?? 8) - 6) / 12, 0, 0.8);
  for (let i = 0; i < n; i++) {
    const seg = model.segments[i], y = pos[i * 3 + 1] / H, b = band(pos[i * 3 + 1]);
    const front = zCnt[b] && pos[i * 3 + 2] > zSum[b] / zCnt[b];
    if (seg === 0 && y >= 0.47 && y < 0.62) prior[i] = front ? (female ? 1.5 : 2.1) * belly : (female ? 1.2 : 1.5);
    else if (seg === 0 && y >= 0.62 && y < 0.70 && front) prior[i] = female ? 1.1 : 1.4;
    else if ((seg === 3 || seg === 4) && y >= 0.34 && y < 0.50) prior[i] = female ? 1.35 : 0.9;
  }
  return prior;
}

function segmentDeviation(r, prefix, scale) {
  const segs = ['la', 'ra', 'trunk', 'll', 'rl'], vals = segs.map(s => r[prefix + s]);
  const known = vals.filter(v => v != null);
  if (!known.length) return null;
  const mean = known.reduce((a, b) => a + b) / known.length;
  return Object.fromEntries(segs.map((s, i) => [s, vals[i] == null ? 0 : clamp((vals[i] - mean) / scale, -1, 1)]));
}

// The muscle view uses a lean reference frame: total weight, fat and tape girths
// describe the skin silhouette and must not inflate this view.
export function muscleOnlyRecord(record) {
  const sex = record.sex === 'female' ? 'female' : 'male';
  const height = record.height || (sex === 'female' ? 160 : 172);
  const r = {sex, height, weight: 22 * (height / 100) ** 2, muscle: record.muscle};
  for (const seg of ['la', 'ra', 'trunk', 'll', 'rl']) {
    if (record['mus_' + seg] != null) r['mus_' + seg] = record['mus_' + seg];
    if (record['musp_' + seg] != null) r['musp_' + seg] = record['musp_' + seg];
  }
  return r;
}
export function shapeBody(model, r, lean = false) {
  const {n, base, segments, targets, locals} = model, {sex, muscle} = macros(r), ref = REF[sex];
  const weight = lean ? Math.min(macros(r).weight, 0.15) : macros(r).weight;
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
    if (fat && !lean) {
      for (const part of ['upperarm', 'lowerarm']) apply(pos, `${side}-${part}-fat`, fat[arm]);
      for (const part of ['upperleg', 'lowerleg']) apply(pos, `${side}-${part}-fat`, fat[leg]);
    }
  }
  if (mus) { apply(pos, 'torso-muscle-pectoral', mus.trunk); apply(pos, 'torso-muscle-dorsi', mus.trunk); }
  // Belly from visceral fat level (1-9 normal) and trunk fat; abdominal tone from body fat.
  // The 'pregnant' target is strong, so keep it subtle: level 16 -> ~0.35.
  const belly = (r.visceral != null ? clamp((r.visceral - 9) / 30, -0.1, 0.25) : 0) + (fat ? fat.trunk * 0.15 : 0);
  if (!lean) apply(pos, 'stomach-pregnant', clamp(belly, -0.3, 0.6));
  if (lean) apply(pos, 'stomach-tone', 1);
  else if (r.body_fat != null) apply(pos, 'stomach-tone', clamp((ref.fat - r.body_fat) / 12, -1, 1));

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
      const b = Math.floor(p[i * 3 + 1] / H * BINS); if (b < from - 1 || b > to + 1) continue;
      const e = ext[k][b], x = p[i * 3], z = p[i * 3 + 2];
      e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], z); e[3] = Math.max(e[3], z); e[4]++;
    }
    // A 1% slice is thinner than the mesh spacing and misses part of the ring: merge 3 bins.
    const merge = (bins, b) => [b - 1, b, b + 1].map(k => bins[k]).filter(Boolean).reduce((a, e) => [Math.min(a[0], e[0]), Math.max(a[1], e[1]), Math.min(a[2], e[2]), Math.max(a[3], e[3]), a[4] + e[4]], [Infinity, -Infinity, Infinity, -Infinity, 0]);
    const per = ext.map(bins => { const g = []; for (let b = from; b <= to; b++) { const e = merge(bins, b); if (e[4] >= 12) g.push((depthOnly ? perimeter((e[3] - e[2]) / 2, (e[3] - e[2]) / 2) : perimeter((e[1] - e[0]) / 2, (e[3] - e[2]) / 2)) * 100); } return g.length ? pick(...g) : 0; });
    return per.reduce((a, b) => a + b) / per.length;
  };
  // Fit each entered tape measurement with MakeHuman's measure targets (deltas scaled to metres).
  // Shoulder width: straight width across the shoulder tops (trunk + arms at ~82% of height),
  // which matches a tape laid across the back from shoulder tip to shoulder tip.
  const shoulderWidth = p => {
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < n; i++) {
      if (segments[i] > 2) continue;
      const b = Math.floor(p[i * 3 + 1] / H * 100); if (b < 81 || b > 83) continue;
      x0 = Math.min(x0, p[i * 3]); x1 = Math.max(x1, p[i * 3]);
    }
    return x1 > x0 ? (x1 - x0) * 100 : 0;
  };
  const fits = [
    ['shoulder', 'measure-shoulder-dist', [0, 1, 2], 82, 82, median],
    ['hip', 'measure-hips-circ', [0], 45, 55, Math.max],
    ['waist', 'measure-waist-circ', [0], 57, 61, median],
    ['chest', 'measure-bust-circ', [0], 69, 75, Math.max],
    ['arm', 'measure-upperarm-circ', [1, 2], 69, 73, median],
    ['thigh', 'measure-thigh-circ', [3, 4], 38, 47, Math.max],
    ['calf', 'measure-calf-circ', [3, 4], 12, 26, Math.max],
  ];
  // Girths not measured: what people of this sex, height, weight (and body fat) usually measure (ANSUR II + body-fat data).
  const usual = lean ? {} : predictGirths({...r, sex});
  // Two passes: neighbouring measures (waist/hip/bust) affect each other.
  for (let pass = 0; pass < (lean ? 0 : 2); pass++) for (const [key, name, segs, from, to, pick] of fits) {
    const target = r[key] || usual[key]; if (!target) continue;
    const measure = key === 'shoulder' ? shoulderWidth : p => girth(p, segs, from, to, pick, key === 'arm');
    const g0 = measure(pos); if (!g0 || Math.abs(target - g0) < 0.5) continue;
    const dir = target > g0 ? 1 : -1, probe = Float32Array.from(pos);
    apply(probe, name, dir, s);
    const g1 = measure(probe);
    if (Math.abs(g1 - g0) < 0.1) continue;
    apply(pos, name, dir * clamp((target - g0) / (g1 - g0), 0, 2.5), s);
  }
  const measured = Object.fromEntries(fits.map(([key, , segs, from, to, pick]) => [key, Math.round((key === 'shoulder' ? shoulderWidth(pos) : girth(pos, segs, from, to, pick, key === 'arm')) * 10) / 10]));
  return {pos, H, girths: measured};
}

const ANATOMY_NOISE = `
varying float vFat;
varying vec3 vObjPos;
varying vec3 vFiber;
varying vec3 vAnat;
varying float vTone;
varying vec3 vObjNormal;
varying vec3 vTint;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 hash3(vec3 p) { return vec3(hash(p), hash(p + 17.13), hash(p + 31.71)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec2 voronoi(vec3 x) {
  vec3 p = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k)), r = b - f + hash3(p + b); float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d1), sqrt(d2));
}
`;
// tint: per-segment colour instead of muscle red (the 'muscle per segment' view).
function anatomyMaterial(tint = false) {
  const material = new THREE.MeshStandardMaterial({roughness: 0.5, metalness: 0});
  if (tint) material.defines = {SEGMENT_TINT: ''};
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float fatAmt;\nattribute vec3 aFiber;\nattribute vec3 aAnat;\nattribute float aTone;\nattribute vec3 aTint;\nvarying vec3 vTint;\nvarying float vFat;\nvarying vec3 vObjPos;\nvarying vec3 vFiber;\nvarying vec3 vAnat;\nvarying float vTone;\nvarying vec3 vObjNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFat = fatAmt;\nvObjPos = position;\nvFiber = aFiber;\nvAnat = aAnat;\nvTone = aTone;\nvTint = aTint;\nvObjNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ANATOMY_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Fibres run along each muscle's direction: stripes vary across it on the surface.
        vec3 nrm = normalize(vObjNormal);
        vec3 fdir = vFiber - nrm * dot(vFiber, nrm);
        fdir = length(fdir) > 0.001 ? normalize(fdir) : vec3(0.0, 1.0, 0.0);
        vec3 crossDir = cross(fdir, nrm);
        vec3 perp = crossDir / max(length(crossDir), 0.001);
        float phase = dot(vObjPos, perp) * 900.0 + noise(vObjPos * 14.0) * 2.0;
        float footprint = fwidth(phase);
        float aa = 1.0 - smoothstep(0.6, 3.0, footprint);
        float fibres = sin(phase) * aa;
        // vAnat.x = distance (cm) to the muscle's edge: rounded bellies, darker grooves, thin fascia line.
        float edgeCm = vAnat.x, edgeW = fwidth(edgeCm);
        float belly = smoothstep(0.2, 4.0, edgeCm);
        float shade = 0.40 + 0.26 * belly + 0.13 * fibres * smoothstep(0.3, 1.5, edgeCm) + 0.03 * (noise(vObjPos * 22.0) - 0.5) + (vTone - 0.5) * 0.08;
        vec3 muscleCol = mix(vec3(0.38, 0.03, 0.04), vec3(0.86, 0.17, 0.16), shade);
        #ifdef SEGMENT_TINT
        muscleCol = mix(vTint * 0.42, min(vTint * 1.12, vec3(1.0)), shade);
        #endif
        vec3 tendonCol = mix(vec3(0.82, 0.72, 0.70), vec3(0.96, 0.91, 0.88), 0.6 + 0.07 * fibres);
        muscleCol = mix(muscleCol, tendonCol, smoothstep(0.15, 0.85, vAnat.y));
        muscleCol = mix(muscleCol, vec3(0.9, 0.76, 0.74), smoothstep(0.4, 0.6, vAnat.z));
        float fascia = 1.0 - smoothstep(0.02, 0.30 + edgeW, edgeCm);
        muscleCol = mix(muscleCol, vec3(0.93, 0.86, 0.84), fascia * 0.75 * (1.0 - smoothstep(0.4, 0.6, vAnat.z)));
        // Broad, soft variation instead of high-contrast cellular speckling.
        float fatTone = 0.5 + 0.16 * (noise(vObjPos * 9.0) - 0.5);
        vec3 fatCol = mix(vec3(0.84, 0.65, 0.34), vec3(1.0, 0.88, 0.57), fatTone);
        float fatMask = smoothstep(0.30, 0.70, vFat + (noise(vObjPos * 6.0) - 0.5) * 0.035);
        diffuseColor.rgb = mix(muscleCol, fatCol, fatMask);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.62, 0.40, smoothstep(0.5, 3.0, vAnat.x)), 0.68, smoothstep(0.30, 0.70, vFat));');

  };
  return material;
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
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.72, metalness: 0}), anatomy = anatomyMaterial(), anatomyTint = anatomyMaterial(true);
  let mesh = null, frame = 0, request = 0, demo = null, demoProps = null, playing = true, shownMotion = null;
  const clock = new THREE.Clock();

  async function update(record = {}, mode = 'shape') {
    const r = mode === 'muscle' ? muscleOnlyRecord(record) : record, sex = r.sex === 'female' ? 'female' : 'male', ticket = ++request;
    const motion = mode === 'focus' ? MOTIONS[r.motion] : null;
    const [model, rig] = await Promise.all([loadModel(sex), motion ? loadRig().catch(() => null) : null]);
    if (ticket !== request) return {estimated: GIRTHS.filter(k => !r[k])};
    const {pos, H} = shapeBody(model, r, mode === 'muscle'), geometry = new THREE.BufferGeometry();
    if (mode === 'composition' || mode === 'muscle' || mode === 'focus') {
      // Fat thickness per vertex = distance from the lean body. Yellow covers the thickest part of
      // this body; the covered share grows with body fat % (e.g. ~28% of the body at 42% fat).
      const lean = shapeBody(model, r, true).pos, fatAmt = new Float32Array(model.n), thick = new Float32Array(model.n);
      const skin = model.anatomy?.anat.array; // hands/feet/head have dense vertices: keep them out of the fat share
      for (let i = 0; i < model.n; i++) thick[i] = model.segments[i] === 5 || skin?.[i * 3 + 2] ? 0 : Math.hypot(pos[i * 3] - lean[i * 3], pos[i * 3 + 1] - lean[i * 3 + 1], pos[i * 3 + 2] - lean[i * 3 + 2]);
      const prior = fatPrior(model, pos, H, r); for (let i = 0; i < model.n; i++) thick[i] *= prior[i];
      const sorted = Array.from(thick).filter(t => t > 0).sort((a, b) => a - b), q = f => sorted[Math.floor(clamp(f, 0, 1) * (sorted.length - 1))] ?? 0;
      const fatPct = r.body_fat ?? (macros(r).weight * 40 + 5), cover = clamp((fatPct - (r.sex === 'female' ? 20 : 12)) / 80, 0.03, 0.35);
      const from = Math.max(q(1 - cover), 0.006), full = Math.max(q(1 - cover * 0.35), from + 0.004);
      if (mode === 'composition') for (let i = 0; i < model.n; i++) fatAmt[i] = clamp((thick[i] - from) / (full - from), 0, 1);
      geometry.setAttribute('fatAmt', new THREE.BufferAttribute(fatAmt, 1));
      const a = model.anatomy, zero3 = new THREE.BufferAttribute(new Float32Array(model.n * 3), 3);
      geometry.setAttribute('aFiber', a?.fiber ?? zero3);
      geometry.setAttribute('aAnat', a?.anat ?? zero3);
      geometry.setAttribute('aTone', a?.tone ?? new THREE.BufferAttribute(new Float32Array(model.n), 1));
      if (mode === 'focus') {
        // r.focus = {primary: ['quad', ...], secondary: [...]} in base muscle names.
        const primary = new Set(r.focus?.primary || []), secondary = new Set(r.focus?.secondary || []), muscleOf = a?.muscleOf || [];
        const tint = new Float32Array(model.n * 3);
        for (let i = 0; i < model.n; i++) {
          const name = muscleOf[a?.region[i]] || '', c = primary.has(name) ? FOCUS_PRIMARY : secondary.has(name) ? FOCUS_SECONDARY : FOCUS_IDLE;
          tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
        }
        geometry.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
      }
      if (mode === 'muscle') {
        const tint = new Float32Array(model.n * 3), segTint = SEG.map(seg => {
          const level = seg ? segmentLevel(r, seg, 'muscle') : null;
          return level == null ? STANDARD : level < 0.5 ? BELOW.clone().lerp(STANDARD, level * 2) : STANDARD.clone().lerp(ABOVE, (level - 0.5) * 2);
        });
        for (let i = 0; i < model.n; i++) { const c = segTint[model.segments[i]]; tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b; }
        geometry.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setIndex(new THREE.BufferAttribute(model.indices, 1));
    const colors = new Float32Array(model.n * 3), levels = SEG.map(seg => seg ? segmentLevel(r, seg, mode) : null);
    const palette = levels.map(level => level == null ? CLAY : mode === 'fat' ? LEAN.clone().lerp(FAT, level) : LOW.clone().lerp(MUSCLE, level));
    for (let i = 0; i < model.n; i++) { const c = palette[model.segments[i]]; colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
    if (demoProps) { scene.remove(demoProps); demoProps.traverse(o => o.geometry?.dispose()); demoProps = null; }
    const meshMaterial = mode === 'composition' ? anatomy : mode === 'muscle' || mode === 'focus' ? anatomyTint : material;
    demo = motion && rig?.n === model.n ? rigFigure(rig, geometry, meshMaterial, pos, H, model.segments, motion) : null;
    mesh = demo ? demo.mesh : new THREE.Mesh(geometry, meshMaterial); scene.add(mesh);
    if (demo) { demoProps = demo.props; scene.add(demoProps); demo.tick(playing ? clock.getElapsedTime() : 0); }
    shadow.visible = !demo || motion.anchor !== 'lying';
    if (demo && shownMotion !== r.motion) {
      // Side-on view chosen per motion: [azimuth from the front, elevation, target height / H, zoom out].
      const [az, el, ty, far = 1] = motion.view.map((v, k) => k < 2 ? v * Math.PI / 180 : v), dist = H * 2.15 * far;
      controls.target.set(0, H * ty, motion.anchor === 'lying' ? H * 0.02 : 0);
      camera.position.set(controls.target.x + dist * Math.sin(az) * Math.cos(el), controls.target.y + dist * Math.sin(el), controls.target.z + dist * Math.cos(az) * Math.cos(el));
      camera.userData.placed = true; controls.autoRotate = false; clock.start();
    } else if (!demo) {
      controls.target.set(0, H * 0.53, 0);
      if (!camera.userData.placed || shownMotion) { camera.position.set(H * 0.55, H * 0.7, H * 2.05); camera.userData.placed = true; }
    }
    shownMotion = demo ? r.motion : null;
    controls.update();
    return {estimated: GIRTHS.filter(k => !r[k])};
  }

  const resize = () => { const w = container.clientWidth || 300, h = container.clientHeight || 360; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  const loop = () => { frame = requestAnimationFrame(loop); if (document.hidden || !container.isConnected || container.offsetParent === null) return; if (demo && playing) demo.tick(clock.getElapsedTime()); controls.update(); renderer.render(scene, camera); };
  loop();
  return {
    update,
    hasMotion: () => !!demo,
    setPlaying(on, at = 1.4) { playing = on; if (demo) { if (on) clock.start(); demo.tick(on ? 0 : at); } },
    dispose() { demoProps?.traverse(o => o.geometry?.dispose()); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); mesh?.geometry.dispose(); material.dispose(); anatomy.dispose(); anatomyTint.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
