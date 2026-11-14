import test from 'node:test';import assert from 'node:assert/strict';
import {formatSeconds,effortText,looksTimed} from '../dist/effort.mjs';
import {validateRecords} from '../dist/store.mjs';
import {planExercises} from '../src/plans.mjs';
const base={id:'p',kind:'workout',day:'2026-11-16',exercise:'Plank',trainingType:'strength',weight:null,sets:3,notes:''};
test('timed sets read as seconds or minutes, counted sets as reps',()=>{
 assert.equal(formatSeconds(45),'45 วิ');assert.equal(formatSeconds(60),'1 นาที');assert.equal(formatSeconds(90),'1:30 นาที');
 assert.equal(effortText({seconds:45}),'45 วิ');assert.equal(effortText({reps:12}),'12 ครั้ง');assert.equal(effortText({}),'');
 for(const name of ['Plank','Side Plank','แพลงก์','Wall Sit','Dead Hang'])assert.ok(looksTimed(name),name);
 for(const name of ['Squat','Push-up','Crunch'])assert.equal(looksTimed(name),false,name);
});
test('diary records keep seconds instead of reps for holds and reject mixed or out-of-range values',()=>{
 const [r]=validateRecords([{...base,reps:null,seconds:45,setLogs:[{weight:null,seconds:40},{weight:null,seconds:45}]}]);
 assert.equal(r.seconds,45);assert.equal(r.reps,null);assert.deepEqual(r.setLogs,[{weight:null,seconds:40},{weight:null,seconds:45}]);
 assert.equal(validateRecords([{...base,reps:12}])[0].seconds,undefined,'counted sets are unchanged');
 for(const bad of [{reps:10,seconds:30},{reps:null,seconds:0},{reps:null,seconds:3601},{reps:null,seconds:1.5}])assert.throws(()=>validateRecords([{...base,...bad}]));
 assert.throws(()=>validateRecords([{...base,trainingType:'cardio',duration:10,reps:null,seconds:30}]),'cardio uses minutes, not seconds per set');
 assert.throws(()=>validateRecords([{...base,reps:null,seconds:30,setLogs:[{weight:null,seconds:0}]}]));
});
test('plans prescribe seconds per set for holds',()=>{
 assert.deepEqual(planExercises({exercises:[{exercise:'Plank',weight:null,sets:3,seconds:45,rest_seconds:30}]}),[{exercise:'Plank',weight:null,sets:3,seconds:45,rest_seconds:30}]);
 assert.deepEqual(planExercises({exercises:[{exercise:'Squat',weight:20,sets:3,reps:10}]}),[{exercise:'Squat',weight:20,sets:3,reps:10}]);
 assert.throws(()=>planExercises({exercises:[{exercise:'Plank',weight:null,sets:3,seconds:0}]}));
 assert.throws(()=>planExercises({exercises:[{exercise:'Plank',weight:null,sets:3}]}),'needs reps or seconds');
});
