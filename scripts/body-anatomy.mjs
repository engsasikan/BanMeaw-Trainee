// Stylised muscle map for the MakeHuman base mesh, used by scripts/build-body-models.mjs.
// Each body vertex gets a muscle region, a fibre direction and flags (region border,
// tendon, plain skin). Regions are placed with simple rules around the skeleton joints,
// so this is a diagram-level approximation of the main muscle groups, not medical anatomy.
// MakeHuman axes: +x = the body's left, +y = up, +z = front; units are decimetres.

const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const sub = (a, b) => a.map((v, k) => v - b[k]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Position along segment a->b (0..1) and distance to it.
const along = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return [t, Math.hypot(...sub(p, a.map((v, k) => v + ab[k] * t)))]; };

export const FLAG_BORDER = 1, FLAG_TENDON = 2, FLAG_SKIN = 4;

export function muscleMap({positions, indices, segments, J}) {
  const n = segments.length, P = i => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  // Smooth vertex normals.
  const normals = new Float32Array(n * 3);
  for (let f = 0; f < indices.length; f += 3) {
    const [a, b, c] = [indices[f], indices[f + 1], indices[f + 2]], pa = P(a);
    const e1 = sub(P(b), pa), e2 = sub(P(c), pa);
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) normals[v * 3 + k] += fn[k];
  }
  const N = i => norm([normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]]);

  const S = (J('l-shoulder')[1] + J('r-shoulder')[1]) / 2, neckY = J('neck')[1], pelvisY = J('pelvis')[1];
  const hipY = (J('l-upper-leg')[1] + J('r-upper-leg')[1]) / 2, waistY = J('spine-3')[1], shoulderX = Math.abs(J('l-shoulder')[0]);
  const chestBottom = S - 1.15, navel = waistY - 0.25;
  const ids = new Map(), regionId = name => { if (!ids.has(name)) ids.set(name, ids.size + 1); return ids.get(name); };
  const region = new Uint8Array(n), fiber = new Int8Array(n * 3), flags = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const p = P(i), nr = N(i), seg = segments[i], s = p[0] >= 0 ? 1 : -1, side = s > 0 ? 'l' : 'r', ax = Math.abs(p[0]);
    let name = 'skin', dir = [0, 1, 0], kind = 'muscle';
    if (seg === 5) { name = 'head'; kind = 'skin'; }
    else if (seg === 0) {
      const front = nr[2] > 0.2, back = nr[2] < -0.2;
      if (p[1] > S + 0.25) { name = (back ? 'trap-' : 'neck-') + side; dir = back ? [s, -0.45, 0] : [s * 0.3, 1, 0.3]; }
      else if (front) {
        if (p[1] >= chestBottom && ax < shoulderX * 0.95) {
          if (ax < 0.08) { name = 'sternum'; kind = 'tendon'; } else { name = 'pec-' + side; dir = [s, 0.3, 0.15]; }
        } else if (p[1] < chestBottom && p[1] > pelvisY - 0.6 && ax < 0.62) {
          if (ax < 0.07) { name = 'linea-alba'; kind = 'tendon'; }
          else {
            // Rectus abdominis: three bands above the navel (the "six pack") and one below.
            const band = p[1] < navel ? 3 : Math.min(2, Math.floor((chestBottom - p[1]) / ((chestBottom - navel) / 3)));
            name = `abs${band}-${side}`;
          }
        } else if (p[1] > chestBottom - 0.9 && ax >= 0.62) { name = 'serratus-' + side; dir = [s * 0.8, 0.6, 0]; }
        else { name = 'oblique-' + side; dir = [s * 0.55, 0.85, 0]; }
      } else if (back) {
        if (ax < 0.06 && p[1] > pelvisY) { name = 'spine'; kind = 'tendon'; }
        else if (p[1] > S - 0.6 || (p[1] > S - 2.4 && ax < 0.35 + (p[1] - (S - 2.4)) * 0.55)) { name = 'trap-' + side; dir = p[1] > S - 0.6 ? [s, -0.45, 0] : [s, 0.15, 0]; }
        else if (p[1] < pelvisY + 0.2) { name = 'glute-' + side; dir = [s * 0.75, -0.65, 0]; }
        else if (ax < 0.4 && p[1] < waistY + 0.6) { name = 'erector-' + side; }
        else { name = 'lat-' + side; dir = [s * 0.65, 0.75, 0]; }
      } else if (p[1] > chestBottom - 0.5) { name = 'serratus-' + side; dir = [s * 0.8, 0.6, 0]; }
      else { name = 'oblique-' + side; dir = [s * 0.55, 0.85, 0]; }
    } else if (seg <= 2) {
      const sh = J(side + '-shoulder'), el = J(side + '-elbow'), ha = J(side + '-hand');
      const [u, du] = along(p, sh, el), [v, dv] = along(p, el, ha), upper = du <= dv;
      const fwd = nr[2] > 0;
      if (dv < du && v >= 1 && Math.hypot(...sub(p, ha)) > 0.35) { name = 'hand-' + side; kind = 'skin'; }
      else if (upper && (u < 0.35 || Math.hypot(...sub(p, sh)) < 0.8)) { name = 'deltoid-' + side; dir = norm(sub(el, sh)); }
      else if (upper) { name = (fwd ? 'biceps-' : 'triceps-') + side; dir = norm(sub(el, sh)); }
      else if (v > 0.82) { name = 'wrist-' + side; kind = 'tendon'; dir = norm(sub(ha, el)); }
      else { name = (fwd ? 'flexor-' : 'extensor-') + side; dir = norm(sub(ha, el)); }
    } else {
      const hp = J(side + '-upper-leg'), kn = J(side + '-knee'), an = J(side + '-ankle');
      const [u, du] = along(p, hp, kn), [v, dv] = along(p, kn, an), upper = du <= dv;
      const front = nr[2] > 0.2, back = nr[2] < -0.2, medial = s * nr[0] < -0.35;
      if (p[1] < an[1] - 0.2) { name = 'foot-' + side; kind = 'skin'; }
      else if (upper && back && p[1] > hipY - 1.3) { name = 'glute-' + side; dir = [s * 0.75, -0.65, 0]; }
      else if (Math.hypot(...sub(p, kn)) < 0.5 && front) { name = 'knee-' + side; kind = 'tendon'; }
      else if (upper) {
        dir = norm(sub(kn, hp));
        if (medial && !back) { name = 'adductor-' + side; dir = [-s * 0.4, 1, 0]; }
        else name = (back ? 'hamstring-' : 'quad-') + side;
      } else {
        dir = norm(sub(an, kn));
        if (v > 0.8 && back) { name = 'achilles-' + side; kind = 'tendon'; }
        else name = (back || medial ? 'calf-' : 'tibialis-') + side;
      }
    }
    region[i] = regionId(name);
    flags[i] = kind === 'tendon' ? FLAG_TENDON : kind === 'skin' ? FLAG_SKIN : 0;
    const d = norm(dir); for (let k = 0; k < 3; k++) fiber[i * 3 + k] = Math.round(d[k] * 127);
  }
  // Border vertices (drawn as thin white fascia lines): on triangles that span two regions,
  // flag only the vertices of the lower region id so the line is one edge wide.
  for (let f = 0; f < indices.length; f += 3) {
    const tri = [indices[f], indices[f + 1], indices[f + 2]], low = Math.min(...tri.map(v => region[v]));
    if (tri.some(v => region[v] !== low) && !tri.every(v => flags[v] & FLAG_SKIN)) for (const v of tri) if (region[v] === low) flags[v] |= FLAG_BORDER;
  }
  return {region, fiber, flags, regions: ids.size};
}
