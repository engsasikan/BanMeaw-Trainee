import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {demonstrationFor} from '../dist/exercise-demo.mjs';
import {LIBRARY} from '../dist/exercise-library.mjs';
import {searchExercises} from '../dist/exercise-picker.mjs';

globalThis.fetch=async url=>new Response(await readFile(new URL('../dist/models/'+(String(url).includes('rig')?'body-rig.bin':'body-'+(String(url).includes('female')?'female':'male')+'.bin'),import.meta.url)));
const {motionDefinition,loadModel,loadRig,demoJoints}=await import('../src/body3d.mjs');
test('profiles distinguish equipment, posture, grip, side and bench angles',()=>{
 const dumbbell=demonstrationFor('Dumbbell Seated Hammer Curl');
 const barbell=demonstrationFor('Barbell Curl');
 assert.equal(dumbbell.equipment,'dumbbell');assert.equal(dumbbell.posture,'seated');assert.equal(dumbbell.grip,'neutral');
 assert.equal(motionDefinition(dumbbell.motion,dumbbell).anchor,'seated');
 assert.ok(motionDefinition(dumbbell.motion,dumbbell).props.includes('dumbbells'));
 assert.ok(motionDefinition(barbell.motion,barbell).props.includes('barbell'));
 const single=demonstrationFor('Dumbbell One Arm Shoulder Press');assert.equal(motionDefinition(single.motion,single).singleArm,true);
 const floor=demonstrationFor('Dumbbell Floor Squeeze Press');assert.equal(motionDefinition(floor.motion,floor).surface,.02);
 assert.equal(demonstrationFor('Barbell Incline Bench Press').angle,30);
 assert.equal(demonstrationFor('Barbell Decline Bench Press').angle,-15);
 assert.equal(demonstrationFor('my unknown exercise'),null);
 const singleLeg=demonstrationFor('Barbell One Leg Squat');assert.equal(motionDefinition(singleLeg.motion,singleLeg).anchor,'footL');
 for(const [name,id] of [['Lat Pulldown','pulldown'],['Chest Press Machine','seatedChestPress'],['Hip Adduction Machine','hipAdduction'],['Hip Abduction Machine','seatedHipAbduction'],['Rowing Machine','rowingErg'],['Jump Rope','jumpRope'],['Burpee','burpee']])assert.equal(demonstrationFor(name).motion,id,name);
 assert.equal(demonstrationFor('Quads').quality,'muscle-group');assert.equal(demonstrationFor('HIIT').quality,'protocol');
 // Changing a profile must not modify the shared base used by another exercise.
 const first=motionDefinition(barbell.motion,barbell);const changed=motionDefinition(dumbbell.motion,dumbbell);changed.keys[0].upperarm[0]=999;
 assert.deepEqual(motionDefinition(barbell.motion,barbell),first);
});
test('every selectable profile renders finite joints above the floor on male and female rigs',async()=>{
 const rig=await loadRig();const failures=[];
 for(const sex of ['male','female']){
  const model=await loadModel(sex),record={sex,height:sex==='male'?175:160,weight:sex==='male'?78:62};
  for(const {name} of searchExercises('')){
   const profile=demonstrationFor(name);assert.ok(profile,name);
   if(profile.quality==='protocol'){assert.equal(profile.motion,null);continue;}
   assert.ok(motionDefinition(profile.motion,profile),name);
   for(const phase of [0,.5,1]){
    const joints=demoJoints(rig,model,record,profile.motion,phase,profile);
    for(const [joint,p] of joints){if(!Number.isFinite(p.x+p.y+p.z)||p.y<-.06){failures.push(`${sex} ${name} ${phase}: ${joint} y=${p.y}`);break;}}
   }
  }
 }
 assert.deepEqual(failures,[]);
});
