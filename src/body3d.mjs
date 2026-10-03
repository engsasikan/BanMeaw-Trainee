// Clay-style 3D body figure built from simple shapes, sized from body measurements.
// Bundled to dist/body3d.js by scripts/build.mjs and loaded only on the profile page.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const REF = {
  male:   {bmi:23,   fat:18, chest:96, waist:84, hip:97, arm:31, thigh:55, calf:37, mus:{la:3.2, ra:3.2, trunk:26, ll:9.5, rl:9.5}},
  female: {bmi:21.5, fat:28, chest:86, waist:70, hip:95, arm:27, thigh:54, calf:35, mus:{la:2.0, ra:2.0, trunk:19, ll:7.0, rl:7.0}},
};
const CLAY = new THREE.Color('#d8d2c8'), FAT = new THREE.Color('#ff6a1f'), LEAN = new THREE.Color('#f3e2c9'), MUSCLE = new THREE.Color('#4f8dff'), LOW = new THREE.Color('#b9b4ad');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Fill in missing girths from height/weight/body fat so the figure is always plausible.
export function bodyShape(r = {}) {
  const sex = r.sex === 'female' ? 'female' : 'male', ref = REF[sex];
  const height = r.height || (sex === 'female' ? 160 : 172);
  const bmi = r.weight ? r.weight / (height / 100) ** 2 : ref.bmi;
  const scale = Math.sqrt(clamp(bmi, 14, 50) / ref.bmi);
  const fatShift = r.body_fat ? (r.body_fat - ref.fat) * 0.5 : 0;
  const g = key => r[key] || ref[key] * scale + (key === 'waist' ? fatShift : key === 'hip' ? fatShift * 0.5 : 0);
  return {sex, height, chest: g('chest'), waist: g('waist'), hip: g('hip'), arm: g('arm'), thigh: g('thigh'), calf: g('calf'), estimated: ['chest','waist','hip','arm','thigh','calf'].filter(k => !r[k])};
}

// 0..1 intensity for a segment in the chosen mode, or null when there is no data.
export function segmentLevel(r, seg, mode) {
  const sex = r.sex === 'female' ? 'female' : 'male';
  if (mode === 'fat') {
    // Segment fat is % of standard (100 = standard); fall back to overall body fat %.
    const v = r['fat_' + seg];
    if (v != null) return clamp((v - 60) / 140, 0, 1);
    return r.body_fat == null ? null : clamp((r.body_fat - (sex === 'female' ? 18 : 10)) / 25, 0, 1);
  }
  if (mode === 'muscle') {
    const v = r['mus_' + seg];
    return v == null ? null : clamp((v / REF[sex].mus[seg] - 0.7) / 0.6, 0, 1);
  }
  return null;
}

