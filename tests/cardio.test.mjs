import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecords} from '../dist/store.mjs';
const base={id:'cardio-test',kind:'workout',day:'2026-10-04',exercise:'วิ่ง',weight:null,sets:null,reps:null,notes:''};
test('cardio duration and distance survive validation for database payload',()=>{const [r]=validateRecords([{...base,trainingType:'cardio',duration:30,distance:3.5}]);assert.equal(r.duration,30);assert.equal(r.distance,3.5);assert.equal(r.trainingType,'cardio');});
test('reject missing or invalid cardio duration',()=>{for(const duration of [null,0,-1,Infinity,1441])assert.throws(()=>validateRecords([{...base,trainingType:'cardio',duration}]));});
test('existing strength records remain supported',()=>assert.equal(validateRecords([base])[0].trainingType,'strength'));

test('incline persists, allows flat walking and rejects invalid values',()=>{for(const incline of [0,8,12.5])assert.equal(validateRecords([{...base,trainingType:'cardio',duration:30,incline}])[0].incline,incline);for(const incline of [-1,101,Infinity,'8'])assert.throws(()=>validateRecords([{...base,trainingType:'cardio',duration:30,incline}]));assert.equal(validateRecords([{...base,trainingType:'cardio',duration:30}])[0].incline,null);});
test('cardio speed is optional, kept when set and range-checked',()=>{assert.equal(validateRecords([{...base,trainingType:'cardio',duration:30}])[0].speed,undefined);assert.equal(validateRecords([{...base,trainingType:'cardio',duration:30,incline:12,speed:5.2}])[0].speed,5.2);for(const speed of [-1,51,Infinity])assert.throws(()=>validateRecords([{...base,trainingType:'cardio',duration:30,speed}]));});
