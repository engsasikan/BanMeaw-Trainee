import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecords} from '../dist/store.mjs';
const base={id:'cardio-test',kind:'workout',day:'2026-10-04',exercise:'วิ่ง',weight:null,sets:null,reps:null,notes:''};
test('cardio duration and distance survive validation for database payload',()=>{const [r]=validateRecords([{...base,trainingType:'cardio',duration:30,distance:3.5}]);assert.equal(r.duration,30);assert.equal(r.distance,3.5);assert.equal(r.trainingType,'cardio');});
test('reject missing or invalid cardio duration',()=>{for(const duration of [null,0,-1,Infinity,1441])assert.throws(()=>validateRecords([{...base,trainingType:'cardio',duration}]));});
test('existing strength records remain supported',()=>assert.equal(validateRecords([base])[0].trainingType,'strength'));