export function mountBody(container) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#fff4e8', '#3a3530', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffb27a', 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {enablePan: false, enableDamping: true, autoRotate: true, autoRotateSpeed: 1.6, minDistance: 2.2, maxDistance: 7});
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  let figure = null, frame = 0;

  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  function build(r, mode) {
    if (figure) { scene.remove(figure); figure.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
    figure = new THREE.Group();
    const s = bodyShape(r), H = s.height / 100, rad = c => c / (2 * Math.PI) / 100;
    const mat = seg => {
      const level = seg ? segmentLevel(r, seg, mode) : null;
      const color = level == null ? CLAY.clone() : mode === 'fat' ? LEAN.clone().lerp(FAT, level) : LOW.clone().lerp(MUSCLE, level);
      return new THREE.MeshStandardMaterial({color, roughness: 0.78, metalness: 0});
    };
    const skin = () => new THREE.MeshStandardMaterial({color: CLAY.clone(), roughness: 0.78, metalness: 0});
    const add = (geo, m, pos, scl) => { const mesh = new THREE.Mesh(geo, m); if (pos) mesh.position.copy(pos); if (scl) mesh.scale.set(...scl); figure.add(mesh); return mesh; };
    const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
    // Tapered limb segment from a to b with rounded joints.
    const limb = (a, b, ra, rb, m) => {
      const dir = b.clone().sub(a), len = dir.length();
      const mesh = add(new THREE.CylinderGeometry(rb, ra, len, 24, 1, true), m, a.clone().add(b).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(v(0, 1, 0), dir.normalize());
      add(new THREE.SphereGeometry(ra, 24, 16), m, a); add(new THREE.SphereGeometry(rb, 24, 16), m, b);
    };
    // Torso: lathe profile scaled to an ellipse that keeps each girth's perimeter (sx + sz = 2).
    const [sx, sz] = [1.2, 0.8], female = s.sex === 'female';
    const hipR = rad(s.hip), waistR = rad(s.waist), chestR = rad(s.chest), neckR = rad(s.chest) * 0.36;
    const shoulderR = chestR * (female ? 0.98 : 1.06);
    const profile = [[hipR * 0.55, 0.47], [hipR * 0.92, 0.49], [hipR, 0.525], [(hipR + waistR) / 2, 0.57], [waistR, 0.61], [(waistR + chestR) / 2, 0.665], [chestR, 0.72], [shoulderR, 0.79], [shoulderR * 0.8, 0.815], [neckR * 1.4, 0.83], [neckR, 0.845]]
      .map(([x, y]) => new THREE.Vector2(x, y * H));
    const trunk = mat('trunk');
    add(new THREE.LatheGeometry(profile, 40), trunk, null, [sx, 1, sz]);
    if (female) for (const side of [-1, 1]) add(new THREE.SphereGeometry(chestR * 0.3, 24, 16), trunk, v(side * chestR * 0.4, 0.712 * H, chestR * sz * 0.62), [1.1, 0.9, 0.6]);
    add(new THREE.CylinderGeometry(neckR, neckR * 1.08, 0.06 * H, 24), skin(), v(0, 0.865 * H));
    add(new THREE.SphereGeometry(0.062 * H, 32, 24), skin(), v(0, 0.93 * H, 0.004), [0.88, 1.12, 0.98]);
    // Arms (slight A-pose) with deltoids.
    const armR = rad(s.arm), shoulderX = shoulderR * sx * 0.92;
    for (const [side, seg] of [[1, 'la'], [-1, 'ra']]) {
      const m = mat(seg), sh = v(side * shoulderX, 0.8 * H), el = v(side * (shoulderX + 0.055 * H), 0.625 * H, -0.01), wr = v(side * (shoulderX + 0.09 * H), 0.47 * H, 0.02);
      add(new THREE.SphereGeometry(armR * 1.25, 24, 16), m, v(side * shoulderX * 0.97, 0.795 * H), [1, 0.9, 0.95]);
      limb(sh, el, armR, armR * 0.78, m); limb(el, wr, armR * 0.82, armR * 0.55, m);
      add(new THREE.SphereGeometry(armR * 0.75, 20, 14), skin(), v(wr.x + side * 0.004, wr.y - 0.04 * H, wr.z), [0.7, 1.3, 0.55]);
    }
    // Legs
    const thighR = rad(s.thigh), calfR = rad(s.calf), legX = hipR * sx * 0.48;
    for (const [side, seg] of [[1, 'll'], [-1, 'rl']]) {
      const m = mat(seg), hp = v(side * legX, 0.48 * H), kn = v(side * legX * 0.86, 0.285 * H, 0.005), an = v(side * legX * 0.8, 0.045 * H);
      limb(hp, kn, thighR, calfR * 0.78, m); limb(kn, an, calfR, calfR * 0.5, m);
      add(new THREE.SphereGeometry(calfR * 0.6, 20, 14), skin(), v(an.x, 0.025 * H, 0.045 * H), [0.75, 0.45, 1.9]);
    }
    scene.add(figure);
    controls.target.set(0, H * 0.53, 0);
    if (!camera.userData.placed) { camera.position.set(H * 0.65, H * 0.7, H * 2.15); camera.userData.placed = true; }
    controls.update();
    return s;
  }

  const resize = () => { const w = container.clientWidth || 300, h = container.clientHeight || 360; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  const loop = () => { frame = requestAnimationFrame(loop); if (document.hidden || !container.isConnected || container.offsetParent === null) return; controls.update(); renderer.render(scene, camera); };
  loop();
  return {
    update: (record, mode = 'shape') => build(record || {}, mode),
    dispose() { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
