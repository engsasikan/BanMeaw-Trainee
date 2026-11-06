import test from 'node:test';
import assert from 'node:assert/strict';
import {exercisesForMuscle} from '../dist/anatomy-picker.mjs';
import {musclesFor} from '../dist/exercise-muscles.mjs';

test('every selectable muscle has exercises with that primary muscle, excluding cardio',()=>{
 for(const key of ['pec','deltoid','biceps','triceps','abs','oblique','lat','trap','erector','glute','quad','hamstring','calf']){
  const results=exercisesForMuscle(key);
  assert.ok(results.length>0,key);
  assert.ok(results.every(x=>x.group!=='คาร์ดิโอ'&&musclesFor(x.name,x.aliases).primary.includes(key)),key);
 }
});
test('search stays within the chosen muscle and supports Thai and English',()=>{
 assert.ok(exercisesForMuscle('pec','push-up').some(x=>x.name==='Push-up'));
 assert.ok(exercisesForMuscle('quad','สควอต').length>0);
 assert.equal(exercisesForMuscle('pec','unmatched-exercise-xyz').length,0);
 assert.equal(exercisesForMuscle('pec','Biceps Curl').length,0);
});
