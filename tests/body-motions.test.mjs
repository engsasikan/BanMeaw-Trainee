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

test('bicycle crunch keeps hands beside the head and alternates a bent knee with a straight leg',async()=>{
 const rig=await loadRig();
 for(const sex of ['male','female']){
  const model=await loadModel(sex),record={sex,height:sex==='male'?175:160,weight:sex==='male'?78:62};
  for(const phase of [0,1]){
   const joints=demoJoints(rig,model,record,'bicycleCrunch',phase),height=record.height/100;
   for(const side of ['L','R'])assert.ok(joints.get('hand.'+side).distanceTo(joints.get('head'))<height*.12,`${sex}: hand drift`);
   const bent=phase===0?'L':'R',straight=phase===0?'R':'L';
   const kneeAngle=side=>{const knee=joints.get('lowerleg.'+side),a=joints.get('upperleg.'+side).clone().sub(knee).normalize(),b=joints.get('foot.'+side).clone().sub(knee).normalize();return Math.acos(Math.max(-1,Math.min(1,a.dot(b))))*180/Math.PI;};
   assert.ok(kneeAngle(bent)>50&&kneeAngle(bent)<120,`${sex}: bent knee`);
   assert.ok(kneeAngle(straight)>165,`${sex}: extended leg`);
   assert.ok(joints.get('foot.'+bent).y<joints.get('lowerleg.'+bent).y,`${sex}: bent ankle must not flip above knee`);
   assert.ok(joints.get('hips').y<height*.08,`${sex}: pelvis floats`);
  }
 }
});
