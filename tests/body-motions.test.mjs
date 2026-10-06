import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

globalThis.fetch = async url => new Response(await readFile(new URL('../dist/models/' + (String(url).includes('rig') ? 'body-rig.bin' : 'body-' + (String(url).includes('female') ? 'female' : 'male') + '.bin'), import.meta.url)));
const {loadModel, loadRig, MOTION_IDS, demoJoints} = await import('../src/body3d.mjs');

test('every demonstration poses a sensible body', async () => {
  const rig = await loadRig();
  for (const sex of ['female', 'male']) {
    const model = await loadModel(sex), record = {sex, height: sex === 'female' ? 160 : 175, weight: sex === 'female' ? 62 : 78};
    for (const id of MOTION_IDS) {
      const a = demoJoints(rig, model, record, id, 0), b = demoJoints(rig, model, record, id, 1);
      for (const [name, p] of [...a, ...b]) {
        assert.ok(Number.isFinite(p.x + p.y + p.z), `${sex} ${id}: ${name} is not a number`);
        assert.ok(p.y > -0.06, `${sex} ${id}: ${name} is ${(-p.y * 100).toFixed(0)} cm under the floor`);
      }
      const moved = Math.max(...[...a].map(([n, p]) => p.distanceTo(b.get(n))));
      assert.ok(moved > 0.02, `${sex} ${id}: does not move (${(moved * 100).toFixed(1)} cm)`);
    }
  }
});
